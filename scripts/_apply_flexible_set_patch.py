from pathlib import Path
import re


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"missing expected snippet: {label}")
    return text.replace(old, new, 1)


api_path = Path('src/API.gs')
api = api_path.read_text(encoding='utf-8')

api = replace_once(
    api,
    """  const infoMap = _getExerciseInfoMap(userSheet);\n  const motions = new Set();\n  infoMap.forEach(function (_info, motion) { motions.add(motion); });""",
    """  const infoMap = _getExerciseInfoMap(userSheet);\n  let metadataMap = new Map();\n  try {\n    metadataMap = _getExerciseMetadataMap(userSheet);\n  } catch (e) {\n    Logger.log('ExerciseMaster metadata read failed; catalog will use conservative defaults: ' + e.message);\n  }\n\n  const motions = new Set();\n  infoMap.forEach(function (_info, motion) { motions.add(motion); });\n  metadataMap.forEach(function (_info, motion) { motions.add(motion); });""",
    'getExerciseCatalog metadata map',
)

api = replace_once(
    api,
    """  const catalog = [];\n  motions.forEach(function (motion) {\n    const info = infoMap.get(motion);\n    catalog.push({\n      motion: motion,\n      category: info ? info.category : '',\n      tags: info ? info.tags : []\n    });\n  });""",
    """  const catalog = [];\n  motions.forEach(function (motion) {\n    const info = infoMap.get(motion);\n    const metadata = metadataMap.get(motion);\n    catalog.push({\n      motion: motion,\n      category: metadata ? metadata.category : (info ? info.category : ''),\n      tags: metadata ? metadata.tags : (info ? info.tags : []),\n      exerciseId: metadata ? metadata.exerciseId : '',\n      trackingType: metadata ? metadata.trackingType : 'weight_reps',\n      loadMode: metadata ? metadata.loadMode : 'total',\n      laterality: metadata ? metadata.laterality : 'bilateral',\n      defaultRestSec: metadata ? metadata.defaultRestSec : 30,\n      demoMedia: metadata ? metadata.demoMedia : '',\n      active: metadata ? metadata.active : true\n    });\n  });""",
    'getExerciseCatalog payload',
)

api_path.write_text(api, encoding='utf-8')

internal_path = Path('src/Internal.gs')
internal = internal_path.read_text(encoding='utf-8')

new_write_function = r'''function _writeNewLog(sheet, date, workoutData, savedAdminComments) {
  const KG_TO_LB = 2.20462262;
  const allRowsToWrite = [];
  const exercises = {};
  const userSheet = sheet.getParent();
  const sessionId = _resolveWorkoutSessionId(userSheet, date);
  const sessionNote = workoutData.length > 0 ? String(workoutData[0].session_note || '') : '';

  // New motions should receive a stable ExerciseId on their very first save.
  // Registration/migration remains best-effort so taxonomy problems never block the workout itself.
  try {
    _ensureExercisesRegistered(
      userSheet.getName(),
      userSheet,
      workoutData.map(function (set) { return set.motion; })
    );
  } catch (e) {
    Logger.log('Pre-write exercise registration failed; workout save will continue: ' + e.message);
  }

  let exerciseMetadataMap = new Map();
  try {
    exerciseMetadataMap = _getExerciseMetadataMap(userSheet);
  } catch (e) {
    Logger.log('Exercise metadata unavailable; flexible rows will use conservative defaults: ' + e.message);
  }

  const headerMap = _ensureWorkoutLogFlexibleHeaders(sheet);
  const totalColumns = sheet.getLastColumn();

  workoutData.forEach(function (set) {
    if (!exercises[set.motion]) exercises[set.motion] = [];
    exercises[set.motion].push(set);
  });

  allRowsToWrite.push(
    _withWorkoutLogV3Fields([date, '', '', '', '', '', '', '', ''], totalColumns, headerMap, sessionId, null)
  );

  let dailyTotalVolume = 0;
  let workingSetCount = 0;

  for (const motionName in exercises) {
    const sets = exercises[motionName];
    const exerciseMetadata = exerciseMetadataMap.get(motionName) || null;
    let exerciseTotalVolume = 0;
    const adminCommentForMotion = savedAdminComments.get(motionName) || '';

    sets.forEach(function (set, index) {
      const setMetadata = _resolveFlexibleSetMetadata(set, exerciseMetadata);
      if (setMetadata.setType === 'working') workingSetCount += 1;

      const isDuration = setMetadata.trackingType === 'duration';
      const weightKgNumber = Number(set.weight_in_kg);
      const repsNumber = Number(set.reps);
      const weightNumber = Number(set.weight);
      const weight_kg = !isDuration && isFinite(weightKgNumber) ? weightKgNumber : '';
      const reps = !isDuration && isFinite(repsNumber) ? repsNumber : '';
      let weight_lbs = '';

      if (!isDuration) {
        if (set.unit === '磅') {
          weight_lbs = isFinite(weightNumber) ? weightNumber : 0;
        } else {
          weight_lbs = isFinite(weightNumber) ? parseFloat((weightNumber * KG_TO_LB).toFixed(2)) : 0;
        }
      }

      const volume = _canCalculateLegacyVolume(setMetadata)
        ? (Number(weight_kg) || 0) * (Number(reps) || 0)
        : 0;
      exerciseTotalVolume += volume;

      const note = index === 0 ? set.note : '';
      const adminComment = index === 0 ? adminCommentForMotion : '';
      const legacyRow = ['', motionName, index + 1, reps, weight_kg, weight_lbs, volume, note, adminComment];
      const rowData = _withWorkoutLogV3Fields(
        legacyRow,
        totalColumns,
        headerMap,
        sessionId,
        setMetadata
      );
      allRowsToWrite.push(rowData);
    });

    // Legacy summary rows remain until all readers have migrated to V3 fields.
    allRowsToWrite.push(
      _withWorkoutLogV3Fields(
        ['', '', '', '', '', '動作總結', exerciseTotalVolume, '', ''],
        totalColumns,
        headerMap,
        sessionId,
        null
      )
    );
    dailyTotalVolume += exerciseTotalVolume;
  }

  allRowsToWrite.push(
    _withWorkoutLogV3Fields(
      ['', '', '', '', '', '本日總結', dailyTotalVolume, '', ''],
      totalColumns,
      headerMap,
      sessionId,
      null
    )
  );

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
internal, count = pattern.subn(new_write_function + "\n\n", internal, count=1)
if count != 1:
    raise SystemExit(f'expected one _writeNewLog replacement, got {count}')

internal_path.write_text(internal, encoding='utf-8')
print('Flexible set backend patch applied.')
