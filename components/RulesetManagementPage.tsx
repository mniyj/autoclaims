import React, { useState, useEffect } from 'react';
import { type ClaimItem, type ClaimsMaterial, type FactCatalogField, type InsuranceProduct, type InsuranceRuleset, type ProductClaimConfig, type ResponsibilityItem } from '../types';
import RulesetListView from './ruleset/RulesetListView';
import RulesetDetailView from './ruleset/RulesetDetailView';
import ImportRulesetModal from './ruleset/ImportRulesetModal';
import RulesetValidationWorkspace from './ruleset/RulesetValidationWorkspace';
import ManualRulesetModal from './ruleset/ManualRulesetModal';
import { api } from '../services/api';
import { createRuleDraft, duplicateRuleset, normalizeRulesetStructure, publishRuleset, validateRuleset } from './ruleset/workbenchUtils';

type DetailNavigationContext = {
  coverageCode?: string;
};

const getPreferredRulesetForProduct = (
  rulesets: InsuranceRuleset[],
  productCode: string,
) => {
  const productRulesets = rulesets.filter(
    (ruleset) => ruleset.policy_info.product_code === productCode,
  );
  if (productRulesets.length === 0) return null;

  const sortByLatestVersion = (a: InsuranceRuleset, b: InsuranceRuleset) =>
    (Number(b.metadata?.version) || 0) - (Number(a.metadata?.version) || 0);

  const publishedRulesets = productRulesets
    .filter((ruleset) => Boolean(ruleset.metadata?.published_at))
    .sort(sortByLatestVersion);

  if (publishedRulesets.length > 0) {
    return publishedRulesets[0];
  }

  return [...productRulesets].sort(sortByLatestVersion)[0];
};

