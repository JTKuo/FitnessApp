from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
index_path = root / 'web' / 'index.html'
style_path = root / 'web' / 'src' / 'style.css'
methods_path = root / 'web' / 'src' / 'methods.js'
draft_path = root / 'web' / 'src' / 'workout-draft.js'
timer_path = root / 'web' / 'src' / 'rest-timer.js'

index = index_path.read_text(encoding='utf-8')

old_actions = '''            <div class="workout-card-actions mt-3">
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
            </div>'''
new_actions = '''            <div class="workout-card-actions mt-3">
                <button class="js-start-timer workout-action workout-action-primary" type="button">
                    <ion-icon name="timer-outline" class="text-lg pointer-events-none"></ion-icon>
                    <span>休息</span>
                </button>
                <button class="js-add-set workout-action workout-action-secondary" type="button">
                    <ion-icon name="add-outline" class="text-xl pointer-events-none"></ion-icon>
                    <span>新增一組</span>
                </button>
            </div>'''
if old_actions not in index:
    raise SystemExit('exercise card action block not found')
index = index.replace(old_actions, new_actions, 1)

set_template_pattern = re.compile(r'    <template id="set-row-template">.*?    </template>', re.S)
new_set_template = '''    <template id="set-row-template">
        <div class="js-set-row workout-set-row relative">
            <span class="js-pr-badge hidden absolute -left-1 -top-1 z-10 rounded-full bg-yellow-400 px-2 py-0.5 text-xs font-bold text-black shadow-md animate-pulse"></span>

            <div class="workout-set-meta-shell">
                <span class="js-set-number workout-set-number">SET 1</span>
                <button type="button" class="js-set-type-toggle workout-set-type-toggle" data-set-type="working" aria-pressed="false" aria-label="目前為訓練組，點擊切換為熱身組">
                    <span class="set-type-working inline-flex items-center gap-1">
                        <ion-icon name="barbell-outline" class="text-sm pointer-events-none"></ion-icon>
                        <span>訓練</span>
                    </span>
                    <span class="set-type-warmup inline-flex items-center gap-1">
                        <ion-icon name="flame-outline" class="text-sm pointer-events-none"></ion-icon>
                        <span>熱身</span>
                    </span>
                </button>
            </div>

            <div class="workout-set-inputs">
                <div class="workout-number-field workout-weight-field">
                    <input type="number" min="0" class="js-weight-input workout-set-input" aria-label="重量">
                    <select class="js-unit-select workout-unit-select" aria-label="重量單位">
                        <option value="公斤">kg</option>
                        <option value="磅">lb</option>
                    </select>
                </div>

                <span class="workout-multiply" aria-hidden="true">×</span>

                <div class="workout-number-field workout-reps-field">
                    <input type="number" min="0" class="js-reps-input workout-set-input" aria-label="次數">
                    <span class="workout-field-suffix">次</span>
                </div>
            </div>

            <div class="workout-set-actions" aria-label="組別操作">
                <button class="js-delete-set workout-icon-button workout-delete-set" type="button" aria-label="刪除此組">
                    <ion-icon name="trash-outline" class="text-lg pointer-events-none"></ion-icon>
                </button>
            </div>
        </div>
    </template>'''
index, count = set_template_pattern.subn(new_set_template, index, count=1)
if count != 1:
    raise SystemExit('set-row-template not replaced exactly once')
index_path.write_text(index, encoding='utf-8')

style = style_path.read_text(encoding='utf-8')
marker = '/* --- Workout Set Row Redesign --- */'
if marker not in style:
    raise SystemExit('workout redesign css marker not found')
