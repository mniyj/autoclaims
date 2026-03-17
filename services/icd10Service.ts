import Fuse from 'fuse.js';
import type { ICD10Disease, MatchingResult, PagedResult, SearchOptions } from '../types/icd10';
export interface ListOptions {
  page?: number;
  pageSize?: number;
  sortBy?: 'code' | 'name' | 'chapter' | 'category';
  sortOrder?: 'asc' | 'desc';
}

export interface Chapter {
  number: number;
  codeRange: string;
  name: string;
}

type __ICD10Raw = ICD10Disease;

// Simple LRU Cache implementation
class LRUCache<K, V> {
  private capacity: number;
  private map: Map<K, V>;
  constructor(capacity: number) {
    this.capacity = capacity;
    this.map = new Map<K, V>();
  }
  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const val = this.map.get(key) as V;
    // refresh recent usage
    this.map.delete(key);
    this.map.set(key, val);
    return val;
  }
  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    }
    this.map.set(key, value);
    if (this.map.size > this.capacity) {
      // remove oldest
      const oldestKey = this.map.keys().next().value as K;
      this.map.delete(oldestKey);
    }
  }
  has(key: K): boolean {
    return this.map.has(key);
  }
}

type ICD10InternalState = {
  initialized: boolean;
  diseases: ICD10Disease[];
  byId: Map<string, ICD10Disease>;
  byCodeIndex: Map<string, string>; // normalized code -> id
  chapters: Chapter[];
  sections: any[];
  categories: any[];
  subcategories: any[];
  fuse: Fuse<ICD10Disease> | null;
  codeCache: LRUCache<string, ICD10Disease | null>;
  idCache: LRUCache<string, ICD10Disease | null>;
};

let state: ICD10InternalState = {
  initialized: false,
  diseases: [],
  byId: new Map<string, ICD10Disease>(),
  byCodeIndex: new Map<string, string>(),
  chapters: [],
  sections: [],
  categories: [],
  subcategories: [],
  fuse: null,
  codeCache: new LRUCache<string, ICD10Disease | null>(256),
  idCache: new LRUCache<string, ICD10Disease | null>(256),
};

// Normalize code/key for robust lookups
const normalizeCodeKey = (s: string) => s.replace(/\s+/g, '').trim();

// Initialize data and in-memory indexes
export async function initialize(): Promise<void> {
  if (state.initialized) return;
  try {
    // Load core ICD-10 data
    const diseasesModule = await import('../../jsonlist/icd10/diseases.json');
    const data: ICD10Disease[] = (diseasesModule?.default ?? diseasesModule) as ICD10Disease[];
    state.diseases = data;
    state.byId = new Map<string, ICD10Disease>();
    for (const d of state.diseases) state.byId.set(d.id, d);

    // Load indexes (fast lookups by code, chapter, category)
    const idxModule = await import('../../jsonlist/icd10/indexes.json');
    const idx = (idxModule?.default ?? idxModule) as any;
    const byCodeRaw: Record<string, string> = idx?.byCode || {};
    state.byCodeIndex = new Map<string, string>();
    for (const [codeKey, id] of Object.entries(byCodeRaw)) {
      state.byCodeIndex.set(normalizeCodeKey(codeKey), id as string);
    }

    // Load chapter/section/category metadata for filtering/views
    const chaptersModule = await import('../../jsonlist/icd10/chapters.json');
    state.chapters = (chaptersModule?.default ?? chaptersModule) as Chapter[];
    const sectionsModule = await import('../../jsonlist/icd10/sections.json');
    state.sections = (sectionsModule?.default ?? sectionsModule) as any[];
    const categoriesModule = await import('../../jsonlist/icd10/categories.json');
    state.categories = (categoriesModule?.default ?? categoriesModule) as any[];
    const subcategoriesModule = await import('../../jsonlist/icd10/subcategories.json');
    state.subcategories = (subcategoriesModule?.default ?? subcategoriesModule) as any[];

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

    state.initialized = true;
  } catch (err) {
    // keep error details actionable
    console.error('[ICD10] initialize failed:', err);
    throw err;
  }
}

// Core CRUD-ish lookups
export async function getByCode(code: string): Promise<ICD10Disease | null> {
  if (!state.initialized) await initialize();
  const key = normalizeCodeKey(code);
  const cached = state.codeCache.get(key);
  if (cached !== undefined) return cached;

  const id = state.byCodeIndex.get(key);
  if (!id) {
    state.codeCache.set(key, null);
    return null;
  }
  const disease = state.byId.get(id) ?? state.diseases.find(d => d.id === id) ?? null;
  state.codeCache.set(key, disease as ICD10Disease | null);
  if (disease) state.idCache.set(disease.id, disease);
  return disease ?? null;
}

export async function getById(id: string): Promise<ICD10Disease | null> {
  if (!state.initialized) await initialize();
  const cached = state.idCache.get(id);
  if (cached !== undefined) return cached;
  const disease = state.byId.get(id) ?? state.diseases.find(d => d.id === id) ?? null;
  state.idCache.set(id, disease as ICD10Disease | null);
  if (disease) {
    // also prime byCode cache if possible
    for (const [codeKey, di] of state.byCodeIndex.entries()) {
      if (di === id) {
        state.codeCache.set(codeKey, disease);
        break;
      }
    }
  }
  return disease ?? null;
}

export async function list(options: ListOptions = {}): Promise<PagedResult<ICD10Disease>> {
  if (!state.initialized) await initialize();
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.max(1, options.pageSize ?? 20);
  const sortBy = options.sortBy ?? 'code';
  const sortOrder = options.sortOrder ?? 'asc';

  let items = [...state.diseases];
  // simple, stable sort on chosen field
  items.sort((a, b) => {
    const va = (a as any)[sortBy] ?? a.name;
    const vb = (b as any)[sortBy] ?? b.name;
    if (va < vb) return sortOrder === 'asc' ? -1 : 1;
    if (va > vb) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const paged = items.slice(start, end);
  return {
    items: paged,
    total,
    page,
    pageSize,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

export type SearchResult = MatchingResult<ICD10Disease>;
export async function search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
  if (!state.initialized) await initialize();
  if (!state.fuse) return [];
  const results = state.fuse.search(query);
  // Fuse returns items with score; map to our structure
  return results.map(r => ({ item: (r as any).item, score: (r as any).score ?? 0, highlights: [] } as any));
}

// --------- Filter helpers (simple in-memory filters) ---------
export function getByChapter(chapterNumber: number): ICD10Disease[] {
  if (!state.initialized) {
    // initialize synchronously-ish; in practice this should be awaited by caller
    // but for light usage, attempt to initialize asynchronously
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    initialize();
  }
  return state.diseases.filter(d => d.hierarchy?.chapter?.number === chapterNumber);
}

export function getByCategory(categoryCode: string): ICD10Disease[] {
  if (!state.initialized) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    initialize();
  }
  return state.diseases.filter(d => d.hierarchy?.category?.code === categoryCode);
}

export function getAllChapters(): Chapter[] {
  if (!state.initialized) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    initialize();
  }
  return state.chapters;
}

export default {
  initialize,
  getByCode,
  getById,
  list,
  search,
  getByChapter,
  getByCategory,
  getAllChapters,
};
