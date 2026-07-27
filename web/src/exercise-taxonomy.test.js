import { describe, it, expect } from 'vitest';
import { CATEGORY_ORDER, ALL_TAGS, suggestClassification } from './exercise-taxonomy.js';

describe('常數', () => {
  it('主分類為議定的 9 項且順序固定', () => {
    expect(CATEGORY_ORDER).toEqual(['胸', '背', '肩', '臀', '腿', '手', '核心', '有氧', '其他']);
  });
  it('tag 為議定的 13 項', () => {
    expect(ALL_TAGS).toEqual([
      '推', '拉', '蹲', '髖鉸鏈',
      '槓鈴', '啞鈴', '機械', '滑輪', '自體重量', '壺鈴', '彈力帶',
      '複合', '單關節',
    ]);
  });
});

describe('suggestClassification 主分類', () => {
  it.each([
    ['槓鈴臥推', '胸'],
    ['啞鈴飛鳥', '胸'],
    ['滑輪下拉', '背'],
    ['槓鈴划船', '背'],
    ['傳統硬舉', '背'],
    ['站姿肩推', '肩'],
    ['啞鈴側平舉', '肩'],
    ['槓鈴臀推', '臀'],
    ['髖外展機', '臀'],
    ['背蹲舉', '腿'],
    ['腿推機', '腿'],
    ['啞鈴彎舉', '手'],
    ['三頭下壓', '手'],
    ['腹部捲腹', '核心'],
    ['棒式', '核心'],
    ['跑步機', '有氧'],
  ])('%s → %s', (name, expected) => {
    expect(suggestClassification(name).category).toBe(expected);
  });
});

describe('suggestClassification 長字優先（短詞不可誤命中）', () => {
  it('肩推不可被「推」判成胸', () => {
    expect(suggestClassification('肩推').category).toBe('肩');
  });
  it('腿推不可被「推」判成胸', () => {
    expect(suggestClassification('腿推').category).toBe('腿');
  });
  it('腿彎舉不可被「彎舉」判成手', () => {
    expect(suggestClassification('腿彎舉').category).toBe('腿');
  });
  it('划船機不可被「划船」判成背', () => {
    expect(suggestClassification('划船機').category).toBe('有氧');
  });
});

describe('suggestClassification 器材 tag', () => {
  it.each([
    ['槓鈴臥推', '槓鈴'],
    ['啞鈴肩推', '啞鈴'],
    ['滑輪下拉', '滑輪'],
    ['壺鈴擺盪', '壺鈴'],
    ['彈力帶側走', '彈力帶'],
    ['腿推機', '機械'],
  ])('%s 帶出 %s', (name, tag) => {
    expect(suggestClassification(name).tags).toContain(tag);
  });
  it('徒手動作帶出自體重量', () => {
    expect(suggestClassification('徒手深蹲').tags).toContain('自體重量');
  });
});

describe('suggestClassification 動作模式 tag', () => {
  it('臥推帶出推', () => {
    expect(suggestClassification('槓鈴臥推').tags).toContain('推');
  });
  it('划船帶出拉', () => {
    expect(suggestClassification('槓鈴划船').tags).toContain('拉');
  });
  it('深蹲帶出蹲', () => {
    expect(suggestClassification('背蹲舉').tags).toContain('蹲');
  });
  it('硬舉同時帶出拉與髖鉸鏈', () => {
    const tags = suggestClassification('傳統硬舉').tags;
    expect(tags).toContain('拉');
    expect(tags).toContain('髖鉸鏈');
  });
});

describe('suggestClassification 認不出來', () => {
  it('無法辨識時回空分類與空 tag，不亂猜', () => {
    expect(suggestClassification('教練自創動作X')).toEqual({ category: '', tags: [] });
  });
  it('空值與非字串安全', () => {
    expect(suggestClassification('')).toEqual({ category: '', tags: [] });
    expect(suggestClassification(null)).toEqual({ category: '', tags: [] });
    expect(suggestClassification(undefined)).toEqual({ category: '', tags: [] });
    expect(suggestClassification(12345)).toEqual({ category: '', tags: [] });
  });
  it('前後空白不影響辨識', () => {
    expect(suggestClassification('  槓鈴臥推  ').category).toBe('胸');
  });
  it('tag 不重複', () => {
    const tags = suggestClassification('槓鈴臥推').tags;
    expect(new Set(tags).size).toBe(tags.length);
  });
});