style = style.split(marker, 1)[0].rstrip() + '\n\n' + r'''/* --- Workout Set Row Polish --- */
.workout-exercise-card {
    border-color: rgba(255, 195, 0, 0.18);
    background: linear-gradient(180deg, rgba(15, 14, 12, 0.96), rgba(10, 10, 9, 0.92));
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.25);
}

.workout-card-summary {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
    border-bottom: 1px solid rgba(255, 195, 0, 0.10);
    padding-bottom: 0.7rem;
}

.workout-set-row {
    display: grid;
    grid-template-columns: 6.8rem minmax(0, 1fr) 4.6rem;
    align-items: center;
    gap: 0.55rem;
    min-height: 4.2rem;
    padding: 0.55rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.055);
}

.workout-set-row:last-child {
    border-bottom-color: transparent;
}

.workout-set-meta-shell {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: stretch;
    min-height: 2.55rem;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 0.75rem;
    background: rgba(255, 255, 255, 0.025);
}

.workout-set-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 0.48rem;
    color: #9ca3af;
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    white-space: nowrap;
}

.workout-set-type-toggle {
    display: inline-flex;
    min-width: 0;
    align-items: center;
    justify-content: center;
    border: 0;
    border-left: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 0;
    background: rgba(255, 255, 255, 0.035);
    padding: 0.25rem 0.45rem;
    color: #d1d5db;
    font-size: 0.7rem;
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
    transition: background-color 160ms ease, color 160ms ease, box-shadow 160ms ease;
}

.workout-set-type-toggle:active {
    background: rgba(255, 195, 0, 0.08);
}

.workout-set-type-toggle .set-type-warmup {
    display: none;
}

.workout-set-type-toggle[data-set-type="warmup"] {
    background: rgba(255, 195, 0, 0.13);
    color: #ffd55f;
    box-shadow: inset 2px 0 0 rgba(255, 195, 0, 0.55);
}

.workout-set-type-toggle[data-set-type="warmup"] .set-type-working {
    display: none;
}

.workout-set-type-toggle[data-set-type="warmup"] .set-type-warmup {
    display: inline-flex;
}

.workout-set-inputs {
    display: grid;
    grid-template-columns: minmax(0, 1.12fr) 0.8rem minmax(0, 0.88fr);
    align-items: center;
    gap: 0.35rem;
    min-width: 0;
}

.workout-number-field {
    display: flex;
    min-width: 0;
    min-height: 3rem;
    align-items: center;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 0.8rem;
    background: rgba(255, 255, 255, 0.035);
    transition: border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease;
}

.workout-number-field:focus-within {
    border-color: rgba(255, 195, 0, 0.64);
    background: rgba(255, 195, 0, 0.03);
    box-shadow: 0 0 0 2px rgba(255, 195, 0, 0.07);
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
    padding: 0.65rem 0.35rem 0.65rem 0.65rem;
    text-align: center;
    font-size: 1.05rem;
    font-weight: 650;
}

.workout-exercise-card .workout-unit-select {
    flex: 0 0 auto;
    width: 3.15rem;
    min-height: 2rem;
    border-left: 1px solid rgba(255, 255, 255, 0.12) !important;
    padding: 0.55rem 0.25rem;
    color: #aeb5bf;
    font-size: 0.72rem;
    text-align: center;
    cursor: pointer;
}

.workout-field-suffix {
    flex: 0 0 auto;
    padding-right: 0.6rem;
    color: #7e8792;
    font-size: 0.75rem;
}

.workout-multiply {
    color: #5d6671;
    text-align: center;
    font-size: 0.9rem;
}

.workout-set-actions {
    display: grid;
    grid-template-columns: repeat(2, 2rem);
    align-items: center;
    justify-content: end;
    gap: 0.25rem;
}

.workout-icon-button,
.workout-set-actions .js-complete-set {
    display: inline-flex;
    width: 2rem;
    height: 2rem;
    min-width: 2rem;
    min-height: 2rem;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
    border-radius: 9999px;
    background: transparent;
    transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease;
}

.workout-icon-button:active,
.workout-set-actions .js-complete-set:active {
    transform: scale(0.92);
    background: rgba(255, 255, 255, 0.07);
}

.workout-set-actions .js-complete-set {
    color: #7f8997;
}

.workout-set-actions .js-complete-set[data-completed="true"] {
    border-color: rgba(74, 222, 128, 0.34);
    background: rgba(74, 222, 128, 0.08);
    color: #4ade80;
}

.workout-delete-set {
    color: #69727e;
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
    grid-template-columns: 0.9fr 1.1fr;
    gap: 0.55rem;
}

.workout-action {
    display: inline-flex;
    min-height: 2.8rem;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    border-radius: 0.8rem;
    padding: 0.5rem 0.7rem;
    font-size: 0.82rem;
    font-weight: 700;
    transition: transform 140ms ease, background-color 140ms ease, border-color 140ms ease;
}

.workout-action:active {
    transform: scale(0.98);
}

.workout-action-primary {
    border: 1px solid rgba(255, 195, 0, 0.46);
    background: rgba(255, 195, 0, 0.13);
    color: #f7cb55;
}

.workout-action-secondary {
    border: 1px solid rgba(255, 255, 255, 0.11);
    background: rgba(255, 255, 255, 0.035);
    color: #c1c7d0;
}

@media (max-width: 430px) {
    .workout-set-row {
        grid-template-columns: 6.15rem minmax(0, 1fr) 4.25rem;
        gap: 0.38rem;
    }

    .workout-set-number {
        padding-inline: 0.38rem;
        font-size: 0.61rem;
    }

    .workout-set-type-toggle {
        padding-inline: 0.32rem;
        font-size: 0.65rem;
    }

    .workout-set-inputs {
        gap: 0.22rem;
    }

    .workout-exercise-card .workout-set-input {
        padding-left: 0.35rem;
        font-size: 0.98rem;
    }

    .workout-exercise-card .workout-unit-select {
        width: 2.75rem;
    }

    .workout-set-actions {
        grid-template-columns: repeat(2, 1.9rem);
        gap: 0.15rem;
    }

    .workout-icon-button,
    .workout-set-actions .js-complete-set {
        width: 1.9rem;
        height: 1.9rem;
        min-width: 1.9rem;
        min-height: 1.9rem;
    }
}
'''
style_path.write_text(style, encoding='utf-8')

