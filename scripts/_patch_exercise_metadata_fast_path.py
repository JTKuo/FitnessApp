from pathlib import Path

p = Path('src/ExerciseMasterV2.gs')
s = p.read_text(encoding='utf-8')
marker = 'function _getExerciseMetadataMap(userSheet) {'
idx = s.index(marker)
prefix = s[:idx]
replacement = r'''function _exerciseMasterHeaderMapFromHeaders(headers) {
  const map = {};
  headers.forEach(function (header, index) {
    const key = String(header || '').trim();
    if (key) map[key] = index + 1;
  });
  return map;
}

function _getExerciseMasterV2ReadContext(userSheet) {
  if (!userSheet) throw new Error('ExerciseMaster V2 read requires a user spreadsheet.');
  let sheet = userSheet.getSheetByName(CONSTANTS.SHEETS.EXERCISE_MASTER);
  if (!sheet) sheet = _ensureExerciseMasterV2ForUserSheet(userSheet);

  let headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0]
    .map(function (header) { return String(header || '').trim(); });
  const missingHeaders = EXERCISE_MASTER_V2_HEADERS.filter(function (header) {
    return headers.indexOf(header) === -1;
  });
  if (missingHeaders.length > 0) {
    _ensureExerciseMasterV2Sheet(sheet);
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(function (header) { return String(header || '').trim(); });
  }
  return { sheet: sheet, headers: headers, headerMap: _exerciseMasterHeaderMapFromHeaders(headers) };
}

function _exerciseMetadataFromRow(row, headerMap) {
  const valueAt = function (header) {
    const column = headerMap[header];
    return column ? row[column - 1] : '';
  };
  const motion = String(valueAt('Motion') || '').trim();
  if (!motion) return null;
  const tagsRaw = String(valueAt('Tags') || '').trim();
  const tags = tagsRaw ? tagsRaw.split(',').map(function (tag) { return String(tag).trim(); }).filter(Boolean) : [];
  const restRaw = valueAt('DefaultRestSec');
  const restNumber = Number(restRaw);
  return {
    exerciseId: String(valueAt('ExerciseId') || '').trim(),
    motion: motion,
    category: String(valueAt('Category') || '').trim(),
    tags: tags,
    trackingType: String(valueAt('TrackingType') || EXERCISE_MASTER_V2_DEFAULTS.TrackingType).trim(),
    loadMode: String(valueAt('LoadMode') || EXERCISE_MASTER_V2_DEFAULTS.LoadMode).trim(),
    laterality: String(valueAt('Laterality') || EXERCISE_MASTER_V2_DEFAULTS.Laterality).trim(),
    defaultRestSec: isNaN(restNumber) ? EXERCISE_MASTER_V2_DEFAULTS.DefaultRestSec : restNumber,
    demoMedia: String(valueAt('DemoMedia') || '').trim(),
    active: _exerciseMetadataActive(valueAt('Active'))
  };
}

function _readExerciseMetadataFromContext(context) {
  const metadataMap = new Map();
  const sheet = context.sheet;
  if (sheet.getLastRow() < 2) return { metadataMap: metadataMap, data: [] };
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  data.forEach(function (row) {
    const metadata = _exerciseMetadataFromRow(row, context.headerMap);
    if (metadata) metadataMap.set(metadata.motion, metadata);
  });
  return { metadataMap: metadataMap, data: data };
}

function _setExerciseRowValue(row, headerMap, header, value) {
  const column = headerMap[header];
  if (column) row[column - 1] = value;
}

function _buildExerciseMasterV2Row(width, headerMap, motion, category, tags) {
  const row = new Array(width).fill('');
  _setExerciseRowValue(row, headerMap, 'Motion', motion);
  _setExerciseRowValue(row, headerMap, 'Category', category || '');
  _setExerciseRowValue(row, headerMap, 'Tags', Array.isArray(tags) ? tags.join(',') : String(tags || ''));
  _setExerciseRowValue(row, headerMap, 'ExerciseId', _generateExerciseId());
  _setExerciseRowValue(row, headerMap, 'TrackingType', EXERCISE_MASTER_V2_DEFAULTS.TrackingType);
  _setExerciseRowValue(row, headerMap, 'LoadMode', EXERCISE_MASTER_V2_DEFAULTS.LoadMode);
  _setExerciseRowValue(row, headerMap, 'Laterality', EXERCISE_MASTER_V2_DEFAULTS.Laterality);
  _setExerciseRowValue(row, headerMap, 'DefaultRestSec', EXERCISE_MASTER_V2_DEFAULTS.DefaultRestSec);
  _setExerciseRowValue(row, headerMap, 'DemoMedia', '');
  _setExerciseRowValue(row, headerMap, 'Active', EXERCISE_MASTER_V2_DEFAULTS.Active);
  return row;
}

function _prepareWorkoutExerciseMetadata(userSheet, motionNames) {
  const context = _getExerciseMasterV2ReadContext(userSheet);
  const sheet = context.sheet;
  const read = _readExerciseMetadataFromContext(context);
  const metadataMap = read.metadataMap;
  const data = read.data;
  const headerMap = context.headerMap;
  const width = sheet.getLastColumn();

  const rowIndexByMotion = {};
  data.forEach(function (row, index) {
    const motionColumn = headerMap.Motion;
    const motion = motionColumn ? String(row[motionColumn - 1] || '').trim() : '';
    if (motion) rowIndexByMotion[motion] = index;
  });

  const targetMotions = [];
  const seen = {};
  (motionNames || []).forEach(function (raw) {
    const motion = String(raw || '').trim();
    if (!motion || seen[motion]) return;
    seen[motion] = true;
    targetMotions.push(motion);
  });

  const rowsToAppend = [];
  let classificationCacheChanged = false;

  targetMotions.forEach(function (motion) {
    if (Object.prototype.hasOwnProperty.call(rowIndexByMotion, motion)) {
      const dataIndex = rowIndexByMotion[motion];
      const row = data[dataIndex];
      let changed = false;
      const idColumn = headerMap.ExerciseId;
      if (idColumn && !String(row[idColumn - 1] || '').trim()) {
        row[idColumn - 1] = _generateExerciseId();
        changed = true;
      }
      Object.keys(EXERCISE_MASTER_V2_DEFAULTS).forEach(function (header) {
        const column = headerMap[header];
        if (!column || !_isBlankExerciseMetadataValue(row[column - 1])) return;
        row[column - 1] = EXERCISE_MASTER_V2_DEFAULTS[header];
        changed = true;
      });
      if (changed) sheet.getRange(dataIndex + 2, 1, 1, width).setValues([row]);
      const repairedMetadata = _exerciseMetadataFromRow(row, headerMap);
      if (repairedMetadata) metadataMap.set(motion, repairedMetadata);
      return;
    }

    const suggestion = suggestClassification(motion);
    const row = _buildExerciseMasterV2Row(width, headerMap, motion, suggestion.category, suggestion.tags);
    rowsToAppend.push(row);
    const metadata = _exerciseMetadataFromRow(row, headerMap);
    if (metadata) metadataMap.set(motion, metadata);
    classificationCacheChanged = true;
  });

  if (rowsToAppend.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, width).setValues(rowsToAppend);
  }
  if (classificationCacheChanged) {
    CacheService.getUserCache().remove('category_map_' + userSheet.getId());
  }
  return metadataMap;
}

function _getExerciseMetadataMap(userSheet) {
  const context = _getExerciseMasterV2ReadContext(userSheet);
  return _readExerciseMetadataFromContext(context).metadataMap;
}
'''
p.write_text(prefix + replacement, encoding='utf-8')

