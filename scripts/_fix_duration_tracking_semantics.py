from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def replace_once(path, old, new):
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'expected block not found: {path}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')

replace_once(
    'web/src/rest-timer.js',
    """function setHasWorkoutData(setRow) {\n  const weight = parseFloat(setRow.querySelector('.js-weight-input')?.value || '0') || 0;\n  const reps = parseInt(setRow.querySelector('.js-reps-input')?.value || '0', 10) || 0;\n  const duration = parseInt(setRow.querySelector('.js-duration-input')?.value || '0', 10) || 0;\n  return weight > 0 || reps > 0 || duration > 0;\n}\n""",
    """function setHasWorkoutData(setRow) {\n  const trackingType = String(setRow?.dataset?.trackingType || 'weight_reps').trim().toLowerCase();\n  if (trackingType === 'duration') {\n    const duration = parseInt(setRow.querySelector('.js-duration-input')?.value || '0', 10) || 0;\n    return duration > 0;\n  }\n\n  const weight = parseFloat(setRow.querySelector('.js-weight-input')?.value || '0') || 0;\n  const reps = parseInt(setRow.querySelector('.js-reps-input')?.value || '0', 10) || 0;\n  return weight > 0 || reps > 0;\n}\n""",
)

replace_once(
    'web/src/methods.js',
    """                    const catalog = app.state.cache.exerciseCatalog || app.state.classify.catalog || [];\n                    return catalog.find((item) => item.motion === motion) || null;\n""",
    """                    const cachedCatalog = app.state.cache.exerciseCatalog;\n                    const catalog = Array.isArray(cachedCatalog) && cachedCatalog.length > 0\n                        ? cachedCatalog\n                        : (app.state.classify.catalog || []);\n                    return catalog.find((item) => item.motion === motion) || null;\n""",
)

replace_once(
    'web/src/methods.js',
    """                    app.api.getLatestPerformance(name, app.state.user.currentUser).then(data => {\n                      if (data?.tracking_type === TRACKING_TYPE.DURATION && data.duration_sec > 0) {\n                        performanceEl.innerHTML = `上次: <span class=\"font-bold\">${formatDuration(data.duration_sec)}</span>`;\n                      } else if (data && data.weight_kg != null && data.reps != null) {\n                        performanceEl.innerHTML = `上次: <span class=\"font-bold\">${data.weight_kg} kg x ${data.reps} 次</span>`;\n                      } else {\n                        performanceEl.textContent = trackingType === TRACKING_TYPE.DURATION ? '無時間紀錄' : '無歷史紀錄';\n                      }\n""",
    """                    app.api.getLatestPerformance(name, app.state.user.currentUser).then(data => {\n                      if (trackingType === TRACKING_TYPE.DURATION) {\n                        if (data?.tracking_type === TRACKING_TYPE.DURATION && data.duration_sec > 0) {\n                          performanceEl.innerHTML = `上次: <span class=\"font-bold\">${formatDuration(data.duration_sec)}</span>`;\n                        } else {\n                          performanceEl.textContent = '無時間紀錄';\n                        }\n                      } else if (data && data.weight_kg != null && data.reps != null) {\n                        performanceEl.innerHTML = `上次: <span class=\"font-bold\">${data.weight_kg} kg x ${data.reps} 次</span>`;\n                      } else {\n                        performanceEl.textContent = '無歷史紀錄';\n                      }\n""",
)

print('duration tracking semantic guards applied')
