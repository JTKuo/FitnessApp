const STORAGE_PREFIX = 'fitnessapp_workout_draft:';
const DRAFT_VERSION = 1;
const SAVE_DEBOUNCE_MS = 500;
const USER_SWITCH_TIMEOUT_MS = 120000;

let initialized = false;
let paused = false;
let restoring = false;
let saveTimer = null;
let switchWatchTimer = null;

let getCurrentUser = () => null;
let onRestored = () => {};
let recalculateVolumes = () => {};

const committedFingerprints = new Map();

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function storageKey(email) {
  const normalized = normalizeEmail(email);
  return normalized ? `${STORAGE_PREFIX}${normalized}` : null;
}

function readStorage(key) {
  if (!key) return null;
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.warn('[WorkoutDraft] 無法讀取 localStorage', err);
    return null;
  }
}

function writeStorage(key, value) {
  if (!key) return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn('[WorkoutDraft] 無法寫入 localStorage', err);
    return false;
  }
}

function removeStorage(key) {
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn('[WorkoutDraft] 無法清除 localStorage', err);
  }
}

function collectDraftPayload() {
  const workoutList = document.getElementById('workout-list');
  const dateInput = document.getElementById('workout-date-input');
  const sessionNoteInput = document.getElementById('workout-session-note');
  if (!workoutList) return null;

  const exercises = [...workoutList.querySelectorAll('.card')]
    .map((card) => {
      const name = card.querySelector('h3')?.textContent?.trim() || '';
      const note = card.querySelector('.js-exercise-note')?.value || '';
      const sets = [...card.querySelectorAll('.js-set-row')].map((set) => ({
        weight: set.querySelector('.js-weight-input')?.value || '',
        reps: set.querySelector('.js-reps-input')?.value || '',
        unit: set.querySelector('.js-unit-select')?.value || '公斤',
        setType: set.querySelector('.js-set-type')?.value || set.dataset.setType || 'working',
        durationSec: set.querySelector('.js-duration-input')?.value || set.dataset.durationSec || '',
        trackingType: set.dataset.trackingType || 'weight_reps',
      }));

      return { name, note, sets };
    })
    .filter((exercise) => exercise.name);

  return {
    version: DRAFT_VERSION,
    date: dateInput?.value || '',
    sessionNote: sessionNoteInput?.value || '',
    exercises,
  };
}

function hasDraftContent(payload) {
  return Boolean(payload && (
    (Array.isArray(payload.exercises) && payload.exercises.length > 0) ||
    String(payload.sessionNote || '').trim()
  ));
}

function fingerprint(payload) {
  if (!payload) return '';
  return JSON.stringify({
    version: payload.version,
    date: payload.date,
    sessionNote: payload.sessionNote || '',
    exercises: payload.exercises,
  });
}

function buildStoredDraft(payload) {
  return {
    ...payload,
    savedAt: new Date().toISOString(),
  };
}

function createSetFragment(setData, setNumber) {
  const template = document.getElementById('set-row-template');
  if (!template) return null;

  const fragment = document.importNode(template.content, true);
  const setRow = fragment.querySelector('.js-set-row');
  const setNumberEl = fragment.querySelector('.js-set-number');
  const weightInput = fragment.querySelector('.js-weight-input');
  const repsInput = fragment.querySelector('.js-reps-input');
  const unitSelect = fragment.querySelector('.js-unit-select');

  if (setNumberEl) setNumberEl.textContent = `SET ${setNumber}`;
  if (weightInput) weightInput.value = setData?.weight ?? '';
  if (repsInput) repsInput.value = setData?.reps ?? '';
  if (unitSelect) unitSelect.value = setData?.unit || '公斤';
  if (setRow) {
    setRow.dataset.setType = setData?.setType === 'warmup' ? 'warmup' : 'working';
    setRow.dataset.durationSec = setData?.durationSec ?? '';
    setRow.dataset.trackingType = setData?.trackingType || 'weight_reps';
  }

  return fragment;
}

