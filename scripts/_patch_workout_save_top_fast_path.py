from pathlib import Path

# WorkoutSessions: avoid repeat formatting work and make today's row-2 case constant-time.
ws_path = Path('src/WorkoutSessions.gs')
ws = ws_path.read_text(encoding='utf-8')

old_tail = """  if (missing.length > 0) {
    sheet.getRange(1, sheet.getLastColumn() + 1, 1, missing.length).setValues([missing]);
    sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold');
  }
  sheet.setFrozenRows(1);
  return sheet;
}"""
new_tail = """  if (missing.length > 0) {
    sheet.getRange(1, sheet.getLastColumn() + 1, 1, missing.length).setValues([missing]);
    sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold');
    if (sheet.getFrozenRows() < 1) sheet.setFrozenRows(1);
  }
  return sheet;
}"""
if old_tail not in ws:
    raise SystemExit('WorkoutSessions schema tail not found')
ws = ws.replace(old_tail, new_tail, 1)

start = ws.index('function _resolveWorkoutSessionContext(userSheet, date) {')
end = ws.index('\nfunction _resolveWorkoutSessionId(userSheet, date) {', start)
new_resolve = """function _resolveWorkoutSessionContext(userSheet, date) {
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
"""
ws = ws[:start] + new_resolve + ws[end:]
ws_path.write_text(ws, encoding='utf-8')

# WorkoutLog: current-day records are also newest-first. Read only a small top
# window in the common path, while retaining the original full-scan fallback.
internal_path = Path('src/Internal.gs')
internal = internal_path.read_text(encoding='utf-8')
start = internal.index('function _clearTodaysLog(sheet, date) {')
end = internal.index('\n/**\n * (V3 foundation)', start)
new_clear = """function _clearTodaysLog(sheet, date) {
  const adminComments = new Map();
  const targetDate = new Date(date).setHours(0, 0, 0, 0);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return adminComments;

  const collectBlock = function (data, sheetStartRow) {
    let rowCount = 0;
    let foundBoundary = false;
    for (let i = 0; i < data.length; i++) {
      const rowDate = data[i][0];
      if (i > 0 && rowDate instanceof Date && new Date(rowDate).setHours(0, 0, 0, 0) !== targetDate) {
        foundBoundary = true;
        break;
      }
      const motion = data[i][1];
      const adminComment = data[i][8];
      if (motion && adminComment) adminComments.set(motion, adminComment);
      rowCount += 1;
    }
    return { startRow: sheetStartRow, rowCount: rowCount, foundBoundary: foundBoundary };
  };

  // Normal path: WorkoutLog is newest-first, so today's block starts at row 2.
  // 120 rows is intentionally far above a normal single workout; if a workout
  // ever exceeds the window, fall back to the exhaustive legacy scan below.
  const fastCount = Math.min(lastRow - 1, 120);
  const topData = sheet.getRange(2, 1, fastCount, 9).getValues();
  const firstDate = topData.length ? topData[0][0] : null;
  if (firstDate instanceof Date && new Date(firstDate).setHours(0, 0, 0, 0) === targetDate) {
    const block = collectBlock(topData, 2);
    if (block.foundBoundary || fastCount === lastRow - 1) {
      if (block.rowCount > 0) sheet.deleteRows(block.startRow, block.rowCount);
      return adminComments;
    }
    adminComments.clear();
  }

  // Historical/back-dated or unexpectedly large workouts keep the previous
  // exhaustive behavior so correctness does not depend on the fast-path layout.
  const data = sheet.getDataRange().getValues();
  let startRowIndex = -1;
  let rowCount = 0;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] instanceof Date && new Date(data[i][0]).setHours(0, 0, 0, 0) === targetDate) {
      startRowIndex = i;
      rowCount = 1;
      for (let j = i; j < data.length; j++) {
        const rowDate = data[j][0];
        if (rowDate instanceof Date && new Date(rowDate).setHours(0, 0, 0, 0) !== targetDate && rowDate !== '') break;
        const motion = data[j][1];
        const adminComment = data[j][8];
        if (motion && adminComment) adminComments.set(motion, adminComment);
        if (j + 1 >= data.length || (data[j + 1][0] instanceof Date && data[j + 1][0] !== '')) {
          rowCount = j - i + 1;
          break;
        }
      }
      break;
    }
  }

  if (startRowIndex !== -1) sheet.deleteRows(startRowIndex + 1, rowCount);
  return adminComments;
}
"""
internal = internal[:start] + new_clear + internal[end:]
internal_path.write_text(internal, encoding='utf-8')
