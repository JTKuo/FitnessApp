export const TRACKING_TYPE = Object.freeze({
  WEIGHT_REPS: 'weight_reps',
  DURATION: 'duration',
});

export function normalizeTrackingType(value) {
  return String(value || '').trim().toLowerCase() === TRACKING_TYPE.DURATION
    ? TRACKING_TYPE.DURATION
    : TRACKING_TYPE.WEIGHT_REPS;
}

export function normalizeDurationSec(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.round(numeric);
}

export function formatDuration(value) {
  const total = normalizeDurationSec(value);
  if (!total) return '0 秒';
  if (total < 60) return `${total} 秒`;
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}
