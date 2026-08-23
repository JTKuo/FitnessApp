import { suggestClassification } from './exercise-taxonomy.js';

const TRACKING_TYPES = new Set(['weight_reps', 'duration']);
const LATERALITIES = new Set(['bilateral', 'unilateral']);
const LOAD_MODES = new Set(['total', 'per_hand']);
const DEFAULT_REST_SEC = 60;
const MAX_REST_SEC = 600;

export function normalizeNewExerciseSetup(input = {}) {
    const motion = String(input.motion || '').trim();
    const trackingType = TRACKING_TYPES.has(input.trackingType) ? input.trackingType : 'weight_reps';
    const laterality = LATERALITIES.has(input.laterality) ? input.laterality : 'bilateral';
    const requestedLoadMode = LOAD_MODES.has(input.loadMode) ? input.loadMode : 'total';
    const loadMode = trackingType === 'duration' ? 'total' : requestedLoadMode;
    const rawRest = Number(input.defaultRestSec);
    const defaultRestSec = Number.isFinite(rawRest)
        ? Math.max(0, Math.min(MAX_REST_SEC, Math.round(rawRest)))
        : DEFAULT_REST_SEC;

    return { motion, trackingType, laterality, loadMode, defaultRestSec };
}

function createChoiceButton(field, value, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'exercise-setup-choice';
    button.dataset.setupField = field;
    button.dataset.setupValue = value;
    button.textContent = label;
    return button;
}

function createChoiceGroup(title, field, choices) {
    const section = document.createElement('section');
    section.className = 'exercise-setup-section';
    const heading = document.createElement('div');
    heading.className = 'exercise-setup-label';
    heading.textContent = title;
    section.appendChild(heading);

    const group = document.createElement('div');
    group.className = 'exercise-setup-choice-group';
    choices.forEach(([value, label]) => group.appendChild(createChoiceButton(field, value, label)));
    section.appendChild(group);
    return section;
}

