import fs from 'node:fs';

function replaceOnce(source, needle, replacement, label) {
  if (source.includes(replacement)) return source;
  const index = source.indexOf(needle);
  if (index < 0) throw new Error(`Patch anchor not found: ${label}`);
  if (source.indexOf(needle, index + needle.length) >= 0) throw new Error(`Patch anchor not unique: ${label}`);
  return source.replace(needle, replacement);
}

const pickerPath = 'web/src/workout-picker-v2.js';
let picker = fs.readFileSync(pickerPath, 'utf8');

picker = replaceOnce(
  picker,
  "import { openNewExerciseSetup } from './new-exercise-setup.js';\n",
  "import { openNewExerciseSetup } from './new-exercise-setup.js';\nimport { normalizeDemoMedia } from './exercise-demo-media.js';\n",
  'demo media import',
);

picker = replaceOnce(
  picker,
  "                tags: rawTags.filter(tag => tag !== FAVORITE_RUNTIME_TAG),\n                favorite,\n",
  "                tags: rawTags.filter(tag => tag !== FAVORITE_RUNTIME_TAG),\n                favorite,\n                demoMedia: String(item.demoMedia || '').trim(),\n",
  'catalog demoMedia normalization',
);

picker = replaceOnce(
  picker,
  "    if (!app.state.exercisePicker.favoritePending) app.state.exercisePicker.favoritePending = {};\n    return app.state.exercisePicker;\n",
  "    if (!app.state.exercisePicker.favoritePending) app.state.exercisePicker.favoritePending = {};\n    if (typeof app.state.exercisePicker.demoOpenMotion !== 'string') app.state.exercisePicker.demoOpenMotion = '';\n    return app.state.exercisePicker;\n",
  'picker demo state',
);

const oldRender = `function renderExerciseItem(list, item, options = {}) {\n    if (options.create) {\n        list.appendChild(createExerciseButton(item, options));\n        return;\n    }\n\n    const row = document.createElement('div');\n    row.className = 'picker-exercise-row';\n    row.appendChild(createExerciseButton(item));\n\n    const favorite = document.createElement('button');\n    favorite.type = 'button';\n    favorite.className = \`picker-favorite-toggle\${item.favorite ? ' is-active' : ''}\`;\n    favorite.dataset.pickerFavoriteMotion = item.motion;\n    favorite.setAttribute('aria-pressed', item.favorite ? 'true' : 'false');\n    favorite.setAttribute('aria-label', item.favorite ? \`取消收藏 \${item.motion}\` : \`收藏 \${item.motion}\`);\n    favorite.textContent = item.favorite ? '★' : '☆';\n    if (options.favoritePending) {\n        favorite.disabled = true;\n        favorite.setAttribute('aria-busy', 'true');\n    }\n    row.appendChild(favorite);\n    list.appendChild(row);\n}\n`;

