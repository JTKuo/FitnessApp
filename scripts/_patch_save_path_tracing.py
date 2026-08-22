from pathlib import Path
import re


def replace_once(path, pattern, replacement, label):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 replacement, got {count}')
    p.write_text(text, encoding='utf-8')


# 1) API entry timing: auth vs handler vs total API execution.
replace_once(
    'src/API.gs',
    r"function doPost\(e\) \{.*?\n\}\n\n\n\n// =======================================================\n// 前端 API 接口",
    r'''function doPost(e) {
  const apiStartedAt = Date.now();
  let out;
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('無效的請求格式。');
    }
    const req = JSON.parse(e.postData.contents);

    const authStartedAt = Date.now();
    const email = verifyAny(req.token);
    const authMs = Date.now() - authStartedAt;

    const handler = API_ROUTES[req.action];
    if (!handler) {
      throw new Error('未知的 API action：' + req.action);
    }

    const handlerStartedAt = Date.now();
    const data = handler(email, req.payload || {});
    const handlerMs = Date.now() - handlerStartedAt;

    // 舊函式以回傳值表達錯誤的兩種慣例，一律轉為統一錯誤
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      if (data.error) {
        throw new Error(typeof data.error === 'string' ? data.error : (data.error.message || '後端處理失敗'));
      }
      if (data.status === 'error') {
        throw new Error(data.message || '後端處理失敗');
      }

      if (req.action === 'saveWorkoutData') {
        data.performance = data.performance || {};
        data.performance.authMs = authMs;
        data.performance.handlerMs = handlerMs;
        data.performance.apiTotalMs = Date.now() - apiStartedAt;
      }
    }

    // 每次成功回應都附帶重新計時的 token —— 滑動續期
    out = { ok: true, data: (data === undefined ? null : data), token: issueSessionToken(email) };
  } catch (err) {
    _discardWorkoutSaveTrace();
    out = { ok: false, error: { message: err.message } };
  }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}



// =======================================================
// 前端 API 接口''',
    'doPost tracing'
)


# 2) Top-level save timing.
replace_once(
    'src/API.gs',
    r"function saveWorkoutDataToServer\(authedEmail, workoutData\) \{.*?\n\}\n\n\n/\*\*\n \* 獲取指定使用者的訓練範本",
    r'''function saveWorkoutDataToServer(authedEmail, workoutData) {
  _startWorkoutSaveTrace();
  try {
    const userEmail = authedEmail;

    _traceWorkoutSaveStep('cache.invalidate', function () {
      const cache = CacheService.getUserCache();
      cache.remove(`analysis_data_${userEmail}`);
    });

    if (!workoutData || !Array.isArray(workoutData) || workoutData.length === 0) {
      throw new Error('無效的訓練資料格式或內容為空。');
    }

    const userSheet = _traceWorkoutSaveStep('sheet.openUser', function () {
      return _getUserSheet(authedEmail, true);
    });
    if (!userSheet) throw new Error('找不到您的資料檔案。');

    const date = new Date(workoutData[0].date);

    const logSheet = _traceWorkoutSaveStep('sheet.getWorkoutLog', function () {
      return _getOrCreateSheet(userSheet, CONSTANTS.SHEETS.WORKOUT_LOG);
    });

    const savedAdminComments = _traceWorkoutSaveStep('log.clearToday', function () {
      return _clearTodaysLog(logSheet, date);
    });

    _traceWorkoutSaveStep('log.writeNew', function () {
      _writeNewLog(logSheet, date, workoutData, savedAdminComments);
    });

    // 讓新動作自動進入分類目錄（失敗僅記錄，絕不影響訓練記錄的儲存）
    try {
      _traceWorkoutSaveStep('exercise.register', function () {
        _ensureExercisesRegistered(
          authedEmail,
          userSheet,
          workoutData.map(function (s) { return s.motion; })
        );
      });
    } catch (e) {
      Logger.log('自動登錄動作分類失敗（不影響訓練儲存）：' + e.message);
    }

    const performance = _finishWorkoutSaveTrace();
    Logger.log('[Workout Save Trace] ' + JSON.stringify(performance));
    return {
      status: 'success',
      message: '訓練日誌已成功儲存！',
      performance: performance
    };
  } catch(e) {
    const performance = _finishWorkoutSaveTrace();
    Logger.log('[Workout Save Trace ERROR] ' + JSON.stringify(performance));
    Logger.log("saveWorkoutDataToServer 錯誤: " + e.toString());
    return { status: 'error', message: '後端處理失敗: ' + e.message };
  }
}


/**
 * 獲取指定使用者的訓練範本''',
    'saveWorkoutDataToServer tracing'
)


