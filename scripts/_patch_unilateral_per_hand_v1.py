from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def replace_once(path, old, new):
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'pattern not found in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')

def write(path, content):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding='utf-8')

write('web/src/load-semantics.js', r'''export const LOAD_MODE = Object.freeze({
  TOTAL: 'total',
  PER_HAND: 'per_hand',
});

export const LATERALITY = Object.freeze({
  BILATERAL: 'bilateral',
  UNILATERAL: 'unilateral',
});

export const SIDE = Object.freeze({
  BOTH: 'both',
  LEFT: 'left',
  RIGHT: 'right',
});

export function normalizeLoadMode(value) {
  return String(value || '').trim().toLowerCase() === LOAD_MODE.PER_HAND
    ? LOAD_MODE.PER_HAND
    : LOAD_MODE.TOTAL;
}

export function normalizeLaterality(value) {
  return String(value || '').trim().toLowerCase() === LATERALITY.UNILATERAL
    ? LATERALITY.UNILATERAL
    : LATERALITY.BILATERAL;
}

export function normalizeSide(value) {
  const side = String(value || '').trim().toLowerCase();
  if (side === SIDE.LEFT || side === SIDE.RIGHT) return side;
  return SIDE.BOTH;
}

export function resolveSide(laterality, value) {
  if (normalizeLaterality(laterality) !== LATERALITY.UNILATERAL) return SIDE.BOTH;
  const side = normalizeSide(value);
  return side === SIDE.LEFT || side === SIDE.RIGHT ? side : SIDE.LEFT;
}

export function getLoadMultiplier(loadMode, side) {
  return normalizeLoadMode(loadMode) === LOAD_MODE.PER_HAND && normalizeSide(side) === SIDE.BOTH
    ? 2
    : 1;
}

export function calculateSetVolumeKg(weightKg, reps, loadMode, side) {
  const weight = Number(weightKg);
  const count = Number(reps);
  if (!Number.isFinite(weight) || !Number.isFinite(count) || weight <= 0 || count <= 0) return 0;
  return weight * count * getLoadMultiplier(loadMode, side);
}
''')

write('web/src/load-semantics.test.js', r'''import { describe, expect, it } from 'vitest';
import {
  LOAD_MODE, LATERALITY, SIDE,
  normalizeLoadMode, normalizeLaterality, resolveSide,
  getLoadMultiplier, calculateSetVolumeKg,
} from './load-semantics.js';

describe('load semantics', () => {
  it('未知 metadata 維持舊 total + bilateral 語意', () => {
    expect(normalizeLoadMode('')).toBe(LOAD_MODE.TOTAL);
    expect(normalizeLaterality('')).toBe(LATERALITY.BILATERAL);
    expect(resolveSide('', '')).toBe(SIDE.BOTH);
  });

  it('unilateral 空白 side 安全預設左側', () => {
    expect(resolveSide('unilateral', '')).toBe(SIDE.LEFT);
    expect(resolveSide('unilateral', 'right')).toBe(SIDE.RIGHT);
  });

  it('bilateral 永遠解析成 both', () => {
    expect(resolveSide('bilateral', 'left')).toBe(SIDE.BOTH);
  });

  it('per-hand bilateral 容量乘二', () => {
    expect(getLoadMultiplier('per_hand', 'both')).toBe(2);
    expect(calculateSetVolumeKg(10, 12, 'per_hand', 'both')).toBe(240);
  });

  it('per-hand unilateral 單側列不重複乘二', () => {
    expect(getLoadMultiplier('per_hand', 'left')).toBe(1);
    expect(calculateSetVolumeKg(10, 12, 'per_hand', 'left')).toBe(120);
  });

  it('total 維持舊 weight × reps', () => {
    expect(calculateSetVolumeKg(15, 10, 'total', 'both')).toBe(150);
  });
});
''')

replace_once('web/index.html',
'''                <div class="workout-number-field workout-weight-field">\n                    <input type="number" min="0" class="js-weight-input workout-set-input" aria-label="重量">''',
'''                <div class="workout-number-field workout-weight-field">\n                    <button type="button" class="js-side-toggle workout-side-toggle hidden" data-side="left" aria-label="目前為左側，點擊切換右側">\n                        <span class="js-side-label">左</span>\n                    </button>\n                    <input type="number" min="0" class="js-weight-input workout-set-input" aria-label="重量">''')

