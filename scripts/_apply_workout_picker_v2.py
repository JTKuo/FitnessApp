from pathlib import Path

api = Path('src/API.gs')
text = api.read_text(encoding='utf-8')

catalog_needle = """    const exerciseCatalog = _buildExerciseCatalogForUserSheet(userSheet);\n    const exerciseNames = exerciseCatalog.map(function (item) { return item.motion; });\n"""
catalog_replacement = """    const exerciseCatalog = _buildExerciseCatalogForUserSheet(userSheet);\n    const exerciseNames = exerciseCatalog.map(function (item) { return item.motion; });\n    const recentExerciseNames = _getRecentExerciseNamesForPicker(userSheet, 8);\n"""
if catalog_needle not in text:
    raise SystemExit('Exercise catalog bootstrap anchor not found')
text = text.replace(catalog_needle, catalog_replacement, 1)

return_needle = """      exerciseNames: exerciseNames, // 目標使用者的動作名稱列表\n      exerciseCatalog: exerciseCatalog // ExerciseMaster V2 runtime metadata\n"""
return_replacement = """      exerciseNames: exerciseNames, // 目標使用者的動作名稱列表\n      exerciseCatalog: exerciseCatalog, // ExerciseMaster V2 runtime metadata\n      recentExerciseNames: recentExerciseNames // Workout Picker 2.0 newest-first unique motions\n"""
if return_needle not in text:
    raise SystemExit('getInitialData return anchor not found')
text = text.replace(return_needle, return_replacement, 1)

api.write_text(text, encoding='utf-8')
