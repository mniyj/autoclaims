import React, { useState, useMemo, useEffect } from "react";
import { MOCK_CLAIMS_MATERIALS } from "../constants";
import { type ClaimsMaterial, type FactCatalogField } from "../types";
import Pagination from "./ui/Pagination";
import Modal from "./ui/Modal";
import Input from "./ui/Input";
import Textarea from "./ui/Textarea";
import FileUpload from "./ui/FileUpload";
import { api } from "../services/api";
import { getSignedUrl } from "../services/ossService";
import { useDialog } from "./ui/Dialog";

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
      return {
        ...field,
        children: [...(field.children || []), nextField],
      };
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
      const arrayPath = `${path}[]`;
      paths.push(
        ...collectMaterialSchemaPaths(field.item_fields || [], arrayPath),
      );
    }
  });

  return paths;
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

const ClaimsMaterialManagementPage: React.FC = () => {
  const { dialogNode, showAlert, showConfirm } = useDialog();
  const [materials, setMaterials] = useState<ClaimsMaterial[]>([]);
  const [factCatalog, setFactCatalog] = useState<FactCatalogField[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] =
    useState<Partial<ClaimsMaterial> | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Sample preview state
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        const [data, facts] = await Promise.all([
          api.claimsMaterials.list(),
          api.factCatalog.list(),
        ]);
        if (data && data.length > 0) {
          setMaterials(data);
        } else {
          // Auto-seed: persist MOCK data on first load
          await api.claimsMaterials.saveAll(MOCK_CLAIMS_MATERIALS);
          setMaterials(MOCK_CLAIMS_MATERIALS);
        }
        setFactCatalog(facts as FactCatalogField[]);
      } catch (error) {
        console.error("Failed to fetch claims materials:", error);
        setMaterials(MOCK_CLAIMS_MATERIALS);
      }
    };
    fetchMaterials();
  }, []);

  const filteredMaterials = useMemo(() => {
    if (!searchQuery) return materials;
    const lowerQuery = searchQuery.toLowerCase();
    return materials.filter(
      (m) =>
        m.name.toLowerCase().includes(lowerQuery) ||
        m.description.toLowerCase().includes(lowerQuery),
    );
  }, [materials, searchQuery]);

  const paginatedMaterials = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredMaterials.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredMaterials, currentPage]);

  const totalPages = Math.ceil(filteredMaterials.length / ITEMS_PER_PAGE);

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

  const handleAdd = () => {
    setEditingMaterial({
      id: `mat-${Date.now()}`,
      name: "",
      description: "",
      sampleUrl: "",
      ossKey: "",
      jsonSchema: '{\n  "type": "object",\n  "properties": {}\n}',
      aiAuditPrompt: "",
      confidenceThreshold: 0.9, // 默认值
      schemaFields: [],
    });
    setIsModalOpen(true);
  };

  const handleEdit = (material: ClaimsMaterial) => {
    setEditingMaterial({
      ...material,
      schemaFields: hydrateSchemaFields(material),
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await showConfirm(
      "确定要删除这个理赔材料吗？",
      "删除后无法恢复。",
      { variant: "danger", confirmText: "删除" },
    );
    if (confirmed) {
      const newMaterials = materials.filter((m) => m.id !== id);
      try {
        await api.claimsMaterials.saveAll(newMaterials);
        setMaterials(newMaterials);
      } catch (error) {
        console.error("Failed to delete material:", error);
        await showAlert("删除失败", undefined, { variant: "error" });
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
          void showAlert("样例图片不存在或已被删除", "请重新上传样例图片", {
            variant: "warning",
          });
        };
        testImg.src = url;
      } else {
        await showAlert("暂无样例图片", undefined, { variant: "info" });
      }
    } catch (error) {
      console.error("Failed to get signed URL:", error);
      await showAlert("样例图片不存在或已被删除", "请重新上传样例图片", {
        variant: "warning",
      });
    }
  };

  const handleSave = async () => {
    if (!editingMaterial?.name) {
      await showAlert("请输入材料名称", undefined, { variant: "warning" });
      return;
    }
    if (editorValidationErrors.length > 0) {
      await showAlert("字段配置有误", editorValidationErrors[0], {
        variant: "warning",
      });
      return;
    }

    // 置信度边界验证和默认值
    let confidence = editingMaterial.confidenceThreshold;
    if (confidence === undefined || confidence === null || isNaN(confidence)) {
      confidence = 0.9;
    } else {
      confidence = Math.max(0, Math.min(1, confidence));
    }

    const materialToSave: ClaimsMaterial = {
      ...editingMaterial,
      schemaFields:
        (editingMaterial.schemaFields as MaterialSchemaField[]) || [],
      jsonSchema: buildSchemaFromFields(
        (editingMaterial.schemaFields as MaterialSchemaField[]) || [],
      ),
      confidenceThreshold: confidence,
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
      setIsModalOpen(false);
      setEditingMaterial(null);
    } catch (error) {
      console.error("Failed to save material:", error);
      const msg = error instanceof Error ? error.message : String(error);
      await showAlert("保存失败", msg, { variant: "error" });
    }
  };

  const importSchemaToMaterialFields = () => {
    if (!editingMaterial?.jsonSchema) return;
    try {
      const parsed = JSON.parse(editingMaterial.jsonSchema) as {
        properties?: Record<
          string,
          { type?: string; description?: string; format?: string }
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
      void showAlert(
        "JSON Schema 格式有误",
        "当前 JSON Schema 不是合法 JSON，无法导入材料字段。",
        { variant: "error" },
      );
    }
  };

  return (
    <>
      {dialogNode}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-slate-900">理赔材料管理</h1>
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-brand-blue-600 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-brand-blue-700 transition-colors"
          >
            新增材料
          </button>
        </div>

        {/* Search Module */}
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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索材料名称或说明"
                className="flex-1 h-9 px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 text-sm"
              />
              <button
                onClick={() => setSearchQuery("")}
                className="h-9 px-4 bg-gray-100 text-gray-600 text-sm font-medium rounded-md hover:bg-gray-200 transition"
              >
                重置
              </button>
            </div>
          </div>
        </div>

        {/* Table Module */}
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
                        {material.confidenceThreshold !== undefined ? (
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
                          onClick={() => handleEdit(material)}
                          className="text-brand-blue-600 hover:text-brand-blue-900 bg-brand-blue-50 hover:bg-brand-blue-100 px-3 py-1 rounded-md transition-colors"
                        >
                          修改
                        </button>
                        <button
                          onClick={() => handleDelete(material.id)}
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
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filteredMaterials.length}
              itemsPerPage={ITEMS_PER_PAGE}
            />
          </div>
        </div>

        {/* Edit Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={
            editingMaterial?.id?.startsWith("mat-") &&
            !materials.find((m) => m.id === editingMaterial.id)
              ? "新增理赔材料"
              : "修改理赔材料"
          }
          footer={
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={editorValidationErrors.length > 0}
                className="px-4 py-2 bg-brand-blue-600 text-white text-sm font-medium rounded-md hover:bg-brand-blue-700"
              >
                保存
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <Input
              label="材料名称"
              value={editingMaterial?.name || ""}
              onChange={(e) =>
                setEditingMaterial((prev) => ({
                  ...prev!,
                  name: e.target.value,
                }))
              }
              placeholder="请输入材料名称"
              required
            />
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
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                转人工置信度阈值
              </label>
              <div className="flex items-center space-x-4">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={editingMaterial?.confidenceThreshold ?? 0.9}
                  onChange={(e) =>
                    setEditingMaterial((prev) => ({
                      ...prev!,
                      confidenceThreshold: parseFloat(e.target.value),
                    }))
                  }
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-blue-600"
                />
                <span className="w-16 text-right text-sm font-medium text-gray-700">
                  {(
                    (editingMaterial?.confidenceThreshold ?? 0.9) * 100
                  ).toFixed(0)}
                  %
                </span>
              </div>
              <p className="text-xs text-gray-500">
                当 AI
                识别结果的置信度低于此阈值时，该材料将自动转人工复核。默认值：0.9
                (90%)
              </p>
            </div>
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
              rows={8}
            />
            <div className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
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
                            (
                              (prev?.schemaFields as MaterialSchemaField[]) ||
                              []
                            ).length + 1,
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
                  示例：先新增 `parties`，类型选 `ARRAY`；再在数组项里新增 `name
                  / vehicle_info / responsibility`。如果 `responsibility`
                  需要进入规则层，直接在该字段上绑定标准事实即可。
                </div>
                {(
                  (editingMaterial?.schemaFields as MaterialSchemaField[]) || []
                ).length === 0 ? (
                  <div className="rounded-md bg-slate-50 px-3 py-4 text-sm text-slate-500">
                    当前还没有字段。先新增 schema
                    字段，再决定是否绑定到标准事实。
                  </div>
                ) : (
                  <div className="space-y-3">
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
                  </div>
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
                  void showAlert("图片加载失败", undefined, {
                    variant: "error",
                  });
                  setPreviewImageUrl(null);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
};

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
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_0.9fr_0.9fr]">
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
              <div className="flex items-end justify-between gap-2">
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
                  必填
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

function parseSchemaFieldsFromNode(node: {
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
}): MaterialSchemaField[] {
  const requiredFields = new Set(node.required || []);
  return Object.entries(node.properties || {}).map(
    ([fieldKey, config], index) => {
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
                required: Array.isArray(
                  (config as { required?: string[] }).required,
                )
                  ? (config as { required?: string[] }).required
                  : [],
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
    },
  );
}

function buildSchemaFromFields(fields: MaterialSchemaField[] = []) {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  fields.forEach((field) => {
    if (!field.field_key?.trim()) return;
    properties[field.field_key.trim()] = buildMaterialSchemaField(field);
    if (field.required) required.push(field.field_key.trim());
  });

  return JSON.stringify(
    {
      type: "object",
      properties,
      required,
    },
    null,
    2,
  );
}

function buildMaterialSchemaField(
  field: MaterialSchemaField,
): Record<string, unknown> {
  if (field.data_type === "OBJECT") {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    (field.children || []).forEach((child) => {
      if (!child.field_key?.trim()) return;
      properties[child.field_key.trim()] = buildMaterialSchemaField(child);
      if (child.required) required.push(child.field_key.trim());
    });
    return {
      type: "object",
      description: field.description || field.field_label || field.field_key,
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }

  if (field.data_type === "ARRAY") {
    const itemProperties: Record<string, unknown> = {};
    const itemRequired: string[] = [];
    (field.item_fields || []).forEach((child) => {
      if (!child.field_key?.trim()) return;
      itemProperties[child.field_key.trim()] = buildMaterialSchemaField(child);
      if (child.required) itemRequired.push(child.field_key.trim());
    });
    return {
      type: "array",
      description: field.description || field.field_label || field.field_key,
      items: {
        type: "object",
        properties: itemProperties,
        ...(itemRequired.length > 0 ? { required: itemRequired } : {}),
      },
    };
  }

  return {
    type: toJsonSchemaType(field.data_type),
    description: field.description || field.field_label || field.field_key,
  };
}

function toJsonSchemaType(dataType: string) {
  switch (dataType) {
    case "NUMBER":
      return "number";
    case "BOOLEAN":
      return "boolean";
    case "ARRAY":
      return "array";
    default:
      return "string";
  }
}

function fromJsonSchemaType(type?: string, format?: string) {
  if (format === "date") return "DATE";
  switch ((type || "string").toLowerCase()) {
    case "number":
    case "integer":
      return "NUMBER";
    case "boolean":
      return "BOOLEAN";
    case "array":
      return "ARRAY";
    case "object":
      return "OBJECT";
    default:
      return "STRING";
  }
}

export default ClaimsMaterialManagementPage;
