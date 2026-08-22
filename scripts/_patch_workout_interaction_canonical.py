from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'Expected block not found in {path}')
    text = text.replace(old, new, 1)
    p.write_text(text, encoding='utf-8')


# 1) Exercise card: remove duplicate permanent Rest CTA and move Add Set into a contextual insertion point.
replace_once(
    'web/index.html',
    '''            <div class="js-sets-container space-y-1"></div>\n\n            <div class="mt-3">\n                <textarea class="js-exercise-note workout-note w-full resize-none rounded-xl px-3 py-2 text-sm" rows="2" placeholder="備註（選填）"></textarea>\n            </div>\n\n            <div class="workout-card-actions mt-3">\n                <button class="js-start-timer workout-action workout-action-primary" type="button">\n                    <ion-icon name="timer-outline" class="text-lg pointer-events-none"></ion-icon>\n                    <span>休息</span>\n                </button>\n                <button class="js-add-set workout-action workout-action-secondary" type="button">\n                    <ion-icon name="add-outline" class="text-xl pointer-events-none"></ion-icon>\n                    <span>新增一組</span>\n                </button>\n            </div>''',
    '''            <div class="js-sets-container space-y-1"></div>\n\n            <div class="workout-add-set-row" aria-label="新增訓練組">\n                <span class="workout-add-set-line" aria-hidden="true"></span>\n                <button class="js-add-set workout-add-set-button" type="button">\n                    <ion-icon name="add-outline" class="text-lg pointer-events-none"></ion-icon>\n                    <span>新增一組</span>\n                </button>\n                <span class="workout-add-set-line" aria-hidden="true"></span>\n            </div>\n\n            <div class="mt-2">\n                <textarea class="js-exercise-note workout-note w-full resize-none rounded-xl px-3 py-2 text-sm" rows="2" placeholder="備註（選填）"></textarea>\n            </div>'''
)

# 2) Workout click/input handling: Complete owns Rest; notes auto-grow on input.
replace_once(
    'web/src/events.js',
    '''                    const setTypeToggleButton = target.closest('.js-set-type-toggle');\n\t\t\t\t\t          const startTimerButton = target.closest('.js-start-timer');\n\n                    if (setTypeToggleButton) app.methods.toggleSetType(setTypeToggleButton);\n                    if (addSetButton) app.methods.addSet(exerciseCard);\n                    if (deleteSetButton) app.methods.deleteSet(deleteSetButton.closest('.js-set-row'));\n                    if (deleteExerciseButton) app.methods.deleteExercise(exerciseCard);\n                    if (copySetButton) app.methods.copyLastSet(exerciseCard);\n\t\t\t\t\t          if (startTimerButton) app.methods.startTimer(APP_CONSTANTS.WORKOUT.DEFAULT_REST_TIME); //''',
    '''                    const setTypeToggleButton = target.closest('.js-set-type-toggle');\n\n                    if (setTypeToggleButton) app.methods.toggleSetType(setTypeToggleButton);\n                    if (addSetButton) app.methods.addSet(exerciseCard);\n                    if (deleteSetButton) app.methods.deleteSet(deleteSetButton.closest('.js-set-row'));\n                    if (deleteExerciseButton) app.methods.deleteExercise(exerciseCard);\n                    if (copySetButton) app.methods.copyLastSet(exerciseCard);'''
)

replace_once(
    'web/src/events.js',
    '''                handleWorkoutListInput(event) {\n                    const target = event.target;\n                    if (target.matches('.js-weight-input, .js-reps-input, .js-unit-select')) {\n                        const exerciseCard = target.closest('.card');\n                        if (exerciseCard) {\n                            app.methods.calculateVolume(exerciseCard);\n                            app.methods.updateDailyTotalVolume();\n                        }\n                    }\n                },''',
    '''                handleWorkoutListInput(event) {\n                    const target = event.target;\n\n                    if (target.matches('.js-exercise-note')) {\n                        app.methods.resizeWorkoutNote(target);\n                    }\n\n                    if (target.matches('.js-weight-input, .js-reps-input, .js-unit-select')) {\n                        const exerciseCard = target.closest('.card');\n                        if (exerciseCard) {\n                            app.methods.calculateVolume(exerciseCard);\n                            app.methods.updateDailyTotalVolume();\n                        }\n                    }\n                },'''
)

