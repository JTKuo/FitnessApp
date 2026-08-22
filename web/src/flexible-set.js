const DEFAULT_METADATA = Object.freeze({
  exerciseId: '',
  trackingType: 'weight_reps',
  loadMode: 'total',
  laterality: 'bilateral',
  defaultRestSec: 30,
  active: true,
});

let initialized = false;
let getCurrentUser = () => null;
let getExerciseCatalog = async () => [];
let catalogOwner = '';
let catalogLoadedOwner = '';
let catalogPromise = null;
let catalogRequestId = 0;
let catalogMap = new Map();

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeMetadata(item = {}) {
  const trackingType = String(item.trackingType || item.tracking_type || DEFAULT_METADATA.trackingType).trim();
  const rest = Number(item.defaultRestSec ?? item.default_rest_sec ?? DEFAULT_METADATA.defaultRestSec);
  return {
    exerciseId: String(item.exerciseId || item.exercise_id || '').trim(),
    motion: String(item.motion || '').trim(),
    category: String(item.category || '').trim(),
    tags: Array.isArray(item.tags) ? item.tags : [],
    trackingType: trackingType === 'duration' ? 'duration' : 'weight_reps',
    loadMode: String(item.loadMode || item.load_mode || DEFAULT_METADATA.loadMode).trim() || DEFAULT_METADATA.loadMode,
    laterality: String(item.laterality || DEFAULT_METADATA.laterality).trim() || DEFAULT_METADATA.laterality,
    defaultRestSec: Number.isFinite(rest) ? rest : DEFAULT_METADATA.defaultRestSec,
    demoMedia: String(item.demoMedia || item.demo_media || '').trim(),
    active: item.active !== false && String(item.active).toLowerCase() !== 'false',
  };
}

function metadataForMotion(motion) {
  return catalogMap.get(String(motion || '').trim()) || { ...DEFAULT_METADATA, motion: String(motion || '').trim() };
}

function buildWorkoutDate(selectedDateString, now = new Date()) {
  const finalDate = new Date(selectedDateString);
  if (Number.isNaN(finalDate.getTime())) return now.toISOString();
  finalDate.setHours(now.getHours());
  finalDate.setMinutes(now.getMinutes());
  finalDate.setSeconds(now.getSeconds());
  return finalDate.toISOString();
}

function setTypeFromRow(row) {
  const value = row.querySelector('.js-set-type')?.value || row.dataset.setType || 'working';
  return value === 'warmup' ? 'warmup' : 'working';
}

function durationFromRow(row) {
  const raw = row.querySelector('.js-duration-input')?.value ?? row.dataset.durationSec ?? '';
  const numeric = Number(raw);
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : 0;
}

function createMetaControls(row, metadata) {
  let controls = row.querySelector('.js-set-meta');
  if (!controls) {
    controls = document.createElement('div');
    controls.className = 'js-set-meta w-full pl-12 pr-8 mt-1 flex items-center gap-2 text-xs text-gray-400';
    controls.innerHTML = `
      <label class="flex items-center gap-1">
        <span>組別</span>
        <select class="js-set-type rounded border border-gray-700 bg-black px-1.5 py-1 text-xs text-gray-200">
          <option value="working">工作組</option>
          <option value="warmup">熱身組</option>
        </select>
      </label>
      <span class="js-tracking-type-label rounded border border-gray-700 px-1.5 py-1"></span>
    `;
    row.appendChild(controls);
  }

  const setTypeSelect = controls.querySelector('.js-set-type');
  if (setTypeSelect) setTypeSelect.value = row.dataset.setType === 'warmup' ? 'warmup' : 'working';

  const label = controls.querySelector('.js-tracking-type-label');
  if (label) label.textContent = metadata.trackingType === 'duration' ? '時間' : '重量 × 次數';
}

