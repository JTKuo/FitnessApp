import { methods } from './methods.js';

// Presentation-only adapter: LoadMode remains semantic data, while the compact
// set row keeps the physical unit label short enough for mobile input space.
const applyLoadMetadataToSetBase = methods.applyLoadMetadataToSet;

methods.applyLoadMetadataToSet = function applyCompactPerHandUnitPresentation(...args) {
  applyLoadMetadataToSetBase.apply(this, args);

  const setRow = args[0];
  const unitSelect = setRow?.querySelector?.('.js-unit-select');
  if (!unitSelect) return;

  const kgOption = unitSelect.querySelector('option[value="公斤"]');
  const lbOption = unitSelect.querySelector('option[value="磅"]');
  if (kgOption) kgOption.textContent = 'kg';
  if (lbOption) lbOption.textContent = 'lb';

  unitSelect.setAttribute(
    'aria-label',
    unitSelect.dataset.loadMode === 'per_hand' ? '每手重量單位' : '重量單位',
  );
};
