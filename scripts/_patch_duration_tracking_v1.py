from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8')


def replace_once(path, old, new):
    text = read(path)
    if old not in text:
        raise SystemExit(f'expected block not found in {path}: {old[:100]!r}')
    write(path, text.replace(old, new, 1))


# Backend: expose ExerciseMaster runtime metadata in catalog/initial data.
api = read('src/API.gs')
api, count = re.subn(
    r"\n\s*// --- 任務 4: 獲取目標使用者的不重複動作名稱 \(使用 WorkoutLog\) ---.*?\n\s*// --- 將所有結果打包回傳 ---",
    "\n\n    // --- 任務 4: 取得動作目錄與 runtime metadata（ExerciseMaster + WorkoutLog 聯集） ---\n"
    "    const exerciseCatalog = _buildExerciseCatalogForUserSheet(userSheet);\n"
    "    const exerciseNames = exerciseCatalog.map(function (item) { return item.motion; });\n\n"
    "    // --- 將所有結果打包回傳 ---",
    api,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit('failed to replace getInitialData exercise-name block')
api = api.replace(
    "      exerciseNames: Array.from(exerciseNames) // 目標使用者的動作名稱列表\n",
    "      exerciseNames: exerciseNames, // 目標使用者的動作名稱列表\n"
    "      exerciseCatalog: exerciseCatalog // ExerciseMaster V2 runtime metadata\n",
    1,
)

catalog_pattern = r"/\*\*\n \* \(API\) 動作目錄：聯集 WorkoutLog 出現過的動作與 ExerciseMaster 既有列。.*?\nfunction getExerciseCatalog\(authedEmail, requestedEmail\) \{.*?\n\}\n\n/\*\*\n \* \(API\) 批次寫入分類與 tag。"
catalog_replacement = r'''/**
 * Build the exercise catalog from an already-open user spreadsheet.
 * Runtime fields are additive: existing classification callers can keep using
 * motion/category/tags while Workout UI can opt into TrackingType metadata.
 */
function _buildExerciseCatalogForUserSheet(userSheet) {
  if (!userSheet) return [];

  const metadataMap = _getExerciseMetadataMap(userSheet);
  const motions = new Set();
  metadataMap.forEach(function (_info, motion) { motions.add(motion); });

  // Include motions that exist only in WorkoutLog. Read only the Motion column.
  const logSheet = userSheet.getSheetByName(CONSTANTS.SHEETS.WORKOUT_LOG);
  if (logSheet && logSheet.getLastRow() > 1) {
    const indices = _getHeaderIndices(logSheet);
    const motionIdx = indices[CONSTANTS.HEADERS.MOTION];
    if (motionIdx !== undefined && motionIdx !== null) {
      const motionRows = logSheet.getRange(2, motionIdx + 1, logSheet.getLastRow() - 1, 1).getValues();
      motionRows.forEach(function (row) {
        const motion = String(row[0] || '').trim();
        if (motion && motion !== '本日總結' && motion !== '動作總結') motions.add(motion);
      });
    }
  }

  const catalog = [];
  motions.forEach(function (motion) {
    const info = metadataMap.get(motion) || null;
    catalog.push({
      motion: motion,
      category: info ? info.category : '',
      tags: info ? info.tags : [],
      exerciseId: info ? info.exerciseId : '',
      trackingType: info ? _normalizeWorkoutTrackingType(info.trackingType) : 'weight_reps',
      loadMode: info ? info.loadMode : 'total',
      laterality: info ? info.laterality : 'bilateral',
      defaultRestSec: info ? info.defaultRestSec : 30,
      demoMedia: info ? info.demoMedia : '',
      active: info ? info.active : true
    });
  });

  catalog.sort(function (a, b) { return a.motion.localeCompare(b.motion, 'zh-Hant'); });
  return catalog;
}

/**
 * (API) 動作目錄：ExerciseMaster metadata + WorkoutLog motion union.
 */
function getExerciseCatalog(authedEmail, requestedEmail) {
  const target = _resolveTarget(authedEmail, requestedEmail);
  const userSheet = _getUserSheet(target.targetEmail, false);
  return _buildExerciseCatalogForUserSheet(userSheet);
}

/**
 * (API) 批次寫入分類與 tag。'''
api, count = re.subn(catalog_pattern, catalog_replacement, api, count=1, flags=re.S)
if count != 1:
    raise SystemExit('failed to replace getExerciseCatalog')

old = """    const indices = _getHeaderIndices(logSheet);\n    const data = logSheet.getDataRange().getValues();\n    \n    // 從資料的最後一筆開始往回找，效率較高\n    for (let i = 1; i < data.length; i++) { // <-- i = 1, 往上加\n      const row = data[i];\n      const motion = row[indices[CONSTANTS.HEADERS.MOTION]];\n      const reps = row[indices[CONSTANTS.HEADERS.REPS]];\n      const weight_kg = row[indices[CONSTANTS.HEADERS.WEIGHT_KG]];\n      \n      if (motion === exerciseName && reps && weight_kg) {\n        // 【修改】 計算磅值並回傳物件\n        const weight_lbs = parseFloat((weight_kg * KG_TO_LB).toFixed(2));\n        return {\n          weight_kg: weight_kg,\n          weight_lbs: weight_lbs,\n          reps: reps\n        };\n      }\n    }\n"""
new = """    const indices = _getHeaderIndices(logSheet);\n    const data = logSheet.getDataRange().getValues();\n    const headers = data.length > 0 ? data[0].map(function (value) { return String(value || '').trim(); }) : [];\n    const trackingTypeIdx = headers.indexOf('TrackingType');\n    const durationIdx = headers.indexOf('DurationSec');\n    \n    // WorkoutLog is newest-first. Return the first matching set with usable data.\n    for (let i = 1; i < data.length; i++) {\n      const row = data[i];\n      const motion = row[indices[CONSTANTS.HEADERS.MOTION]];\n      if (motion !== exerciseName) continue;\n\n      const trackingType = trackingTypeIdx >= 0\n        ? _normalizeWorkoutTrackingType(row[trackingTypeIdx])\n        : 'weight_reps';\n\n      if (trackingType === 'duration' && durationIdx >= 0) {\n        const durationSec = Number(row[durationIdx]);\n        if (isFinite(durationSec) && durationSec > 0) {\n          return { tracking_type: 'duration', duration_sec: Math.round(durationSec) };\n        }\n        continue;\n      }\n\n      const reps = row[indices[CONSTANTS.HEADERS.REPS]];\n      const weight_kg = row[indices[CONSTANTS.HEADERS.WEIGHT_KG]];\n      if (reps && weight_kg) {\n        const weight_lbs = parseFloat((weight_kg * KG_TO_LB).toFixed(2));\n        return {\n          tracking_type: 'weight_reps',\n          weight_kg: weight_kg,\n          weight_lbs: weight_lbs,\n          reps: reps\n        };\n      }\n    }\n"""
if old not in api:
    raise SystemExit('failed to find latest performance block')
api = api.replace(old, new, 1)
api = api.replace(
    "    workoutData.forEach(setData => {\n      const motion = setData.motion;\n",
    "    workoutData.forEach(setData => {\n      const trackingType = String(setData.tracking_type || 'weight_reps').trim().toLowerCase();\n      if (trackingType !== 'weight_reps') return;\n\n      const motion = setData.motion;\n",
    1,
)
write('src/API.gs', api)

# Backend: duration rows use DurationSec; legacy weight/reps stay blank and Volume=0.
replace_once(
    'src/Internal.gs',
    """      // Keep the legacy calculations byte-for-byte equivalent for old payloads.\n      const weight_kg = set.weight_in_kg;\n      const weight_lbs = (set.unit === '磅')\n        ? set.weight\n        : parseFloat((set.weight * KG_TO_LB).toFixed(2));\n      const volume = weight_kg * set.reps;\n      exerciseTotalVolume += volume;\n\n      const note = index === 0 ? set.note : '';\n      const adminComment = index === 0 ? adminCommentForMotion : '';\n      const legacyRow = ['', motionName, index + 1, set.reps, weight_kg, weight_lbs, volume, note, adminComment];\n""",
    """      // Duration sets use V3 DurationSec and deliberately leave legacy weight/reps blank.\n      // Weight/reps payloads retain the previous calculations exactly.\n      let legacyReps = '';\n      let weight_kg = '';\n      let weight_lbs = '';\n      let volume = 0;\n      if (setFields.trackingType === 'weight_reps') {\n        legacyReps = set.reps;\n        weight_kg = set.weight_in_kg;\n        weight_lbs = (set.unit === '磅')\n          ? set.weight\n          : parseFloat((set.weight * KG_TO_LB).toFixed(2));\n        volume = weight_kg * set.reps;\n      }\n      exerciseTotalVolume += volume;\n\n      const note = index === 0 ? set.note : '';\n      const adminComment = index === 0 ? adminCommentForMotion : '';\n      const legacyRow = ['', motionName, index + 1, legacyReps, weight_kg, weight_lbs, volume, note, adminComment];\n""",
)

write('web/src/tracking-type.js', """export const TRACKING_TYPE = Object.freeze({\n  WEIGHT_REPS: 'weight_reps',\n  DURATION: 'duration',\n});\n\nexport function normalizeTrackingType(value) {\n  return String(value || '').trim().toLowerCase() === TRACKING_TYPE.DURATION\n    ? TRACKING_TYPE.DURATION\n    : TRACKING_TYPE.WEIGHT_REPS;\n}\n\nexport function normalizeDurationSec(value) {\n  const numeric = Number(value);\n  if (!Number.isFinite(numeric) || numeric <= 0) return 0;\n  return Math.round(numeric);\n}\n\nexport function formatDuration(value) {\n  const total = normalizeDurationSec(value);\n  if (!total) return '0 秒';\n  if (total < 60) return `${total} 秒`;\n  const minutes = Math.floor(total / 60);\n  const seconds = String(total % 60).padStart(2, '0');\n  return `${minutes}:${seconds}`;\n}\n""")
write('web/src/tracking-type.test.js', """import { describe, expect, it } from 'vitest';\nimport { formatDuration, normalizeDurationSec, normalizeTrackingType, TRACKING_TYPE } from './tracking-type.js';\n\ndescribe('tracking type helpers', () => {\n  it('unknown tracking types preserve legacy weight/reps semantics', () => {\n    expect(normalizeTrackingType('duration')).toBe(TRACKING_TYPE.DURATION);\n    expect(normalizeTrackingType('weight_reps')).toBe(TRACKING_TYPE.WEIGHT_REPS);\n    expect(normalizeTrackingType('')).toBe(TRACKING_TYPE.WEIGHT_REPS);\n    expect(normalizeTrackingType('future_type')).toBe(TRACKING_TYPE.WEIGHT_REPS);\n  });\n\n  it('duration seconds are positive rounded integers', () => {\n    expect(normalizeDurationSec(45.4)).toBe(45);\n    expect(normalizeDurationSec('90')).toBe(90);\n    expect(normalizeDurationSec(0)).toBe(0);\n    expect(normalizeDurationSec('x')).toBe(0);\n  });\n\n  it('formats short and minute-based duration clearly', () => {\n    expect(formatDuration(45)).toBe('45 秒');\n    expect(formatDuration(90)).toBe('1:30');\n    expect(formatDuration(0)).toBe('0 秒');\n  });\n});\n""")

replace_once('web/src/state.js', """                    workoutTemplates: {},\n                    exerciseNameList: [],\n                    analysisData: null,\n""", """                    workoutTemplates: {},\n                    exerciseNameList: [],\n                    exerciseCatalog: [],\n                    analysisData: null,\n""")

app = read('web/src/app.js')
app = app.replace("                        this.methods.resizeWorkoutNotes();\n                        this.ui.showToast('已恢復未完成的訓練草稿。');\n", "                        this.methods.applyTrackingMetadataToWorkout();\n                        this.methods.resizeWorkoutNotes();\n                        document.querySelectorAll('#workout-list .card').forEach((card) => this.methods.calculateVolume(card));\n                        this.methods.updateDailyTotalVolume();\n                        this.ui.showToast('已恢復未完成的訓練草稿。');\n", 1)
app = app.replace("                    onInvalidComplete: () => this.ui.showToast('請先輸入這一組的重量或次數。', 'error')\n", "                    onInvalidComplete: () => this.ui.showToast('請先輸入這一組的訓練數值。', 'error')\n", 1)
app = app.replace("                    const { profile, allUsers, templates, exerciseNames } = data;\n", "                    const { profile, allUsers, templates, exerciseNames, exerciseCatalog = [] } = data;\n", 1)
app = app.replace("                    this.state.cache.exerciseNameList = exerciseNames;\n", "                    this.state.cache.exerciseNameList = exerciseNames;\n                    this.state.cache.exerciseCatalog = exerciseCatalog;\n                    this.state.classify.catalog = exerciseCatalog;\n", 1)
write('web/src/app.js', app)

index = read('web/index.html')
index = index.replace('<span class="text-[11px] text-gray-500">容量</span>', '<span class="js-volume-label text-[11px] text-gray-500">容量</span>', 1)
index = index.replace('<div class="workout-set-inputs">\n                <div class="workout-number-field workout-weight-field">', '<div class="js-weight-reps-inputs workout-set-inputs">\n                <div class="workout-number-field workout-weight-field">', 1)
needle = """                <div class=\"workout-number-field workout-reps-field\">\n                    <input type=\"number\" min=\"0\" class=\"js-reps-input workout-set-input\" aria-label=\"次數\">\n                    <span class=\"workout-field-suffix\">次</span>\n                </div>\n            </div>\n\n            <div class=\"workout-set-actions\" aria-label=\"組別操作\">\n"""
replacement = """                <div class=\"workout-number-field workout-reps-field\">\n                    <input type=\"number\" min=\"0\" class=\"js-reps-input workout-set-input\" aria-label=\"次數\">\n                    <span class=\"workout-field-suffix\">次</span>\n                </div>\n            </div>\n\n            <div class=\"js-duration-inputs workout-set-inputs workout-duration-inputs hidden\">\n                <div class=\"workout-number-field workout-duration-field\">\n                    <input type=\"number\" min=\"1\" step=\"1\" class=\"js-duration-input workout-set-input\" aria-label=\"秒數\">\n                    <span class=\"workout-field-suffix\">秒</span>\n                </div>\n            </div>\n\n            <div class=\"workout-set-actions\" aria-label=\"組別操作\">\n"""
if needle not in index:
    raise SystemExit('set-row input block not found')
index = index.replace(needle, replacement, 1)
write('web/index.html', index)

methods = read('web/src/methods.js')
methods = methods.replace("import { normalizeSetType, SET_TYPE } from './set-type.js';\n", "import { normalizeSetType, SET_TYPE } from './set-type.js';\nimport { formatDuration, normalizeDurationSec, normalizeTrackingType, TRACKING_TYPE } from './tracking-type.js';\n", 1)
methods = methods.replace("                        const { profile, templates, exerciseNames } = data;\n", "                        const { profile, templates, exerciseNames, exerciseCatalog = [] } = data;\n", 1)
methods = methods.replace("                        app.state.cache.exerciseNameList = exerciseNames;\n", "                        app.state.cache.exerciseNameList = exerciseNames;\n                        app.state.cache.exerciseCatalog = exerciseCatalog;\n                        app.state.classify.catalog = exerciseCatalog;\n", 1)
pattern = r"                updateDailyTotalVolume\(\) \{.*?\n                \},\n\n                calculateVolume\(exerciseCard\) \{.*?\n                \},\n\n                resizeWorkoutNote"
replacement = r'''                updateDailyTotalVolume() {
                    const LB_TO_KG = 0.45359237;
                    const allExerciseCards = document.querySelectorAll('#workout-list .card');
                    let dailyTotalVolumeInKg = 0;
                    allExerciseCards.forEach(card => {
                        if (normalizeTrackingType(card.dataset.trackingType) !== TRACKING_TYPE.WEIGHT_REPS) return;
                        card.querySelectorAll('.js-set-row').forEach(set => {
                            let weight = parseFloat(set.querySelector('.js-weight-input')?.value) || 0;
                            const reps = parseInt(set.querySelector('.js-reps-input')?.value) || 0;
                            const unit = set.querySelector('.js-unit-select')?.value || '公斤';
                            if (unit === '磅') weight *= LB_TO_KG;
                            dailyTotalVolumeInKg += weight * reps;
                        });
                    });
                    const displayElement = document.getElementById('daily-total-volume-display');
                    if (displayElement) displayElement.textContent = `${parseFloat(dailyTotalVolumeInKg.toFixed(2))} 公斤`;
                },

                calculateVolume(exerciseCard) {
                    if (!exerciseCard) return;
                    const trackingType = normalizeTrackingType(exerciseCard.dataset.trackingType);
                    const displayElement = exerciseCard.querySelector('.js-volume-display');
                    const labelElement = exerciseCard.querySelector('.js-volume-label');
                    const sets = exerciseCard.querySelectorAll('.js-set-row');
                    if (trackingType === TRACKING_TYPE.DURATION) {
                        let totalDuration = 0;
                        sets.forEach((set) => { totalDuration += normalizeDurationSec(set.querySelector('.js-duration-input')?.value); });
                        if (labelElement) labelElement.textContent = '時間';
                        if (displayElement) displayElement.textContent = formatDuration(totalDuration);
                        return;
                    }
                    const LB_TO_KG = 0.45359237;
                    const KG_TO_LB = 2.20462262;
                    let totalVolumeInKg = 0;
                    let displayUnit = '公斤';
                    if (sets.length > 0) displayUnit = sets[0].querySelector('.js-unit-select')?.value || '公斤';
                    sets.forEach(set => {
                        let weight = parseFloat(set.querySelector('.js-weight-input')?.value) || 0;
                        const reps = parseInt(set.querySelector('.js-reps-input')?.value) || 0;
                        const unit = set.querySelector('.js-unit-select')?.value || '公斤';
                        if (unit === '磅') weight *= LB_TO_KG;
                        totalVolumeInKg += weight * reps;
                    });
                    let displayVolume = displayUnit === '磅' ? totalVolumeInKg * KG_TO_LB : totalVolumeInKg;
                    if (labelElement) labelElement.textContent = '容量';
                    if (displayElement) displayElement.textContent = `${parseFloat(displayVolume.toFixed(2))} ${displayUnit}`;
                },

                getExerciseMetadata(name) {
                    const motion = String(name || '').trim();
                    if (!motion) return null;
                    const catalog = app.state.cache.exerciseCatalog || app.state.classify.catalog || [];
                    return catalog.find((item) => item.motion === motion) || null;
                },

                applyTrackingTypeToSet(setRow, value) {
                    if (!setRow) return;
                    const trackingType = normalizeTrackingType(value);
                    setRow.dataset.trackingType = trackingType;
                    setRow.querySelector('.js-weight-reps-inputs')?.classList.toggle('hidden', trackingType !== TRACKING_TYPE.WEIGHT_REPS);
                    setRow.querySelector('.js-duration-inputs')?.classList.toggle('hidden', trackingType !== TRACKING_TYPE.DURATION);
                },

                applyTrackingTypeToCard(card, value, metadata = null) {
                    if (!card) return;
                    const trackingType = normalizeTrackingType(value);
                    card.dataset.trackingType = trackingType;
                    if (metadata?.exerciseId) card.dataset.exerciseId = metadata.exerciseId;
                    card.querySelectorAll('.js-set-row').forEach((setRow) => this.applyTrackingTypeToSet(setRow, trackingType));
                    this.calculateVolume(card);
                },

                applyTrackingMetadataToWorkout(root = document) {
                    root.querySelectorAll?.('#workout-list .card').forEach((card) => {
                        const motion = card.querySelector('h3')?.textContent?.trim() || '';
                        const metadata = this.getExerciseMetadata(motion);
                        this.applyTrackingTypeToCard(card, metadata?.trackingType || card.dataset.trackingType, metadata);
                    });
                },

                resizeWorkoutNote'''
methods, count = re.subn(pattern, replacement, methods, count=1, flags=re.S)
if count != 1:
    raise SystemExit('failed to replace volume/tracking methods region')
methods = methods.replace("                createSetElement(setNumber) {\n", "                createSetElement(setNumber, trackingType = TRACKING_TYPE.WEIGHT_REPS) {\n", 1)
methods = methods.replace("                    this.applySetTypeToToggle(newSet.querySelector('.js-set-type-toggle'), SET_TYPE.WORKING);\n                    return newSet;\n", "                    this.applySetTypeToToggle(newSet.querySelector('.js-set-type-toggle'), SET_TYPE.WORKING);\n                    this.applyTrackingTypeToSet(newSet.querySelector('.js-set-row'), trackingType);\n                    return newSet;\n", 1)
pattern = r"                addSet\(exerciseCard\) \{.*?\n                \},\n\n                deleteSet"
replacement = r'''                addSet(exerciseCard) {
                    const setsContainer = exerciseCard.querySelector('.js-sets-container');
                    const allSets = setsContainer.querySelectorAll('.js-set-row');
                    const setNumber = allSets.length + 1;
                    const trackingType = normalizeTrackingType(exerciseCard.dataset.trackingType);
                    let lastWeight = '';
                    let lastUnit = '公斤';
                    let lastDuration = '';
                    let lastSetType = 'working';
                    if (allSets.length > 0) {
                        const lastSet = allSets[allSets.length - 1];
                        lastWeight = lastSet.querySelector('.js-weight-input')?.value || '';
                        lastUnit = lastSet.querySelector('.js-unit-select')?.value || '公斤';
                        lastDuration = lastSet.querySelector('.js-duration-input')?.value || '';
                        lastSetType = normalizeSetType(lastSet.querySelector('.js-set-type-toggle')?.dataset.setType);
                    }
                    const newSetElement = this.createSetElement(setNumber, trackingType);
                    newSetElement.firstElementChild.classList.add('animated-item', 'fade-in');
                    if (newSetElement.querySelector('.js-weight-input')) newSetElement.querySelector('.js-weight-input').value = lastWeight;
                    if (newSetElement.querySelector('.js-unit-select')) newSetElement.querySelector('.js-unit-select').value = lastUnit;
                    if (newSetElement.querySelector('.js-duration-input')) newSetElement.querySelector('.js-duration-input').value = lastDuration;
                    this.applySetTypeToToggle(newSetElement.querySelector('.js-set-type-toggle'), lastSetType);
                    setsContainer.appendChild(newSetElement);
                    const addedSet = setsContainer.querySelector('.js-set-row:last-child');
                    if (addedSet) setTimeout(() => addedSet.classList.add('is-visible'), 10);
                    this.calculateVolume(exerciseCard);
                    this.updateDailyTotalVolume();
                    const focusInput = trackingType === TRACKING_TYPE.DURATION
                        ? setsContainer.querySelector('.js-set-row:last-child .js-duration-input')
                        : setsContainer.querySelector('.js-set-row:last-child .js-reps-input');
                    if (focusInput) focusInput.focus();
                },

                deleteSet'''
methods, count = re.subn(pattern, replacement, methods, count=1, flags=re.S)
if count != 1:
    raise SystemExit('failed to replace addSet')
methods = methods.replace("                            .then(catalog => { app.state.classify.catalog = catalog; })\n", "                            .then(catalog => {\n                                app.state.classify.catalog = catalog;\n                                app.state.cache.exerciseCatalog = catalog;\n                            })\n", 1)
pattern = r"                addExercise\(name\) \{.*?\n                \},\n\n                copyLastSet"
replacement = r'''                addExercise(name) {
                    const workoutList = document.getElementById('workout-list');
                    if (!workoutList) return;
                    const metadata = this.getExerciseMetadata(name);
                    const trackingType = normalizeTrackingType(metadata?.trackingType);
                    const template = document.getElementById('exercise-card-template');
                    const newCardFragment = document.importNode(template.content, true);
                    const cardElement = newCardFragment.querySelector('.card');
                    cardElement.id = 'exercise-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
                    cardElement.classList.add('animated-item', 'fade-in');
                    cardElement.querySelector('h3').textContent = name;
                    cardElement.dataset.trackingType = trackingType;
                    if (metadata?.exerciseId) cardElement.dataset.exerciseId = metadata.exerciseId;
                    cardElement.querySelector('.js-sets-container').appendChild(this.createSetElement(1, trackingType));
                    workoutList.appendChild(newCardFragment);
                    setTimeout(() => cardElement.classList.add('is-visible'), 10);
                    const performanceEl = cardElement.querySelector('.js-last-performance');
                    app.api.getLatestPerformance(name, app.state.user.currentUser).then(data => {
                      if (data?.tracking_type === TRACKING_TYPE.DURATION && data.duration_sec > 0) {
                        performanceEl.innerHTML = `上次: <span class="font-bold">${formatDuration(data.duration_sec)}</span>`;
                      } else if (data && data.weight_kg != null && data.reps != null) {
                        performanceEl.innerHTML = `上次: <span class="font-bold">${data.weight_kg} kg x ${data.reps} 次</span>`;
                      } else {
                        performanceEl.textContent = trackingType === TRACKING_TYPE.DURATION ? '無時間紀錄' : '無歷史紀錄';
                      }
                    }).catch(err => {
                      performanceEl.textContent = '查詢失敗';
                      this.handleError(err, `查詢 ${name} 上次表現失敗`);
                    });
                    this.calculateVolume(cardElement);
                    this.updateDailyTotalVolume();
                },

                copyLastSet'''
methods, count = re.subn(pattern, replacement, methods, count=1, flags=re.S)
if count != 1:
    raise SystemExit('failed to replace addExercise')
methods = methods.replace("                    const lastUnit = lastSet.querySelector('.js-unit-select').value;\n                    const lastSetType = normalizeSetType(lastSet.querySelector('.js-set-type-toggle')?.dataset.setType);\n", "                    const lastUnit = lastSet.querySelector('.js-unit-select')?.value || '公斤';\n                    const lastDuration = lastSet.querySelector('.js-duration-input')?.value || '';\n                    const lastSetType = normalizeSetType(lastSet.querySelector('.js-set-type-toggle')?.dataset.setType);\n", 1)
methods = methods.replace("                        newSet.querySelector('.js-unit-select').value = lastUnit;\n                        const newSetTypeToggle = newSet.querySelector('.js-set-type-toggle');\n", "                        newSet.querySelector('.js-unit-select').value = lastUnit;\n                        const durationInput = newSet.querySelector('.js-duration-input');\n                        if (durationInput) durationInput.value = lastDuration;\n                        const newSetTypeToggle = newSet.querySelector('.js-set-type-toggle');\n", 1)
pattern = r"                collectWorkoutData\(\) \{.*?\n                \},\n\n                updateDailyTotalVolume"
replacement = r'''                collectWorkoutData() {
                    const LB_TO_KG = 0.45359237;
                    const workoutData = [];
                    const selectedDateString = document.getElementById('workout-date-input').value;
                    const now = new Date();
                    const finalDate = new Date(selectedDateString);
                    finalDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
                    const dateToSave = finalDate.toISOString();
                    document.querySelectorAll('#workout-list .card').forEach(card => {
                      const exerciseName = card.querySelector('h3').textContent;
                      const exerciseId = card.dataset.exerciseId || '';
                      const trackingType = normalizeTrackingType(card.dataset.trackingType);
                      const note = card.querySelector('.js-exercise-note').value;
                      card.querySelectorAll('.js-set-row').forEach((set, index) => {
                        const setType = normalizeSetType(set.querySelector('.js-set-type-toggle')?.dataset.setType);
                        if (trackingType === TRACKING_TYPE.DURATION) {
                          const durationSec = normalizeDurationSec(set.querySelector('.js-duration-input')?.value);
                          if (durationSec <= 0) return;
                          workoutData.push({ date: dateToSave, motion: exerciseName, exercise_id: exerciseId, set: index + 1, weight: 0, unit: '公斤', reps: 0, weight_in_kg: 0, set_type: setType, tracking_type: TRACKING_TYPE.DURATION, duration_sec: durationSec, note: note });
                          return;
                        }
                        const weight = parseFloat(set.querySelector('.js-weight-input')?.value) || 0;
                        const reps = parseInt(set.querySelector('.js-reps-input')?.value) || 0;
                        const unit = set.querySelector('.js-unit-select')?.value || '公斤';
                        let weightInKg = weight;
                        if (unit === '磅') weightInKg = parseFloat((weight * LB_TO_KG).toFixed(2));
                        if (weight > 0 || reps > 0) {
                          workoutData.push({ date: dateToSave, motion: exerciseName, exercise_id: exerciseId, set: index + 1, weight: weight, unit: unit, reps: reps, weight_in_kg: weightInKg, set_type: setType, tracking_type: TRACKING_TYPE.WEIGHT_REPS, note: note });
                        }
                      });
                    });
                    console.log('收集到的訓練資料:', workoutData);
                    return workoutData;
                },

                updateDailyTotalVolume'''
methods, count = re.subn(pattern, replacement, methods, count=1, flags=re.S)
if count != 1:
    raise SystemExit('failed to replace collectWorkoutData')
write('web/src/methods.js', methods)

replace_once('web/src/events.js', "if (target.matches('.js-weight-input, .js-reps-input, .js-unit-select')) {", "if (target.matches('.js-weight-input, .js-reps-input, .js-unit-select, .js-duration-input')) {")

numeric = read('web/src/workout-numeric-input.js')
numeric = numeric.replace("const INPUT_SELECTOR = '.js-weight-input, .js-reps-input';", "const INPUT_SELECTOR = '.js-weight-input, .js-reps-input, .js-duration-input';", 1)
numeric = numeric.replace("  reps: {\n    label: '次數',\n    max: 999,\n    decimals: 0,\n    steps: [-5, -1, 1, 5],\n  },\n", "  reps: {\n    label: '次數',\n    max: 999,\n    decimals: 0,\n    steps: [-5, -1, 1, 5],\n  },\n  duration: {\n    label: '秒數',\n    max: 86400,\n    decimals: 0,\n    steps: [-30, -10, -5, 5, 10, 30],\n  },\n", 1)
numeric = numeric.replace("  if (input?.classList?.contains('js-reps-input')) return 'reps';\n  return null;\n", "  if (input?.classList?.contains('js-reps-input')) return 'reps';\n  if (input?.classList?.contains('js-duration-input')) return 'duration';\n  return null;\n", 1)
numeric = numeric.replace("    stepContainer.className = activeKind === 'weight'\n      ? 'grid grid-cols-6 gap-1.5 mb-3'\n      : 'grid grid-cols-4 gap-2 mb-3';\n", "    stepContainer.className = activeKind === 'reps'\n      ? 'grid grid-cols-4 gap-2 mb-3'\n      : 'grid grid-cols-6 gap-1.5 mb-3';\n", 1)
numeric = numeric.replace("    input.setAttribute('aria-label', getKind(input) === 'weight' ? '重量' : '次數');\n", "    const kind = getKind(input);\n    input.setAttribute('aria-label', CONFIG[kind]?.label || '訓練數值');\n", 1)
write('web/src/workout-numeric-input.js', numeric)
replace_once('web/src/workout-numeric-input.test.js', """  it('不允許輸入超過欄位上限', () => {\n    expect(appendDigit('999', '9', 'reps')).toBe('999');\n    expect(appendDigit('1000', '1', 'weight')).toBe('1000');\n  });\n""", """  it('不允許輸入超過欄位上限', () => {\n    expect(appendDigit('999', '9', 'reps')).toBe('999');\n    expect(appendDigit('1000', '1', 'weight')).toBe('1000');\n  });\n\n  it('duration 使用整數秒與秒數快捷調整', () => {\n    expect(appendDecimal('45', 'duration')).toBe('45');\n    expect(adjustedValue('45', 30, 'duration')).toBe('75');\n    expect(formatNumericValue(90.7, 'duration')).toBe('91');\n  });\n""")

replace_once('web/src/rest-timer.js', """function setHasWorkoutData(setRow) {\n  const weight = parseFloat(setRow.querySelector('.js-weight-input')?.value || '0') || 0;\n  const reps = parseInt(setRow.querySelector('.js-reps-input')?.value || '0', 10) || 0;\n  return weight > 0 || reps > 0;\n}\n""", """function setHasWorkoutData(setRow) {\n  const weight = parseFloat(setRow.querySelector('.js-weight-input')?.value || '0') || 0;\n  const reps = parseInt(setRow.querySelector('.js-reps-input')?.value || '0', 10) || 0;\n  const duration = parseInt(setRow.querySelector('.js-duration-input')?.value || '0', 10) || 0;\n  return weight > 0 || reps > 0 || duration > 0;\n}\n""")

draft = read('web/src/workout-draft.js')
draft = draft.replace("import { normalizeSetType } from './set-type.js';\n", "import { normalizeSetType } from './set-type.js';\nimport { normalizeTrackingType, TRACKING_TYPE } from './tracking-type.js';\n", 1)
draft = draft.replace("      const note = card.querySelector('.js-exercise-note')?.value || '';\n      const sets = [...card.querySelectorAll('.js-set-row')].map((set) => ({\n        weight: set.querySelector('.js-weight-input')?.value || '',\n        reps: set.querySelector('.js-reps-input')?.value || '',\n        unit: set.querySelector('.js-unit-select')?.value || '公斤',\n        setType: normalizeSetType(set.querySelector('.js-set-type-toggle')?.dataset.setType),\n      }));\n\n      return { name, note, sets };\n", "      const note = card.querySelector('.js-exercise-note')?.value || '';\n      const trackingType = normalizeTrackingType(card.dataset.trackingType);\n      const sets = [...card.querySelectorAll('.js-set-row')].map((set) => ({\n        weight: set.querySelector('.js-weight-input')?.value || '',\n        reps: set.querySelector('.js-reps-input')?.value || '',\n        unit: set.querySelector('.js-unit-select')?.value || '公斤',\n        durationSec: set.querySelector('.js-duration-input')?.value || '',\n        setType: normalizeSetType(set.querySelector('.js-set-type-toggle')?.dataset.setType),\n      }));\n\n      return { name, note, trackingType, exerciseId: card.dataset.exerciseId || '', sets };\n", 1)
draft = draft.replace("function createSetFragment(setData, setNumber) {", "function createSetFragment(setData, setNumber, trackingType = TRACKING_TYPE.WEIGHT_REPS) {", 1)
draft = draft.replace("  const setTypeToggle = fragment.querySelector('.js-set-type-toggle');\n", "  const durationInput = fragment.querySelector('.js-duration-input');\n  const setTypeToggle = fragment.querySelector('.js-set-type-toggle');\n  const setRow = fragment.querySelector('.js-set-row');\n", 1)
draft = draft.replace("  if (unitSelect) unitSelect.value = setData?.unit || '公斤';\n", "  if (unitSelect) unitSelect.value = setData?.unit || '公斤';\n  if (durationInput) durationInput.value = setData?.durationSec ?? '';\n  const normalizedTrackingType = normalizeTrackingType(trackingType);\n  if (setRow) setRow.dataset.trackingType = normalizedTrackingType;\n  fragment.querySelector('.js-weight-reps-inputs')?.classList.toggle('hidden', normalizedTrackingType !== TRACKING_TYPE.WEIGHT_REPS);\n  fragment.querySelector('.js-duration-inputs')?.classList.toggle('hidden', normalizedTrackingType !== TRACKING_TYPE.DURATION);\n", 1)
draft = draft.replace("  const noteInput = card.querySelector('.js-exercise-note');\n  if (noteInput) noteInput.value = exercise.note || '';\n", "  const trackingType = normalizeTrackingType(exercise.trackingType);\n  card.dataset.trackingType = trackingType;\n  if (exercise.exerciseId) card.dataset.exerciseId = exercise.exerciseId;\n\n  const noteInput = card.querySelector('.js-exercise-note');\n  if (noteInput) noteInput.value = exercise.note || '';\n", 1)
draft = draft.replace("      : [{ weight: '', reps: '', unit: '公斤', setType: 'working' }];\n\n    sets.forEach((setData, index) => {\n      const setFragment = createSetFragment(setData, index + 1);\n", "      : [{ weight: '', reps: '', unit: '公斤', durationSec: '', setType: 'working' }];\n\n    sets.forEach((setData, index) => {\n      const setFragment = createSetFragment(setData, index + 1, trackingType);\n", 1)
write('web/src/workout-draft.js', draft)

style = read('web/src/style.css')
style += """\n\n/* --- Duration Tracking v1 --- */\n.workout-duration-inputs {\n    grid-template-columns: minmax(0, 1fr);\n}\n\n.workout-duration-field {\n    width: 100%;\n}\n\n.workout-duration-field .workout-set-input {\n    text-align: center;\n}\n"""
write('web/src/style.css', style)

print('duration tracking v1 patch applied')