replace_once('web/src/methods.js',
"import { formatDuration, normalizeDurationSec, normalizeTrackingType, TRACKING_TYPE } from './tracking-type.js';",
"import { formatDuration, normalizeDurationSec, normalizeTrackingType, TRACKING_TYPE } from './tracking-type.js';\nimport { calculateSetVolumeKg, LATERALITY, LOAD_MODE, normalizeLaterality, normalizeLoadMode, resolveSide, SIDE } from './load-semantics.js';")

replace_once('web/src/methods.js',
'''                      const trackingType = normalizeTrackingType(card.dataset.trackingType);\n                      const note = card.querySelector('.js-exercise-note').value;''',
'''                      const trackingType = normalizeTrackingType(card.dataset.trackingType);\n                      const loadMode = normalizeLoadMode(card.dataset.loadMode);\n                      const laterality = normalizeLaterality(card.dataset.laterality);\n                      const note = card.querySelector('.js-exercise-note').value;''')

replace_once('web/src/methods.js',
'''                        const setType = normalizeSetType(set.querySelector('.js-set-type-toggle')?.dataset.setType);\n                        if (trackingType === TRACKING_TYPE.DURATION) {''',
'''                        const setType = normalizeSetType(set.querySelector('.js-set-type-toggle')?.dataset.setType);\n                        const side = resolveSide(laterality, set.querySelector('.js-side-toggle')?.dataset.side);\n                        if (trackingType === TRACKING_TYPE.DURATION) {''')

replace_once('web/src/methods.js',
'''                          workoutData.push({ date: dateToSave, motion: exerciseName, exercise_id: exerciseId, set: index + 1, weight: weight, unit: unit, reps: reps, weight_in_kg: weightInKg, set_type: setType, tracking_type: TRACKING_TYPE.WEIGHT_REPS, note: note });''',
'''                          workoutData.push({ date: dateToSave, motion: exerciseName, exercise_id: exerciseId, set: index + 1, weight: weight, unit: unit, reps: reps, weight_in_kg: weightInKg, set_type: setType, tracking_type: TRACKING_TYPE.WEIGHT_REPS, side: side, load_mode: loadMode, note: note });''')

replace_once('web/src/methods.js',
'''                        if (normalizeTrackingType(card.dataset.trackingType) !== TRACKING_TYPE.WEIGHT_REPS) return;\n                        card.querySelectorAll('.js-set-row').forEach(set => {''',
'''                        if (normalizeTrackingType(card.dataset.trackingType) !== TRACKING_TYPE.WEIGHT_REPS) return;\n                        const loadMode = normalizeLoadMode(card.dataset.loadMode);\n                        const laterality = normalizeLaterality(card.dataset.laterality);\n                        card.querySelectorAll('.js-set-row').forEach(set => {''')

replace_once('web/src/methods.js',
'''                            if (unit === '磅') weight *= LB_TO_KG;\n                            dailyTotalVolumeInKg += weight * reps;''',
'''                            if (unit === '磅') weight *= LB_TO_KG;\n                            const side = resolveSide(laterality, set.querySelector('.js-side-toggle')?.dataset.side);\n                            dailyTotalVolumeInKg += calculateSetVolumeKg(weight, reps, loadMode, side);''')

replace_once('web/src/methods.js',
'''                    const LB_TO_KG = 0.45359237;\n                    const KG_TO_LB = 2.20462262;\n                    let totalVolumeInKg = 0;''',
'''                    const LB_TO_KG = 0.45359237;\n                    const KG_TO_LB = 2.20462262;\n                    const loadMode = normalizeLoadMode(exerciseCard.dataset.loadMode);\n                    const laterality = normalizeLaterality(exerciseCard.dataset.laterality);\n                    let totalVolumeInKg = 0;''')

replace_once('web/src/methods.js',
'''                        if (unit === '磅') weight *= LB_TO_KG;\n                        totalVolumeInKg += weight * reps;''',
'''                        if (unit === '磅') weight *= LB_TO_KG;\n                        const side = resolveSide(laterality, set.querySelector('.js-side-toggle')?.dataset.side);\n                        totalVolumeInKg += calculateSetVolumeKg(weight, reps, loadMode, side);''')

