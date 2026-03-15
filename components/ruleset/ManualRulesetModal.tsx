import React, { useEffect, useMemo, useState } from "react";
import type {
  ClaimItem,
  ClaimsMaterial,
  FactCatalogField,
  InsuranceProduct,
  InsuranceRuleset,
  ProductClaimConfig,
  ResponsibilityItem,
} from "../../types";
import Modal from "../ui/Modal";
import { createManualRulesetDraft } from "./workbenchUtils";

interface ManualRulesetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (ruleset: InsuranceRuleset) => void;
  products: InsuranceProduct[];
  productClaimConfigs: ProductClaimConfig[];
  responsibilities: ResponsibilityItem[];
  claimItems: ClaimItem[];
  claimsMaterials: ClaimsMaterial[];
  factCatalog: FactCatalogField[];
  existingRulesets: InsuranceRuleset[];
}

const ManualRulesetModal: React.FC<ManualRulesetModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  products,
  productClaimConfigs,
  responsibilities,
  claimItems,
  claimsMaterials,
  factCatalog,
  existingRulesets,
}) => {
  const [selectedProductCode, setSelectedProductCode] = useState("");
  const [customName, setCustomName] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setSelectedProductCode("");
      setCustomName("");
    }
  }, [isOpen]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.productCode === selectedProductCode) || null,
    [products, selectedProductCode],
  );

  const selectedConfig = useMemo(
    () => productClaimConfigs.find((config) => config.productCode === selectedProductCode) || null,
    [productClaimConfigs, selectedProductCode],
  );

  const coveragePreview = useMemo(() => {
    if (!selectedConfig) return [];
    return selectedConfig.responsibilityConfigs.map((config) => {
      const responsibility = responsibilities.find((item) => item.id === config.responsibilityId);
      const relatedItems = config.claimItemIds
        .map((itemId) => claimItems.find((item) => item.id === itemId)?.name)
        .filter(Boolean);
      return {
        code: responsibility?.code || config.responsibilityId,
        name: responsibility?.name || config.responsibilityId,
        items: relatedItems,
      };
    });
  }, [selectedConfig, responsibilities, claimItems]);

  const handleCreate = () => {
    if (!selectedProduct) {
      alert("请先选择产品");
      return;
    }

    const draft = createManualRulesetDraft({
      product: selectedProduct,
      productConfig: selectedConfig,
      responsibilities,
      claimItems,
      claimsMaterials,
      factCatalog,
      existingRulesets,
      rulesetName: customName,
    });
    onCreate(draft);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="手工创建规则集"
      width="max-w-4xl"
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={handleCreate}
            className="ml-3 rounded-md bg-brand-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-700"
          >
            生成规则集草稿
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">关联产品</label>
            <select
              value={selectedProductCode}
              onChange={(event) => setSelectedProductCode(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">请选择产品</option>
              {products.map((product) => (
                <option key={product.productCode} value={product.productCode}>
                  {product.productCode} · {product.marketingName || product.regulatoryName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">规则集名称</label>
            <input
              type="text"
              value={customName}
              onChange={(event) => setCustomName(event.target.value)}
              placeholder="默认使用产品名称"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {selectedProduct ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-gray-900">自动带出信息</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <InfoRow label="产品编码" value={selectedProduct.productCode} />
                <InfoRow label="产品名称" value={selectedProduct.marketingName || selectedProduct.regulatoryName} />
                <InfoRow label="保险公司" value={selectedProduct.companyName} />
                <InfoRow label="保障区间" value={`${selectedProduct.effectiveDate} 至 ${selectedProduct.discontinuationDate}`} />
                <InfoRow label="险种分类" value={`${selectedProduct.primaryCategory} / ${selectedProduct.secondaryCategory || "未细分"}`} />
                <InfoRow label="已关联责任" value={String(coveragePreview.length)} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-gray-900">责任代码预览</h3>
                <div className="mt-3 space-y-2">
                  {coveragePreview.length > 0 ? (
                    coveragePreview.map((coverage) => (
                      <div key={coverage.code} className="rounded-lg bg-slate-50 px-3 py-2">
                        <div className="text-sm font-medium text-slate-900">{coverage.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{coverage.code}</div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">
                      当前产品未配置责任项，将从产品保障描述生成默认责任代码。
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-gray-900">关联索赔项预览</h3>
                <div className="mt-3 space-y-2">
                  {coveragePreview.some((coverage) => coverage.items.length > 0) ? (
                    coveragePreview.map((coverage) => (
                      <div key={`${coverage.code}-items`} className="rounded-lg bg-slate-50 px-3 py-2">
                        <div className="text-xs font-medium text-slate-500">{coverage.name}</div>
                        <div className="mt-1 text-sm text-slate-900">
                          {coverage.items.length > 0 ? coverage.items.join("、") : "暂未关联索赔项"}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">当前产品暂无索赔项配置，后续可在规则详情页继续补充。</p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
              系统会自动生成一套草稿规则集，包含产品信息、责任代码、基础字段字典、执行管道，以及 3 条可编辑的占位规则：保障期间校验、责任触发规则、费用项比例规则。
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
            先选择一个产品，再从产品和理赔配置自动带出规则集基础信息。
          </div>
        )}
      </div>
    </Modal>
  );
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-lg bg-white px-3 py-3 shadow-sm">
    <div className="text-xs text-slate-500">{label}</div>
    <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
  </div>
);

export default ManualRulesetModal;
