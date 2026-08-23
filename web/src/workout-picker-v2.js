import { ALL_TAGS, CATEGORY_ORDER } from './exercise-taxonomy.js';

const DEFAULT_VISIBLE_LIMIT = 36;
const RECENT_VISIBLE_LIMIT = 6;
const EQUIPMENT_TAG_ORDER = ['槓鈴', '啞鈴', '機械', '滑輪', '自體重量', '壺鈴', '彈力帶'];

function normalizeText(value) {
    return String(value || '').trim().toLocaleLowerCase('zh-Hant');
}

function isActiveCatalogItem(item) {
    if (!item || !String(item.motion || '').trim()) return false;
    if (item.active === false) return false;
    if (typeof item.active === 'string' && item.active.trim().toLowerCase() === 'false') return false;
    return true;
}

export function normalizePickerCatalog(catalog) {
    return (Array.isArray(catalog) ? catalog : [])
        .filter(isActiveCatalogItem)
        .map(item => ({
            ...item,
            motion: String(item.motion || '').trim(),
            category: String(item.category || '').trim(),
            tags: Array.isArray(item.tags)
                ? item.tags.map(tag => String(tag || '').trim()).filter(Boolean)
                : String(item.tags || '').split(',').map(tag => tag.trim()).filter(Boolean),
        }));
}

function searchRank(item, query) {
    if (!query) return 0;
    const motion = normalizeText(item.motion);
    const category = normalizeText(item.category);
    const tags = item.tags.map(normalizeText);
    if (motion === query) return 0;
    if (motion.startsWith(query)) return 1;
    if (motion.includes(query)) return 2;
    if (category.includes(query)) return 3;
    if (tags.some(tag => tag.includes(query))) return 4;
    return 99;
}

export function filterPickerCatalog(catalog, filters = {}) {
    const query = normalizeText(filters.query);
    const category = String(filters.category || '').trim();
    const tag = String(filters.tag || '').trim();

    return normalizePickerCatalog(catalog)
        .filter(item => {
            if (category && item.category !== category) return false;
            if (tag && !item.tags.includes(tag)) return false;
            if (!query) return true;
            return searchRank(item, query) < 99;
        })
        .sort((a, b) => {
            const rankDiff = searchRank(a, query) - searchRank(b, query);
            if (rankDiff !== 0) return rankDiff;
            const categoryDiff = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
            if (categoryDiff !== 0 && CATEGORY_ORDER.includes(a.category) && CATEGORY_ORDER.includes(b.category)) return categoryDiff;
            return a.motion.localeCompare(b.motion, 'zh-Hant');
        });
}

export function resolveRecentPickerExercises(catalog, recentNames, limit = RECENT_VISIBLE_LIMIT) {
    const byMotion = new Map(normalizePickerCatalog(catalog).map(item => [item.motion, item]));
    const seen = new Set();
    const result = [];
    for (const rawName of Array.isArray(recentNames) ? recentNames : []) {
        const motion = String(rawName || '').trim();
        if (!motion || seen.has(motion) || !byMotion.has(motion)) continue;
        seen.add(motion);
        result.push(byMotion.get(motion));
        if (result.length >= limit) break;
    }
    return result;
}

function pickerState(app) {
    if (!app.state.exercisePicker) app.state.exercisePicker = { category: '', tag: '' };
    return app.state.exercisePicker;
}

function getCatalog(app) {
    return normalizePickerCatalog(app.state.cache.exerciseCatalog || app.state.classify.catalog || []);
}

function getRecentNames(app) {
    return Array.isArray(app.state.cache.recentExerciseNames) ? app.state.cache.recentExerciseNames : [];
}

function bumpRecentName(app, motion) {
    const current = getRecentNames(app).filter(name => name !== motion);
    app.state.cache.recentExerciseNames = [motion, ...current].slice(0, 8);
}

function createChip(value, kind, active) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `picker-chip${active ? ' is-active' : ''}`;
    button.dataset.pickerFilterKind = kind;
    button.dataset.pickerFilterValue = value;
    button.textContent = value;
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
    return button;
}

