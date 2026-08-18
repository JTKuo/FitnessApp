import { describe, expect, it } from 'vitest';
import { restTimerInternals } from './rest-timer.js';

const {
  normalizeEmail,
  storageKey,
  remainingSeconds,
  adjustedEndsAt,
  formatTime,
} = restTimerInternals;

describe('rest timer helpers', () => {
  it('每位使用者使用獨立的 timer storage key', () => {
    expect(normalizeEmail(' User@Example.COM ')).toBe('user@example.com');
    expect(storageKey(' User@Example.COM ')).toBe('fitnessapp_rest_timer:user@example.com');
    expect(storageKey('')).toBeNull();
  });

  it('剩餘秒數由絕對 endsAt 計算，不依賴 interval 次數', () => {
    const now = 1_000_000;
    expect(remainingSeconds(now + 30_000, now)).toBe(30);
    expect(remainingSeconds(now + 29_001, now)).toBe(30);
    expect(remainingSeconds(now - 1, now)).toBe(0);
  });

  it('加減休息時間直接調整 endsAt 並不允許低於現在', () => {
    const now = 1_000_000;
    expect(adjustedEndsAt(now + 30_000, 15, now)).toBe(now + 45_000);
    expect(adjustedEndsAt(now + 30_000, -15, now)).toBe(now + 15_000);
    expect(adjustedEndsAt(now + 5_000, -15, now)).toBe(now);
  });

  it('倒數格式維持 mm:ss', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(30)).toBe('00:30');
    expect(formatTime(90)).toBe('01:30');
  });
});