# APP_CONSTANTS is still used elsewhere in events.js, so keep the import.

# 3) Methods: canonical auto-grow helper shared by live input and draft restore.
replace_once(
    'web/src/methods.js',
    '''                    if (displayElement) {\n                        const finalVolume = parseFloat(displayVolume.toFixed(2));\n                        displayElement.textContent = `${finalVolume} ${displayUnit}`;\n                    }\n                },\n\t\t\t\t\n                applySetTypeToToggle(button, value) {''',
    '''                    if (displayElement) {\n                        const finalVolume = parseFloat(displayVolume.toFixed(2));\n                        displayElement.textContent = `${finalVolume} ${displayUnit}`;\n                    }\n                },\n\n                resizeWorkoutNote(textarea) {\n                    if (!textarea) return;\n\n                    textarea.style.height = 'auto';\n                    const computedMaxHeight = Number.parseFloat(window.getComputedStyle(textarea).maxHeight);\n                    const maxHeight = Number.isFinite(computedMaxHeight) ? computedMaxHeight : 128;\n                    const contentHeight = textarea.scrollHeight;\n                    const nextHeight = Math.min(contentHeight, maxHeight);\n\n                    textarea.style.height = `${nextHeight}px`;\n                    textarea.style.overflowY = contentHeight > maxHeight + 1 ? 'auto' : 'hidden';\n                },\n\n                resizeWorkoutNotes(root = document) {\n                    if (!root?.querySelectorAll) return;\n                    root.querySelectorAll('.js-exercise-note').forEach((textarea) => this.resizeWorkoutNote(textarea));\n                },\n\t\t\t\t\n                applySetTypeToToggle(button, value) {'''
)

# 4) Draft restore: resize restored multiline notes after nodes are connected to the DOM.
replace_once(
    'web/src/app.js',
    '''                this.workoutDraft.init({\n                    getCurrentUser: () => this.state.user.currentUser,\n                    onRestored: () => this.ui.showToast('已恢復未完成的訓練草稿。'),\n                    recalculateVolumes: () => {''',
    '''                this.workoutDraft.init({\n                    getCurrentUser: () => this.state.user.currentUser,\n                    onRestored: () => {\n                        this.methods.resizeWorkoutNotes();\n                        this.ui.showToast('已恢復未完成的訓練草稿。');\n                    },\n                    recalculateVolumes: () => {'''
)

# 5) Append scoped canonical interaction styles. Keep prior styles as fallback; later rules intentionally win.
style_path = Path('web/src/style.css')
style = style_path.read_text(encoding='utf-8')
marker = '/* --- Canonical Workout Interaction v0.1 --- */'
if marker in style:
    raise SystemExit('Canonical workout interaction styles already present')

