import { ICD10Disease } from '../types/icd10';
import { getByCode, list as listIcd } from './icd10Service';

// 5-Level matching interfaces mirroring catalogMatchService.ts structure
export interface MatchOptions {
  aiEnabled?: boolean;
  maxSuggestions?: number;
}

export interface BatchMatchOptions {
  enableAiMatch?: boolean;
  aiBatchSize?: number;
  onProgress?: (phase: 'sync' | 'ai', detail: string) => void;
}

export interface ExtractionOptions {
  max?: number;
}

export interface ExtractedDisease {
  code?: string;
  name?: string;
  input: string; //原始输入或提取的文本片段
  matched?: boolean;
  level?: 1 | 2 | 3 | 4 | 5;
  disease?: ICD10Disease;
  confidence?: number;
}

export interface MatchResult {
  matched: boolean;
  disease?: ICD10Disease;
  level: 1 | 2 | 3 | 4 | 5;
  confidence: number; // 0-100
  method: 'exact' | 'prefix' | 'fuzzy' | 'ai' | 'none';
  suggestions?: ICD10Disease[];
}

// Simple utilities
const normalize = (s: string) => (s ?? '').trim().toUpperCase();

// Basic Levenshtein distance for fuzzy matching (level 3)
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function fuzzyScore(a: string, b: string): number {
  const sa = normalize(a);
  const sb = normalize(b);
  if (sa.length === 0 || sb.length === 0) return 0;
  const dist = levenshtein(sa, sb);
  const maxLen = Math.max(sa.length, sb.length);
  const sim = Math.max(0, Math.min(100, Math.round((1 - dist / maxLen) * 100)));
  return sim;
}

// Internal 5-level 机制 helpers
async function level1Exact(input: string): Promise<MatchResult | null> {
  const code = input.trim();
  if (!code) return null;
  const byCode = await getByCode(code);
  if (byCode) {
    return {
      matched: true,
      disease: byCode,
      level: 1,
      confidence: 100,
      method: 'exact',
      suggestions: undefined,
    };
  }
  return null;
}

async function level2Prefix(input: string, all?: ICD10Disease[]): Promise<MatchResult | null> {
  const norm = normalize(input);
  if (!norm) return null;
  const dataset = all ?? (await listIcd({ page: 1, pageSize: 2000, sortBy: 'code' }))?.items ?? [];
  // best prefix by longest code match or by category prefix
  let best: ICD10Disease | undefined;
  for (const d of dataset) {
    if (normalize(d.code).startsWith(norm)) {
      best = d;
      break;
    }
  }
  // If not found by code, try category code prefix
  if (!best) {
    for (const d of dataset) {
      const cat = d.hierarchy?.category?.code ?? '';
      if (cat && cat.startsWith(norm)) {
        best = d;
        break;
      }
    }
  }
  if (best) {
    return {
      matched: true,
      disease: best,
      level: 2,
      confidence: 90,
      method: 'prefix',
    };
  }
  return null;
}

async function level3Fuzzy(input: string, all?: ICD10Disease[]): Promise<MatchResult | null> {
  const source = all ?? (await listIcd({ page: 1, pageSize: 3000, sortBy: 'name' }))?.items ?? [];
  if (!input) return null;
  let best: ICD10Disease | undefined;
  let bestScore = 0;
  for (const d of source) {
    const score = fuzzyScore(input, d.name);
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  if (best && bestScore >= 70) {
    return {
      matched: true,
      disease: best,
      level: 3,
      confidence: bestScore,
      method: 'fuzzy',
    };
  }
  return null;
}

// AI-based Level 4 (optional)
async function level4Ai(input: string, options?: { aiBatchSize?: number }): Promise<MatchResult | null> {
  const enable = true; // controlled by outer option; keep internal default enabled
  if (!enable) return null;
  // Prepare a lightweight AI call similar to catalogMatchService
  try {
    const { response } = await invokeIcd10SemanticMatch({
      catalogList: '',
      itemList: `"${input}"`,
      resultShape: ` { "matchedCode": "医保编码", "confidence": 0-100, "reason": "说明" }`,
      aiConfidenceThreshold: 60,
    });
    const result = JSON.parse((typeof (response?.text) === 'string' ? response.text : '{}') as string);
    if (result?.matchedCode) {
      // Try to locate the ICD-10 item by code from existing data
      const byCode = await getByCode(result.matchedCode);
      if (byCode) {
        return {
          matched: true,
          disease: byCode,
          level: 4,
          confidence: Number(result?.confidence) || 60,
          method: 'ai',
        } as MatchResult;
      }
    }
    return {
      matched: false,
      level: 4,
      confidence: Number(result?.confidence) || 0,
      method: 'ai',
    } as MatchResult;
  } catch (err) {
    // AI path failed; ignore and let caller fall back to Level 5
    return null;
  }
}

// Placeholder AI proxy wrapper (identical in shape to catalogMatchService usage)
async function invokeIcd10SemanticMatch(templateVariables: Record<string, string | number>) {
  const response = await fetch('/api/ai/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      capabilityId: 'admin.icd10.semantic_match',
      promptTemplateId: 'icd10_semantic_match',
      templateVariables,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
      meta: {
        sourceApp: 'admin-system',
        module: 'services.icd10MatchService',
        operation: 'icd10_semantic_match',
        context: {
          route: 'icd10MatchService',
        },
      },
    }),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.error || 'ICD10 AI match proxy failed');
  }

  return { response: await response.json() as any };
}

