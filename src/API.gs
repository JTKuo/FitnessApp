// =======================================================
// 主入口函式 (Main Entry Point)
// =======================================================

/**
 * 舊版入口：前端已遷至 GitHub Pages，這裡只留搬家指引。
 * （GAS sandbox iframe 內自動轉址不可靠，提供顯眼連結即可。）
 */
function doGet() {
  const APP_URL = 'https://jtkuo.github.io/FitnessApp/';
  return HtmlService.createHtmlOutput(
    '<div style="font-family:sans-serif;text-align:center;padding:3rem;background:#000;color:#fff;min-height:100vh;">' +
    '<h2 style="color:#ffc300;">App 已搬新家 🎉</h2>' +
    '<p style="margin-top:1rem;"><a style="color:#ffc300;font-size:1.2rem;" href="' + APP_URL + '" target="_blank" rel="noopener">點此開啟新版 →</a></p>' +
    '<p style="color:#888;margin-top:1rem;">請將新網址加入書籤或加到手機主畫面。</p>' +
    '</div>'
  ).setTitle('個人化健身暨健康追蹤');
}

// =======================================================
// JSON API 入口 (doPost) — 前端唯一入口
// =======================================================

const API_ROUTES = {
  getInitialData:                   function (email, p) { return getInitialData(email, p.userEmail || null); },
  getLatestPerformance:             function (email, p) { return getLatestPerformance(email, p.exerciseName, p.userEmail || null); },
  getUniqueExerciseNames:           function (email, p) { return getUniqueExerciseNames(email, p.userEmail || null); },
  getAnalysisData:                  function (email, p) { return getAnalysisData(email, p.userEmail || null); },
  saveBodyPhotos:                   function (email, p) { return saveBodyPhotosToServer(email, p.data); },
  saveProfileData:                  function (email, p) { return saveProfileDataToServer(email, p.cardId, p.data); },
  saveWorkoutData:                  function (email, p) { return saveWorkoutDataToServer(email, p.workoutData); },
  saveWorkoutTemplate:              function (email, p) { return saveWorkoutTemplateToServer(email, p.templateName, p.exercises); },
  getWorkoutTemplates:              function (email, p) { return getWorkoutTemplates(email, p.userEmail || null); },
  deleteWorkoutTemplate:            function (email, p) { return deleteWorkoutTemplateToServer(email, p.templateName); },
  processWorkoutForPRs:             function (email, p) { return processWorkoutForPRs(email, p.workoutData); },
  getAllPhotoRecords:               function (email, p) { return getAllPhotoRecords(email, p.userEmail || null); },
  getAllPRs:                        function (email, p) { return getAllPRs(email, p.userEmail || null); },
  updateMultipleExerciseCategories: function (email, p) { return updateMultipleExerciseCategoriesToServer(email, p.changes); },
  saveAdminComment:                 function (email, p) { return saveAdminCommentToServer(email, p.userEmail, p.dateString, p.motion, p.comment); },
  getPhoto:                         function (email, p) { return getPhotoAsDataUrl(email, p.fileId, p.userEmail || null); },
  saveInBodyRecord:                 function (email, p) { return saveInBodyRecord(email, p.record); },
  getInBodyRecords:                 function (email, p) { return getInBodyRecords(email, p.userEmail || null); },
  deleteInBodyRecord:               function (email, p) { return deleteInBodyRecord(email, p.recordId); }
};

/**
 * 統一 JSON API 入口。回應格式：
 * 成功 { ok: true, data: ... }；失敗 { ok: false, error: { message } }。
 */
function doPost(e) {
  let out;
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('無效的請求格式。');
    }
    const req = JSON.parse(e.postData.contents);
    const email = verifyToken(req.token);
    const handler = API_ROUTES[req.action];
    if (!handler) {
      throw new Error('未知的 API action：' + req.action);
    }
    const data = handler(email, req.payload || {});
    // 舊函式以回傳值表達錯誤的兩種慣例，一律轉為統一錯誤
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      if (data.error) {
        throw new Error(typeof data.error === 'string' ? data.error : (data.error.message || '後端處理失敗'));
      }
      if (data.status === 'error') {
        throw new Error(data.message || '後端處理失敗');
      }
    }
    out = { ok: true, data: (data === undefined ? null : data) };
  } catch (err) {
    out = { ok: false, error: { message: err.message } };
  }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}



// =======================================================
// 前端 API 接口 (API Endpoints for Frontend)
// =======================================================
/**
 * (API - 高性能 V2) 
 * 一次性獲取頁面初始化所需的所有數據，包含個人最佳紀錄。
 * 【修正】 增加 userEmail 參數，用於管理者切換
 * @param {string|null} userEmail - (可選) 管理者指定要載入的使用者 Email。如果為 null 或未提供，則載入當前登入者。
 * @returns {object} 包含初始化數據或錯誤訊息的物件。
 */
