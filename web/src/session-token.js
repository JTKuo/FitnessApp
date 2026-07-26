// Session token 結構判斷與 payload 解析（前後端共用純函式）。
// src/SessionToken.gs 由 `npm run sync:pr` 自動生成，勿手改該檔。
//
// ⚠️ 本模組不做任何安全驗證——它只負責「讀得懂」token。
// 真正的安全性由後端 Auth.gs 的 HMAC 簽章驗證保證。
// 前端僅用它判斷「手上這張是否還值得送出」。

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// 自行實作 base64url 解碼：瀏覽器的 atob 與 GAS 的 Utilities 介面不同，
// 純 JS 實作可讓前後端共用同一份程式碼。
function decodeBase64Url(input) {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  let bits = 0;
  let bitCount = 0;
  let out = '';
  for (let i = 0; i < b64.length; i++) {
    const idx = B64_ALPHABET.indexOf(b64.charAt(i));
    if (idx === -1) continue; // 略過補位字元與非法字元
    bits = ((bits << 6) | idx) & 0xffffff; // 遮罩避免累積溢位，保留所需的低位元
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      out += String.fromCharCode((bits >> bitCount) & 0xff);
    }
  }
  return out;
}

/** token 是否為本專案 session token 的結構（恰 1 個點；Google JWT 為 2 個點）。 */
export function isSessionTokenShape(token) {
  if (!token || typeof token !== 'string') return false;
  return token.split('.').length === 2;
}

/** 解析 payload（不驗簽）。任何異常一律回 null，絕不拋錯。 */
export function parseSessionTokenPayload(token) {
  if (!isSessionTokenShape(token)) return null;
  try {
    const obj = JSON.parse(decodeBase64Url(token.split('.')[0]));
    if (!obj || typeof obj.e !== 'string' || typeof obj.x !== 'number') return null;
    return { email: obj.e, expiresAt: obj.x };
  } catch (err) {
    return null;
  }
}
