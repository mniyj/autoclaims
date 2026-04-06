import React, { useState, useMemo, useEffect } from "react";
import {
  type ClaimItem,
  type ClaimsMaterial,
  type FactCatalogField,
  type ProductClaimConfig,
  type ResponsibilityClaimConfig,
  type ResponsibilityItem,
  type InsuranceProduct,
  type CategoryMaterialConfig,
  type AccidentCauseMaterialConfig,
  type Clause,
  type MaterialTypeCatalogItem,
} from "../types";
import Modal from "./ui/Modal";
import Input from "./ui/Input";
import Textarea from "./ui/Textarea";
import Select from "./ui/Select";
import Pagination from "./ui/Pagination";
import FileUpload from "./ui/FileUpload";
import { api } from "../services/api";
import { getSignedUrl } from "../services/ossService";
import {
  MOCK_CLAIMS_MATERIALS,
  LEVEL_1_DATA,
  LEVEL_2_DATA,
  LEVEL_3_DATA,
} from "../constants";

function normalizeFieldKey(value?: string) {
  return (value || "").trim();
}

function canBindFactToMaterial(
  fact: FactCatalogField,
  material?: Partial<ClaimsMaterial> | null,
) {
  if (!material) return true;
  if (fact.source_type !== "material") return true;

  if (fact.allowed_material_ids && fact.allowed_material_ids.length > 0) {
    return Boolean(
      material.id && fact.allowed_material_ids.includes(material.id),
    );
  }

  if (
    fact.allowed_material_categories &&
    fact.allowed_material_categories.length > 0
  ) {
    return Boolean(
      material.category &&
      fact.allowed_material_categories.includes(material.category),
    );
  }

  return true;
}

const MATERIAL_FIELD_TYPE_OPTIONS = [
  { value: "STRING", label: "文本" },
  { value: "NUMBER", label: "数字" },
  { value: "BOOLEAN", label: "布尔" },
  { value: "DATE", label: "日期" },
  { value: "ARRAY", label: "数组" },
  { value: "OBJECT", label: "对象" },
] as const;

type MaterialSchemaField = NonNullable<ClaimsMaterial["schemaFields"]>[number];

function createEmptyMaterialSchemaField(index: number): MaterialSchemaField {
  return {
    field_key: `field_${index}`,
    field_label: "",
    data_type: "STRING",
    required: false,
    description: "",
  };
}

function updateMaterialFieldTree(
  fields: MaterialSchemaField[],
  path: number[],
  updater: (field: MaterialSchemaField) => MaterialSchemaField,
): MaterialSchemaField[] {
  if (path.length === 0) return fields;
  const [index, ...rest] = path;
  return fields.map((field, fieldIndex) => {
    if (fieldIndex !== index) return field;
    if (rest.length === 0) return updater(field);
    if (field.data_type === "OBJECT") {
      return {
        ...field,
        children: updateMaterialFieldTree(field.children || [], rest, updater),
      };
    }
    if (field.data_type === "ARRAY") {
      return {
        ...field,
        item_fields: updateMaterialFieldTree(
          field.item_fields || [],
          rest,
          updater,
        ),
      };
    }
    return field;
  });
}

function removeMaterialFieldTree(
  fields: MaterialSchemaField[],
  path: number[],
): MaterialSchemaField[] {
  if (path.length === 0) return fields;
  const [index, ...rest] = path;
  if (rest.length === 0) {
    return fields.filter((_, fieldIndex) => fieldIndex !== index);
  }
  return fields.map((field, fieldIndex) => {
    if (fieldIndex !== index) return field;
    if (field.data_type === "OBJECT") {
      return {
        ...field,
        children: removeMaterialFieldTree(field.children || [], rest),
      };
    }
    if (field.data_type === "ARRAY") {
      return {
        ...field,
        item_fields: removeMaterialFieldTree(field.item_fields || [], rest),
      };
    }
    return field;
  });
}

function addChildMaterialField(
  fields: MaterialSchemaField[],
  path: number[],
): MaterialSchemaField[] {
  return updateMaterialFieldTree(fields, path, (field) => {
    const nextField = createEmptyMaterialSchemaField(
      (field.data_type === "OBJECT"
        ? field.children?.length
        : field.item_fields?.length || 0) + 1,
    );
    if (field.data_type === "OBJECT") {
      return { ...field, children: [...(field.children || []), nextField] };
    }
    if (field.data_type === "ARRAY") {
      return {
        ...field,
        item_fields: [...(field.item_fields || []), nextField],
      };
    }
    return field;
  });
}

function validateMaterialFieldTree(
  fields: MaterialSchemaField[],
  scope = "root",
): string[] {
  const errors: string[] = [];
  const keys = fields
    .map((field) => normalizeFieldKey(field.field_key))
    .filter(Boolean);
  const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
  if (duplicates.length > 0) {
    errors.push(
      `${scope} 下存在重复 schema 字段：${[...new Set(duplicates)].join("、")}`,
    );
  }
  fields.forEach((field) => {
    if (!normalizeFieldKey(field.field_key)) {
      errors.push(`${scope} 下存在空的 schema 字段名。`);
    }
    if (field.data_type === "OBJECT") {
      errors.push(
        ...validateMaterialFieldTree(
          field.children || [],
          `${field.field_key || scope} 对象`,
        ),
      );
    }
    if (field.data_type === "ARRAY") {
      errors.push(
        ...validateMaterialFieldTree(
          field.item_fields || [],
          `${field.field_key || scope} 数组项`,
        ),
      );
    }
  });
  return errors;
}

function collectMaterialSchemaPaths(
  fields: MaterialSchemaField[],
  prefix = "",
): Array<{ path: string; label: string; type: string }> {
  const paths: Array<{ path: string; label: string; type: string }> = [];
  fields.forEach((field) => {
    const key = normalizeFieldKey(field.field_key);
    if (!key) return;
    const path = prefix ? `${prefix}.${key}` : key;
    paths.push({
      path,
      label: field.field_label || key,
      type: field.data_type,
    });
    if (field.data_type === "OBJECT") {
      paths.push(...collectMaterialSchemaPaths(field.children || [], path));
    }
    if (field.data_type === "ARRAY") {
      paths.push(
        ...collectMaterialSchemaPaths(field.item_fields || [], `${path}[]`),
      );
    }
  });
  return paths;
}

function toJsonSchemaType(dataType?: MaterialSchemaField["data_type"]) {
  switch (dataType) {
    case "NUMBER":
      return "number";
    case "BOOLEAN":
      return "boolean";
    case "DATE":
      return "string";
    case "ARRAY":
      return "array";
    case "OBJECT":
      return "object";
    default:
      return "string";
  }
}

function fromJsonSchemaType(
  type?: string,
  format?: string,
): MaterialSchemaField["data_type"] {
  if (type === "number" || type === "integer") return "NUMBER";
  if (type === "boolean") return "BOOLEAN";
  if (type === "array") return "ARRAY";
  if (type === "object") return "OBJECT";
  if (format === "date" || format === "date-time") return "DATE";
  return "STRING";
}

function parseSchemaFieldsFromNode(node: {
  properties?: Record<
    string,
    {
      type?: string;
      description?: string;
      format?: string;
      properties?: Record<string, any>;
      items?: any;
      required?: string[];
    }
  >;
  required?: string[];
}): MaterialSchemaField[] {
  const requiredFields = new Set(node.required || []);
  return Object.entries(node.properties || {}).map(([fieldKey, config]) => {
    const dataType = fromJsonSchemaType(config?.type, config?.format);
    return {
      field_key: fieldKey,
      field_label: config?.description || fieldKey,
      data_type: dataType,
      required: requiredFields.has(fieldKey),
      description: config?.description || "",
      children:
        dataType === "OBJECT"
          ? parseSchemaFieldsFromNode({
              properties: config?.properties || {},
              required: Array.isArray(config?.required) ? config.required : [],
            })
          : undefined,
      item_fields:
        dataType === "ARRAY" &&
        config?.items &&
        typeof config.items === "object"
          ? parseSchemaFieldsFromNode({
              properties: config.items.properties || {},
              required: Array.isArray(config.items.required)
                ? config.items.required
                : [],
            })
          : undefined,
    };
  });
}

function buildMaterialSchemaField(
  field: MaterialSchemaField,
): Record<string, any> {
  if (field.data_type === "OBJECT") {
    const children = field.children || [];
    return {
      type: "object",
      description: field.description || field.field_label || field.field_key,
      properties: Object.fromEntries(
        children.map((child) => [
          child.field_key,
          buildMaterialSchemaField(child),
        ]),
      ),
      required: children
        .filter((child) => child.required)
        .map((child) => child.field_key),
    };
  }
  if (field.data_type === "ARRAY") {
    const itemFields = field.item_fields || [];
    return {
      type: "array",
      description: field.description || field.field_label || field.field_key,
      items: {
        type: "object",
        properties: Object.fromEntries(
          itemFields.map((child) => [
            child.field_key,
            buildMaterialSchemaField(child),
          ]),
        ),
        required: itemFields
          .filter((child) => child.required)
          .map((child) => child.field_key),
      },
    };
  }
  return {
    type: toJsonSchemaType(field.data_type),
    ...(field.data_type === "DATE" ? { format: "date" } : {}),
    description: field.description || field.field_label || field.field_key,
  };
}

function buildSchemaFromFields(fields: MaterialSchemaField[] = []) {
  const properties: Record<string, any> = {};
  const required = new Set<string>();

  fields.forEach((field) => {
    if (!field.field_key) return;
    properties[field.field_key] = buildMaterialSchemaField(field);
    if (field.required) required.add(field.field_key);
  });

  return JSON.stringify(
    {
      type: "object",
      properties,
      required: Array.from(required),
    },
    null,
    2,
  );
}

type MaterialFactBinding = {
  fact_id: string;
  field_key?: string;
  required?: boolean;
  description?: string;
};

function collectFactBindingsFromFields(
  fields: MaterialSchemaField[] = [],
  prefix = "",
): MaterialFactBinding[] {
  const bindings: MaterialFactBinding[] = [];

  fields.forEach((field) => {
    const key = normalizeFieldKey(field.field_key);
    if (!key) return;
    const path = prefix ? `${prefix}.${key}` : key;
    if (field.fact_id) {
      bindings.push({
        fact_id: field.fact_id,
        field_key: path,
        required: field.required,
        description: field.description || field.field_label,
      });
    }
    if (field.data_type === "OBJECT") {
      bindings.push(
        ...collectFactBindingsFromFields(
          (field.children as MaterialSchemaField[]) || [],
          path,
        ),
      );
    }
    if (field.data_type === "ARRAY") {
      bindings.push(
        ...collectFactBindingsFromFields(
          (field.item_fields as MaterialSchemaField[]) || [],
          `${path}[]`,
        ),
      );
    }
  });

  return bindings;
}

function hydrateSchemaFields(
  material: Partial<ClaimsMaterial>,
): MaterialSchemaField[] {
  const schemaFields = (material.schemaFields as MaterialSchemaField[]) || [];
  return schemaFields.map((field) => ({ ...field }));
}

