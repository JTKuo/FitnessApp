// 將 web/src 的共用純函式模組轉為 GAS 可用的全域函式檔。
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TARGETS = [
  ['web/src/pr-logic.js', 'src/PRLogic.gs'],
  ['web/src/body-history.js', 'src/BodyHistory.gs'],
];
for (const [srcPath, outPath] of TARGETS) {
  const src = readFileSync(resolve(root, srcPath), 'utf8');
  const out =
    `// 自動生成，勿手改。來源：${srcPath}（執行 npm run sync:pr 更新）\n` +
    src.replaceAll('export function', 'function');
  writeFileSync(resolve(root, outPath), out);
  console.log(`已生成 ${outPath}`);
}
