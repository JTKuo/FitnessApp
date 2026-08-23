// 後端 API 呼叫層：取代舊 app.api（google.script.run）。
// 方法名稱與簽名與舊版完全一致，回傳值形狀也一致（router 只包一層 ok/data）。
import { getValidToken, requestReauth, storeSessionToken } from './auth.js';
import { workoutDraft } from './workout-draft.js';

const API_URL = import.meta.env.VITE_GAS_API_URL;

// 併發閘門：GAS 每個請求都要開啟一次試算表，成本高；同時湧入太多請求會被擋下，
// 回傳沒有 CORS 標頭的錯誤頁（載入 8 個動作的範本時必現，因為每張卡片都會立刻查詢上次表現）。
// 限制同時在途的請求數即可——請求總數不變，且因 GAS 單次執行開銷大，總耗時通常反而更短。
const MAX_CONCURRENT_REQUESTS = 3;
let inFlightCount = 0;
const pendingResolvers = [];

function acquireRequestSlot() {
  if (inFlightCount < MAX_CONCURRENT_REQUESTS) {
    inFlightCount += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => pendingResolvers.push(resolve));
}

function releaseRequestSlot() {
  const next = pendingResolvers.shift();
  // 直接把名額交棒給下一個等待者（不遞減計數），避免中間出現空窗或超發
  if (next) next();
  else inFlightCount -= 1;
}

// GAS 的 /exec 會先回一個轉址到 googleusercontent 的一次性網址，該轉址在服務層
// 會間歇性回 404（已排除本專案程式碼、併發、service worker、CORS 與部署劣化）。
// 一般寫入不能盲目 retry，否則可能重複寫入；僅明確具備 idempotent upsert 語意的 action 例外。
const READ_ONLY_ACTIONS = new Set([
  'getInitialData', 'getLatestPerformance', 'getUniqueExerciseNames', 'getAnalysisData',
  'getWorkoutTemplates', 'getAllPhotoRecords', 'getAllPRs', 'getPhoto',
  'getInBodyRecords', 'getExerciseCatalog',
]);
const IDEMPOTENT_WRITE_ACTIONS = new Set([
  // 依 Motion upsert，後端另有 LockService 保護；重送不會新增第二列。
  'saveExerciseMetadata',
]);
const ACTION_TIMEOUT_MS = {
  // 避免 GAS redirect/network 卡住時 UI 永久停在「建立中…」。
  saveExerciseMetadata: 12000,
};
const MAX_READ_ATTEMPTS = 3;
const MAX_IDEMPOTENT_WRITE_ATTEMPTS = 2;

function isTransportFailure(err) {
  if (!err) return false;
  if (err.code === 'REQUEST_TIMEOUT' || err.name === 'AbortError') return true;
  if (err instanceof TypeError) return true; // fetch network / redirect failure
  return /伺服器錯誤 \(HTTP |回應逾時|Failed to fetch|Load failed|NetworkError/i.test(err.message || '');
}

async function postOnce(body) {
  await acquireRequestSlot();
  const timeoutMs = Number(ACTION_TIMEOUT_MS[body.action]) || 0;
  const controller = timeoutMs > 0 ? new AbortController() : null;
  let timeoutId = null;

  if (controller) {
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  }

  try {
    let res;
    try {
      res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // 避開 CORS preflight
        body: JSON.stringify(body),
        redirect: 'follow',
        ...(controller ? { signal: controller.signal } : {}),
      });
    } catch (err) {
      if (controller?.signal.aborted || err?.name === 'AbortError') {
        const timeoutError = new Error('伺服器回應逾時。');
        timeoutError.code = 'REQUEST_TIMEOUT';
        throw timeoutError;
      }
      throw err;
    }

    if (!res.ok) throw new Error(`伺服器錯誤 (HTTP ${res.status})`);
    const json = await res.json();
    if (json.token) storeSessionToken(json.token); // 滑動續期
    if (!json.ok) {
      throw new Error((json.error && json.error.message) || '未知錯誤');
    }
    return json.data;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    releaseRequestSlot();
  }
}