style += '''\n\n/* --- Canonical Workout Interaction v0.1 --- */\n/* 訓練是主要/default state；熱身保留可點擊外觀但降低視覺權重。 */\n.workout-set-type-toggle[data-set-type="working"] {\n    border-left-color: rgba(255, 195, 0, 0.28);\n    background: rgba(255, 195, 0, 0.14);\n    color: #ffd55f;\n    box-shadow: inset 2px 0 0 rgba(255, 195, 0, 0.62);\n}\n\n.workout-set-type-toggle[data-set-type="warmup"] {\n    border-left-color: rgba(255, 255, 255, 0.12);\n    background: rgba(255, 195, 0, 0.045);\n    color: #c9af6a;\n    box-shadow: none;\n}\n\n/* Complete 是 end-of-set 的主要 action；按下後 restTimer 會自動開始。 */\n.workout-set-actions .js-complete-set:not([data-completed="true"]) {\n    border-color: rgba(255, 195, 0, 0.30);\n    background: rgba(255, 195, 0, 0.065);\n    color: #e9c54f;\n}\n\n.workout-set-actions .js-complete-set[data-completed="true"] {\n    border-color: rgba(74, 222, 128, 0.38);\n    background: rgba(74, 222, 128, 0.09);\n    color: #4ade80;\n}\n\n/* Add Set 是 exercise-level contextual insertion point，只出現一次。 */\n.workout-add-set-row {\n    display: grid;\n    grid-template-columns: minmax(1rem, 1fr) auto minmax(1rem, 1fr);\n    align-items: center;\n    gap: 0.7rem;\n    margin: 0.45rem 0 0.65rem;\n}\n\n.workout-add-set-line {\n    height: 1px;\n    background: linear-gradient(90deg, transparent, rgba(255, 195, 0, 0.18));\n}\n\n.workout-add-set-line:last-child {\n    background: linear-gradient(90deg, rgba(255, 195, 0, 0.18), transparent);\n}\n\n.workout-add-set-button {\n    display: inline-flex;\n    min-height: 2.5rem;\n    align-items: center;\n    justify-content: center;\n    gap: 0.35rem;\n    border: 1px solid rgba(255, 195, 0, 0.24);\n    border-radius: 9999px;\n    background: rgba(255, 195, 0, 0.045);\n    padding: 0.35rem 0.9rem;\n    color: #d9c16e;\n    font-size: 0.78rem;\n    font-weight: 700;\n    transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease, transform 150ms ease;\n}\n\n.workout-add-set-button:active {\n    transform: scale(0.97);\n    border-color: rgba(255, 195, 0, 0.48);\n    background: rgba(255, 195, 0, 0.10);\n    color: #ffd55f;\n}\n\n/* Notes auto-grow first; only overflow after max height. */\n.workout-exercise-card .workout-note {\n    min-height: 3.25rem;\n    max-height: 8rem;\n    overflow-y: hidden;\n    scrollbar-width: thin;\n    scrollbar-color: rgba(148, 163, 184, 0.45) transparent;\n}\n\n.workout-exercise-card .workout-note::-webkit-scrollbar {\n    width: 4px;\n}\n\n.workout-exercise-card .workout-note::-webkit-scrollbar-track {\n    background: transparent;\n}\n\n.workout-exercise-card .workout-note::-webkit-scrollbar-thumb {\n    border-radius: 9999px;\n    background: rgba(148, 163, 184, 0.42);\n}\n\n.workout-exercise-card .workout-note::-webkit-scrollbar-button {\n    display: none;\n    width: 0;\n    height: 0;\n}\n\n@media (prefers-reduced-motion: reduce) {\n    .workout-set-type-toggle,\n    .workout-set-actions .js-complete-set,\n    .workout-add-set-button {\n        transition: none;\n    }\n}\n'''
style_path.write_text(style, encoding='utf-8')

# Structural assertions keep this patch deliberately small and interaction-focused.
index = Path('web/index.html').read_text(encoding='utf-8')
events = Path('web/src/events.js').read_text(encoding='utf-8')
methods = Path('web/src/methods.js').read_text(encoding='utf-8')
app = Path('web/src/app.js').read_text(encoding='utf-8')

assert 'workout-add-set-row' in index
assert 'js-start-timer' not in index
assert 'resizeWorkoutNote(target)' in events
assert 'startTimerButton' not in events
assert 'resizeWorkoutNotes(root = document)' in methods
assert 'this.methods.resizeWorkoutNotes();' in app
assert marker in style_path.read_text(encoding='utf-8')

print('Canonical workout interaction patch applied.')
