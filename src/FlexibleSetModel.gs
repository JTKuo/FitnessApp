// =======================================================
// WorkoutLog V3 flexible set foundation
// =======================================================

// Existing WorkoutLog columns A:J remain untouched. These fields are appended only.
const WORKOUT_LOG_FLEXIBLE_SET_HEADERS = [
  'ExerciseId',
  'SetType',
  'TrackingType',
  'DurationSec',
  'Side',
  'LoadMode'
];

const FLEXIBLE_SET_DEFAULTS = {
  setType: 'working',
  trackingType: 'weight_reps',
  side: 'both',
  loadMode: 'total'
};

/**
 * Ensure SessionId plus the first flexible-set columns exist without moving legacy columns.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {Object<string, number>} header -> 1-based column number
 */
function _ensureWorkoutLogFlexibleHeaders(sheet) {
  _ensureWorkoutLogSessionIdHeader(sheet);

  let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function (value) { return String(value || '').trim(); });

  const missing = WORKOUT_LOG_FLEXIBLE_SET_HEADERS.filter(function (header) {
    return headers.indexOf(header) === -1;
  });

  if (missing.length > 0) {
    sheet.getRange(1, sheet.getLastColumn() + 1, 1, missing.length).setValues([missing]);
    sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold');
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(function (value) { return String(value || '').trim(); });
  }

  const map = {};
  headers.forEach(function (header, index) {
    if (header) map[header] = index + 1;
  });
  return map;
}

function _normalizeSetType(value) {
  return String(value || '').trim().toLowerCase() === 'warmup' ? 'warmup' : 'working';
}

function _normalizeTrackingType(value, fallback) {
  const candidate = String(value || fallback || FLEXIBLE_SET_DEFAULTS.trackingType).trim();
  return candidate === 'duration' ? 'duration' : 'weight_reps';
}

function _normalizeSide(value) {
  const candidate = String(value || '').trim().toLowerCase();
  if (candidate === 'left' || candidate === 'right') return candidate;
  return 'both';
}

function _normalizeLoadMode(value, fallback) {
  const candidate = String(value || fallback || FLEXIBLE_SET_DEFAULTS.loadMode).trim();
  return candidate || FLEXIBLE_SET_DEFAULTS.loadMode;
}

function _durationOrBlank(value) {
  const numeric = Number(value);
  if (!isFinite(numeric) || numeric <= 0) return '';
  return Math.round(numeric);
}

/**
 * Merge payload-level set semantics with ExerciseMaster defaults.
 * Payload values win because a future session/program may override an exercise default.
 */
function _resolveFlexibleSetMetadata(set, exerciseMetadata) {
  const metadata = exerciseMetadata || {};
  const trackingType = _normalizeTrackingType(set && set.tracking_type, metadata.trackingType);
  const setType = _normalizeSetType(set && set.set_type);
  const side = _normalizeSide(set && set.side);
  const loadMode = _normalizeLoadMode(set && set.load_mode, metadata.loadMode);

  return {
    exerciseId: String(metadata.exerciseId || '').trim(),
    setType: setType,
    trackingType: trackingType,
    durationSec: trackingType === 'duration' ? _durationOrBlank(set && set.duration_sec) : '',
    side: side,
    loadMode: loadMode,
    laterality: String(metadata.laterality || 'bilateral').trim() || 'bilateral'
  };
}

/**
 * Legacy Volume is trustworthy only for the semantics the old logger already supported.
 * Unknown unilateral/per-hand semantics intentionally return false rather than fabricating volume.
 */
function _canCalculateLegacyVolume(setMetadata) {
  return Boolean(
    setMetadata &&
    setMetadata.trackingType === 'weight_reps' &&
    setMetadata.loadMode === 'total' &&
    setMetadata.side === 'both' &&
    setMetadata.laterality !== 'unilateral'
  );
}

/**
 * Apply SessionId + flexible set metadata to a legacy row while preserving all original columns.
 */
function _withWorkoutLogV3Fields(baseRow, totalColumns, headerMap, sessionId, setMetadata) {
  const row = baseRow.slice();
  while (row.length < totalColumns) row.push('');

  if (headerMap.SessionId) row[headerMap.SessionId - 1] = sessionId || '';

  if (setMetadata) {
    if (headerMap.ExerciseId) row[headerMap.ExerciseId - 1] = setMetadata.exerciseId || '';
    if (headerMap.SetType) row[headerMap.SetType - 1] = setMetadata.setType || FLEXIBLE_SET_DEFAULTS.setType;
    if (headerMap.TrackingType) row[headerMap.TrackingType - 1] = setMetadata.trackingType || FLEXIBLE_SET_DEFAULTS.trackingType;
    if (headerMap.DurationSec) row[headerMap.DurationSec - 1] = setMetadata.durationSec || '';
    if (headerMap.Side) row[headerMap.Side - 1] = setMetadata.side || FLEXIBLE_SET_DEFAULTS.side;
    if (headerMap.LoadMode) row[headerMap.LoadMode - 1] = setMetadata.loadMode || FLEXIBLE_SET_DEFAULTS.loadMode;
  }

  return row;
}
