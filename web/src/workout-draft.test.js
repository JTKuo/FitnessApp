import { describe, expect, it } from 'vitest';
import { workoutDraftInternals } from './workout-draft.js';

const { normalizeEmail, storageKey, fingerprint, hasDraftContent } = workoutDraftInternals;

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
      sessionNote: '今天睡眠不足',
      exercises: [{
        name: '槓鈴臥推',
        note: '肩膀正常',
        sets: [{ weight: '80', reps: '8', unit: '公斤' }],
      }],
    };

    expect(fingerprint({ ...base, savedAt: '2026-08-18T01:00:00.000Z' }))
      .toBe(fingerprint({ ...base, savedAt: '2026-08-18T02:00:00.000Z' }));
  });

  it('重量、次數或全日備註改變時 fingerprint 會改變', () => {
    const first = {
      version: 1,
      date: '2026-08-18',
      sessionNote: '',
      exercises: [{ name: '深蹲', note: '', sets: [{ weight: '100', reps: '5', unit: '公斤' }] }],
    };
    const repsChanged = {
      ...first,
      exercises: [{ name: '深蹲', note: '', sets: [{ weight: '100', reps: '6', unit: '公斤' }] }],
    };
    const noteChanged = { ...first, sessionNote: '今天腿很重' };
    const setTypeChanged = {
      ...first,
      exercises: [{ name: '深蹲', note: '', sets: [{ weight: '100', reps: '5', unit: '公斤', setType: 'warmup' }] }],
    };

    expect(fingerprint(first)).not.toBe(fingerprint(repsChanged));
    expect(fingerprint(first)).not.toBe(fingerprint(noteChanged));
    expect(fingerprint(first)).not.toBe(fingerprint(setTypeChanged));
  });

  it('只有 session note 也算有效草稿內容', () => {
    expect(hasDraftContent({ exercises: [], sessionNote: '今天狀態差' })).toBe(true);
    expect(hasDraftContent({ exercises: [], sessionNote: '   ' })).toBe(false);
  });
});
