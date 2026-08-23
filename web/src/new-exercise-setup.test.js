import { describe, expect, it } from 'vitest';
import { normalizeNewExerciseSetup } from './new-exercise-setup.js';

describe('new exercise setup normalization', () => {
    it('keeps unilateral per-hand weight semantics', () => {
        expect(normalizeNewExerciseSetup({
            motion: ' 單手啞鈴划船 ',
            trackingType: 'weight_reps',
            laterality: 'unilateral',
            loadMode: 'per_hand',
            defaultRestSec: 90,
        })).toEqual({
            motion: '單手啞鈴划船',
            trackingType: 'weight_reps',
            laterality: 'unilateral',
            loadMode: 'per_hand',
            defaultRestSec: 90,
        });
    });

    it('forces duration exercises to total load mode', () => {
        expect(normalizeNewExerciseSetup({
            motion: '棒式',
            trackingType: 'duration',
            laterality: 'bilateral',
            loadMode: 'per_hand',
            defaultRestSec: 30,
        }).loadMode).toBe('total');
    });

    it('clamps rest time and falls back invalid enums', () => {
        expect(normalizeNewExerciseSetup({
            motion: '測試',
            trackingType: 'unknown',
            laterality: 'unknown',
            loadMode: 'unknown',
            defaultRestSec: 9999,
        })).toEqual({
            motion: '測試',
            trackingType: 'weight_reps',
            laterality: 'bilateral',
            loadMode: 'total',
            defaultRestSec: 600,
        });
    });
});