// 5-Level matching pipeline for a single disease query
export async function matchDisease(input: string, options?: MatchOptions): Promise<MatchResult> {
  const { aiEnabled = true } = options ?? {};
  // 1) Level 1: exact code match
  const exact = await level1Exact(input);
  if (exact) return exact;

  // 2) Level 2: prefix match by code/category prefix
  const allCatalog = await listIcd({ page: 1, pageSize: 2000, sortBy: 'code' });
  const prefix = await level2Prefix(input, allCatalog?.items);
  if (prefix) return prefix;

  // 3) Level 3: fuzzy name similarity
  const fuzzy = await level3Fuzzy(input, allCatalog?.items);
  if (fuzzy) return fuzzy;

  // 4) Level 4: AI semantic match (optional)
  if (aiEnabled) {
    const ai = await level4Ai(input);
    if (ai) return ai;
  }

  // 5) Level 5: no match -> return suggestions
  let suggestions: ICD10Disease[] = [];
  try {
    const listAll = await listIcd({ page: 1, pageSize: 5000, sortBy: 'name' });
    suggestions = (listAll?.items ?? [])
      .slice(0, options?.maxSuggestions ?? 5);
  } catch {
    // ignore
  }
  return {
    matched: false,
    level: 5,
    confidence: 0,
    method: 'none',
    suggestions,
  };
}

// 2nd API: batch matching with concurrency control and per-item error handling
export async function batchMatch(inputs: string[], options?: BatchMatchOptions): Promise<Map<string, MatchResult>> {
  const { enableAiMatch = true, aiBatchSize = 15, onProgress } = options ?? {};
  const results = new Map<string, MatchResult>();
  const unmatched: Array<{ index: number; input: string }> = [];

  // Stage 1: Level 1-3 synchronous matching for all inputs
  const allIcd = await listIcd({ page: 1, pageSize: 5000, sortBy: 'code' });
  for (let idx = 0; idx < inputs.length; idx++) {
    const inpt = inputs[idx];
    // Level 1
    const r1 = await level1Exact(inpt);
    if (r1) {
      results.set(inpt, r1);
      onProgress?.('sync', `项 ${idx + 1}/${inputs.length} -> Level 1 命中`);
      continue;
    }
    // Level 2
    const r2 = await level2Prefix(inpt, allIcd?.items);
    if (r2) {
      results.set(inpt, r2);
      onProgress?.('sync', `项 ${idx + 1}/${inputs.length} -> Level 2 命中`);
      continue;
    }
    // Level 3
    const r3 = await level3Fuzzy(inpt, allIcd?.items);
    if (r3) {
      results.set(inpt, r3);
      onProgress?.('sync', `项 ${idx + 1}/${inputs.length} -> Level 3 命中`);
      continue;
    }
    // 未命中，放入 AI 队列
    unmatched.push({ index: idx, input: inpt });
  }

  onProgress?.('sync', `阶段一完成：命中 ${results.size} / ${inputs.length}，待 AI 匹配 ${unmatched.length} 项`);

  // Stage 2: AI/%Batch matching for remaining items
  if (unmatched.length > 0 && enableAiMatch) {
    onProgress?.('ai', `AI 语义匹配中 (${unmatched.length} 项)…`);
    // Build AI batch - process in chunks to control concurrency
    const maxBatch = aiBatchSize;
    for (let i = 0; i < unmatched.length; i += maxBatch) {
      const batch = unmatched.slice(i, i + maxBatch);
      const batchInputs = batch.map(b => b.input);
      const batchResults = await Promise.all(batchInputs.map((input) => level4Ai(input)));
      batch.forEach((b, idx) => {
        const aiRes = batchResults[idx];
        results.set(b.input, aiRes ?? { matched: false, level: 5, confidence: 0, method: 'none' });
      });
      onProgress?.('ai', `AI 语义匹配进度 ${Math.min(i + batch.length, unmatched.length)}/${unmatched.length}`);
    }
    onProgress?.('ai', `AI 语义匹配完成，共 ${unmatched.length} 项`);
  } else if (unmatched.length > 0 && !enableAiMatch) {
    onProgress?.('sync', `AI 匹配已关闭，${unmatched.length} 项未匹配`);
    for (const u of unmatched) {
      results.set(u.input, { matched: false, level: 5, confidence: 0, method: 'none' });
    }
  }

  // Ensure all inputs have an entry
  inputs.forEach((inp) => {
    if (!results.has(inp)) {
      results.set(inp, { matched: false, level: 5, confidence: 0, method: 'none' });
    }
  });

  return results;
}

// Extract ICD-10 items from free text by recognizing codes (e.g., A00.0, B12)
export async function extractFromText(text: string, options?: ExtractionOptions): Promise<ExtractedDisease[]> {
  if (!text) return [];
  // ICD-10 codes: a letter A-Z followed by two digits, optional dot and digits
  const codeRegex = /([A-Z][0-9]{2}(?:\.[0-9A-Za-z]+)?)/g;
  const codes = Array.from(new Set((text.match(codeRegex) ?? []).map((c) => c.trim())));
  const max = options?.max ?? codes.length;
  const promises = codes.slice(0, max).map(async (code) => {
    const disease = await getByCode(code);
    return {
      code,
      name: disease?.name,
      input: code,
      matched: !!disease,
      level: 1 as const,
      disease: disease ?? undefined,
    } as ExtractedDisease;
  });
  const results = await Promise.all(promises);
  return results;
}

export default {
  matchDisease,
  batchMatch,
  extractFromText,
};
