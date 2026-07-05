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

let started = false;
initAuth(() => {
  if (!started) {
    started = true;
    app.init();
  }
});