async function post(body) {
  const attempts = READ_ONLY_ACTIONS.has(body.action)
    ? MAX_READ_ATTEMPTS
    : (IDEMPOTENT_WRITE_ACTIONS.has(body.action) ? MAX_IDEMPOTENT_WRITE_ATTEMPTS : 1);
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await postOnce(body);
    } catch (err) {
      lastError = err;
      // 僅 retry 傳輸層失敗；後端已回應的業務錯誤（憑證、驗證等）立即拋出。
      // 寫入只有 IDEMPOTENT_WRITE_ACTIONS 會進到 attempts > 1。
      if (!isTransportFailure(err) || i === attempts - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, 400 * (i + 1)));
    }
  }
  throw lastError;
}

/** 以 Google ID token 換取 session token（session token 由 post 自動存入）。 */
export async function loginWithGoogleToken(googleIdToken) {
  return post({ token: googleIdToken, action: 'login', payload: {} });
}

async function apiCall(action, payload = {}) {
  const token = getValidToken();
  if (!token) {
    requestReauth();
    throw new Error('登入已過期，請重新登入。');
  }
  try {
    return await post({ token, action, payload });
  } catch (err) {
    if (/憑證|過期|授權/.test(err.message)) requestReauth();
    throw err;
  }
}

export const backendApi = {
  getInitialData: (userEmail = null) => apiCall('getInitialData', { userEmail }),
  getLatestPerformance: (exerciseName, userEmail = null) => apiCall('getLatestPerformance', { exerciseName, userEmail }),
  getUniqueExerciseNames: (userEmail = null) => apiCall('getUniqueExerciseNames', { userEmail }),
  getAnalysisData: (userEmail = null) => apiCall('getAnalysisData', { userEmail }),
  saveBodyPhotos: (data) => apiCall('saveBodyPhotos', { data }),
  saveProfileData: (cardId, data) => apiCall('saveProfileData', { cardId, data }),
  saveWorkoutData: async (workoutData) => {
    // request 送出前先綁定草稿 owner，避免等待 GAS 回應期間 Admin 又切換學員。
    const draftCommitContext = workoutDraft.captureCommitContext();
    const result = await apiCall('saveWorkoutData', { workoutData });
    // WorkoutLog 已收到成功回應才視為 commit；PR 後處理失敗不應讓草稿復活。
    workoutDraft.markCommitted(draftCommitContext);
    return result;
  },
  saveWorkoutTemplate: (templateName, exercises) => apiCall('saveWorkoutTemplate', { templateName, exercises }),
  getWorkoutTemplates: (userEmail = null) => apiCall('getWorkoutTemplates', { userEmail }),
  deleteWorkoutTemplate: (templateName) => apiCall('deleteWorkoutTemplate', { templateName }),
  processWorkoutForPRs: (workoutData) => apiCall('processWorkoutForPRs', { workoutData }),
  getAllPhotoRecords: (userEmail = null) => apiCall('getAllPhotoRecords', { userEmail }),
  getAllPRs: (userEmail = null) => apiCall('getAllPRs', { userEmail }),
  updateMultipleExerciseCategories: (changesArray) => apiCall('updateMultipleExerciseCategories', { changes: changesArray }),
  saveAdminComment: (userEmail, dateString, motion, comment) => apiCall('saveAdminComment', { userEmail, dateString, motion, comment }),
  getPhoto: (fileId, userEmail = null) => apiCall('getPhoto', { fileId, userEmail }),
  saveInBodyRecord: (record) => apiCall('saveInBodyRecord', { record }),
  getInBodyRecords: (userEmail = null) => apiCall('getInBodyRecords', { userEmail }),
  deleteInBodyRecord: (recordId) => apiCall('deleteInBodyRecord', { recordId }),
  getExerciseCatalog: (userEmail = null) => apiCall('getExerciseCatalog', { userEmail }),
  saveExerciseMetadata: (metadata, userEmail = null) => apiCall('saveExerciseMetadata', { metadata, userEmail }),
  saveExerciseClassifications: (items) => apiCall('saveExerciseClassifications', { items }),
  autoClassifyExercises: () => apiCall('autoClassifyExercises', {}),
};
