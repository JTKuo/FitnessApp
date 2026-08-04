import './style.css';
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import CalHeatmap from 'cal-heatmap';
import 'cal-heatmap/cal-heatmap.css';
import Sortable from 'sortablejs';
import imageCompression from 'browser-image-compression';
import { initAuth } from './auth.js';
import { app } from './app.js';

// 搬移的程式碼以全域名稱引用這些函式庫，維持原樣、以掛載頂替 CDN
window.Chart = Chart;
window.CalHeatmap = CalHeatmap;
window.Sortable = Sortable;
window.imageCompression = imageCompression;
Chart.register(ChartDataLabels);

// PWA 自動更新：service worker 在背景安裝新版後會接管頁面，但此時畫面上跑的
// 仍是舊版程式碼，造成「部署了卻沒生效」的假象（已兩度導致驗收誤判）。
// 偵測到接管者更換時重載一次，讓使用者永遠拿到最新版。
if ('serviceWorker' in navigator) {
  // 首次安裝時 controller 由 null 變為有值，那是正常流程、不需重載；
  // 只有「本來就有 controller」的回訪頁面被新 worker 接管時才代表版本更替。
  const hadControllerOnLoad = !!navigator.serviceWorker.controller;
  let reloadingForUpdate = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadControllerOnLoad || reloadingForUpdate) return;
    reloadingForUpdate = true;
    window.location.reload();
  });
}

let started = false;
initAuth(() => {
  if (!started) {
    started = true;
    app.init();
  }
});
