from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'anchor not found in {path}: {old[:80]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
    'web/src/main.js',
    "import './workout-picker-v2.css';\n",
    "import './workout-picker-v2.css';\nimport './new-exercise-setup.css';\n",
)

replace_once(
    'web/src/api.js',
    "  getExerciseCatalog: (userEmail = null) => apiCall('getExerciseCatalog', { userEmail }),\n",
    "  getExerciseCatalog: (userEmail = null) => apiCall('getExerciseCatalog', { userEmail }),\n  saveExerciseMetadata: (metadata, userEmail = null) => apiCall('saveExerciseMetadata', { metadata, userEmail }),\n",
)

replace_once(
    'src/API.gs',
    "  getExerciseCatalog:               function (email, p) { return getExerciseCatalog(email, p.userEmail || null); },\n",
    "  getExerciseCatalog:               function (email, p) { return getExerciseCatalog(email, p.userEmail || null); },\n  saveExerciseMetadata:              function (email, p) { return saveExerciseMetadata(email, p.userEmail || null, p.metadata); },\n",
)

replace_once(
    'web/src/workout-picker-v2.js',
    "import { CATEGORY_ORDER } from './exercise-taxonomy.js';\n",
    "import { CATEGORY_ORDER } from './exercise-taxonomy.js';\nimport { openNewExerciseSetup } from './new-exercise-setup.js';\n",
)

replace_once(
    'web/src/workout-picker-v2.js',
    "        ? '建立新動作 · 預設為重量 × 次數'\n",
    "        ? '建立新動作 · 可設定記錄方式、左右與休息'\n",
)

replace_once(
    'web/src/workout-picker-v2.js',
    """            bumpRecentName(app, motion);\n            app.methods.addExercise(motion);\n            app.ui.showAutocompleteModal(false);\n""",
    """            if (hasExactMotion(getCatalog(app), motion)) {\n                bumpRecentName(app, motion);\n                app.methods.addExercise(motion);\n                app.ui.showAutocompleteModal(false);\n                return;\n            }\n            openNewExerciseSetup(app, motion, {\n                onCreated: metadata => bumpRecentName(app, metadata.motion),\n            });\n""",
)
