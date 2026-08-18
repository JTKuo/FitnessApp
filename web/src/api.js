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
// 重試可有效緩解，但有個前提：404 發生在轉址階段，代表後端腳本「已經執行完畢」——
// 盲目重試寫入類請求會造成重複寫入（訓練被存兩次）。故僅重試唯讀 action。
const READ_ONLY_ACTIONS = new Set([
  'getInitialData', 'getLatestPerformance', 'getUniqueExerciseNames', 'getAnalysisData',
  'getWorkoutTemplates', 'getAllPhotoRecords', 'getAllPRs', 'getPhoto',
  'getInBodyRecords', 'getExerciseCatalog',
]);
const MAX_READ_ATTEMPTS = 3;

function isTransportFailure(err) {
  return /伺服器錯誤 \(HTTP /.test(err.message);
}

async function postOnce(body) {
  await acquireRequestSlot();
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // 避開 CORS preflight
      body: JSON.stringify(body),
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`伺服器錯誤 (HTTP ${res.status})`);
    const json = await res.json();
    if (json.token) storeSessionToken(json.token); // 滑動續期
    if (!json.ok) {
      throw new Error((json.error && json.error.message) || '未知錯誤');
    }
    return json.data;
  } finally {
    releaseRequestSlot();
  }
}

async function post(body) {
  const attempts = READ_ONLY_ACTIONS.has(body.action) ? MAX_READ_ATTEMPTS : 1;
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await postOnce(body);
    } catch (err) {
      lastError = err;
      // 僅重試傳輸層失敗；後端回的業務錯誤（憑證、驗證等）立即拋出
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
    const result = await apiCall('saveWorkoutData', { workoutData });
    // WorkoutLog 已收到成功回應才視為 commit；PR 後處理失敗不應讓草稿復活。
    workoutDraft.markCommitted();
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
  saveExerciseClassifications: (items) => apiCall('saveExerciseClassifications', { items }),
  autoClassifyExercises: () => apiCall('autoClassifyExercises', {}),
};
