from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing patch anchor: {label}')
    return text.replace(old, new, 1)

# --- index.html: replace workout card + set row templates ---
index_path = Path('web/index.html')
index = index_path.read_text(encoding='utf-8')
start = index.index('    <template id="exercise-card-template">')
end = index.index('    <script type="module" src="/src/main.js"></script>', start)
new_templates = '''    <template id="exercise-card-template">
        <div class="card workout-exercise-card p-4 rounded-2xl">
            <div class="flex items-center justify-between gap-3 mb-2">
                <div class="flex min-w-0 items-center gap-2">
                    <ion-icon name="menu-outline" class="js-drag-handle text-2xl text-gray-600 cursor-grab flex-shrink-0"></ion-icon>
                    <h3 class="truncate text-lg font-semibold text-yellow-400"></h3>
                </div>
                <button class="js-delete-exercise workout-icon-button text-red-500/80" aria-label="刪除動作">
                    <ion-icon name="close-outline" class="text-2xl pointer-events-none"></ion-icon>
                </button>
            </div>

            <div class="workout-card-summary mb-3">
                <p class="js-last-performance min-w-0 truncate text-sm text-yellow-300/80">查詢中...</p>
                <div class="flex flex-shrink-0 items-baseline gap-1.5">
                    <span class="text-[11px] text-gray-500">容量</span>
                    <p class="js-volume-display text-base font-semibold text-gray-100">0 公斤</p>
                </div>
            </div>

            <div class="js-sets-container space-y-1"></div>

            <div class="mt-3">
                <textarea class="js-exercise-note workout-note w-full resize-none rounded-xl px-3 py-2 text-sm" rows="2" placeholder="備註（選填）"></textarea>
            </div>

            <div class="workout-card-actions mt-3">
                <button class="js-start-timer workout-action workout-action-primary" type="button">
                    <ion-icon name="timer-outline" class="text-lg pointer-events-none"></ion-icon>
                    <span>休息</span>
                </button>
                <button class="js-copy-set workout-action workout-action-secondary" type="button">
                    <ion-icon name="copy-outline" class="text-lg pointer-events-none"></ion-icon>
                    <span>複製</span>
                </button>
                <button class="js-add-set workout-action workout-action-secondary" type="button">
                    <ion-icon name="add-outline" class="text-xl pointer-events-none"></ion-icon>
                    <span>新增組</span>
                </button>
            </div>
        </div>
    </template>

    <template id="set-row-template">
        <div class="js-set-row workout-set-row relative">
            <span class="js-pr-badge hidden absolute -left-1 -top-1 z-10 rounded-full bg-yellow-400 px-2 py-0.5 text-xs font-bold text-black shadow-md animate-pulse"></span>

            <div class="workout-set-meta">
                <span class="js-set-number workout-set-number">1</span>
                <button type="button" class="js-set-type-toggle workout-set-type-toggle" data-set-type="working" aria-pressed="false" aria-label="目前為工作組，點擊切換為熱身組">
                    <span class="set-type-working inline-flex items-center gap-1">
                        <ion-icon name="ellipse-outline" class="text-xs pointer-events-none"></ion-icon>
                        <span>工作</span>
                    </span>
                    <span class="set-type-warmup inline-flex items-center gap-1">
                        <ion-icon name="flame-outline" class="text-sm pointer-events-none"></ion-icon>
                        <span>熱身</span>
                    </span>
                </button>
            </div>

            <div class="workout-set-inputs">
                <div class="workout-number-field">
                    <input type="number" min="0" class="js-weight-input workout-set-input" aria-label="重量">
                    <select class="js-unit-select workout-unit-select" aria-label="重量單位">
                        <option value="公斤">kg</option>
                        <option value="磅">lb</option>
                    </select>
                </div>

                <span class="workout-multiply" aria-hidden="true">×</span>

                <div class="workout-number-field">
                    <input type="number" min="0" class="js-reps-input workout-set-input" aria-label="次數">
                    <span class="workout-field-suffix">次</span>
                </div>
            </div>

            <button class="js-delete-set workout-icon-button workout-delete-set" type="button" aria-label="刪除此組">
                <ion-icon name="trash-outline" class="text-lg pointer-events-none"></ion-icon>
            </button>
        </div>
    </template>

'''
index = index[:start] + new_templates + index[end:]
index_path.write_text(index, encoding='utf-8')

