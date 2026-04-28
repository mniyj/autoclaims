/**
 * 材料配置服务 - 基于配置系统的材料清单查询服务
 * 
 * 替代硬编码的 getGenericMaterialsByType，从配置动态加载
 */

import { configService, MaterialConfig, ClaimItemConfig } from './configService';

// 材料项（用户友好格式）
export interface MaterialItem {
  id: string;
  name: string;
  description: string;
  required: boolean;
  sampleUrl?: string;
  ossKey?: string;
  uploaded: boolean;
  aiAuditPrompt?: string;
}

// 材料查询选项
export interface MaterialQueryOptions {
  productCode?: string;
  claimItemId?: string;
  claimType?: string;
  claimId?: string;
  uploadedDocuments?: Array<{
    id?: string;
    category?: string;
    name?: string;
  }>;
}

// 材料查询结果
export interface MaterialQueryResult {
  materials: MaterialItem[];
  requiredMaterials: MaterialItem[];
  missingMaterials: MaterialItem[];
  uploadedMaterials: MaterialItem[];
  claimType: string;
  productCode?: string;
  claimItemId?: string;
}

// 险种类型到理赔项目 ID 的映射
const CLAIM_TYPE_TO_ITEM_MAP: Record<string, string> = {
  '医疗险': 'item-medical-general',
  '住院医疗': 'item-medical-inpatient',
  '门诊医疗': 'item-medical-outpatient',
  '重疾险': 'item-critical-illness',
  '意外险': 'item-accident-general',
  '意外伤害': 'item-accident-injury',
  '车险': 'item-auto-accident',
  '车辆损失': 'item-auto-damage',
  '定期寿险': 'item-term-life',
  '终身寿险': 'item-whole-life',
  '家财险': 'item-home-property',
  '旅行险': 'item-travel-accident'
};

// 文档类别到材料 ID 的映射
const DOCUMENT_CATEGORY_TO_MATERIAL: Record<string, string> = {
  '身份证件': 'mat-1',
  '身份证正面': 'mat-1',
  '身份证反面': 'mat-2',
  '驾驶证': 'mat-3',
  '行驶证': 'mat-4',
  '银行卡': 'mat-6',
  '事故证明': 'mat-8',
  '交通事故责任认定书': 'mat-8',
  '门急诊病历': 'mat-11',
  '病历': 'mat-11',
  '出院小结': 'mat-12',
  '住院病历': 'mat-12',
  '医疗发票': 'mat-13',
  '发票': 'mat-13',
  '费用清单': 'mat-20',
  '诊断证明': 'mat-21'
};

/**
 * 材料配置服务类
 */
export class MaterialConfigService {
  constructor(private configSvc: typeof configService) {}

  /**
   * 查询材料清单
   * 优先顺序: claimItemId → claimType → productCode
   */
  async queryMaterials(options: MaterialQueryOptions): Promise<MaterialQueryResult> {
    const { productCode, claimItemId, claimType, uploadedDocuments } = options;

    let resolvedItemId: string | null = claimItemId || null;
    let resolvedProductCode: string | undefined = productCode;
    let resolvedClaimType: string = claimType || '未知险种';

    // 1. 如果没有 claimItemId，尝试从 claimType 映射
    if (!resolvedItemId && claimType) {
      resolvedItemId = await this.mapClaimTypeToItemId(claimType);
      resolvedClaimType = claimType;
    }

    // 2. 如果没有 claimItemId 但有 productCode，尝试从产品配置获取
    if (!resolvedItemId && productCode) {
      resolvedItemId = await this.getItemIdFromProduct(productCode);
      resolvedProductCode = productCode;
    }

    // 3. 获取材料清单
    let materialItems: MaterialItem[] = [];
    
    if (resolvedItemId) {
      materialItems = await this.getMaterialsByClaimItemId(resolvedItemId);
    }

    // 4. 如果没有找到材料，尝试直接根据 claimType 获取
    if (materialItems.length === 0 && claimType) {
      materialItems = await this.getDefaultMaterialsByType(claimType);
    }

    // 5. 标记已上传的材料
    if (uploadedDocuments && uploadedDocuments.length > 0) {
      this.markUploadedMaterials(materialItems, uploadedDocuments);
    }

    // 6. 分类材料
    const requiredMaterials = materialItems.filter(m => m.required);
    const uploadedMaterials = materialItems.filter(m => m.uploaded);
    const missingMaterials = requiredMaterials.filter(m => !m.uploaded);

    return {
      materials: materialItems,
      requiredMaterials,
      missingMaterials,
      uploadedMaterials,
      claimType: resolvedClaimType,
      productCode: resolvedProductCode,
      claimItemId: resolvedItemId || undefined
    };
  }

