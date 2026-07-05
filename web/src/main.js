import './style.css';
import { initAuth } from './auth.js';
import { backendApi } from './api.js';

initAuth(async () => {
  const out = document.getElementById('smoke-result');
  out.textContent = '登入成功，呼叫 getInitialData...';
  try {
    const data = await backendApi.getInitialData();
    out.textContent = '✅ getInitialData OK\n' + JSON.stringify(data.profile, null, 2);
  } catch (e) {
    out.textContent = '❌ ' + e.message;
  }
});
