const STORAGE_PREFIX = 'fitnessapp_rest_timer:';
const TICK_INTERVAL_MS = 250;
const USER_SWITCH_TIMEOUT_MS = 120000;
const RECENT_EXPIRY_NOTIFY_MS = 5 * 60 * 1000;

let initialized = false;
let endsAt = null;
let ticker = null;
let switchWatchTimer = null;

let getCurrentUser = () => null;
let onFinished = () => {};
let onInvalidComplete = () => {};
let defaultRestSeconds = 30;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function storageKey(email) {
  const normalized = normalizeEmail(email);
  return normalized ? `${STORAGE_PREFIX}${normalized}` : null;
}

function remainingSeconds(targetEndsAt, now = Date.now()) {
  const target = Number(targetEndsAt);
  if (!Number.isFinite(target)) return 0;
  return Math.max(0, Math.ceil((target - now) / 1000));
}

function adjustedEndsAt(targetEndsAt, deltaSeconds, now = Date.now()) {
  const base = Number(targetEndsAt);
  if (!Number.isFinite(base)) return null;
  return Math.max(now, base + Number(deltaSeconds || 0) * 1000);
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(safeSeconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(safeSeconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function isUserSwitchSettled(currentEmail, targetEmail, previousEmail, isLoading) {
  if (isLoading) return false;
  const current = normalizeEmail(currentEmail);
  const target = normalizeEmail(targetEmail);
  const previous = normalizeEmail(previousEmail);
  return Boolean(current && (current === target || current === previous));
}

function getTimerBar() {
  return document.getElementById('rest-timer-bar');
}

function getDisplay() {
  return document.getElementById('timer-display');
}

function showTimerBar(show) {
  getTimerBar()?.classList.toggle('hidden', !show);
}

function updateDisplay(seconds) {
  const display = getDisplay();
  if (display) display.textContent = formatTime(seconds);
}

function readStorage(key) {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Number.isFinite(Number(parsed?.endsAt)) ? Number(parsed.endsAt) : null;
  } catch (err) {
    console.warn('[RestTimer] 無法讀取 timer 狀態', err);
    return null;
  }
}

function writeStorage(key, value) {
  if (!key) return false;
  try {
    localStorage.setItem(key, JSON.stringify({ endsAt: value }));
    return true;
  } catch (err) {
    console.warn('[RestTimer] 無法保存 timer 狀態', err);
    return false;
  }
}

function removeStorage(key) {
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn('[RestTimer] 無法清除 timer 狀態', err);
  }
}

function currentStorageKey() {
  return storageKey(getCurrentUser());
}

function stopTicker() {
  if (ticker) {
    clearInterval(ticker);
    ticker = null;
  }
}

function notifyFinished() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([180, 100, 180]);
    }
  } catch (_) {
    // vibration 不是必要功能，失敗時直接忽略。
  }
  onFinished();
}

function setCompleteButtonState(button, completed) {
  if (!button) return;
  button.dataset.completed = completed ? 'true' : 'false';
  button.setAttribute('aria-pressed', completed ? 'true' : 'false');
  button.setAttribute('aria-label', completed ? '取消完成此組' : '完成此組並開始休息');
  button.title = completed ? '取消完成' : '完成此組並開始休息';
  button.classList.toggle('text-green-400', completed);
  button.classList.toggle('border-green-500/50', completed);
  button.classList.toggle('bg-green-500/10', completed);
  button.classList.toggle('text-gray-500', !completed);
  button.innerHTML = `<ion-icon name="${completed ? 'checkmark-circle' : 'checkmark-circle-outline'}" class="text-xl pointer-events-none"></ion-icon>`;
}

