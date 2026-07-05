// 將 web/src/pr-logic.js 轉為 GAS 可用的全域函式檔。
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(resolve(root, 'web/src/pr-logic.js'), 'utf8');
const out =
  '// 自動生成，勿手改。來源：web/src/pr-logic.js（執行 npm run sync:pr 更新）\n' +
  src.replaceAll('export function', 'function');
writeFileSync(resolve(root, 'src/PRLogic.gs'), out);
console.log('已生成 src/PRLogic.gs');
