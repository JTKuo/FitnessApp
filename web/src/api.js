// 後端 API 呼叫層：取代舊 app.api（google.script.run）。
// 方法名稱與簽名與舊版完全一致，回傳值形狀也一致（router 只包一層 ok/data）。
import { getValidToken, requestReauth, storeSessionToken } from './auth.js';

const API_URL = import.meta.env.VITE_GAS_API_URL;

async function post(body) {
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
  saveWorkoutData: (workoutData) => apiCall('saveWorkoutData', { workoutData }),
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
};