replace_once('web/src/methods.js',
'''                applyTrackingTypeToSet(setRow, value) {\n                    if (!setRow) return;\n                    const trackingType = normalizeTrackingType(value);\n                    setRow.dataset.trackingType = trackingType;\n                    setRow.querySelector('.js-weight-reps-inputs')?.classList.toggle('hidden', trackingType !== TRACKING_TYPE.WEIGHT_REPS);\n                    setRow.querySelector('.js-duration-inputs')?.classList.toggle('hidden', trackingType !== TRACKING_TYPE.DURATION);\n                },''',
'''                applyTrackingTypeToSet(setRow, value) {\n                    if (!setRow) return;\n                    const trackingType = normalizeTrackingType(value);\n                    setRow.dataset.trackingType = trackingType;\n                    setRow.querySelector('.js-weight-reps-inputs')?.classList.toggle('hidden', trackingType !== TRACKING_TYPE.WEIGHT_REPS);\n                    setRow.querySelector('.js-duration-inputs')?.classList.toggle('hidden', trackingType !== TRACKING_TYPE.DURATION);\n                    const laterality = normalizeLaterality(setRow.dataset.laterality);\n                    setRow.querySelector('.js-side-toggle')?.classList.toggle('hidden', trackingType !== TRACKING_TYPE.WEIGHT_REPS || laterality !== LATERALITY.UNILATERAL);\n                },\n\n                applyLoadMetadataToSet(setRow, loadModeValue, lateralityValue, sideValue) {\n                    if (!setRow) return;\n                    const loadMode = normalizeLoadMode(loadModeValue);\n                    const laterality = normalizeLaterality(lateralityValue);\n                    const side = resolveSide(laterality, sideValue ?? setRow.dataset.side);\n                    setRow.dataset.loadMode = loadMode;\n                    setRow.dataset.laterality = laterality;\n                    setRow.dataset.side = side;\n\n                    const sideToggle = setRow.querySelector('.js-side-toggle');\n                    if (sideToggle) {\n                        sideToggle.dataset.side = side;\n                        sideToggle.querySelector('.js-side-label').textContent = side === SIDE.RIGHT ? '右' : '左';\n                        sideToggle.setAttribute('aria-label', side === SIDE.RIGHT ? '目前為右側，點擊切換左側' : '目前為左側，點擊切換右側');\n                        sideToggle.classList.toggle('hidden', normalizeTrackingType(setRow.dataset.trackingType) !== TRACKING_TYPE.WEIGHT_REPS || laterality !== LATERALITY.UNILATERAL);\n                    }\n\n                    const unitSelect = setRow.querySelector('.js-unit-select');\n                    if (unitSelect) {\n                        unitSelect.dataset.loadMode = loadMode;\n                        const kgOption = unitSelect.querySelector('option[value="公斤"]');\n                        const lbOption = unitSelect.querySelector('option[value="磅"]');\n                        if (kgOption) kgOption.textContent = loadMode === LOAD_MODE.PER_HAND ? 'kg/手' : 'kg';\n                        if (lbOption) lbOption.textContent = loadMode === LOAD_MODE.PER_HAND ? 'lb/手' : 'lb';\n                    }\n                },\n\n                toggleSide(button) {\n                    if (!button) return;\n                    const current = button.dataset.side === SIDE.RIGHT ? SIDE.RIGHT : SIDE.LEFT;\n                    const next = current === SIDE.LEFT ? SIDE.RIGHT : SIDE.LEFT;\n                    button.dataset.side = next;\n                    const setRow = button.closest('.js-set-row');\n                    if (setRow) setRow.dataset.side = next;\n                    const label = button.querySelector('.js-side-label');\n                    if (label) label.textContent = next === SIDE.RIGHT ? '右' : '左';\n                    button.setAttribute('aria-label', next === SIDE.RIGHT ? '目前為右側，點擊切換左側' : '目前為左側，點擊切換右側');\n                    button.dispatchEvent(new Event('change', { bubbles: true }));\n                },''')

replace_once('web/src/methods.js',
'''                    card.dataset.trackingType = trackingType;\n                    if (metadata?.exerciseId) card.dataset.exerciseId = metadata.exerciseId;\n                    card.querySelectorAll('.js-set-row').forEach((setRow) => this.applyTrackingTypeToSet(setRow, trackingType));\n                    this.calculateVolume(card);''',
'''                    card.dataset.trackingType = trackingType;\n                    const loadMode = normalizeLoadMode(metadata?.loadMode || card.dataset.loadMode);\n                    const laterality = normalizeLaterality(metadata?.laterality || card.dataset.laterality);\n                    card.dataset.loadMode = loadMode;\n                    card.dataset.laterality = laterality;\n                    if (metadata?.exerciseId) card.dataset.exerciseId = metadata.exerciseId;\n                    card.querySelectorAll('.js-set-row').forEach((setRow) => {\n                        this.applyTrackingTypeToSet(setRow, trackingType);\n                        this.applyLoadMetadataToSet(setRow, loadMode, laterality, setRow.dataset.side);\n                    });\n                    this.calculateVolume(card);''')

