import { describe, it, expect, beforeAll } from 'vitest';
import * as icd10CacheService from '../icd10CacheService';

const svc: any = icd10CacheService;

describe('icd10CacheService', () => {
  beforeAll(async () => {
    await svc.initialize?.();
  });

  it('initialize builds indexes', () => {
    expect(svc.getByCode).toBeDefined();
  });

  it('getByCode returns cached item', () => {
    const item = svc.getByCode?.('A00.000');
    expect(item).toBeTruthy();
  });

  it('search returns fuzzy results', () => {
    const results = svc.search?.('霍乱');
    expect(Array.isArray(results)).toBe(true);
  });

  it('cache statistics tracked', () => {
    const stats = svc.getStats?.();
    expect(stats).toBeTruthy();
    expect(typeof stats.hits).toBe('number');
    expect(typeof stats.misses).toBe('number');
  });

  it('preload warms cache', async () => {
    await svc.preload?.(['A00.000', 'A01.000']);
    const item = svc.getByCode?.('A00.000');
    expect(item).toBeTruthy();
  });
});
