// =======================================================
// New Exercise Setup — explicit user-configured metadata
// =======================================================

const EXERCISE_SETUP_TRACKING_TYPES = ['weight_reps', 'duration'];
const EXERCISE_SETUP_LOAD_MODES = ['total', 'per_hand'];
const EXERCISE_SETUP_LATERALITIES = ['bilateral', 'unilateral'];

function _normalizeExerciseSetupPayload(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('無效的動作設定。');
  }

  const motion = String(metadata.motion || '').trim();
  if (!motion) throw new Error('請輸入動作名稱。');
  if (motion.length > 100) throw new Error('動作名稱過長。');

  const trackingType = EXERCISE_SETUP_TRACKING_TYPES.indexOf(metadata.trackingType) >= 0
    ? metadata.trackingType
    : 'weight_reps';
  const laterality = EXERCISE_SETUP_LATERALITIES.indexOf(metadata.laterality) >= 0
    ? metadata.laterality
    : 'bilateral';
  let loadMode = EXERCISE_SETUP_LOAD_MODES.indexOf(metadata.loadMode) >= 0
    ? metadata.loadMode
    : 'total';
  if (trackingType === 'duration') loadMode = 'total';

  let defaultRestSec = Number(metadata.defaultRestSec);
  if (!isFinite(defaultRestSec)) defaultRestSec = 60;
  defaultRestSec = Math.max(1, Math.min(600, Math.round(defaultRestSec)));

  return {
    motion: motion,
    trackingType: trackingType,
    loadMode: loadMode,
    laterality: laterality,
    defaultRestSec: defaultRestSec
  };
}

/**
 * Create or explicitly update one ExerciseMaster metadata row.
 * Existing ExerciseId / Category / Tags are preserved; new rows receive taxonomy
 * suggestions for Category/Tags and a stable ExerciseId.
 *
 * This endpoint is intentionally idempotent by Motion. The frontend may retry a
 * timed-out transport request, so concurrent attempts are serialized here to
 * prevent two executions from both observing "row missing" and appending twice.
 */
function saveExerciseMetadata(authedEmail, requestedEmail, metadata) {
  const normalized = _normalizeExerciseSetupPayload(metadata);
  const target = _resolveTarget(authedEmail, requestedEmail || null);
  const userSheet = _getUserSheet(target.targetEmail, true);
  if (!userSheet) throw new Error('找不到您的資料檔案。');

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const context = _getExerciseMasterV2ReadContext(userSheet);
    const sheet = context.sheet;
    const read = _readExerciseMetadataFromContext(context);
    const width = sheet.getLastColumn();
    const motionColumn = context.headerMap.Motion;
    let rowIndex = -1;

    for (let i = 0; i < read.data.length; i++) {
      const motion = motionColumn ? String(read.data[i][motionColumn - 1] || '').trim() : '';
      if (motion === normalized.motion) {
        rowIndex = i;
        break;
      }
    }

    let row;
    if (rowIndex >= 0) {
      row = read.data[rowIndex].slice();
    } else {
      const suggestion = suggestClassification(normalized.motion);
      row = _buildExerciseMasterV2Row(
        width,
        context.headerMap,
        normalized.motion,
        suggestion.category,
        suggestion.tags
      );
    }

    _setExerciseRowValue(row, context.headerMap, 'TrackingType', normalized.trackingType);
    _setExerciseRowValue(row, context.headerMap, 'LoadMode', normalized.loadMode);
    _setExerciseRowValue(row, context.headerMap, 'Laterality', normalized.laterality);
    _setExerciseRowValue(row, context.headerMap, 'DefaultRestSec', normalized.defaultRestSec);
    _setExerciseRowValue(row, context.headerMap, 'Active', true);

    if (rowIndex >= 0) {
      sheet.getRange(rowIndex + 2, 1, 1, width).setValues([row]);
    } else {
      sheet.getRange(sheet.getLastRow() + 1, 1, 1, width).setValues([row]);
    }

    CacheService.getUserCache().remove('category_map_' + userSheet.getId());
    const saved = _exerciseMetadataFromRow(row, context.headerMap);
    if (!saved) throw new Error('動作設定儲存失敗。');
    return saved;
  } finally {
    lock.releaseLock();
  }
}