function getInitialData(authedEmail, userEmail = null) {
  try {
    // --- 任務 1: 獲取使用者基本資料 ---
    const activeUserEmail = authedEmail; // 獲取實際登入者的 Email
    if (!activeUserEmail) {
      // 如果無法獲取登入者 Email，則無法繼續
      return { error: "無法獲取登入者資訊，請確認您已登入 Google 帳戶。" };
    }
    const isAdmin = (activeUserEmail === CONFIG.ADMIN_EMAIL); // 判斷登入者是否為 Admin

    // --- 決定要載入哪個 Email 的資料 ---
    let targetEmail = activeUserEmail; // 預設載入登入者自己的資料
    if (isAdmin && userEmail && userEmail !== activeUserEmail) {
      // 如果登入者是 Admin，並且前端有傳來 userEmail 參數 (且不是 Admin 自己)...
      targetEmail = userEmail; // ...則將目標切換為前端指定的使用者
      Logger.log(`管理者模式：偵測到切換請求，正在嘗試載入 ${targetEmail} 的資料 (操作者: ${activeUserEmail})`);
    } else {
      // 處理 Admin 看自己資料或一般使用者看自己資料的情況
      targetEmail = activeUserEmail; 
      Logger.log(`一般模式或管理者檢視自身：正在載入 ${targetEmail} 的資料`);
    }
    // --- 決定目標 Email 結束 ---

    // --- 使用 targetEmail 獲取 userSheet ---
    const userSheet = _getUserSheet(targetEmail, true); // 使用 targetEmail
    if (!userSheet) {
      // 如果連目標使用者的 Sheet 都找不到或無法建立
      throw new Error(`無法獲取或建立使用者 ${targetEmail} 的資料表。`);
    }
    // --- 獲取 userSheet 結束 ---

    const profileSheet = _getOrCreateSheet(userSheet, CONSTANTS.SHEETS.PROFILE);
    _ensureProfileHeaders(profileSheet); // 確保 Profile 表欄位完整

    // 讀取目標使用者的最新 Profile 資料
    let profileData = _getLatestProfileData(userSheet);
    // 將日期轉為 ISO 字串供前端使用
    if (profileData && profileData[CONSTANTS.HEADERS.UPDATE_DATE] instanceof Date) { 
        profileData[CONSTANTS.HEADERS.UPDATE_DATE] = profileData[CONSTANTS.HEADERS.UPDATE_DATE].toISOString();
    }

    // 讀取目標使用者的最新照片記錄
    let latestPhotos = _getLatestPhotos(userSheet); 
    if (latestPhotos && latestPhotos.date instanceof Date) { 
        latestPhotos.date = latestPhotos.date.toISOString();
    }

    // --- 組合 profile 物件 ---
    // 注意：email 是 targetEmail，isAdmin 仍是 activeUserEmail 的狀態
    const profile = {
      email: targetEmail, // 回傳當前顯示的是哪個使用者的資料 Email
      name: profileData.name || targetEmail.split('@')[0], // 優先用 Profile 名稱，否則用 Email 前綴
      isAdmin: isAdmin,   // 回傳登入者本身是否為 Admin (這決定前端是否顯示管理者介面)
      profileData: profileData, // 目標使用者的 Profile 資料
      shouldShowReminder: _checkPhotoReminder(userSheet), // 目標使用者是否需要提醒
      latestPhotos: latestPhotos // 目標使用者的最新照片
    };
    // --- 組合 profile 物件結束 ---

    // --- 任務 2: (僅當登入者為管理者時) 獲取所有使用者列表 ---
    let allUsers = [];
    if (isAdmin) { // 這裡仍用 isAdmin (登入者的狀態) 判斷是否執行
      Logger.log(`管理者 ${activeUserEmail} 正在獲取所有使用者列表...`);
      const dataFolder = DriveApp.getFolderById(CONFIG.DATA_FOLDER_ID); 
      const files = dataFolder.getFilesByType(MimeType.GOOGLE_SHEETS); 
      while (files.hasNext()) { 
        const file = files.next();
        const email = file.getName(); 
        let userName = email.split('@')[0]; // 預設名稱
        
        allUsers.push({ email: email, name: userName });
      }
      Logger.log(`共找到 ${allUsers.length} 位使用者。`);
    }

    // --- 任務 3: 獲取目標使用者的訓練範本 ---
    Logger.log(`正在為 ${targetEmail} 獲取訓練範本...`);
    const templates = {}; 
    const templateSheet = _getOrCreateSheet(userSheet, CONSTANTS.SHEETS.TEMPLATES); 
    if (templateSheet.getLastRow() > 1) { 
        const templateData = templateSheet.getRange(2, 1, templateSheet.getLastRow() - 1, 3).getValues();
        templateData.forEach((row) => {
            const templateName = row[0].toString().trim();
            const exerciseName = row[1].toString().trim();
            const order = row[2];
            if (templateName && exerciseName) {
                if (!templates[templateName]) {
                    templates[templateName] = [];
                }
                templates[templateName].push({ name: exerciseName, order: order });
            }
        });
        // 排序每個範本內的動作
        for (const tName in templates) {
            templates[tName].sort((a, b) => a.order - b.order);
        }
        Logger.log(`為 ${targetEmail} 找到 ${Object.keys(templates).length} 個範本。`);
    } else {
        Logger.log(`使用者 ${targetEmail} 的 Templates 工作表中沒有找到資料。`); 
    }

    // --- 任務 4: 獲取目標使用者的不重複動作名稱 (使用 WorkoutLog) ---
    Logger.log(`正在為 ${targetEmail} 從 WorkoutLog 獲取不重複的動作名稱...`);
    const exerciseNames = new Set(); 
    const logSheet = userSheet.getSheetByName(CONSTANTS.SHEETS.WORKOUT_LOG); 
    if (logSheet && logSheet.getLastRow() > 1) { 
        // 只讀取 B 欄 (動作名稱)
        const motionData = logSheet.getRange(2, 2, logSheet.getLastRow() - 1, 1).getValues(); 
        motionData.forEach(row => { 
            if (row[0] && typeof row[0] === 'string' && row[0].trim() !== '' && row[0] !== '動作總結' && row[0] !== '本日總結') { 
              exerciseNames.add(row[0].trim()); // 加入 Set 自動去重
            }
        });
        Logger.log(`為 ${targetEmail} 在 WorkoutLog 中找到 ${exerciseNames.size} 個不重複的動作名稱。`);
    } else {
       Logger.log(`使用者 ${targetEmail} 的 WorkoutLog 工作表中沒有找到資料或不存在。`);
    }

    // --- 將所有結果打包回傳 ---
    Logger.log(`為 ${targetEmail} 準備回傳所有初始資料。`);
    return {
      profile: profile,         // 目標使用者的 Profile
      allUsers: allUsers,       // 所有使用者列表 (僅 admin 有效)
      templates: templates,     // 目標使用者的範本
      exerciseNames: Array.from(exerciseNames) // 目標使用者的動作名稱列表
    };

  } catch (e) {
    // 記錄更詳細的錯誤資訊
    Logger.log(`CRITICAL ERROR in getInitialData (Target: ${targetEmail || 'N/A'}, Actor: ${activeUserEmail || 'N/A'}): ${e.toString()}\n${e.stack}`); 
    return { error: "伺服器內部錯誤，無法載入初始資料: " + e.message };
  }
}

/**
 * 儲存個人資料到 Profile 分頁。
 * @param {string} cardId - 觸發儲存的卡片 ID (此處已統一，故未使用)。
 * @param {object} data - 包含所有個人資料的物件。
 * @returns {object} 包含成功訊息的物件。
 */
function saveProfileDataToServer(authedEmail, cardId, data) {
  try {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('無效的個人資料格式。');
    }

    const userSheet = _getUserSheet(authedEmail, true);
    if (!userSheet) throw new Error('找不到您的資料檔案。');
    
    const profileSheet = _getOrCreateSheet(userSheet, 'Profile');

    _ensureProfileHeaders(profileSheet);

    const latestData = _getLatestProfileData(userSheet);

    const mergedData = { ...latestData, ...data };
    
    const headers = profileSheet.getRange(1, 1, 1, profileSheet.getLastColumn()).getValues()[0];
    const newRowData = headers.map(header => {
        if (header === '更新日期') return new Date();
        const value = mergedData[header];
        if (value === undefined || value === null || value === '') {
            // ⭐️ [修改] 移除身體數據相關欄位
            const numericKeys = [
              'age', 'height', 'weight', 'bodyfat', 
              'inbody_score', 'smm', 'bfm', 'bmi', 'vfl'
            ];
            return numericKeys.includes(header) ? '' : '';
        }
        return value;
    });
    
    profileSheet.appendRow(newRowData);
    profileSheet.sort(1, false); 

    return { status: 'success', message: '個人資料已成功更新！' };
  } catch(e) {
    Logger.log("saveProfileDataToServer 錯誤: " + e.toString());
    return { status: 'error', message: '後端處理失敗: ' + e.message };
  }
}


/**
 * (V2) 處理照片上傳，並可選擇性地一併更新當日的體重/體脂數據。
 * @param {object} data - 包含日期、base64照片數據以及可選的 weight/bodyfat 的物件。
 * @returns {object} - 包含成功或失敗訊息的物件。
 */
function saveBodyPhotosToServer(authedEmail, data) {
    try {
        // --- 在這裡加入清除快取的程式碼 ---
        const cache = CacheService.getUserCache();
        const userEmail = authedEmail; // <-- 保留第一次宣告
        // 只有在體重或體脂被更新時才需要清除快取
        if (data.weight || data.bodyfat) {
          cache.remove(`analysis_data_${userEmail}`);
          Logger.log(`為使用者 ${userEmail} 清除了分析數據快取(因為更新了體態數據)。`);
        }
        
        if (!data || typeof data !== 'object' || !data.date || typeof data.date !== 'string') {
            throw new Error('無效的體態資料格式或缺少日期。');
        }
        
        // const userEmail = Session.getActiveUser().getEmail(); // <-- 刪除第二次宣告
        const userSheet = _getUserSheet(userEmail, true);
        if (!userSheet) throw new Error('找不到您的資料檔案。');

        // ⭐️ 修正一：建立日期物件時，保留當前的時間 ⭐️
        const dateParts = data.date.split('-');
        const recordDate = new Date(); // 取得包含當前時間的 Date 物件
        recordDate.setFullYear(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));

        let hasNewPhotos = false;

        if (data.front || data.side || data.back) {
            const photosFolder = DriveApp.getFolderById(CONFIG.PHOTOS_FOLDER_ID);
            let userPhotoFolder;
            const folders = photosFolder.getFoldersByName(userEmail);
            if (folders.hasNext()) {
                userPhotoFolder = folders.next();
            } else {
                userPhotoFolder = photosFolder.createFolder(userEmail);
            }

            const dateString = Utilities.formatDate(recordDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
            const photoIds = {};
            ['front', 'side', 'back'].forEach(type => {
                if (data[type]) {
                    const fileData = data[type];
                    const mimeType = fileData.substring(5, fileData.indexOf(';'));
                    const bytes = Utilities.base64Decode(fileData.substring(fileData.indexOf('base64,') + 7));
                    const blob = Utilities.newBlob(bytes, mimeType, `${dateString}-${type}.jpg`);
                    const file = userPhotoFolder.createFile(blob);
                    photoIds[`photo_${type}_id`] = file.getId();
                }
            });

            if (Object.keys(photoIds).length > 0) {
                // _updateBodyPhotosSheet 現在會處理刪除舊檔案的邏輯
                _updateBodyPhotosSheet(userSheet, recordDate, photoIds);
                hasNewPhotos = true;
            }
        }
        
        let updatedProfileData = null;
        const profileUpdateData = {};
        if (data.weight && data.weight !== '') profileUpdateData.weight = data.weight;
        if (data.bodyfat && data.bodyfat !== '') profileUpdateData.bodyfat = data.bodyfat;

        if (Object.keys(profileUpdateData).length > 0) {
            const profileSheet = _getOrCreateSheet(userSheet, 'Profile');
            const latestData = _getLatestProfileData(userSheet);
            const mergedData = { ...latestData, ...profileUpdateData, '更新日期': recordDate };
            
            const headers = profileSheet.getRange(1, 1, 1, profileSheet.getLastColumn()).getValues()[0];
            const newRowData = headers.map(header => mergedData[header] !== undefined ? mergedData[header] : '');
            
            profileSheet.appendRow(newRowData);
            profileSheet.sort(1, false); 
            updatedProfileData = _getLatestProfileData(userSheet);
            
            if (updatedProfileData && updatedProfileData['更新日期'] instanceof Date) {
                updatedProfileData['更新日期'] = updatedProfileData['更新日期'].toISOString();
            }
        }

        const latestPhotos = _getLatestPhotos(userSheet);
        if(latestPhotos && latestPhotos.date instanceof Date) {
            latestPhotos.date = latestPhotos.date.toISOString();
        }

        let message = "資料已成功儲存！";
        if (!hasNewPhotos && !updatedProfileData) {
             return { status: 'warning', message: '沒有提供任何新的照片或數據。' };
        }

        return { 
            status: 'success', 
            message: message, 
            latestPhotos: latestPhotos,
            updatedProfileData: updatedProfileData
        };

    } catch (e) {
        Logger.log("saveBodyPhotosToServer 錯誤: " + e.toString());
        return { status: 'error', message: '後端處理失敗: ' + e.message };
    }
}