replace_once('web/src/methods.js',
'''                createSetElement(setNumber, trackingType = TRACKING_TYPE.WEIGHT_REPS) {''',
'''                createSetElement(setNumber, trackingType = TRACKING_TYPE.WEIGHT_REPS, loadMode = LOAD_MODE.TOTAL, laterality = LATERALITY.BILATERAL, side = SIDE.BOTH) {''')

replace_once('web/src/methods.js',
'''                    this.applySetTypeToToggle(newSet.querySelector('.js-set-type-toggle'), SET_TYPE.WORKING);\n                    this.applyTrackingTypeToSet(newSet.querySelector('.js-set-row'), trackingType);\n                    return newSet;''',
'''                    this.applySetTypeToToggle(newSet.querySelector('.js-set-type-toggle'), SET_TYPE.WORKING);\n                    this.applyTrackingTypeToSet(newSet.querySelector('.js-set-row'), trackingType);\n                    this.applyLoadMetadataToSet(newSet.querySelector('.js-set-row'), loadMode, laterality, side);\n                    return newSet;''')

replace_once('web/src/methods.js',
'''                    const trackingType = normalizeTrackingType(exerciseCard.dataset.trackingType);\n                    let lastWeight = '';''',
'''                    const trackingType = normalizeTrackingType(exerciseCard.dataset.trackingType);\n                    const loadMode = normalizeLoadMode(exerciseCard.dataset.loadMode);\n                    const laterality = normalizeLaterality(exerciseCard.dataset.laterality);\n                    let lastWeight = '';''')

replace_once('web/src/methods.js',
'''                    let lastDuration = '';\n                    let lastSetType = 'working';''',
'''                    let lastDuration = '';\n                    let lastSide = resolveSide(laterality, null);\n                    let lastSetType = 'working';''')

replace_once('web/src/methods.js',
'''                        lastDuration = lastSet.querySelector('.js-duration-input')?.value || '';\n                        lastSetType = normalizeSetType(lastSet.querySelector('.js-set-type-toggle')?.dataset.setType);\n                    }\n                    const newSetElement = this.createSetElement(setNumber, trackingType);''',
'''                        lastDuration = lastSet.querySelector('.js-duration-input')?.value || '';\n                        lastSide = resolveSide(laterality, lastSet.querySelector('.js-side-toggle')?.dataset.side);\n                        lastSetType = normalizeSetType(lastSet.querySelector('.js-set-type-toggle')?.dataset.setType);\n                    }\n                    const newSetElement = this.createSetElement(setNumber, trackingType, loadMode, laterality, lastSide);''')

replace_once('web/src/methods.js',
'''                    const metadata = this.getExerciseMetadata(name);\n                    const trackingType = normalizeTrackingType(metadata?.trackingType);''',
'''                    const metadata = this.getExerciseMetadata(name);\n                    const trackingType = normalizeTrackingType(metadata?.trackingType);\n                    const loadMode = normalizeLoadMode(metadata?.loadMode);\n                    const laterality = normalizeLaterality(metadata?.laterality);''')

replace_once('web/src/methods.js',
'''                    cardElement.dataset.trackingType = trackingType;\n                    if (metadata?.exerciseId) cardElement.dataset.exerciseId = metadata.exerciseId;\n                    cardElement.querySelector('.js-sets-container').appendChild(this.createSetElement(1, trackingType));''',
'''                    cardElement.dataset.trackingType = trackingType;\n                    cardElement.dataset.loadMode = loadMode;\n                    cardElement.dataset.laterality = laterality;\n                    if (metadata?.exerciseId) cardElement.dataset.exerciseId = metadata.exerciseId;\n                    cardElement.querySelector('.js-sets-container').appendChild(this.createSetElement(1, trackingType, loadMode, laterality, resolveSide(laterality, null)));''')

