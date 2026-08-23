import { normalizeDurationSec, normalizeTrackingType, TRACKING_TYPE } from './tracking-type.js';
import { LATERALITY, normalizeLaterality, normalizeLoadMode, resolveSide } from './load-semantics.js';

function syncSideTogglePlacement(setRow) {
    if (!setRow) return;

    const sideToggle = setRow.querySelector('.js-side-toggle');
    if (!sideToggle) return;

    const trackingType = normalizeTrackingType(setRow.dataset.trackingType);
    const laterality = normalizeLaterality(setRow.dataset.laterality);
    const targetField = trackingType === TRACKING_TYPE.DURATION
        ? setRow.querySelector('.workout-duration-field')
        : setRow.querySelector('.workout-weight-field');

    if (targetField && sideToggle.parentElement !== targetField) {
        targetField.prepend(sideToggle);
    }

    // Side is a laterality concern, not a weight-only concern. Duration exercises
    // such as side planks still need an explicit left/right value per set.
    sideToggle.classList.toggle('hidden', laterality !== LATERALITY.UNILATERAL);
}

function collectDurationContexts(root = document) {
    const contexts = [];
    root.querySelectorAll?.('#workout-list .card').forEach(card => {
        if (normalizeTrackingType(card.dataset.trackingType) !== TRACKING_TYPE.DURATION) return;

        const laterality = normalizeLaterality(card.dataset.laterality);
        const loadMode = normalizeLoadMode(card.dataset.loadMode);
        card.querySelectorAll('.js-set-row').forEach((setRow, index) => {
            const durationSec = normalizeDurationSec(setRow.querySelector('.js-duration-input')?.value);
            if (durationSec <= 0) return;
            contexts.push({
                motion: card.querySelector('h3')?.textContent?.trim() || '',
                set: index + 1,
                side: resolveSide(laterality, setRow.querySelector('.js-side-toggle')?.dataset.side),
                load_mode: loadMode,
            });
        });
    });
    return contexts;
}

export function augmentDurationWorkoutRecords(records, contexts) {
    const source = Array.isArray(records) ? records : [];
    const durationContexts = Array.isArray(contexts) ? contexts : [];
    let durationIndex = 0;

    return source.map(record => {
        if (normalizeTrackingType(record?.tracking_type) !== TRACKING_TYPE.DURATION) return record;
        const context = durationContexts[durationIndex++];
        if (!context) return record;

        return {
            ...record,
            side: context.side,
            load_mode: context.load_mode,
        };
    });
}

export function installDurationUnilateral(app) {
    if (!app?.methods || app.__durationUnilateralInstalled) return;
    app.__durationUnilateralInstalled = true;

    const originalApplyTrackingTypeToSet = app.methods.applyTrackingTypeToSet.bind(app.methods);
    app.methods.applyTrackingTypeToSet = function (setRow, value) {
        originalApplyTrackingTypeToSet(setRow, value);
        syncSideTogglePlacement(setRow);
    };

    const originalApplyLoadMetadataToSet = app.methods.applyLoadMetadataToSet.bind(app.methods);
    app.methods.applyLoadMetadataToSet = function (setRow, loadMode, laterality, side) {
        originalApplyLoadMetadataToSet(setRow, loadMode, laterality, side);
        syncSideTogglePlacement(setRow);
    };

    const originalCollectWorkoutData = app.methods.collectWorkoutData.bind(app.methods);
    app.methods.collectWorkoutData = function () {
        const records = originalCollectWorkoutData();
        return augmentDurationWorkoutRecords(records, collectDurationContexts());
    };
}
