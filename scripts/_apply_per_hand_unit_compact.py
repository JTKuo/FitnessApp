from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one match, got {count}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
    'web/src/methods.js',
    """                        if (kgOption) kgOption.textContent = loadMode === LOAD_MODE.PER_HAND ? 'kg/手' : 'kg';\n                        if (lbOption) lbOption.textContent = loadMode === LOAD_MODE.PER_HAND ? 'lb/手' : 'lb';""",
    """                        if (kgOption) kgOption.textContent = 'kg';\n                        if (lbOption) lbOption.textContent = 'lb';""",
)

replace_once(
    'web/src/workout-draft.js',
    """    if (kgOption) kgOption.textContent = normalizedLoadMode === LOAD_MODE.PER_HAND ? 'kg/手' : 'kg';\n    if (lbOption) lbOption.textContent = normalizedLoadMode === LOAD_MODE.PER_HAND ? 'lb/手' : 'lb';""",
    """    if (kgOption) kgOption.textContent = 'kg';\n    if (lbOption) lbOption.textContent = 'lb';""",
)

replace_once(
    'web/src/style.css',
    """\n.workout-exercise-card .workout-unit-select[data-load-mode=\"per_hand\"] {\n    width: 3.8rem;\n    font-size: 0.67rem;\n}\n""",
    "\n",
)

# Guard the intended presentation contract: LoadMode remains data-only in the row;
# the compact unit control is always kg/lb. The summary may still say kg/手.
methods = Path('web/src/methods.js').read_text(encoding='utf-8')
draft = Path('web/src/workout-draft.js').read_text(encoding='utf-8')
css = Path('web/src/style.css').read_text(encoding='utf-8')
if "kgOption.textContent = 'kg'" not in methods or "lbOption.textContent = 'lb'" not in methods:
    raise SystemExit('methods.js compact unit labels missing')
if "kgOption.textContent = 'kg'" not in draft or "lbOption.textContent = 'lb'" not in draft:
    raise SystemExit('workout-draft.js compact unit labels missing')
if '.workout-unit-select[data-load-mode="per_hand"]' in css:
    raise SystemExit('per_hand unit width override still present')