function createExerciseCard(exercise) {
  const exerciseTemplate = document.getElementById('exercise-card-template');
  if (!exerciseTemplate) return null;

  const fragment = document.importNode(exerciseTemplate.content, true);
  const card = fragment.querySelector('.card');
  if (!card) return null;

  card.id = `exercise-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  card.classList.add('animated-item', 'fade-in', 'is-visible');

  const title = card.querySelector('h3');
  if (title) title.textContent = exercise.name || '';

  const noteInput = card.querySelector('.js-exercise-note');
  if (noteInput) noteInput.value = exercise.note || '';

  const performanceEl = card.querySelector('.js-last-performance');
  if (performanceEl) performanceEl.textContent = '已恢復草稿';

  const setsContainer = card.querySelector('.js-sets-container');
  if (setsContainer) {
    setsContainer.innerHTML = '';
    const sets = Array.isArray(exercise.sets) && exercise.sets.length > 0
      ? exercise.sets
      : [{ weight: '', reps: '', unit: '公斤', setType: 'working', durationSec: '' }];

    sets.forEach((setData, index) => {
      const setFragment = createSetFragment(setData, index + 1);
      if (setFragment) setsContainer.appendChild(setFragment);
    });
  }

  return { fragment, card };
}

function parseStoredDraft(raw, key) {
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw);
    if (!draft || draft.version !== DRAFT_VERSION || !Array.isArray(draft.exercises)) {
      removeStorage(key);
      return null;
    }
    return draft;
  } catch (err) {
    console.warn('[WorkoutDraft] 草稿格式損毀，已忽略', err);
    removeStorage(key);
    return null;
  }
}

function finishUserSwitchWatch(targetEmail, previousEmail, startedAt) {
  const loadingOverlay = document.getElementById('loading-overlay');
  const currentEmail = normalizeEmail(getCurrentUser());
  const target = normalizeEmail(targetEmail);
  const previous = normalizeEmail(previousEmail);
  const isLoading = loadingOverlay?.style.display === 'flex';
  const completed = !isLoading && (currentEmail === target || currentEmail === previous);
  const timedOut = Date.now() - startedAt >= USER_SWITCH_TIMEOUT_MS;

  if (!completed && !timedOut) return false;

  if (timedOut) {
    console.warn('[WorkoutDraft] 等待管理員切換使用者逾時，恢復自動保存。');
  } else {
    workoutDraft.restore();
  }

  workoutDraft.resume();
  return true;
}

export const workoutDraft = {
  init(options = {}) {
    if (typeof options.getCurrentUser === 'function') getCurrentUser = options.getCurrentUser;
    if (typeof options.onRestored === 'function') onRestored = options.onRestored;
    if (typeof options.recalculateVolumes === 'function') recalculateVolumes = options.recalculateVolumes;

    if (initialized) return;
    initialized = true;

    const workoutList = document.getElementById('workout-list');
    const dateInput = document.getElementById('workout-date-input');
    const sessionNoteInput = document.getElementById('workout-session-note');
    const userSwitcher = document.getElementById('user-switcher');

    if (workoutList) {
      workoutList.addEventListener('input', () => this.scheduleSave());
      workoutList.addEventListener('change', () => this.scheduleSave());

      const observer = new MutationObserver(() => this.scheduleSave());
      observer.observe(workoutList, { childList: true, subtree: true });
    }

    if (dateInput) {
      dateInput.addEventListener('input', () => this.scheduleSave());
      dateInput.addEventListener('change', () => this.scheduleSave());
    }

    if (sessionNoteInput) {
      sessionNoteInput.addEventListener('input', () => this.scheduleSave());
      sessionNoteInput.addEventListener('change', () => this.scheduleSave());
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.saveNow();
    });
    window.addEventListener('pagehide', () => this.saveNow());

    // Admin 切換學員時，舊畫面會先被 clearWorkoutLog() 清掉。
    // capture phase 先保存並暫停 observer，等 switchUser 完成後再恢復新使用者草稿。
    if (userSwitcher) {
      userSwitcher.addEventListener('change', (event) => {
        const targetEmail = event.target.value;
        const previousEmail = getCurrentUser();

        this.saveNow();
        this.pause();

        if (switchWatchTimer) clearInterval(switchWatchTimer);
        const startedAt = Date.now();
        setTimeout(() => {
          switchWatchTimer = setInterval(() => {
            if (finishUserSwitchWatch(targetEmail, previousEmail, startedAt)) {
              clearInterval(switchWatchTimer);
              switchWatchTimer = null;
            }
          }, 100);
        }, 0);
      }, true);
    }
  },

  scheduleSave() {
    if (paused || restoring) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      this.saveNow();
    }, SAVE_DEBOUNCE_MS);
  },

  saveNow() {
    if (paused || restoring) return false;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }

    const email = normalizeEmail(getCurrentUser());
    const key = storageKey(email);
    const payload = collectDraftPayload();
    if (!key || !payload) return false;

    if (!hasDraftContent(payload)) {
      committedFingerprints.delete(email);
      removeStorage(key);
      return true;
    }

    const currentFingerprint = fingerprint(payload);
    if (committedFingerprints.get(email) === currentFingerprint) {
      removeStorage(key);
      return true;
    }

    return writeStorage(key, JSON.stringify(buildStoredDraft(payload)));
  },

  restore() {
    const email = normalizeEmail(getCurrentUser());
    const key = storageKey(email);
    const draft = parseStoredDraft(readStorage(key), key);
    const workoutList = document.getElementById('workout-list');

    if (!draft || !workoutList || !hasDraftContent(draft)) return false;

    restoring = true;
    try {
      const dateInput = document.getElementById('workout-date-input');
      if (dateInput && draft.date) dateInput.value = draft.date;

      const sessionNoteInput = document.getElementById('workout-session-note');
      if (sessionNoteInput) sessionNoteInput.value = draft.sessionNote || '';

      workoutList.innerHTML = '';
      draft.exercises.forEach((exercise) => {
        const created = createExerciseCard(exercise);
        if (created) workoutList.appendChild(created.fragment);
      });

      recalculateVolumes();
      onRestored(draft);
      return true;
    } finally {
      restoring = false;
    }
  },

  captureCommitContext() {
    const email = normalizeEmail(getCurrentUser());
    const payload = collectDraftPayload();
    return {
      email,
      fingerprint: hasDraftContent(payload) ? fingerprint(payload) : '',
    };
  },

  markCommitted(context = null) {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }

    const email = normalizeEmail(context?.email || getCurrentUser());
    const key = storageKey(email);
    if (!email || !key) return;

    let committedFingerprint = context?.fingerprint || '';
    if (!committedFingerprint) {
      const payload = collectDraftPayload();
      if (hasDraftContent(payload)) committedFingerprint = fingerprint(payload);
    }

    if (committedFingerprint) committedFingerprints.set(email, committedFingerprint);
    else committedFingerprints.delete(email);
    removeStorage(key);
  },

  clear(emailOverride = null) {
    const email = normalizeEmail(emailOverride || getCurrentUser());
    committedFingerprints.delete(email);
    removeStorage(storageKey(email));
  },

  pause() {
    paused = true;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
  },

  resume() {
    paused = false;
  },
};

export const workoutDraftInternals = {
  normalizeEmail,
  storageKey,
  fingerprint,
  hasDraftContent,
};
