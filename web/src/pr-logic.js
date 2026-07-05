// PR 計算純函式：前端與 GAS 後端共用。
// GAS 端的 src/PRLogic.gs 由 `npm run sync:pr` 從本檔自動生成，勿手改該檔。

export function calcEst1RM(weightKg, reps) {
  if (!(weightKg > 0) || !(reps > 0)) return 0;
  if (reps === 1) return weightKg;
  if (reps >= 37) return 0; // Brzycki 公式在 37 下以上無意義
  return weightKg * 36 / (37 - reps); // Brzycki
}

export function getRmCategory(reps) {
  if (!(reps > 0)) return null;
  if (reps <= 2) return 1;
  if (reps <= 4) return 3;
  if (reps <= 7) return 5;
  if (reps <= 9) return 8;
  return 10;
}
