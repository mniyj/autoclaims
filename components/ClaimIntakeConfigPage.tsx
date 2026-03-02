import React, { useEffect, useMemo, useState } from "react";
import {
  type InsuranceProduct,
  type IntakeConfig,
  type ClaimItem,
  type ClaimsMaterial,
  type ProductClaimConfig,
  type CategoryMaterialConfig,
  type ResponsibilityItem,
  ProductStatus,
} from "../types";
import Modal from "./ui/Modal";
import Select from "./ui/Select";
import IntakeFieldConfigEditor from "./product-form/IntakeFieldConfigEditor";
import { INTAKE_COMMON_PRESET } from "../constants";
import { api } from "../services/api";

interface ClaimIntakeConfigPageProps {
  products: InsuranceProduct[];
  operator?: string;
  onUpdateProducts: (products: InsuranceProduct[]) => void;
}

const DEFAULT_CONFIG: IntakeConfig = {
  fields: [],
  voice_input: { enabled: false, mode: "realtime_or_record" },
  claimMaterials: { extraMaterialIds: [] },
  accidentCauses: [],
};

// Local state type for per-material overrides in step 2
type MaterialOverrides = Record<
  string,
  { selected: boolean; required: boolean }
>;

const ClaimIntakeConfigPage: React.FC<ClaimIntakeConfigPageProps> = ({
  products,
  operator,
  onUpdateProducts,
}) => {
  const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
  const [selectedProductCode, setSelectedProductCode] = useState("");
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<InsuranceProduct | null>(
    null,
  );
  const [editingConfig, setEditingConfig] =
    useState<IntakeConfig>(DEFAULT_CONFIG);
  const [viewMode, setViewMode] = useState(false);
  const [configStep, setConfigStep] = useState<1 | 2>(1);
  const [claimItems, setClaimItems] = useState<ClaimItem[]>([]);
  const [materials, setMaterials] = useState<ClaimsMaterial[]>([]);
  const [productClaimConfigs, setProductClaimConfigs] = useState<
    ProductClaimConfig[]
  >([]);
  const [categoryMaterialConfigs, setCategoryMaterialConfigs] = useState<
    CategoryMaterialConfig[]
  >([]);
  const [responsibilityItems, setResponsibilityItems] = useState<
    ResponsibilityItem[]
  >([]);
  const [accidentCauseConfigs, setAccidentCauseConfigs] = useState<
    any[]
  >([]);
  const [materialsLoading, setMaterialsLoading] = useState(true);
  // Local edit state for step 2 material overrides
  const [step2Overrides, setStep2Overrides] = useState<MaterialOverrides>({});


  const hasConfig = (config?: IntakeConfig) =>
    !!config &&
    (config.fields.length > 0 ||
      config.voice_input?.enabled ||
      (config.claimMaterials?.extraMaterialIds?.length || 0) > 0 ||
      Object.keys(config.claimMaterials?.materialOverrides || {}).length > 0);

  useEffect(() => {
    const fetchMaterialsConfig = async () => {
      try {
        const [
          itemsData,
          materialsData,
          configsData,
          catMatData,
          responsibilitiesData,
          accidentCauseData,
        ] = await Promise.all([
          api.claimItems.list(),
          api.claimsMaterials.list(),
          api.productClaimConfigs.list(),
          api.categoryMaterialConfigs.list(),
          api.responsibilities.list(),
          api.accidentCauseConfigs.list(),
        ]);
        setClaimItems(itemsData as ClaimItem[]);
        setMaterials(materialsData as ClaimsMaterial[]);
        setProductClaimConfigs(configsData as ProductClaimConfig[]);
        setCategoryMaterialConfigs(catMatData as CategoryMaterialConfig[]);
        setResponsibilityItems(responsibilitiesData as ResponsibilityItem[]);
        setAccidentCauseConfigs(accidentCauseData as any[]);
      } catch (error) {
        console.error("Failed to fetch claim materials config:", error);
      } finally {
        setMaterialsLoading(false);
      }
    };
    fetchMaterialsConfig();
  }, []);

  const normalizeConfig = (config?: IntakeConfig): IntakeConfig => {
    const nextConfig = config ? { ...config } : { ...DEFAULT_CONFIG };
    if (!nextConfig.claimMaterials) {
      nextConfig.claimMaterials = { extraMaterialIds: [] };
    }
    if (!nextConfig.claimMaterials.extraMaterialIds) {
      nextConfig.claimMaterials.extraMaterialIds = [];
    }
    if (!nextConfig.accidentCauses) {
      nextConfig.accidentCauses = [];
    }
    return nextConfig;
  };

  // --- Computed: claim item material groups from product responsibility config ---
  const claimItemMaterialGroups = useMemo(() => {
    if (!editingProduct) return [];
    const config = productClaimConfigs.find(
      (c) => c.productCode === editingProduct.productCode,
    );
    if (!config) return [];
    return config.responsibilityConfigs
      .map((rc) => {
        const resp = responsibilityItems.find(
          (r) => r.id === rc.responsibilityId,
        );
        const itemGroups = rc.claimItemIds
          .map((itemId) => {
            const item = claimItems.find((ci) => ci.id === itemId);
            if (!item) return null;
            return {
              itemId,
              itemName: item.name,
              materials: item.materialIds.map((matId) => ({
                materialId: matId,
                materialName:
                  materials.find((m) => m.id === matId)?.name || matId,
                defaultRequired: item.materialRequiredMap?.[matId] ?? false,
              })),
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)
          .filter((ig) => ig.materials.length > 0);
        return {
          responsibilityId: rc.responsibilityId,
          responsibilityName: resp?.name || rc.responsibilityId,
          itemGroups,
        };
      })
      .filter((g) => g.itemGroups.length > 0);
  }, [
    editingProduct,
    productClaimConfigs,
    claimItems,
    materials,
    responsibilityItems,
  ]);

  // --- Computed: category material items from product's level-3 insurance type code ---
  // Products may store the code in racewayId (legacy) or categoryLevel3Code (newer JSON products)
  const productLevel3Code =
    editingProduct?.racewayId || editingProduct?.categoryLevel3Code;
  const productLevel3Name =
    editingProduct?.racewayName || editingProduct?.categoryLevel3Name;

  const categoryMaterialItems = useMemo(() => {
    if (!productLevel3Code) return [];
    const catConfig = categoryMaterialConfigs.find(
      (c) => c.categoryCode === productLevel3Code,
    );
    if (!catConfig) return [];
    return catConfig.materialIds.map((matId) => ({
      materialId: matId,
      materialName: materials.find((m) => m.id === matId)?.name || matId,
      defaultRequired: catConfig.materialRequiredMap?.[matId] ?? false,
    }));
  }, [productLevel3Code, categoryMaterialConfigs, materials]);

  // --- Computed: accident cause material items from product's accident causes config ---
  const accidentCauseMaterialItems = useMemo(() => {
    if (!editingConfig.accidentCauses || editingConfig.accidentCauses.length === 0) return [];
    
    const allMaterials: Array<{
      materialId: string;
      materialName: string;
      defaultRequired: boolean;
      causeName: string;
    }> = [];
    
    editingConfig.accidentCauses.forEach((cause) => {
      // Skip custom causes as they don't have material configs
      if (cause.isCustom) return;
      
      const causeConfig = accidentCauseConfigs.find((c) => c.id === cause.id);
      if (!causeConfig) return;
      
      causeConfig.materialIds.forEach((matId: string) => {
        // Avoid duplicates
        if (!allMaterials.find((m) => m.materialId === matId)) {
          allMaterials.push({
            materialId: matId,
            materialName: materials.find((m) => m.id === matId)?.name || matId,
            defaultRequired: causeConfig.materialRequiredMap?.[matId] ?? false,
            causeName: causeConfig.name,
          });
        }
      });
    });
    
    return allMaterials;
  }, [editingConfig.accidentCauses, accidentCauseConfigs, materials]);

  // --- Initialize step2Overrides when editingProduct changes and data is loaded ---
  useEffect(() => {
    if (!editingProduct || materialsLoading) return;

    // Always compute the full set of materials from all sources
    // Then merge with existing user selections if available
    const existing = editingConfig.claimMaterials?.materialOverrides;
    const hasExisting = existing && Object.keys(existing).length > 0;

    // Compute defaults: all auto-populated materials selected=true.
    // For required: use OR logic — required if ANY source marks it as required.
    const defaults: MaterialOverrides = {};

    claimItemMaterialGroups.forEach((g) => {
      g.itemGroups.forEach((ig) => {
        ig.materials.forEach((m) => {
          if (!defaults[m.materialId]) {
            defaults[m.materialId] = {
              selected: true,
              required: m.defaultRequired,
            };
          } else if (m.defaultRequired) {
            defaults[m.materialId] = {
              ...defaults[m.materialId],
              required: true,
            };
          }
        });
      });
    });

    categoryMaterialItems.forEach((m) => {
      if (!defaults[m.materialId]) {
        defaults[m.materialId] = {
          selected: true,
          required: m.defaultRequired,
        };
      } else if (m.defaultRequired) {
        // Category config marks required — override even if claim item didn't
        defaults[m.materialId] = { ...defaults[m.materialId], required: true };
      }
    });

    accidentCauseMaterialItems.forEach((m) => {
      if (!defaults[m.materialId]) {
        defaults[m.materialId] = {
          selected: true,
          required: m.defaultRequired,
        };
      } else if (m.defaultRequired) {
        // Accident cause config marks required — override
        defaults[m.materialId] = { ...defaults[m.materialId], required: true };
      }
    });

    // Merge with existing user selections if available
    // This preserves user's selection state while adding new materials from updated causes
    if (hasExisting) {
      const merged: MaterialOverrides = { ...defaults };
      Object.entries(existing!).forEach(([matId, override]) => {
        if (merged[matId]) {
          // Material exists in defaults: preserve user's selected state, merge required
          merged[matId] = {
            selected: override.selected,
            required: merged[matId].required || override.required,
          };
        }
        // If material not in defaults (cause deselected), it will be removed
      });
      setStep2Overrides(merged);
    } else {
      setStep2Overrides(defaults);
    }
  }, [
    editingProduct?.productCode,
    materialsLoading,
    claimItemMaterialGroups,
    categoryMaterialItems,
    accidentCauseMaterialItems,
  ]);

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      const aConfigured = hasConfig(a.intakeConfig) ? 1 : 0;
      const bConfigured = hasConfig(b.intakeConfig) ? 1 : 0;
      if (aConfigured !== bConfigured) return bConfigured - aConfigured;
      return a.regulatoryName.localeCompare(b.regulatoryName);
    });
  }, [products]);

  const availableProducts = useMemo(() => {
    return products.filter((p) => !hasConfig(p.intakeConfig));
  }, [products]);

  const StatusBadge: React.FC<{ status: ProductStatus }> = ({ status }) => {
    const statusMap = {
      [ProductStatus.ACTIVE]: {
        text: "生效",
        bg: "bg-green-100",
        textColor: "text-green-800",
      },
      [ProductStatus.INACTIVE]: {
        text: "失效",
        bg: "bg-red-100",
        textColor: "text-red-800",
      },
      [ProductStatus.DRAFT]: {
        text: "草稿",
        bg: "bg-yellow-100",
        textColor: "text-yellow-800",
      },
    };
    const { text, bg, textColor } = statusMap[status] || {
      text: "未知",
      bg: "bg-gray-100",
      textColor: "text-gray-800",
    };
    return (
      <span
        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${bg} ${textColor}`}
      >
        {text}
      </span>
    );
  };

  const ConfigBadge: React.FC<{ configured: boolean }> = ({ configured }) => {
    return (
      <span
        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${configured ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-500"}`}
      >
        {configured ? "已配置" : "未配置"}
      </span>
    );
  };

  const formatTime = (value?: string) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  const getMaterialName = (materialId: string) =>
    materials.find((m) => m.id === materialId)?.name || materialId;

  const openSelectModal = () => {
    setSelectedProductCode("");
    setIsSelectModalOpen(true);
  };

  const openConfigModal = (
    product: InsuranceProduct,
    mode: "view" | "edit",
  ) => {
    setEditingProduct(product);
    setEditingConfig(normalizeConfig(product.intakeConfig));
    setViewMode(mode === "view");
    setConfigStep(1);
    setStep2Overrides({});
    setIsConfigModalOpen(true);
  };

  const handleConfirmSelect = () => {
    const target = products.find((p) => p.productCode === selectedProductCode);
    if (!target) return;
    setIsSelectModalOpen(false);
    openConfigModal(target, "edit");
  };

  const handleSaveConfig = async () => {
    if (!editingProduct) return;
    const target = products.find(
      (p) => p.productCode === editingProduct.productCode,
    );
    if (!target) return;
    const updatedAt = new Date().toISOString();
    const operatorName = operator || target.operator || "系统管理员";

    // Build final config with step2 overrides baked in
    const selectedMaterialIds = Object.entries(step2Overrides)
      .filter(([, v]) => v.selected)
      .map(([k]) => k);

    const configToSave: IntakeConfig = {
      ...editingConfig,
      claimMaterials: {
        extraMaterialIds: selectedMaterialIds, // backward compat
        materialOverrides: { ...step2Overrides },
      },
    };

    const updatedProducts = products.map((p) =>
      p.productCode === target.productCode
        ? {
            ...target,
            intakeConfig: configToSave,
            intakeConfigUpdatedAt: updatedAt,
            intakeConfigOperator: operatorName,
          }
        : p,
    );
    try {
      await api.products.saveAll(updatedProducts);
      onUpdateProducts(updatedProducts);
      setIsConfigModalOpen(false);
    } catch (error) {
      console.error("Failed to save intake config:", error);
      alert("保存失败");
    }
  };

  const handleDeleteConfig = async (product: InsuranceProduct) => {
    if (!confirm(`确认删除 ${product.regulatoryName} 的报案信息配置吗？`))
      return;
    const updatedProducts = products.map((p) =>
      p.productCode === product.productCode
        ? {
            ...p,
            intakeConfig: undefined,
            intakeConfigUpdatedAt: undefined,
            intakeConfigOperator: undefined,
          }
        : p,
    );
    try {
      await api.products.saveAll(updatedProducts);
      onUpdateProducts(updatedProducts);
    } catch (error) {
      console.error("Failed to delete intake config:", error);
      alert("删除失败");
    }
  };

  const handleLoadCommonPreset = () => {
    if (editingConfig.fields.length > 0) {
      if (!confirm("加载常用字段将覆盖当前配置的字段，是否继续？")) return;
    }
    setEditingConfig((prev) => ({
      ...prev,
      fields: INTAKE_COMMON_PRESET.map((field) => ({ ...field })),
    }));
  };

  // Toggle whether a material is selected in step 2
  const toggleStep2MaterialSelected = (materialId: string) => {
    setStep2Overrides((prev) => ({
      ...prev,
      [materialId]: {
        selected: !(prev[materialId]?.selected ?? true),
        required: prev[materialId]?.required ?? false,
      },
    }));
  };

  // Toggle whether a material is required in step 2
  const toggleStep2MaterialRequired = (materialId: string) => {
    setStep2Overrides((prev) => ({
      ...prev,
      [materialId]: {
        selected: prev[materialId]?.selected ?? true,
        required: !(prev[materialId]?.required ?? false),
      },
    }));
  };

  const renderConfigSummary = (
    product?: InsuranceProduct,
    config?: IntakeConfig,
  ) => {
    const materialOverrides = config?.claimMaterials?.materialOverrides;
    const selectedMaterials = materialOverrides
      ? Object.entries(materialOverrides).filter(([, v]) => v.selected)
      : (config?.claimMaterials?.extraMaterialIds || []).map(
          (id) =>
            [id, { selected: true, required: false }] as [
              string,
              { selected: boolean; required: boolean },
            ],
        );

    if (
      !config ||
      (config.fields.length === 0 &&
        !config.voice_input?.enabled &&
        selectedMaterials.length === 0)
    ) {
      return <div className="text-sm text-gray-500">暂无配置</div>;
    }
    return (
      <div className="space-y-4">
        {config.fields.length > 0 ? (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">
                    字段名称
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">
                    类型
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">
                    必填
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">
                    占位提示
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {config.fields.map((field) => (
                  <tr key={field.field_id}>
                    <td className="px-4 py-2 text-gray-700">{field.label}</td>
                    <td className="px-4 py-2 text-gray-600">{field.type}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {field.required ? "是" : "否"}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {field.placeholder || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-gray-500">未配置报案信息字段</div>
        )}
        <div className="text-sm text-gray-700">
          语音报案：{config.voice_input?.enabled ? "已启用" : "未启用"}
        </div>
        {config.voice_input?.enabled && (
          <div className="text-sm text-gray-600 whitespace-pre-wrap break-words bg-gray-50 border border-gray-200 rounded-md p-3">
            {config.voice_input.slot_filling_prompt || "未配置提示词"}
          </div>
        )}
        <div className="space-y-2">
          <div className="text-sm text-gray-500">理赔材料清单</div>
          {selectedMaterials.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectedMaterials.map(([materialId, v]) => (
                <span
                  key={materialId}
                  className={`px-2 py-1 text-xs rounded-full border ${v.required ? "bg-red-50 text-red-600 border-red-100" : "bg-blue-50 text-blue-700 border-blue-100"}`}
                >
                  {getMaterialName(materialId)}
                  {v.required && <span className="ml-1 opacity-70">必传</span>}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500">暂无材料配置</div>
          )}
        </div>
      </div>
    );
  };

  // Render step 2: material override UI
  const renderStep2 = () => {
    if (materialsLoading) {
      return <div className="text-sm text-gray-500">材料清单加载中...</div>;
    }

    const renderMaterialRow = (
      materialId: string,
      materialName: string,
      defaultRequired: boolean,
    ) => {
      const override = step2Overrides[materialId];
      const isSelected = override?.selected ?? true;
      const isRequired = override?.required ?? defaultRequired;
      return (
        <div key={materialId} className="flex items-center gap-3 py-1.5">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleStep2MaterialSelected(materialId)}
            className="rounded border-gray-300 text-brand-blue-600 focus:ring-brand-blue-500 flex-shrink-0"
          />
          <span
            className={`text-sm flex-1 ${isSelected ? "text-gray-700" : "text-gray-400 line-through"}`}
          >
            {materialName}
          </span>
          {isSelected && (
            <button
              type="button"
              onClick={() => toggleStep2MaterialRequired(materialId)}
              className={`px-2 py-0.5 text-xs rounded-full border transition-colors flex-shrink-0 ${
                isRequired
                  ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                  : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100"
              }`}
            >
              {isRequired ? "必传" : "非必传"}
            </button>
          )}
        </div>
      );
    };

    const selectedCount = Object.values(step2Overrides).filter(
      (v) => v.selected,
    ).length;

    return (
      <div className="space-y-5">
        {/* 动态材料计算配置 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="enable-dynamic-calculation"
              checked={editingConfig.claimMaterials?.enableDynamicCalculation || false}
              onChange={(e) => {
                setEditingConfig(prev => ({
                  ...prev,
                  claimMaterials: {
                    ...prev.claimMaterials,
                    extraMaterialIds: prev.claimMaterials?.extraMaterialIds || [],
                    materialOverrides: prev.claimMaterials?.materialOverrides || {},
                    enableDynamicCalculation: e.target.checked,
                    claimItemFieldId: prev.claimMaterials?.claimItemFieldId || 'claim_item',
                    accidentCauseFieldId: prev.claimMaterials?.accidentCauseFieldId || 'accident_reason'
                  }
                }));
              }}
              className="mt-0.5 rounded border-blue-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
            />
            <div className="flex-1">
              <label htmlFor="enable-dynamic-calculation" className="text-sm font-medium text-gray-700 cursor-pointer">
                启用动态材料清单计算
              </label>
              <div className="text-xs text-gray-600 mt-1">
                根据用户在报案表单中选择的<strong>索赔项目</strong>和<strong>事故原因</strong>，自动计算并展示所需的理赔材料清单。
                材料来源包括：险种通用材料、索赔项目关联材料、事故原因关联材料。
              </div>
            </div>
          </div>

          {editingConfig.claimMaterials?.enableDynamicCalculation && (
            <div className="pl-7 space-y-2 border-t border-blue-200 pt-3">
              <div className="text-xs text-gray-600">
                <strong>字段映射配置：</strong>指定报案表单中哪些字段用于材料计算
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600">索赔项目字段ID：</label>
                  <input
                    type="text"
                    value={editingConfig.claimMaterials?.claimItemFieldId || 'claim_item'}
                    onChange={(e) => {
                      setEditingConfig(prev => ({
                        ...prev,
                        claimMaterials: {
                          ...prev.claimMaterials,
                          extraMaterialIds: prev.claimMaterials?.extraMaterialIds || [],
                          materialOverrides: prev.claimMaterials?.materialOverrides || {},
                          enableDynamicCalculation: true,
                          claimItemFieldId: e.target.value,
                          accidentCauseFieldId: prev.claimMaterials?.accidentCauseFieldId || 'accident_reason'
                        }
                      }));
                    }}
                    placeholder="claim_item"
                    className="px-2 py-1 text-xs border border-blue-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600">事故原因字段ID：</label>
                  <input
                    type="text"
                    value={editingConfig.claimMaterials?.accidentCauseFieldId || 'accident_reason'}
                    onChange={(e) => {
                      setEditingConfig(prev => ({
                        ...prev,
                        claimMaterials: {
                          ...prev.claimMaterials,
                          extraMaterialIds: prev.claimMaterials?.extraMaterialIds || [],
                          materialOverrides: prev.claimMaterials?.materialOverrides || {},
                          enableDynamicCalculation: true,
                          claimItemFieldId: prev.claimMaterials?.claimItemFieldId || 'claim_item',
                          accidentCauseFieldId: e.target.value
                        }
                      }));
                    }}
                    placeholder="accident_reason"
                    className="px-2 py-1 text-xs border border-blue-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 1: Claim item materials */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-gray-700">
              理赔项目材料
            </div>
            <span className="text-xs text-gray-400">来自产品责任配置</span>
          </div>
          {claimItemMaterialGroups.length > 0 ? (
            <div className="space-y-2">
              {claimItemMaterialGroups.map((group) => (
                <div
                  key={group.responsibilityId}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-600 border-b border-gray-200">
                    责任：{group.responsibilityName}
                  </div>
                  {group.itemGroups.map((ig, idx) => (
                    <div
                      key={ig.itemId}
                      className={`px-4 py-3 ${idx > 0 ? "border-t border-gray-100" : ""}`}
                    >
                      <div className="text-xs text-gray-500 mb-2">
                        索赔项目：{ig.itemName}
                      </div>
                      <div className="space-y-0.5 pl-1">
                        {ig.materials.map((m) =>
                          renderMaterialRow(
                            m.materialId,
                            m.materialName,
                            m.defaultRequired,
                          ),
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-400 py-3 px-4 bg-gray-50 rounded-lg">
              该产品暂未配置责任对应的索赔项目，请先在「理赔项目及材料配置」中配置
            </div>
          )}
        </div>

        {/* Section 2: Category materials */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-gray-700">
              险种通用材料
            </div>
            <span className="text-xs text-gray-400">
              来自险种配置
              {productLevel3Code
                ? `：${productLevel3Name || productLevel3Code}`
                : ""}
            </span>
          </div>
          {categoryMaterialItems.length > 0 ? (
            <div className="border border-gray-200 rounded-lg px-4 py-2 space-y-0.5">
              {categoryMaterialItems.map((m) =>
                renderMaterialRow(
                  m.materialId,
                  m.materialName,
                  m.defaultRequired,
                ),
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-400 py-3 px-4 bg-gray-50 rounded-lg">
              {productLevel3Code
                ? "该险种暂未配置通用材料，请先在「理赔项目及材料配置」的「通用索赔材料配置」中配置"
                : "该产品未关联险种分类，无法获取通用材料"}
            </div>
          )}
        </div>

        {/* Section 3: Accident cause materials */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-gray-700">
              事故原因材料
            </div>
            <span className="text-xs text-gray-400">
              来自事故原因配置
            </span>
          </div>
          {accidentCauseMaterialItems.length > 0 ? (
            <div className="border border-gray-200 rounded-lg px-4 py-2 space-y-0.5">
              {accidentCauseMaterialItems.map((m) => (
                <div key={m.materialId} className="flex items-center justify-between">
                  {renderMaterialRow(
                    m.materialId,
                    m.materialName,
                    m.defaultRequired,
                  )}
                  <span className="text-[10px] text-gray-400 ml-2">
                    ({m.causeName})
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-400 py-3 px-4 bg-gray-50 rounded-lg">
              {editingConfig.accidentCauses && editingConfig.accidentCauses.length > 0 ? (
                <div>
                  <div className="mb-1">已配置 {editingConfig.accidentCauses.length} 个事故原因：</div>
                  <div className="text-xs space-y-1">
                    {editingConfig.accidentCauses.map((cause, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-gray-600">• {cause.name}</span>
                        {cause.isCustom && (
                          <span className="text-[10px] bg-gray-200 text-gray-600 px-1 py-0.5 rounded">自定义</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    这些事故原因暂无关联材料，请在「事故原因及索赔材料关联」页面配置
                  </div>
                </div>
              ) : (
                "该产品暂未配置事故原因，请在步骤1中配置"
              )}
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-gray-700">
              最终材料清单
            </div>
            <span className="text-xs text-gray-400">
              已选 {selectedCount} 项
            </span>
            <span className="text-xs text-gray-400 ml-2">
              (综合：索赔项目 + 险种通用 + 事故原因)
            </span>
          </div>
          {selectedCount > 0 ? (
            <div className="space-y-2">
              {/* Group materials by source */}
              {(() => {
                // Build source map
                const materialSources: Record<string, string[]> = {};
                const selectedMaterialIds = Object.entries(step2Overrides)
                  .filter(([, v]) => v.selected)
                  .map(([k]) => k);

                // From claim items
                claimItemMaterialGroups.forEach((g) => {
                  g.itemGroups.forEach((ig) => {
                    ig.materials.forEach((m) => {
                      if (selectedMaterialIds.includes(m.materialId)) {
                        if (!materialSources[m.materialId]) {
                          materialSources[m.materialId] = [];
                        }
                        if (!materialSources[m.materialId].includes("索赔项目")) {
                          materialSources[m.materialId].push("索赔项目");
                        }
                      }
                    });
                  });
                });

                // From category
                categoryMaterialItems.forEach((m) => {
                  if (selectedMaterialIds.includes(m.materialId)) {
                    if (!materialSources[m.materialId]) {
                      materialSources[m.materialId] = [];
                    }
                    if (!materialSources[m.materialId].includes("险种通用")) {
                      materialSources[m.materialId].push("险种通用");
                    }
                  }
                });

                // From accident causes
                accidentCauseMaterialItems.forEach((m) => {
                  if (selectedMaterialIds.includes(m.materialId)) {
                    if (!materialSources[m.materialId]) {
                      materialSources[m.materialId] = [];
                    }
                    if (!materialSources[m.materialId].includes("事故原因")) {
                      materialSources[m.materialId].push("事故原因");
                    }
                  }
                });

                return Object.entries(step2Overrides)
                  .filter(([, v]) => v.selected)
                  .map(([materialId, v]) => {
                    const sources = materialSources[materialId] || [];
                    const sourceColors: Record<string, string> = {
                      索赔项目: "bg-blue-100 text-blue-700",
                      险种通用: "bg-green-100 text-green-700",
                      事故原因: "bg-orange-100 text-orange-700",
                    };
                    return (
                      <div
                        key={materialId}
                        className="flex items-center gap-2 flex-wrap"
                      >
                        <span
                          className={`px-2 py-1 text-xs rounded-full border ${
                            v.required
                              ? "bg-red-50 text-red-600 border-red-100"
                              : "bg-gray-50 text-gray-700 border-gray-200"
                          }`}
                        >
                          {getMaterialName(materialId)}
                          {v.required && (
                            <span className="ml-1 opacity-70">必传</span>
                          )}
                        </span>
                        <div className="flex gap-1">
                          {sources.map((source) => (
                            <span
                              key={source}
                              className={`text-[10px] px-1.5 py-0.5 rounded ${
                                sourceColors[source] || "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {source}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  });
              })()}
            </div>
          ) : (
            <div className="text-sm text-gray-400">暂未选择任何材料</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            报案信息及理赔材料配置
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            管理不同产品的报案信息字段与理赔材料清单配置
          </p>
        </div>
        <button
          onClick={openSelectModal}
          className="px-4 py-2 bg-brand-blue-600 text-white text-sm font-medium rounded-lg hover:bg-brand-blue-700 transition-colors"
        >
          新增报案信息及理赔材料配置
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                产品名
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                是否配置
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                配置时间
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                配置人员
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                状态
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedProducts.length > 0 ? (
              sortedProducts.map((product) => {
                const configured = hasConfig(product.intakeConfig);
                return (
                  <tr key={product.productCode} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      {product.regulatoryName}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <ConfigBadge configured={configured} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatTime(product.intakeConfigUpdatedAt)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {product.intakeConfigOperator || product.operator || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <StatusBadge status={product.status} />
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-medium space-x-3">
                      <button
                        onClick={() => openConfigModal(product, "view")}
                        className={`hover:underline ${configured ? "text-brand-blue-600" : "text-gray-300 cursor-not-allowed"}`}
                        disabled={!configured}
                      >
                        查看
                      </button>
                      <button
                        onClick={() => openConfigModal(product, "edit")}
                        className="text-brand-blue-600 hover:underline"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDeleteConfig(product)}
                        className={`hover:underline ${configured ? "text-red-600" : "text-gray-300 cursor-not-allowed"}`}
                        disabled={!configured}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-10 text-center text-sm text-gray-500"
                >
                  暂无产品数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={isSelectModalOpen}
        onClose={() => setIsSelectModalOpen(false)}
        title="选择产品"
        footer={
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setIsSelectModalOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={handleConfirmSelect}
              disabled={!selectedProductCode}
              className="px-4 py-2 bg-brand-blue-600 text-white text-sm font-medium rounded-md hover:bg-brand-blue-700 disabled:bg-gray-300"
            >
              进入配置
            </button>
          </div>
        }
      >
        {availableProducts.length > 0 ? (
          <Select
            label="产品"
            id="intake-config-product"
            value={selectedProductCode}
            onChange={(e) => setSelectedProductCode(e.target.value)}
          >
            <option value="">请选择产品</option>
            {availableProducts.map((product) => (
              <option key={product.productCode} value={product.productCode}>
                {product.regulatoryName}
              </option>
            ))}
          </Select>
        ) : (
          <div className="text-sm text-gray-500">所有产品都已配置报案信息</div>
        )}
      </Modal>

      <Modal
        isOpen={isConfigModalOpen}
        onClose={() => {
          setIsConfigModalOpen(false);
          setConfigStep(1);
        }}
        title={
          viewMode ? "报案信息及理赔材料配置详情" : "报案信息及理赔材料配置"
        }
        width="max-w-5xl"
        footer={
          viewMode ? (
            <button
              onClick={() => setIsConfigModalOpen(false)}
              className="px-4 py-2 bg-brand-blue-600 text-white text-sm font-medium rounded-md hover:bg-brand-blue-700"
            >
              关闭
            </button>
          ) : (
            <div className="flex items-center justify-between">
              {configStep === 1 ? (
                <button
                  onClick={() => setIsConfigModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  取消
                </button>
              ) : (
                <button
                  onClick={() => setConfigStep(1)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  上一步
                </button>
              )}
              {configStep === 1 ? (
                <button
                  onClick={() => setConfigStep(2)}
                  className="px-4 py-2 bg-brand-blue-600 text-white text-sm font-medium rounded-md hover:bg-brand-blue-700"
                >
                  下一步
                </button>
              ) : (
                <button
                  onClick={handleSaveConfig}
                  className="px-4 py-2 bg-brand-blue-600 text-white text-sm font-medium rounded-md hover:bg-brand-blue-700"
                >
                  保存
                </button>
              )}
            </div>
          )
        }
      >
        {editingProduct ? (
          <div className="space-y-6">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="text-sm text-gray-500">产品</div>
              <div className="text-base font-semibold text-gray-900">
                {editingProduct.regulatoryName}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {editingProduct.productCode}
              </div>
            </div>
            {viewMode ? (
              renderConfigSummary(editingProduct, editingProduct.intakeConfig)
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-3 text-sm">
                  <div
                    className={`px-3 py-1 rounded-full ${configStep === 1 ? "bg-brand-blue-600 text-white" : "bg-gray-100 text-gray-500"}`}
                  >
                    1 报案信息配置
                  </div>
                  <div className="flex-1 h-px bg-gray-200"></div>
                  <div
                    className={`px-3 py-1 rounded-full ${configStep === 2 ? "bg-brand-blue-600 text-white" : "bg-gray-100 text-gray-500"}`}
                  >
                    2 理赔材料配置管理
                  </div>
                </div>
                {configStep === 1 ? (
                  <div className="space-y-5">
                    {/* 报案信息字段配置 */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-gray-700">
                          报案信息字段
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleLoadCommonPreset}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            一键加载常用字段
                          </button>
                          <div className="group relative">
                            <svg
                              className="w-4 h-4 text-gray-400 cursor-help hover:text-gray-600"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            <div className="absolute right-0 top-6 w-64 p-3 bg-white border border-gray-200 rounded-lg shadow-lg text-xs text-gray-600 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                              <p className="font-medium text-gray-800 mb-1">一键加载常用字段</p>
                              <p>加载通用报案字段预设（事故日期、地点、描述、原因等），适用于所有产品。</p>
                              <p className="mt-1 text-gray-400">提示：如需按险种加载专业模板，请使用下方编辑器内的「加载预设模板」按钮。</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <IntakeFieldConfigEditor
                        config={editingConfig}
                        onChange={setEditingConfig}
                        productCategory={editingProduct.primaryCategory}
                        productCode={editingProduct.productCode}
                      />
                    </div>
                  </div>
                ) : (
                  renderStep2()
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-500">未选择产品</div>
        )}
      </Modal>
    </div>
  );
};

export default ClaimIntakeConfigPage;