const RulesetManagementPage: React.FC = () => {
  const [rulesets, setRulesets] = useState<InsuranceRuleset[]>([]);
  const [products, setProducts] = useState<InsuranceProduct[]>([]);
  const [productClaimConfigs, setProductClaimConfigs] = useState<ProductClaimConfig[]>([]);
  const [responsibilities, setResponsibilities] = useState<ResponsibilityItem[]>([]);
  const [claimItems, setClaimItems] = useState<ClaimItem[]>([]);
  const [claimsMaterials, setClaimsMaterials] = useState<ClaimsMaterial[]>([]);
  const [factCatalog, setFactCatalog] = useState<FactCatalogField[]>([]);
  const [currentView, setCurrentView] = useState<'list' | 'detail' | 'validation'>('list');
  const [selectedRuleset, setSelectedRuleset] = useState<InsuranceRuleset | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isManualCreateModalOpen, setIsManualCreateModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [presetSearchQuery, setPresetSearchQuery] = useState('');
  const [presetAutoOpenProductCode, setPresetAutoOpenProductCode] = useState('');
  const [detailNavigationContext, setDetailNavigationContext] = useState<DetailNavigationContext | null>(null);

  useEffect(() => {
    const preset = window.sessionStorage.getItem('ruleset_management_search');
    const focus = window.sessionStorage.getItem('ruleset_management_focus');
    if (preset) {
      setPresetSearchQuery(preset);
      setPresetAutoOpenProductCode(preset);
      window.sessionStorage.removeItem('ruleset_management_search');
    }
    if (focus) {
      try {
        setDetailNavigationContext(JSON.parse(focus) as DetailNavigationContext);
      } catch (error) {
        console.warn('Failed to parse ruleset focus context', error);
      } finally {
        window.sessionStorage.removeItem('ruleset_management_focus');
      }
    }
  }, []);

  useEffect(() => {
    if (loading || !presetAutoOpenProductCode || currentView !== 'list') return;
    const matched = getPreferredRulesetForProduct(rulesets, presetAutoOpenProductCode);
    if (!matched) return;

    setSelectedRuleset(matched);
    setCurrentView('detail');
    setPresetAutoOpenProductCode('');
  }, [loading, presetAutoOpenProductCode, rulesets, currentView]);

  useEffect(() => {
    const fetchRulesets = async () => {
      try {
        const [rulesetData, productData, configData, responsibilityData, claimItemData, claimsMaterialData, factCatalogData] = await Promise.all([
          api.rulesets.list(),
          api.products.list(),
          api.productClaimConfigs.list(),
          api.responsibilities.list(),
          api.claimItems.list(),
          api.claimsMaterials.list(),
          api.factCatalog.list(),
        ]);
        setFactCatalog(factCatalogData as FactCatalogField[]);
        const normalizedRulesets = (rulesetData as InsuranceRuleset[]).map((ruleset) =>
          normalizeRulesetStructure(ruleset, factCatalogData as FactCatalogField[]),
        );
        setRulesets(normalizedRulesets);
        const hasSemanticGap = normalizedRulesets.some((ruleset, index) =>
          JSON.stringify(ruleset.rules) !== JSON.stringify((rulesetData as InsuranceRuleset[])[index]?.rules),
        );
        if (hasSemanticGap) {
          void api.rulesets.saveAll(normalizedRulesets);
        }
        setProducts(productData as InsuranceProduct[]);
        setProductClaimConfigs(configData as ProductClaimConfig[]);
        setResponsibilities(responsibilityData as ResponsibilityItem[]);
        setClaimItems(claimItemData as ClaimItem[]);
        setClaimsMaterials(claimsMaterialData as ClaimsMaterial[]);
      } catch (error) {
        console.error('Failed to fetch rulesets:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRulesets();
  }, []);

  const handleSelectRuleset = (ruleset: InsuranceRuleset) => {
    setSelectedRuleset(ruleset);
    setDetailNavigationContext(null);
    setCurrentView('detail');
  };

  const handleOpenValidation = (ruleset: InsuranceRuleset) => {
    setSelectedRuleset(ruleset);
    setDetailNavigationContext(null);
    setCurrentView('validation');
  };

  const handleBack = () => {
    setCurrentView('list');
    setSelectedRuleset(null);
    setDetailNavigationContext(null);
  };

  const persistRulesets = async (nextRulesets: InsuranceRuleset[]) => {
    const synced = nextRulesets.map((ruleset) => normalizeRulesetStructure(ruleset, factCatalog));
    await api.rulesets.saveAll(synced);
    setRulesets(synced);
  };

  const handleImport = async (ruleset: InsuranceRuleset) => {
    // Check for duplicate ruleset_id
    const existing = rulesets.find(r => r.ruleset_id === ruleset.ruleset_id);
    let newRulesets: InsuranceRuleset[];
    if (existing) {
      if (!confirm(`规则集 ${ruleset.ruleset_id} 已存在，是否覆盖？`)) return;
      newRulesets = rulesets.map(r => r.ruleset_id === ruleset.ruleset_id ? ruleset : r);
    } else {
      newRulesets = [...rulesets, ruleset];
    }
    try {
      await persistRulesets(newRulesets);
    } catch (error) {
      console.error('Failed to import ruleset:', error);
      alert('导入失败');
    }
  };

  const handleExport = (ruleset: InsuranceRuleset) => {
    const json = JSON.stringify(ruleset, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ruleset.ruleset_id}_v${ruleset.metadata.version}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (rulesetId: string) => {
    const newRulesets = rulesets.filter(r => r.ruleset_id !== rulesetId);
    try {
      await persistRulesets(newRulesets);
    } catch (error) {
      console.error('Failed to delete ruleset:', error);
      alert('删除失败');
    }
  };

  const handleUpdateRuleset = async (updated: InsuranceRuleset) => {
    const newRulesets = rulesets.map(r => r.ruleset_id === updated.ruleset_id ? updated : r);
    try {
      await persistRulesets(newRulesets);
      setSelectedRuleset(updated);
    } catch (error) {
      console.error('Failed to update ruleset:', error);
      alert('更新失败');
    }
  };

  const handleDuplicate = async (ruleset: InsuranceRuleset) => {
    const duplicated = duplicateRuleset(ruleset);
    const newRulesets = [duplicated, ...rulesets];
    try {
      await persistRulesets(newRulesets);
    } catch (error) {
      console.error('Failed to duplicate ruleset:', error);
      alert('复制版本失败');
    }
  };

  const handleCreateManualRuleset = async (ruleset: InsuranceRuleset) => {
    const newRulesets = [ruleset, ...rulesets];
    try {
      await persistRulesets(newRulesets);
      setSelectedRuleset(ruleset);
      setCurrentView('detail');
    } catch (error) {
      console.error('Failed to create manual ruleset:', error);
      alert('创建规则集失败');
    }
  };

  const handlePublish = async (ruleset: InsuranceRuleset) => {
    const issues = validateRuleset(ruleset).filter(issue => issue.tone === 'error');
    if (issues.length > 0) {
      alert('当前规则集存在高优先级错误，需先修复后再发布。');
      return;
    }

    const published = publishRuleset(ruleset);
    await handleUpdateRuleset(published);
  };

  const getPreviousRuleset = (ruleset: InsuranceRuleset | null) => {
    if (!ruleset) return null;
    const sameProduct = rulesets
      .filter(item => item.policy_info.product_code === ruleset.policy_info.product_code && item.ruleset_id !== ruleset.ruleset_id)
      .sort((a, b) => Number(b.metadata.version) - Number(a.metadata.version));
    return sameProduct[0] || null;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="text-gray-400 text-sm">加载中...</div>
      </div>
    );
  }

  return (
    <div>
      {currentView === 'list' && (
        <RulesetListView
          rulesets={rulesets}
          initialSearchQuery={presetSearchQuery}
          onSelectRuleset={handleSelectRuleset}
          onImport={() => setIsImportModalOpen(true)}
          onManualCreate={() => setIsManualCreateModalOpen(true)}
          onExport={handleExport}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onValidate={handleOpenValidation}
          onPublish={handlePublish}
        />
      )}

      {currentView === 'detail' && selectedRuleset && (
        <RulesetDetailView
          ruleset={selectedRuleset}
          previousRuleset={getPreviousRuleset(selectedRuleset)}
          claimsMaterials={claimsMaterials}
          initialFocusCoverageCode={detailNavigationContext?.coverageCode}
          onBack={handleBack}
          onUpdateRuleset={handleUpdateRuleset}
          onOpenValidation={handleOpenValidation}
          onPublish={handlePublish}
          onCreateRule={(domain) => {
            if (!selectedRuleset) return;
            const coverageCodes = selectedRuleset.policy_info.coverages.map(item => item.coverage_code).slice(0, 1);
            const newRule = createRuleDraft({
              rule_id: `${selectedRuleset.policy_info.product_code}-${domain}-${Date.now()}`,
              rule_name: domain === 'ELIGIBILITY' ? '新责任规则' : domain === 'ASSESSMENT' ? '新定损规则' : '新后处理规则',
              execution: {
                domain,
                loop_over: domain === 'ASSESSMENT' ? 'claim.expense_items' : null,
                item_alias: domain === 'ASSESSMENT' ? 'expense_item' : null,
                item_action_on_reject: domain === 'ASSESSMENT' ? 'ZERO_AMOUNT' : null,
              },
              applies_to: { coverage_codes: coverageCodes },
            }, selectedRuleset.product_line);
            const updated = { ...selectedRuleset, rules: [...selectedRuleset.rules, newRule] };
            void handleUpdateRuleset(updated);
          }}
        />
      )}

      {currentView === 'validation' && selectedRuleset && (
        <RulesetValidationWorkspace
          ruleset={selectedRuleset}
          previousRuleset={getPreviousRuleset(selectedRuleset)}
          onBack={() => setCurrentView('detail')}
        />
      )}

      <ImportRulesetModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImport}
      />

      <ManualRulesetModal
        isOpen={isManualCreateModalOpen}
        onClose={() => setIsManualCreateModalOpen(false)}
        onCreate={(draftRuleset) => handleCreateManualRuleset(normalizeRulesetStructure(draftRuleset, factCatalog))}
        products={products}
        productClaimConfigs={productClaimConfigs}
        responsibilities={responsibilities}
        claimItems={claimItems}
        claimsMaterials={claimsMaterials}
        factCatalog={factCatalog}
        existingRulesets={rulesets}
      />
    </div>
  );
};

export default RulesetManagementPage;
