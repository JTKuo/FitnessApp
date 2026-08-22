const SESSION_NOTE_ID = 'workout-session-note';

let initialized = false;

function normalizeSessionNote(value) {
  return String(value || '').replace(/\r\n/g, '\n');
}

function withSessionNote(workoutData, sessionNote) {
  const note = normalizeSessionNote(sessionNote);
  if (!Array.isArray(workoutData)) return [];
  return workoutData.map((set) => ({ ...set, session_note: note }));
}

function createSessionNoteField() {
  const workoutPage = document.getElementById('page-workout');
  const workoutList = document.getElementById('workout-list');
  if (!workoutPage || !workoutList) return null;

  const existing = document.getElementById(SESSION_NOTE_ID);
  if (existing) return existing;

  const wrapper = document.createElement('div');
  wrapper.className = 'card p-3 rounded-lg mb-4';
  wrapper.innerHTML = `
    <label for="${SESSION_NOTE_ID}" class="block text-sm font-semibold text-yellow-400 mb-1">本次訓練備註</label>
    <textarea id="${SESSION_NOTE_ID}" rows="2" class="w-full rounded-md p-2 text-sm" placeholder="例如：睡眠不足、右肩較緊、今天整體狀態良好…"></textarea>
    <p class="mt-1 text-xs text-gray-500">這是整堂訓練的備註；各動作備註仍保留在動作卡片內。</p>
  `;

  workoutList.parentNode.insertBefore(wrapper, workoutList);
  return wrapper.querySelector(`#${SESSION_NOTE_ID}`);
}

export const workoutSession = {
  init() {
    if (initialized) return;
    initialized = true;
    createSessionNoteField();
  },

  getNote() {
    return normalizeSessionNote(document.getElementById(SESSION_NOTE_ID)?.value || '');
  },

  setNote(note) {
    const input = createSessionNoteField();
    if (input) input.value = normalizeSessionNote(note);
  },

  clearNote() {
    this.setNote('');
  },

  enrichWorkoutData(workoutData) {
    return withSessionNote(workoutData, this.getNote());
  },
};

export const workoutSessionInternals = {
  SESSION_NOTE_ID,
  normalizeSessionNote,
  withSessionNote,
};