function renderChipRow(container, label, kind, values, activeValue) {
    const row = document.createElement('div');
    row.className = 'picker-filter-row';

    const labelEl = document.createElement('span');
    labelEl.className = 'picker-filter-label';
    labelEl.textContent = label;
    row.appendChild(labelEl);

    const scroller = document.createElement('div');
    scroller.className = 'picker-filter-scroller';
    values.forEach(value => scroller.appendChild(createChip(value, kind, activeValue === value)));
    row.appendChild(scroller);
    container.appendChild(row);
}

function renderFilters(app) {
    const container = document.getElementById('exercise-filter-chips');
    if (!container) return;
    const state = pickerState(app);
    container.innerHTML = '';
    renderChipRow(container, '部位', 'category', CATEGORY_ORDER, state.category);

    const orderedTags = [
        ...EQUIPMENT_TAG_ORDER,
        ...ALL_TAGS.filter(tag => !EQUIPMENT_TAG_ORDER.includes(tag)),
    ];
    renderChipRow(container, '標籤', 'tag', orderedTags, state.tag);
}

function renderSectionTitle(list, title, count = null) {
    const header = document.createElement('div');
    header.className = 'picker-section-title';
    const titleEl = document.createElement('span');
    titleEl.textContent = title;
    header.appendChild(titleEl);
    if (count !== null) {
        const countEl = document.createElement('span');
        countEl.className = 'picker-section-count';
        countEl.textContent = String(count);
        header.appendChild(countEl);
    }
    list.appendChild(header);
}

function itemMeta(item) {
    const parts = [];
    if (item.category) parts.push(item.category);
    if (item.tags?.length) parts.push(item.tags.slice(0, 3).join('・'));
    return parts.join(' · ');
}

function renderExerciseItem(list, item, options = {}) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `picker-exercise-item js-suggestion-item${options.create ? ' picker-create-item' : ''}`;
    button.dataset.motion = item.motion;

    const main = document.createElement('span');
    main.className = 'picker-exercise-main';
    main.textContent = options.create ? `新增「${item.motion}」` : item.motion;
    button.appendChild(main);

    const meta = document.createElement('span');
    meta.className = 'picker-exercise-meta';
    meta.textContent = options.create
        ? '建立新動作 · 預設為重量 × 次數'
        : itemMeta(item);
    button.appendChild(meta);

    list.appendChild(button);
}

function renderEmpty(list, message) {
    const empty = document.createElement('div');
    empty.className = 'picker-empty';
    empty.textContent = message;
    list.appendChild(empty);
}

function hasExactMotion(catalog, query) {
    const normalized = normalizeText(query);
    return catalog.some(item => normalizeText(item.motion) === normalized);
}

function renderPicker(app) {
    const list = document.getElementById('suggestions-list');
    const input = document.getElementById('autocomplete-input');
    if (!list || !input) return;

    const catalog = getCatalog(app);
    const recentNames = getRecentNames(app);
    const state = pickerState(app);
    const query = String(input.value || '').trim();
    const hasFilter = !!state.category || !!state.tag;
    list.innerHTML = '';

    renderFilters(app);

    if (!query && !hasFilter) {
        const recent = resolveRecentPickerExercises(catalog, recentNames);
        if (recent.length) {
            renderSectionTitle(list, '最近使用', recent.length);
            recent.forEach(item => renderExerciseItem(list, item));
        }

        const recentSet = new Set(recent.map(item => item.motion));
        const browse = filterPickerCatalog(catalog)
            .filter(item => !recentSet.has(item.motion))
            .slice(0, 12);
        if (browse.length) {
            renderSectionTitle(list, recent.length ? '瀏覽動作' : '所有動作', catalog.length);
            browse.forEach(item => renderExerciseItem(list, item));
        }
        if (!recent.length && !browse.length) renderEmpty(list, '尚無動作資料，可直接輸入名稱建立新動作。');
        return;
    }

    const results = filterPickerCatalog(catalog, {
        query,
        category: state.category,
        tag: state.tag,
    });

    const titleParts = [];
    if (query) titleParts.push('搜尋結果');
    if (state.category) titleParts.push(state.category);
    if (state.tag) titleParts.push(state.tag);
    renderSectionTitle(list, titleParts.join(' · ') || '符合條件', results.length);
    results.slice(0, DEFAULT_VISIBLE_LIMIT).forEach(item => renderExerciseItem(list, item));

    if (query && !hasExactMotion(catalog, query)) {
        renderExerciseItem(list, { motion: query, category: '', tags: [] }, { create: true });
    } else if (!results.length) {
        renderEmpty(list, '沒有符合條件的動作。');
    }
}

