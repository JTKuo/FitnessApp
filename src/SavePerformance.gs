// =======================================================
// Workout save performance tracing
// =======================================================
// Diagnostic-only timing data. No user content is recorded here.

var _WORKOUT_SAVE_TRACE = null;

function _startWorkoutSaveTrace() {
  _WORKOUT_SAVE_TRACE = {
    startedAt: Date.now(),
    steps: {}
  };
}

function _traceWorkoutSaveStep(name, fn) {
  const startedAt = Date.now();
  try {
    return fn();
  } finally {
    if (_WORKOUT_SAVE_TRACE) {
      const elapsed = Date.now() - startedAt;
      _WORKOUT_SAVE_TRACE.steps[name] = (_WORKOUT_SAVE_TRACE.steps[name] || 0) + elapsed;
    }
  }
}

function _finishWorkoutSaveTrace() {
  if (!_WORKOUT_SAVE_TRACE) return null;

  const trace = {
    totalMs: Date.now() - _WORKOUT_SAVE_TRACE.startedAt,
    steps: Object.assign({}, _WORKOUT_SAVE_TRACE.steps)
  };
  _WORKOUT_SAVE_TRACE = null;
  return trace;
}

function _discardWorkoutSaveTrace() {
  _WORKOUT_SAVE_TRACE = null;
}
