// Google Identity Services (GIS) 登入與 session token 管理。
// 登入流程：GIS 取得 Google ID token → 呼叫 login action 換取 session token
// → 存入 localStorage（滑動 3 小時）→ 之後重載/關螢幕都不需重新登入。
import { parseSessionTokenPayload } from './session-token.js';
import { loginWithGoogleToken } from './api.js';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const STORAGE_KEY = 'fitnessapp_session';

let signInCallback = null;
let gisReady = false;
// localStorage 不可用時（例如私密瀏覽）的退路，至少維持本次頁面生命週期
let memoryToken = null;

function whenGisReady(fn) {
  if (window.google && window.google.accounts && window.google.accounts.id) return fn();
  setTimeout(() => whenGisReady(fn), 100);
}

function showLoginScreen(show) {
  document.getElementById('login-screen')?.classList.toggle('hidden', !show);
}

function setLoginError(message) {
  const el = document.getElementById('login-error');
  if (el) el.textContent = message || '';
}

/** 讀取仍在有效期內的 token；無則回 null（提前 60 秒視為失效）。 */
function readStoredToken() {
  let token = memoryToken;
  if (!token) {
    try {
      token = localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      return null;
    }
  }
  const parsed = parseSessionTokenPayload(token);
  if (!parsed) return null;
  if (Date.now() / 1000 >= parsed.expiresAt - 60) return null;
  return token;
}

/** 存入 session token（由 api.js 在每次回應時呼叫，達成滑動續期）。 */
export function storeSessionToken(token) {
  if (!token) return;
  memoryToken = token;
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch (err) {
    // 寫入失敗仍可靠 memoryToken 撐完本次頁面
  }
}

function clearSessionToken() {
  memoryToken = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    // 忽略：清不掉也不影響後續重新登入
  }
}

async function handleCredential(response) {
  try {
    setLoginError('');
    await loginWithGoogleToken(response.credential); // 成功時 api.js 已存好 session token
    if (!readStoredToken()) throw new Error('未取得有效的登入憑證，請重試。');
    showLoginScreen(false);
    if (signInCallback) signInCallback();
  } catch (err) {
    setLoginError(err.message);
  }
}

function setupGis() {
  if (gisReady) {
    whenGisReady(() => window.google.accounts.id.prompt());
    return;
  }
  whenGisReady(() => {
    gisReady = true;
    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: handleCredential,
      auto_select: true,
    });
    window.google.accounts.id.renderButton(
      document.getElementById('signin-button'),
      { theme: 'filled_black', size: 'large', locale: 'zh_TW' }
    );
    window.google.accounts.id.prompt(); // One Tap 靜默登入
  });
}

export function initAuth(onSignIn) {
  signInCallback = onSignIn;
  if (readStoredToken()) {
    // 已有有效 session：直接進入，完全不載入 Google 登入流程
    showLoginScreen(false);
    onSignIn();
    return;
  }
  setupGis();
}

/** 供 api.js 取用的有效憑證；無則回 null。 */
export function getValidToken() {
  return readStoredToken();
}

/** 憑證失效時：清除、顯示登入畫面並嘗試重新登入。 */
export function requestReauth() {
  clearSessionToken();
  showLoginScreen(true);
  setupGis();
}
