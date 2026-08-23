import { describe, expect, it } from 'vitest';
import { filterPickerCatalog, normalizePickerCatalog, resolveRecentPickerExercises } from './workout-picker-v2.js';

const catalog = [
    { motion: '史密斯肩推', category: '肩', tags: ['機械', '推'], active: true },
    { motion: '啞鈴肩推', category: '肩', tags: ['啞鈴', '推'], active: true },
    { motion: '滑輪下拉', category: '背', tags: ['滑輪', '拉'], active: true },
    { motion: '棒式', category: '核心', tags: ['自體重量'], active: true },
    { motion: '停用動作', category: '其他', tags: [], active: false },
];

describe('Workout Picker 2.0 catalog helpers', () => {
    it('excludes inactive exercises and normalizes tags', () => {
        const normalized = normalizePickerCatalog([
            ...catalog,
            { motion: '槓鈴深蹲', category: '腿', tags: '槓鈴,蹲', active: 'TRUE' },
        ]);
        expect(normalized.some(item => item.motion === '停用動作')).toBe(false);
        expect(normalized.find(item => item.motion === '槓鈴深蹲').tags).toEqual(['槓鈴', '蹲']);
    });

    it('searches across motion, category and tags', () => {
        expect(filterPickerCatalog(catalog, { query: '肩' }).map(item => item.motion))
            .toEqual(['史密斯肩推', '啞鈴肩推']);
        expect(filterPickerCatalog(catalog, { query: '滑輪' }).map(item => item.motion))
            .toContain('滑輪下拉');
        expect(filterPickerCatalog(catalog, { query: '核心' }).map(item => item.motion))
            .toEqual(['棒式']);
    });

    it('combines category and tag filters', () => {
        expect(filterPickerCatalog(catalog, { category: '肩', tag: '啞鈴' }).map(item => item.motion))
            .toEqual(['啞鈴肩推']);
        expect(filterPickerCatalog(catalog, { category: '肩', tag: '滑輪' }))
            .toEqual([]);
    });

    it('preserves backend recent-use order and removes missing or duplicate items', () => {
        const recent = resolveRecentPickerExercises(
            catalog,
            ['滑輪下拉', '史密斯肩推', '滑輪下拉', '不存在', '棒式'],
            3,
        );
        expect(recent.map(item => item.motion)).toEqual(['滑輪下拉', '史密斯肩推', '棒式']);
    });
});
