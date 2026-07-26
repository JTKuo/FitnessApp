// =======================================================
// 認證 (Google ID Token 驗證)
// =======================================================

/**
 * 驗證前端傳來的 Google ID Token，回傳已驗證的 email。
 * 驗證失敗一律 throw（訊息含「憑證」或「授權」關鍵字，前端據此觸發重新登入）。
 * @param {string} idToken - GIS 取得的 ID Token (JWT)。
 * @returns {string} 已驗證且在白名單內的 email。
 */
function verifyToken(idToken) {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('缺少登入憑證，請重新登入。');
  }

  // 以 token 雜湊為 key 快取驗證結果，避免每個請求都外呼一次
  const cache = CacheService.getScriptCache();
  const cacheKey = 'tok_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken)
  ).substring(0, 60);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const resp = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
    { muteHttpExceptions: true }
  );
  if (resp.getResponseCode() !== 200) {
    throw new Error('登入憑證無效或已過期，請重新登入。');
  }

  const info = JSON.parse(resp.getContentText());
  if (info.aud !== CONFIG.OAUTH_CLIENT_ID) {
    throw new Error('登入憑證來源不符（aud 驗證失敗）。');
  }
  if (String(info.email_verified) !== 'true') {
    throw new Error('此 Google 帳號的 Email 未通過驗證。');
  }

  const email = info.email;
  _assertWhitelisted(email);

  // 快取到 token 過期前 60 秒（上限 6 小時，CacheService 限制 21600 秒）
  const expSeconds = parseInt(info.exp, 10);
  if (!isNaN(expSeconds)) {
    const ttl = Math.max(60, Math.min(expSeconds - Math.floor(Date.now() / 1000) - 60, 21600));
    cache.put(cacheKey, email, ttl);
  }
  return email;
}

/**
 * email 必須在白名單（ADMIN_EMAIL + USER_WHITELIST）內，否則 throw。
 * @param {string} email - 已驗證來源的 email。
 */
function _assertWhitelisted(email) {
  const whitelist = [CONFIG.ADMIN_EMAIL]
    .concat((CONFIG.USER_WHITELIST || '').split(','))
    .map(function (s) { return (s || '').trim().toLowerCase(); })
    .filter(Boolean);
  if (!email || whitelist.indexOf(String(email).toLowerCase()) === -1) {
    throw new Error('此帳號未被授權使用本系統。');
  }
}

/**
 * 解析「操作者 → 目標使用者」：只有 Admin 能指定別人。
 * @param {string} authedEmail - verifyToken 驗證過的操作者 email。
 * @param {string|null} requestedEmail - 前端指定要檢視的使用者（可為 null）。
 * @returns {{isAdmin: boolean, targetEmail: string}}
 */
function _resolveTarget(authedEmail, requestedEmail) {
  const isAdmin = (authedEmail === CONFIG.ADMIN_EMAIL);
  const targetEmail = (isAdmin && requestedEmail) ? requestedEmail : authedEmail;
  return { isAdmin: isAdmin, targetEmail: targetEmail };
}

/** GAS 編輯器手動測試：無效 token 應 throw。 */
function TEST_verifyToken_invalid() {
  try {
    verifyToken('not-a-real-token');
    Logger.log('FAIL：不該通過');
  } catch (e) {
    Logger.log('PASS：' + e.message);
  }
}

// =======================================================
// Session Token（無狀態 HMAC 簽章）
// =======================================================

const SESSION_TTL_SECONDS = 3 * 60 * 60; // 滑動 3 小時

// 單次執行內的密鑰快取（GAS 全域變數不跨請求存活，僅省去同一請求的重複讀取）
let _cachedSessionSecret = null;

/**
 * 取得 HMAC 密鑰；不存在時自動生成並寫入 Script Properties。
 * 刪除 SESSION_SECRET 屬性即可讓所有既有 token 立即失效（緊急撤銷手段）。
 * @returns {string} 密鑰。
 */
