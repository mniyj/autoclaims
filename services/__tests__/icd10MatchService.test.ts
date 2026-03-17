import { describe, it, expect } from 'vitest';
import * as icd10MatchService from '../icd10MatchService';

const svc: any = icd10MatchService;

describe('icd10MatchService', () => {
  it('matchDisease - Level 1 exact match', async () => {
    const result = await svc.matchDisease?.('A00.000');
    expect(result).toBeTruthy();
    expect(result.level).toBe(1);
    expect(result.matched).toBe(true);
  });

  it('matchDisease - Level 3 fuzzy match', async () => {
    const result = await svc.matchDisease?.('霍乱');
    expect(result).toBeTruthy();
    expect(result.matched).toBe(true);
  });

  it('batchMatch processes multiple inputs', async () => {
    const inputs = ['A00.000', 'A01.000', 'InvalidCode'];
    const results = await svc.batchMatch?.(inputs);
    expect(results).toBeTruthy();
    expect(results.size).toBe(3);
  });

  it('extractFromText finds ICD codes in text', async () => {
    const text = '患者诊断为 A00.000 和 B99.999';
    const results = await svc.extractFromText?.(text);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });
});
