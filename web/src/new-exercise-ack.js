const ACK_BUILD = 'NEACK-20260823-A1';
const ACK_ID = 'fitnessapp-new-exercise-ack';
const TARGET_ACTION = 'saveExerciseMetadata';

function getBundleName() {
  const entry = Array.from(document.scripts).find((script) => /\/assets\/index-[^/]+\.js(?:\?|$)/.test(script.src || ''));
  if (!entry?.src) return 'bundle=dev';
  try {
    return `bundle=${new URL(entry.src).pathname.split('/').pop()}`;
  } catch (_) {
    return `bundle=${entry.src.split('/').pop()}`;
  }
}

function ensureBadge() {
  let badge = document.getElementById(ACK_ID);
  if (badge) return badge;

  badge = document.createElement('div');
  badge.id = ACK_ID;
  badge.setAttribute('role', 'status');
  badge.setAttribute('aria-live', 'polite');
  Object.assign(badge.style, {
    position: 'fixed',
    left: '50%',
    bottom: '4px',
    transform: 'translateX(-50%)',
    zIndex: '9999',
    maxWidth: '96vw',
    padding: '3px 7px',
    border: '1px solid rgba(255,195,0,.45)',
    borderRadius: '5px',
    background: 'rgba(0,0,0,.88)',
    color: '#d7d9dd',
    font: '600 10px/1.25 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    pointerEvents: 'none',
  });
  document.body.appendChild(badge);
  return badge;
}

function safeText(value, max = 48) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function setAck(stage, detail = '') {
  const payload = {
    build: ACK_BUILD,
    stage,
    detail: safeText(detail, 90),
    bundle: getBundleName(),
    at: new Date().toISOString(),
  };
  const badge = ensureBadge();
  badge.textContent = `ACK ${payload.build} · ${stage}${payload.detail ? ` · ${payload.detail}` : ''} · ${payload.bundle}`;
  badge.title = badge.textContent;
  window.__fitnessNewExerciseAck = payload;
  console.info('[NewExerciseACK]', payload);
}

function setupButtonSnapshot() {
  const modal = document.getElementById('new-exercise-setup-modal');
  if (!modal || modal.classList.contains('hidden')) return null;
  const button = modal.querySelector('[data-setup-action="save"]');
  const motion = modal.querySelector('[data-setup-motion]')?.textContent?.trim() || '-';
  return {
    motion,
    disabled: !!button?.disabled,
    label: button?.textContent?.trim() || '-',
  };
}

export function installNewExerciseAck(app) {
  if (window.__fitnessNewExerciseAckInstalled) return;
  window.__fitnessNewExerciseAckInstalled = true;

  let lastOpenSignature = '';
  let fetchAttempt = 0;

  const scanSetup = () => {
    const snapshot = setupButtonSnapshot();
    if (!snapshot) {
      lastOpenSignature = '';
      return;
    }
    const signature = `${snapshot.motion}|${snapshot.disabled}|${snapshot.label}`;
    if (signature === lastOpenSignature) return;
    lastOpenSignature = signature;
    setAck('OPEN', `motion=${snapshot.motion} btn=${snapshot.disabled ? 'disabled' : 'ready'} label=${snapshot.label}`);
  };

  const scheduleScan = () => {
    setTimeout(scanSetup, 0);
    setTimeout(scanSetup, 120);
  };

  document.addEventListener('pointerdown', (event) => {
    const button = event.target?.closest?.('[data-setup-action="save"]');
    if (!button) return;
    setAck('POINTER', `disabled=${!!button.disabled} label=${button.textContent?.trim() || '-'}`);
  }, true);

  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('[data-setup-action="save"]');
    if (button) {
      setAck('CLICK', `disabled=${!!button.disabled} label=${button.textContent?.trim() || '-'}`);
      return;
    }
    scheduleScan();
  }, true);

  const originalSaveExerciseMetadata = app?.api?.saveExerciseMetadata?.bind(app.api);
  if (originalSaveExerciseMetadata) {
    app.api.saveExerciseMetadata = async (...args) => {
      fetchAttempt = 0;
      const motion = args?.[0]?.motion || '-';
      setAck('API_CALL', `motion=${motion}`);
      try {
        const result = await originalSaveExerciseMetadata(...args);
        setAck('API_OK', `motion=${result?.motion || motion}`);
        return result;
      } catch (error) {
        setAck('API_ERR', `${error?.code || error?.name || 'ERR'} ${error?.message || ''}`);
        throw error;
      }
    };
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    let action = '';
    try {
      if (typeof init?.body === 'string') action = JSON.parse(init.body)?.action || '';
    } catch (_) {
      // Non-JSON body: not one of our GAS API calls.
    }

    if (action !== TARGET_ACTION) return originalFetch(input, init);

    fetchAttempt += 1;
    setAck('FETCH', `attempt=${fetchAttempt}`);
    try {
      const response = await originalFetch(input, init);
      setAck('HTTP', `attempt=${fetchAttempt} status=${response.status}`);
      return response;
    } catch (error) {
      setAck('FETCH_ERR', `attempt=${fetchAttempt} ${error?.name || 'ERR'} ${error?.message || ''}`);
      throw error;
    }
  };

  setAck('READY', 'diagnostic installed');
  scheduleScan();
}