function _getSessionSecret() {
  if (_cachedSessionSecret) return _cachedSessionSecret;
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty('SESSION_SECRET');
  if (secret) {
    _cachedSessionSecret = secret;
    return secret;
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    secret = props.getProperty('SESSION_SECRET'); // 取得鎖後重新確認（雙重檢查）
    if (!secret) {
      secret = Utilities.getUuid() + Utilities.getUuid();
      props.setProperty('SESSION_SECRET', secret);
      Logger.log('已自動生成 SESSION_SECRET');
    }
  } finally {
    lock.releaseLock();
  }
  _cachedSessionSecret = secret;
  return secret;
}

/** 對 payload 字串簽章，回傳去除補位字元的 base64url 簽章。 */
function _signSessionPayload(payload) {
  const bytes = Utilities.computeHmacSha256Signature(payload, _getSessionSecret());
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}

/**
 * 簽發 session token（有效 SESSION_TTL_SECONDS 秒）。
 * @param {string} email - 已驗證的 email。
 * @returns {string} `payload.signature`
 */
function issueSessionToken(email) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = Utilities.base64EncodeWebSafe(
    JSON.stringify({ e: email, x: expiresAt })
  ).replace(/=+$/, '');
  return payload + '.' + _signSessionPayload(payload);
}

/**
 * 驗證 session token：先驗簽、再解析、再檢查到期與白名單。
 * @param {string} token
 * @returns {string} 已驗證的 email。
 */
function verifySessionToken(token) {
  if (!isSessionTokenShape(token)) {
    throw new Error('登入憑證格式錯誤，請重新登入。');
  }
  const parts = token.split('.');
  // 先驗簽，確認內容未被竄改後才信任 payload
  if (_signSessionPayload(parts[0]) !== parts[1]) {
    throw new Error('登入憑證無效，請重新登入。');
  }
  const parsed = parseSessionTokenPayload(token);
  if (!parsed) {
    throw new Error('登入憑證內容無法解析，請重新登入。');
  }
  if (parsed.expiresAt <= Math.floor(Date.now() / 1000)) {
    throw new Error('登入憑證已過期，請重新登入。');
  }
  // 每次都重查白名單：移除使用者後即刻生效，不必等 token 自然到期
  _assertWhitelisted(parsed.email);
  return parsed.email;
}

/**
 * 同時接受兩種憑證：session token（1 個點）走 HMAC，Google ID token（2 個點）走原驗證。
 * @param {string} token
 * @returns {string} 已驗證的 email。
 */
function verifyAny(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('缺少登入憑證，請重新登入。');
  }
  return isSessionTokenShape(token) ? verifySessionToken(token) : verifyToken(token);
}

/** GAS 編輯器手動測試：簽發/驗證/竄改/過期。執行後看記錄應四項全 PASS。 */
function TEST_sessionToken() {
  const email = CONFIG.ADMIN_EMAIL; // 需為白名單內帳號

  // 1) round trip
  const token = issueSessionToken(email);
  Logger.log(verifySessionToken(token) === email ? '1 PASS：簽發驗證 round trip' : '1 FAIL');

  // 2) 竄改 payload（改成他人 email，沿用原簽章）
  const forgedPayload = Utilities.base64EncodeWebSafe(
    JSON.stringify({ e: 'attacker@evil.com', x: Math.floor(Date.now() / 1000) + 3600 })
  ).replace(/=+$/, '');
  try {
    verifySessionToken(forgedPayload + '.' + token.split('.')[1]);
    Logger.log('2 FAIL：竄改的 token 竟然通過');
  } catch (e) {
    Logger.log('2 PASS：竄改被拒 — ' + e.message);
  }

  // 3) 簽章被改動
  try {
    verifySessionToken(token.split('.')[0] + '.aaaaaaaaaaaa');
    Logger.log('3 FAIL：錯誤簽章竟然通過');
  } catch (e) {
    Logger.log('3 PASS：錯誤簽章被拒 — ' + e.message);
  }

  // 4) 簽章正確但已過期
  const expiredPayload = Utilities.base64EncodeWebSafe(
    JSON.stringify({ e: email, x: Math.floor(Date.now() / 1000) - 10 })
  ).replace(/=+$/, '');
  try {
    verifySessionToken(expiredPayload + '.' + _signSessionPayload(expiredPayload));
    Logger.log('4 FAIL：過期的 token 竟然通過');
  } catch (e) {
    Logger.log('4 PASS：過期被拒 — ' + e.message);
  }
}