# copyLastSet: preserve side on the copied row.
replace_once('web/src/methods.js',
'''                    const lastDuration = lastSet.querySelector('.js-duration-input')?.value || '';\n                    const lastSetType = normalizeSetType(lastSet.querySelector('.js-set-type-toggle')?.dataset.setType);''',
'''                    const lastDuration = lastSet.querySelector('.js-duration-input')?.value || '';\n                    const lastSide = lastSet.querySelector('.js-side-toggle')?.dataset.side || '';\n                    const lastSetType = normalizeSetType(lastSet.querySelector('.js-set-type-toggle')?.dataset.setType);''')

replace_once('web/src/methods.js',
'''                        if (durationInput) durationInput.value = lastDuration;\n                        const newSetTypeToggle = newSet.querySelector('.js-set-type-toggle');''',
'''                        if (durationInput) durationInput.value = lastDuration;\n                        const sideToggle = newSet.querySelector('.js-side-toggle');\n                        if (sideToggle && lastSide) this.applyLoadMetadataToSet(newSet, exerciseCard.dataset.loadMode, exerciseCard.dataset.laterality, lastSide);\n                        const newSetTypeToggle = newSet.querySelector('.js-set-type-toggle');''')

replace_once('web/src/events.js',
'''                    const setTypeToggleButton = target.closest('.js-set-type-toggle');\n\n                    if (setTypeToggleButton) app.methods.toggleSetType(setTypeToggleButton);''',
'''                    const setTypeToggleButton = target.closest('.js-set-type-toggle');\n                    const sideToggleButton = target.closest('.js-side-toggle');\n\n                    if (setTypeToggleButton) app.methods.toggleSetType(setTypeToggleButton);\n                    if (sideToggleButton) app.methods.toggleSide(sideToggleButton);''')

replace_once('web/src/workout-draft.js',
"import { normalizeTrackingType, TRACKING_TYPE } from './tracking-type.js';",
"import { normalizeTrackingType, TRACKING_TYPE } from './tracking-type.js';\nimport { LATERALITY, LOAD_MODE, normalizeLaterality, normalizeLoadMode, resolveSide, SIDE } from './load-semantics.js';")

replace_once('web/src/workout-draft.js',
'''      const trackingType = normalizeTrackingType(card.dataset.trackingType);\n      const sets = [...card.querySelectorAll('.js-set-row')].map((set) => ({''',
'''      const trackingType = normalizeTrackingType(card.dataset.trackingType);\n      const loadMode = normalizeLoadMode(card.dataset.loadMode);\n      const laterality = normalizeLaterality(card.dataset.laterality);\n      const sets = [...card.querySelectorAll('.js-set-row')].map((set) => ({''')

replace_once('web/src/workout-draft.js',
'''        durationSec: set.querySelector('.js-duration-input')?.value || '',\n        setType: normalizeSetType(set.querySelector('.js-set-type-toggle')?.dataset.setType),''',
'''        durationSec: set.querySelector('.js-duration-input')?.value || '',\n        side: resolveSide(laterality, set.querySelector('.js-side-toggle')?.dataset.side),\n        setType: normalizeSetType(set.querySelector('.js-set-type-toggle')?.dataset.setType),''')

replace_once('web/src/workout-draft.js',
'''      return { name, note, trackingType, exerciseId: card.dataset.exerciseId || '', sets };''',
'''      return { name, note, trackingType, loadMode, laterality, exerciseId: card.dataset.exerciseId || '', sets };''')

replace_once('web/src/workout-draft.js',
'''function createSetFragment(setData, setNumber, trackingType = TRACKING_TYPE.WEIGHT_REPS) {''',
'''function createSetFragment(setData, setNumber, trackingType = TRACKING_TYPE.WEIGHT_REPS, loadMode = LOAD_MODE.TOTAL, laterality = LATERALITY.BILATERAL) {''')

replace_once('web/src/workout-draft.js',
'''  const setTypeToggle = fragment.querySelector('.js-set-type-toggle');\n  const setRow = fragment.querySelector('.js-set-row');''',
'''  const setTypeToggle = fragment.querySelector('.js-set-type-toggle');\n  const sideToggle = fragment.querySelector('.js-side-toggle');\n  const setRow = fragment.querySelector('.js-set-row');''')