p = Path('src/Internal.gs')
s = p.read_text(encoding='utf-8')
old = """    exerciseMetadataMap = _traceWorkoutSaveStep('exercise.metadata', function () {\n      return _getExerciseMetadataMap(userSheet);\n    });"""
new = """    exerciseMetadataMap = _traceWorkoutSaveStep('exercise.metadata', function () {\n      return _prepareWorkoutExerciseMetadata(\n        userSheet,\n        workoutData.map(function (set) { return set.motion; })\n      );\n    });"""
if old not in s: raise SystemExit('metadata block not found')
s = s.replace(old, new)
p.write_text(s, encoding='utf-8')

p = Path('src/API.gs')
s = p.read_text(encoding='utf-8')
old = """\n    // 讓新動作自動進入分類目錄（失敗僅記錄，絕不影響訓練記錄的儲存）\n    try {\n      _traceWorkoutSaveStep('exercise.register', function () {\n        _ensureExercisesRegistered(\n          authedEmail,\n          userSheet,\n          workoutData.map(function (s) { return s.motion; })\n        );\n      });\n    } catch (e) {\n      Logger.log('自動登錄動作分類失敗（不影響訓練儲存）：' + e.message);\n    }\n"""
if old not in s: raise SystemExit('registration block not found')
s = s.replace(old, '\n')
p.write_text(s, encoding='utf-8')
