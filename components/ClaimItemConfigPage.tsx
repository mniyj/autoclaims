import React, { useState, useMemo, useEffect } from "react";
import {
  type ClaimItem,
  type ClaimsMaterial,
  type ProductClaimConfig,
  type ResponsibilityClaimConfig,
  type ResponsibilityItem,
  type InsuranceProduct,
  type CategoryMaterialConfig,
  type AccidentCauseMaterialConfig,
  type Clause,
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

const ClaimItemConfigPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    "materials" | "items" | "category_materials" | "accident_causes"
  >("materials");
  const [claimItems, setClaimItems] = useState<ClaimItem[]>([]);
  const [materials, setMaterials] = useState<ClaimsMaterial[]>([]);
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

  // Sample preview state
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          itemsData,
          materialsData,
          configsData,
          productsData,
          clausesData,
          respData,
          catMatData,
          accidentCauseData,
        ] = await Promise.all([
          api.claimItems.list(),
          api.claimsMaterials.list(),
          api.productClaimConfigs.list(),
          api.products.list(),
          api.clauses.list(),
          api.responsibilities.list(),
          api.categoryMaterialConfigs.list(),
          api.accidentCauseConfigs.list(),
        ]);
        setClaimItems(itemsData as ClaimItem[]);
        if (!materialsData || materialsData.length === 0) {
          await api.claimsMaterials.saveAll(MOCK_CLAIMS_MATERIALS);
          setMaterials(MOCK_CLAIMS_MATERIALS);
        } else {
          setMaterials(materialsData as ClaimsMaterial[]);
        }
        setProductConfigs(configsData as ProductClaimConfig[]);
        setProducts(productsData as InsuranceProduct[]);
        setClauses(clausesData as Clause[]);
        setResponsibilities(respData as ResponsibilityItem[]);
        setCategoryMaterialConfigs(catMatData as CategoryMaterialConfig[]);
        setAccidentCauseConfigs(
          (accidentCauseData as AccidentCauseMaterialConfig[]) || [],
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
    setIsItemModalOpen(true);
  };

  const handleEditItem = (item: ClaimItem) => {
    setEditingItem({
      ...item,
      responsibilityIds: item.responsibilityIds || [],
    });
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

  const handleAddMaterial = () => {
    setEditingMaterial({
      id: `mat-${Date.now()}`,
      name: "",
      description: "",
      sampleUrl: "",
      jsonSchema: '{\n  "type": "object",\n  "properties": {}\n}',
      aiAuditPrompt: "",
    });
    setIsMaterialModalOpen(true);
  };

  const handleEditMaterial = (material: ClaimsMaterial) => {
    setEditingMaterial({ ...material });
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
      alert("请输入材料名称");
      return;
    }
    try {
      JSON.parse(editingMaterial.jsonSchema || "{}");
    } catch (e) {
      alert("JSON Schema 格式错误");
      return;
    }
    let newMaterials = [...materials];
    if (materials.find((m) => m.id === editingMaterial.id)) {
      newMaterials = materials.map((m) =>
        m.id === editingMaterial.id ? (editingMaterial as ClaimsMaterial) : m,
      );
    } else {
      newMaterials = [...materials, editingMaterial as ClaimsMaterial];
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
        <div className="space-y-4">
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
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              关联责任
            </label>
            {(editingItem?.responsibilityIds || []).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {(editingItem?.responsibilityIds || []).map((id) => (
                  <span
                    key={id}
                    className="px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-700 border border-blue-100"
                  >
                    {responsibilities.find((resp) => resp.id === id)?.name ||
                      id}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">请选择要关联的责任</div>
            )}
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-gray-200 rounded-md bg-white">
              {responsibilities.map((resp) => (
                <label
                  key={resp.id}
                  className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={
                      editingItem?.responsibilityIds?.includes(resp.id) || false
                    }
                    onChange={() => toggleResponsibilityForItem(resp.id)}
                    className="rounded border-gray-300 text-brand-blue-600 focus:ring-brand-blue-500"
                  />
                  <span className="text-sm text-gray-700">{resp.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              关联理赔材料
            </label>
            <div className="space-y-1 max-h-56 overflow-y-auto p-2 border border-gray-200 rounded-md">
              {materials.map((mat) => {
                const isChecked =
                  editingItem?.materialIds?.includes(mat.id) || false;
                const isRequired =
                  editingItem?.materialRequiredMap?.[mat.id] || false;
                return (
                  <div
                    key={mat.id}
                    className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded transition-colors ${isChecked ? "bg-brand-blue-50" : "hover:bg-gray-50"}`}
                  >
                    <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleMaterial(mat.id)}
                        className="rounded border-gray-300 text-brand-blue-600 focus:ring-brand-blue-500 flex-shrink-0"
                      />
                      <span className="text-sm text-gray-700 truncate">
                        {mat.name}
                      </span>
                    </label>
                    {isChecked && (
                      <label className="flex items-center gap-1 cursor-pointer flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={isRequired}
                          onChange={() => toggleMaterialRequired(mat.id)}
                          className="rounded border-gray-300 text-red-500 focus:ring-red-400"
                        />
                        <span className="text-xs text-red-500 font-medium whitespace-nowrap">
                          必传
                        </span>
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
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
              setEditingMaterial((prev) => ({ ...prev!, name: e.target.value }))
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

export default ClaimItemConfigPage;