/**
 * 儲存當日的完整訓練日誌。
 * @param {Array} workoutData - 包含當日所有訓練組數的物件陣列。
 * @returns {object} 包含成功訊息的物件。
 */
function saveWorkoutDataToServer(authedEmail, workoutData) {
  try {
    const cache = CacheService.getUserCache();
    const userEmail = authedEmail;
    cache.remove(`analysis_data_${userEmail}`);
    Logger.log(`為使用者 ${userEmail} 清除了分析數據快取(因為儲存了新訓練)。`);

    if (!workoutData || !Array.isArray(workoutData) || workoutData.length === 0) {
      throw new Error('無效的訓練資料格式或內容為空。');
    }

    const userSheet = _getUserSheet(authedEmail, true);
    if (!userSheet) throw new Error('找不到您的資料檔案。');
    
    const date = new Date(workoutData[0].date);

    const logSheet = _getOrCreateSheet(userSheet, CONSTANTS.SHEETS.WORKOUT_LOG);    
    const savedAdminComments = _clearTodaysLog(logSheet, date); 

    _writeNewLog(logSheet, date, workoutData, savedAdminComments);

    return { status: 'success', message: '訓練日誌已成功儲存！' };
  } catch(e) {
    Logger.log("saveWorkoutDataToServer 錯誤: " + e.toString());
    return { status: 'error', message: '後端處理失敗: ' + e.message };
  }
}


/**
 * 獲取指定使用者的訓練範本。(修正：加入 userEmail 參數)
 * @param {string|null} userEmail - (可選) 管理者指定的使用者 Email。
 * @returns {object} - 以範本名稱為 key，動作陣列為 value 的物件。
 */
function getWorkoutTemplates(authedEmail, userEmail = null) {
  const activeUserEmail = authedEmail;
  const isAdmin = (activeUserEmail === CONFIG.ADMIN_EMAIL);
  let targetEmail = activeUserEmail;
  if (isAdmin && userEmail) {
      targetEmail = userEmail;
  }
  if (!targetEmail) return {}
  
  const userSheet = _getUserSheet(targetEmail, true);
  if (!userSheet) return {};

  const templateSheet = _getOrCreateSheet(userSheet, CONSTANTS.SHEETS.TEMPLATES); // 使用 Templates 常數
    if (templateSheet.getLastRow() < 2) return {};

  const data = templateSheet.getRange(2, 1, templateSheet.getLastRow() - 1, 3).getValues(); //
  const templates = {};

  data.forEach(row => {
    const templateName = row[0].trim();
    const exerciseName = row[1];
    const order = row[2];

    if (!templateName || !exerciseName) return;

    if (!templates[templateName]) {
      templates[templateName] = [];
    }
    templates[templateName].push({ name: exerciseName, order: order });
  });

  for (const templateName in templates) {
    templates[templateName].sort((a, b) => a.order - b.order);
  }

  return templates;
}


/**
 * 儲存一個新的或覆蓋一個已有的訓練範本。(V2 - 高效能批次處理)
 * @param {string} templateName - 範本名稱。
 * @param {Array<string>} exercises - 動作名稱的陣列。
 * @returns {object} - 包含成功訊息的物件。
 */
function saveWorkoutTemplateToServer(authedEmail, templateName, exercises) {
  if (!templateName || typeof templateName !== 'string' || templateName.trim() === '') {
    throw new Error('範本名稱不可為空。');
  }
  if (!exercises || !Array.isArray(exercises) || exercises.length === 0) {
    throw new Error('範本必須包含至少一個訓練動作。');
  }

  const userSheet = _getUserSheet(authedEmail, true);
  if (!userSheet) throw new Error('找不到您的資料檔案。');

  const templateSheet = _getOrCreateSheet(userSheet, 'Templates');
  
  const cleanTemplateName = templateName.trim();
  const newDataToWrite = [];
  
  // 1. 如果工作表中有資料，則執行「讀取-過濾-寫回」
  if (templateSheet.getLastRow() > 1) {
    const data = templateSheet.getDataRange().getValues();
    const headers = data.shift(); // 取出標頭
    
    // 1.a 在記憶體中過濾，移除舊的同名範本
    const filteredData = data.filter(row => row[0].toString().trim() !== cleanTemplateName);

    // 1.b 清空
    if (templateSheet.getLastRow() > 1) {
      templateSheet.getRange(2, 1, templateSheet.getLastRow() - 1, templateSheet.getLastColumn()).clearContents();
    }

    // 1.c 寫回過濾後的資料
    if (filteredData.length > 0) {
      templateSheet.getRange(2, 1, filteredData.length, filteredData[0].length).setValues(filteredData);
    }
  }

  // 2. 準備要附加的新範本資料
  exercises.forEach((exercise, index) => {
    newDataToWrite.push([cleanTemplateName, exercise, index + 1]);
  });

  // 3. 一次性附加新範本
  if (newDataToWrite.length > 0) {
    templateSheet.getRange(templateSheet.getLastRow() + 1, 1, newDataToWrite.length, newDataToWrite[0].length)
                 .setValues(newDataToWrite);
  }

  return { status: 'success', message: `範本「${cleanTemplateName}」已成功儲存！` };
}

/**
 * (API) 刪除一個已有的訓練範本。(V2 - 高效能批次處理)
 * @param {string} templateName - 要刪除的範本名稱。
 * @returns {object} - 包含成功或失敗訊息的物件。
 */
function deleteWorkoutTemplateToServer(authedEmail, templateName) {
  try {
    if (!templateName || typeof templateName !== 'string' || templateName.trim() === '') {
      throw new Error('範本名稱不可為空。');
    }

    const userSheet = _getUserSheet(authedEmail, false);
    if (!userSheet) {
      throw new Error('找不到您的資料檔案。');
    }

    const templateSheet = userSheet.getSheetByName('Templates');
    if (!templateSheet || templateSheet.getLastRow() < 2) {
      return { status: 'success', message: '範本不存在或已被刪除。' };
    }

    const data = templateSheet.getDataRange().getValues();
    
    // 1. 在記憶體中過濾
    const headers = data.shift(); // 取出標頭 (第 1 列)
    const newData = data.filter(row => row[0].toString().trim() !== templateName); // 篩選掉要刪除的

    // 檢查是否有資料真的被刪除了
    if (newData.length === data.length) {
      return { status: 'warning', message: `找不到名為「${templateName}」的範本。` };
    }

    // 2. 清空工作表 (從第 2 列開始)
    if (templateSheet.getLastRow() > 1) {
      templateSheet.getRange(2, 1, templateSheet.getLastRow() - 1, templateSheet.getLastColumn()).clearContents();
    }

    // 3. 一次性寫回剩餘資料
    if (newData.length > 0) {
      templateSheet.getRange(2, 1, newData.length, newData[0].length).setValues(newData); // 寫回剩餘資料
    }
    
    return { status: 'success', message: `範本「${templateName}」已成功刪除！` };

  } catch (e) {
    Logger.log(`deleteWorkoutTemplateToServer 錯誤: ${e.toString()}`);
    return { status: 'error', message: '後端刪除失敗: ' + e.message };
  }
}