# --- scoped visual system ---
style_path = Path('web/src/style.css')
style = style_path.read_text(encoding='utf-8')
marker = '/* --- Workout Set Row Redesign --- */'
if marker in style:
    raise SystemExit('workout set row redesign styles already exist')
style += r'''

/* --- Workout Set Row Redesign --- */
.workout-exercise-card {
    border-color: rgba(255, 255, 255, 0.08);
    background: rgba(12, 11, 10, 0.84);
    box-shadow: 0 14px 36px rgba(0, 0, 0, 0.22);
}

.workout-card-summary {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    padding-bottom: 0.65rem;
}

.workout-set-row {
    display: grid;
    grid-template-columns: 3.25rem minmax(0, 1fr) 2rem;
    align-items: center;
    gap: 0.5rem;
    min-height: 3.5rem;
    padding: 0.35rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.055);
}

.workout-set-row:last-child {
    border-bottom-color: transparent;
}

.workout-set-meta {
    display: flex;
    min-width: 0;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.1rem;
}

.workout-set-number {
    color: #9ca3af;
    font-size: 0.8rem;
    font-weight: 700;
    line-height: 1;
}

.workout-set-type-toggle {
    min-height: 1.55rem;
    border: 0;
    border-radius: 9999px;
    background: transparent;
    padding: 0.15rem 0.38rem;
    color: #8b949e;
    font-size: 0.68rem;
    font-weight: 700;
    line-height: 1;
    transition: background-color 160ms ease, color 160ms ease, transform 160ms ease;
}

.workout-set-type-toggle:active {
    transform: scale(0.94);
}

.workout-set-type-toggle .set-type-warmup {
    display: none;
}

.workout-set-type-toggle[data-set-type="warmup"] {
    background: rgba(255, 195, 0, 0.10);
    color: #f8c846;
}

.workout-set-type-toggle[data-set-type="warmup"] .set-type-working {
    display: none;
}

.workout-set-type-toggle[data-set-type="warmup"] .set-type-warmup {
    display: inline-flex;
}

.workout-set-inputs {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) 0.8rem minmax(0, 0.85fr);
    align-items: center;
    gap: 0.35rem;
    min-width: 0;
}

.workout-number-field {
    display: flex;
    min-width: 0;
    min-height: 2.8rem;
    align-items: center;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 0.75rem;
    background: rgba(255, 255, 255, 0.035);
    transition: border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease;
}

.workout-number-field:focus-within {
    border-color: rgba(255, 195, 0, 0.72);
    background: rgba(255, 195, 0, 0.035);
    box-shadow: 0 0 0 2px rgba(255, 195, 0, 0.08);
}

.workout-exercise-card .workout-set-input,
.workout-exercise-card .workout-unit-select {
    min-width: 0;
    border: 0 !important;
    border-radius: 0;
    background: transparent;
    box-shadow: none !important;
    color: #f3f4f6;
}

.workout-exercise-card .workout-set-input {
    flex: 1 1 auto;
    width: 100%;
    padding: 0.6rem 0.25rem 0.6rem 0.65rem;
    text-align: center;
    font-size: 1.05rem;
    font-weight: 650;
}

.workout-exercise-card .workout-unit-select {
    flex: 0 0 auto;
    width: 2.9rem;
    padding: 0.6rem 0.2rem;
    color: #9ca3af;
    font-size: 0.72rem;
    text-align: center;
}

.workout-field-suffix {
    flex: 0 0 auto;
    padding-right: 0.55rem;
    color: #737b86;
    font-size: 0.75rem;
}

.workout-multiply {
    color: #606873;
    text-align: center;
    font-size: 0.9rem;
}

.workout-icon-button {
    display: inline-flex;
    min-width: 2rem;
    min-height: 2rem;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 9999px;
    background: transparent;
    transition: background-color 160ms ease, color 160ms ease, transform 160ms ease;
}

.workout-icon-button:active {
    transform: scale(0.9);
    background: rgba(255, 255, 255, 0.07);
}

.workout-delete-set {
    color: #616975;
}

.workout-delete-set:active {
    color: #f87171;
}

.workout-exercise-card .workout-note {
    border: 1px solid rgba(255, 255, 255, 0.10) !important;
    background: rgba(255, 255, 255, 0.025);
    box-shadow: none;
    color: #d1d5db;
}

.workout-exercise-card .workout-note:focus {
    border-color: rgba(255, 195, 0, 0.45) !important;
    box-shadow: 0 0 0 2px rgba(255, 195, 0, 0.07);
}

.workout-card-actions {
    display: grid;
    grid-template-columns: 1.15fr 1fr 1fr;
    gap: 0.45rem;
}

.workout-action {
    display: inline-flex;
    min-height: 2.6rem;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    border-radius: 0.75rem;
    padding: 0.45rem 0.55rem;
    font-size: 0.8rem;
    font-weight: 700;
    transition: transform 140ms ease, background-color 140ms ease, border-color 140ms ease;
}

.workout-action:active {
    transform: scale(0.97);
}

.workout-action-primary {
    border: 1px solid rgba(255, 195, 0, 0.42);
    background: rgba(255, 195, 0, 0.13);
    color: #f6ca54;
}

.workout-action-secondary {
    border: 1px solid rgba(255, 255, 255, 0.09);
    background: rgba(255, 255, 255, 0.035);
    color: #b8c0cc;
}

@media (max-width: 390px) {
    .workout-set-row {
        grid-template-columns: 3rem minmax(0, 1fr) 1.8rem;
        gap: 0.35rem;
    }

    .workout-set-inputs {
        gap: 0.25rem;
    }

    .workout-exercise-card .workout-set-input {
        padding-left: 0.4rem;
        font-size: 1rem;
    }

    .workout-action {
        gap: 0.2rem;
        padding-inline: 0.35rem;
        font-size: 0.74rem;
    }
}
'''
style_path.write_text(style, encoding='utf-8')

