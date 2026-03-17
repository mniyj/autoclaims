import { describe, it, expect, beforeAll } from 'vitest';
import * as icd10Service from '../icd10Service';

const svc: any = icd10Service;

describe('icd10Service', () => {
  beforeAll(async () => {
    await svc.initialize?.();
  });

  it('initialize() loads data successfully', () => {
    const list: any[] = svc.list?.() ?? [];
    expect(Array.isArray(list)).toBe(true);
  });

  it('getByCode returns correct disease', () => {
    const item = svc.getByCode?.('A00.000');
    expect(item).toBeTruthy();
    if (item) {
      expect(item.code).toBe('A00.000');
    }
  });

  it('getById returns correct disease', () => {
    const byCode = svc.getByCode?.('A00.000');
    if (byCode?.id) {
      const byId = svc.getById?.(byCode.id);
      expect(byId).toBeTruthy();
      expect(byId?.code).toBe('A00.000');
    }
  });

  it('list() returns paginated results', () => {
    const list = svc.list?.({ page: 1, pageSize: 10 });
    expect(Array.isArray(list?.items ?? list)).toBe(true);
  });

  it('search() finds diseases by name', () => {
    const results: any[] = svc.search?.('霍乱') ?? [];
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it('getByChapter filters by chapter', () => {
    const results = svc.getByChapter?.(1);
    expect(Array.isArray(results)).toBe(true);
  });

  it('getByCategory filters by category', () => {
    const results = svc.getByCategory?.('A00');
    expect(Array.isArray(results)).toBe(true);
  });
});