/**
 * (V3.4 - 加入備註) 獲取所有歷史數據用於圖表分析。
 * @param {string|null} userEmail - (可選) 管理者指定的使用者 Email
 */
function getAnalysisData(authedEmail, userEmail = null) {
  // --- 快取檢查邏輯 (不變) ---
  const cache = CacheService.getUserCache();
  const activeUserEmail = authedEmail;
  const isAdmin = (activeUserEmail === CONFIG.ADMIN_EMAIL);

  let targetEmail = activeUserEmail;
  if (isAdmin && userEmail) {
    targetEmail = userEmail;
  }
  if (!targetEmail) {
    return { error: "無法確定目標使用者 Email。" };
  }

  const cacheKey = `analysis_data_${targetEmail}`; //
  const cachedData = cache.get(cacheKey); //
  if (cachedData) { //
    Logger.log(`為使用者 ${targetEmail} 從快取返回分析數據。`);
    return JSON.parse(cachedData);
  }
  Logger.log(`為使用者 ${targetEmail} 重新計算分析數據。`);

  try {
    const userSheet = _getUserSheet(targetEmail, true); 
    if (!userSheet) { //
      throw new Error(`無法獲取使用者 ${targetEmail} 的資料表，分析中止。`);
    }

    // --- 任務 1: 處理體態歷史數據 (不變) ---
    let weightHistory = [];
    let bodyfatHistory = [];
    const profileSheet = userSheet.getSheetByName(CONSTANTS.SHEETS.PROFILE);
    if (profileSheet && profileSheet.getLastRow() > 1) {
        const profileData = profileSheet.getRange(2, 1, profileSheet.getLastRow() - 1, profileSheet.getLastColumn()).getValues();
        const headers = profileSheet.getRange(1, 1, 1, profileSheet.getLastColumn()).getValues()[0];
        const dateIndex = headers.indexOf(CONSTANTS.HEADERS.UPDATE_DATE);
        const weightIndex = headers.indexOf(CONSTANTS.HEADERS.WEIGHT);
        const bodyfatIndex = headers.indexOf(CONSTANTS.HEADERS.BODYFAT);
        profileData.forEach(row => {
            const date = row[dateIndex];
            if (date instanceof Date) {
                const isoDate = date.toISOString();
                if (row[weightIndex]) weightHistory.push({ x: isoDate, y: parseFloat(row[weightIndex]) });
                if (row[bodyfatIndex]) bodyfatHistory.push({ x: isoDate, y: parseFloat(row[bodyfatIndex]) });
            }
        });
    }

    // --- InBody 量測序列 (R1)：與 Profile 來源合併，同日以 InBody 為準 ---
    let smmHistory = [];
    const inbodySheet = userSheet.getSheetByName(CONSTANTS.SHEETS.INBODY_LOG);
    if (inbodySheet && inbodySheet.getLastRow() > 1) {
      const ibWeight = [], ibBodyfat = [];
      const ibRows = inbodySheet.getRange(2, 1, inbodySheet.getLastRow() - 1, 6).getValues();
      ibRows.forEach(function (row) {
        const d = row[1];
        if (!(d instanceof Date)) return;
        const iso = d.toISOString();
        if (row[2] !== '') ibWeight.push({ x: iso, y: parseFloat(row[2]) });
        if (row[3] !== '') ibBodyfat.push({ x: iso, y: parseFloat(row[3]) });
        if (row[4] !== '') smmHistory.push({ x: iso, y: parseFloat(row[4]) });
      });
      weightHistory = mergeBodyHistory(weightHistory, ibWeight);
      bodyfatHistory = mergeBodyHistory(bodyfatHistory, ibBodyfat);
      smmHistory = mergeBodyHistory([], smmHistory); // 排序 + 同日去重（後者為準）
    }

    // --- 篩選日期 (不變) ---
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - (ANALYSIS_CONSTANTS.DAYS_FOR_HISTORY * ANALYSIS_CONSTANTS.ONE_DAY_MS));
    const thirtyDaysAgo = new Date(now.getTime() - (ANALYSIS_CONSTANTS.DAYS_FOR_DISTRIBUTION * ANALYSIS_CONSTANTS.ONE_DAY_MS));
    
    // --- 任務 2: 處理所有訓練數據 ---
    const categoryMap = _getExerciseCategoryMap(userSheet);
    const volumeHistory = [], volumeHistoryByCategory = {}, singleExerciseProgress = {};
    const dailyWorkouts = {};

    const logSheet = userSheet.getSheetByName(CONSTANTS.SHEETS.WORKOUT_LOG);
    
    if (logSheet && logSheet.getLastRow() > 1) {
      const indices = _getHeaderIndices(logSheet);
      // 讀取到第 9 欄 (指導建議)
      const data = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 9).getValues();
      
      let currentDate = null;
      data.forEach(row => { 
        // 這裡的處理邏輯完全不用變！
        if (row[0] instanceof Date) currentDate = row[0]; // 
        const motion = row[indices[CONSTANTS.HEADERS.MOTION]];
        const reps = row[indices[CONSTANTS.HEADERS.REPS]];
        const weightKg = row[indices[CONSTANTS.HEADERS.WEIGHT_KG]];
        const note = row[indices[CONSTANTS.HEADERS.NOTES]];
        const adminNote = row[indices[CONSTANTS.HEADERS.ADMIN_COMMENT]];
        
        if (currentDate && motion && reps && weightKg && motion !== '本日總結' && motion !== '動作總結') { 
          const dateString = Utilities.formatDate(currentDate, Session.getScriptTimeZone(), "yyyy-MM-dd"); 
          if (!dailyWorkouts[dateString]) dailyWorkouts[dateString] = [];
          dailyWorkouts[dateString].push({ 
              motion: motion, reps: parseFloat(reps), weight: parseFloat(weightKg),
              volume: (parseFloat(reps) * parseFloat(weightKg)),
              note: note || '',
              adminNote: adminNote || '' 
          });
        }
      });
    }

    const allSortedDates = Object.keys(dailyWorkouts).sort();
    allSortedDates.forEach(dateStr => {
      const workouts = dailyWorkouts[dateStr];
      let dailyTotalVolume = 0;
      let dailyCategoryVolume = {};
      let dailyMotionStats = {};

      workouts.forEach(set => {
        dailyTotalVolume += set.volume;
        const category = categoryMap.get(set.motion) || '其他';
        dailyCategoryVolume[category] = (dailyCategoryVolume[category] || 0) + set.volume;

        if (!dailyMotionStats[set.motion]) {
           // ⭐ [修正 2/4] 初始化時加入 adminNote
           dailyMotionStats[set.motion] = { maxWeight: 0, bestE1RM: 0, totalVolume: 0, note: '', adminNote: '' };
        }
        
        // ⭐ [修正 3/4] 將 note 和 adminNote 存到 dailyMotionStats 中
        if (!dailyMotionStats[set.motion].note && set.note) {
          dailyMotionStats[set.motion].note = set.note;
        }
        if (!dailyMotionStats[set.motion].adminNote && set.adminNote) {
          dailyMotionStats[set.motion].adminNote = set.adminNote;
        }

        const stats = dailyMotionStats[set.motion];
        stats.totalVolume += set.volume;
        if (set.weight > stats.maxWeight) stats.maxWeight = set.weight;
        const est1RM = calcEst1RM(set.weight, set.reps);
        if (est1RM > stats.bestE1RM) stats.bestE1RM = est1RM;
      });

      const isoDate = new Date(dateStr).toISOString();
      volumeHistory.push({ x: isoDate, y: dailyTotalVolume });
      volumeHistoryByCategory[dateStr] = dailyCategoryVolume;
      for (const motion in dailyMotionStats) {
        if (!singleExerciseProgress[motion]) singleExerciseProgress[motion] = [];
        const stats = dailyMotionStats[motion];
        
        singleExerciseProgress[motion].push({
          x: isoDate, maxWeight: stats.maxWeight,
          bestE1RM: parseFloat(stats.bestE1RM.toFixed(2)),
          totalVolume: parseFloat(stats.totalVolume.toFixed(2)),
          note: stats.note,
          // ⭐ [修正 4/4] 將 adminNote 加入到最終回傳的物件中
          adminNote: stats.adminNote
        });
      }
    });

    // --- 後續的 filter 和 return 邏輯 (不變) ---
    const finalVolumeHistory = volumeHistory.filter(d => new Date(d.x) >= ninetyDaysAgo);
    for (const motion in singleExerciseProgress) {
        singleExerciseProgress[motion] = singleExerciseProgress[motion].filter(d => new Date(d.x) >= ninetyDaysAgo);
    }
    const categoryVolumeDistribution = {};
    const distributionDates = allSortedDates.filter(dateStr => new Date(dateStr) >= thirtyDaysAgo);
    distributionDates.forEach(dateStr => {
      const dailyVolumes = volumeHistoryByCategory[dateStr];
      if (dailyVolumes) {
        for (const category in dailyVolumes) {
          categoryVolumeDistribution[category] = (categoryVolumeDistribution[category] || 0) + dailyVolumes[category];
        }
      }
    });
    const sortByDate = (a, b) => new Date(a.x) - new Date(b.x);
    weightHistory.sort(sortByDate);
    bodyfatHistory.sort(sortByDate);
    const finalResult = {
      weightHistory, bodyfatHistory, smmHistory, volumeHistory: finalVolumeHistory,
      volumeHistoryByCategory, singleExerciseProgress, workoutFrequency: allSortedDates,
      categoryVolumeDistribution
    };
    cache.put(cacheKey, JSON.stringify(finalResult), 7200);
    return finalResult;

  } catch (e) {
    Logger.log(`getAnalysisData 錯誤 (Target: ${targetEmail}): ${e.toString()}\n${e.stack}`); //
    return { error: `獲取 ${targetEmail} 分析數據時發生嚴重錯誤: ${e.message}` };
  }
}