# --- events: set type is a lightweight explicit click, not DOM observation ---
events_path = Path('web/src/events.js')
events = events_path.read_text(encoding='utf-8')
events = replace_once(
    events,
    "                    const copySetButton = target.closest('.js-copy-set');",
    "                    const copySetButton = target.closest('.js-copy-set');\n                    const setTypeToggleButton = target.closest('.js-set-type-toggle');",
    'events set type selector'
)
events = replace_once(
    events,
    "                    if (addSetButton) app.methods.addSet(exerciseCard);",
    "                    if (setTypeToggleButton) app.methods.toggleSetType(setTypeToggleButton);\n                    if (addSetButton) app.methods.addSet(exerciseCard);",
    'events set type action'
)
events_path.write_text(events, encoding='utf-8')

# --- methods: use button dataset as the set-type source of truth ---
methods_path = Path('web/src/methods.js')
methods = methods_path.read_text(encoding='utf-8')
methods = replace_once(
    methods,
    "import { normalizeSetType } from './set-type.js';",
    "import { normalizeSetType, SET_TYPE } from './set-type.js';",
    'set type import'
)
methods = methods.replace("const setTypeSelect = set.querySelector('.js-set-type-select');", "const setTypeToggle = set.querySelector('.js-set-type-toggle');")
methods = methods.replace("normalizeSetType(setTypeSelect?.value)", "normalizeSetType(setTypeToggle?.dataset.setType)")
methods = methods.replace("lastSet.querySelector('.js-set-type-select')?.value", "lastSet.querySelector('.js-set-type-toggle')?.dataset.setType")
methods = methods.replace("const newSetTypeSelect = newSetElement.querySelector('.js-set-type-select');\n                    if (newSetTypeSelect) newSetTypeSelect.value = lastSetType;", "const newSetTypeToggle = newSetElement.querySelector('.js-set-type-toggle');\n                    this.applySetTypeToToggle(newSetTypeToggle, lastSetType);")
methods = methods.replace("const newSetTypeSelect = newSet.querySelector('.js-set-type-select');\n                        if (newSetTypeSelect) newSetTypeSelect.value = lastSetType;", "const newSetTypeToggle = newSet.querySelector('.js-set-type-toggle');\n                        this.applySetTypeToToggle(newSetTypeToggle, lastSetType);")
methods = replace_once(
    methods,
    "                // 輔助函式：專門用來從模板創建一個「組」元素\n                createSetElement(setNumber) {",
    "                applySetTypeToToggle(button, value) {\n                    if (!button) return;\n                    const setType = normalizeSetType(value);\n                    const isWarmup = setType === SET_TYPE.WARMUP;\n                    button.dataset.setType = setType;\n                    button.setAttribute('aria-pressed', isWarmup ? 'true' : 'false');\n                    button.setAttribute(\n                        'aria-label',\n                        isWarmup ? '目前為熱身組，點擊切換為工作組' : '目前為工作組，點擊切換為熱身組'\n                    );\n                },\n\n                toggleSetType(button) {\n                    if (!button) return;\n                    const current = normalizeSetType(button.dataset.setType);\n                    const next = current === SET_TYPE.WARMUP ? SET_TYPE.WORKING : SET_TYPE.WARMUP;\n                    this.applySetTypeToToggle(button, next);\n                    button.dispatchEvent(new Event('change', { bubbles: true }));\n                },\n\n                // 輔助函式：專門用來從模板創建一個「組」元素\n                createSetElement(setNumber) {",
    'set type toggle methods'
)
methods = methods.replace("newSet.querySelector('.js-set-number').textContent = `SET ${setNumber}`;", "newSet.querySelector('.js-set-number').textContent = String(setNumber);\n                    this.applySetTypeToToggle(newSet.querySelector('.js-set-type-toggle'), SET_TYPE.WORKING);")
if '.js-set-type-select' in methods:
    raise SystemExit('legacy set-type select remains in methods.js')
