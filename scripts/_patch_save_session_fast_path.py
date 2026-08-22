from pathlib import Path
import re

# Optimize WorkoutSessions without changing the public data model.
path = Path('src/WorkoutSessions.gs')
text = path.read_text(encoding='utf-8')

resolve_pattern = re.compile(
    r"function _resolveWorkoutSessionId\(userSheet, date\) \{.*?\n\}\n\n/\*\*\n \* Upsert only fields owned by the current logger\.",
    re.S,
)
resolve_replacement = r'''function _resolveWorkoutSessionContext(userSheet, date) {
  const sessionSheet = _getOrCreateWorkoutSessionsSheet(userSheet);
  const headers = sessionSheet.getRange(1, 1, 1, sessionSheet.getLastColumn()).getValues()[0];
  const dateIndex = headers.indexOf('Date');
  const idIndex = headers.indexOf('SessionId');
  const targetKey = _dateKey(date);

  let rowNumber = -1;
  let sessionId = '';

  if (targetKey && sessionSheet.getLastRow() >= 2 && dateIndex !== -1) {
    const firstIndex = Math.min(dateIndex, idIndex === -1 ? dateIndex : idIndex);
    const lastIndex = Math.max(dateIndex, idIndex === -1 ? dateIndex : idIndex);
    const rowCount = sessionSheet.getLastRow() - 1;
    const values = sessionSheet
      .getRange(2, firstIndex + 1, rowCount, lastIndex - firstIndex + 1)
      .getValues();

    for (let i = 0; i < values.length; i++) {
      const rowDate = values[i][dateIndex - firstIndex];
      if (!(rowDate instanceof Date) || _dateKey(rowDate) !== targetKey) continue;

      rowNumber = i + 2;
      if (idIndex !== -1) {
        sessionId = String(values[i][idIndex - firstIndex] || '');
      }
      break;
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
 * Upsert only fields owned by the current logger.'''
text, count = resolve_pattern.subn(resolve_replacement, text, count=1)
if count != 1:
    raise SystemExit(f'expected one session resolver replacement, got {count}')

upsert_pattern = re.compile(
    r"function _upsertWorkoutSession\(userSheet, sessionData\) \{.*?\n  return sessionData\.sessionId;\n\}",
    re.S,
)
upsert_replacement = r'''function _upsertWorkoutSession(userSheet, sessionData, sessionContext) {
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
}'''
text, count = upsert_pattern.subn(upsert_replacement, text, count=1)
if count != 1:
    raise SystemExit(f'expected one session upsert replacement, got {count}')

path.write_text(text, encoding='utf-8')

# Reuse the resolved session row/context through the write path.
path = Path('src/Internal.gs')
text = path.read_text(encoding='utf-8')
old = """  const sessionId = _traceWorkoutSaveStep('session.resolve', function () {\n    return _resolveWorkoutSessionId(userSheet, date);\n  });"""
new = """  const sessionContext = _traceWorkoutSaveStep('session.resolve', function () {\n    return _resolveWorkoutSessionContext(userSheet, date);\n  });\n  const sessionId = sessionContext.sessionId;"""
if old not in text:
    raise SystemExit('session resolve block not found in Internal.gs')
text = text.replace(old, new, 1)

old = """      _upsertWorkoutSession(userSheet, {\n      sessionId: sessionId,\n      date: date,\n      sessionNote: sessionNote,\n      totalVolume: dailyTotalVolume,\n        workingSets: workingSetCount\n      });"""
new = """      _upsertWorkoutSession(userSheet, {\n        sessionId: sessionId,\n        date: date,\n        sessionNote: sessionNote,\n        totalVolume: dailyTotalVolume,\n        workingSets: workingSetCount\n      }, sessionContext);"""
if old not in text:
    raise SystemExit('session upsert block not found in Internal.gs')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')

print('save session fast path patch applied')
