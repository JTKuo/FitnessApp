import { describe, it, expect } from 'vitest';
import { mergeBodyHistory } from './body-history.js';

describe('mergeBodyHistory', () => {
  it('同一天 preferred 覆蓋 base', () => {
    const base = [{ x: '2026-07-01T08:00:00.000Z', y: 98 }];
    const preferred = [{ x: '2026-07-01T14:00:00.000Z', y: 97.5 }];
    const result = mergeBodyHistory(base, preferred);
    expect(result).toHaveLength(1);
    expect(result[0].y).toBe(97.5);
  });
  it('不同日期合併並升冪排序', () => {
    const base = [{ x: '2026-07-03T00:00:00.000Z', y: 98 }];
    const preferred = [{ x: '2026-07-01T00:00:00.000Z', y: 99 }];
    const result = mergeBodyHistory(base, preferred);
    expect(result.map(p => p.y)).toEqual([99, 98]);
  });
  it('空與 null 輸入安全', () => {
    expect(mergeBodyHistory([], [])).toEqual([]);
    expect(mergeBodyHistory(null, [{ x: '2026-07-01T00:00:00.000Z', y: 1 }])).toHaveLength(1);
    expect(mergeBodyHistory([{ x: '2026-07-01T00:00:00.000Z', y: 1 }], null)).toHaveLength(1);
  });
  it('preferred 自身同日重複時後者為準（供 smm 去重複用）', () => {
    const result = mergeBodyHistory([], [
      { x: '2026-07-01T08:00:00.000Z', y: 38 },
      { x: '2026-07-01T09:00:00.000Z', y: 38.4 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].y).toBe(38.4);
  });
});
