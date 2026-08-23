export const LOAD_MODE = Object.freeze({
  TOTAL: 'total',
  PER_HAND: 'per_hand',
});

export const LATERALITY = Object.freeze({
  BILATERAL: 'bilateral',
  UNILATERAL: 'unilateral',
});

export const SIDE = Object.freeze({
  BOTH: 'both',
  LEFT: 'left',
  RIGHT: 'right',
});

export function normalizeLoadMode(value) {
  return String(value || '').trim().toLowerCase() === LOAD_MODE.PER_HAND
    ? LOAD_MODE.PER_HAND
    : LOAD_MODE.TOTAL;
}

export function normalizeLaterality(value) {
  return String(value || '').trim().toLowerCase() === LATERALITY.UNILATERAL
    ? LATERALITY.UNILATERAL
    : LATERALITY.BILATERAL;
}

export function normalizeSide(value) {
  const side = String(value || '').trim().toLowerCase();
  if (side === SIDE.LEFT || side === SIDE.RIGHT) return side;
  return SIDE.BOTH;
}

export function resolveSide(laterality, value) {
  if (normalizeLaterality(laterality) !== LATERALITY.UNILATERAL) return SIDE.BOTH;
  const side = normalizeSide(value);
  return side === SIDE.LEFT || side === SIDE.RIGHT ? side : SIDE.LEFT;
}

export function getLoadMultiplier(loadMode, side) {
  return normalizeLoadMode(loadMode) === LOAD_MODE.PER_HAND && normalizeSide(side) === SIDE.BOTH
    ? 2
    : 1;
}

export function calculateSetVolumeKg(weightKg, reps, loadMode, side) {
  const weight = Number(weightKg);
  const count = Number(reps);
  if (!Number.isFinite(weight) || !Number.isFinite(count) || weight <= 0 || count <= 0) return 0;
  return weight * count * getLoadMultiplier(loadMode, side);
}
