export function installInBodySubmitGuard(app) {
    if (!app?.methods?.saveInBodyRecordFromModal) return;

    const originalSave = app.methods.saveInBodyRecordFromModal.bind(app.methods);
    let inFlight = false;

    app.methods.saveInBodyRecordFromModal = async (...args) => {
        if (inFlight) {
            app.ui?.showToast?.('InBody 量測正在儲存，請稍候。');
            return;
        }

        inFlight = true;
        const saveButton = typeof document !== 'undefined'
            ? document.querySelector('button[onclick="app.methods.saveInBodyRecordFromModal()"]')
            : null;
        const wasDisabled = !!saveButton?.disabled;

        if (saveButton) {
            saveButton.disabled = true;
            saveButton.setAttribute('aria-busy', 'true');
        }

        try {
            return await originalSave(...args);
        } finally {
            inFlight = false;
            if (saveButton) {
                saveButton.disabled = wasDisabled;
                saveButton.removeAttribute('aria-busy');
            }
        }
    };
}
