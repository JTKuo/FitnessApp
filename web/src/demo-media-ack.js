import { normalizeDemoMedia } from './exercise-demo-media.js';

const ACK_BUILD = 'DMACK-20260823-A1';
const ACK_ID = 'fitnessapp-demo-media-ack';

function getBundleName() {
  const entry = Array.from(document.scripts || []).find((script) => /\/assets\/index-[^/]+\.js(?:\?|$)/.test(script.src || ''));
  if (!entry?.src) return 'bundle=dev';
  try {
    return `bundle=${new URL(entry.src).pathname.split('/').pop()}`;
  } catch (_) {
    return `bundle=${String(entry.src).split('/').pop()}`;
  }
}

function ensureBadge() {
  let badge = document.getElementById(ACK_ID);
  if (badge) return badge;
  badge = document.createElement('div');
  badge.id = ACK_ID;
  badge.setAttribute('role', 'status');
  Object.assign(badge.style, {
    position: 'fixed',
    left: '50%',
    bottom: '4px',
    transform: 'translateX(-50%)',
    zIndex: '9999',
    maxWidth: '97vw',
    padding: '3px 7px',
    border: '1px solid rgba(255,195,0,.48)',
    borderRadius: '5px',
    background: 'rgba(0,0,0,.92)',
    color: '#e5e7eb',
    font: '600 10px/1.25 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    pointerEvents: 'none',
  });
  document.body.appendChild(badge);
  return badge;
}

function clean(value, max = 56) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function catalogSummary(catalog) {
  const list = Array.isArray(catalog) ? catalog : [];
  const demos = list.filter((item) => String(item?.demoMedia || '').trim());
  const first = demos[0] || null;
  const parsed = first ? normalizeDemoMedia(first.demoMedia) : null;
  return {
    count: list.length,
    demoCount: demos.length,
    motion: first?.motion || '-',
    raw: first?.demoMedia || '-',
    parsed: parsed ? `${parsed.type}${parsed.source ? `/${parsed.source}` : ''}` : 'NO',
  };
}

function publish(stage, sourceCatalog, cacheCatalog) {
  const source = catalogSummary(sourceCatalog);
  const cache = catalogSummary(cacheCatalog);
  const toggleCount = document.querySelectorAll?.('[data-picker-demo-motion]')?.length || 0;
  const payload = {
    build: ACK_BUILD,
    stage,
    bundle: getBundleName(),
    source,
    cache,
    toggleCount,
    at: new Date().toISOString(),
  };
  window.__fitnessDemoMediaAck = payload;
  console.info('[DemoMediaACK]', payload);
  const badge = ensureBadge();
  badge.textContent = `ACK ${ACK_BUILD} · ${stage} · src=${source.count}/${source.demoCount} cache=${cache.count}/${cache.demoCount} · ${clean(cache.motion)} · demo=${clean(cache.raw, 42)} · parse=${cache.parsed} · toggles=${toggleCount} · ${payload.bundle}`;
  badge.title = badge.textContent;
}

export function installDemoMediaAck(app) {
  if (!app || window.__fitnessDemoMediaAckInstalled) return;
  window.__fitnessDemoMediaAckInstalled = true;

  let lastInitialCatalog = [];
  const originalGetInitialData = app.api.getInitialData.bind(app.api);
  app.api.getInitialData = async (...args) => {
    const data = await originalGetInitialData(...args);
    lastInitialCatalog = Array.isArray(data?.exerciseCatalog) ? data.exerciseCatalog : [];
    queueMicrotask(() => publish('BOOT', lastInitialCatalog, app.state.cache.exerciseCatalog));
    return data;
  };

  const originalHandleAddExerciseClick = app.methods.handleAddExerciseClick.bind(app.methods);
  app.methods.handleAddExerciseClick = function (...args) {
    const result = originalHandleAddExerciseClick(...args);
    const scan = () => publish('PICKER', lastInitialCatalog, app.state.cache.exerciseCatalog);
    setTimeout(scan, 0);
    setTimeout(scan, 150);
    return result;
  };

  publish('READY', lastInitialCatalog, app.state.cache.exerciseCatalog);
}
