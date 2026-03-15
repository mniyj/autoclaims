import { diseaseDrugRuleDao, diseaseServiceRuleDao, dosageRuleDao, frequencyRuleDao, hospitalizationRuleDao } from '../dao/index.js';
import { diseaseDrugRelDao, diseaseServiceRelDao, surgeryComboDao } from '../dao/index.js';
import { diseaseDao, drugDao, serviceItemDao } from '../dao/index.js';

export function assessDiagnosisDrugMatch(diagnosisId, drugId) {
  const rules = diseaseDrugRuleDao.getDiseaseDrugRulesByDisease(diagnosisId);
  const matchedRules = rules.filter(r => r.object_id === drugId && r.status === 'active');
  
  if (matchedRules.length === 0) {
    return {
      matched: false,
      action: 'unknown',
      reason: '无匹配规则',
      rules: []
    };
  }

  const bestRule = matchedRules.sort((a, b) => b.priority - a.priority)[0];
  return {
    matched: true,
    action: bestRule.action,
    reason: bestRule.reason_code,
    ruleType: bestRule.rule_type,
    rules: matchedRules.map(r => r.rule_id)
  };
}

export function assessDiagnosisServiceMatch(diagnosisId, serviceItemId) {
  const rules = diseaseServiceRuleDao.getDiseaseServiceRulesByDisease(diagnosisId);
  const matchedRules = rules.filter(r => r.object_id === serviceItemId && r.status === 'active');
  
  if (matchedRules.length === 0) {
    return {
      matched: false,
      action: 'unknown',
      reason: '无匹配规则',
      rules: []
    };
  }

  const bestRule = matchedRules.sort((a, b) => b.priority - a.priority)[0];
  return {
    matched: true,
    action: bestRule.action,
    reason: bestRule.reason_code,
    ruleType: bestRule.rule_type,
    rules: matchedRules.map(r => r.rule_id)
  };
}

export function assessDosageReasonability(drugId, dailyDose) {
  const rules = dosageRuleDao.getDosageRulesByDrug(drugId);
  
  if (rules.length === 0) {
    return {
      reasonable: null,
      reason: '无剂量规则',
      withinRange: null
    };
  }

  const rule = rules[0];
  const doseMin = rule.dose_min || 0;
  const doseMax = rule.dose_max || Infinity;
  
  const withinRange = dailyDose >= doseMin && dailyDose <= doseMax;
  
  return {
    reasonable: withinRange,
    doseMin,
    doseMax,
    actualDose: dailyDose,
    action: withinRange ? 'approve' : rule.action,
    reason: withinRange ? '剂量在合理范围内' : rule.reason_code
  };
}

export function assessFrequencyReasonability(serviceItemId, frequency, periodDays = 1) {
  const rules = frequencyRuleDao.getFrequencyRulesByItem(serviceItemId);
  
  if (rules.length === 0) {
    return {
      reasonable: null,
      reason: '无频次规则',
      withinLimit: null
    };
  }

  const rule = rules[0];
  const freqMin = rule.frequency_min || 0;
  const freqMax = rule.frequency_max || Infinity;
  
  const withinLimit = frequency >= freqMin && frequency <= freqMax;
  
  return {
    reasonable: withinLimit,
    frequencyMin: freqMin,
    frequencyMax: freqMax,
    actualFrequency: frequency,
    action: withinLimit ? 'approve' : rule.action,
    reason: withinLimit ? '频次在合理范围内' : rule.reason_code
  };
}

export function assessHospitalizationNecessity(diagnosisId, hospitalDays) {
  const rules = hospitalizationRuleDao.getHospitalizationRulesByDisease(diagnosisId);
  
  if (rules.length === 0) {
    const disease = diseaseDao.getDiseaseById(diagnosisId);
    if (disease?.inpatient_necessity_flag === false) {
      return {
        necessary: false,
        reason: '该疾病通常无需住院',
        suggested: '门诊治疗',
        source: 'disease_master'
      };
    }
    return {
      necessary: null,
      reason: '无住院必要性规则',
      withinRange: null
    };
  }

  const rule = rules[0];
  const losMin = rule.los_min || 0;
  const losMax = rule.los_max || Infinity;
  
  const withinRange = hospitalDays >= losMin && hospitalDays <= losMax;
  
  return {
    necessary: !rule.not_necessity,
    daysMin: losMin,
    daysMax: losMax,
    actualDays: hospitalDays,
    action: withinRange ? 'approve' : rule.action,
    reason: withinRange ? '住院天数合理' : rule.reason_code
  };
}