/**
 * (API) 獲取指定訓練動作的最近一次表現紀錄。
 * @param {string} exerciseName - 要查詢的動作名稱。
 * @returns {object|null} - 包含 {weight, reps} 的物件，或是在找不到時回傳 null。
 */
function getLatestPerformance(authedEmail, exerciseName, userEmail = null) {
  try {
    const KG_TO_LB = 2.20462262;
    const activeUserEmail = authedEmail;
    const isAdmin = (activeUserEmail === CONFIG.ADMIN_EMAIL);

    let targetEmail = activeUserEmail;
    if (isAdmin && userEmail) {
        targetEmail = userEmail;
    }
    if (!targetEmail) return null;

    const userSheet = _getUserSheet(targetEmail); // 不需創建
    if (!userSheet || !exerciseName) return null;

    const logSheet = userSheet.getSheetByName(CONSTANTS.SHEETS.WORKOUT_LOG); //
    if (!logSheet || logSheet.getLastRow() < 2) return null;

    const indices = _getHeaderIndices(logSheet);
    const data = logSheet.getDataRange().getValues();
    
    // 從資料的最後一筆開始往回找，效率較高
    for (let i = 1; i < data.length; i++) { // <-- i = 1, 往上加
      const row = data[i];
      const motion = row[indices[CONSTANTS.HEADERS.MOTION]];
      const reps = row[indices[CONSTANTS.HEADERS.REPS]];
      const weight_kg = row[indices[CONSTANTS.HEADERS.WEIGHT_KG]];
      
      if (motion === exerciseName && reps && weight_kg) {
        // 【修改】 計算磅值並回傳物件
        const weight_lbs = parseFloat((weight_kg * KG_TO_LB).toFixed(2));
        return {
          weight_kg: weight_kg,
          weight_lbs: weight_lbs,
          reps: reps
        };
      }
    }
    
    return null; // 如果所有工作表都找完還沒有，就回傳 null
  } catch (e) {
    Logger.log(`getLatestPerformance 錯誤 (Target: ${targetEmail}, Motion: ${exerciseName}): ${e.toString()}`); //
    return null;
  }
}

/**
 * (API) 獲取使用者記錄過的所有不重複的訓練動作名稱。
 * @param {string|null} userEmail - (可選) 管理者指定的使用者 Email。
 * @returns {Array<string>} - ...
 */
function getUniqueExerciseNames(authedEmail, userEmail = null) {
  try {
    const activeUserEmail = authedEmail;
    const isAdmin = (activeUserEmail === CONFIG.ADMIN_EMAIL);
    let targetEmail = activeUserEmail;
    if (isAdmin && userEmail) {
        targetEmail = userEmail;
    }
    if (!targetEmail) return [];

    const userSheet = _getUserSheet(targetEmail); // 不需創建
    if (!userSheet) return []; //

    const names = new Set(); //
    const logSheet = userSheet.getSheetByName(CONSTANTS.SHEETS.WORKOUT_LOG);
    if (logSheet && logSheet.getLastRow() > 1) {
        const motionData = logSheet.getRange(2, 2, logSheet.getLastRow() - 1, 1).getValues();
        motionData.forEach(row => {
            if (row[0] && typeof row[0] === 'string' && row[0].trim() !== '' && row[0] !== '動作總結' && row[0] !== '本日總結') { // 
              names.add(row[0].trim()); // 
            }
        });
    }

    return Array.from(names); // 將 Set 轉換為 Array 後回傳
  } catch (e) {
    Logger.log(`getUniqueExerciseNames 錯誤 (Target: ${targetEmail}): ${e.toString()}`); //
    return [];
  }
}

/**
 * (API - 管理員專用) 儲存或更新管理員對特定訓練的評論。(V6 - 修正日期查找邏輯)
 * @param {string} userEmail - 正在被評論的使用者的 Email。
 * @param {string} dateString - 來自前端的 "yyyy-MM-dd" 格式日期字串。
 * @param {string} motion - 動作的名稱。
 * @param {string} comment - 管理員的評論文字。
 * @returns {object} - 一個包含成功或失敗訊息的物件。
 */
function saveAdminCommentToServer(authedEmail, userEmail, dateString, motion, comment) {
    if (authedEmail !== CONFIG.ADMIN_EMAIL) {
        return { status: 'error', message: '權限不足。' };
    }

    try {
        const targetUserSheet = _getUserSheet(userEmail, false);
        if (!targetUserSheet) throw new Error(`找不到使用者 ${userEmail} 的資料檔案。`);
        
        const logSheet = targetUserSheet.getSheetByName(CONSTANTS.SHEETS.WORKOUT_LOG);
        if (!logSheet) throw new Error(`找不到 ${CONSTANTS.SHEETS.WORKOUT_LOG} 工作表。`);

        // 🆕 優化：一次讀取所有需要的資料
        const indices = _getHeaderIndices(logSheet);
        const lastRow = logSheet.getLastRow();
        
        if (lastRow < 2) {
            throw new Error('工作表中沒有任何訓練記錄。');
        }
        
        // 🆕 只讀取日期欄和動作欄，減少資料傳輸
        const dateColumn = logSheet.getRange(2, 1, lastRow - 1, 1).getValues();
        const motionColumn = logSheet.getRange(2, indices[CONSTANTS.HEADERS.MOTION] + 1, lastRow - 1, 1).getValues();
        
        let rowToUpdate = -1;
        let startIndexForMotionSearch = -1;

        // 步驟 1: 找到目標日期
        for (let i = 0; i < dateColumn.length; i++) {
            const rowDate = dateColumn[i][0];
            if (rowDate && rowDate instanceof Date) {
                try {
                    const rowDateString = Utilities.formatDate(rowDate, "Asia/Taipei", "yyyy-MM-dd");
                    if (rowDateString === dateString) {
                        startIndexForMotionSearch = i;
                        break;
                    }
                } catch (e) { /* 忽略無效日期 */ }
            }
        }

        if (startIndexForMotionSearch === -1) {
            throw new Error(`在工作表中找不到日期為 ${dateString} 的紀錄。`);
        }

        // 步驟 2: 從找到的日期開始，往下搜尋匹配的動作
        const cleanString = (str) => (typeof str === 'string') ? str.replace(/\s/g, '') : '';
        const cleanedMotionParam = cleanString(motion);

        for (let j = startIndexForMotionSearch; j < dateColumn.length; j++) {
            if (j > startIndexForMotionSearch && dateColumn[j][0] instanceof Date) {
                break; // 遇到下一個日期就停止
            }
            
            const rowMotion = motionColumn[j][0];
            if (rowMotion) {
                const cleanedRowMotion = cleanString(rowMotion.toString());
                if (cleanedRowMotion === cleanedMotionParam) {
                    rowToUpdate = j + 2; // +2 因為：+1 轉成 1-based，+1 跳過標頭
                    break;
                }
            }
        }

        if (rowToUpdate === -1) {
            throw new Error(`雖然找到了日期 ${dateString}，但在該日紀錄中找不到動作 ${motion}。`);
        }

        // ✅ 找到了，更新評論
        logSheet.getRange(rowToUpdate, indices[CONSTANTS.HEADERS.ADMIN_COMMENT] + 1).setValue(comment);
        
        // 清除快取
        const cache = CacheService.getUserCache();
        cache.remove(`analysis_data_${userEmail}`);
        
        return { status: 'success', message: '指導建議已成功儲存！' };

    } catch (e) {
        Logger.log(`saveAdminCommentToServer 錯誤: ${e.toString()}`);
        return { status: 'error', message: '儲存指導建議失敗: ' + e.message };
    }
}

