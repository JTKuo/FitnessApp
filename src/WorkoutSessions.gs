// =======================================================
// WorkoutSessions V3 foundation
// =======================================================

const WORKOUT_LOG_SESSION_ID_HEADER = 'SessionId';
const WORKOUT_SESSION_HEADERS = [
  'SessionId',
  'Date',
  'WorkoutName',
  'ProgramId',
  'ProgramWeek',
  'ProgramSessionId',
  'SessionNote',
  'TotalVolume',
  'WorkingSets',
  'StartedAt',
  'CompletedAt',
  'DurationSec',
  'Status'
];

function _dateKey(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return '';
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/**
 * Existing WorkoutLog sheets keep their first 9 columns unchanged.
 * SessionId is appended to the end so all existing hard-coded readers stay valid.
 * @returns {number} 1-based SessionId column number.
 */
function _ensureWorkoutLogSessionIdHeader(logSheet) {
  const lastColumn = Math.max(logSheet.getLastColumn(), 1);
  const headers = logSheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const existingIndex = headers.indexOf(WORKOUT_LOG_SESSION_ID_HEADER);
  if (existingIndex !== -1) return existingIndex + 1;

  const newColumn = lastColumn + 1;
  logSheet.getRange(1, newColumn).setValue(WORKOUT_LOG_SESSION_ID_HEADER).setFontWeight('bold');
  return newColumn;
}

function _getOrCreateWorkoutSessionsSheet(userSheet) {
  let sheet = userSheet.getSheetByName(CONSTANTS.SHEETS.WORKOUT_SESSIONS);
  if (!sheet) sheet = userSheet.insertSheet(CONSTANTS.SHEETS.WORKOUT_SESSIONS);

  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
    sheet.getRange(1, 1, 1, WORKOUT_SESSION_HEADERS.length).setValues([WORKOUT_SESSION_HEADERS]);
    sheet.getRange(1, 1, 1, WORKOUT_SESSION_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
  }

  const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const missing = WORKOUT_SESSION_HEADERS.filter(function (header) {
    return currentHeaders.indexOf(header) === -1;
  });

  if (missing.length > 0) {
    sheet.getRange(1, sheet.getLastColumn() + 1, 1, missing.length).setValues([missing]);
    sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold');
    if (sheet.getFrozenRows() < 1) sheet.setFrozenRows(1);
  }
  return sheet;
}

function _findWorkoutSessionRowByDate(sessionSheet, date) {
  if (sessionSheet.getLastRow() < 2) return -1;
  const targetKey = _dateKey(date);
  if (!targetKey) return -1;

  const headers = sessionSheet.getRange(1, 1, 1, sessionSheet.getLastColumn()).getValues()[0];
  const dateIndex = headers.indexOf('Date');
  if (dateIndex === -1) return -1;

  const values = sessionSheet.getRange(2, 1, sessionSheet.getLastRow() - 1, sessionSheet.getLastColumn()).getValues();
  for (let i = 0; i < values.length; i++) {
    const rowDate = values[i][dateIndex];
    if (rowDate instanceof Date && _dateKey(rowDate) === targetKey) return i + 2;
  }
  return -1;
}

function _findWorkoutSessionRowById(sessionSheet, sessionId) {
  if (!sessionId || sessionSheet.getLastRow() < 2) return -1;
  const headers = sessionSheet.getRange(1, 1, 1, sessionSheet.getLastColumn()).getValues()[0];
  const idIndex = headers.indexOf('SessionId');
  if (idIndex === -1) return -1;

  const values = sessionSheet.getRange(2, idIndex + 1, sessionSheet.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0] || '') === String(sessionId)) return i + 2;
  }
  return -1;
}

function _generateWorkoutSessionId(date) {
  const datePart = _dateKey(date).replace(/-/g, '') || 'unknown';
  const randomPart = Utilities.getUuid().replace(/-/g, '').substring(0, 10);
  return 'ws_' + datePart + '_' + randomPart;
}

/**
 * Run additive schema migrations that should never block a workout save.
 * ExerciseMaster V2 is intentionally lazy: active users are upgraded on their
 * next save without requiring a destructive bulk migration across Drive.
 */
function _runWorkoutV3LazyMigrations(userSheet) {
  try {
    _ensureExerciseMasterV2ForUserSheet(userSheet);
  } catch (e) {
    Logger.log('ExerciseMaster V2 lazy migration failed; workout save will continue: ' + e.message);
  }
}

/**
 * Current Workout UI still models one session per calendar day.
 * Re-saving the same day therefore reuses its SessionId. Multi-session days can
 * be introduced later by passing an explicit SessionId from the client/program layer.
 */
