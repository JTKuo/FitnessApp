const INPUT_SELECTOR = '.js-weight-input, .js-reps-input';
const PANEL_ID = 'workout-numeric-input-panel';

const CONFIG = {
  weight: {
    label: '重量',
    max: 1000,
    decimals: 2,
    steps: [-5, -2.5, -1.25, 1.25, 2.5, 5],
  },
  reps: {
    label: '次數',
    max: 999,
    decimals: 0,
    steps: [-5, -1, 1, 5],
  },
};

let initialized = false;
let panel = null;
let activeInput = null;
let activeKind = null;
let buffer = '';
let initialValue = '';
let previousBodyOverflow = '';

function getKind(input) {
  if (input?.classList?.contains('js-weight-input')) return 'weight';
  if (input?.classList?.contains('js-reps-input')) return 'reps';
  return null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function stripTrailingZeros(value) {
  return String(value)
    .replace(/(\.\d*?[1-9])0+$/, '$1')
    .replace(/\.0+$/, '');
}

function formatNumericValue(value, kind) {
  const config = CONFIG[kind];
  const numeric = Number(value);
  if (!config || !Number.isFinite(numeric)) return '';

  const bounded = clamp(numeric, 0, config.max);
  if (config.decimals === 0) return String(Math.round(bounded));

  return stripTrailingZeros(bounded.toFixed(config.decimals));
}

function appendDigit(currentBuffer, digit, kind) {
  const config = CONFIG[kind];
  if (!config || !/^\d$/.test(String(digit))) return currentBuffer;

  let next = String(currentBuffer || '');
  if (next === '0') next = '';

  if (next.includes('.')) {
    const decimalPart = next.split('.')[1] || '';
    if (decimalPart.length >= config.decimals) return currentBuffer;
  }

  next += String(digit);
  const numeric = Number(next);
  if (Number.isFinite(numeric) && numeric > config.max) return currentBuffer;
  return next;
}

function appendDecimal(currentBuffer, kind) {
  const config = CONFIG[kind];
  if (!config || config.decimals === 0) return currentBuffer;

  const current = String(currentBuffer || '');
  if (current.includes('.')) return current;
  return current ? `${current}.` : '0.';
}

function backspaceBuffer(currentBuffer) {
  const current = String(currentBuffer || '');
  return current.slice(0, -1);
}

function adjustedValue(currentValue, delta, kind) {
  const config = CONFIG[kind];
  if (!config) return '';

  const current = Number.parseFloat(currentValue);
  const base = Number.isFinite(current) ? current : 0;
  const next = clamp(base + Number(delta || 0), 0, config.max);
  return formatNumericValue(next, kind);
}

function valueFromBuffer(currentBuffer, kind) {
  const current = String(currentBuffer || '');
  if (!current || current === '.') return '';

  const numeric = Number.parseFloat(current);
  return Number.isFinite(numeric) ? formatNumericValue(numeric, kind) : '';
}

function dispatchValueEvent(input, type) {
  input?.dispatchEvent(new Event(type, { bubbles: true }));
}

function commitBuffer() {
  if (!activeInput || !activeKind) return;
  const nextValue = valueFromBuffer(buffer, activeKind);
  if (activeInput.value === nextValue) return;

  activeInput.value = nextValue;
  dispatchValueEvent(activeInput, 'input');
}

function getDisplayValue() {
  return buffer || '0';
}

function applyKey(key) {
  if (!activeInput || !activeKind) return false;

  if (/^\d$/.test(key)) {
    buffer = appendDigit(buffer, key, activeKind);
  } else if (key === '.') {
    buffer = appendDecimal(buffer, activeKind);
  } else if (key === 'Backspace') {
    buffer = backspaceBuffer(buffer);
  } else {
    return false;
  }

  commitBuffer();
  renderPanel();
  return true;
}

function buildStepButtons(kind) {
  const config = CONFIG[kind];
  if (!config) return '';

  return config.steps.map((step) => {
    const label = step > 0 ? `+${stripTrailingZeros(step)}` : stripTrailingZeros(step);
    return `<button type="button" data-action="adjust" data-delta="${step}" class="min-h-11 rounded-lg border border-gray-600 bg-gray-800 px-2 text-sm font-semibold text-gray-200 active:bg-yellow-500 active:text-black">${label}</button>`;
  }).join('');
}

function renderPanel() {
  if (!panel || !activeKind) return;

  const config = CONFIG[activeKind];
  const title = panel.querySelector('[data-numeric-title]');
  const display = panel.querySelector('[data-numeric-display]');
  const stepContainer = panel.querySelector('[data-numeric-steps]');
  const decimalButton = panel.querySelector('[data-key="."]');

  if (title) title.textContent = config.label;
  if (display) display.textContent = getDisplayValue();
  if (stepContainer) {
    stepContainer.innerHTML = buildStepButtons(activeKind);
    stepContainer.className = activeKind === 'weight'
      ? 'grid grid-cols-6 gap-1.5 mb-3'
      : 'grid grid-cols-4 gap-2 mb-3';
  }
  if (decimalButton) {
    decimalButton.disabled = activeKind !== 'weight';
    decimalButton.classList.toggle('opacity-30', activeKind !== 'weight');
  }
}

function createPanel() {
  if (panel) return panel;

  const wrapper = document.createElement('div');
  wrapper.id = PANEL_ID;
  wrapper.className = 'hidden fixed inset-0 z-[70]';
  wrapper.innerHTML = `
    <button type="button" data-action="done" class="absolute inset-0 h-full w-full bg-black/70" aria-label="關閉數字輸入"></button>
    <section role="dialog" aria-modal="true" aria-label="訓練數字輸入" class="absolute bottom-0 left-1/2 max-h-[92vh] w-full max-w-lg -translate-x-1/2 overflow-y-auto rounded-t-2xl border border-gray-700 bg-[#1c1a19] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
      <div class="mb-3 flex items-center justify-between">
        <div>
          <p class="text-xs text-gray-500">快速輸入</p>
          <h3 data-numeric-title class="text-lg font-bold text-yellow-400">重量</h3>
        </div>
        <button type="button" data-action="done" class="rounded-lg p-2 text-2xl text-gray-400 active:bg-gray-800" aria-label="完成輸入">
          <ion-icon name="close-outline" class="pointer-events-none"></ion-icon>
        </button>
      </div>

      <div data-numeric-display class="mb-3 rounded-xl border border-yellow-500/40 bg-black/40 px-4 py-3 text-center font-mono text-4xl font-bold text-white">0</div>
      <div data-numeric-steps class="mb-3"></div>

      <div class="grid grid-cols-3 gap-2">
        ${['1','2','3','4','5','6','7','8','9'].map((key) => `<button type="button" data-action="key" data-key="${key}" class="min-h-14 rounded-xl border border-gray-700 bg-gray-800 text-2xl font-semibold active:bg-gray-700">${key}</button>`).join('')}
        <button type="button" data-action="key" data-key="." class="min-h-14 rounded-xl border border-gray-700 bg-gray-800 text-2xl font-semibold active:bg-gray-700">.</button>
        <button type="button" data-action="key" data-key="0" class="min-h-14 rounded-xl border border-gray-700 bg-gray-800 text-2xl font-semibold active:bg-gray-700">0</button>
        <button type="button" data-action="backspace" class="min-h-14 rounded-xl border border-gray-700 bg-gray-800 text-2xl text-gray-300 active:bg-gray-700" aria-label="退格">
          <ion-icon name="backspace-outline" class="pointer-events-none"></ion-icon>
        </button>
      </div>

      <div class="mt-3 grid grid-cols-2 gap-2">
        <button type="button" data-action="clear" class="min-h-12 rounded-xl border border-gray-600 bg-gray-900 font-semibold text-gray-300 active:bg-gray-800">清除</button>
        <button type="button" data-action="done" class="min-h-12 rounded-xl border border-yellow-400 bg-yellow-500 font-bold text-black active:bg-yellow-600">完成</button>
      </div>
    </section>
  `;

  document.body.appendChild(wrapper);
  panel = wrapper;

  panel.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    if (action === 'done') {
      workoutNumericInput.close();
      return;
    }

    if (!activeInput || !activeKind) return;

    if (action === 'key') {
      applyKey(button.dataset.key);
      return;
    }

    if (action === 'backspace') {
      applyKey('Backspace');
      return;
    }

    if (action === 'clear') {
      buffer = '';
      commitBuffer();
      renderPanel();
      return;
    }

    if (action === 'adjust') {
      buffer = adjustedValue(buffer || activeInput.value, Number(button.dataset.delta), activeKind);
      commitBuffer();
      renderPanel();
    }
  });

  return panel;
}

