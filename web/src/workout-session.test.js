import { describe, expect, it } from 'vitest';
import { workoutSessionInternals } from './workout-session.js';

const { normalizeSessionNote, withSessionNote } = workoutSessionInternals;

describe('workout session metadata helpers', () => {
  it('normalizes line endings without changing note content', () => {
    expect(normalizeSessionNote('睡眠不足\r\n右肩緊')).toBe('睡眠不足\n右肩緊');
  });

  it('adds the same session note to every set without mutating the source array', () => {
    const input = [
      { motion: '槓鈴臥推', reps: 8 },
      { motion: '槓鈴臥推', reps: 7 },
    ];

    const result = withSessionNote(input, '今天整體狀態良好');

    expect(result).toEqual([
      { motion: '槓鈴臥推', reps: 8, session_note: '今天整體狀態良好' },
      { motion: '槓鈴臥推', reps: 7, session_note: '今天整體狀態良好' },
    ]);
    expect(input[0]).not.toHaveProperty('session_note');
  });

  it('returns an empty array for invalid workout data', () => {
    expect(withSessionNote(null, 'note')).toEqual([]);
  });
});
