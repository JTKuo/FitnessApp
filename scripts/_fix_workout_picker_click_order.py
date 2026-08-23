from pathlib import Path

path = Path('web/src/workout-picker-v2.js')
text = path.read_text(encoding='utf-8')
needle = """        list.addEventListener('click', event => {\n            const item = event.target.closest('.js-suggestion-item');\n            if (!item || !list.contains(item)) return;\n            event.preventDefault();\n            event.stopImmediatePropagation();\n            const motion = String(item.dataset.motion || '').trim();\n            if (!motion) return;\n            bumpRecentName(app, motion);\n            if (app.state.modal.promptCallback) app.state.modal.promptCallback(motion);\n        });\n"""
replacement = needle.replace("        });\n", "        }, true);\n")
if needle not in text:
    raise SystemExit('picker result listener anchor not found')
path.write_text(text.replace(needle, replacement, 1), encoding='utf-8')