/**
 * (API) 接收整個訓練日的數據，批次處理並回報新達成的 PR。(V5 - 高性能批次處理)
 * @param {Array} workoutData - 當日所有訓練組數的物件陣列。
 * @returns {object} - 回傳一個物件，包含新達成的 PR 列表。
 */
function processWorkoutForPRs(authedEmail, workoutData) {
  try {
    if (!workoutData || !Array.isArray(workoutData) || workoutData.length === 0) {
        return { status: 'error', message: '無效的訓練資料，無法處理 PR。' };
    }

    const userSheet = _getUserSheet(authedEmail, true);
    const prsSheet = _getOrCreateSheet(userSheet, 'PRs');
    const bestsSheet = _getOrCreateSheet(userSheet, 'Bests');

    // (保留清理當日舊紀錄的邏輯)
    const workoutDate = new Date(workoutData[0].date);
    const workoutDateString = workoutDate.toLocaleDateString();

    // 讀出全部（含標頭），過濾掉當日舊 PR 後寫回；表空時 prsValues 只剩標頭列，後續邏輯自然成立
    let prsValues = prsSheet.getDataRange().getValues();
    if (prsValues.length > 1) {
      prsValues = prsValues.filter(function (row, index) {
        if (index === 0) return true;
        return new Date(row[3]).toLocaleDateString() !== workoutDateString;
      });
      prsSheet.clearContents();
      prsSheet.getRange(1, 1, prsValues.length, prsValues[0].length).setValues(prsValues);
    }

    // --- 讀取歷史數據 ---
    const bestsValues = bestsSheet.getDataRange().getValues();
    const prsMap = new Map(prsValues.slice(1).map((row, index) => [`${row[0]}-${row[1]}`, { maxWeight: row[2], rowIndex: index + 2 }]));
    const bestsMap = new Map(bestsValues.slice(1).map((row, index) => [row[0], { heaviest: row[1], bestE1RM: row[2], rowIndex: index + 2 }]));
    
    // ⭐ 1. 新增：建立一個暫存區，用來記錄本次訓練中"最好"的 PR
    const sessionBestPRs = new Map();

    const newPrsRows = [];
    const newBestsRows = [];

    // --- 遍歷所有組數，更新數據並記錄最佳 PR ---
    workoutData.forEach(setData => {
      const motion = setData.motion;
      const reps = parseInt(setData.reps);
      const weight = parseFloat(setData.weight_in_kg);
      const date = new Date(setData.date);

      if (!motion || !reps || !weight || reps <= 0 || weight <= 0) return;

      const rmCategory = getRmCategory(reps);
      if (!rmCategory) return;

      const est1RM = calcEst1RM(weight, reps);

      // (資料更新邏輯保持不變，但移除訊息產生)
      // 處理 Reps PR
      const prsKey = `${motion}-${rmCategory}`;
      const existingRepPR = prsMap.get(prsKey);
      if (!existingRepPR || weight > existingRepPR.maxWeight) {
        if (existingRepPR) { // 更新舊紀錄
           if (existingRepPR.rowIndex) { prsValues[existingRepPR.rowIndex - 1] = [motion, rmCategory, weight, date, est1RM]; }
           else if (existingRepPR._newRowRef) { existingRepPR._newRowRef.splice(0, 5, motion, rmCategory, weight, date, est1RM); }
           existingRepPR.maxWeight = weight;
        } else { // 新增紀錄
            const newRowData = [motion, rmCategory, weight, date, est1RM];
            newPrsRows.push(newRowData);
            prsMap.set(prsKey, { maxWeight: weight, _newRowRef: newRowData });
        }
        
        // ⭐ 2. 修改：不直接產生訊息，而是更新暫存區的最佳紀錄
        const sessionKey = `rep-${motion}-${rmCategory}`;
        const currentBest = sessionBestPRs.get(sessionKey);
        if (!currentBest || weight > currentBest.weight) {
            sessionBestPRs.set(sessionKey, { type: 'Rep', motion, rmCategory, weight, reps, unit: setData.unit });
        }
      }

      // (資料更新邏輯保持不變，但移除訊息產生)
      // 處理 Bests PR
      const existingBests = bestsMap.get(motion);
      if (!existingBests || weight > existingBests.heaviest || est1RM > existingBests.bestE1RM) {
        if (existingBests) { // 更新舊紀錄
          if (weight > existingBests.heaviest) {
            if (existingBests.rowIndex) { bestsValues[existingBests.rowIndex - 1][1] = weight; bestsValues[existingBests.rowIndex - 1][3] = date; }
            else if (existingBests._newRowRef) { existingBests._newRowRef[1] = weight; existingBests._newRowRef[3] = date; }
            existingBests.heaviest = weight;
            
            // ⭐ 2. 修改：更新暫存區
            const sessionKey = `best-heaviest-${motion}`;
            const currentBest = sessionBestPRs.get(sessionKey);
            if (!currentBest || weight > currentBest.weight) {
                sessionBestPRs.set(sessionKey, { type: 'Heaviest', motion, weight, reps, unit: setData.unit });
            }
          }
          if (est1RM > existingBests.bestE1RM) {
            if (existingBests.rowIndex) { bestsValues[existingBests.rowIndex - 1][2] = est1RM; bestsValues[existingBests.rowIndex - 1][4] = date; }
            else if (existingBests._newRowRef) { existingBests._newRowRef[2] = est1RM; existingBests._newRowRef[4] = date; }
            existingBests.bestE1RM = est1RM;
            
            // ⭐ 2. 修改：更新暫存區
            const sessionKey = `best-e1rm-${motion}`;
            const currentBest = sessionBestPRs.get(sessionKey);
            if (!currentBest || est1RM > currentBest.est1RM) {
                sessionBestPRs.set(sessionKey, { type: 'E1RM', motion, est1RM, weight, reps });
            }
          }
        } else { // 新增紀錄
            const newRowData = [motion, weight, est1RM, date, date];
            newBestsRows.push(newRowData);
            bestsMap.set(motion, { heaviest: weight, bestE1RM: est1RM, _newRowRef: newRowData });
            
            // ⭐ 2. 修改：更新暫存區
            sessionBestPRs.set(`best-heaviest-${motion}`, { type: 'Heaviest', motion, weight, reps, unit: setData.unit });
            sessionBestPRs.set(`best-e1rm-${motion}`, { type: 'E1RM', motion, est1RM, weight, reps });
        }
      }
    });

    // --- 批次寫入 Sheet (邏輯不變) ---
    if (prsValues.length > 1) prsSheet.getRange(1, 1, prsValues.length, prsValues[0].length).setValues(prsValues);
    if (newPrsRows.length > 0) prsSheet.getRange(prsSheet.getLastRow() + 1, 1, newPrsRows.length, newPrsRows[0].length).setValues(newPrsRows);
    if (bestsValues.length > 1) bestsSheet.getRange(1, 1, bestsValues.length, bestsValues[0].length).setValues(bestsValues);
    if (newBestsRows.length > 0) bestsSheet.getRange(bestsSheet.getLastRow() + 1, 1, newBestsRows.length, newBestsRows[0].length).setValues(newBestsRows);

    // ⭐ 3. 新增：在所有處理結束後，才從暫存區產生最終的提示訊息
    const finalPRMessages = [];
    for (const pr of sessionBestPRs.values()) {
        switch (pr.type) {
            case 'Rep':
                finalPRMessages.push(`🎉 重量 PR！（${pr.rmCategory}RM 新高）: ${pr.motion} (${pr.weight}kg x ${pr.reps}次)`);
                break;
            case 'Heaviest':
                finalPRMessages.push(`🚀 重量 PR！（史上最重）: ${pr.motion} (${pr.weight}kg x ${pr.reps}次)`);
                break;
            case 'E1RM':
                finalPRMessages.push(`🔥 推估力量 PR！（E1RM 新高）: ${pr.motion} (推估 ${Math.round(pr.est1RM)}kg)`);
                break;
        }
    }

    return { status: 'success', newPRs: finalPRMessages };

  } catch(e) {
    Logger.log(`CRITICAL ERROR in processWorkoutForPRs: ${e.toString()}\n${e.stack}`);
    return { status: 'error', message: e.message };
  }
}

