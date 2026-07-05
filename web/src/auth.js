// Google Identity Services (GIS) 登入與 token 管理
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

let idToken = null;
let tokenExp = 0;
let signInCallback = null;

function whenGisReady(fn) {
  if (window.google && window.google.accounts && window.google.accounts.id) return fn();
  setTimeout(() => whenGisReady(fn), 100);
}

function handleCredential(response) {
  idToken = response.credential;
  try {
    tokenExp = JSON.parse(atob(idToken.split('.')[1])).exp;
  } catch {
    tokenExp = Math.floor(Date.now() / 1000) + 3000; // 解析失敗保守估 50 分鐘
  }
  document.getElementById('login-screen')?.classList.add('hidden');
  if (signInCallback) signInCallback();
}

export function initAuth(onSignIn) {
  signInCallback = onSignIn;
  whenGisReady(() => {
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

/** 有效（未過期）token；無則回 null。 */
export function getValidToken() {
  if (idToken && Date.now() / 1000 < tokenExp - 60) return idToken;
  return null;
}

/** token 失效時：顯示登入畫面並嘗試 One Tap 靜默續期。 */
export function requestReauth() {
  idToken = null;
  document.getElementById('login-screen')?.classList.remove('hidden');
  whenGisReady(() => window.google.accounts.id.prompt());
}