  /**
   * 检测缺失的材料
   */
  async detectMissingMaterials(
    claimItemId: string,
    uploadedDocuments: Array<{ category?: string; name?: string }>
  ): Promise<MaterialItem[]> {
    const allMaterials = await this.getMaterialsByClaimItemId(claimItemId);
    const requiredMaterials = allMaterials.filter(m => m.required);
    
    // 标记已上传的材料
    this.markUploadedMaterials(requiredMaterials, uploadedDocuments);
    
    // 返回未上传的必需材料
    return requiredMaterials.filter(m => !m.uploaded);
  }

  /**
   * 获取材料上传指导
   */
  async getMaterialUploadGuide(claimType: string): Promise<string> {
    const guides: Record<string, string> = {
      '医疗险': `
📋 **医疗险材料上传指南**

**关键要点**：
• 发票需为医院出具的正规发票，需包含发票专用章
• 病历需包含就诊日期、诊断结论、医生签名
• 检查报告需清晰显示检查项目和结果
• 出院小结需加盖医院公章

**常见问题**：
Q: 电子发票可以吗？
A: 可以，需确保发票真实有效，可在税务局网站验证。

Q: 缺少病历怎么办？
A: 可回就诊医院补打，或提供其他就诊凭证。
      `,
      '重疾险': `
📋 **重疾险材料上传指南**

**关键要点**：
• 诊断证明需由二级及以上医院出具
• 病理报告（如适用）需明确标注疾病性质
• 检查报告需包含检查日期和医生签名

**注意**：重疾险理赔关键是确诊证明，需确保诊断明确。
      `,
      '意外险': `
📋 **意外险材料上传指南**

**关键要点**：
• 事故证明是关键材料，需能证明意外性质
• 如涉及第三方，需提供责任认定书
• 伤残鉴定需由指定机构出具

**注意**：请保留所有与事故相关的证据材料。
      `,
      '车险': `
📋 **车险材料上传指南**

**关键要点**：
• 驾驶证、行驶证需拍摄正副页完整信息
• 事故认定书需交警部门盖章
• 维修发票需与定损金额一致

**重要提醒**：维修前务必先报案定损，否则可能无法理赔！
      `,
      '定期寿险': `
📋 **寿险材料上传指南**

**关键要点**：
• 死亡证明需由医院或公安机关出具
• 户籍注销证明需到派出所办理
• 受益人身份证明需与保单一致

**注意**：身故理赔涉及法律程序，请确保材料真实完整。
      `
    };

    return guides[claimType] || `
📋 **材料上传指南**

请按照材料清单要求准备相关文件：
• 确保文件清晰可辨，信息完整
• 如有疑问，可联系客服咨询
• 建议保留原件以备核查
    `;
  }

  /**
   * 根据理赔项目 ID 获取材料清单
   */
  private async getMaterialsByClaimItemId(claimItemId: string): Promise<MaterialItem[]> {
    try {
      const [claimItems, materials] = await Promise.all([
        this.configSvc.loadClaimItems(),
        this.configSvc.loadMaterials()
      ]);

      const claimItem = claimItems.find((i: ClaimItemConfig) => i.id === claimItemId);
      
      if (!claimItem) {
        console.warn(`[MaterialConfigService] Claim item not found: ${claimItemId}`);
        return [];
      }

      return claimItem.materialIds
        .map((id: string) => materials.find((m: MaterialConfig) => m.id === id))
        .filter(Boolean)
        .map((m: MaterialConfig) => ({
          id: m.id,
          name: m.name,
          description: m.description,
          required: m.required !== false, // 默认为必需
          sampleUrl: m.sampleUrl,
          ossKey: m.ossKey,
          uploaded: false,
          aiAuditPrompt: m.aiAuditPrompt
        }));
    } catch (error) {
      console.error('[MaterialConfigService] Failed to get materials:', error);
      return [];
    }
  }

