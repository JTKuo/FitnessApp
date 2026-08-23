from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'anchor not found in {path}: {old[:100]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


# Keep the new-exercise default aligned with the existing app-wide default.
replace_once('web/src/new-exercise-setup.js', 'const DEFAULT_REST_SEC = 60;', 'const DEFAULT_REST_SEC = 30;')
replace_once(
    'web/src/new-exercise-setup.js',
    '? Math.max(0, Math.min(MAX_REST_SEC, Math.round(rawRest)))',
    '? Math.max(1, Math.min(MAX_REST_SEC, Math.round(rawRest)))',
)
replace_once(
    'web/src/new-exercise-setup.js',
    'min="0" max="600" step="5"',
    'min="1" max="600" step="5"',
)
replace_once('src/ExerciseMetadataSetup.gs', 'if (!isFinite(defaultRestSec)) defaultRestSec = 60;', 'if (!isFinite(defaultRestSec)) defaultRestSec = 30;')
replace_once(
    'src/ExerciseMetadataSetup.gs',
    'defaultRestSec = Math.max(0, Math.min(600, Math.round(defaultRestSec)));',
    'defaultRestSec = Math.max(1, Math.min(600, Math.round(defaultRestSec)));',
)

# Rest timer resolves the current exercise metadata at completion time. This keeps
# one source of truth and automatically covers draft restore / existing exercises.
replace_once(
    'web/src/rest-timer.js',
    'let defaultRestSeconds = 30;\n',
    'let defaultRestSeconds = 30;\nlet getRestSecondsForSet = () => null;\n',
)
replace_once(
    'web/src/rest-timer.js',
    """function adjustedEndsAt(targetEndsAt, deltaSeconds, now = Date.now()) {\n  const base = Number(targetEndsAt);\n  if (!Number.isFinite(base)) return null;\n  return Math.max(now, base + Number(deltaSeconds || 0) * 1000);\n}\n""",
    """function adjustedEndsAt(targetEndsAt, deltaSeconds, now = Date.now()) {\n  const base = Number(targetEndsAt);\n  if (!Number.isFinite(base)) return null;\n  return Math.max(now, base + Number(deltaSeconds || 0) * 1000);\n}\n\nfunction resolveRestSeconds(configuredSeconds, fallbackSeconds = defaultRestSeconds) {\n  const configured = Number(configuredSeconds);\n  if (Number.isFinite(configured) && configured > 0) return configured;\n  return Math.max(1, Number(fallbackSeconds) || 30);\n}\n""",
)
replace_once(
    'web/src/rest-timer.js',
    """    if (typeof options.onInvalidComplete === 'function') onInvalidComplete = options.onInvalidComplete;\n""",
    """    if (typeof options.onInvalidComplete === 'function') onInvalidComplete = options.onInvalidComplete;\n    if (typeof options.getRestSecondsForSet === 'function') getRestSecondsForSet = options.getRestSecondsForSet;\n""",
)
replace_once(
    'web/src/rest-timer.js',
    """        setCompleteButtonState(button, true);\n        this.start(defaultRestSeconds);\n""",
    """        setCompleteButtonState(button, true);\n        this.start(resolveRestSeconds(getRestSecondsForSet(setRow), defaultRestSeconds));\n""",
)
replace_once(
    'web/src/rest-timer.js',
    """  isUserSwitchSettled,\n};\n""",
    """  isUserSwitchSettled,\n  resolveRestSeconds,\n};\n""",
)

replace_once(
    'web/src/app.js',
    """                    defaultRestSeconds: APP_CONSTANTS.WORKOUT.DEFAULT_REST_TIME,\n                    onFinished: () => this.ui.showToast('休息結束！'),\n""",
    """                    defaultRestSeconds: APP_CONSTANTS.WORKOUT.DEFAULT_REST_TIME,\n                    getRestSecondsForSet: (setRow) => {\n                        const motion = setRow?.closest('.card')?.querySelector('h3')?.textContent?.trim() || '';\n                        return this.methods.getExerciseMetadata(motion)?.defaultRestSec ?? null;\n                    },\n                    onFinished: () => this.ui.showToast('休息結束！'),\n""",
)

replace_once(
    'web/src/rest-timer.test.js',
    """  isUserSwitchSettled,\n} = restTimerInternals;\n""",
    """  isUserSwitchSettled,\n  resolveRestSeconds,\n} = restTimerInternals;\n""",
)
replace_once(
    'web/src/rest-timer.test.js',
    """  it('倒數格式維持 mm:ss', () => {\n    expect(formatTime(0)).toBe('00:00');\n    expect(formatTime(30)).toBe('00:30');\n    expect(formatTime(90)).toBe('01:30');\n  });\n""",
    """  it('倒數格式維持 mm:ss', () => {\n    expect(formatTime(0)).toBe('00:00');\n    expect(formatTime(30)).toBe('00:30');\n    expect(formatTime(90)).toBe('01:30');\n  });\n\n  it('每動作 DefaultRestSec 優先於全域 fallback', () => {\n    expect(resolveRestSeconds(90, 30)).toBe(90);\n    expect(resolveRestSeconds('60', 30)).toBe(60);\n    expect(resolveRestSeconds(null, 30)).toBe(30);\n    expect(resolveRestSeconds(0, 30)).toBe(30);\n  });\n""",
)
