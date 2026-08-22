from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'web/src/style.css'
text = path.read_text(encoding='utf-8')
needle = "/* --- Duration Tracking v1 --- */\n"
if needle not in text:
    raise SystemExit('duration css marker not found')
fix = """/* Tracking input visibility must beat the unlayered .workout-set-inputs display:grid rule.\n   Tailwind's layered .hidden utility has lower cascade priority than this custom CSS. */\n.workout-set-inputs.hidden {\n    display: none;\n}\n\n"""
if '.workout-set-inputs.hidden {' not in text:
    text = text.replace(needle, needle + fix, 1)
path.write_text(text, encoding='utf-8')
print('duration hidden-state cascade fixed')