/**
 * (API) 獲取所有體態照片的紀錄，用於歷史對比功能。
 * @param {string|null} userEmail - (可選) 管理者指定的使用者 Email。
 * @returns {Array<object>|object} - ...
 */
function getAllPhotoRecords(authedEmail, userEmail = null) {
  try {
    const activeUserEmail = authedEmail;
    const isAdmin = (activeUserEmail === CONFIG.ADMIN_EMAIL);
    let targetEmail = activeUserEmail;
    if (isAdmin && userEmail) {
        targetEmail = userEmail;
    }
    if (!targetEmail) return [];

    const userSheet = _getUserSheet(targetEmail); // 不需創建
    if (!userSheet) { //
      return []; //
    }

    const sheet = userSheet.getSheetByName(CONSTANTS.SHEETS.BODY_PHOTOS);
    if (!sheet || sheet.getLastRow() < 2) {
      return []; // 如果沒有照片紀錄，回傳空陣列
    }

    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
    const headers = ['date', 'photo_front_id', 'photo_side_id', 'photo_back_id'];

    const records = data.map(row => {
      const record = {};
      headers.forEach((header, index) => {
        // 確保日期被轉換為 ISO 字串格式，方便前端處理
        if (header === 'date' && row[index] instanceof Date) {
          record[header] = row[index].toISOString();
        } else {
          record[header] = row[index];
        }
      });
      return record;
    }).filter(record => record.date); // 過濾掉沒有日期的無效資料

    // 預設按日期降序排序 (最新的在最前面)
    records.sort((a, b) => new Date(b.date) - new Date(a.date));

    return records;

  } catch (e) {
    Logger.log(`getAllPhotoRecords 錯誤 (Target: ${targetEmail}): ${e.toString()}`); //
    return { error: `無法獲取 ${targetEmail} 的照片歷史紀錄: ${e.message}` };
  }
}

// =======================================================
// 個人紀錄頁面 API (PRs Page API)
// =======================================================

/**
 * (API) 獲取所有的個人最佳紀錄 (Bests) 和各RM區間紀錄 (PRs)。
 * @param {string|null} userEmail - (可選) 管理者指定的使用者 Email。
 * @returns {object} - 包含 { bests: [...], repPRs: [...] } 的物件。
 */
function getAllPRs(authedEmail, userEmail = null) {
  let targetEmail = null;
  try {
    const activeUserEmail = authedEmail;
    targetEmail = activeUserEmail;
    const isAdmin = (activeUserEmail === CONFIG.ADMIN_EMAIL);
    if (isAdmin && userEmail) {
        targetEmail = userEmail;
    }
    if (!targetEmail) return { bests: [], repPRs: [] };

    const userSheet = _getUserSheet(targetEmail); // 不需創建
    if (!userSheet) { //
      return { bests: [], repPRs: [] }; //
    }

    // ⭐ [新增] 步驟 1: 獲取分類對應表
    const categoryMap = _getExerciseCategoryMap(userSheet);

    const bests = [];
    const repPRs = [];
    
    // 讀取 Bests 工作表
    const bestsSheet = userSheet.getSheetByName('Bests');
    if (bestsSheet && bestsSheet.getLastRow() > 1) {
      const bestsData = bestsSheet.getRange(2, 1, bestsSheet.getLastRow() - 1, 5).getValues();
      bestsData.forEach(row => {
        const motion = row[0];
        bests.push({
          motion: motion,
          heaviestWeight: row[1],
          bestEst1RM: row[2] ? parseFloat(row[2]).toFixed(1) : 0,
          heaviestDate: row[3] instanceof Date ? row[3].toLocaleDateString() : 'N/A',
          heaviestDateISO: row[3] instanceof Date ? row[3].toISOString() : null,
          e1rmDate: row[4] instanceof Date ? row[4].toLocaleDateString() : 'N/A',
          e1rmDateISO: row[4] instanceof Date ? row[4].toISOString() : null,
          // ⭐ [新增] 步驟 2: 查詢並加入分類，如果找不到則預設為 '其他'
          category: categoryMap.get(motion) || '其他'
        });
      });
    }

    // 讀取 PRs 工作表
    const prsSheet = userSheet.getSheetByName('PRs');
    if (prsSheet && prsSheet.getLastRow() > 1) {
      const prsData = prsSheet.getRange(2, 1, prsSheet.getLastRow() - 1, 4).getValues();
      prsData.forEach(row => {
        const motion = row[0];
        repPRs.push({
          motion: motion,
          rmCategory: row[1],
          weight: row[2],
          date: row[3] instanceof Date ? row[3].toLocaleDateString() : 'N/A',
          dateISO: row[3] instanceof Date ? row[3].toISOString() : null,
          // ⭐ [新增] 步驟 2: 查詢並加入分類，如果找不到則預設為 '其他'
          category: categoryMap.get(motion) || '其他'
        });
      });
    }

    return { bests: bests, repPRs: repPRs };
  } catch (e) {
    Logger.log(`getAllPRs 錯誤 (Target: ${targetEmail}): ${e.toString()}`); //
    return { error: `無法獲取 ${targetEmail} 的個人紀錄: ${e.message}` }; //
  }
}

/**
 * (API - 高性能) 批次更新多個動作的分類。
 * @param {Array<object>} changes - 一個包含 {motion, category} 物件的陣列。
 * @returns {object} - 包含成功或失敗訊息的物件。
 */
function updateMultipleExerciseCategoriesToServer(authedEmail, changes) {
  try {
    if (!changes || !Array.isArray(changes) || changes.length === 0) {
      return { status: 'warning', message: '沒有需要更新的分類。' };
    }

    const userSheet = _getUserSheet(authedEmail, true);
    const exerciseSheet = _getOrCreateSheet(userSheet, 'ExerciseMaster');
    
    const range = exerciseSheet.getDataRange();
    const values = range.getValues();
    
    // 為了高效查詢，先將工作表資料轉換為 Map
    const motionMap = new Map();
    for (let i = 1; i < values.length; i++) {
      motionMap.set(values[i][0].toString().trim(), i); // key: motion, value: row index (0-based)
    }

    const newRows = [];
    changes.forEach(change => {
      const { motion, category } = change;
      if (motionMap.has(motion.trim())) {
        // 如果動作已存在，更新對應行的分類
        const rowIndex = motionMap.get(motion.trim());
        values[rowIndex][1] = category;
      } else {
        // 如果是新動作，準備新增
        newRows.push([motion, category]);
      }
    });

    // 一次性寫回所有更新
    range.setValues(values);

    // 一次性附加所有新資料
    if (newRows.length > 0) {
      exerciseSheet.getRange(exerciseSheet.getLastRow() + 1, 1, newRows.length, 2).setValues(newRows);
    }

    SpreadsheetApp.flush();

    if(userSheet) {
      const cache = CacheService.getUserCache();
      const cacheKey = `category_map_${userSheet.getId()}`;
      cache.remove(cacheKey);
      Logger.log('ExerciseCategoryMap 快取已清除。');
    }

    return { status: 'success', message: '已成功儲存所有分類變更！' };

  } catch (e) {
    Logger.log(`updateMultipleExerciseCategoriesToServer 錯誤: ${e.toString()}`);
    return { status: 'error', message: '後端批次更新失敗: ' + e.message };
  }
}