# 3) Instrument the expensive inner portions of WorkoutLog write.
p = Path('src/Internal.gs')
text = p.read_text(encoding='utf-8')
replacements = [
    (
        "  const sessionId = _resolveWorkoutSessionId(userSheet, date);",
        "  const sessionId = _traceWorkoutSaveStep('session.resolve', function () {\n    return _resolveWorkoutSessionId(userSheet, date);\n  });"
    ),
    (
        "    exerciseMetadataMap = _getExerciseMetadataMap(userSheet);",
        "    exerciseMetadataMap = _traceWorkoutSaveStep('exercise.metadata', function () {\n      return _getExerciseMetadataMap(userSheet);\n    });"
    ),
    (
        "  const headerMap = _ensureWorkoutLogV3SetHeaders(sheet);",
        "  const headerMap = _traceWorkoutSaveStep('log.ensureHeaders', function () {\n    return _ensureWorkoutLogV3SetHeaders(sheet);\n  });"
    ),
    (
        "    const insertionRow = _findInsertionRow(sheet, date);\n    sheet.insertRows(insertionRow, numRows);\n    sheet.getRange(insertionRow, 1, numRows, numCols).setValues(allRowsToWrite);\n\n    _upsertWorkoutSession(userSheet, {",
        "    const insertionRow = _traceWorkoutSaveStep('log.findInsertion', function () {\n      return _findInsertionRow(sheet, date);\n    });\n    _traceWorkoutSaveStep('log.insertRows', function () {\n      sheet.insertRows(insertionRow, numRows);\n    });\n    _traceWorkoutSaveStep('log.setValues', function () {\n      sheet.getRange(insertionRow, 1, numRows, numCols).setValues(allRowsToWrite);\n    });\n\n    _traceWorkoutSaveStep('session.upsert', function () {\n      _upsertWorkoutSession(userSheet, {"
    ),
    (
        "      workingSets: workingSetCount\n    });\n  }\n}",
        "        workingSets: workingSetCount\n      });\n    });\n  }\n}"
    ),
]
for old, new in replacements:
    if old not in text:
        raise SystemExit('Internal.gs patch context not found: ' + old[:80])
    text = text.replace(old, new, 1)
p.write_text(text, encoding='utf-8')


# 4) Mobile-visible diagnostic summary + console detail.
p = Path('web/src/methods.js')
text = p.read_text(encoding='utf-8')
old = """                        .then(response => {\n                            console.info(`[Workout Save] 核心儲存 ${Math.round(performance.now() - saveStartedAt)} ms`);\n                            app.ui.showToast(response.message);\n                            app.cache.clearWorkoutRelated();\n                            app.ui.showLoading(false);\n"""
new = """                        .then(response => {\n                            const clientCoreMs = Math.round(performance.now() - saveStartedAt);\n                            console.info(`[Workout Save] 核心儲存 ${clientCoreMs} ms`);\n                            app.ui.showToast(response.message);\n\n                            if (response.performance) {\n                                const perf = response.performance;\n                                const steps = perf.steps || {};\n                                const slowest = Object.entries(steps).sort((a, b) => b[1] - a[1])[0] || ['', 0];\n                                const gasMs = Number(perf.apiTotalMs || perf.totalMs || 0);\n                                const transportMs = Math.max(0, clientCoreMs - gasMs);\n                                const seconds = (value) => (Number(value || 0) / 1000).toFixed(1);\n                                console.info('[Workout Save] server trace', perf);\n                                app.ui.showToast(\n                                    `儲存效能：核心 ${seconds(clientCoreMs)}s｜GAS ${seconds(gasMs)}s｜傳輸約 ${seconds(transportMs)}s｜最慢 ${slowest[0]} ${seconds(slowest[1])}s`\n                                );\n                            }\n\n                            app.cache.clearWorkoutRelated();\n                            app.ui.showLoading(false);\n"""
if old not in text:
    raise SystemExit('methods.js save-success patch context not found')
text = text.replace(old, new, 1)
p.write_text(text, encoding='utf-8')

print('Save path tracing patch applied.')
