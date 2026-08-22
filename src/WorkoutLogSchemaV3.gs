// =======================================================
// WorkoutLog V3 set schema foundation (backend only)
// =======================================================

/**
 * This file intentionally has no frontend/runtime UI dependency.
 * Legacy WorkoutLog columns A:I plus SessionId remain in place; V3 fields append only.
 * Old clients that do not send set metadata keep exactly the legacy semantics:
 * working + weight_reps + both + total.
 */
const WORKOUT_LOG_V3_SET_HEADERS = [
  'ExerciseId',
  'SetType',
  'TrackingType',
  'DurationSec',
  'Side',
  'LoadMode'
];

function _ensureWorkoutLogV3SetHeaders(sheet) {
  _ensureWorkoutLogSessionIdHeader(sheet);

  let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function (value) { return String(value || '').trim(); });

  const missing = WORKOUT_LOG_V3_SET_HEADERS.filter(function (header) {
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

function _normalizeWorkoutSetType(value) {
  return String(value || '').trim().toLowerCase() === 'warmup' ? 'warmup' : 'working';
}

function _normalizeWorkoutTrackingType(value) {
  return String(value || '').trim().toLowerCase() === 'duration' ? 'duration' : 'weight_reps';
}

function _normalizeWorkoutSide(value) {
  const side = String(value || '').trim().toLowerCase();
  return side === 'left' || side === 'right' ? side : 'both';
}

function _normalizeWorkoutLoadMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  const supported = ['total', 'per_hand', 'single_implement', 'bodyweight', 'assisted'];
  return supported.indexOf(mode) !== -1 ? mode : 'total';
}

function _normalizeWorkoutDurationSec(value) {
  const numeric = Number(value);
  if (!isFinite(numeric) || numeric <= 0) return '';
  return Math.round(numeric);
}

/**
 * Resolve optional V3 fields from the request payload.
 * IMPORTANT: TrackingType/LoadMode do NOT inherit from ExerciseMaster yet.
 * Until the UI explicitly sends these fields, old clients must remain weight_reps/total.
 * ExerciseMaster is used only for the stable ExerciseId link.
 */
function _resolveWorkoutLogV3SetFields(set, exerciseMetadata) {
  const trackingType = _normalizeWorkoutTrackingType(set && set.tracking_type);
  return {
    exerciseId: String((exerciseMetadata && exerciseMetadata.exerciseId) || (set && set.exercise_id) || '').trim(),
    setType: _normalizeWorkoutSetType(set && set.set_type),
    trackingType: trackingType,
    durationSec: trackingType === 'duration' ? _normalizeWorkoutDurationSec(set && set.duration_sec) : '',
    side: _normalizeWorkoutSide(set && set.side),
    loadMode: _normalizeWorkoutLoadMode(set && set.load_mode)
  };
}

function _withWorkoutLogV3SetFields(baseRow, totalColumns, headerMap, sessionId, setFields) {
  const row = baseRow.slice();
  while (row.length < totalColumns) row.push('');

  if (headerMap.SessionId) row[headerMap.SessionId - 1] = sessionId || '';

  if (setFields) {
    if (headerMap.ExerciseId) row[headerMap.ExerciseId - 1] = setFields.exerciseId || '';
    if (headerMap.SetType) row[headerMap.SetType - 1] = setFields.setType || 'working';
    if (headerMap.TrackingType) row[headerMap.TrackingType - 1] = setFields.trackingType || 'weight_reps';
    if (headerMap.DurationSec) row[headerMap.DurationSec - 1] = setFields.durationSec || '';
    if (headerMap.Side) row[headerMap.Side - 1] = setFields.side || 'both';
    if (headerMap.LoadMode) row[headerMap.LoadMode - 1] = setFields.loadMode || 'total';
  }

  return row;
}
