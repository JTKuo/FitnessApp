from pathlib import Path
import re

path = Path('src/Internal.gs')
text = path.read_text(encoding='utf-8')

replacement = r'''function _writeNewLog(sheet, date, workoutData, savedAdminComments) {
  const KG_TO_LB = 2.20462262;
  const allRowsToWrite = [];
  const exercises = {};
  const userSheet = sheet.getParent();
  const sessionId = _resolveWorkoutSessionId(userSheet, date);
  const sessionNote = workoutData.length > 0 ? String(workoutData[0].session_note || '') : '';

  // Backend-only V3 schema rollout. Reading ExerciseMaster here is best-effort and
  // only supplies ExerciseId; old clients still default to legacy set semantics.
  let exerciseMetadataMap = new Map();
  try {
    exerciseMetadataMap = _getExerciseMetadataMap(userSheet);
  } catch (e) {
    Logger.log('WorkoutLog V3 metadata read failed; save continues without ExerciseId: ' + e.message);
  }

  const headerMap = _ensureWorkoutLogV3SetHeaders(sheet);
  const totalColumns = sheet.getLastColumn();

  const withV3Fields = function (baseRow, setFields) {
    return _withWorkoutLogV3SetFields(baseRow, totalColumns, headerMap, sessionId, setFields);
  };

  workoutData.forEach(function (set) {
    if (!exercises[set.motion]) exercises[set.motion] = [];
    exercises[set.motion].push(set);
  });

  allRowsToWrite.push(withV3Fields([date, '', '', '', '', '', '', '', ''], null));

  let dailyTotalVolume = 0;
  let workingSetCount = 0;

  for (const motionName in exercises) {
    const sets = exercises[motionName];
    const exerciseMetadata = exerciseMetadataMap.get(motionName) || null;
    let exerciseTotalVolume = 0;
    const adminCommentForMotion = savedAdminComments.get(motionName) || '';

    sets.forEach(function (set, index) {
      const setFields = _resolveWorkoutLogV3SetFields(set, exerciseMetadata);
      if (setFields.setType === 'working') workingSetCount += 1;

      // Keep the legacy calculations byte-for-byte equivalent for old payloads.
      const weight_kg = set.weight_in_kg;
      const weight_lbs = (set.unit === '磅')
        ? set.weight
        : parseFloat((set.weight * KG_TO_LB).toFixed(2));
      const volume = weight_kg * set.reps;
      exerciseTotalVolume += volume;

      const note = index === 0 ? set.note : '';
      const adminComment = index === 0 ? adminCommentForMotion : '';
      const legacyRow = ['', motionName, index + 1, set.reps, weight_kg, weight_lbs, volume, note, adminComment];
      allRowsToWrite.push(withV3Fields(legacyRow, setFields));
    });

    allRowsToWrite.push(withV3Fields(['', '', '', '', '', '動作總結', exerciseTotalVolume, '', ''], null));
    dailyTotalVolume += exerciseTotalVolume;
  }

  allRowsToWrite.push(withV3Fields(['', '', '', '', '', '本日總結', dailyTotalVolume, '', ''], null));

  if (allRowsToWrite.length > 0) {
    const numRows = allRowsToWrite.length;
    const numCols = allRowsToWrite[0].length;
    const insertionRow = _findInsertionRow(sheet, date);
    sheet.insertRows(insertionRow, numRows);
    sheet.getRange(insertionRow, 1, numRows, numCols).setValues(allRowsToWrite);

    _upsertWorkoutSession(userSheet, {
      sessionId: sessionId,
      date: date,
      sessionNote: sessionNote,
      totalVolume: dailyTotalVolume,
      workingSets: workingSetCount
    });
  }
}'''

pattern = re.compile(
    r"function _writeNewLog\(sheet, date, workoutData, savedAdminComments\) \{.*?\n\}\n\n(?=/\*\*\n \* \(V3 - Final Fix\))",
    re.S,
)
text, count = pattern.subn(replacement + '\n\n', text, count=1)
if count != 1:
    raise SystemExit(f'expected exactly one _writeNewLog replacement, got {count}')

path.write_text(text, encoding='utf-8')
print('WorkoutLog V3 backend patch applied.')
