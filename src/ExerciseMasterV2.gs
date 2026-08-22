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
function _getExerciseMetadataMap(userSheet) {
  const metadataMap = new Map();
  const sheet = _ensureExerciseMasterV2ForUserSheet(userSheet);
  if (sheet.getLastRow() < 2) return metadataMap;

  const headerMap = _exerciseMasterHeaderMap(sheet);
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

  const valueAt = function (row, header) {
    const column = headerMap[header];
    return column ? row[column - 1] : '';
  };

  data.forEach(function (row) {
    const motion = String(valueAt(row, 'Motion') || '').trim();
    if (!motion) return;

    const tagsRaw = String(valueAt(row, 'Tags') || '').trim();
    const tags = tagsRaw ? tagsRaw.split(',').map(function (tag) {
      return String(tag).trim();
    }).filter(Boolean) : [];

    const restRaw = valueAt(row, 'DefaultRestSec');
    const restNumber = Number(restRaw);

    metadataMap.set(motion, {
      exerciseId: String(valueAt(row, 'ExerciseId') || '').trim(),
      motion: motion,
      category: String(valueAt(row, 'Category') || '').trim(),
      tags: tags,
      trackingType: String(valueAt(row, 'TrackingType') || EXERCISE_MASTER_V2_DEFAULTS.TrackingType).trim(),
      loadMode: String(valueAt(row, 'LoadMode') || EXERCISE_MASTER_V2_DEFAULTS.LoadMode).trim(),
      laterality: String(valueAt(row, 'Laterality') || EXERCISE_MASTER_V2_DEFAULTS.Laterality).trim(),
      defaultRestSec: isNaN(restNumber) ? EXERCISE_MASTER_V2_DEFAULTS.DefaultRestSec : restNumber,
      demoMedia: String(valueAt(row, 'DemoMedia') || '').trim(),
      active: _exerciseMetadataActive(valueAt(row, 'Active'))
    });
  });

  return metadataMap;
}
