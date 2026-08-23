from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'anchor not found in {path}: {old[:100]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
    'web/src/new-exercise-setup.js',
    "? Math.max(0, Math.min(MAX_REST_SEC, Math.round(rawRest)))",
    "? Math.max(1, Math.min(MAX_REST_SEC, Math.round(rawRest)))",
)
replace_once(
    'web/src/new-exercise-setup.js',
    'min="0" max="600" step="5"',
    'min="1" max="600" step="5"',
)
replace_once(
    'src/ExerciseMetadataSetup.gs',
    'defaultRestSec = Math.max(0, Math.min(600, Math.round(defaultRestSec)));',
    'defaultRestSec = Math.max(1, Math.min(600, Math.round(defaultRestSec)));',
)

replace_once(
    'web/src/methods.js',
    """                    if (metadata?.exerciseId) card.dataset.exerciseId = metadata.exerciseId;\n""",
    """                    if (metadata?.exerciseId) card.dataset.exerciseId = metadata.exerciseId;\n                    const metadataRestSec = Number(metadata?.defaultRestSec);\n                    if (Number.isFinite(metadataRestSec) && metadataRestSec > 0) {\n                        card.dataset.defaultRestSec = String(Math.round(metadataRestSec));\n                    }\n""",
)
replace_once(
    'web/src/methods.js',
    """                    if (metadata?.exerciseId) cardElement.dataset.exerciseId = metadata.exerciseId;\n""",
    """                    if (metadata?.exerciseId) cardElement.dataset.exerciseId = metadata.exerciseId;\n                    const defaultRestSec = Number(metadata?.defaultRestSec);\n                    if (Number.isFinite(defaultRestSec) && defaultRestSec > 0) {\n                        cardElement.dataset.defaultRestSec = String(Math.round(defaultRestSec));\n                    }\n""",
)

replace_once(
    'web/src/rest-timer.js',
    """function setHasWorkoutData(setRow) {\n  const trackingType = String(setRow?.dataset?.trackingType || 'weight_reps').trim().toLowerCase();\n  if (trackingType === 'duration') {\n    const duration = parseInt(setRow.querySelector('.js-duration-input')?.value || '0', 10) || 0;\n    return duration > 0;\n  }\n\n  const weight = parseFloat(setRow.querySelector('.js-weight-input')?.value || '0') || 0;\n  const reps = parseInt(setRow.querySelector('.js-reps-input')?.value || '0', 10) || 0;\n  return weight > 0 || reps > 0;\n}\n""",
    """function setHasWorkoutData(setRow) {\n  const trackingType = String(setRow?.dataset?.trackingType || 'weight_reps').trim().toLowerCase();\n  if (trackingType === 'duration') {\n    const duration = parseInt(setRow.querySelector('.js-duration-input')?.value || '0', 10) || 0;\n    return duration > 0;\n  }\n\n  const weight = parseFloat(setRow.querySelector('.js-weight-input')?.value || '0') || 0;\n  const reps = parseInt(setRow.querySelector('.js-reps-input')?.value || '0', 10) || 0;\n  return weight > 0 || reps > 0;\n}\n\nfunction resolveSetRestSeconds(setRow, fallbackSeconds = defaultRestSeconds) {\n  const card = setRow?.closest?.('.card');\n  const configured = Number(card?.dataset?.defaultRestSec);\n  if (Number.isFinite(configured) && configured > 0) return configured;\n  return Math.max(1, Number(fallbackSeconds) || 30);\n}\n""",
)
replace_once(
    'web/src/rest-timer.js',
    """        setCompleteButtonState(button, true);\n        this.start(defaultRestSeconds);\n""",
    """        setCompleteButtonState(button, true);\n        this.start(resolveSetRestSeconds(setRow, defaultRestSeconds));\n""",
)
replace_once(
    'web/src/rest-timer.js',
    """  isUserSwitchSettled,\n};\n""",
    """  isUserSwitchSettled,\n  resolveSetRestSeconds,\n};\n""",
)

replace_once(
    'web/src/rest-timer.test.js',
    """  isUserSwitchSettled,\n} = restTimerInternals;\n""",
    """  isUserSwitchSettled,\n  resolveSetRestSeconds,\n} = restTimerInternals;\n""",
)
replace_once(
    'web/src/rest-timer.test.js',
    """  it('倒數格式維持 mm:ss', () => {\n    expect(formatTime(0)).toBe('00:00');\n    expect(formatTime(30)).toBe('00:30');\n    expect(formatTime(90)).toBe('01:30');\n  });\n""",
    """  it('倒數格式維持 mm:ss', () => {\n    expect(formatTime(0)).toBe('00:00');\n    expect(formatTime(30)).toBe('00:30');\n    expect(formatTime(90)).toBe('01:30');\n  });\n\n  it('完成 set 時優先使用該動作的 DefaultRestSec', () => {\n    const configuredSet = {\n      closest: () => ({ dataset: { defaultRestSec: '90' } }),\n    };\n    const plainSet = { closest: () => ({ dataset: {} }) };\n    expect(resolveSetRestSeconds(configuredSet, 30)).toBe(90);\n    expect(resolveSetRestSeconds(plainSet, 30)).toBe(30);\n  });\n""",
)
