from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]

def replace_once(path, old, new):
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'pattern not found in {path}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')

replace_once('web/src/methods.js',
"""                        performanceEl.innerHTML = `上次: <span class=\"font-bold\">${data.weight_kg} kg x ${data.reps} 次</span>`;""",
"""                        const performanceUnit = loadMode === LOAD_MODE.PER_HAND ? 'kg/手' : 'kg';\n                        performanceEl.innerHTML = `上次: <span class=\"font-bold\">${data.weight_kg} ${performanceUnit} x ${data.reps} 次</span>`;""")

replace_once('web/src/workout-draft.js',
"""    sideToggle.querySelector('.js-side-label').textContent = side === SIDE.RIGHT ? '右' : '左';\n    sideToggle.classList.toggle('hidden', normalizedTrackingType !== TRACKING_TYPE.WEIGHT_REPS || normalizedLaterality !== LATERALITY.UNILATERAL);""",
"""    sideToggle.querySelector('.js-side-label').textContent = side === SIDE.RIGHT ? '右' : '左';\n    sideToggle.setAttribute('aria-label', side === SIDE.RIGHT ? '目前為右側，點擊切換左側' : '目前為左側，點擊切換右側');\n    sideToggle.classList.toggle('hidden', normalizedTrackingType !== TRACKING_TYPE.WEIGHT_REPS || normalizedLaterality !== LATERALITY.UNILATERAL);""")

print('semantic labels fixed')