function _resolveWorkoutSessionContext(userSheet, date) {
  const sessionSheet = _getOrCreateWorkoutSessionsSheet(userSheet);
  const headers = sessionSheet.getRange(1, 1, 1, sessionSheet.getLastColumn()).getValues()[0];
  const dateIndex = headers.indexOf('Date');
  const idIndex = headers.indexOf('SessionId');
  const targetKey = _dateKey(date);

  let rowNumber = -1;
  let sessionId = '';
  const lastRow = sessionSheet.getLastRow();

  if (targetKey && lastRow >= 2 && dateIndex !== -1) {
    const firstIndex = Math.min(dateIndex, idIndex === -1 ? dateIndex : idIndex);
    const lastIndex = Math.max(dateIndex, idIndex === -1 ? dateIndex : idIndex);
    const width = lastIndex - firstIndex + 1;

    // WorkoutSessions is newest-first. Normal gym saves therefore hit row 2 and
    // should not scan the user's entire session history.
    const firstRow = sessionSheet.getRange(2, firstIndex + 1, 1, width).getValues()[0];
    const firstDate = firstRow[dateIndex - firstIndex];
    if (firstDate instanceof Date && _dateKey(firstDate) === targetKey) {
      rowNumber = 2;
      if (idIndex !== -1) sessionId = String(firstRow[idIndex - firstIndex] || '');
    } else if (lastRow >= 3) {
      // Historical/back-dated saves retain the old exhaustive lookup behavior.
      const values = sessionSheet.getRange(3, firstIndex + 1, lastRow - 2, width).getValues();
      for (let i = 0; i < values.length; i++) {
        const rowDate = values[i][dateIndex - firstIndex];
        if (!(rowDate instanceof Date) || _dateKey(rowDate) !== targetKey) continue;
        rowNumber = i + 3;
        if (idIndex !== -1) sessionId = String(values[i][idIndex - firstIndex] || '');
        break;
      }
    }
  }

  if (!sessionId) sessionId = _generateWorkoutSessionId(date);

  return {
    sheet: sessionSheet,
    headers: headers,
    rowNumber: rowNumber,
    sessionId: sessionId,
    dateKey: targetKey
  };
}

function _resolveWorkoutSessionId(userSheet, date) {
  return _resolveWorkoutSessionContext(userSheet, date).sessionId;
}

/**
 * Upsert only fields owned by the current logger. Reserved Program/StartedAt/etc.
 * values are preserved if they are filled by future features.
 */
function _upsertWorkoutSession(userSheet, sessionData, sessionContext) {
  const canReuseContext = !!(
    sessionContext &&
    sessionContext.sheet &&
    sessionContext.headers &&
    String(sessionContext.sessionId || '') === String(sessionData.sessionId || '')
  );

  const sheet = canReuseContext ? sessionContext.sheet : _getOrCreateWorkoutSessionsSheet(userSheet);
  const headers = canReuseContext
    ? sessionContext.headers
    : sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  let rowNumber = canReuseContext ? sessionContext.rowNumber : -1;
  if (!canReuseContext) {
    rowNumber = _findWorkoutSessionRowById(sheet, sessionData.sessionId);
    if (rowNumber === -1) rowNumber = _findWorkoutSessionRowByDate(sheet, sessionData.date);
  }

  const isNewRow = rowNumber === -1;
  const existing = {};
  let dateChanged = false;

  if (!isNewRow) {
    const rowValues = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
    headers.forEach(function (header, index) {
      existing[header] = rowValues[index];
    });
    dateChanged = _dateKey(existing.Date) !== _dateKey(sessionData.date);
  }

  const merged = Object.assign({}, existing, {
    SessionId: sessionData.sessionId,
    Date: sessionData.date,
    SessionNote: sessionData.sessionNote || '',
    TotalVolume: sessionData.totalVolume,
    WorkingSets: sessionData.workingSets,
    CompletedAt: new Date(),
    Status: 'completed'
  });

  const newRow = headers.map(function (header) {
    return merged[header] !== undefined && merged[header] !== null ? merged[header] : '';
  });

  if (isNewRow) {
    sheet.appendRow(newRow);
  } else {
    sheet.getRange(rowNumber, 1, 1, newRow.length).setValues([newRow]);
  }

  // Existing same-day sessions are already in the correct position. Sorting the
  // entire sheet on every re-save is pure latency, so only sort when row order
  // can actually change (new session or date change).
  if ((isNewRow || dateChanged) && sheet.getLastRow() > 2) {
    const dateColumn = headers.indexOf('Date') + 1;
    if (dateColumn > 0) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn())
        .sort({ column: dateColumn, ascending: false });
    }
  }

  return sessionData.sessionId;
}
