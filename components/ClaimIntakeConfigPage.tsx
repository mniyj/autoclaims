import React, { useEffect, useMemo, useState } from 'react';
import { type InsuranceProduct, type IntakeConfig, type ClaimItem, type ClaimsMaterial, type ProductClaimConfig, ProductStatus } from '../types';
import Modal from './ui/Modal';
import Select from './ui/Select';
import IntakeFieldConfigEditor from './product-form/IntakeFieldConfigEditor';
import { INTAKE_COMMON_PRESET } from '../constants';
import { api } from '../services/api';

interface ClaimIntakeConfigPageProps {
  products: InsuranceProduct[];
  operator?: string;
  onUpdateProducts: (products: InsuranceProduct[]) => void;
}

const DEFAULT_CONFIG: IntakeConfig = {
  fields: [],
  voice_input: { enabled: false, mode: 'realtime_or_record' },
  claimMaterials: { extraMaterialIds: [] },
};

const ClaimIntakeConfigPage: React.FC<ClaimIntakeConfigPageProps> = ({ products, operator, onUpdateProducts }) => {
  const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
  const [selectedProductCode, setSelectedProductCode] = useState('');
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<InsuranceProduct | null>(null);
  const [editingConfig, setEditingConfig] = useState<IntakeConfig>(DEFAULT_CONFIG);
  const [viewMode, setViewMode] = useState(false);
  const [configStep, setConfigStep] = useState<1 | 2>(1);
  const [claimItems, setClaimItems] = useState<ClaimItem[]>([]);
  const [materials, setMaterials] = useState<ClaimsMaterial[]>([]);
  const [productClaimConfigs, setProductClaimConfigs] = useState<ProductClaimConfig[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(true);

  const hasConfig = (config?: IntakeConfig) => !!config && (config.fields.length > 0 || config.voice_input?.enabled || (config.claimMaterials?.extraMaterialIds?.length || 0) > 0);

  useEffect(() => {
    const fetchMaterialsConfig = async () => {
      try {
        const [itemsData, materialsData, configsData] = await Promise.all([
          api.claimItems.list(),
          api.claimsMaterials.list(),
          api.productClaimConfigs.list(),
        ]);
        setClaimItems(itemsData as ClaimItem[]);
        setMaterials(materialsData as ClaimsMaterial[]);
        setProductClaimConfigs(configsData as ProductClaimConfig[]);
      } catch (error) {
        console.error('Failed to fetch claim materials config:', error);
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
    return nextConfig;
  };

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      const aConfigured = hasConfig(a.intakeConfig) ? 1 : 0;
      const bConfigured = hasConfig(b.intakeConfig) ? 1 : 0;
      if (aConfigured !== bConfigured) return bConfigured - aConfigured;
      return a.regulatoryName.localeCompare(b.regulatoryName);
    });
  }, [products]);

  const availableProducts = useMemo(() => {
    return products.filter(p => !hasConfig(p.intakeConfig));
  }, [products]);

  const StatusBadge: React.FC<{ status: ProductStatus }> = ({ status }) => {
    const statusMap = {
      [ProductStatus.ACTIVE]: { text: '生效', bg: 'bg-green-100', textColor: 'text-green-800' },
      [ProductStatus.INACTIVE]: { text: '失效', bg: 'bg-red-100', textColor: 'text-red-800' },
      [ProductStatus.DRAFT]: { text: '草稿', bg: 'bg-yellow-100', textColor: 'text-yellow-800' },
    };
    const { text, bg, textColor } = statusMap[status] || { text: '未知', bg: 'bg-gray-100', textColor: 'text-gray-800' };
    return (
      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${bg} ${textColor}`}>
        {text}
      </span>
    );
  };

  const ConfigBadge: React.FC<{ configured: boolean }> = ({ configured }) => {
    return (
      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${configured ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'}`}>
        {configured ? '已配置' : '未配置'}
      </span>
    );
  };

  const formatTime = (value?: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  const openSelectModal = () => {
    setSelectedProductCode('');
    setIsSelectModalOpen(true);
  };

  const openConfigModal = (product: InsuranceProduct, mode: 'view' | 'edit') => {
    setEditingProduct(product);
    setEditingConfig(normalizeConfig(product.intakeConfig));
    setViewMode(mode === 'view');
    setConfigStep(1);
    setIsConfigModalOpen(true);
  };

  const handleConfirmSelect = () => {
    const target = products.find(p => p.productCode === selectedProductCode);
    if (!target) return;
    setIsSelectModalOpen(false);
    openConfigModal(target, 'edit');
  };

  const handleSaveConfig = async () => {
    if (!editingProduct) return;
    const target = products.find(p => p.productCode === editingProduct.productCode);
    if (!target) return;
    const updatedAt = new Date().toISOString();
    const operatorName = operator || target.operator || '系统管理员';
    const updatedProducts = products.map(p => (
      p.productCode === target.productCode
        ? { ...target, intakeConfig: editingConfig, intakeConfigUpdatedAt: updatedAt, intakeConfigOperator: operatorName }
        : p
    ));
    try {
      await api.products.saveAll(updatedProducts);
      onUpdateProducts(updatedProducts);
      setIsConfigModalOpen(false);
    } catch (error) {
      console.error('Failed to save intake config:', error);
      alert('保存失败');
    }
  };

  const handleDeleteConfig = async (product: InsuranceProduct) => {
    if (!confirm(`确认删除 ${product.regulatoryName} 的报案信息配置吗？`)) return;
    const updatedProducts = products.map(p => (
      p.productCode === product.productCode
        ? { ...p, intakeConfig: undefined, intakeConfigUpdatedAt: undefined, intakeConfigOperator: undefined }
        : p
    ));
    try {
      await api.products.saveAll(updatedProducts);
      onUpdateProducts(updatedProducts);
    } catch (error) {
      console.error('Failed to delete intake config:', error);
      alert('删除失败');
    }
  };

  const handleLoadCommonPreset = () => {
    if (editingConfig.fields.length > 0) {
      if (!confirm('加载常用字段将覆盖当前配置的字段，是否继续？')) return;
    }
    setEditingConfig(prev => ({
      ...prev,
      fields: INTAKE_COMMON_PRESET.map(field => ({ ...field })),
    }));
  };

  const getAutoMaterialIds = (productCode?: string) => {
    if (!productCode) return [];
    const config = productClaimConfigs.find(item => item.productCode === productCode);
    if (!config) return [];
    const claimItemIds = new Set<string>();
    config.responsibilityConfigs.forEach(rc => {
      rc.claimItemIds.forEach(id => claimItemIds.add(id));
    });
    const materialIds = new Set<string>();
    claimItemIds.forEach(itemId => {
      const item = claimItems.find(claimItem => claimItem.id === itemId);
      item?.materialIds.forEach(materialId => materialIds.add(materialId));
    });
    return Array.from(materialIds);
  };

  const getMaterialName = (materialId: string) => {
    return materials.find(material => material.id === materialId)?.name || materialId;
  };

  const toggleExtraMaterial = (materialId: string) => {
    setEditingConfig(prev => {
      const current = prev.claimMaterials?.extraMaterialIds || [];
      const next = current.includes(materialId)
        ? current.filter(id => id !== materialId)
        : [...current, materialId];
      return { ...prev, claimMaterials: { extraMaterialIds: next } };
    });
  };

  const autoMaterialIds = useMemo(() => getAutoMaterialIds(editingProduct?.productCode), [editingProduct, productClaimConfigs, claimItems]);
  const extraMaterialIds = editingConfig.claimMaterials?.extraMaterialIds || [];
  const availableMaterials = useMemo(() => materials.filter(material => !autoMaterialIds.includes(material.id)), [materials, autoMaterialIds]);
  const combinedMaterialIds = useMemo(() => Array.from(new Set([...autoMaterialIds, ...extraMaterialIds])), [autoMaterialIds, extraMaterialIds]);

  const renderConfigSummary = (product?: InsuranceProduct, config?: IntakeConfig) => {
    const autoMaterialIds = getAutoMaterialIds(product?.productCode);
    const extraMaterialIds = config?.claimMaterials?.extraMaterialIds || [];
    const combinedMaterialIds = Array.from(new Set([...autoMaterialIds, ...extraMaterialIds]));
    if (!config || (config.fields.length === 0 && !config.voice_input?.enabled && combinedMaterialIds.length === 0)) {
      return <div className="text-sm text-gray-500">暂无配置</div>;
    }
    return (
      <div className="space-y-4">
        {config.fields.length > 0 ? (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">字段名称</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">类型</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">必填</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">占位提示</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {config.fields.map(field => (
                  <tr key={field.field_id}>
                    <td className="px-4 py-2 text-gray-700">{field.label}</td>
                    <td className="px-4 py-2 text-gray-600">{field.type}</td>
                    <td className="px-4 py-2 text-gray-600">{field.required ? '是' : '否'}</td>
                    <td className="px-4 py-2 text-gray-600">{field.placeholder || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-gray-500">未配置报案信息字段</div>
        )}
        <div className="text-sm text-gray-700">
          语音报案：{config.voice_input?.enabled ? '已启用' : '未启用'}
        </div>
        {config.voice_input?.enabled && (
          <div className="text-sm text-gray-600 whitespace-pre-wrap break-words bg-gray-50 border border-gray-200 rounded-md p-3">
            {config.voice_input.slot_filling_prompt || '未配置提示词'}
          </div>
        )}
        <div className="space-y-2">
          <div className="text-sm text-gray-500">理赔材料清单</div>
          {combinedMaterialIds.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {combinedMaterialIds.map(materialId => (
                <span key={materialId} className="px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                  {getMaterialName(materialId)}
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">报案信息及理赔材料配置</h1>
          <p className="text-sm text-gray-500 mt-1">管理不同产品的报案信息字段与理赔材料清单配置</p>
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
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">产品名</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">是否配置</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">配置时间</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">配置人员</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">状态</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedProducts.length > 0 ? (
              sortedProducts.map(product => {
                const configured = hasConfig(product.intakeConfig);
                return (
                  <tr key={product.productCode} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">{product.regulatoryName}</td>
                    <td className="px-6 py-4 text-sm"><ConfigBadge configured={configured} /></td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatTime(product.intakeConfigUpdatedAt)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{product.intakeConfigOperator || product.operator || '-'}</td>
                    <td className="px-6 py-4 text-sm"><StatusBadge status={product.status} /></td>
                    <td className="px-6 py-4 text-center text-sm font-medium space-x-3">
                      <button
                        onClick={() => openConfigModal(product, 'view')}
                        className={`hover:underline ${configured ? 'text-brand-blue-600' : 'text-gray-300 cursor-not-allowed'}`}
                        disabled={!configured}
                      >
                        查看
                      </button>
                      <button
                        onClick={() => openConfigModal(product, 'edit')}
                        className="text-brand-blue-600 hover:underline"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDeleteConfig(product)}
                        className={`hover:underline ${configured ? 'text-red-600' : 'text-gray-300 cursor-not-allowed'}`}
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
                <td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-500">暂无产品数据</td>
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
            {availableProducts.map(product => (
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
        title={viewMode ? '报案信息及理赔材料配置详情' : '报案信息及理赔材料配置'}
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
              <div className="text-base font-semibold text-gray-900">{editingProduct.regulatoryName}</div>
              <div className="text-xs text-gray-500 mt-1">{editingProduct.productCode}</div>
            </div>
            {viewMode ? (
              renderConfigSummary(editingProduct, editingProduct.intakeConfig)
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-3 text-sm">
                  <div className={`px-3 py-1 rounded-full ${configStep === 1 ? 'bg-brand-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>1 报案信息配置</div>
                  <div className="flex-1 h-px bg-gray-200"></div>
                  <div className={`px-3 py-1 rounded-full ${configStep === 2 ? 'bg-brand-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>2 理赔材料配置管理</div>
                </div>
                {configStep === 1 ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-500">报案信息配置</div>
                      <button
                        type="button"
                        onClick={handleLoadCommonPreset}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        一键加载常用字段
                      </button>
                    </div>
                    <IntakeFieldConfigEditor
                      config={editingConfig}
                      onChange={setEditingConfig}
                      productCategory={editingProduct.primaryCategory}
                    />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {materialsLoading ? (
                      <div className="text-sm text-gray-500">材料清单加载中...</div>
                    ) : (
                      <>
                        <div className="space-y-3">
                          <div className="text-sm text-gray-500">自动带出的索赔材料</div>
                          {autoMaterialIds.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {autoMaterialIds.map(materialId => (
                                <span key={materialId} className="px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                                  {getMaterialName(materialId)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500">暂无自动带出材料</div>
                          )}
                        </div>
                        <div className="space-y-3">
                          <div className="text-sm text-gray-500">可增加的通用材料</div>
                          {availableMaterials.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto p-2 border border-gray-200 rounded-md">
                              {availableMaterials.map(material => (
                                <label key={material.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={extraMaterialIds.includes(material.id)}
                                    onChange={() => toggleExtraMaterial(material.id)}
                                    className="rounded border-gray-300 text-brand-blue-600 focus:ring-brand-blue-500"
                                  />
                                  <span className="text-sm text-gray-700">{material.name}</span>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500">暂无可添加的通用材料</div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="text-sm text-gray-500">最终材料清单</div>
                          {combinedMaterialIds.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {combinedMaterialIds.map(materialId => (
                                <span key={materialId} className="px-2 py-1 text-xs rounded-full bg-green-50 text-green-700 border border-green-100">
                                  {getMaterialName(materialId)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500">暂无材料配置</div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
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
