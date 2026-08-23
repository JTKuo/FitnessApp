import { afterEach, describe, expect, it, vi } from 'vitest';
import { installInBodySubmitGuard } from './inbody-submit-guard.js';

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('installInBodySubmitGuard', () => {
    it('allows only one InBody save request at a time and restores the button', async () => {
        let resolveSave;
        const originalSave = vi.fn(() => new Promise((resolve) => { resolveSave = resolve; }));
        const showToast = vi.fn();
        const button = {
            disabled: false,
            setAttribute: vi.fn(),
            removeAttribute: vi.fn()
        };
        vi.stubGlobal('document', { querySelector: vi.fn(() => button) });

        const app = {
            methods: { saveInBodyRecordFromModal: originalSave },
            ui: { showToast }
        };
        installInBodySubmitGuard(app);

        const first = app.methods.saveInBodyRecordFromModal();
        const duplicate = app.methods.saveInBodyRecordFromModal();

        expect(originalSave).toHaveBeenCalledTimes(1);
        expect(button.disabled).toBe(true);
        expect(button.setAttribute).toHaveBeenCalledWith('aria-busy', 'true');
        expect(showToast).toHaveBeenCalledWith('InBody 量測正在儲存，請稍候。');

        resolveSave({ status: 'success' });
        await first;
        await duplicate;

        expect(button.disabled).toBe(false);
        expect(button.removeAttribute).toHaveBeenCalledWith('aria-busy');

        await app.methods.saveInBodyRecordFromModal();
        expect(originalSave).toHaveBeenCalledTimes(2);
    });
});