const MaterialSchemaFieldListEditor: React.FC<{
  fields: MaterialSchemaField[];
  onChange: (fields: MaterialSchemaField[]) => void;
  factCatalog: FactCatalogField[];
  material?: Partial<ClaimsMaterial> | null;
  path?: number[];
  title?: string;
}> = ({ fields, onChange, factCatalog, material, path = [], title }) => {
  return (
    <div className="space-y-3">
      {title && (
        <div className="text-xs font-medium text-slate-500">{title}</div>
      )}
      {fields.map((field, index) => {
        const fieldPath = [...path, index];
        const bindableFacts = factCatalog.filter((fact) =>
          canBindFactToMaterial(fact, material),
        );
        return (
          <div
            key={`${fieldPath.join("-")}-${field.field_key}`}
            className="rounded-lg border border-slate-200 bg-slate-50 p-3"
          >
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_180px_auto]">
              <div>
                <div className="text-xs font-medium text-slate-500">
                  schema 字段名
                </div>
                <input
                  type="text"
                  value={field.field_key}
                  onChange={(event) =>
                    onChange(
                      updateMaterialFieldTree(fields, [index], (current) => ({
                        ...current,
                        field_key: event.target.value
                          .trim()
                          .replace(/\s+/g, "_"),
                      })),
                    )
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500">
                  字段名称
                </div>
                <input
                  type="text"
                  value={field.field_label}
                  onChange={(event) =>
                    onChange(
                      updateMaterialFieldTree(fields, [index], (current) => ({
                        ...current,
                        field_label: event.target.value,
                      })),
                    )
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500">
                  数据类型
                </div>
                <select
                  value={field.data_type}
                  onChange={(event) =>
                    onChange(
                      updateMaterialFieldTree(fields, [index], (current) => {
                        const nextType = event.target
                          .value as MaterialSchemaField["data_type"];
                        return {
                          ...current,
                          data_type: nextType,
                          children:
                            nextType === "OBJECT"
                              ? current.children || []
                              : undefined,
                          item_fields:
                            nextType === "ARRAY"
                              ? current.item_fields || []
                              : undefined,
                        };
                      }),
                    )
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  {MATERIAL_FIELD_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end justify-between gap-3 lg:justify-end">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(field.required)}
                    onChange={(event) =>
                      onChange(
                        updateMaterialFieldTree(fields, [index], (current) => ({
                          ...current,
                          required: event.target.checked,
                        })),
                      )
                    }
                    className="rounded border-gray-300 text-brand-blue-600"
                  />
                  <span className="whitespace-nowrap">必填</span>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    onChange(removeMaterialFieldTree(fields, [index]))
                  }
                  className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100"
                >
                  删除
                </button>
              </div>
            </div>
            <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
              <div>
                <div className="text-xs font-medium text-slate-500">
                  字段说明
                </div>
                <input
                  type="text"
                  value={field.description || ""}
                  onChange={(event) =>
                    onChange(
                      updateMaterialFieldTree(fields, [index], (current) => ({
                        ...current,
                        description: event.target.value,
                      })),
                    )
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="描述这个材料字段在原文中的含义"
                />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500">
                  绑定标准事实（可选）
                </div>
                <select
                  value={field.fact_id || ""}
                  onChange={(event) =>
                    onChange(
                      updateMaterialFieldTree(fields, [index], (current) => ({
                        ...current,
                        fact_id: event.target.value || undefined,
                      })),
                    )
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">不绑定，直接作为材料字段使用</option>
                  {bindableFacts.map((fact) => (
                    <option key={fact.fact_id} value={fact.fact_id}>
                      {fact.label} ({fact.fact_id})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {(field.data_type === "OBJECT" || field.data_type === "ARRAY") && (
              <div className="mt-4 rounded-md border border-dashed border-slate-300 bg-white p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-slate-600">
                    {field.data_type === "OBJECT" ? "对象子字段" : "数组项字段"}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onChange(addChildMaterialField(fields, [index]))
                    }
                    className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    新增子字段
                  </button>
                </div>
                <div className="mt-3">
                  <MaterialSchemaFieldListEditor
                    fields={
                      field.data_type === "OBJECT"
                        ? field.children || []
                        : field.item_fields || []
                    }
                    onChange={(nextFields) =>
                      onChange(
                        updateMaterialFieldTree(fields, [index], (current) => ({
                          ...current,
                          ...(field.data_type === "OBJECT"
                            ? { children: nextFields }
                            : { item_fields: nextFields }),
                        })),
                      )
                    }
                    factCatalog={factCatalog}
                    material={material}
                    path={fieldPath}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const ClaimItemConfigPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    | "materials"
    | "items"
    | "category_materials"
    | "accident_causes"
    | "metadata"
  >("materials");
  const [claimItems, setClaimItems] = useState<ClaimItem[]>([]);
  const [materials, setMaterials] = useState<ClaimsMaterial[]>([]);
  const [factCatalog, setFactCatalog] = useState<FactCatalogField[]>([]);
  const [productConfigs, setProductConfigs] = useState<ProductClaimConfig[]>(
    [],
  );
  const [products, setProducts] = useState<InsuranceProduct[]>([]);
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [responsibilities, setResponsibilities] = useState<
    ResponsibilityItem[]
  >([]);
  const [categoryMaterialConfigs, setCategoryMaterialConfigs] = useState<
    CategoryMaterialConfig[]
  >([]);
  const [accidentCauseConfigs, setAccidentCauseConfigs] = useState<
    AccidentCauseMaterialConfig[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [materialTypeCatalog, setMaterialTypeCatalog] = useState<
    MaterialTypeCatalogItem[]
  >([]);

  // Metadata tab state
  const [metaSearchQuery, setMetaSearchQuery] = useState("");
  const [metaCurrentPage, setMetaCurrentPage] = useState(1);
  const META_ITEMS_PER_PAGE = 10;
  const [isMetaModalOpen, setIsMetaModalOpen] = useState(false);
  const [editingMeta, setEditingMeta] =
    useState<Partial<MaterialTypeCatalogItem> | null>(null);

  // Sample preview state
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          itemsData,
          materialsData,
          factCatalogData,
          configsData,
          productsData,
          clausesData,
          respData,
          catMatData,
          accidentCauseData,
          typeCatalogData,
        ] = await Promise.all([
          api.claimItems.list(),
          api.claimsMaterials.list(),
          api.factCatalog.list(),
          api.productClaimConfigs.list(),
          api.products.list(),
          api.clauses.list(),
          api.responsibilities.list(),
          api.categoryMaterialConfigs.list(),
          api.accidentCauseConfigs.list(),
          api.materialTypeCatalog.list(),
        ]);
        setClaimItems(itemsData as ClaimItem[]);
        if (!materialsData || materialsData.length === 0) {
          await api.claimsMaterials.saveAll(MOCK_CLAIMS_MATERIALS);
          setMaterials(MOCK_CLAIMS_MATERIALS);
        } else {
          setMaterials(materialsData as ClaimsMaterial[]);
        }
        setFactCatalog(factCatalogData as FactCatalogField[]);
        setProductConfigs(configsData as ProductClaimConfig[]);
        setProducts(productsData as InsuranceProduct[]);
        setClauses(clausesData as Clause[]);
        setResponsibilities(respData as ResponsibilityItem[]);
        setCategoryMaterialConfigs(catMatData as CategoryMaterialConfig[]);
        setAccidentCauseConfigs(
          (accidentCauseData as AccidentCauseMaterialConfig[]) || [],
        );
        setMaterialTypeCatalog(
          (typeCatalogData as MaterialTypeCatalogItem[]) || [],
        );
      } catch (error) {
        console.error("Failed to fetch claim item config data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Modal states for Claim Item
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<ClaimItem> | null>(
    null,
  );
  const [itemMaterialSearchQuery, setItemMaterialSearchQuery] = useState("");

  // Modal states for Product Config
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] =
    useState<Partial<ProductClaimConfig> | null>(null);
  const [selectedRespIds, setSelectedRespIds] = useState<string[]>([]);

  // Product material config view state
  const [selectedProductCode, setSelectedProductCode] = useState<string | null>(
    null,
  );
  const [productSearchQuery, setProductSearchQuery] = useState("");

  // Category material config state
  const [selectedL1Code, setSelectedL1Code] = useState<string | null>(null);
  const [selectedL2Code, setSelectedL2Code] = useState<string | null>(null);
  const [selectedL3Code, setSelectedL3Code] = useState<string | null>(null);
  const [editingCatMatConfig, setEditingCatMatConfig] =
    useState<CategoryMaterialConfig | null>(null);
  const [isCatMatDirty, setIsCatMatDirty] = useState(false);
  const [isSavingCatMat, setIsSavingCatMat] = useState(false);

  // Material management states
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] =
    useState<Partial<ClaimsMaterial> | null>(null);
  const [materialSearchQuery, setMaterialSearchQuery] = useState("");
  const [materialPage, setMaterialPage] = useState(1);
  const MATERIALS_PER_PAGE = 10;

  // ── Claim Item handlers ──
  const handleAddItem = () => {
    setEditingItem({
      id: `item-${Date.now()}`,
      name: "",
      description: "",
      materialIds: [],
      responsibilityIds: [],
    });
    setItemMaterialSearchQuery("");
    setIsItemModalOpen(true);
  };

  const handleEditItem = (item: ClaimItem) => {
    setEditingItem({
      ...item,
      responsibilityIds: item.responsibilityIds || [],
    });
    setItemMaterialSearchQuery("");
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async () => {
    if (!editingItem?.name) return alert("请输入理赔项目名称");
    let newItems: ClaimItem[];
    if (claimItems.find((i) => i.id === editingItem.id)) {
      newItems = claimItems.map((i) =>
        i.id === editingItem.id ? (editingItem as ClaimItem) : i,
      );
    } else {
      newItems = [...claimItems, editingItem as ClaimItem];
    }
    try {
      await api.claimItems.saveAll(newItems);
      setClaimItems(newItems);
      setIsItemModalOpen(false);
    } catch (error) {
      console.error("Failed to save claim item:", error);
      alert("保存失败");
    }
  };

  const toggleMaterial = (matId: string) => {
    const currentIds = editingItem?.materialIds || [];
    if (currentIds.includes(matId)) {
      setEditingItem((prev) => {
        const newMap = { ...(prev?.materialRequiredMap || {}) };
        delete newMap[matId];
        return {
          ...prev!,
          materialIds: currentIds.filter((id) => id !== matId),
          materialRequiredMap: newMap,
        };
      });
    } else {
      setEditingItem((prev) => ({
        ...prev!,
        materialIds: [...currentIds, matId],
      }));
    }
  };

  const toggleMaterialRequired = (matId: string) => {
    setEditingItem((prev) => {
      const currentMap = prev?.materialRequiredMap || {};
      return {
        ...prev!,
        materialRequiredMap: { ...currentMap, [matId]: !currentMap[matId] },
      };
    });
  };

  const toggleResponsibilityForItem = (respId: string) => {
    setEditingItem((prev) => {
      const currentIds = prev?.responsibilityIds || [];
      const nextIds = currentIds.includes(respId)
        ? currentIds.filter((id) => id !== respId)
        : [...currentIds, respId];
      return { ...prev!, responsibilityIds: nextIds };
    });
  };

  const filteredMaterialsForItemModal = useMemo(() => {
    const query = itemMaterialSearchQuery.trim().toLowerCase();
    if (!query) return materials;
    return materials.filter((material) =>
      [material.name, material.description]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }, [materials, itemMaterialSearchQuery]);

  // ── Product Config handlers ──
  const handleAddConfig = () => {
    setEditingConfig({ productCode: "", responsibilityConfigs: [] });
    setSelectedRespIds([]);
    setIsConfigModalOpen(true);
  };

  const handleOpenConfigModal = (config?: ProductClaimConfig) => {
    setEditingConfig(
      config
        ? { ...config }
        : { productCode: selectedProductCode || "", responsibilityConfigs: [] },
    );
    setSelectedRespIds([]);
    setIsConfigModalOpen(true);
  };

  const handleAddRespToConfig = () => {
    if (!editingConfig?.productCode) return alert("请先选择产品");
    if (selectedRespIds.length === 0) return;
    const existingIds = new Set(
      (editingConfig?.responsibilityConfigs || []).map(
        (rc) => rc.responsibilityId,
      ),
    );
    const newRespConfigs: ResponsibilityClaimConfig[] = selectedRespIds
      .filter((id) => !existingIds.has(id))
      .map((id) => ({ responsibilityId: id, claimItemIds: [] }));
    if (newRespConfigs.length === 0) return alert("所选责任已在配置中");
    setEditingConfig((prev) => ({
      ...prev!,
      responsibilityConfigs: [
        ...(prev?.responsibilityConfigs || []),
        ...newRespConfigs,
      ],
    }));
    setSelectedRespIds([]);
  };

  const toggleClaimItemForResp = (respId: string, itemId: string) => {
    setEditingConfig((prev) => ({
      ...prev!,
      responsibilityConfigs:
        prev?.responsibilityConfigs?.map((rc) => {
          if (rc.responsibilityId === respId) {
            const newItemIds = rc.claimItemIds.includes(itemId)
              ? rc.claimItemIds.filter((id) => id !== itemId)
              : [...rc.claimItemIds, itemId];
            return { ...rc, claimItemIds: newItemIds };
          }
          return rc;
        }) || [],
    }));
  };

  const handleSaveConfig = async () => {
    if (!editingConfig?.productCode) return alert("请选择产品");
    let newConfigs: ProductClaimConfig[];
    const existingIndex = productConfigs.findIndex(
      (c) => c.productCode === editingConfig.productCode,
    );
    if (existingIndex > -1) {
      newConfigs = [...productConfigs];
      newConfigs[existingIndex] = editingConfig as ProductClaimConfig;
    } else {
      newConfigs = [...productConfigs, editingConfig as ProductClaimConfig];
    }
    try {
      await api.productClaimConfigs.saveAll(newConfigs);
      setProductConfigs(newConfigs);
      setIsConfigModalOpen(false);
    } catch (error) {
      console.error("Failed to save product config:", error);
      alert("保存失败");
    }
  };

  // ── Product Config modal derived data ──
  const selectedProductForModal = useMemo(() => {
    if (!editingConfig?.productCode) return null;
    return (
      products.find((p) => p.productCode === editingConfig.productCode) || null
    );
  }, [editingConfig?.productCode, products]);

  const filteredResponsibilitiesForModal = useMemo(() => {
    if (!selectedProductForModal) return [];
    return responsibilities.filter(
      (r) => r.category === selectedProductForModal.primaryCategory,
    );
  }, [responsibilities, selectedProductForModal]);

  // ── Products tab derived data ──
  const filteredProducts = useMemo(() => {
    const q = productSearchQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.regulatoryName.toLowerCase().includes(q) ||
        p.productCode.toLowerCase().includes(q) ||
        (p.marketingName || "").toLowerCase().includes(q),
    );
  }, [products, productSearchQuery]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.productCode === selectedProductCode) || null,
    [products, selectedProductCode],
  );

  const selectedProductClauses = useMemo(() => {
    if (!selectedProduct?.clausesCode?.length) return [];
    return (selectedProduct.clausesCode as string[])
      .map((code) => clauses.find((c: any) => c.productCode === code))
      .filter(Boolean) as Clause[];
  }, [selectedProduct, clauses]);

  const selectedProductConfig = useMemo(
    () =>
      productConfigs.find((c) => c.productCode === selectedProductCode) || null,
    [productConfigs, selectedProductCode],
  );

  const specificMaterialIds = useMemo(() => {
    if (!selectedProductConfig) return new Set<string>();
    const ids = new Set<string>();
    for (const rc of selectedProductConfig.responsibilityConfigs) {
      for (const itemId of rc.claimItemIds) {
        const item = claimItems.find((i) => i.id === itemId);
        if (item) item.materialIds.forEach((mid) => ids.add(mid));
      }
    }
    return ids;
  }, [selectedProductConfig, claimItems]);

  const genericMaterialIds = useMemo(() => {
    if (!selectedProduct) return new Set<string>();
    const racewayId = (selectedProduct as any).racewayId as string | undefined;
    if (!racewayId) return new Set<string>();
    const catConfig = categoryMaterialConfigs.find(
      (c) => c.categoryCode === racewayId,
    );
    if (!catConfig) return new Set<string>();
    return new Set<string>(catConfig.materialIds);
  }, [selectedProduct, categoryMaterialConfigs]);

  const allMaterialIds = useMemo(
    () => new Set<string>([...specificMaterialIds, ...genericMaterialIds]),
    [specificMaterialIds, genericMaterialIds],
  );

  const getMaterialName = (id: string) =>
    materials.find((m) => m.id === id)?.name || id;
  const getMaterial = (id: string) =>
    materials.find((m) => m.id === id) || null;

  // ── Category material config logic ──
  const l2ForSelectedL1 = useMemo(
    () =>
      selectedL1Code
        ? LEVEL_2_DATA.filter((l2) => l2.code.startsWith(selectedL1Code))
        : [],
    [selectedL1Code],
  );

  const l3ForSelectedL2 = useMemo(
    () =>
      selectedL2Code
        ? LEVEL_3_DATA.filter((l3) => l3.code.startsWith(selectedL2Code))
        : [],
    [selectedL2Code],
  );

  const selectedL3Node = useMemo(
    () =>
      selectedL3Code
        ? LEVEL_3_DATA.find((l3) => l3.code === selectedL3Code)
        : null,
    [selectedL3Code],
  );

  const currentCatMatConfig = useMemo(
    () =>
      selectedL3Code
        ? categoryMaterialConfigs.find((c) => c.categoryCode === selectedL3Code)
        : null,
    [categoryMaterialConfigs, selectedL3Code],
  );

  const handleSelectL1 = (code: string) => {
    setSelectedL1Code(code);
    setSelectedL2Code(null);
    setSelectedL3Code(null);
  };

  const handleSelectL2 = (code: string) => {
    setSelectedL2Code(code);
    setSelectedL3Code(null);
  };

  // Sync draft when L3 selection changes
  useEffect(() => {
    const saved = selectedL3Code
      ? categoryMaterialConfigs.find(
          (c) => c.categoryCode === selectedL3Code,
        ) || null
      : null;
    setEditingCatMatConfig(saved);
    setIsCatMatDirty(false);
  }, [selectedL3Code]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleCatMaterial = (matId: string) => {
    if (!selectedL3Code || !selectedL3Node) return;
    setEditingCatMatConfig((prev) => {
      const currentIds = prev?.materialIds || [];
      const removing = currentIds.includes(matId);
      const newIds = removing
        ? currentIds.filter((id) => id !== matId)
        : [...currentIds, matId];
      const prevMap = prev?.materialRequiredMap || {};
      const newRequiredMap = removing
        ? Object.fromEntries(
            Object.entries(prevMap).filter(([k]) => k !== matId),
          )
        : prevMap;
      return {
        categoryCode: selectedL3Code,
        categoryName: selectedL3Node.name,
        materialIds: newIds,
        materialRequiredMap: newRequiredMap,
      };
    });
    setIsCatMatDirty(true);
  };

  const handleToggleCatMaterialRequired = (matId: string) => {
    if (!selectedL3Code || !selectedL3Node) return;
    setEditingCatMatConfig((prev) => {
      if (!prev) return prev;
      const prevMap = prev.materialRequiredMap || {};
      return {
        ...prev,
        materialRequiredMap: { ...prevMap, [matId]: !prevMap[matId] },
      };
    });
    setIsCatMatDirty(true);
  };

  const handleSaveCatMatConfig = async () => {
    if (!selectedL3Code || !selectedL3Node || !editingCatMatConfig) return;
    const updatedConfig: CategoryMaterialConfig = {
      ...editingCatMatConfig,
      updatedAt: new Date().toISOString(),
    };
    const newConfigs = categoryMaterialConfigs.some(
      (c) => c.categoryCode === selectedL3Code,
    )
      ? categoryMaterialConfigs.map((c) =>
          c.categoryCode === selectedL3Code ? updatedConfig : c,
        )
      : [...categoryMaterialConfigs, updatedConfig];
    setIsSavingCatMat(true);
    try {
      await api.categoryMaterialConfigs.saveAll(newConfigs);
      setCategoryMaterialConfigs(newConfigs);
      setEditingCatMatConfig(updatedConfig);
      setIsCatMatDirty(false);
    } catch (error) {
      console.error("Failed to save category material config:", error);
      alert("保存失败");
    } finally {
      setIsSavingCatMat(false);
    }
  };

  // ── Material management handlers ──
  const filteredMaterials = useMemo(() => {
    if (!materialSearchQuery) return materials;
    const lowerQuery = materialSearchQuery.toLowerCase();
    return materials.filter(
      (m) =>
        m.name.toLowerCase().includes(lowerQuery) ||
        m.description.toLowerCase().includes(lowerQuery),
    );
  }, [materials, materialSearchQuery]);

  const paginatedMaterials = useMemo(() => {
    const startIndex = (materialPage - 1) * MATERIALS_PER_PAGE;
    return filteredMaterials.slice(startIndex, startIndex + MATERIALS_PER_PAGE);
  }, [filteredMaterials, materialPage]);

  const totalMaterialPages = Math.ceil(
    filteredMaterials.length / MATERIALS_PER_PAGE,
  );

  const editorValidationErrors = useMemo(() => {
    if (!editingMaterial) return [];

    const errors: string[] = [];
    const schemaFields =
      (editingMaterial.schemaFields as MaterialSchemaField[]) || [];

    errors.push(...validateMaterialFieldTree(schemaFields, "材料字段"));

    const factIds = collectFactBindingsFromFields(schemaFields)
      .map((binding) => binding.fact_id)
      .filter(Boolean);
    const duplicatedFactIds = factIds.filter(
      (factId, index) => factIds.indexOf(factId) !== index,
    );
    if (duplicatedFactIds.length > 0) {
      errors.push(
        `同一个标准事实不能在当前材料里重复绑定：${[...new Set(duplicatedFactIds)].join("、")}`,
      );
    }

    return errors;
  }, [editingMaterial]);

  const materialSchemaPaths = useMemo(
    () =>
      collectMaterialSchemaPaths(
        (editingMaterial?.schemaFields as MaterialSchemaField[]) || [],
      ),
    [editingMaterial?.schemaFields],
  );

  const handleAddMaterial = () => {
    setEditingMaterial({
      id: `mat-${Date.now()}`,
      name: "",
      description: "",
      sampleUrl: "",
      jsonSchema: '{\n  "type": "object",\n  "properties": {}\n}',
      aiAuditPrompt: "",
      schemaFields: [],
    });
    setIsMaterialModalOpen(true);
  };

  const handleEditMaterial = (material: ClaimsMaterial) => {
    setEditingMaterial({
      ...material,
      schemaFields: hydrateSchemaFields(material),
    });
    setIsMaterialModalOpen(true);
  };

  const handleDeleteMaterial = async (id: string) => {
    if (window.confirm("确定要删除这个理赔材料吗？")) {
      const newMaterials = materials.filter((m) => m.id !== id);
      try {
        await api.claimsMaterials.saveAll(newMaterials);
        setMaterials(newMaterials);
      } catch (error) {
        console.error("Failed to delete material:", error);
        alert("删除失败");
      }
    }
  };

  const handleViewSample = async (material: ClaimsMaterial) => {
    try {
      let url = material.sampleUrl;

      // If we have an ossKey, generate a fresh signed URL
      if (material.ossKey) {
        url = await getSignedUrl(material.ossKey);
      }

      if (url) {
        // Test if the URL is accessible by trying to load it
        const testImg = new Image();
        testImg.onload = () => {
          setPreviewImageUrl(url);
        };
        testImg.onerror = () => {
          alert("样例图片不存在或已被删除，请重新上传样例图片");
        };
        testImg.src = url;
      } else {
        alert("无样例图片");
      }
    } catch (error) {
      console.error("Failed to get signed URL:", error);
      alert("样例图片不存在或已被删除，请重新上传样例图片");
    }
  };

  const handleSaveMaterial = async () => {
    if (!editingMaterial?.name) {
      alert("请从元数据下拉列表中选择材料");
      return;
    }
    if (editorValidationErrors.length > 0) {
      alert(editorValidationErrors[0]);
      return;
    }
    const materialToSave: ClaimsMaterial = {
      ...editingMaterial,
      schemaFields:
        (editingMaterial.schemaFields as MaterialSchemaField[]) || [],
      jsonSchema: buildSchemaFromFields(
        (editingMaterial.schemaFields as MaterialSchemaField[]) || [],
      ),
    } as ClaimsMaterial;
    let newMaterials = [...materials];
    if (materials.find((m) => m.id === materialToSave.id)) {
      newMaterials = materials.map((m) =>
        m.id === materialToSave.id ? materialToSave : m,
      );
    } else {
      newMaterials = [...materials, materialToSave];
    }
    try {
      await api.claimsMaterials.saveAll(newMaterials);
      setMaterials(newMaterials);
      setIsMaterialModalOpen(false);
      setEditingMaterial(null);
    } catch (error) {
      console.error("Failed to save material:", error);
      alert("保存失败");
    }
  };

  const importSchemaToMaterialFields = () => {
    if (!editingMaterial?.jsonSchema) return;
    try {
      const parsed = JSON.parse(editingMaterial.jsonSchema) as {
        properties?: Record<
          string,
          {
            type?: string;
            description?: string;
            format?: string;
            properties?: Record<string, any>;
            items?: any;
          }
        >;
        required?: string[];
      };
      const importedFields = parseSchemaFieldsFromNode(parsed);
      setEditingMaterial((prev) => ({
        ...prev!,
        schemaFields: importedFields,
      }));
    } catch (error) {
      console.error("Failed to import schema fields:", error);
      alert("当前 JSON Schema 不是合法 JSON，无法导入材料字段。");
    }
  };

  // ── Accident cause config state & handlers ──
  const [selectedCauseId, setSelectedCauseId] = useState<string | null>(null);
  const [editingCause, setEditingCause] =
    useState<Partial<AccidentCauseMaterialConfig> | null>(null);
  const [isAddCauseModalOpen, setIsAddCauseModalOpen] = useState(false);
  const [editingCauseDraft, setEditingCauseDraft] =
    useState<AccidentCauseMaterialConfig | null>(null);
  const [isCauseDirty, setIsCauseDirty] = useState(false);
  const [isSavingCause, setIsSavingCause] = useState(false);

  const selectedCause = useMemo(
    () =>
      selectedCauseId
        ? accidentCauseConfigs.find((c) => c.id === selectedCauseId) || null
        : null,
    [accidentCauseConfigs, selectedCauseId],
  );

  // Sync draft when selected cause changes
  useEffect(() => {
    setEditingCauseDraft(selectedCause ? { ...selectedCause } : null);
    setIsCauseDirty(false);
  }, [selectedCauseId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddCause = () => {
    setEditingCause({
      id: `cause-${Date.now()}`,
      name: "",
      description: "",
      materialIds: [],
      materialRequiredMap: {},
    });
    setIsAddCauseModalOpen(true);
  };

  const handleSaveNewCause = async () => {
    if (!editingCause?.name?.trim()) return alert("请输入事故原因名称");
    const newCause: AccidentCauseMaterialConfig = {
      id: editingCause.id!,
      name: editingCause.name!.trim(),
      description: editingCause.description?.trim() || "",
      materialIds: editingCause.materialIds || [],
      materialRequiredMap: editingCause.materialRequiredMap || {},
      updatedAt: new Date().toISOString(),
    };
    const exists = accidentCauseConfigs.some((c) => c.id === newCause.id);
    const newConfigs = exists
      ? accidentCauseConfigs.map((c) => (c.id === newCause.id ? newCause : c))
      : [...accidentCauseConfigs, newCause];
    try {
      await api.accidentCauseConfigs.saveAll(newConfigs);
      setAccidentCauseConfigs(newConfigs);
      setIsAddCauseModalOpen(false);
      setEditingCause(null);
      setSelectedCauseId(newCause.id);
    } catch (error) {
      console.error("Failed to save accident cause:", error);
      alert("保存失败");
    }
  };

  const handleDeleteCause = async (id: string) => {
    if (!window.confirm("确定要删除该事故原因配置吗？")) return;
    const newConfigs = accidentCauseConfigs.filter((c) => c.id !== id);
    try {
      await api.accidentCauseConfigs.saveAll(newConfigs);
      setAccidentCauseConfigs(newConfigs);
      if (selectedCauseId === id) setSelectedCauseId(null);
    } catch (error) {
      console.error("Failed to delete accident cause:", error);
      alert("删除失败");
    }
  };

  const handleToggleCauseMaterial = (matId: string) => {
    setEditingCauseDraft((prev) => {
      if (!prev) return prev;
      const removing = prev.materialIds.includes(matId);
      const newIds = removing
        ? prev.materialIds.filter((id) => id !== matId)
        : [...prev.materialIds, matId];
      const prevMap = prev.materialRequiredMap || {};
      const newMap = removing
        ? Object.fromEntries(
            Object.entries(prevMap).filter(([k]) => k !== matId),
          )
        : prevMap;
      return { ...prev, materialIds: newIds, materialRequiredMap: newMap };
    });
    setIsCauseDirty(true);
  };

  const handleToggleCauseMaterialRequired = (matId: string) => {
    setEditingCauseDraft((prev) => {
      if (!prev) return prev;
      const prevMap = prev.materialRequiredMap || {};
      return {
        ...prev,
        materialRequiredMap: { ...prevMap, [matId]: !prevMap[matId] },
      };
    });
    setIsCauseDirty(true);
  };

  const handleSaveCauseDraft = async () => {
    if (!editingCauseDraft || !selectedCauseId) return;
    const updated: AccidentCauseMaterialConfig = {
      ...editingCauseDraft,
      updatedAt: new Date().toISOString(),
    };
    const newConfigs = accidentCauseConfigs.map((c) =>
      c.id === selectedCauseId ? updated : c,
    );
    setIsSavingCause(true);
    try {
      await api.accidentCauseConfigs.saveAll(newConfigs);
      setAccidentCauseConfigs(newConfigs);
      setEditingCauseDraft(updated);
      setIsCauseDirty(false);
    } catch (error) {
      console.error("Failed to save cause config:", error);
      alert("保存失败");
    } finally {
      setIsSavingCause(false);
    }
  };

  // ── Metadata tab computed values & handlers ──
  const filteredMetaCatalog = useMemo(() => {
    if (!metaSearchQuery) return materialTypeCatalog;
    const lowerQuery = metaSearchQuery.toLowerCase();
    return materialTypeCatalog.filter(
      (t) =>
        t.type_name.toLowerCase().includes(lowerQuery) ||
        t.type_code.toLowerCase().includes(lowerQuery),
    );
  }, [materialTypeCatalog, metaSearchQuery]);

  const paginatedMetaCatalog = useMemo(() => {
    const startIndex = (metaCurrentPage - 1) * META_ITEMS_PER_PAGE;
    return filteredMetaCatalog.slice(
      startIndex,
      startIndex + META_ITEMS_PER_PAGE,
    );
  }, [filteredMetaCatalog, metaCurrentPage]);

  const metaTotalPages = Math.ceil(
    filteredMetaCatalog.length / META_ITEMS_PER_PAGE,
  );

  const handleMetaAdd = () => {
    setEditingMeta({
      type_code: "",
      type_name: "",
      category: "other",
      description: "",
      default_processing_strategy:
        "general_doc" as MaterialTypeCatalogItem["default_processing_strategy"],
      default_confidence_threshold: 0.9,
      recommended_facts: [],
      status: "ACTIVE",
    });
    setIsMetaModalOpen(true);
  };

  const handleMetaEdit = (item: MaterialTypeCatalogItem) => {
    setEditingMeta({ ...item });
    setIsMetaModalOpen(true);
  };

  const handleMetaDelete = async (typeCode: string) => {
    const referenced = materials.some((m) => m.type_code === typeCode);
    if (referenced) {
      alert("该元数据已被理赔材料引用，无法删除。请先解除关联后再删除。");
      return;
    }
    if (!confirm("确认删除该材料元数据？")) return;
    const updated = materialTypeCatalog.filter((t) => t.type_code !== typeCode);
    await api.materialTypeCatalog.saveAll(updated);
    setMaterialTypeCatalog(updated);
  };

  const handleMetaSave = async () => {
    if (!editingMeta?.type_code?.trim() || !editingMeta?.type_name?.trim()) {
      alert("材料代码和材料名称不能为空。");
      return;
    }
    const isNew = !materialTypeCatalog.some(
      (t) => t.type_code === editingMeta.type_code,
    );
    if (isNew) {
      const duplicate = materialTypeCatalog.find(
        (t) => t.type_code === editingMeta.type_code!.trim(),
      );
      if (duplicate) {
        alert(`材料代码 "${editingMeta.type_code}" 已存在，请使用不同的代码。`);
        return;
      }
    }
    const item: MaterialTypeCatalogItem = {
      type_code: editingMeta.type_code!.trim(),
      type_name: editingMeta.type_name!.trim(),
      category: editingMeta.category || "other",
      description: editingMeta.description || "",
      default_processing_strategy:
        (editingMeta.default_processing_strategy as MaterialTypeCatalogItem["default_processing_strategy"]) ||
        "general_doc",
      default_confidence_threshold:
        editingMeta.default_confidence_threshold ?? 0.9,
      recommended_facts: editingMeta.recommended_facts || [],
      status:
        (editingMeta.status as MaterialTypeCatalogItem["status"]) || "ACTIVE",
    };
    let updated: MaterialTypeCatalogItem[];
    if (isNew) {
      updated = [...materialTypeCatalog, item];
    } else {
      updated = materialTypeCatalog.map((t) =>
        t.type_code === item.type_code ? item : t,
      );
    }
    await api.materialTypeCatalog.saveAll(updated);
    setMaterialTypeCatalog(updated);
    setIsMetaModalOpen(false);
    setEditingMeta(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="text-gray-400 text-sm">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">理赔项目及材料配置</h1>

      <div className="flex border-b border-gray-200">
        <button
          className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === "materials" ? "text-brand-blue-600 border-b-2 border-brand-blue-600" : "text-gray-500 hover:text-gray-700"}`}
          onClick={() => setActiveTab("materials")}
        >
          理赔材料管理
        </button>
        <button
          className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === "items" ? "text-brand-blue-600 border-b-2 border-brand-blue-600" : "text-gray-500 hover:text-gray-700"}`}
          onClick={() => setActiveTab("items")}
        >
          索赔项目定义
        </button>
        <button
          className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === "category_materials" ? "text-brand-blue-600 border-b-2 border-brand-blue-600" : "text-gray-500 hover:text-gray-700"}`}
          onClick={() => setActiveTab("category_materials")}
        >
          通用索赔材料配置
        </button>
        <button
          className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === "accident_causes" ? "text-brand-blue-600 border-b-2 border-brand-blue-600" : "text-gray-500 hover:text-gray-700"}`}
          onClick={() => setActiveTab("accident_causes")}
        >
          事故原因及索赔材料关联
        </button>
        <button
          className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === "metadata" ? "text-brand-blue-600 border-b-2 border-brand-blue-600" : "text-gray-500 hover:text-gray-700"}`}
          onClick={() => setActiveTab("metadata")}
        >
          材料元数据
        </button>
      </div>

      {/* ── Tab: 理赔材料管理 ── */}
      {activeTab === "materials" ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <button
              onClick={handleAddMaterial}
              className="px-4 py-2 bg-brand-blue-600 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-brand-blue-700 transition-colors"
            >
              新增材料
            </button>
          </div>
          <div className="bg-white p-6 rounded-md shadow-sm border border-gray-200">
            <div className="max-w-md">
              <label
                htmlFor="search"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                搜索材料
              </label>
              <div className="flex space-x-2">
                <input
                  id="search"
                  type="text"
                  value={materialSearchQuery}
                  onChange={(e) => setMaterialSearchQuery(e.target.value)}
                  placeholder="搜索材料名称或说明"
                  className="flex-1 h-9 px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 text-sm"
                />
                <button
                  onClick={() => setMaterialSearchQuery("")}
                  className="h-9 px-4 bg-gray-100 text-gray-600 text-sm font-medium rounded-md hover:bg-gray-200 transition"
                >
                  重置
                </button>
              </div>
            </div>
          </div>
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      材料名称
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      说明
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      转人工置信度
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      样例
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedMaterials.length > 0 ? (
                    paginatedMaterials.map((material) => (
                      <tr
                        key={material.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {material.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                          {material.description}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {material.confidenceThreshold != null ? (
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                material.confidenceThreshold >= 0.8
                                  ? "bg-green-50 text-green-700"
                                  : material.confidenceThreshold >= 0.6
                                    ? "bg-yellow-50 text-yellow-700"
                                    : "bg-red-50 text-red-700"
                              }`}
                            >
                              {(material.confidenceThreshold * 100).toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-gray-400">未设置</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {material.sampleUrl || material.ossKey ? (
                            <button
                              onClick={() => handleViewSample(material)}
                              className="text-brand-blue-600 hover:underline"
                            >
                              查看样例
                            </button>
                          ) : (
                            <span className="text-gray-400">无</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-3">
                          <button
                            onClick={() => handleEditMaterial(material)}
                            className="text-brand-blue-600 hover:text-brand-blue-900 bg-brand-blue-50 hover:bg-brand-blue-100 px-3 py-1 rounded-md transition-colors"
                          >
                            修改
                          </button>
                          <button
                            onClick={() => handleDeleteMaterial(material.id)}
                            className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-md transition-colors"
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-8 text-center text-sm text-gray-500"
                      >
                        暂无符合条件的材料数据
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-gray-200">
              <Pagination
                currentPage={materialPage}
                totalPages={totalMaterialPages}
                onPageChange={setMaterialPage}
                totalItems={filteredMaterials.length}
                itemsPerPage={MATERIALS_PER_PAGE}
              />
            </div>
          </div>
        </div>
      ) : /* ── Tab: 索赔项目定义 ── */
      activeTab === "items" ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={handleAddItem}
              className="px-4 py-2 bg-brand-blue-600 text-white text-sm font-medium rounded-lg hover:bg-brand-blue-700 transition-colors"
            >
              新增项目
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {claimItems.length > 0 ? (
              claimItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-bold text-gray-900">
                      {item.name}
                    </h3>
                    <button
                      onClick={() => handleEditItem(item)}
                      className="text-brand-blue-600 text-sm hover:underline"
                    >
                      编辑
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {item.description}
                  </p>
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      所需材料:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {item.materialIds.map((mId) => (
                        <span
                          key={mId}
                          className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md border border-gray-200"
                        >
                          {getMaterialName(mId)}
                        </span>
                      ))}
                      {item.materialIds.length === 0 && (
                        <span className="text-xs text-gray-400 italic">
                          未关联材料
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-12 text-center">
                <div className="text-gray-400 text-sm mb-4">暂无索赔项目</div>
                <button
                  onClick={handleAddItem}
                  className="px-4 py-2 bg-brand-blue-600 text-white text-sm font-medium rounded-lg hover:bg-brand-blue-700 transition-colors"
                >
                  添加第一个项目
                </button>
              </div>
            )}
          </div>
        </div>
      ) : /* ── Tab: 通用索赔材料配置 ── */
      activeTab === "category_materials" ? (
        <div className="flex gap-6" style={{ minHeight: "500px" }}>
          {/* 左侧：三级险种导航 */}
          <div className="w-72 flex-shrink-0 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              选择险种（三级分类）
            </p>
            <div className="space-y-1">
              {LEVEL_1_DATA.map((l1) => (
                <div key={l1.code}>
                  <button
                    onClick={() => handleSelectL1(l1.code)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedL1Code === l1.code ? "bg-brand-blue-50 text-brand-blue-700" : "text-gray-700 hover:bg-gray-100"}`}
                  >
                    <span className="mr-2 text-gray-400">
                      {selectedL1Code === l1.code ? "▼" : "▶"}
                    </span>
                    {l1.name}
                  </button>
                  {selectedL1Code === l1.code && (
                    <div className="ml-4 mt-1 space-y-1">
                      {l2ForSelectedL1.map((l2) => (
                        <div key={l2.code}>
                          <button
                            onClick={() => handleSelectL2(l2.code)}
                            className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${selectedL2Code === l2.code ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-50"}`}
                          >
                            <span className="mr-2 text-gray-400 text-xs">
                              {selectedL2Code === l2.code ? "▼" : "▶"}
                            </span>
                            {l2.name}
                          </button>
                          {selectedL2Code === l2.code && (
                            <div className="ml-4 mt-1 space-y-1">
                              {l3ForSelectedL2.map((l3) => {
                                const hasConfig = categoryMaterialConfigs.some(
                                  (c) =>
                                    c.categoryCode === l3.code &&
                                    c.materialIds.length > 0,
                                );
                                return (
                                  <button
                                    key={l3.code}
                                    onClick={() => setSelectedL3Code(l3.code)}
                                    className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center justify-between ${selectedL3Code === l3.code ? "bg-brand-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                                  >
                                    <span>{l3.name}</span>
                                    {hasConfig && (
                                      <span
                                        className={`text-xs px-1.5 py-0.5 rounded-full ${selectedL3Code === l3.code ? "bg-white/20 text-white" : "bg-green-100 text-green-700"}`}
                                      >
                                        已配置
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 右侧：材料配置区域 */}
          <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            {!selectedL3Code ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <svg
                    className="w-6 h-6 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <p className="text-gray-500 text-sm">
                  请在左侧选择一个三级险种
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  展开险种分类，点击三级险种即可配置通用索赔材料
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* 顶部标题 + 保存按钮 */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      {selectedL3Node?.name}
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      险种代码：{selectedL3Code}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      配置该险种的通用索赔材料，适用于所有属于该险种的保单理赔。
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <button
                      onClick={handleSaveCatMatConfig}
                      disabled={isSavingCatMat || !isCatMatDirty}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${isCatMatDirty && !isSavingCatMat ? "bg-brand-blue-600 text-white hover:bg-brand-blue-700 shadow-sm" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
                    >
                      {isSavingCatMat ? "保存中..." : "保存"}
                    </button>
                    {editingCatMatConfig?.updatedAt && !isCatMatDirty && (
                      <span className="text-xs text-gray-400">
                        上次保存：
                        {new Date(editingCatMatConfig.updatedAt).toLocaleString(
                          "zh-CN",
                        )}
                      </span>
                    )}
                    {isCatMatDirty && (
                      <span className="text-xs text-amber-500">
                        有未保存的更改
                      </span>
                    )}
                  </div>
                </div>
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    选择通用索赔材料
                    {editingCatMatConfig &&
                      editingCatMatConfig.materialIds.length > 0 && (
                        <span className="ml-2 text-xs font-normal text-brand-blue-600">
                          已选 {editingCatMatConfig.materialIds.length} 项
                        </span>
                      )}
                  </p>
                  {materials.length === 0 ? (
                    <div className="text-sm text-gray-400 italic py-4">
                      暂无可用材料，请先在"理赔材料管理"中添加材料
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {materials.map((mat) => {
                        const isChecked =
                          editingCatMatConfig?.materialIds.includes(mat.id) ||
                          false;
                        const isRequired =
                          editingCatMatConfig?.materialRequiredMap?.[mat.id] ||
                          false;
                        return (
                          <div
                            key={mat.id}
                            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${isChecked ? "border-brand-blue-300 bg-brand-blue-50" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleCatMaterial(mat.id)}
                              disabled={isSavingCatMat}
                              className="mt-0.5 rounded border-gray-300 text-brand-blue-600 focus:ring-brand-blue-500 cursor-pointer flex-shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className="text-sm font-medium text-gray-800 cursor-pointer"
                                  onClick={() =>
                                    !isSavingCatMat &&
                                    handleToggleCatMaterial(mat.id)
                                  }
                                >
                                  {mat.name}
                                </span>
                                {isChecked && (
                                  <label className="flex items-center gap-1 cursor-pointer flex-shrink-0">
                                    <input
                                      type="checkbox"
                                      checked={isRequired}
                                      onChange={() =>
                                        handleToggleCatMaterialRequired(mat.id)
                                      }
                                      disabled={isSavingCatMat}
                                      className="rounded border-gray-300 text-red-500 focus:ring-red-400"
                                    />
                                    <span className="text-xs text-red-500 font-medium whitespace-nowrap">
                                      必传
                                    </span>
                                  </label>
                                )}
                              </div>
                              {mat.description && (
                                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                                  {mat.description}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : /* ── Tab: 事故原因及索赔材料关联 ── */
      activeTab === "accident_causes" ? (
        <div className="flex gap-6" style={{ minHeight: "500px" }}>
          {/* 左侧：事故原因列表 */}
          <div className="w-72 flex-shrink-0 flex flex-col gap-3">
            <button
              onClick={handleAddCause}
              className="w-full px-4 py-2 bg-brand-blue-600 text-white text-sm font-medium rounded-lg hover:bg-brand-blue-700 transition-colors"
            >
              + 新增事故原因
            </button>
            <div className="space-y-1">
              {accidentCauseConfigs.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">
                  暂无事故原因，请点击上方按钮新增
                </p>
              ) : (
                accidentCauseConfigs.map((cause) => (
                  <div
                    key={cause.id}
                    className={`group flex items-center justify-between px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${selectedCauseId === cause.id ? "bg-brand-blue-600 text-white border-brand-blue-600" : "bg-white text-gray-700 border-gray-200 hover:border-brand-blue-300 hover:bg-brand-blue-50"}`}
                    onClick={() => setSelectedCauseId(cause.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {cause.name}
                      </div>
                      <div
                        className={`text-xs mt-0.5 ${selectedCauseId === cause.id ? "text-blue-100" : "text-gray-400"}`}
                      >
                        {cause.materialIds.length > 0
                          ? `${cause.materialIds.length} 项材料`
                          : "未配置材料"}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCause(cause.id);
                      }}
                      className={`ml-2 px-1.5 py-0.5 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity ${selectedCauseId === cause.id ? "text-blue-100 hover:text-white hover:bg-white/20" : "text-red-400 hover:text-red-600 hover:bg-red-50"}`}
                    >
                      删除
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 右侧：材料配置区域 */}
          <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            {!selectedCauseId || !selectedCause ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <svg
                    className="w-6 h-6 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
                <p className="text-gray-500 text-sm">
                  请在左侧选择一个事故原因
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  配置该事故原因所需的索赔材料及是否必传
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* 顶部标题 + 保存按钮 */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      {selectedCause.name}
                    </h2>
                    {selectedCause.description && (
                      <p className="text-sm text-gray-500 mt-1">
                        {selectedCause.description}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <button
                      onClick={handleSaveCauseDraft}
                      disabled={isSavingCause || !isCauseDirty}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${isCauseDirty && !isSavingCause ? "bg-brand-blue-600 text-white hover:bg-brand-blue-700 shadow-sm" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
                    >
                      {isSavingCause ? "保存中..." : "保存"}
                    </button>
                    {editingCauseDraft?.updatedAt && !isCauseDirty && (
                      <span className="text-xs text-gray-400">
                        上次保存：
                        {new Date(editingCauseDraft.updatedAt).toLocaleString(
                          "zh-CN",
                        )}
                      </span>
                    )}
                    {isCauseDirty && (
                      <span className="text-xs text-amber-500">
                        有未保存的更改
                      </span>
                    )}
                  </div>
                </div>
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    选择索赔材料
                    {editingCauseDraft &&
                      editingCauseDraft.materialIds.length > 0 && (
                        <span className="ml-2 text-xs font-normal text-brand-blue-600">
                          已选 {editingCauseDraft.materialIds.length} 项
                        </span>
                      )}
                  </p>
                  {materials.length === 0 ? (
                    <div className="text-sm text-gray-400 italic py-4">
                      暂无可用材料，请先在"理赔材料管理"中添加材料
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {materials.map((mat) => {
                        const isChecked =
                          editingCauseDraft?.materialIds.includes(mat.id) ||
                          false;
                        const isRequired =
                          editingCauseDraft?.materialRequiredMap?.[mat.id] ||
                          false;
                        return (
                          <div
                            key={mat.id}
                            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${isChecked ? "border-brand-blue-300 bg-brand-blue-50" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleCauseMaterial(mat.id)}
                              disabled={isSavingCause}
                              className="mt-0.5 rounded border-gray-300 text-brand-blue-600 focus:ring-brand-blue-500 cursor-pointer flex-shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className="text-sm font-medium text-gray-800 cursor-pointer"
                                  onClick={() =>
                                    !isSavingCause &&
                                    handleToggleCauseMaterial(mat.id)
                                  }
                                >
                                  {mat.name}
                                </span>
                                {isChecked && (
                                  <label className="flex items-center gap-1 cursor-pointer flex-shrink-0">
                                    <input
                                      type="checkbox"
                                      checked={isRequired}
                                      onChange={() =>
                                        handleToggleCauseMaterialRequired(
                                          mat.id,
                                        )
                                      }
                                      disabled={isSavingCause}
                                      className="rounded border-gray-300 text-red-500 focus:ring-red-400"
                                    />
                                    <span className="text-xs text-red-500 font-medium whitespace-nowrap">
                                      必传
                                    </span>
                                  </label>
                                )}
                              </div>
                              {mat.description && (
                                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                                  {mat.description}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : /* ── Tab: 材料元数据 ── */
      activeTab === "metadata" ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <button
              onClick={handleMetaAdd}
              className="px-4 py-2 bg-brand-blue-600 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-brand-blue-700 transition-colors"
            >
              新增元数据
            </button>
          </div>
          <div className="bg-white p-6 rounded-md shadow-sm border border-gray-200">
            <div className="max-w-md">
              <label
                htmlFor="meta-search"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                搜索元数据
              </label>
              <div className="flex space-x-2">
                <input
                  id="meta-search"
                  type="text"
                  value={metaSearchQuery}
                  onChange={(e) => setMetaSearchQuery(e.target.value)}
                  placeholder="搜索材料名称或代码"
                  className="flex-1 h-9 px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 text-sm"
                />
                <button
                  onClick={() => setMetaSearchQuery("")}
                  className="h-9 px-4 bg-gray-100 text-gray-600 text-sm font-medium rounded-md hover:bg-gray-200 transition"
                >
                  重置
                </button>
              </div>
            </div>
          </div>
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      材料名称
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      材料代码
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      状态
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedMetaCatalog.length > 0 ? (
                    paginatedMetaCatalog.map((item) => (
                      <tr
                        key={item.type_code}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.type_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-500">
                          {item.type_code}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                              item.status === "ACTIVE"
                                ? "bg-green-50 text-green-700"
                                : item.status === "DRAFT"
                                  ? "bg-yellow-50 text-yellow-700"
                                  : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {item.status === "ACTIVE"
                              ? "启用"
                              : item.status === "DRAFT"
                                ? "草稿"
                                : "停用"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-3">
                          <button
                            onClick={() => handleMetaEdit(item)}
                            className="text-brand-blue-600 hover:text-brand-blue-900 bg-brand-blue-50 hover:bg-brand-blue-100 px-3 py-1 rounded-md transition-colors"
                          >
                            修改
                          </button>
                          <button
                            onClick={() => handleMetaDelete(item.type_code)}
                            className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-md transition-colors"
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-8 text-center text-sm text-gray-500"
                      >
                        暂无符合条件的元数据
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-gray-200">
              <Pagination
                currentPage={metaCurrentPage}
                totalPages={metaTotalPages}
                onPageChange={setMetaCurrentPage}
                totalItems={filteredMetaCatalog.length}
                itemsPerPage={META_ITEMS_PER_PAGE}
              />
            </div>
          </div>

          {/* Meta Edit Modal */}
          <Modal
            isOpen={isMetaModalOpen}
            onClose={() => setIsMetaModalOpen(false)}
            title={
              editingMeta?.type_code &&
              materialTypeCatalog.some(
                (t) => t.type_code === editingMeta.type_code,
              )
                ? "修改材料元数据"
                : "新增材料元数据"
            }
            footer={
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setIsMetaModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={handleMetaSave}
                  disabled={
                    !editingMeta?.type_code?.trim() ||
                    !editingMeta?.type_name?.trim()
                  }
                  className="px-4 py-2 bg-brand-blue-600 text-white text-sm font-medium rounded-md hover:bg-brand-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  保存
                </button>
              </div>
            }
          >
            <div className="space-y-4">
              <Input
                label="材料代码"
                required
                value={editingMeta?.type_code || ""}
                onChange={(e) =>
                  setEditingMeta((prev) => ({
                    ...prev!,
                    type_code: e.target.value,
                  }))
                }
                placeholder="例如: MT-MED-BLOOD_TEST"
                disabled={
                  !!editingMeta?.type_code &&
                  materialTypeCatalog.some(
                    (t) => t.type_code === editingMeta.type_code,
                  )
                }
              />
              <Input
                label="材料名称"
                required
                value={editingMeta?.type_name || ""}
                onChange={(e) =>
                  setEditingMeta((prev) => ({
                    ...prev!,
                    type_name: e.target.value,
                  }))
                }
                placeholder="例如: 血液检验报告"
              />
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  状态
                </label>
                <select
                  value={editingMeta?.status || "ACTIVE"}
                  onChange={(e) =>
                    setEditingMeta((prev) => ({
                      ...prev!,
                      status: e.target.value as "ACTIVE" | "DRAFT" | "DISABLED",
                    }))
                  }
                  className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 text-sm"
                >
                  <option value="ACTIVE">启用</option>
                  <option value="DRAFT">草稿</option>
                  <option value="DISABLED">停用</option>
                </select>
                <p className="text-xs text-gray-500">
                  仅"启用"状态的元数据会出现在新增材料的下拉列表中
                </p>
              </div>
            </div>
          </Modal>
        </div>
      ) : (
        /* ── 产品索赔材料配置（else 分支） ── */
        <div className="flex gap-5" style={{ minHeight: "600px" }}>
          {/* 左侧：产品列表 */}
          <div className="w-72 flex-shrink-0 flex flex-col gap-3">
            <input
              type="text"
              placeholder="搜索产品名称或编号..."
              value={productSearchQuery}
              onChange={(e) => setProductSearchQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue-500"
            />
            <div
              className="flex-1 overflow-y-auto space-y-1 pr-1"
              style={{ maxHeight: "560px" }}
            >
              {filteredProducts.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">
                  无匹配产品
                </p>
              ) : (
                filteredProducts.map((p) => {
                  const racewayId = (p as any).racewayId as string | undefined;
                  const l3Name = racewayId
                    ? LEVEL_3_DATA.find((l) => l.code === racewayId)?.name
                    : null;
                  const hasConfig = productConfigs.some(
                    (c) => c.productCode === p.productCode,
                  );
                  return (
                    <button
                      key={p.productCode}
                      onClick={() => setSelectedProductCode(p.productCode)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors border ${selectedProductCode === p.productCode ? "bg-brand-blue-600 text-white border-brand-blue-600" : "bg-white text-gray-700 border-gray-200 hover:border-brand-blue-300 hover:bg-brand-blue-50"}`}
                    >
                      <div className="font-medium truncate">
                        {p.regulatoryName}
                      </div>
                      <div
                        className={`text-xs mt-0.5 flex items-center gap-2 ${selectedProductCode === p.productCode ? "text-blue-100" : "text-gray-400"}`}
                      >
                        {l3Name && <span>{l3Name}</span>}
                        {hasConfig && (
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-xs ${selectedProductCode === p.productCode ? "bg-white/20 text-white" : "bg-green-100 text-green-700"}`}
                          >
                            已配置
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* 右侧：产品详情视图 */}
          <div className="flex-1 overflow-y-auto">
            {!selectedProductCode || !selectedProduct ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-20">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <svg
                    className="w-6 h-6 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
                <p className="text-gray-500 text-sm">请在左侧选择一个产品</p>
                <p className="text-gray-400 text-xs mt-1">
                  查看该产品完整的索赔材料配置
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* 产品信息头 */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">
                        {selectedProduct.regulatoryName}
                      </h2>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-xs text-gray-500">
                          编号：{selectedProduct.productCode}
                        </span>
                        {(() => {
                          const racewayId = (selectedProduct as any)
                            .racewayId as string | undefined;
                          const l3 = racewayId
                            ? LEVEL_3_DATA.find((l) => l.code === racewayId)
                            : null;
                          return l3 ? (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">
                              {l3.name}
                            </span>
                          ) : null;
                        })()}
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full border ${selectedProduct.status === "生效" ? "bg-green-50 text-green-700 border-green-100" : "bg-gray-100 text-gray-500 border-gray-200"}`}
                        >
                          {selectedProduct.status}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        handleOpenConfigModal(
                          selectedProductConfig || undefined,
                        )
                      }
                      className="px-3 py-1.5 text-sm border border-brand-blue-300 text-brand-blue-600 rounded-lg hover:bg-brand-blue-50 transition-colors flex-shrink-0"
                    >
                      {selectedProductConfig ? "编辑配置" : "+ 新建配置"}
                    </button>
                  </div>
                  {selectedProductClauses.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        包含条款
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedProductClauses.map((clause: any) => (
                          <span
                            key={clause.productCode}
                            className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs rounded-md border border-gray-200"
                          >
                            {clause.regulatoryName || clause.productCode}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 责任 → 索赔项目 → 材料 */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-800">
                      责任 · 索赔项目 · 材料
                    </h3>
                    {selectedProductConfig && (
                      <span className="text-xs text-gray-400">
                        {selectedProductConfig.responsibilityConfigs.length}{" "}
                        个责任已配置
                      </span>
                    )}
                  </div>
                  {!selectedProductConfig ||
                  selectedProductConfig.responsibilityConfigs.length === 0 ? (
                    <div className="py-8 text-center border border-dashed border-gray-200 rounded-lg">
                      <p className="text-sm text-gray-400">暂无责任配置</p>
                      <p className="text-xs text-gray-400 mt-1">
                        点击右上角"新建配置"添加责任和索赔项目
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedProductConfig.responsibilityConfigs.map((rc) => {
                        const resp = responsibilities.find(
                          (r) => r.id === rc.responsibilityId,
                        );
                        const items = rc.claimItemIds
                          .map((id) => claimItems.find((i) => i.id === id))
                          .filter(Boolean) as ClaimItem[];
                        return (
                          <div
                            key={rc.responsibilityId}
                            className="rounded-lg border border-gray-200 overflow-hidden"
                          >
                            <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                              <span className="w-2 h-2 rounded-full bg-brand-blue-500 flex-shrink-0" />
                              <span className="text-sm font-semibold text-gray-800">
                                {resp?.name || rc.responsibilityId}
                              </span>
                              {resp?.description && (
                                <span className="text-xs text-gray-400 ml-1 truncate">
                                  {resp.description}
                                </span>
                              )}
                            </div>
                            {items.length === 0 ? (
                              <div className="px-4 py-3 text-xs text-gray-400 italic">
                                未关联索赔项目
                              </div>
                            ) : (
                              <div className="divide-y divide-gray-100">
                                {items.map((item) => (
                                  <div key={item.id} className="px-4 py-3">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                                        索赔项目
                                      </span>
                                      <span className="text-sm text-gray-800">
                                        {item.name}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 ml-1">
                                      {item.materialIds.length === 0 ? (
                                        <span className="text-xs text-gray-400 italic">
                                          未关联材料
                                        </span>
                                      ) : (
                                        item.materialIds.map((mid) => {
                                          const mat = getMaterial(mid);
                                          return (
                                            <span
                                              key={mid}
                                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100"
                                            >
                                              {mat?.name || mid}
                                            </span>
                                          );
                                        })
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 通用索赔材料 */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-800">
                      险种通用索赔材料
                    </h3>
                    {(() => {
                      const racewayId = (selectedProduct as any).racewayId as
                        | string
                        | undefined;
                      const l3 = racewayId
                        ? LEVEL_3_DATA.find((l) => l.code === racewayId)
                        : null;
                      return l3 ? (
                        <span className="text-xs text-gray-400">
                          来自险种「{l3.name}」的通用配置
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">
                          该产品未设置三级险种代码
                        </span>
                      );
                    })()}
                  </div>
                  {genericMaterialIds.size === 0 ? (
                    <div className="py-6 text-center border border-dashed border-gray-200 rounded-lg">
                      <p className="text-sm text-gray-400">
                        {(() => {
                          const racewayId = (selectedProduct as any)
                            .racewayId as string | undefined;
                          if (!racewayId)
                            return "该产品未设置三级险种（racewayId），无法关联通用材料";
                          return `险种「${LEVEL_3_DATA.find((l) => l.code === racewayId)?.name || racewayId}」尚未配置通用索赔材料`;
                        })()}
                      </p>
                      <button
                        onClick={() => setActiveTab("category_materials")}
                        className="mt-2 text-xs text-brand-blue-600 hover:underline"
                      >
                        前往通用索赔材料配置 →
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {[...genericMaterialIds].map((mid) => {
                        const mat = getMaterial(mid);
                        return (
                          <span
                            key={mid}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 text-xs rounded-full border border-amber-100"
                          >
                            {mat?.name || mid}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 汇总所需材料 */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-800">
                      汇总所需材料
                    </h3>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                      共 {allMaterialIds.size} 种
                    </span>
                  </div>
                  {allMaterialIds.size === 0 ? (
                    <div className="py-4 text-center text-sm text-gray-400">
                      暂无材料，请完成上方配置
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {[...allMaterialIds].map((mid) => {
                          const mat = getMaterial(mid);
                          const isGeneric = genericMaterialIds.has(mid);
                          const isSpecific = specificMaterialIds.has(mid);
                          const isBoth = isGeneric && isSpecific;
                          return (
                            <span
                              key={mid}
                              title={
                                isBoth
                                  ? "责任材料 + 通用材料"
                                  : isGeneric
                                    ? "通用材料"
                                    : "责任材料"
                              }
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border ${isBoth ? "bg-purple-50 text-purple-700 border-purple-100" : isGeneric ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-blue-50 text-blue-700 border-blue-100"}`}
                            >
                              {mat?.name || mid}
                            </span>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs text-gray-400 pt-1">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-200 inline-block" />
                          责任材料
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-200 inline-block" />
                          险种通用材料
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-purple-200 inline-block" />
                          两者均包含
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Add Accident Cause Modal ── */}
      <Modal
        isOpen={isAddCauseModalOpen}
        onClose={() => setIsAddCauseModalOpen(false)}
        title="新增事故原因"
        footer={
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setIsAddCauseModalOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={handleSaveNewCause}
              className="px-4 py-2 bg-brand-blue-600 text-white text-sm font-medium rounded-md hover:bg-brand-blue-700"
            >
              保存
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="事故原因名称"
            value={editingCause?.name || ""}
            onChange={(e) =>
              setEditingCause((prev) => ({ ...prev!, name: e.target.value }))
            }
            placeholder="如：交通事故、工伤事故"
            required
          />
          <Textarea
            label="说明（可选）"
            value={editingCause?.description || ""}
            onChange={(e) =>
              setEditingCause((prev) => ({
                ...prev!,
                description: e.target.value,
              }))
            }
            rows={2}
            placeholder="事故原因的详细描述"
          />
        </div>
      </Modal>

      {/* ── Claim Item Modal ── */}
      <Modal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        title="索赔项目配置"
        width="max-w-6xl"
        footer={
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setIsItemModalOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={handleSaveItem}
              className="px-4 py-2 bg-brand-blue-600 text-white text-sm font-medium rounded-md hover:bg-brand-blue-700"
            >
              保存
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <Input
              label="项目名称"
              value={editingItem?.name || ""}
              onChange={(e) =>
                setEditingItem((prev) => ({ ...prev!, name: e.target.value }))
              }
              required
            />
            <Textarea
              label="项目说明"
              value={editingItem?.description || ""}
              onChange={(e) =>
                setEditingItem((prev) => ({
                  ...prev!,
                  description: e.target.value,
                }))
              }
              rows={2}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <section className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    关联责任
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    先明确这个索赔项目适用于哪些责任，便于后续在产品责任配置中复用。
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-200">
                  已选 {(editingItem?.responsibilityIds || []).length} 个
                </span>
              </div>

              <div className="mt-4">
                {(editingItem?.responsibilityIds || []).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {(editingItem?.responsibilityIds || []).map((id) => (
                      <span
                        key={id}
                        className="px-2.5 py-1 text-xs rounded-full bg-blue-50 text-blue-700 border border-blue-100"
                      >
                        {responsibilities.find((resp) => resp.id === id)
                          ?.name || id}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-gray-300 bg-white px-3 py-4 text-sm text-gray-500">
                    还没有关联责任
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                {responsibilities.map((resp) => {
                  const isChecked =
                    editingItem?.responsibilityIds?.includes(resp.id) || false;
                  return (
                    <label
                      key={resp.id}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-3 cursor-pointer transition-colors ${
                        isChecked
                          ? "border-brand-blue-200 bg-brand-blue-50"
                          : "border-gray-200 bg-white hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleResponsibilityForItem(resp.id)}
                        className="rounded border-gray-300 text-brand-blue-600 focus:ring-brand-blue-500"
                      />
                      <span className="min-w-0 text-sm font-medium text-gray-700">
                        {resp.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    关联理赔材料
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    勾选后即可纳入该索赔项目；已勾选材料可继续标记为“必传”。
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-600">
                    已选 {(editingItem?.materialIds || []).length} 个
                  </span>
                  <span className="rounded-full bg-red-50 px-3 py-1 font-medium text-red-600">
                    必传{" "}
                    {
                      Object.entries(
                        editingItem?.materialRequiredMap || {},
                      ).filter(([, required]) => Boolean(required)).length
                    }{" "}
                    个
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 lg:flex-row">
                <div className="flex-1">
                  <label
                    htmlFor="claim-item-material-search"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    搜索材料
                  </label>
                  <input
                    id="claim-item-material-search"
                    type="text"
                    value={itemMaterialSearchQuery}
                    onChange={(e) => setItemMaterialSearchQuery(e.target.value)}
                    placeholder="按材料名称或说明筛选"
                    className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm focus:ring-1 focus:ring-brand-blue-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setItemMaterialSearchQuery("")}
                  className="h-10 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  清空筛选
                </button>
              </div>

              {(editingItem?.materialIds || []).length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 rounded-lg bg-slate-50 p-3">
                  {(editingItem?.materialIds || []).map((matId) => {
                    const isRequired =
                      editingItem?.materialRequiredMap?.[matId] || false;
                    return (
                      <span
                        key={matId}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
                          isRequired
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        {getMaterialName(matId)}
                        {isRequired && (
                          <span className="font-semibold">必传</span>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                {filteredMaterialsForItemModal.length > 0 ? (
                  filteredMaterialsForItemModal.map((mat) => {
                    const isChecked =
                      editingItem?.materialIds?.includes(mat.id) || false;
                    const isRequired =
                      editingItem?.materialRequiredMap?.[mat.id] || false;
                    return (
                      <div
                        key={mat.id}
                        className={`rounded-xl border p-3 transition-colors ${
                          isChecked
                            ? "border-brand-blue-200 bg-brand-blue-50/70"
                            : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleMaterial(mat.id)}
                              className="mt-0.5 rounded border-gray-300 text-brand-blue-600 focus:ring-brand-blue-500"
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-gray-800">
                                {mat.name}
                              </span>
                              <span className="mt-1 block text-xs leading-5 text-gray-500">
                                {mat.description || "未填写材料说明"}
                              </span>
                            </span>
                          </label>
                          <div className="flex items-center justify-between gap-3 lg:justify-end">
                            {mat.confidenceThreshold != null && (
                              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
                                转人工{" "}
                                {(mat.confidenceThreshold * 100).toFixed(0)}%
                              </span>
                            )}
                            <label
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
                                isChecked
                                  ? "cursor-pointer border-red-200 bg-white text-red-600"
                                  : "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isRequired}
                                disabled={!isChecked}
                                onChange={() => toggleMaterialRequired(mat.id)}
                                className="rounded border-gray-300 text-red-500 focus:ring-red-400"
                              />
                              必传
                            </label>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-8 text-center text-sm text-gray-500">
                    没有匹配的材料，试试换个关键词
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </Modal>

      {/* ── Product Config Modal ── */}
      <Modal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        title="产品索赔责任配置"
        width="max-w-4xl"
        footer={
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setIsConfigModalOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={handleSaveConfig}
              className="px-4 py-2 bg-brand-blue-600 text-white text-sm font-medium rounded-md hover:bg-brand-blue-700"
            >
              保存
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          <Select
            id="claim-config-product"
            label="选择产品"
            value={editingConfig?.productCode || ""}
            onChange={(e) => {
              const value = e.target.value;
              setEditingConfig((prev) => ({
                ...prev!,
                productCode: value,
                responsibilityConfigs: [],
              }));
              setSelectedRespIds([]);
            }}
          >
            <option value="">请选择产品</option>
            {products.map((product) => (
              <option key={product.productCode} value={product.productCode}>
                {product.regulatoryName}
              </option>
            ))}
          </Select>
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-end space-x-2 mb-4">
              <div className="flex-1">
                <Select
                  id="claim-config-responsibility"
                  label="添加责任（可多选）"
                  multiple
                  size={6}
                  value={selectedRespIds}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions)
                      .map((option) => (option as HTMLOptionElement).value)
                      .filter(Boolean);
                    setSelectedRespIds(values);
                  }}
                >
                  {filteredResponsibilitiesForModal.map((resp) => (
                    <option key={resp.id} value={resp.id}>
                      {resp.name}
                    </option>
                  ))}
                </Select>
              </div>
              <button
                onClick={handleAddRespToConfig}
                disabled={
                  !editingConfig?.productCode || selectedRespIds.length === 0
                }
                className="h-10 px-4 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800"
              >
                添加
              </button>
            </div>
            <div className="space-y-4">
              {editingConfig?.responsibilityConfigs?.map((rc) => (
                <div
                  key={rc.responsibilityId}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold text-gray-900">
                      {
                        responsibilities.find(
                          (r) => r.id === rc.responsibilityId,
                        )?.name
                      }
                    </h4>
                    <button
                      onClick={() =>
                        setEditingConfig((prev) => ({
                          ...prev!,
                          responsibilityConfigs:
                            prev?.responsibilityConfigs?.filter(
                              (x) => x.responsibilityId !== rc.responsibilityId,
                            ) || [],
                        }))
                      }
                      className="text-red-600 text-xs hover:underline"
                    >
                      移除责任
                    </button>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-500 uppercase">
                      配置索赔项目:
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {claimItems.map((item) => (
                        <label
                          key={item.id}
                          className="flex items-center space-x-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={rc.claimItemIds.includes(item.id)}
                            onChange={() =>
                              toggleClaimItemForResp(
                                rc.responsibilityId,
                                item.id,
                              )
                            }
                            className="rounded border-gray-300 text-brand-blue-600 focus:ring-brand-blue-500"
                          />
                          <span className="text-sm text-gray-700">
                            {item.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {(!editingConfig?.responsibilityConfigs ||
                editingConfig.responsibilityConfigs.length === 0) && (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  尚未添加任何责任配置
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Material Edit Modal ── */}
      <Modal
        isOpen={isMaterialModalOpen}
        onClose={() => setIsMaterialModalOpen(false)}
        width="max-w-7xl"
        title={
          editingMaterial?.id?.startsWith("mat-") &&
          !materials.find((m) => m.id === editingMaterial.id)
            ? "新增理赔材料"
            : "修改理赔材料"
        }
        footer={
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setIsMaterialModalOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={handleSaveMaterial}
              disabled={editorValidationErrors.length > 0}
              className="px-4 py-2 bg-brand-blue-600 text-white text-sm font-medium rounded-md hover:bg-brand-blue-700"
            >
              保存
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                材料名称 <span className="text-red-500">*</span>
              </label>
              {editingMaterial?.id &&
              materials.find((m) => m.id === editingMaterial.id) ? (
                <input
                  type="text"
                  value={editingMaterial?.name || ""}
                  disabled
                  className="w-full h-9 px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm text-gray-500"
                />
              ) : (
                <select
                  value={editingMaterial?.type_code || ""}
                  onChange={(e) => {
                    const selected = materialTypeCatalog.find(
                      (t) => t.type_code === e.target.value,
                    );
                    if (selected) {
                      setEditingMaterial((prev) => ({
                        ...prev!,
                        name: selected.type_name,
                        type_code: selected.type_code,
                        category: selected.category,
                        description: prev?.description || selected.description,
                      }));
                    } else {
                      setEditingMaterial((prev) => ({
                        ...prev!,
                        name: "",
                        type_code: "",
                        category: undefined,
                      }));
                    }
                  }}
                  className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 text-sm"
                >
                  <option value="">请选择材料</option>
                  {materialTypeCatalog
                    .filter((t) => t.status === "ACTIVE")
                    .map((t) => (
                      <option key={t.type_code} value={t.type_code}>
                        {t.type_name}（{t.type_code}）
                      </option>
                    ))}
                </select>
              )}
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                转人工置信度阈值（%）
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={
                    editingMaterial?.confidenceThreshold != null
                      ? Math.round(editingMaterial.confidenceThreshold * 100)
                      : ""
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditingMaterial((prev) => ({
                      ...prev!,
                      confidenceThreshold:
                        val === "" ? undefined : Number(val) / 100,
                    }));
                  }}
                  placeholder="如：80"
                  className="w-32 h-9 px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 text-sm"
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
              <p className="text-xs text-gray-500">
                当 AI
                识别结果的置信度低于此值时，该材料将自动转人工复核。留空表示不启用此规则。
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <Textarea
              label="材料说明"
              value={editingMaterial?.description || ""}
              onChange={(e) =>
                setEditingMaterial((prev) => ({
                  ...prev!,
                  description: e.target.value,
                }))
              }
              placeholder="请输入材料说明"
              rows={3}
            />
            <FileUpload
              label="材料样例"
              id="sample-upload"
              value={editingMaterial?.sampleUrl}
              ossKey={editingMaterial?.ossKey}
              onChange={(url, ossKey) =>
                setEditingMaterial((prev) => ({
                  ...prev!,
                  sampleUrl: url,
                  ossKey: ossKey || prev?.ossKey,
                }))
              }
              accept="image/*"
              helpText="上传材料样例图片，支持 jpg, png, webp 等格式"
            />
          </div>

          <Textarea
            label="AI 审核 Prompt"
            value={editingMaterial?.aiAuditPrompt || ""}
            onChange={(e) =>
              setEditingMaterial((prev) => ({
                ...prev!,
                aiAuditPrompt: e.target.value,
              }))
            }
            placeholder="用于指示 AI 审核该材料的规则、要点和输出格式"
            rows={5}
          />
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Schema Builder
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  一棵字段树同时描述材料 schema
                  和可选事实映射。字段先跟材料走；需要进入规则层时，直接在字段上绑定标准事实。
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-white px-3 py-1 text-slate-600 ring-1 ring-slate-200">
                    字段 {(editingMaterial?.schemaFields || []).length} 个
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-slate-600 ring-1 ring-slate-200">
                    可选 schema 路径 {materialSchemaPaths.length} 个
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-slate-600 ring-1 ring-slate-200">
                    已绑定事实{" "}
                    {
                      collectFactBindingsFromFields(
                        (editingMaterial?.schemaFields as MaterialSchemaField[]) ||
                          [],
                      ).length
                    }{" "}
                    个
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={importSchemaToMaterialFields}
                className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100"
              >
                从现有 Schema 导入材料字段
              </button>
            </div>
            <div className="mt-4 rounded-xl border border-gray-200 bg-white px-3 py-3 text-xs leading-5 text-slate-500">
              现在只维护一棵 schema
              字段树。材料提取、材料校验和标准事实透传都基于这些字段；若某个字段需要进入规则层，直接在字段上绑定
              `fact_id` 即可。
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_360px]">
            <div className="space-y-3 rounded-md border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    递归字段编辑器
                  </label>
                  <p className="mt-1 text-xs text-gray-500">
                    每个字段先属于材料
                    schema；需要进入规则层时，再给字段补一个可选的标准事实绑定。对象字段可继续新增子字段，数组字段可继续维护数组项字段。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setEditingMaterial((prev) => ({
                      ...prev!,
                      schemaFields: [
                        ...((prev?.schemaFields as MaterialSchemaField[]) ||
                          []),
                        createEmptyMaterialSchemaField(
                          ((prev?.schemaFields as MaterialSchemaField[]) || [])
                            .length + 1,
                        ),
                      ],
                    }))
                  }
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  新增字段
                </button>
              </div>
              <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-500">
                示例：先新增 `parties`，类型选 `ARRAY`；再在数组项里新增 `name /
                vehicle_info / responsibility`。如果 `responsibility`
                需要进入规则层，直接在该字段上绑定标准事实即可。
              </div>
              {((editingMaterial?.schemaFields as MaterialSchemaField[]) || [])
                .length === 0 ? (
                <div className="rounded-md bg-slate-50 px-3 py-4 text-sm text-slate-500">
                  当前还没有字段。先新增 schema 字段，再决定是否绑定到标准事实。
                </div>
              ) : (
                <MaterialSchemaFieldListEditor
                  fields={
                    (editingMaterial?.schemaFields as MaterialSchemaField[]) ||
                    []
                  }
                  onChange={(fields) =>
                    setEditingMaterial((prev) => ({
                      ...prev!,
                      schemaFields: fields,
                    }))
                  }
                  factCatalog={factCatalog}
                  material={editingMaterial}
                />
              )}
            </div>
            <div className="space-y-4">
              <div className="rounded-md border border-gray-200 bg-white p-4">
                <div className="text-sm font-medium text-slate-700">
                  当前 schema 路径
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  材料校验规则和标准事实透传都直接复用这些字段路径，不再维护第二套字段表。
                </p>
                <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                  {materialSchemaPaths.length > 0 ? (
                    materialSchemaPaths.map((pathOption) => {
                      const pathBinding = collectFactBindingsFromFields(
                        (editingMaterial?.schemaFields as MaterialSchemaField[]) ||
                          [],
                      ).find(
                        (binding) => binding.field_key === pathOption.path,
                      );
                      const fact = factCatalog.find(
                        (item) => item.fact_id === pathBinding?.fact_id,
                      );
                      return (
                        <div
                          key={pathOption.path}
                          className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                        >
                          <div className="text-sm font-medium text-slate-800">
                            {pathOption.path}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {pathOption.label} · {pathOption.type}
                          </div>
                          {fact && (
                            <div className="mt-2 inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-brand-blue-700 ring-1 ring-brand-blue-100">
                              映射到 {fact.label}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-md bg-slate-50 px-3 py-4 text-sm text-slate-500">
                      还没有 schema
                      路径。先在左侧新增字段，路径会实时出现在这里。
                    </div>
                  )}
                </div>
              </div>
              <div className="rounded-md border border-gray-200 bg-white p-4">
                <div className="mb-2 text-sm font-medium text-slate-700">
                  JSON Schema 预览
                </div>
                <textarea
                  className="h-64 w-full rounded-md border border-gray-200 bg-slate-50 px-3 py-2 font-mono text-sm"
                  value={buildSchemaFromFields(
                    (editingMaterial?.schemaFields as MaterialSchemaField[]) ||
                      [],
                  )}
                  readOnly
                />
                <p className="mt-2 text-xs text-slate-500">
                  这里是结构化字段树自动生成的 schema 结果，不再建议直接手写。
                </p>
              </div>
            </div>
          </div>

          {editorValidationErrors.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm font-semibold text-amber-800">
                保存前校验
              </div>
              <ul className="mt-2 space-y-1 text-sm text-amber-700">
                {editorValidationErrors.map((error) => (
                  <li key={error}>- {error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Modal>

      {/* Sample Image Preview Modal */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 text-2xl font-bold"
            >
              ✕
            </button>
            <img
              src={previewImageUrl}
              alt="材料样例"
              className="w-full h-full object-contain rounded-lg"
              onError={() => {
                alert("图片加载失败");
                setPreviewImageUrl(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ClaimItemConfigPage;