  /**
   * 根据产品代码获取理赔项目 ID
   */
  private async getItemIdFromProduct(productCode: string): Promise<string | null> {
    try {
      const configs = await this.configSvc.loadProductClaimConfigs();
      const config = configs.find(c => c.productCode === productCode);
      
      if (config?.responsibilityConfigs?.[0]?.claimItemIds?.[0]) {
        return config.responsibilityConfigs[0].claimItemIds[0];
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 映射险种类型到理赔项目 ID
   *
   * 异步实现：在返回候选 ID 前先校验它在 claim-items 配置中真实存在。
   * CLAIM_TYPE_TO_ITEM_MAP 里写死的很多 ID（如 `item-accident-general`、
   * `item-medical-general`）只是"桥梁命名约定"，现实 claim-items 数据里
   * 未必有对应记录。以前直接返回会导致 `getMaterialsByClaimItemId` 打出
   * "Claim item not found" 警告并返回空，进而拖累下游给不出有效答复。
   * 这里先校验一次，不存在就直接返回 null，让调用方走 default 兜底。
   */
  private async mapClaimTypeToItemId(claimType: string): Promise<string | null> {
    const candidate =
      CLAIM_TYPE_TO_ITEM_MAP[claimType] ||
      CLAIM_TYPE_TO_ITEM_MAP[this.normalizeClaimType(claimType)];
    if (!candidate) return null;

    try {
      const items = await this.configSvc.loadClaimItems();
      const exists = items.some((i: ClaimItemConfig) => i.id === candidate);
      return exists ? candidate : null;
    } catch (err) {
      console.warn('[MaterialConfigService] claim-items load failed:', err);
      return null;
    }
  }

  /**
   * 标准化险种类型
   */
  private normalizeClaimType(type: string): string {
    const aliases: Record<string, string> = {
      '医疗理赔': '医疗险',
      '住院理赔': '住院医疗',
      '门诊理赔': '门诊医疗',
      '重疾理赔': '重疾险',
      '重大疾病': '重疾险',
      '意外理赔': '意外险',
      '意外伤害理赔': '意外险',
      '车辆理赔': '车险',
      '汽车理赔': '车险',
      '身故理赔': '定期寿险',
      '寿险理赔': '定期寿险'
    };
    return aliases[type] || type;
  }

  /**
   * 获取默认材料清单（当配置中找不到时）
   */
  private async getDefaultMaterialsByType(claimType: string): Promise<MaterialItem[]> {
    // 从配置中加载材料，匹配险种类型关键词
    try {
      const materials = await this.configSvc.loadMaterials();
      const normalizedType = this.normalizeClaimType(claimType);
      
      // 根据险种类型筛选常用材料
      const commonMaterials: string[] = ['mat-1', 'mat-2', 'mat-6']; // 身份证、银行卡
      
      if (normalizedType.includes('医疗')) {
        commonMaterials.push('mat-11', 'mat-12', 'mat-13'); // 病历、出院小结、发票
      } else if (normalizedType.includes('意外')) {
        commonMaterials.push('mat-11', 'mat-13'); // 病历、发票
      } else if (normalizedType.includes('车')) {
        commonMaterials.push('mat-3', 'mat-4', 'mat-8'); // 驾驶证、行驶证、事故认定
      }

      return materials
        .filter((m: MaterialConfig) => commonMaterials.includes(m.id))
        .map((m: MaterialConfig) => ({
          id: m.id,
          name: m.name,
          description: m.description,
          required: m.required !== false,
          sampleUrl: m.sampleUrl,
          ossKey: m.ossKey,
          uploaded: false,
          aiAuditPrompt: m.aiAuditPrompt
        }));
    } catch {
      return [];
    }
  }

  /**
   * 标记已上传的材料
   */
  private markUploadedMaterials(
    materials: MaterialItem[],
    documents: Array<{ category?: string; name?: string }>
  ): void {
    materials.forEach(material => {
      const isUploaded = documents.some(doc => {
        // 通过类别匹配
        if (doc.category) {
          const materialId = DOCUMENT_CATEGORY_TO_MATERIAL[doc.category];
          if (materialId === material.id) return true;
        }
        
        // 通过名称匹配
        if (doc.name) {
          return material.name.includes(doc.name) || doc.name.includes(material.name);
        }
        
        return false;
      });
      
      material.uploaded = isUploaded;
    });
  }
}

// 导出单例实例
export const materialConfigService = new MaterialConfigService(configService);
