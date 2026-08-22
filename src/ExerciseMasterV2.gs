// =======================================================
// ExerciseMaster V2 metadata foundation
// =======================================================

/**
 * Migration strategy:
 * - keep legacy Motion | Category | Tags as the first three columns
 * - append V2 metadata columns only
 * - never infer duration/unilateral/bodyweight semantics from the exercise name
 * - only fill blank metadata cells with behavior-preserving defaults
 */
const EXERCISE_MASTER_V2_HEADERS = [
  'Motion',
  'Category',
  'Tags',
  'ExerciseId',
  'TrackingType',
  'LoadMode',
  'Laterality',
  'DefaultRestSec',
  'DemoMedia',
  'Active'
];

const EXERCISE_MASTER_V2_DEFAULTS = {
  TrackingType: 'weight_reps',
  LoadMode: 'total',
  Laterality: 'bilateral',
  DefaultRestSec: 30,
  Active: true
};

function _generateExerciseId() {
  return 'ex_' + Utilities.getUuid().replace(/-/g, '').substring(0, 12);
}

function _exerciseMasterHeaderMap(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach(function (header, index) {
    const key = String(header || '').trim();
    if (key) map[key] = index + 1; // 1-based column number
  });
  return map;
}

function _isBlankExerciseMetadataValue(value) {
  return value === '' || value === null || value === undefined;
}

/**
 * Ensure a user's ExerciseMaster exists and is on the additive V2 schema.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} userSheet
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function _ensureExerciseMasterV2ForUserSheet(userSheet) {
  if (!userSheet) throw new Error('ExerciseMaster V2 migration requires a user spreadsheet.');

  let sheet = userSheet.getSheetByName(CONSTANTS.SHEETS.EXERCISE_MASTER);
  if (!sheet) sheet = userSheet.insertSheet(CONSTANTS.SHEETS.EXERCISE_MASTER);

  _ensureExerciseMasterV2Sheet(sheet);
  return sheet;
}

/**
 * Add missing V2 headers and backfill stable IDs/default metadata for existing rows.
 * Existing non-blank metadata is never overwritten.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {{headersAdded: string[], idsBackfilled: number, defaultsBackfilled: number}}
 */
function _ensureExerciseMasterV2Sheet(sheet) {
  if (!sheet) throw new Error('ExerciseMaster sheet is required.');

  let headersAdded = [];

  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
    sheet.getRange(1, 1, 1, EXERCISE_MASTER_V2_HEADERS.length).setValues([EXERCISE_MASTER_V2_HEADERS]);
    headersAdded = EXERCISE_MASTER_V2_HEADERS.slice();
  } else {
    const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(function (header) { return String(header || '').trim(); });

    const missingHeaders = EXERCISE_MASTER_V2_HEADERS.filter(function (header) {
      return existingHeaders.indexOf(header) === -1;
    });

    if (missingHeaders.length > 0) {
      sheet.getRange(1, sheet.getLastColumn() + 1, 1, missingHeaders.length).setValues([missingHeaders]);
      headersAdded = missingHeaders;
    }
  }

  sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold');
  sheet.setFrozenRows(1);

  if (sheet.getLastRow() < 2) {
    return { headersAdded: headersAdded, idsBackfilled: 0, defaultsBackfilled: 0 };
  }

  const headerMap = _exerciseMasterHeaderMap(sheet);
  const rowCount = sheet.getLastRow() - 1;
  const motionColumn = headerMap.Motion;
  if (!motionColumn) throw new Error('ExerciseMaster is missing the Motion header.');

  const motions = sheet.getRange(2, motionColumn, rowCount, 1).getValues();

  // Stable ExerciseId: preserve existing IDs; fill blanks and repair accidental duplicates.
  const idColumn = headerMap.ExerciseId;
  const idValues = sheet.getRange(2, idColumn, rowCount, 1).getValues();
  const seenIds = {};
  let idsBackfilled = 0;
  let idChanged = false;

  for (let i = 0; i < rowCount; i++) {
    const motion = String(motions[i][0] || '').trim();
    if (!motion) continue;

    let id = String(idValues[i][0] || '').trim();
    if (!id || seenIds[id]) {
      id = _generateExerciseId();
      idValues[i][0] = id;
      idsBackfilled += 1;
      idChanged = true;
    }
    seenIds[id] = true;
  }

  if (idChanged) sheet.getRange(2, idColumn, rowCount, 1).setValues(idValues);

  let defaultsBackfilled = 0;
  Object.keys(EXERCISE_MASTER_V2_DEFAULTS).forEach(function (header) {
    const column = headerMap[header];
    if (!column) return;

    const values = sheet.getRange(2, column, rowCount, 1).getValues();
    let changed = false;

    for (let i = 0; i < rowCount; i++) {
      const motion = String(motions[i][0] || '').trim();
      if (!motion || !_isBlankExerciseMetadataValue(values[i][0])) continue;

      values[i][0] = EXERCISE_MASTER_V2_DEFAULTS[header];
      defaultsBackfilled += 1;
      changed = true;
    }

    if (changed) sheet.getRange(2, column, rowCount, 1).setValues(values);
  });

  if (headersAdded.length > 0 || idsBackfilled > 0 || defaultsBackfilled > 0) {
    Logger.log(
      'ExerciseMaster V2 migration: headers=' + headersAdded.join(',') +
      ', ids=' + idsBackfilled +
      ', defaults=' + defaultsBackfilled
    );
  }

  return {
    headersAdded: headersAdded,
    idsBackfilled: idsBackfilled,
    defaultsBackfilled: defaultsBackfilled
  };
}

function _exerciseMetadataActive(value) {
  if (value === false) return false;
  if (typeof value === 'string' && value.trim().toLowerCase() === 'false') return false;
  return true;
}

/**
 * Header-aware metadata reader for the upcoming Flexible Set Model.
 * Calling it also guarantees the lazy V2 migration has run.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} userSheet
 * @returns {Map<string, object>}
 */
function _exerciseMasterHeaderMapFromHeaders(headers) {
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
