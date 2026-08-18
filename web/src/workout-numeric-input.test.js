import { describe, expect, it } from 'vitest';
import { workoutNumericInputInternals } from './workout-numeric-input.js';

const {
  formatNumericValue,
  appendDigit,
  appendDecimal,
  backspaceBuffer,
  adjustedValue,
  valueFromBuffer,
} = workoutNumericInputInternals;

describe('workout numeric input helpers', () => {
  it('重量保留最多兩位小數並移除多餘零', () => {
    expect(formatNumericValue(80, 'weight')).toBe('80');
    expect(formatNumericValue(81.25, 'weight')).toBe('81.25');
    expect(formatNumericValue(81.5, 'weight')).toBe('81.5');
  });

  it('重量可輸入小數，但 reps 維持整數', () => {
    expect(appendDecimal('80', 'weight')).toBe('80.');
    expect(appendDigit('80.', '2', 'weight')).toBe('80.2');
    expect(appendDigit('80.25', '5', 'weight')).toBe('80.25');
    expect(appendDecimal('8', 'reps')).toBe('8');
  });

  it('快速調整會套用上下限', () => {
    expect(adjustedValue('80', 2.5, 'weight')).toBe('82.5');
    expect(adjustedValue('1.25', -5, 'weight')).toBe('0');
    expect(adjustedValue('998', 5, 'reps')).toBe('999');
  });

  it('退格與清空可產生正確的 input 值', () => {
    expect(backspaceBuffer('82.5')).toBe('82.');
    expect(valueFromBuffer('82.', 'weight')).toBe('82');
    expect(valueFromBuffer('', 'weight')).toBe('');
  });

  it('不允許輸入超過欄位上限', () => {
    expect(appendDigit('999', '9', 'reps')).toBe('999');
    expect(appendDigit('1000', '1', 'weight')).toBe('1000');
  });
});