const newRender = `function createDemoMediaPanel(item, media) {\n    const panel = document.createElement('div');\n    panel.className = 'picker-demo-panel';\n    panel.dataset.pickerDemoPanel = item.motion;\n\n    const showError = () => {\n        panel.innerHTML = '';\n        const message = document.createElement('div');\n        message.className = 'picker-demo-error';\n        message.textContent = '示範媒體載入失敗';\n        panel.appendChild(message);\n    };\n\n    if (media.type === 'youtube') {\n        const iframe = document.createElement('iframe');\n        iframe.title = \`\${item.motion} 動作示範\`;\n        iframe.loading = 'lazy';\n        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';\n        iframe.referrerPolicy = 'strict-origin-when-cross-origin';\n        iframe.setAttribute('allowfullscreen', '');\n        iframe.src = media.src;\n        panel.appendChild(iframe);\n        return panel;\n    }\n\n    if (media.type === 'video') {\n        const video = document.createElement('video');\n        video.controls = true;\n        video.playsInline = true;\n        video.preload = 'metadata';\n        video.setAttribute('aria-label', \`\${item.motion} 動作示範\`);\n        video.addEventListener('error', showError, { once: true });\n        video.src = media.src;\n        panel.appendChild(video);\n        return panel;\n    }\n\n    const image = document.createElement('img');\n    image.alt = \`\${item.motion} 動作示範\`;\n    image.loading = 'lazy';\n    image.decoding = 'async';\n    image.addEventListener('error', showError, { once: true });\n    image.src = media.src;\n    panel.appendChild(image);\n    return panel;\n}\n\nfunction renderExerciseItem(list, item, options = {}) {\n    if (options.create) {\n        list.appendChild(createExerciseButton(item, options));\n        return;\n    }\n\n    // Important: normalizeDemoMedia only parses the URL. No image/video/iframe is\n    // created until demoOpen is true, so opening the Picker does not fetch media.\n    const demoMedia = normalizeDemoMedia(item.demoMedia);\n    const row = document.createElement('div');\n    row.className = \`picker-exercise-row\${demoMedia ? ' has-demo-media' : ''}\`;\n    row.appendChild(createExerciseButton(item));\n\n    if (demoMedia) {\n        const demo = document.createElement('button');\n        demo.type = 'button';\n        demo.className = \`picker-demo-toggle\${options.demoOpen ? ' is-active' : ''}\`;\n        demo.dataset.pickerDemoMotion = item.motion;\n        demo.setAttribute('aria-expanded', options.demoOpen ? 'true' : 'false');\n        demo.setAttribute('aria-label', options.demoOpen ? \`收合 \${item.motion} 示範\` : \`查看 \${item.motion} 示範\`);\n        demo.textContent = options.demoOpen ? '▴' : '▶';\n        row.appendChild(demo);\n    }\n\n    const favorite = document.createElement('button');\n    favorite.type = 'button';\n    favorite.className = \`picker-favorite-toggle\${item.favorite ? ' is-active' : ''}\`;\n    favorite.dataset.pickerFavoriteMotion = item.motion;\n    favorite.setAttribute('aria-pressed', item.favorite ? 'true' : 'false');\n    favorite.setAttribute('aria-label', item.favorite ? \`取消收藏 \${item.motion}\` : \`收藏 \${item.motion}\`);\n    favorite.textContent = item.favorite ? '★' : '☆';\n    if (options.favoritePending) {\n        favorite.disabled = true;\n        favorite.setAttribute('aria-busy', 'true');\n    }\n    row.appendChild(favorite);\n\n    if (demoMedia && options.demoOpen) row.appendChild(createDemoMediaPanel(item, demoMedia));\n    list.appendChild(row);\n}\n`;

picker = replaceOnce(picker, oldRender, newRender, 'exercise item demo rendering');

picker = replaceOnce(
  picker,
  "    items.forEach(item => renderExerciseItem(list, item, {\n        favoritePending: !!state.favoritePending[item.motion],\n    }));\n",
  "    items.forEach(item => renderExerciseItem(list, item, {\n        favoritePending: !!state.favoritePending[item.motion],\n        demoOpen: state.demoOpenMotion === item.motion,\n    }));\n",
  'render demo state',
);

picker = replaceOnce(
  picker,
  "        list.addEventListener('click', event => {\n            const favorite = event.target.closest('[data-picker-favorite-motion]');\n",
  "        list.addEventListener('click', event => {\n            const demo = event.target.closest('[data-picker-demo-motion]');\n            if (demo && list.contains(demo)) {\n                event.preventDefault();\n                event.stopImmediatePropagation();\n                const motion = String(demo.dataset.pickerDemoMotion || '').trim();\n                if (!motion) return;\n                const state = pickerState(app);\n                state.demoOpenMotion = state.demoOpenMotion === motion ? '' : motion;\n                renderPicker(app);\n                return;\n            }\n\n            const favorite = event.target.closest('[data-picker-favorite-motion]');\n",
  'demo delegated event',
);

picker = replaceOnce(
  picker,
  "        state.tagOpen = false;\n        const input = document.getElementById('autocomplete-input');\n",
  "        state.tagOpen = false;\n        state.demoOpenMotion = '';\n        const input = document.getElementById('autocomplete-input');\n",
  'reset demo state on open',
);

fs.writeFileSync(pickerPath, picker);

const mainPath = 'web/src/main.js';
let main = fs.readFileSync(mainPath, 'utf8');
main = replaceOnce(
  main,
  "import './workout-picker-v2.css';\n",
  "import './workout-picker-v2.css';\nimport './workout-demo-media.css';\n",
  'demo media css import',
);
fs.writeFileSync(mainPath, main);