export function getRecommendedDrugs(diseaseId) {
  const rels = diseaseDrugRelDao.getDiseaseDrugRelsByDisease(diseaseId);
  const recommended = rels.filter(r => r.rel_type === 'recommended' && r.status === 'active');
  
  return recommended.map(rel => {
    const drug = drugDao.getDrugById(rel.drug_id);
    return {
      drugId: rel.drug_id,
      name: drug?.generic_name || rel.drug_id,
      evidenceLevel: rel.evidence_level,
      source: rel.source
    };
  });
}

export function getRecommendedServices(diseaseId) {
  const rels = diseaseServiceRelDao.getDiseaseServiceRelsByDisease(diseaseId);
  const recommended = rels.filter(r => r.rel_type === 'recommended' && r.status === 'active');
  
  return recommended.map(rel => {
    const item = serviceItemDao.getServiceItemById(rel.item_id);
    return {
      itemId: rel.item_id,
      name: item?.standard_name || rel.item_id,
      evidenceLevel: rel.evidence_level,
      source: rel.source
    };
  });
}

export function getSurgeryCombo(surgeryItemId) {
  const combos = surgeryComboDao.getSurgeryCombosBySurgery(surgeryItemId);
  
  return combos.filter(c => c.status === 'active').map(combo => {
    const item = serviceItemDao.getServiceItemById(combo.related_item_id);
    return {
      itemId: combo.related_item_id,
      name: item?.standard_name || combo.related_item_id,
      comboType: combo.combo_type,
      required: combo.required_flag,
      confidence: combo.confidence
    };
  });
}

export function assessMedicalReasonability(assessment) {
  const { diagnosisId, drugs = [], services = [], hospitalDays } = assessment;
  const results = {
    diagnosis: diagnosisId,
    drugs: [],
    services: [],
    hospitalization: null,
    warnings: [],
    needsManualReview: false
  };

  for (const drug of drugs) {
    const drugMatch = assessDiagnosisDrugMatch(diagnosisId, drug.drugId);
    const dosageAssess = drug.dailyDose ? assessDosageReasonability(drug.drugId, drug.dailyDose) : null;
    
    results.drugs.push({
      drugId: drug.drugId,
      diagnosisMatch: drugMatch,
      dosage: dosageAssess
    });

    if (drugMatch.action === 'manual_review' || (dosageAssess && dosageAssess.action === 'manual_review')) {
      results.needsManualReview = true;
      results.warnings.push({ type: 'drug', target: drug.drugId, reason: '药品合理性存疑' });
    }
  }

  for (const service of services) {
    const serviceMatch = assessDiagnosisServiceMatch(diagnosisId, service.itemId);
    const freqAssess = service.frequency ? assessFrequencyReasonability(service.itemId, service.frequency) : null;
    
    results.services.push({
      itemId: service.itemId,
      diagnosisMatch: serviceMatch,
      frequency: freqAssess
    });

    if (serviceMatch.action === 'manual_review' || (freqAssess && freqAssess.action === 'manual_review')) {
      results.needsManualReview = true;
      results.warnings.push({ type: 'service', target: service.itemId, reason: '诊疗项目合理性存疑' });
    }
  }

  if (hospitalDays !== undefined) {
    const hospAssess = assessHospitalizationNecessity(diagnosisId, hospitalDays);
    results.hospitalization = hospAssess;
    
    if (hospAssess.action === 'manual_review' || hospAssess.necessary === false) {
      results.needsManualReview = true;
      results.warnings.push({ type: 'hospitalization', reason: '住院必要性存疑' });
    }
  }

  return results;
}

export default {
  assessDiagnosisDrugMatch,
  assessDiagnosisServiceMatch,
  assessDosageReasonability,
  assessFrequencyReasonability,
  assessHospitalizationNecessity,
  getRecommendedDrugs,
  getRecommendedServices,
  getSurgeryCombo,
  assessMedicalReasonability
};
