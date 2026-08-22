from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly 1 match, found {count}: {old[:80]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


# 1) Render set type as part of the real template. No observer/decorator.
replace_once(
    'web/index.html',
    '              <span class="js-set-number w-12 text-center text-gray-400 text-sm flex-shrink-0"></span>',
    '''              <div class="w-16 flex-shrink-0 space-y-1">
                  <span class="js-set-number block text-center text-gray-400 text-sm"></span>
                  <select aria-label="組別類型" class="w-full rounded-md px-1 py-1 bg-black border border-yellow-500 text-[11px] text-center js-set-type-select">
                      <option value="working">工作</option>
                      <option value="warmup">熱身</option>
                  </select>
              </div>'''
)

# 2) Collector + add/copy-set behavior.
replace_once(
    'web/src/methods.js',
    "import { CATEGORY_ORDER, ALL_TAGS } from './exercise-taxonomy.js';",
    "import { CATEGORY_ORDER, ALL_TAGS } from './exercise-taxonomy.js';\nimport { normalizeSetType } from './set-type.js';"
)

replace_once(
    'web/src/methods.js',
    """                    let lastWeight = '';
                    let lastUnit = '公斤';
                    if (allSets.length > 0) {
                        const lastSet = allSets[allSets.length - 1];
                        lastWeight = lastSet.querySelector('.js-weight-input').value;
                        lastUnit = lastSet.querySelector('.js-unit-select').value;
                    }
""",
    """                    let lastWeight = '';
                    let lastUnit = '公斤';
                    let lastSetType = 'working';
                    if (allSets.length > 0) {
                        const lastSet = allSets[allSets.length - 1];
                        lastWeight = lastSet.querySelector('.js-weight-input').value;
                        lastUnit = lastSet.querySelector('.js-unit-select').value;
                        lastSetType = normalizeSetType(lastSet.querySelector('.js-set-type-select')?.value);
                    }
"""
)

replace_once(
    'web/src/methods.js',
    """                    newSetElement.querySelector('.js-weight-input').value = lastWeight;
                    newSetElement.querySelector('.js-unit-select').value = lastUnit;
""",
    """                    newSetElement.querySelector('.js-weight-input').value = lastWeight;
                    newSetElement.querySelector('.js-unit-select').value = lastUnit;
                    const newSetTypeSelect = newSetElement.querySelector('.js-set-type-select');
                    if (newSetTypeSelect) newSetTypeSelect.value = lastSetType;
"""
)

replace_once(
    'web/src/methods.js',
    """                    const lastWeight = lastSet.querySelector('.js-weight-input').value;
                    const lastReps = lastSet.querySelector('.js-reps-input').value;
                    const lastUnit = lastSet.querySelector('.js-unit-select').value;
""",
    """                    const lastWeight = lastSet.querySelector('.js-weight-input').value;
                    const lastReps = lastSet.querySelector('.js-reps-input').value;
                    const lastUnit = lastSet.querySelector('.js-unit-select').value;
                    const lastSetType = normalizeSetType(lastSet.querySelector('.js-set-type-select')?.value);
"""
)

replace_once(
    'web/src/methods.js',
    """                        newSet.querySelector('.js-weight-input').value = lastWeight;
                        newSet.querySelector('.js-reps-input').value = lastReps;
                        newSet.querySelector('.js-unit-select').value = lastUnit;
""",
    """                        newSet.querySelector('.js-weight-input').value = lastWeight;
                        newSet.querySelector('.js-reps-input').value = lastReps;
                        newSet.querySelector('.js-unit-select').value = lastUnit;
                        const newSetTypeSelect = newSet.querySelector('.js-set-type-select');
                        if (newSetTypeSelect) newSetTypeSelect.value = lastSetType;
"""
)

replace_once(
    'web/src/methods.js',
    """                      sets.forEach((set, index) => {
                        const weightInput = set.querySelector('.js-weight-input');
                        const repsInput = set.querySelector('.js-reps-input');
                        const unitSelect = set.querySelector('.js-unit-select');

                        const weight = parseFloat(weightInput.value) || 0;
                        const reps = parseInt(repsInput.value) || 0;
                        const unit = unitSelect.value;
""",
    """                      sets.forEach((set, index) => {
                        const weightInput = set.querySelector('.js-weight-input');
                        const repsInput = set.querySelector('.js-reps-input');
                        const unitSelect = set.querySelector('.js-unit-select');
                        const setTypeSelect = set.querySelector('.js-set-type-select');

                        const weight = parseFloat(weightInput.value) || 0;
                        const reps = parseInt(repsInput.value) || 0;
                        const unit = unitSelect.value;
                        const setType = normalizeSetType(setTypeSelect?.value);
"""
)

replace_once(
    'web/src/methods.js',
    """                            reps: reps,
                            weight_in_kg: weightInKg,
                            note: note // 將備註加入到每一組的資料中
""",
    """                            reps: reps,
                            weight_in_kg: weightInKg,
                            set_type: setType,
                            note: note // 將備註加入到每一組的資料中
"""
)

# 3) Draft keeps SetType across reloads; old drafts default to working.
replace_once(
    'web/src/workout-draft.js',
    "const STORAGE_PREFIX = 'fitnessapp_workout_draft:';",
    "import { normalizeSetType } from './set-type.js';\n\nconst STORAGE_PREFIX = 'fitnessapp_workout_draft:';"
)

replace_once(
    'web/src/workout-draft.js',
    """      const sets = [...card.querySelectorAll('.js-set-row')].map((set) => ({
        weight: set.querySelector('.js-weight-input')?.value || '',
        reps: set.querySelector('.js-reps-input')?.value || '',
        unit: set.querySelector('.js-unit-select')?.value || '公斤',
      }));
""",
    """      const sets = [...card.querySelectorAll('.js-set-row')].map((set) => ({
        weight: set.querySelector('.js-weight-input')?.value || '',
        reps: set.querySelector('.js-reps-input')?.value || '',
        unit: set.querySelector('.js-unit-select')?.value || '公斤',
        setType: normalizeSetType(set.querySelector('.js-set-type-select')?.value),
      }));
"""
)

replace_once(
    'web/src/workout-draft.js',
    """  const unitSelect = fragment.querySelector('.js-unit-select');

  if (setNumberEl) setNumberEl.textContent = `SET ${setNumber}`;
  if (weightInput) weightInput.value = setData?.weight ?? '';
  if (repsInput) repsInput.value = setData?.reps ?? '';
  if (unitSelect) unitSelect.value = setData?.unit || '公斤';
""",
    """  const unitSelect = fragment.querySelector('.js-unit-select');
  const setTypeSelect = fragment.querySelector('.js-set-type-select');

  if (setNumberEl) setNumberEl.textContent = `SET ${setNumber}`;
  if (weightInput) weightInput.value = setData?.weight ?? '';
  if (repsInput) repsInput.value = setData?.reps ?? '';
  if (unitSelect) unitSelect.value = setData?.unit || '公斤';
  if (setTypeSelect) setTypeSelect.value = normalizeSetType(setData?.setType);
"""
)

replace_once(
    'web/src/workout-draft.js',
    "      : [{ weight: '', reps: '', unit: '公斤' }];",
    "      : [{ weight: '', reps: '', unit: '公斤', setType: 'working' }];"
)

# 4) Pure helper + tests, including backwards-compatible default.
Path('web/src/set-type.js').write_text("""export const SET_TYPE = Object.freeze({
  WORKING: 'working',
  WARMUP: 'warmup',
});

export function normalizeSetType(value) {
  return String(value || '').trim().toLowerCase() === SET_TYPE.WARMUP
    ? SET_TYPE.WARMUP
    : SET_TYPE.WORKING;
}
""", encoding='utf-8')

Path('web/src/set-type.test.js').write_text("""import { describe, expect, it } from 'vitest';
import { normalizeSetType, SET_TYPE } from './set-type.js';

describe('set type', () => {
  it('defaults missing/legacy values to working', () => {
    expect(normalizeSetType()).toBe(SET_TYPE.WORKING);
    expect(normalizeSetType('')).toBe(SET_TYPE.WORKING);
    expect(normalizeSetType('unexpected')).toBe(SET_TYPE.WORKING);
  });

  it('accepts warmup case-insensitively', () => {
    expect(normalizeSetType('warmup')).toBe(SET_TYPE.WARMUP);
    expect(normalizeSetType(' WARMUP ')).toBe(SET_TYPE.WARMUP);
  });
});
""", encoding='utf-8')

# Ensure draft fingerprint changes when set type changes.
p = Path('web/src/workout-draft.test.js')
text = p.read_text(encoding='utf-8')
old = """    const noteChanged = { ...first, sessionNote: '今天腿很重' };

    expect(fingerprint(first)).not.toBe(fingerprint(repsChanged));
    expect(fingerprint(first)).not.toBe(fingerprint(noteChanged));
"""
new = """    const noteChanged = { ...first, sessionNote: '今天腿很重' };
    const setTypeChanged = {
      ...first,
      exercises: [{ name: '深蹲', note: '', sets: [{ weight: '100', reps: '5', unit: '公斤', setType: 'warmup' }] }],
    };

    expect(fingerprint(first)).not.toBe(fingerprint(repsChanged));
    expect(fingerprint(first)).not.toBe(fingerprint(noteChanged));
    expect(fingerprint(first)).not.toBe(fingerprint(setTypeChanged));
"""
if text.count(old) != 1:
    raise SystemExit('workout-draft.test.js fingerprint target not found exactly once')
p.write_text(text.replace(old, new, 1), encoding='utf-8')

print('warmup/working set UI patch applied')
