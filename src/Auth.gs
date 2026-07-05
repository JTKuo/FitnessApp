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
  const whitelist = [CONFIG.ADMIN_EMAIL]
    .concat((CONFIG.USER_WHITELIST || '').split(','))
    .map(function (s) { return (s || '').trim().toLowerCase(); })
    .filter(Boolean);
  if (whitelist.indexOf(email.toLowerCase()) === -1) {
    throw new Error('此帳號未被授權使用本系統。');
  }

  // 快取到 token 過期前 60 秒（上限 6 小時，CacheService 限制 21600 秒）
  const expSeconds = parseInt(info.exp, 10);
  if (!isNaN(expSeconds)) {
    const ttl = Math.max(60, Math.min(expSeconds - Math.floor(Date.now() / 1000) - 60, 21600));
    cache.put(cacheKey, email, ttl);
  }
  return email;
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
