from pathlib import Path

p = Path('web/index.html')
text = p.read_text(encoding='utf-8')
old = '<!-- InBody 量測 Modal (R1) -->\n    <div id="inbody-modal" class="hidden fixed inset-0 z-50 bg-black/80 flex justify-center items-center p-4">\n        <div class="card w-full max-w-md rounded-lg p-6 space-y-4">'
new = '<!-- InBody 量測 Modal (V3) -->\n    <div id="inbody-modal" class="hidden fixed inset-0 z-50 bg-black/80 flex justify-center items-center p-4">\n        <div class="card w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg p-6 space-y-4">'
if text.count(old) != 1:
    raise SystemExit(f'expected one InBody modal shell, got {text.count(old)}')
p.write_text(text.replace(old, new, 1), encoding='utf-8')