function createDurationControl(row) {
  const grid = row.querySelector('.flex-grow.grid');
  if (!grid) return null;

  let durationGroup = grid.querySelector('.js-duration-group');
  if (!durationGroup) {
    durationGroup = document.createElement('div');
    durationGroup.className = 'js-duration-group hidden col-span-full flex items-center gap-2';
    durationGroup.innerHTML = `
      <input type="number" min="0" step="1" class="w-full rounded-md p-2 text-center js-duration-input" aria-label="持續秒數">
      <span class="text-gray-400 text-sm whitespace-nowrap">秒</span>
    `;
    grid.appendChild(durationGroup);
  }

  const input = durationGroup.querySelector('.js-duration-input');
  if (input && !input.value && row.dataset.durationSec) input.value = row.dataset.durationSec;
  return durationGroup;
}

function decorateSetRow(row, metadata) {
  if (!row) return;
  row.classList.add('flex-wrap');

  if (!row.dataset.setType) row.dataset.setType = 'working';
  createMetaControls(row, metadata);

  const grid = row.querySelector('.flex-grow.grid');
  if (!grid) return;

  const originalGroups = [...grid.children].filter((child) => !child.classList.contains('js-duration-group'));
  const durationGroup = createDurationControl(row);
  const isDuration = metadata.trackingType === 'duration';

  originalGroups.forEach((group) => group.classList.toggle('hidden', isDuration));
  durationGroup?.classList.toggle('hidden', !isDuration);
  grid.classList.toggle('grid-cols-2', !isDuration);
  grid.classList.toggle('grid-cols-1', isDuration);

  row.dataset.trackingType = metadata.trackingType;
  row.dataset.exerciseId = metadata.exerciseId || '';
  row.dataset.loadMode = metadata.loadMode || 'total';
  row.dataset.laterality = metadata.laterality || 'bilateral';
}

function decorateCard(card) {
  const motion = card.querySelector('h3')?.textContent?.trim() || '';
  if (!motion) return;
  const metadata = metadataForMotion(motion);
  card.dataset.exerciseId = metadata.exerciseId || '';
  card.dataset.trackingType = metadata.trackingType;
  card.dataset.loadMode = metadata.loadMode;
  card.dataset.laterality = metadata.laterality;
  card.querySelectorAll('.js-set-row').forEach((row) => decorateSetRow(row, metadata));
}

function decorateAll() {
  const list = document.getElementById('workout-list');
  if (!list) return;
  list.querySelectorAll('.card').forEach(decorateCard);
}

function collectDescriptors() {
  const descriptors = [];
  document.querySelectorAll('#workout-list .card').forEach((card) => {
    const motion = card.querySelector('h3')?.textContent?.trim() || '';
    if (!motion) return;
    const note = card.querySelector('.js-exercise-note')?.value || '';
    const metadata = metadataForMotion(motion);

    card.querySelectorAll('.js-set-row').forEach((row, index) => {
      descriptors.push({
        motion,
        set: index + 1,
        note,
        setType: setTypeFromRow(row),
        trackingType: metadata.trackingType,
        durationSec: durationFromRow(row),
        exerciseId: metadata.exerciseId,
        side: 'both',
        loadMode: metadata.loadMode,
      });
    });
  });
  return descriptors;
}

function descriptorKey(item) {
  return `${String(item.motion || '').trim()}::${Number(item.set) || 0}`;
}

function enrichWorkoutData(legacyData, descriptors, dateToSave) {
  const legacyQueues = new Map();
  (Array.isArray(legacyData) ? legacyData : []).forEach((item) => {
    const key = descriptorKey(item);
    if (!legacyQueues.has(key)) legacyQueues.set(key, []);
    legacyQueues.get(key).push(item);
  });

  const result = [];
  const usedLegacy = new Set();

  (Array.isArray(descriptors) ? descriptors : []).forEach((descriptor) => {
    const common = {
      set_type: descriptor.setType === 'warmup' ? 'warmup' : 'working',
      tracking_type: descriptor.trackingType === 'duration' ? 'duration' : 'weight_reps',
      duration_sec: descriptor.trackingType === 'duration' ? descriptor.durationSec : '',
      side: descriptor.side || 'both',
      load_mode: descriptor.loadMode || 'total',
      exercise_id: descriptor.exerciseId || '',
    };

    const queue = legacyQueues.get(descriptorKey(descriptor));

    if (common.tracking_type === 'duration') {
      // If an exercise was changed from weight/reps to duration, consume any stale hidden legacy row
      // so it cannot be re-added by the defensive fallback below.
      const staleLegacy = queue?.shift();
      if (staleLegacy) usedLegacy.add(staleLegacy);
      if (!(descriptor.durationSec > 0)) return;

      result.push({
        date: dateToSave,
        motion: descriptor.motion,
        set: descriptor.set,
        weight: 0,
        unit: '公斤',
        reps: 0,
        weight_in_kg: 0,
        note: descriptor.note || '',
        ...common,
      });
      return;
    }

    const legacy = queue?.shift();
    if (!legacy) return;
    usedLegacy.add(legacy);
    result.push({ ...legacy, ...common });
  });

  // Defensive fallback: preserve any legacy rows that a future DOM variation did not describe.
  (Array.isArray(legacyData) ? legacyData : []).forEach((legacy) => {
    if (usedLegacy.has(legacy)) return;
    const metadata = metadataForMotion(legacy.motion);
    result.push({
      ...legacy,
      set_type: 'working',
      tracking_type: metadata.trackingType,
      duration_sec: '',
      side: 'both',
      load_mode: metadata.loadMode,
      exercise_id: metadata.exerciseId,
    });
  });

  return result;
}

