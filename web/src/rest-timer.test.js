import { describe, expect, it } from 'vitest';
import { restTimerInternals } from './rest-timer.js';

const {
  normalizeEmail,
  storageKey,
  remainingSeconds,
  adjustedEndsAt,
  formatTime,
  isUserSwitchSettled,
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

  it('Admin 切換成功或失敗回原使用者都能結束 watcher', () => {
    // 成功切到目標使用者。
    expect(isUserSwitchSettled('student@example.com', 'student@example.com', 'admin@example.com', false)).toBe(true);
    // API 失敗後仍停在原使用者，也應視為 settled，恢復原使用者 timer。
    expect(isUserSwitchSettled('admin@example.com', 'student@example.com', 'admin@example.com', false)).toBe(true);
    // loading overlay 還在時不能提早收尾。
    expect(isUserSwitchSettled('student@example.com', 'student@example.com', 'admin@example.com', true)).toBe(false);
    // 不明第三個使用者也不能誤判完成。
    expect(isUserSwitchSettled('other@example.com', 'student@example.com', 'admin@example.com', false)).toBe(false);
  });
});
