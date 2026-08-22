import { describe, expect, it } from 'vitest';
import { flexibleSetInternals } from './flexible-set.js';

const {
  normalizeMetadata,
  descriptorKey,
  enrichWorkoutData,
} = flexibleSetInternals;

describe('flexible set helpers', () => {
  it('normalizes ExerciseMaster metadata conservatively', () => {
    expect(normalizeMetadata({ motion: '棒式', trackingType: 'duration', defaultRestSec: '45' })).toMatchObject({
      motion: '棒式',
      trackingType: 'duration',
      loadMode: 'total',
      laterality: 'bilateral',
      defaultRestSec: 45,
      active: true,
    });

    expect(normalizeMetadata({ motion: '臥推', trackingType: 'unknown' }).trackingType).toBe('weight_reps');
  });

  it('keeps legacy weight/reps rows while adding set semantics', () => {
    const legacy = [{
      date: '2026-08-22T09:00:00.000Z',
      motion: '槓鈴臥推',
      set: 1,
      weight: 80,
      unit: '公斤',
      reps: 8,
      weight_in_kg: 80,
      note: '',
    }];
    const descriptors = [{
      motion: '槓鈴臥推',
      set: 1,
      note: '',
      setType: 'warmup',
      trackingType: 'weight_reps',
      durationSec: 0,
      exerciseId: 'ex_bench',
      side: 'both',
      loadMode: 'total',
    }];

    const result = enrichWorkoutData(legacy, descriptors, legacy[0].date);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      weight: 80,
      reps: 8,
      set_type: 'warmup',
      tracking_type: 'weight_reps',
      exercise_id: 'ex_bench',
      side: 'both',
      load_mode: 'total',
    });
  });

  it('creates a duration row even when legacy collector has no weight/reps row', () => {
    const descriptors = [{
      motion: '棒式',
      set: 1,
      note: '核心',
      setType: 'working',
      trackingType: 'duration',
      durationSec: 60,
      exerciseId: 'ex_plank',
      side: 'both',
      loadMode: 'bodyweight',
    }];

    const result = enrichWorkoutData([], descriptors, '2026-08-22T09:00:00.000Z');
    expect(result).toEqual([expect.objectContaining({
      motion: '棒式',
      set: 1,
      weight: 0,
      reps: 0,
      duration_sec: 60,
      tracking_type: 'duration',
      set_type: 'working',
      exercise_id: 'ex_plank',
      load_mode: 'bodyweight',
    })]);
  });

  it('drops stale hidden weight/reps data when an exercise switches to duration', () => {
    const legacy = [{
      date: '2026-08-22T09:00:00.000Z', motion: '棒式', set: 1,
      weight: 20, unit: '公斤', reps: 10, weight_in_kg: 20, note: '',
    }];
    const descriptors = [{
      motion: '棒式', set: 1, setType: 'working', trackingType: 'duration', durationSec: 45,
      exerciseId: 'ex_plank', side: 'both', loadMode: 'bodyweight', note: '',
    }];

    const result = enrichWorkoutData(legacy, descriptors, '2026-08-22T09:00:00.000Z');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ tracking_type: 'duration', duration_sec: 45, weight: 0, reps: 0 });
  });

  it('ignores empty duration rows', () => {
    const descriptors = [{
      motion: '棒式', set: 1, setType: 'working', trackingType: 'duration', durationSec: 0,
      exerciseId: 'ex_plank', side: 'both', loadMode: 'bodyweight', note: '',
    }];
    expect(enrichWorkoutData([], descriptors, '2026-08-22T09:00:00.000Z')).toEqual([]);
  });

  it('uses motion and set number as descriptor key', () => {
    expect(descriptorKey({ motion: '槓鈴臥推', set: 2 })).toBe('槓鈴臥推::2');
  });
});