function ensureModal() {
    let modal = document.getElementById('new-exercise-setup-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'new-exercise-setup-modal';
    modal.className = 'exercise-setup-overlay hidden';
    modal.innerHTML = `
        <div class="exercise-setup-modal" role="dialog" aria-modal="true" aria-labelledby="exercise-setup-title">
            <div class="exercise-setup-header">
                <div>
                    <div class="exercise-setup-kicker">NEW EXERCISE</div>
                    <h2 id="exercise-setup-title">建立新動作</h2>
                </div>
                <button type="button" class="exercise-setup-close" data-setup-action="cancel" aria-label="取消">×</button>
            </div>
            <div class="exercise-setup-motion" data-setup-motion></div>
            <div class="exercise-setup-content" data-setup-content></div>
            <div class="exercise-setup-actions">
                <button type="button" class="exercise-setup-cancel" data-setup-action="cancel">返回</button>
                <button type="button" class="exercise-setup-save" data-setup-action="save">建立動作</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    return modal;
}

function renderSetup(modal, state) {
    const motionEl = modal.querySelector('[data-setup-motion]');
    const content = modal.querySelector('[data-setup-content]');
    if (!motionEl || !content) return;

    motionEl.textContent = state.motion;
    content.innerHTML = '';

    content.appendChild(createChoiceGroup('記錄方式', 'trackingType', [
        ['weight_reps', '重量 × 次數'],
        ['duration', '時間（秒）'],
    ]));

    content.appendChild(createChoiceGroup('動作方式', 'laterality', [
        ['bilateral', '雙側'],
        ['unilateral', '左右分開'],
    ]));

    if (state.trackingType === 'weight_reps') {
        content.appendChild(createChoiceGroup('重量語意', 'loadMode', [
            ['total', '總重量'],
            ['per_hand', '每手重量'],
        ]));
    }

    const restSection = document.createElement('section');
    restSection.className = 'exercise-setup-section';
    restSection.innerHTML = '<div class="exercise-setup-label">預設休息</div>';
    const quick = document.createElement('div');
    quick.className = 'exercise-setup-choice-group exercise-setup-rest-quick';
    [30, 60, 90, 120].forEach(seconds => {
        quick.appendChild(createChoiceButton('defaultRestSec', String(seconds), `${seconds} 秒`));
    });
    restSection.appendChild(quick);

    const custom = document.createElement('label');
    custom.className = 'exercise-setup-rest-custom';
    custom.innerHTML = '<span>自訂</span><input data-setup-rest-input type="number" inputmode="numeric" min="0" max="600" step="5"><span>秒</span>';
    const restInput = custom.querySelector('input');
    restInput.value = String(state.defaultRestSec);
    restSection.appendChild(custom);
    content.appendChild(restSection);

    const suggestion = suggestClassification(state.motion);
    if (suggestion.category || suggestion.tags.length) {
        const hint = document.createElement('div');
        hint.className = 'exercise-setup-taxonomy-hint';
        const parts = [suggestion.category, ...suggestion.tags].filter(Boolean);
        hint.textContent = `分類建議：${parts.join(' · ')}`;
        content.appendChild(hint);
    }

    modal.querySelectorAll('[data-setup-field]').forEach(button => {
        const field = button.dataset.setupField;
        const value = button.dataset.setupValue;
        const current = String(state[field]);
        button.classList.toggle('is-active', current === value);
        button.setAttribute('aria-pressed', current === value ? 'true' : 'false');
    });
}

function upsertCatalog(app, metadata) {
    const catalog = Array.isArray(app.state.cache.exerciseCatalog)
        ? app.state.cache.exerciseCatalog.slice()
        : [];
    const index = catalog.findIndex(item => item && item.motion === metadata.motion);
    if (index >= 0) catalog[index] = { ...catalog[index], ...metadata };
    else catalog.push(metadata);
    app.state.cache.exerciseCatalog = catalog;
    app.state.classify.catalog = catalog;
    app.state.cache.exerciseNameList = catalog.map(item => item.motion).filter(Boolean);
}

export function openNewExerciseSetup(app, motion, options = {}) {
    const normalizedMotion = String(motion || '').trim();
    if (!app || !normalizedMotion) return;

    const modal = ensureModal();
    const pickerModal = document.getElementById('autocomplete-modal');
    const state = normalizeNewExerciseSetup({ motion: normalizedMotion, defaultRestSec: DEFAULT_REST_SEC });
    let saving = false;

    if (pickerModal) pickerModal.classList.add('hidden');
    modal.classList.remove('hidden');
    renderSetup(modal, state);

    const close = (returnToPicker) => {
        modal.classList.add('hidden');
        if (returnToPicker && pickerModal) {
            pickerModal.classList.remove('hidden');
            document.getElementById('autocomplete-input')?.focus();
        }
    };

    const onClick = async event => {
        const action = event.target.closest('[data-setup-action]');
        if (action && modal.contains(action)) {
            if (action.dataset.setupAction === 'cancel') {
                if (!saving) close(true);
                return;
            }
            if (action.dataset.setupAction === 'save') {
                if (saving) return;
                saving = true;
                const saveButton = modal.querySelector('[data-setup-action="save"]');
                saveButton.disabled = true;
                saveButton.textContent = '建立中…';
                try {
                    const payload = normalizeNewExerciseSetup(state);
                    const metadata = await app.api.saveExerciseMetadata(payload, app.state.user.currentUser);
                    upsertCatalog(app, metadata);
                    if (typeof options.onCreated === 'function') options.onCreated(metadata);
                    app.ui.showAutocompleteModal(false);
                    close(false);
                    app.methods.addExercise(metadata.motion);
                    app.ui.showToast(`已建立「${metadata.motion}」`);
                } catch (error) {
                    app.methods.handleError(error, '建立新動作失敗');
                    saving = false;
                    saveButton.disabled = false;
                    saveButton.textContent = '建立動作';
                }
                return;
            }
        }

        const choice = event.target.closest('[data-setup-field]');
        if (!choice || !modal.contains(choice) || saving) return;
        const field = choice.dataset.setupField;
        const value = choice.dataset.setupValue;
        if (field === 'defaultRestSec') state.defaultRestSec = Number(value);
        else state[field] = value;
        Object.assign(state, normalizeNewExerciseSetup(state));
        renderSetup(modal, state);
    };

    const onInput = event => {
        if (!event.target.matches('[data-setup-rest-input]') || saving) return;
        state.defaultRestSec = event.target.value;
        Object.assign(state, normalizeNewExerciseSetup(state));
    };

    modal.onclick = onClick;
    modal.oninput = onInput;
}