function decorateInput(input) {
  if (!input || input.dataset.numericInputReady === 'true') return;
  input.dataset.numericInputReady = 'true';
  input.readOnly = true;
  input.inputMode = 'none';
  input.setAttribute('aria-haspopup', 'dialog');
  input.setAttribute('autocomplete', 'off');
  if (!input.getAttribute('aria-label')) {
    input.setAttribute('aria-label', getKind(input) === 'weight' ? '重量' : '次數');
  }
}

function decorateWorkoutInputs(root = document) {
  root.querySelectorAll?.(INPUT_SELECTOR).forEach(decorateInput);
}

export const workoutNumericInput = {
  init() {
    if (initialized) return;
    initialized = true;

    createPanel();
    const workoutList = document.getElementById('workout-list');
    if (!workoutList) return;

    decorateWorkoutInputs(workoutList);

    workoutList.addEventListener('click', (event) => {
      const input = event.target.closest(INPUT_SELECTOR);
      if (!input) return;
      event.preventDefault();
      this.open(input);
    });

    const observer = new MutationObserver(() => {
      decorateWorkoutInputs(workoutList);
      if (activeInput && !document.contains(activeInput)) this.close();
    });
    observer.observe(workoutList, { childList: true, subtree: true });

    document.addEventListener('keydown', (event) => {
      if (!activeInput) return;

      if (event.key === 'Escape' || event.key === 'Enter') {
        event.preventDefault();
        this.close();
        return;
      }

      if (/^\d$/.test(event.key) || event.key === '.' || event.key === 'Backspace') {
        event.preventDefault();
        applyKey(event.key);
      }
    });
  },

  open(input) {
    const kind = getKind(input);
    if (!kind) return false;

    decorateInput(input);
    activeInput = input;
    activeKind = kind;
    buffer = input.value || '';
    initialValue = input.value || '';

    input.blur();
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    createPanel().classList.remove('hidden');
    renderPanel();
    return true;
  },

  close() {
    if (!panel || !activeInput) return false;

    const changedInput = activeInput;
    const changed = changedInput.value !== initialValue;

    panel.classList.add('hidden');
    document.body.style.overflow = previousBodyOverflow;

    activeInput = null;
    activeKind = null;
    buffer = '';
    initialValue = '';

    if (changed) dispatchValueEvent(changedInput, 'change');
    return true;
  },
};

export const workoutNumericInputInternals = {
  CONFIG,
  getKind,
  clamp,
  stripTrailingZeros,
  formatNumericValue,
  appendDigit,
  appendDecimal,
  backspaceBuffer,
  adjustedValue,
  valueFromBuffer,
};
