export const SET_TYPE = Object.freeze({
  WORKING: 'working',
  WARMUP: 'warmup',
});

export function normalizeSetType(value) {
  return String(value || '').trim().toLowerCase() === SET_TYPE.WARMUP
    ? SET_TYPE.WARMUP
    : SET_TYPE.WORKING;
}