async function loadCatalog(email) {
  const owner = normalizeEmail(email);
  if (!owner) return [];
  if (owner === catalogLoadedOwner) return [...catalogMap.values()];
  if (catalogPromise && owner === catalogOwner) return catalogPromise;

  const requestId = ++catalogRequestId;
  catalogOwner = owner;
  catalogMap = new Map();

  const request = Promise.resolve(getExerciseCatalog(email))
    .then((items) => {
      if (requestId !== catalogRequestId || normalizeEmail(getCurrentUser()) !== owner) return [];
      (Array.isArray(items) ? items : []).forEach((item) => {
        const normalized = normalizeMetadata(item);
        if (normalized.motion) catalogMap.set(normalized.motion, normalized);
      });
      catalogLoadedOwner = owner;
      decorateAll();
      return [...catalogMap.values()];
    })
    .catch((error) => {
      if (requestId === catalogRequestId) {
        console.warn('[FlexibleSet] 無法載入 ExerciseMaster metadata，暫用 weight/reps 預設。', error);
      }
      return [];
    })
    .finally(() => {
      if (catalogPromise === request) catalogPromise = null;
    });

  catalogPromise = request;
  return request;
}

function ensureCurrentCatalog() {
  const current = normalizeEmail(getCurrentUser());
  if (!current) return;
  if (current !== catalogLoadedOwner) loadCatalog(current);
}

export const flexibleSet = {
  init(options = {}) {
    if (typeof options.getCurrentUser === 'function') getCurrentUser = options.getCurrentUser;
    if (typeof options.getExerciseCatalog === 'function') getExerciseCatalog = options.getExerciseCatalog;
    if (initialized) return;
    initialized = true;

    const list = document.getElementById('workout-list');
    if (!list) return;

    list.addEventListener('change', (event) => {
      const setType = event.target.closest('.js-set-type');
      if (setType) {
        const row = setType.closest('.js-set-row');
        if (row) row.dataset.setType = setType.value === 'warmup' ? 'warmup' : 'working';
      }
    });

    list.addEventListener('input', (event) => {
      const duration = event.target.closest('.js-duration-input');
      if (duration) {
        const row = duration.closest('.js-set-row');
        if (row) row.dataset.durationSec = duration.value || '';
      }
    });

    const observer = new MutationObserver(() => {
      ensureCurrentCatalog();
      decorateAll();
    });
    observer.observe(list, { childList: true, subtree: true });
    decorateAll();
  },

  loadCatalog,

  enrichWorkoutData(legacyData) {
    ensureCurrentCatalog();
    const selectedDate = document.getElementById('workout-date-input')?.value || '';
    return enrichWorkoutData(legacyData, collectDescriptors(), buildWorkoutDate(selectedDate));
  },

  refresh() {
    ensureCurrentCatalog();
    decorateAll();
  },
};

export const flexibleSetInternals = {
  DEFAULT_METADATA,
  normalizeEmail,
  normalizeMetadata,
  buildWorkoutDate,
  descriptorKey,
  enrichWorkoutData,
};