methods_path.write_text(methods, encoding='utf-8')

# --- Workout Draft: persist dataset and restore button state ---
draft_path = Path('web/src/workout-draft.js')
draft = draft_path.read_text(encoding='utf-8')
draft = draft.replace("set.querySelector('.js-set-type-select')?.value", "set.querySelector('.js-set-type-toggle')?.dataset.setType")
draft = draft.replace("const setTypeSelect = fragment.querySelector('.js-set-type-select');", "const setTypeToggle = fragment.querySelector('.js-set-type-toggle');")
draft = draft.replace("if (setNumberEl) setNumberEl.textContent = `SET ${setNumber}`;", "if (setNumberEl) setNumberEl.textContent = String(setNumber);")
draft = draft.replace(
    "  if (setTypeSelect) setTypeSelect.value = normalizeSetType(setData?.setType);",
    "  if (setTypeToggle) {\n    const setType = normalizeSetType(setData?.setType);\n    const isWarmup = setType === 'warmup';\n    setTypeToggle.dataset.setType = setType;\n    setTypeToggle.setAttribute('aria-pressed', isWarmup ? 'true' : 'false');\n    setTypeToggle.setAttribute('aria-label', isWarmup ? '目前為熱身組，點擊切換為工作組' : '目前為工作組，點擊切換為熱身組');\n  }"
)
if '.js-set-type-select' in draft:
    raise SystemExit('legacy set-type select remains in workout-draft.js')
draft_path.write_text(draft, encoding='utf-8')

print('Workout set row redesign patch applied')