function installDelegatedEvents(app) {
    const list = document.getElementById('suggestions-list');
    if (list && !list.dataset.pickerV2Bound) {
        list.dataset.pickerV2Bound = '1';
        list.addEventListener('click', event => {
            const item = event.target.closest('.js-suggestion-item');
            if (!item || !list.contains(item)) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            const motion = String(item.dataset.motion || '').trim();
            if (!motion) return;
            bumpRecentName(app, motion);
            if (app.state.modal.promptCallback) app.state.modal.promptCallback(motion);
        }, true);
    }

    const filters = document.getElementById('exercise-filter-chips');
    if (filters && !filters.dataset.pickerV2Bound) {
        filters.dataset.pickerV2Bound = '1';
        filters.addEventListener('click', event => {
            const chip = event.target.closest('[data-picker-filter-kind]');
            if (!chip || !filters.contains(chip)) return;
            const state = pickerState(app);
            const kind = chip.dataset.pickerFilterKind;
            const value = chip.dataset.pickerFilterValue || '';
            if (kind !== 'category' && kind !== 'tag') return;
            state[kind] = state[kind] === value ? '' : value;
            renderPicker(app);
        });
    }
}

export function installWorkoutPickerV2(app) {
    if (!app || app.__workoutPickerV2Installed) return;
    app.__workoutPickerV2Installed = true;
    app.state.cache.recentExerciseNames = app.state.cache.recentExerciseNames || [];
    pickerState(app);

    // Capture the bootstrap payload for both self-view and admin user switching
    // without adding another API round trip.
    const originalGetInitialData = app.api.getInitialData.bind(app.api);
    app.api.getInitialData = async (...args) => {
        const data = await originalGetInitialData(...args);
        app.state.cache.recentExerciseNames = Array.isArray(data?.recentExerciseNames)
            ? data.recentExerciseNames
            : [];
        return data;
    };

    app.methods.handleAddExerciseClick = function () {
        app.ui.showAutocompleteModal(true, exerciseName => {
            const motion = String(exerciseName || '').trim();
            if (!motion) {
                app.ui.showToast('請輸入動作名稱！');
                return;
            }
            bumpRecentName(app, motion);
            app.methods.addExercise(motion);
            app.ui.showAutocompleteModal(false);
        });

        const state = pickerState(app);
        state.category = '';
        state.tag = '';
        const input = document.getElementById('autocomplete-input');
        if (input) input.placeholder = '搜尋動作、部位或標籤...';
        installDelegatedEvents(app);
        renderPicker(app);

        if (!getCatalog(app).length) {
            app.api.getExerciseCatalog(app.state.user.currentUser)
                .then(catalog => {
                    app.state.classify.catalog = catalog;
                    app.state.cache.exerciseCatalog = catalog;
                    renderPicker(app);
                })
                .catch(() => { /* 目錄失敗仍可直接輸入新動作 */ });
        }
    };

    app.methods.updateAutocompleteSuggestions = function () {
        renderPicker(app);
    };
    app.methods.renderExerciseFilterChips = function () {
        renderFilters(app);
    };
    app.methods.applyExerciseFilter = function () {
        renderPicker(app);
    };
    app.methods.setExerciseFilter = function (value) {
        const state = pickerState(app);
        if (CATEGORY_ORDER.includes(value)) state.category = state.category === value ? '' : value;
        else state.tag = state.tag === value ? '' : value;
        renderPicker(app);
    };
}
