// 自動生成，勿手改。來源：web/src/body-history.js（執行 npm run sync:pr 更新）
// 體態歷史序列合併純函式：前端 Vitest 測試、GAS 後端（getAnalysisData）使用。
// src/BodyHistory.gs 由 `npm run sync:pr` 自動生成，勿手改該檔。

/**
 * 合併兩條 {x: ISO 8601 字串, y: number} 時間序列。
 * 同一日曆日（取 x 前 10 字元 yyyy-mm-dd）同時存在時，preferredSeries 覆蓋 baseSeries；
 * preferredSeries 自身同日重複時，陣列中較後者為準。回傳依日期升冪的新陣列。
 */
function mergeBodyHistory(baseSeries, preferredSeries) {
  const byDay = new Map();
  (baseSeries || []).forEach(function (p) {
    if (p && p.x) byDay.set(String(p.x).slice(0, 10), p);
  });
  (preferredSeries || []).forEach(function (p) {
    if (p && p.x) byDay.set(String(p.x).slice(0, 10), p);
  });
  return Array.from(byDay.values()).sort(function (a, b) {
    return new Date(a.x) - new Date(b.x);
  });
}