function ensureCompleteButtons() {
  document.querySelectorAll('#workout-list .js-set-row').forEach((setRow) => {
    if (setRow.querySelector('.js-complete-set')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'js-complete-set flex-shrink-0 p-1 rounded-md border border-transparent text-gray-500 hover:text-green-400 transition-colors duration-200';
    setCompleteButtonState(button, false);

    const deleteButton = setRow.querySelector('.js-delete-set');
    if (deleteButton) setRow.insertBefore(button, deleteButton);
    else setRow.appendChild(button);
  });
}

function setHasWorkoutData(setRow) {
  const weight = parseFloat(setRow.querySelector('.js-weight-input')?.value || '0') || 0;
  const reps = parseInt(setRow.querySelector('.js-reps-input')?.value || '0', 10) || 0;
  const duration = parseInt(setRow.querySelector('.js-duration-input')?.value || '0', 10) || 0;
  return weight > 0 || reps > 0 || duration > 0;
}

function finishUserSwitchWatch(targetEmail, previousEmail, startedAt) {
  const loadingOverlay = document.getElementById('loading-overlay');
  const currentEmail = getCurrentUser();
  const isLoading = loadingOverlay?.style.display === 'flex';
  const completed = isUserSwitchSettled(currentEmail, targetEmail, previousEmail, isLoading);
  const timedOut = Date.now() - startedAt >= USER_SWITCH_TIMEOUT_MS;

  if (!completed && !timedOut) return false;

  if (timedOut) {
    console.warn('[RestTimer] 等待管理員切換使用者逾時。');
  }

  // 成功切到目標使用者或切換失敗回到原使用者，都恢復「目前使用者」自己的 timer。
  restTimer.restore();
  return true;
}

export const restTimer = {
  init(options = {}) {
    if (typeof options.getCurrentUser === 'function') getCurrentUser = options.getCurrentUser;
    if (typeof options.onFinished === 'function') onFinished = options.onFinished;
    if (typeof options.onInvalidComplete === 'function') onInvalidComplete = options.onInvalidComplete;
    if (Number.isFinite(Number(options.defaultRestSeconds)) && Number(options.defaultRestSeconds) > 0) {
      defaultRestSeconds = Number(options.defaultRestSeconds);
    }

    if (initialized) return;
    initialized = true;

    const workoutList = document.getElementById('workout-list');
    if (workoutList) {
      ensureCompleteButtons();
      const observer = new MutationObserver(() => ensureCompleteButtons());
      observer.observe(workoutList, { childList: true, subtree: true });

      workoutList.addEventListener('click', (event) => {
        const button = event.target.closest('.js-complete-set');
        if (!button) return;

        const setRow = button.closest('.js-set-row');
        if (!setRow) return;

        const currentlyCompleted = button.dataset.completed === 'true';
        if (currentlyCompleted) {
          setCompleteButtonState(button, false);
          return;
        }

        if (!setHasWorkoutData(setRow)) {
          onInvalidComplete();
          return;
        }

        setCompleteButtonState(button, true);
        this.start(defaultRestSeconds);
      });
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        stopTicker();
        return;
      }
      this.restore();
    });

    window.addEventListener('pageshow', () => this.restore());
    window.addEventListener('pagehide', () => stopTicker());

    const userSwitcher = document.getElementById('user-switcher');
    if (userSwitcher) {
      userSwitcher.addEventListener('change', (event) => {
        // 保留舊使用者的 timestamp，只把目前畫面停掉；切回去時仍可依絕對時間恢復。
        stopTicker();
        endsAt = null;
        showTimerBar(false);

        if (switchWatchTimer) clearInterval(switchWatchTimer);
        const targetEmail = event.target.value;
        const previousEmail = getCurrentUser();
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

  start(seconds = defaultRestSeconds) {
    const duration = Math.max(1, Number(seconds) || defaultRestSeconds);
    const key = currentStorageKey();
    if (!key) return false;

    endsAt = Date.now() + duration * 1000;
    writeStorage(key, endsAt);
    showTimerBar(true);
    this.sync();
    this.startTicker();
    return true;
  },

  adjust(deltaSeconds) {
    if (!endsAt) {
      endsAt = readStorage(currentStorageKey());
      if (!endsAt) return false;
    }

    endsAt = adjustedEndsAt(endsAt, deltaSeconds);
    if (!endsAt || remainingSeconds(endsAt) <= 0) {
      this.finish();
      return true;
    }

    writeStorage(currentStorageKey(), endsAt);
    this.sync();
    return true;
  },

  sync() {
    if (!endsAt) return 0;
    const seconds = remainingSeconds(endsAt);
    updateDisplay(seconds);

    if (seconds <= 0) {
      this.finish();
      return 0;
    }

    showTimerBar(true);
    return seconds;
  },

  startTicker() {
    stopTicker();
    ticker = setInterval(() => this.sync(), TICK_INTERVAL_MS);
  },

  restore() {
    const key = currentStorageKey();
    if (!key) return false;

    const storedEndsAt = readStorage(key);
    if (!storedEndsAt) {
      endsAt = null;
      stopTicker();
      showTimerBar(false);
      return false;
    }

    if (remainingSeconds(storedEndsAt) <= 0) {
      const expiredAgoMs = Date.now() - storedEndsAt;
      endsAt = null;
      stopTicker();
      removeStorage(key);
      updateDisplay(0);
      showTimerBar(false);
      if (expiredAgoMs >= 0 && expiredAgoMs <= RECENT_EXPIRY_NOTIFY_MS) notifyFinished();
      return false;
    }

    endsAt = storedEndsAt;
    this.sync();
    this.startTicker();
    return true;
  },

  finish() {
    const key = currentStorageKey();
    stopTicker();
    endsAt = null;
    removeStorage(key);
    updateDisplay(0);
    showTimerBar(false);
    notifyFinished();
  },

  stop() {
    stopTicker();
    endsAt = null;
    removeStorage(currentStorageKey());
    showTimerBar(false);
  },
};

export const restTimerInternals = {
  normalizeEmail,
  storageKey,
  remainingSeconds,
  adjustedEndsAt,
  formatTime,
  isUserSwitchSettled,
};