replace_once('web/src/workout-draft.js',
'''  if (setRow) setRow.dataset.trackingType = normalizedTrackingType;\n  fragment.querySelector('.js-weight-reps-inputs')?.classList.toggle('hidden', normalizedTrackingType !== TRACKING_TYPE.WEIGHT_REPS);''',
'''  const normalizedLoadMode = normalizeLoadMode(loadMode);\n  const normalizedLaterality = normalizeLaterality(laterality);\n  const side = resolveSide(normalizedLaterality, setData?.side);\n  if (setRow) {\n    setRow.dataset.trackingType = normalizedTrackingType;\n    setRow.dataset.loadMode = normalizedLoadMode;\n    setRow.dataset.laterality = normalizedLaterality;\n    setRow.dataset.side = side;\n  }\n  if (sideToggle) {\n    sideToggle.dataset.side = side;\n    sideToggle.querySelector('.js-side-label').textContent = side === SIDE.RIGHT ? '右' : '左';\n    sideToggle.classList.toggle('hidden', normalizedTrackingType !== TRACKING_TYPE.WEIGHT_REPS || normalizedLaterality !== LATERALITY.UNILATERAL);\n  }\n  if (unitSelect) {\n    unitSelect.dataset.loadMode = normalizedLoadMode;\n    const kgOption = unitSelect.querySelector('option[value="公斤"]');\n    const lbOption = unitSelect.querySelector('option[value="磅"]');\n    if (kgOption) kgOption.textContent = normalizedLoadMode === LOAD_MODE.PER_HAND ? 'kg/手' : 'kg';\n    if (lbOption) lbOption.textContent = normalizedLoadMode === LOAD_MODE.PER_HAND ? 'lb/手' : 'lb';\n  }\n  fragment.querySelector('.js-weight-reps-inputs')?.classList.toggle('hidden', normalizedTrackingType !== TRACKING_TYPE.WEIGHT_REPS);''')

replace_once('web/src/workout-draft.js',
'''  const trackingType = normalizeTrackingType(exercise.trackingType);\n  card.dataset.trackingType = trackingType;''',
'''  const trackingType = normalizeTrackingType(exercise.trackingType);\n  const loadMode = normalizeLoadMode(exercise.loadMode);\n  const laterality = normalizeLaterality(exercise.laterality);\n  card.dataset.trackingType = trackingType;\n  card.dataset.loadMode = loadMode;\n  card.dataset.laterality = laterality;''')

replace_once('web/src/workout-draft.js',
'''      const setFragment = createSetFragment(setData, index + 1, trackingType);''',
'''      const setFragment = createSetFragment(setData, index + 1, trackingType, loadMode, laterality);''')

# Backend volume semantics: per_hand + both means two implements/hands; unilateral rows are left/right and stay x1.
replace_once('src/Internal.gs',
'''        volume = weight_kg * set.reps;''',
'''        const loadMultiplier = (setFields.loadMode === 'per_hand' && setFields.side === 'both') ? 2 : 1;\n        volume = weight_kg * set.reps * loadMultiplier;''')

# Analysis should trust persisted WorkoutLog Volume when available, so per-hand semantics survive derived analytics.
replace_once('src/API.gs',
'''        const weightKg = row[indices[CONSTANTS.HEADERS.WEIGHT_KG]];\n        const note = row[indices[CONSTANTS.HEADERS.NOTES]];''',
'''        const weightKg = row[indices[CONSTANTS.HEADERS.WEIGHT_KG]];\n        const persistedVolume = row[indices[CONSTANTS.HEADERS.VOLUME]];\n        const note = row[indices[CONSTANTS.HEADERS.NOTES]];''')

replace_once('src/API.gs',
'''              volume: (parseFloat(reps) * parseFloat(weightKg)),''',
'''              volume: Number.isFinite(parseFloat(persistedVolume)) ? parseFloat(persistedVolume) : (parseFloat(reps) * parseFloat(weightKg)),''')

# Compact side control and per-hand unit width live inside the existing compound field.
with open(ROOT / 'web/src/style.css', 'a', encoding='utf-8') as f:
    f.write(r'''

/* --- Unilateral / per-hand v1 --- */
.workout-side-toggle {
    flex: 0 0 auto;
    min-width: 2.2rem;
    align-self: stretch;
    border: 0;
    border-right: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 195, 0, 0.055);
    color: #d9c16e;
    font-size: 0.7rem;
    font-weight: 800;
    transition: background-color 150ms ease, color 150ms ease;
}

.workout-side-toggle:active {
    background: rgba(255, 195, 0, 0.13);
    color: #ffd55f;
}

.workout-side-toggle.hidden {
    display: none;
}

.workout-exercise-card .workout-unit-select[data-load-mode="per_hand"] {
    width: 3.8rem;
    font-size: 0.67rem;
}
''')

print('unilateral/per-hand v1 patch applied')
