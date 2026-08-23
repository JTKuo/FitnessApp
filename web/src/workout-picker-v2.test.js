import { describe, expect, it } from 'vitest';
import {
    buildFavoriteMetadataPayload,
    filterPickerCatalog,
    getAvailablePickerCategories,
    getAvailablePickerTags,
    normalizePickerCatalog,
    resolveFavoritePickerExercises,
    resolveRecentPickerExercises,
} from './workout-picker-v2.js';

const catalog = [
    { motion: '史密斯肩推', category: '肩', tags: ['機械', '推'], active: true, trackingType: 'weight_reps', loadMode: 'total', laterality: 'bilateral', defaultRestSec: 60 },
    { motion: '啞鈴肩推', category: '肩', tags: ['啞鈴', '推'], active: true, trackingType: 'weight_reps', loadMode: 'per_hand', laterality: 'bilateral', defaultRestSec: 90 },
    { motion: '滑輪下拉', category: '背', tags: ['滑輪', '拉'], active: true },
    { motion: '棒式', category: '核心', tags: ['自體重量', '__fitnessapp_favorite__'], active: true, trackingType: 'duration', loadMode: 'total', laterality: 'bilateral', defaultRestSec: 30 },
    { motion: '空標籤胸推', category: '胸', tags: [], active: true },
    { motion: '停用動作', category: '其他', tags: ['槓鈴'], active: false },
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

    it('converts the runtime favorite marker into favorite metadata without exposing it as a tag', () => {
        const plank = normalizePickerCatalog(catalog).find(item => item.motion === '棒式');
        expect(plank.favorite).toBe(true);
        expect(plank.tags).toEqual(['自體重量']);
        expect(getAvailablePickerTags(catalog)).not.toContain('__fitnessapp_favorite__');
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

    it('only exposes categories and tags that active catalog data actually uses', () => {
        expect(getAvailablePickerCategories(catalog)).toEqual(['胸', '背', '肩', '核心']);
        expect(getAvailablePickerTags(catalog)).toEqual(['啞鈴', '機械', '滑輪', '自體重量', '推', '拉']);
        expect(getAvailablePickerTags(catalog, '胸')).toEqual([]);
        expect(getAvailablePickerTags(catalog, '肩')).toEqual(['啞鈴', '機械', '推']);
        expect(getAvailablePickerCategories(catalog, '滑輪')).toEqual(['背']);
    });

    it('preserves backend recent-use order and removes missing or duplicate items', () => {
        const recent = resolveRecentPickerExercises(
            catalog,
            ['滑輪下拉', '史密斯肩推', '滑輪下拉', '不存在', '棒式'],
            3,
        );
        expect(recent.map(item => item.motion)).toEqual(['滑輪下拉', '史密斯肩推', '棒式']);
    });

    it('resolves persistent favorites from the catalog', () => {
        expect(resolveFavoritePickerExercises(catalog).map(item => item.motion)).toEqual(['棒式']);
    });

    it('builds an idempotent metadata upsert payload without changing exercise semantics', () => {
        const item = normalizePickerCatalog(catalog).find(entry => entry.motion === '啞鈴肩推');
        expect(buildFavoriteMetadataPayload(item, true)).toEqual({
            motion: '啞鈴肩推',
            trackingType: 'weight_reps',
            loadMode: 'per_hand',
            laterality: 'bilateral',
            defaultRestSec: 90,
            favorite: true,
        });
    });
});
