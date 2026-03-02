/**
 * 材料计算服务
 * 根据索赔项目和事故原因动态计算所需理赔材料清单
 */

import { readData } from '../utils/fileStore.js';

/**
 * 计算理赔材料清单
 * @param {Object} params - 计算参数
 * @param {string} params.productCode - 产品代码
 * @param {string} params.categoryCode - 三级险种代码
 * @param {string[]} params.claimItemIds - 用户选择的索赔项目IDs
 * @param {string} params.accidentCauseId - 用户选择的事故原因ID（可选）
 * @returns {Promise<Object>} 材料清单结果
 */
export async function calculateMaterials({ productCode, categoryCode, claimItemIds = [], accidentCauseId }) {
  try {
    // 1. 加载所有数据源
    const [
      allMaterials,
      allClaimItems,
      categoryMaterialConfigs,
      accidentCauseConfigs,
      productClaimConfigs
    ] = await Promise.all([
      readData('claims-materials'),
      readData('claim-items'),
      readData('category-material-configs'),
      readData('accident-cause-configs'),
      readData('product-claim-configs')
    ]);

    // 材料Map，用于去重和合并
    // key: materialId, value: { materialId, materialName, required, sources: [] }
    const materialMap = new Map();

    // 2. 收集通用材料（基于三级险种代码）
    if (categoryCode) {
      const categoryConfig = categoryMaterialConfigs.find(c => c.categoryCode === categoryCode);
      if (categoryConfig && categoryConfig.materialIds) {
        categoryConfig.materialIds.forEach(matId => {
          const material = allMaterials.find(m => m.id === matId);
          if (material) {
            addMaterial(materialMap, {
              materialId: matId,
              materialName: material.name,
              materialDescription: material.description,
              sampleUrl: material.sampleUrl || null,
              ossKey: material.ossKey || null,
              required: categoryConfig.materialRequiredMap?.[matId] || false,
              source: 'category',
              sourceDetails: `险种通用材料`
            });
          }
        });
      }
    }

    // 3. 收集索赔项目关联材料
    if (claimItemIds && claimItemIds.length > 0) {
      claimItemIds.forEach(itemId => {
        const claimItem = allClaimItems.find(ci => ci.id === itemId);
        if (claimItem && claimItem.materialIds) {
          claimItem.materialIds.forEach(matId => {
            const material = allMaterials.find(m => m.id === matId);
            if (material) {
              addMaterial(materialMap, {
                materialId: matId,
                materialName: material.name,
                materialDescription: material.description,
                sampleUrl: material.sampleUrl || null,
                ossKey: material.ossKey || null,
                required: claimItem.materialRequiredMap?.[matId] || false,
                source: 'claim_item',
                sourceDetails: `索赔项目「${claimItem.name}」`
              });
            }
          });
        }
      });
    }

    // 4. 收集事故原因关联材料
    if (accidentCauseId) {
      const causeConfig = accidentCauseConfigs.find(c => c.id === accidentCauseId);
      if (causeConfig && causeConfig.materialIds) {
        causeConfig.materialIds.forEach(matId => {
          const material = allMaterials.find(m => m.id === matId);
          if (material) {
            addMaterial(materialMap, {
              materialId: matId,
              materialName: material.name,
              materialDescription: material.description,
              sampleUrl: material.sampleUrl || null,
              ossKey: material.ossKey || null,
              required: causeConfig.materialRequiredMap?.[matId] || false,
              source: 'accident_cause',
              sourceDetails: `事故原因「${causeConfig.name}」`
            });
          }
        });
      }
    }

    // 5. 收集产品额外材料（从产品的 intakeConfig.claimMaterials.extraMaterialIds）
    if (productCode) {
      const products = await readData('products');
      const product = products.find(p => p.productCode === productCode);
      if (product?.intakeConfig?.claimMaterials?.extraMaterialIds) {
        product.intakeConfig.claimMaterials.extraMaterialIds.forEach(matId => {
          const material = allMaterials.find(m => m.id === matId);
          if (material) {
            const overrides = product.intakeConfig.claimMaterials.materialOverrides || {};
            const override = overrides[matId];
            // 只添加被选中的额外材料
            if (override?.selected !== false) {
              addMaterial(materialMap, {
                materialId: matId,
                materialName: material.name,
                materialDescription: material.description,
                sampleUrl: material.sampleUrl || null,
                ossKey: material.ossKey || null,
                required: override?.required || false,
                source: 'extra',
                sourceDetails: `产品额外材料`
              });
            }
          }
        });
      }
    }

    // 6. 转换为数组并计算统计信息
    const materials = Array.from(materialMap.values()).map(mat => ({
      materialId: mat.materialId,
      materialName: mat.materialName,
      materialDescription: mat.materialDescription,
      sampleUrl: mat.sampleUrl,
      ossKey: mat.ossKey,
      required: mat.required,
      source: mat.sources[0]?.source || 'unknown', // 主要来源
      sourceDetails: mat.sources.map(s => s.sourceDetails).join('、'),
      allSources: mat.sources // 保留所有来源信息
    }));

    // 按必填状态排序（必填在前）
    materials.sort((a, b) => {
      if (a.required && !b.required) return -1;
      if (!a.required && b.required) return 1;
      return a.materialName.localeCompare(b.materialName);
    });

    const summary = {
      totalCount: materials.length,
      requiredCount: materials.filter(m => m.required).length,
      optionalCount: materials.filter(m => !m.required).length
    };

    return {
      success: true,
      materials,
      summary
    };

  } catch (error) {
    console.error('材料计算失败:', error);
    return {
      success: false,
      error: error.message,
      materials: [],
      summary: { totalCount: 0, requiredCount: 0, optionalCount: 0 }
    };
  }
}

/**
 * 添加材料到 Map，实现去重和必填状态合并
 * 使用 OR 逻辑：任一来源标记为必填则为必填
 */
function addMaterial(materialMap, materialInfo) {
  const { materialId, materialName, materialDescription, sampleUrl, ossKey, required, source, sourceDetails } = materialInfo;

  if (materialMap.has(materialId)) {
    // 材料已存在，更新必填状态和来源
    const existing = materialMap.get(materialId);
    existing.required = existing.required || required; // OR 逻辑
    existing.sources.push({ source, sourceDetails, required });
    // 保留第一个有效的 sampleUrl 和 ossKey
    if (!existing.sampleUrl && sampleUrl) {
      existing.sampleUrl = sampleUrl;
    }
    if (!existing.ossKey && ossKey) {
      existing.ossKey = ossKey;
    }
  } else {
    // 新材料
    materialMap.set(materialId, {
      materialId,
      materialName,
      materialDescription,
      sampleUrl,
      ossKey,
      required,
      sources: [{ source, sourceDetails, required }]
    });
  }
}
