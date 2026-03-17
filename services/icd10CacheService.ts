import Fuse from 'fuse.js';
import type { ICD10Disease } from '../types/icd10';

// Lightweight in-memory LRU cache for string -> ICD10Disease
class SimpleLRUCache {
  private capacity: number;
  private map: Map<string, ICD10Disease | null>;
  constructor(capacity: number) {
    this.capacity = capacity;
    this.map = new Map<string, ICD10Disease | null>();
  }
  get(key: string): ICD10Disease | null | undefined {
    if (!this.map.has(key)) return undefined;
    const val = this.map.get(key) as ICD10Disease | null;
    // refresh usage
    this.map.delete(key);
    this.map.set(key, val);
    return val;
  }
  set(key: string, value: ICD10Disease | null): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value as string;
      this.map.delete(oldest);
    }
  }
  clear(): void {
    this.map.clear();
  }
}

type ICD10NameKey = string; // normalized name key

type ICD10CacheState = {
  initialized: boolean;
  diseases: ICD10Disease[];
  byCodeIndex: Map<string, string>; // code -> id
  byIdIndex: Map<string, ICD10Disease>;
  codeIndex: Map<string, ICD10Disease>;
  nameIndex: Map<ICD10NameKey, string[]>; // normalizedName -> codes[]
  aliasIndex: Map<string, string[]>; // normalizedAlias -> codes[] (if aliases exist)
  fuse: Fuse<ICD10Disease> | null;
  codeCache: SimpleLRUCache;
  hits: number;
  misses: number;
};

let state: ICD10CacheState = {
  initialized: false,
  diseases: [],
  byCodeIndex: new Map(),
  byIdIndex: new Map(),
  codeIndex: new Map(),
  nameIndex: new Map(),
  aliasIndex: new Map(),
  fuse: null,
  codeCache: new SimpleLRUCache(4096), // ~4k entries -> controlled memory footprint
  hits: 0,
  misses: 0,
};

const normalizeKey = (s: string): string => {
  if (!s) return '';
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
};

// Initialize data and build indexes
export async function initialize(): Promise<void> {
  if (state.initialized) return;
  try {
    // Load core ICD-10 data from JSON (same source as ICD10Service)
    const diseasesModule = await import('../../jsonlist/icd10/diseases.json');
    const data: ICD10Disease[] = (diseasesModule?.default ?? diseasesModule) as ICD10Disease[];
    state.diseases = data;
    // Basic maps
    state.byIdIndex = new Map<string, ICD10Disease>();
    state.byCodeIndex = new Map<string, string>();
    state.codeIndex = new Map<string, ICD10Disease>();
    for (const d of state.diseases) {
      state.byIdIndex.set(d.id, d);
      if (d.code) {
        state.byCodeIndex.set(d.code, d.id);
        state.codeIndex.set(d.code, d);
      }
    }

    // Build nameIndex and aliasIndex
    state.nameIndex = new Map<string, string[]>();
    state.aliasIndex = new Map<string, string[]>();
    for (const d of state.diseases) {
      const nameKey = normalizeKey(d.name ?? '');
      if (nameKey) {
        const codes = state.nameIndex.get(nameKey) ?? [];
        codes.push(d.code);
        state.nameIndex.set(nameKey, codes);
      }
      // Aliases if present
      const aliases: string[] = (undefined as any) as string[];
      // If disease has a potential aliases field, include it safely
      const anyD: any = d as any;
      if (Array.isArray(anyD.aliases)) {
        for (const a of anyD.aliases as string[]) {
          const aKey = normalizeKey(a);
          if (!aKey) continue;
          const arr = state.aliasIndex.get(aKey) ?? [];
          arr.push(d.code);
          state.aliasIndex.set(aKey, arr);
        }
      }
    }

    // Fuse.js setup for fuzzy search
    const fuseOptions: Fuse.IFuseOptions<ICD10Disease> = {
      keys: [
        'code',
        'name',
        'hierarchy.chapter.name',
        'hierarchy.section.name',
        'hierarchy.category.name',
        'hierarchy.subcategory.name',
      ],
      includeScore: true,
      threshold: 0.25,
    } as any;
    // @ts-ignore - Fuse is a JS lib with loose typing in this env
    state.fuse = new Fuse(state.diseases, fuseOptions);

    // Optional warm-up: preload hot data (first 50-100 items)
    try {
      const preloadCodes = state.diseases.slice(0, 100).map((d) => d.code).filter(Boolean) as string[];
      await preload(preloadCodes);
    } catch {
      // no-op if preload fails
    }

    state.initialized = true;
  } catch (err) {
    console.error('[ICD10Cache] initialize failed:', err);
    throw err;
  }
}

// Core lookup: O(1) by code with simple LRU cache
export async function getByCode(code: string): Promise<ICD10Disease | null> {
  if (!state.initialized) await initialize();
  const key = (code ?? '').trim();
  const cached = state.codeCache.get(key);
  if (cached !== undefined && cached !== null) {
    state.hits += 1;
    return cached;
  }
  state.misses += 1;
  const disease = state.byCodeIndex.get(key) ? state.codeIndex.get(key) ?? null : null;
  const result = disease ?? null;
  state.codeCache.set(key, result);
  if (result) state.byIdIndex.set(result.id, result);
  return result;
}

export async function getById(id: string): Promise<ICD10Disease | null> {
  if (!state.initialized) await initialize();
  const d = state.byIdIndex.get(id) ?? null;
  return d;
}

// Simple paged-like listing (utility, if needed by UI)
export async function search(query: string, limit: number = 20): Promise<ICD10Disease[]> {
  if (!state.initialized) await initialize();
  if (!state.fuse) return [] as ICD10Disease[];
  const results = state.fuse.search(query) as any[];
  // Fuse returns items in form { item, score } or direct items depending on version
  const items: ICD10Disease[] = [];
  for (const r of results) {
    if (r && typeof r === 'object' && 'item' in r) {
      items.push((r as any).item as ICD10Disease);
    } else {
      items.push(r as ICD10Disease);
    }
  }
  return items.slice(0, limit);
}

// Preload specific codes to warm caches
export async function preload(codes: string[]): Promise<void> {
  if (!state.initialized) await initialize();
  if (!codes || codes.length === 0) return;
  for (const c of codes) {
    // trigger a lookup and cache fill
    await getByCode(c);
  }
}

export function getStats() {
  return {
    hits: state.hits,
    misses: state.misses,
    cacheSize: state.codeCache ?  (state.codeCache as any).capacity : 0,
  };
}

export function clear(): void {
  state.initialized = false;
  state.diseases = [];
  state.byCodeIndex = new Map();
  state.byIdIndex = new Map();
  state.codeIndex = new Map();
  state.nameIndex = new Map();
  state.aliasIndex = new Map();
  state.fuse = null;
  state.codeCache.clear();
  state.hits = 0;
  state.misses = 0;
}

export default {
  initialize,
  getByCode,
  getById,
  search,
  preload,
  getStats,
  clear,
};