/**
 * (API) 以 base64 data URL 回傳一張體態照片。
 * 授權規則：照片檔案必須位於 PHOTOS_FOLDER_ID/<targetEmail>/ 之下，
 * 而 targetEmail 由 _resolveTarget 決定（非 Admin 只能看自己的）。
 * @returns {{dataUrl: string}}
 */
function getPhotoAsDataUrl(authedEmail, fileId, requestedEmail) {
  if (!fileId || typeof fileId !== 'string') {
    throw new Error('缺少照片 ID。');
  }
  const target = _resolveTarget(authedEmail, requestedEmail);

  const file = DriveApp.getFileById(fileId);
  let authorized = false;
  const parents = file.getParents();
  while (parents.hasNext()) {
    const parent = parents.next();
    if (parent.getName() === target.targetEmail) {
      const grandParents = parent.getParents();
      while (grandParents.hasNext()) {
        if (grandParents.next().getId() === CONFIG.PHOTOS_FOLDER_ID) {
          authorized = true;
        }
      }
    }
  }
  if (!authorized) {
    throw new Error('無權存取此照片。');
  }

  const blob = file.getBlob();
  return {
    dataUrl: 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes())
  };
}

// =======================================================
// InBody 量測記錄 (R1)
// =======================================================

const INBODY_HEADERS = ['id', 'date', 'weight', 'bodyfat', 'smm', 'photo_id'];
const INBODY_RANGES = { weight: [20, 300], bodyfat: [1, 70], smm: [10, 100] };
const INBODY_FIELD_NAMES = { weight: '體重', bodyfat: '體脂率', smm: '骨骼肌重' };

function _getInBodySheet(userSheet) {
  const sheet = _getOrCreateSheet(userSheet, CONSTANTS.SHEETS.INBODY_LOG);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(INBODY_HEADERS);
  }
  return sheet;
}

function _parseInBodyNumber(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const num = parseFloat(value);
  const range = INBODY_RANGES[field];
  if (isNaN(num) || num < range[0] || num > range[1]) {
    throw new Error(INBODY_FIELD_NAMES[field] + ' 數值不合理（允許範圍 ' + range[0] + '–' + range[1] + '）。');
  }
  return num;
}

/**
 * (API) 新增一筆 InBody 量測：寫入 InBodyLog、存紙本照片（可選）、
 * 同步 append Profile 最新值（BMR/TDEE 即時反映）。僅限本人。
 */
function saveInBodyRecord(authedEmail, record) {
  if (!record || typeof record !== 'object' || !record.date || typeof record.date !== 'string') {
    throw new Error('無效的量測資料格式或缺少日期。');
  }
  const weight = _parseInBodyNumber(record.weight, 'weight');
  const bodyfat = _parseInBodyNumber(record.bodyfat, 'bodyfat');
  const smm = _parseInBodyNumber(record.smm, 'smm');
  if (weight === null && bodyfat === null && smm === null) {
    throw new Error('體重、體脂率、骨骼肌重至少須填一項。');
  }

  const userSheet = _getUserSheet(authedEmail, true);
  if (!userSheet) throw new Error('找不到您的資料檔案。');
  const sheet = _getInBodySheet(userSheet);

  // 保留當前時間的日期物件（與 saveBodyPhotosToServer 同法，見 API.gs:296-299）
  const dateParts = record.date.split('-');
  const recordDate = new Date();
  recordDate.setFullYear(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));

  // 紙本照片（可選；存檔模式同 saveBodyPhotosToServer API.gs:304-324）
  let photoId = '';
  if (record.photo) {
    const photosFolder = DriveApp.getFolderById(CONFIG.PHOTOS_FOLDER_ID);
    const folders = photosFolder.getFoldersByName(authedEmail);
    const userPhotoFolder = folders.hasNext() ? folders.next() : photosFolder.createFolder(authedEmail);
    const dateString = Utilities.formatDate(recordDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const fileData = record.photo;
    const mimeType = fileData.substring(5, fileData.indexOf(';'));
    const bytes = Utilities.base64Decode(fileData.substring(fileData.indexOf('base64,') + 7));
    const blob = Utilities.newBlob(bytes, mimeType, 'inbody_' + dateString + '_' + recordDate.getTime() + '.jpg');
    photoId = userPhotoFolder.createFile(blob).getId();
  }

  const id = 'ib_' + recordDate.getTime();
  sheet.appendRow([
    id, recordDate,
    weight === null ? '' : weight,
    bodyfat === null ? '' : bodyfat,
    smm === null ? '' : smm,
    photoId
  ]);

  // 同步 Profile 最新值（append 模式同 saveBodyPhotosToServer API.gs:338-353，多支援 smm）
  const profileUpdateData = {};
  if (weight !== null) profileUpdateData.weight = weight;
  if (bodyfat !== null) profileUpdateData.bodyfat = bodyfat;
  if (smm !== null) profileUpdateData.smm = smm;
  const profileSheet = _getOrCreateSheet(userSheet, CONSTANTS.SHEETS.PROFILE);
  const latestData = _getLatestProfileData(userSheet);
  const mergedData = { ...latestData, ...profileUpdateData, '更新日期': recordDate };
  const headers = profileSheet.getRange(1, 1, 1, profileSheet.getLastColumn()).getValues()[0];
  profileSheet.appendRow(headers.map(function (h) { return mergedData[h] !== undefined ? mergedData[h] : ''; }));
  profileSheet.sort(1, false);
  const updatedProfileData = _getLatestProfileData(userSheet);
  if (updatedProfileData && updatedProfileData['更新日期'] instanceof Date) {
    updatedProfileData['更新日期'] = updatedProfileData['更新日期'].toISOString();
  }

  CacheService.getUserCache().remove('analysis_data_' + authedEmail);
  return { status: 'success', message: 'InBody 量測已儲存！', newRecordId: id, updatedProfileData: updatedProfileData };
}

/**
 * (API) 取得 InBody 量測歷史（新→舊）。經 _resolveTarget，admin 可看學員。
 */
function getInBodyRecords(authedEmail, requestedEmail) {
  const target = _resolveTarget(authedEmail, requestedEmail);
  const userSheet = _getUserSheet(target.targetEmail, false);
  if (!userSheet) return [];
  const sheet = userSheet.getSheetByName(CONSTANTS.SHEETS.INBODY_LOG);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, INBODY_HEADERS.length).getValues();
  const records = rows.map(function (row) {
    return {
      id: row[0],
      date: row[1] instanceof Date ? row[1].toISOString() : String(row[1]),
      weight: row[2] === '' ? null : parseFloat(row[2]),
      bodyfat: row[3] === '' ? null : parseFloat(row[3]),
      smm: row[4] === '' ? null : parseFloat(row[4]),
      photoId: row[5] || null
    };
  });
  records.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
  return records;
}

/**
 * (API) 刪除一筆 InBody 量測（含關聯照片移至垃圾桶）。僅限本人。
 */
function deleteInBodyRecord(authedEmail, recordId) {
  if (!recordId || typeof recordId !== 'string') throw new Error('缺少記錄 ID。');
  const userSheet = _getUserSheet(authedEmail, false);
  if (!userSheet) throw new Error('找不到您的資料檔案。');
  const sheet = userSheet.getSheetByName(CONSTANTS.SHEETS.INBODY_LOG);
  if (sheet && sheet.getLastRow() >= 2) {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === recordId) {
        const photoId = data[i][5];
        if (photoId) {
          try { DriveApp.getFileById(photoId).setTrashed(true); }
          catch (e) { Logger.log('刪除 InBody 照片失敗: ' + e.message); }
        }
        sheet.deleteRow(i + 1);
        CacheService.getUserCache().remove('analysis_data_' + authedEmail);
        return { status: 'success', message: '記錄已刪除。' };
      }
    }
  }
  throw new Error('找不到該筆記錄。');
}