// =======================================================
// Workout Picker 2.0 helpers
// =======================================================

const EXERCISE_PICKER_RECENT_SCAN_ROWS = 240;
const EXERCISE_PICKER_RECENT_LIMIT = 8;

/**
 * Read a small newest-first window from WorkoutLog and return unique motions.
 * This intentionally avoids a full history scan during bootstrap.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} userSheet
 * @param {number=} limit
 * @returns {string[]}
 */
function _getRecentExerciseNamesForPicker(userSheet, limit) {
  const targetLimit = Math.max(1, Math.min(Number(limit) || EXERCISE_PICKER_RECENT_LIMIT, 20));
  if (!userSheet) return [];

  const sheet = userSheet.getSheetByName(CONSTANTS.SHEETS.WORKOUT_LOG);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const rowCount = Math.min(sheet.getLastRow() - 1, EXERCISE_PICKER_RECENT_SCAN_ROWS);
  const values = sheet.getRange(2, 2, rowCount, 1).getValues();
  const seen = {};
  const recent = [];

  for (let i = 0; i < values.length; i++) {
    const motion = String(values[i][0] || '').trim();
    if (!motion || seen[motion]) continue;
    seen[motion] = true;
    recent.push(motion);
    if (recent.length >= targetLimit) break;
  }

  return recent;
}
