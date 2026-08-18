import { describe, expect, it } from 'vitest';
import { workoutDraftInternals } from './workout-draft.js';

const { normalizeEmail, storageKey, fingerprint } = workoutDraftInternals;

describe('workout draft helpers', () => {
  it('使用正規化 email 建立每位使用者獨立的 storage key', () => {
    expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com');
    expect(storageKey('  User@Example.COM ')).toBe('fitnessapp_workout_draft:user@example.com');
    expect(storageKey('')).toBeNull();
  });

  it('fingerprint 只比較會影響訓練內容的欄位', () => {
    const base = {
      version: 1,
      date: '2026-08-18',
      exercises: [{
        name: '槓鈴臥推',
        note: '肩膀正常',
        sets: [{ weight: '80', reps: '8', unit: '公斤' }],
      }],
    };

    expect(fingerprint({ ...base, savedAt: '2026-08-18T01:00:00.000Z' }))
      .toBe(fingerprint({ ...base, savedAt: '2026-08-18T02:00:00.000Z' }));
  });

  it('重量或次數改變時 fingerprint 會改變', () => {
    const first = {
      version: 1,
      date: '2026-08-18',
      exercises: [{ name: '深蹲', note: '', sets: [{ weight: '100', reps: '5', unit: '公斤' }] }],
    };
    const second = {
      ...first,
      exercises: [{ name: '深蹲', note: '', sets: [{ weight: '100', reps: '6', unit: '公斤' }] }],
    };

    expect(fingerprint(first)).not.toBe(fingerprint(second));
  });
});
