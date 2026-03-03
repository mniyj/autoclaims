import React, { useState, useMemo, useEffect } from "react";
import { MOCK_CLAIMS_MATERIALS } from "../constants";
import { type ClaimsMaterial } from "../types";
import Pagination from "./ui/Pagination";
import Modal from "./ui/Modal";
import Input from "./ui/Input";
import Textarea from "./ui/Textarea";
import FileUpload from "./ui/FileUpload";
import { api } from "../services/api";
import { getSignedUrl } from "../services/ossService";

const ClaimsMaterialManagementPage: React.FC = () => {
  const [materials, setMaterials] = useState<ClaimsMaterial[]>([]);
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
        const data = await api.claimsMaterials.list();
        if (data && data.length > 0) {
          setMaterials(data);
        } else {
          // Auto-seed: persist MOCK data on first load
          await api.claimsMaterials.saveAll(MOCK_CLAIMS_MATERIALS);
          setMaterials(MOCK_CLAIMS_MATERIALS);
        }
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
    });
    setIsModalOpen(true);
  };

  const handleEdit = (material: ClaimsMaterial) => {
    setEditingMaterial({ ...material });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
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

  const handleSave = async () => {
    if (!editingMaterial?.name) {
      alert("请输入材料名称");
      return;
    }

    try {
      JSON.parse(editingMaterial.jsonSchema || "{}");
    } catch (e) {
      alert("JSON Schema 格式错误");
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
      alert("保存失败");
    }
  };

  return (
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
                {((editingMaterial?.confidenceThreshold ?? 0.9) * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-xs text-gray-500">
              当 AI 识别结果的置信度低于此阈值时，该材料将自动转人工复核。默认值：0.9 (90%)
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
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              JSON Schema
            </label>
            <textarea
              className="w-full h-48 px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 text-sm font-mono"
              value={editingMaterial?.jsonSchema || ""}
              onChange={(e) =>
                setEditingMaterial((prev) => ({
                  ...prev!,
                  jsonSchema: e.target.value,
                }))
              }
              placeholder='{ "type": "object", ... }'
            />
            <p className="text-xs text-gray-500">
              用于 OCR 提取信息的 JSON Schema 结构
            </p>
          </div>
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

export default ClaimsMaterialManagementPage;
