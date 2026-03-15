function roundAmount(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/[（）]/g, (matched) => (matched === "（" ? "(" : ")"))
    .trim()
    .toLowerCase();
}

function uniqueBy(items, keyBuilder) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyBuilder(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function classifyCatalogCategory(item = {}) {
  const categoryText = [item.category, item.itemName, item.name].filter(Boolean).join(" ");
  if (/(药|片|针|胶囊|颗粒|注射液|冲剂)/.test(categoryText)) {
    return "drug";
  }
  if (/(材料|耗材|置换|支架|导管|敷料|缝线)/.test(categoryText)) {
    return "material";
  }
  return "treatment";
}

function resolveHospitalRequirementText(context = {}, coverageConfig = {}, claimType = "") {
  const explicitRequirement = [
    coverageConfig?.hospital_requirements,
    coverageConfig?.hospitalRequirement,
    context?.policy?.hospital_requirements,
    context?.policy?.hospitalRequirement,
    context?.policy?.hospitalScope,
  ].find(Boolean);

  if (explicitRequirement) {
    return { text: String(explicitRequirement), source: "explicit" };
  }

  if (claimType === "HEALTH") {
    return { text: "二级及以上公立医院", source: "default" };
  }

  return { text: "", source: "none" };
}

function parseHospitalRequirement(rawText = "", source = "none") {
  const text = String(rawText || "").trim();
  if (!text) {
    return null;
  }

  let minLevelRank = 0;
  if (/三级/.test(text)) {
    minLevelRank = 3;
  } else if (/二级/.test(text)) {
    minLevelRank = 2;
  } else if (/一级/.test(text)) {
    minLevelRank = 1;
  }

  return {
    rawText: text,
    source,
    minLevelRank,
    requiresPublic: /公立/.test(text),
    requiresOrdinaryWard: /普通部/.test(text),
  };
}

function parseHospitalLevelRank(levelText = "") {
  if (/三级/.test(levelText)) return 3;
  if (/二级/.test(levelText)) return 2;
  if (/一级/.test(levelText)) return 1;
  return 0;
}

function matchCatalogItem(itemName, category, province, catalog = []) {
  const normalizedInput = normalizeText(itemName);
  if (!normalizedInput) {
    return null;
  }

  const candidates = catalog.filter((entry) => {
    const sameProvince = !province || entry?.province === province || entry?.province === "national";
    return sameProvince && entry?.category === category;
  });

  const aliasValues = (entry) =>
    uniqueBy(
      [entry?.name, entry?.genericName, ...(Array.isArray(entry?.aliases) ? entry.aliases : [])]
        .filter(Boolean)
        .map((value) => normalizeText(value)),
      (value) => value,
    );

  const exact = candidates.find((entry) => aliasValues(entry).includes(normalizedInput));
  if (exact) {
    return exact;
  }

  const fuzzy = candidates.find((entry) =>
    aliasValues(entry).some(
      (value) =>
        value &&
        value.length >= 4 &&
        (normalizedInput.includes(value) || value.includes(normalizedInput)),
    ),
  );
  return fuzzy || null;
}

function buildMedicalManualReason(code, message, metadata = undefined) {
  return {
    code,
    source: "MEDICAL_REVIEW",
    category: "MEDICAL",
    stage: "SETTLEMENT",
    message,
    ...(metadata ? { metadata } : {}),
  };
}

export function evaluateHospitalRequirement({ context = {}, coverageConfig = {}, claimType = "" }) {
  const requirementText = resolveHospitalRequirementText(context, coverageConfig, claimType);
  const requirement = parseHospitalRequirement(requirementText.text, requirementText.source);
  const hospitalName =
    context?.claim?.hospital_name ||
    context?.claim?.hospitalName ||
    context?.facts?.claim?.hospitalName ||
    "";
  const hospital = context?.hospital || null;

  const result = {
    requirement,
    hospitalName,
    hospital,
    passed: true,
    blockingMismatch: false,
    warnings: [],
    manualReviewReasons: [],
  };

  if (!requirement) {
    return result;
  }

  if (!hospitalName) {
    result.passed = false;
    result.manualReviewReasons.push(
      buildMedicalManualReason(
        "HOSPITAL_INFO_MISSING",
        `缺少就诊医院信息，无法校验“${requirement.rawText}”要求`,
        { requirement: requirement.rawText },
      ),
    );
    return result;
  }

  if (!hospital) {
    result.passed = false;
    result.manualReviewReasons.push(
      buildMedicalManualReason(
        "HOSPITAL_NOT_FOUND",
        `未查询到医院“${hospitalName}”的资质信息，无法校验“${requirement.rawText}”要求`,
        { hospitalName, requirement: requirement.rawText },
      ),
    );
    return result;
  }

  const actualLevelRank = parseHospitalLevelRank(hospital.level);
  const levelMismatch = requirement.minLevelRank > 0 && actualLevelRank > 0 && actualLevelRank < requirement.minLevelRank;
  const publicMismatch = requirement.requiresPublic && !String(hospital.type || "").includes("公立");
  const insuranceMismatch = hospital.qualifiedForInsurance === false;

  if (requirement.requiresOrdinaryWard) {
    result.manualReviewReasons.push(
      buildMedicalManualReason(
        "WARD_SCOPE_UNCONFIRMED",
        `产品要求“${requirement.rawText}”，当前缺少普通部/特需部区分信息，需人工确认`,
        { hospitalName, requirement: requirement.rawText },
      ),
    );
  }

  if (levelMismatch || publicMismatch || insuranceMismatch) {
    result.passed = false;
    const mismatchLabels = [];
    if (levelMismatch) mismatchLabels.push(`医院等级为${hospital.level || "未知"}`);
    if (publicMismatch) mismatchLabels.push(`医院性质为${hospital.type || "未知"}`);
    if (insuranceMismatch) mismatchLabels.push("医院未通过医保定点校验");
    const message = `医院“${hospital.name || hospitalName}”不满足“${requirement.rawText}”要求：${mismatchLabels.join("，")}`;
    result.manualReviewReasons.push(
      buildMedicalManualReason("HOSPITAL_REQUIREMENT_NOT_MET", message, {
        hospitalName: hospital.name || hospitalName,
        requirement: requirement.rawText,
        hospitalLevel: hospital.level || null,
        hospitalType: hospital.type || null,
        qualifiedForInsurance: hospital.qualifiedForInsurance ?? null,
      }),
    );
    if (requirement.source === "explicit") {
      result.blockingMismatch = true;
      result.warnings.push({
        rule_id: "MEDICAL_HOSPITAL_REQUIREMENT",
        category: "MEDICAL",
        message,
      });
    }
  }

  return result;
}

export function evaluateMedicalCatalogItems({ context = {}, expenseItems = [] }) {
  const catalog = Array.isArray(context?.medical_catalog) ? context.medical_catalog : [];
  const province = context?.hospital?.province || null;
  const reviewedItems = [];
  const manualReviewReasons = [];
  const summary = {
    totalClaimedAmount: 0,
    catalogCoveredAmount: 0,
    selfPayAmount: 0,
    restrictedAmount: 0,
    uncertainAmount: 0,
    matchedItems: 0,
    selfPayItems: 0,
    uncertainItems: 0,
  };

  for (const item of expenseItems) {
    const amount = roundAmount(item?.totalPrice ?? item?.amount ?? 0);
    summary.totalClaimedAmount += amount;
    const itemName = item?.itemName || item?.name || "未命名费用项";
    const category = classifyCatalogCategory(item);
    const selfPayHint = /(自费|自付|自理|丙类|乙类自付)/.test(String(itemName));
    const isSummaryInput = item?.source === "intake-summary";

    let review = {
      status: "UNCERTAIN",
      catalogCategory: category,
      catalogMatch: null,
      ratio: 1,
      basis: "未匹配到医保目录条目",
      restriction: "",
    };

    if (isSummaryInput) {
      review = {
        ...review,
        status: "COVERED",
        ratio: 1,
        basis: "基于报案汇总金额生成的门急诊费用，暂按可赔费用保留，待后续票据明细补充时再做目录细分",
      };
      summary.catalogCoveredAmount += amount;
      summary.matchedItems += 1;
    } else if (selfPayHint) {
      review = {
        ...review,
        status: "SELF_PAY",
        ratio: 0,
        basis: "项目名称包含自费/自付提示，按目录外项目处理",
      };
      summary.selfPayAmount += amount;
      summary.selfPayItems += 1;
    } else {
      const matched = matchCatalogItem(itemName, category, province, catalog);
      if (matched) {
        const reimbursementRatio = Number(matched.reimbursementRatio);
        const normalizedRatio =
          Number.isFinite(reimbursementRatio) && reimbursementRatio >= 0
            ? Math.max(0, Math.min(1, reimbursementRatio / 100))
            : 1;
        review = {
          ...review,
          status: normalizedRatio < 1 ? "RESTRICTED" : "COVERED",
          ratio: normalizedRatio,
          basis: normalizedRatio < 1
            ? `匹配医保目录“${matched.name}”，目录报销比例 ${reimbursementRatio}%`
            : `匹配医保目录“${matched.name}”`,
          restriction: matched.restrictions || "",
          catalogMatch: {
            id: matched.id,
            name: matched.name,
            type: matched.type || "",
            reimbursementRatio: reimbursementRatio,
            restrictions: matched.restrictions || "",
            province: matched.province || "",
          },
        };
        summary.matchedItems += 1;
        summary.catalogCoveredAmount += roundAmount(amount * normalizedRatio);
        if (normalizedRatio < 1) {
          summary.restrictedAmount += amount;
        }
      } else {
        summary.uncertainAmount += amount;
        summary.uncertainItems += 1;
        manualReviewReasons.push(
          buildMedicalManualReason(
            "MEDICAL_CATALOG_UNMATCHED",
            `费用项“${itemName}”未匹配到医保目录，需人工确认目录内外属性`,
            { itemName, amount, category, province },
          ),
        );
      }
    }

    if (review.restriction) {
      manualReviewReasons.push(
        buildMedicalManualReason(
          "MEDICAL_CATALOG_RESTRICTION",
          `费用项“${itemName}”匹配医保目录但存在限制条件：${review.restriction}`,
          { itemName, amount, restriction: review.restriction },
        ),
      );
    }

    reviewedItems.push({
      ...item,
      medicalReview: review,
    });
  }

  summary.totalClaimedAmount = roundAmount(summary.totalClaimedAmount);
  summary.catalogCoveredAmount = roundAmount(summary.catalogCoveredAmount);
  summary.selfPayAmount = roundAmount(summary.selfPayAmount);
  summary.restrictedAmount = roundAmount(summary.restrictedAmount);
  summary.uncertainAmount = roundAmount(summary.uncertainAmount);

  return {
    reviewedItems,
    manualReviewReasons,
    summary,
  };
}

export function getLossLedgerAmountBeforeDeductible(item = {}) {
  const entries = Array.isArray(item?.entries) ? item.entries : [];
  const deductibleEntry = entries.find(
    (entry) => entry?.step === "DEDUCTIBLE" || entry?.reasonCode === "COVERAGE_DEDUCTIBLE_APPLIED",
  );
  if (deductibleEntry && Number.isFinite(Number(deductibleEntry.beforeAmount))) {
    return roundAmount(deductibleEntry.beforeAmount);
  }
  const lastEntry = entries[entries.length - 1];
  if (lastEntry && Number.isFinite(Number(lastEntry.afterAmount))) {
    return roundAmount(lastEntry.afterAmount);
  }
  return roundAmount(item?.payableAmount ?? 0);
}