methods = methods_path.read_text(encoding='utf-8')
methods = methods.replace("isWarmup ? '目前為熱身組，點擊切換為工作組' : '目前為工作組，點擊切換為熱身組'", "isWarmup ? '目前為熱身組，點擊切換為訓練組' : '目前為訓練組，點擊切換為熱身組'")
methods = methods.replace("newSet.querySelector('.js-set-number').textContent = String(setNumber);", "newSet.querySelector('.js-set-number').textContent = `SET ${setNumber}`;")
methods_path.write_text(methods, encoding='utf-8')

draft = draft_path.read_text(encoding='utf-8')
draft = draft.replace("if (setNumberEl) setNumberEl.textContent = String(setNumber);", "if (setNumberEl) setNumberEl.textContent = `SET ${setNumber}`;")
draft = draft.replace("isWarmup ? '目前為熱身組，點擊切換為工作組' : '目前為工作組，點擊切換為熱身組'", "isWarmup ? '目前為熱身組，點擊切換為訓練組' : '目前為訓練組，點擊切換為熱身組'")
draft_path.write_text(draft, encoding='utf-8')

timer = timer_path.read_text(encoding='utf-8')
old_insert = '''    const deleteButton = setRow.querySelector('.js-delete-set');
    if (deleteButton) setRow.insertBefore(button, deleteButton);
    else setRow.appendChild(button);'''
new_insert = '''    const actions = setRow.querySelector('.workout-set-actions');
    const deleteButton = setRow.querySelector('.js-delete-set');
    if (actions && deleteButton) actions.insertBefore(button, deleteButton);
    else if (deleteButton && deleteButton.parentElement === setRow) setRow.insertBefore(button, deleteButton);
    else setRow.appendChild(button);'''
if old_insert not in timer:
    raise SystemExit('rest timer complete-button insertion block not found')
timer = timer.replace(old_insert, new_insert, 1)
timer_path.write_text(timer, encoding='utf-8')

print('Workout set row polish applied.')
