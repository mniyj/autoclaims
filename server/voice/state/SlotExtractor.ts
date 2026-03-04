export interface SlotDefinition {
  name: string;
  type: 'string' | 'number' | 'date' | 'enum' | 'phone' | 'idcard';
  required: boolean;
  description: string;
  enumValues?: string[];
  validation?: (value: any) => boolean;
  patterns?: RegExp[];
}

export interface ExtractedSlot {
  name: string;
  value: any;
  confidence: number;
}

export const CLAIM_REPORT_SLOTS: SlotDefinition[] = [
  {
    name: 'policyNumber',
    type: 'string',
    required: true,
    description: '保单号码，通常是10-20位字母数字组合',
    patterns: [/[A-Z0-9]{10,20}/i]
  },
  {
    name: 'reporterName',
    type: 'string',
    required: true,
    description: '报案人姓名'
  },
  {
    name: 'accidentTime',
    type: 'date',
    required: true,
    description: '事故发生日期，格式：YYYY-MM-DD',
    patterns: [
      /(\d{4})年(\d{1,2})月(\d{1,2})日/,
      /(\d{4})-(\d{1,2})-(\d{1,2})/,
      /(\d{1,2})月(\d{1,2})日/,
      /昨天|今天|前天/
    ]
  },
  {
    name: 'accidentLocation',
    type: 'string',
    required: false,
    description: '事故发生地点，如医院名称、道路名称等'
  },
  {
    name: 'accidentReason',
    type: 'string',
    required: true,
    description: '事故原因描述，如疾病名称、事故类型等'
  },
  {
    name: 'incidentType',
    type: 'enum',
    required: true,
    description: '事故类型',
    enumValues: ['medical', 'accident', 'vehicle', 'property', 'death'],
    patterns: [
      /医疗|住院|手术|疾病/i,
      /意外|事故|受伤/i,
      /车辆|车祸|碰撞/i,
      /财产|物品|损失/i,
      /身故|死亡/i
    ]
  },
  {
    name: 'hospitalName',
    type: 'string',
    required: false,
    description: '医院名称',
    patterns: [/医院|诊所|卫生院/i]
  },
  {
    name: 'claimAmount',
    type: 'number',
    required: false,
    description: '预估理赔金额（元）',
    patterns: [/(\d+(?:\.\d+)?)\s*(?:元|块)/i]
  }
];

export class SlotExtractor {
  private slotDefinitions: SlotDefinition[];

  constructor(slotDefinitions: SlotDefinition[] = CLAIM_REPORT_SLOTS) {
    this.slotDefinitions = slotDefinitions;
  }

  extractSlots(text: string): ExtractedSlot[] {
    const extracted: ExtractedSlot[] = [];

    for (const slotDef of this.slotDefinitions) {
      const value = this.extractSlotValue(text, slotDef);
      if (value !== null) {
        extracted.push({
          name: slotDef.name,
          value,
          confidence: 0.8
        });
      }
    }

    return extracted;
  }

  private extractSlotValue(text: string, slotDef: SlotDefinition): any {
    switch (slotDef.type) {
      case 'date':
        return this.extractDate(text);
      case 'number':
        return this.extractNumber(text);
      case 'enum':
        return this.extractEnum(text, slotDef);
      case 'phone':
        return this.extractPhone(text);
      case 'idcard':
        return this.extractIdCard(text);
      case 'string':
      default:
        return this.extractString(text, slotDef);
    }
  }

  private extractDate(text: string): string | null {
    const now = new Date();

    // 处理相对日期
    if (/今天/i.test(text)) {
      return now.toISOString().split('T')[0];
    }
    if (/昨天/i.test(text)) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday.toISOString().split('T')[0];
    }
    if (/前天/i.test(text)) {
      const beforeYesterday = new Date(now);
      beforeYesterday.setDate(beforeYesterday.getDate() - 2);
      return beforeYesterday.toISOString().split('T')[0];
    }

    // 处理 "X月X日" 格式
    const monthDayMatch = text.match(/(\d{1,2})月(\d{1,2})日/);
    if (monthDayMatch) {
      const month = monthDayMatch[1].padStart(2, '0');
      const day = monthDayMatch[2].padStart(2, '0');
      const year = now.getFullYear();
      return `${year}-${month}-${day}`;
    }

    // 处理完整日期格式
    const fullDateMatch = text.match(/(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})/);
    if (fullDateMatch) {
      const year = fullDateMatch[1];
      const month = fullDateMatch[2].padStart(2, '0');
      const day = fullDateMatch[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    return null;
  }

  private extractNumber(text: string): number | null {
    const match = text.match(/(\d+(?:\.\d+)?)\s*(?:元|块|万)?/);
    if (match) {
      let value = parseFloat(match[1]);
      if (text.includes('万')) {
        value *= 10000;
      }
      return value;
    }
    return null;
  }

  private extractEnum(text: string, slotDef: SlotDefinition): string | null {
    if (!slotDef.patterns || !slotDef.enumValues) return null;

    for (let i = 0; i < slotDef.patterns.length; i++) {
      if (slotDef.patterns[i].test(text)) {
        return slotDef.enumValues[i];
      }
    }

    return null;
  }

  private extractPhone(text: string): string | null {
    const match = text.match(/1[3-9]\d{9}/);
    return match ? match[0] : null;
  }

  private extractIdCard(text: string): string | null {
    const match = text.match(/\d{17}[\dXx]|\d{15}/);
    return match ? match[0] : null;
  }

  private extractString(text: string, slotDef: SlotDefinition): string | null {
    // 如果有特定模式，尝试匹配
    if (slotDef.patterns) {
      for (const pattern of slotDef.patterns) {
        const match = text.match(pattern);
        if (match) {
          return match[0];
        }
      }
    }

    // 根据描述关键词提取
    if (slotDef.name === 'hospitalName') {
      const hospitalMatch = text.match(/([^，。]+(?:医院|诊所|卫生院))/);
      if (hospitalMatch) {
        return hospitalMatch[1];
      }
    }

    if (slotDef.name === 'reporterName') {
      // 简单的中文姓名提取（2-4个汉字）
      const nameMatch = text.match(/(?:我叫|我是|姓名[是为]?)([^，。]{2,4})/);
      if (nameMatch) {
        return nameMatch[1];
      }
    }

    return null;
  }

  getMissingSlots(extractedSlots: ExtractedSlot[], requiredOnly = true): SlotDefinition[] {
    const extractedNames = new Set(extractedSlots.map(s => s.name));
    
    return this.slotDefinitions.filter(slot => {
      if (requiredOnly && !slot.required) return false;
      return !extractedNames.has(slot.name);
    });
  }

  formatSlotForSpeech(slotName: string, value: any): string {
    switch (slotName) {
      case 'accidentTime':
        if (typeof value === 'string' && value.includes('-')) {
          const [year, month, day] = value.split('-');
          return `${year}年${month}月${day}日`;
        }
        return String(value);
      case 'claimAmount':
        return `${value}元`;
      default:
        return String(value);
    }
  }
}
