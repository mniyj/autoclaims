import React, { useState, useMemo, useEffect } from 'react';
import { type ClaimItem, type ClaimsMaterial, type ProductClaimConfig, type ResponsibilityClaimConfig, type ResponsibilityItem, type InsuranceProduct } from '../types';
import Modal from './ui/Modal';
import Input from './ui/Input';
import Textarea from './ui/Textarea';
import Select from './ui/Select';
import { api } from '../services/api';

const ClaimItemConfigPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'items' | 'products'>('items');
  const [claimItems, setClaimItems] = useState<ClaimItem[]>([]);
  const [materials, setMaterials] = useState<ClaimsMaterial[]>([]);
  const [productConfigs, setProductConfigs] = useState<ProductClaimConfig[]>([]);
  const [products, setProducts] = useState<InsuranceProduct[]>([]);
  const [responsibilities, setResponsibilities] = useState<ResponsibilityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [itemsData, materialsData, configsData, productsData, respData] = await Promise.all([
          api.claimItems.list(),
          api.claimsMaterials.list(),
          api.productClaimConfigs.list(),
          api.products.list(),
          api.responsibilities.list(),
        ]);
        setClaimItems(itemsData as ClaimItem[]);
        setMaterials(materialsData as ClaimsMaterial[]);
        setProductConfigs(configsData as ProductClaimConfig[]);
        setProducts(productsData as InsuranceProduct[]);
        setResponsibilities(respData as ResponsibilityItem[]);
      } catch (error) {
        console.error('Failed to fetch claim item config data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Modal states for Claim Item
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<ClaimItem> | null>(null);

  // Modal states for Product Config
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<Partial<ProductClaimConfig> | null>(null);
  const [selectedRespIds, setSelectedRespIds] = useState<string[]>([]);

  const handleAddItem = () => {
    setEditingItem({
      id: `item-${Date.now()}`,
      name: '',
      description: '',
      materialIds: [],
      responsibilityIds: []
    });
    setIsItemModalOpen(true);
  };

  const handleEditItem = (item: ClaimItem) => {
    setEditingItem({ ...item, responsibilityIds: item.responsibilityIds || [] });
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async () => {
    if (!editingItem?.name) return alert('请输入理赔项目名称');
    let newItems: ClaimItem[];
    if (claimItems.find(i => i.id === editingItem.id)) {
      newItems = claimItems.map(i => i.id === editingItem.id ? editingItem as ClaimItem : i);
    } else {
      newItems = [...claimItems, editingItem as ClaimItem];
    }
    try {
      await api.claimItems.saveAll(newItems);
      setClaimItems(newItems);
      setIsItemModalOpen(false);
    } catch (error) {
      console.error('Failed to save claim item:', error);
      alert('保存失败');
    }
  };

  const toggleMaterial = (matId: string) => {
    const currentIds = editingItem?.materialIds || [];
    if (currentIds.includes(matId)) {
      setEditingItem(prev => ({ ...prev!, materialIds: currentIds.filter(id => id !== matId) }));
    } else {
      setEditingItem(prev => ({ ...prev!, materialIds: [...currentIds, matId] }));
    }
  };

  const toggleResponsibilityForItem = (respId: string) => {
    setEditingItem(prev => {
      const currentIds = prev?.responsibilityIds || [];
      const nextIds = currentIds.includes(respId)
        ? currentIds.filter(id => id !== respId)
        : [...currentIds, respId];
      return { ...prev!, responsibilityIds: nextIds };
    });
  };

  const handleAddConfig = () => {
    setEditingConfig({
      productCode: '',
      responsibilityConfigs: []
    });
    setSelectedRespIds([]);
    setIsConfigModalOpen(true);
  };

  const handleAddRespToConfig = () => {
    if (!editingConfig?.productCode) return alert('请先选择产品');
    if (selectedRespIds.length === 0) return;
    const existingIds = new Set((editingConfig?.responsibilityConfigs || []).map(rc => rc.responsibilityId));
    const newRespConfigs: ResponsibilityClaimConfig[] = selectedRespIds
      .filter(id => !existingIds.has(id))
      .map(id => ({
        responsibilityId: id,
        claimItemIds: []
      }));
    if (newRespConfigs.length === 0) {
      return alert('所选责任已在配置中');
    }
    setEditingConfig(prev => ({
      ...prev!,
      responsibilityConfigs: [...(prev?.responsibilityConfigs || []), ...newRespConfigs]
    }));
    setSelectedRespIds([]);
  };

  const toggleClaimItemForResp = (respId: string, itemId: string) => {
    setEditingConfig(prev => ({
      ...prev!,
      responsibilityConfigs: prev?.responsibilityConfigs?.map(rc => {
        if (rc.responsibilityId === respId) {
          const newItemIds = rc.claimItemIds.includes(itemId)
            ? rc.claimItemIds.filter(id => id !== itemId)
            : [...rc.claimItemIds, itemId];
          return { ...rc, claimItemIds: newItemIds };
        }
        return rc;
      }) || []
    }));
  };

  const handleSaveConfig = async () => {
    if (!editingConfig?.productCode) return alert('请选择产品');
    let newConfigs: ProductClaimConfig[];
    const existingIndex = productConfigs.findIndex(c => c.productCode === editingConfig.productCode);
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
      console.error('Failed to save product config:', error);
      alert('保存失败');
    }
  };

  const selectedProduct = useMemo(() => {
    if (!editingConfig?.productCode) return null;
    return products.find(p => p.productCode === editingConfig.productCode) || null;
  }, [editingConfig?.productCode, products]);

  const filteredResponsibilities = useMemo(() => {
    if (!selectedProduct) return [];
    return responsibilities.filter(r => r.category === selectedProduct.primaryCategory);
  }, [responsibilities, selectedProduct]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="text-gray-400 text-sm">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">理赔项目配置</h1>

      <div className="flex border-b border-gray-200">
        <button
          className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === 'items' ? 'text-brand-blue-600 border-b-2 border-brand-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('items')}
        >
          索赔项目定义
        </button>
        <button
          className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === 'products' ? 'text-brand-blue-600 border-b-2 border-brand-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('products')}
        >
          产品责任关联
        </button>
      </div>

      {activeTab === 'items' ? (
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
            {claimItems.map(item => (
              <div key={item.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold text-gray-900">{item.name}</h3>
                  <button onClick={() => handleEditItem(item)} className="text-brand-blue-600 text-sm hover:underline">编辑</button>
                </div>
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">{item.description}</p>
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">所需材料:</span>
                  <div className="flex flex-wrap gap-2">
                    {item.materialIds.map(mId => (
                      <span key={mId} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md border border-gray-200">
                        {materials.find(m => m.id === mId)?.name || '未知材料'}
                      </span>
                    ))}
                    {item.materialIds.length === 0 && <span className="text-xs text-gray-400 italic">未关联材料</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={handleAddConfig}
              className="px-4 py-2 bg-brand-blue-600 text-white text-sm font-medium rounded-lg hover:bg-brand-blue-700 transition-colors"
            >
              配置产品索赔
            </button>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">产品</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">责任与项目</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {productConfigs.length > 0 ? productConfigs.map(config => (
                  <tr key={config.productCode}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {products.find(p => p.productCode === config.productCode)?.regulatoryName || config.productCode}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div className="space-y-2">
                        {config.responsibilityConfigs.map(rc => (
                          <div key={rc.responsibilityId} className="flex items-center space-x-2">
                            <span className="font-medium text-gray-800">{responsibilities.find(r => r.id === rc.responsibilityId)?.name}:</span>
                            <div className="flex flex-wrap gap-1">
                              {rc.claimItemIds.map(itemId => (
                                <span key={itemId} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">
                                  {claimItems.find(i => i.id === itemId)?.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <button
                        onClick={() => {
                          setEditingConfig(config);
                          setSelectedRespIds([]);
                          setIsConfigModalOpen(true);
                        }}
                        className="text-brand-blue-600 hover:underline"
                      >
                        编辑
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-500">暂无产品索赔配置</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Claim Item Modal */}
      <Modal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        title="索赔项目配置"
        footer={
          <div className="flex justify-end space-x-3">
            <button onClick={() => setIsItemModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">取消</button>
            <button onClick={handleSaveItem} className="px-4 py-2 bg-brand-blue-600 text-white text-sm font-medium rounded-md hover:bg-brand-blue-700">保存</button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input label="项目名称" value={editingItem?.name || ''} onChange={e => setEditingItem(prev => ({ ...prev!, name: e.target.value }))} required />
          <Textarea label="项目说明" value={editingItem?.description || ''} onChange={e => setEditingItem(prev => ({ ...prev!, description: e.target.value }))} rows={2} />
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">关联责任</label>
            {(editingItem?.responsibilityIds || []).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {(editingItem?.responsibilityIds || []).map(id => (
                  <span key={id} className="px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                    {responsibilities.find(resp => resp.id === id)?.name || id}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">请选择要关联的责任</div>
            )}
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-gray-200 rounded-md bg-white">
              {responsibilities.map(resp => (
                <label key={resp.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingItem?.responsibilityIds?.includes(resp.id) || false}
                    onChange={() => toggleResponsibilityForItem(resp.id)}
                    className="rounded border-gray-300 text-brand-blue-600 focus:ring-brand-blue-500"
                  />
                  <span className="text-sm text-gray-700">{resp.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">关联理赔材料</label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-gray-200 rounded-md">
              {materials.map(mat => (
                <label key={mat.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingItem?.materialIds?.includes(mat.id) || false}
                    onChange={() => toggleMaterial(mat.id)}
                    className="rounded border-gray-300 text-brand-blue-600 focus:ring-brand-blue-500"
                  />
                  <span className="text-sm text-gray-700">{mat.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Product Config Modal */}
      <Modal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        title="产品索赔责任配置"
        width="max-w-4xl"
        footer={
          <div className="flex justify-end space-x-3">
            <button onClick={() => setIsConfigModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">取消</button>
            <button onClick={handleSaveConfig} className="px-4 py-2 bg-brand-blue-600 text-white text-sm font-medium rounded-md hover:bg-brand-blue-700">保存</button>
          </div>
        }
      >
        <div className="space-y-6">
          <Select
            id="claim-config-product"
            label="选择产品"
            value={editingConfig?.productCode || ''}
            onChange={(e) => {
              const value = e.target.value;
              setEditingConfig(prev => ({ ...prev!, productCode: value, responsibilityConfigs: [] }));
              setSelectedRespIds([]);
            }}
          >
            <option value="">请选择产品</option>
            {products.map(product => (
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
                    const values = Array.from(e.target.selectedOptions).map(option => (option as HTMLOptionElement).value).filter(Boolean);
                    setSelectedRespIds(values);
                  }}
                >
                  {filteredResponsibilities.map(resp => (
                    <option key={resp.id} value={resp.id}>
                      {resp.name}
                    </option>
                  ))}
                </Select>
              </div>
              <button
                onClick={handleAddRespToConfig}
                disabled={!editingConfig?.productCode || selectedRespIds.length === 0}
                className="h-10 px-4 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800"
              >
                添加
              </button>
            </div>

            <div className="space-y-4">
              {editingConfig?.responsibilityConfigs?.map(rc => (
                <div key={rc.responsibilityId} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold text-gray-900">{responsibilities.find(r => r.id === rc.responsibilityId)?.name}</h4>
                    <button
                        onClick={() => setEditingConfig(prev => ({ ...prev!, responsibilityConfigs: prev?.responsibilityConfigs?.filter(x => x.responsibilityId !== rc.responsibilityId) || [] }))}
                        className="text-red-600 text-xs hover:underline"
                    >
                        移除责任
                    </button>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-500 uppercase">配置索赔项目:</p>
                    <div className="flex flex-wrap gap-3">
                      {claimItems.map(item => (
                        <label key={item.id} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rc.claimItemIds.includes(item.id)}
                            onChange={() => toggleClaimItemForResp(rc.responsibilityId, item.id)}
                            className="rounded border-gray-300 text-brand-blue-600 focus:ring-brand-blue-500"
                          />
                          <span className="text-sm text-gray-700">{item.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {(!editingConfig?.responsibilityConfigs || editingConfig.responsibilityConfigs.length === 0) && (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  尚未添加任何责任配置
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ClaimItemConfigPage;
