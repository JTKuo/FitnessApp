import { describe, it, expect } from 'vitest';
import { isSessionTokenShape, parseSessionTokenPayload } from './session-token.js';

// 測試用：以 Node 的 Buffer 產生 base64url（不依賴受測程式碼）
const b64url = (s) =>
  Buffer.from(s, 'utf8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const makeToken = (payloadObj, sig = 'fakesig') =>
  `${b64url(JSON.stringify(payloadObj))}.${sig}`;

describe('isSessionTokenShape', () => {
  it('1 個點視為 session token', () => {
    expect(isSessionTokenShape('abc.def')).toBe(true);
  });
  it('2 個點（Google JWT）不視為 session token', () => {
    expect(isSessionTokenShape('aaa.bbb.ccc')).toBe(false);
  });
  it('無點或非字串回 false', () => {
    expect(isSessionTokenShape('abcdef')).toBe(false);
    expect(isSessionTokenShape('')).toBe(false);
    expect(isSessionTokenShape(null)).toBe(false);
    expect(isSessionTokenShape(undefined)).toBe(false);
    expect(isSessionTokenShape(12345)).toBe(false);
  });
});

describe('parseSessionTokenPayload', () => {
  it('解析出 email 與到期時間', () => {
    const token = makeToken({ e: 'a@b.com', x: 1893456000 });
    expect(parseSessionTokenPayload(token)).toEqual({
      email: 'a@b.com',
      expiresAt: 1893456000,
    });
  });
  it('email 內含點不影響解析（base64url 不產生點）', () => {
    const token = makeToken({ e: 'first.last@example.co.uk', x: 100 });
    expect(parseSessionTokenPayload(token).email).toBe('first.last@example.co.uk');
  });
  it('Google JWT（3 段）回 null', () => {
    expect(parseSessionTokenPayload('aaa.bbb.ccc')).toBeNull();
  });
  it('空值與非字串回 null', () => {
    expect(parseSessionTokenPayload('')).toBeNull();
    expect(parseSessionTokenPayload(null)).toBeNull();
  });
  it('payload 非合法 JSON 時回 null 而非拋錯', () => {
    expect(parseSessionTokenPayload('bm90anNvbg.sig')).toBeNull();
  });
  it('缺少必要欄位回 null', () => {
    expect(parseSessionTokenPayload(makeToken({ e: 'a@b.com' }))).toBeNull();
    expect(parseSessionTokenPayload(makeToken({ x: 100 }))).toBeNull();
  });
  it('欄位型別錯誤回 null', () => {
    expect(parseSessionTokenPayload(makeToken({ e: 'a@b.com', x: '100' }))).toBeNull();
  });
});
