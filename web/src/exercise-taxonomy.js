// 動作分類與 tag 的關鍵字推薦（前後端共用純函式）。
// src/ExerciseTaxonomy.gs 由 `npm run sync:pr` 自動生成，勿手改該檔。
//
// 設計要點：關鍵字一律「由長到短」比對，避免短詞誤命中——
// 例如「肩推」必須先於「推」、「划船機」必須先於「划船」、「腿彎舉」必須先於「彎舉」。

export const CATEGORY_ORDER = ['胸', '背', '肩', '臀', '腿', '手', '核心', '有氧', '其他'];

export const ALL_TAGS = [
  '推', '拉', '蹲', '髖鉸鏈',
  '槓鈴', '啞鈴', '機械', '滑輪', '自體重量', '壺鈴', '彈力帶',
  '複合', '單關節',
];

// [關鍵字, 主分類, 帶出的 tag 陣列]
const CATEGORY_RULES = [
  ['划船機', '有氧', []],
  ['腿彎舉', '腿', []],
  ['腿伸屈', '腿', []],
  ['伏地挺身', '胸', ['推']],
  ['引體向上', '背', ['拉']],
  ['髖外展', '臀', []],
  ['髖內收', '臀', []],
  ['橢圓機', '有氧', []],
  ['腕彎舉', '手', []],
  ['三頭', '手', ['推']],
  ['二頭', '手', ['拉']],
  ['側平舉', '肩', []],
  ['前平舉', '肩', []],
  ['臥推', '胸', ['推']],
  ['胸推', '胸', ['推']],
  ['夾胸', '胸', []],
  ['飛鳥', '胸', []],
  ['下拉', '背', ['拉']],
  ['划船', '背', ['拉']],
  ['聳肩', '背', []],
  ['硬舉', '背', ['拉', '髖鉸鏈']],
  ['引體', '背', ['拉']],
  ['肩推', '肩', ['推']],
  ['上舉', '肩', ['推']],
  ['臀推', '臀', ['髖鉸鏈']],
  ['髖推', '臀', ['髖鉸鏈']],
  ['橋式', '臀', ['髖鉸鏈']],
  ['擺盪', '臀', ['髖鉸鏈']],
  ['側走', '臀', []],
  ['深蹲', '腿', ['蹲']],
  ['蹲舉', '腿', ['蹲']],
  ['腿推', '腿', ['蹲']],
  ['腿伸', '腿', []],
  ['弓箭步', '腿', ['蹲']],
  ['小腿', '腿', []],
  ['彎舉', '手', ['拉']],
  ['下壓', '手', ['推']],
  ['臂屈伸', '手', ['推']],
  ['捲腹', '核心', []],
  ['棒式', '核心', []],
  ['抬腿', '核心', []],
  ['轉體', '核心', []],
  ['跑步', '有氧', []],
  ['飛輪', '有氧', []],
  ['跳繩', '有氧', []],
  ['登階', '有氧', []],
];

// [關鍵字, 對應 tag]
const EQUIPMENT_RULES = [
  ['自體重量', '自體重量'],
  ['彈力帶', '彈力帶'],
  ['史密斯', '機械'],
  ['槓鈴', '槓鈴'],
  ['啞鈴', '啞鈴'],
  ['壺鈴', '壺鈴'],
  ['滑輪', '滑輪'],
  ['纜繩', '滑輪'],
  ['機', '機械'],
  ['徒手', '自體重量'],
];

// 依關鍵字長度由長到短排序後比對，短詞才不會搶先命中
function sortRulesByKeywordLength(rules) {
  return rules.slice().sort(function (a, b) {
    return b[0].length - a[0].length;
  });
}

const SORTED_CATEGORY_RULES = sortRulesByKeywordLength(CATEGORY_RULES);
const SORTED_EQUIPMENT_RULES = sortRulesByKeywordLength(EQUIPMENT_RULES);

/**
 * 依動作名稱推薦主分類與 tag。無法辨識時回 { category: '', tags: [] }，不亂猜。
 * @param {string} name - 動作名稱。
 * @returns {{category: string, tags: string[]}}
 */
export function suggestClassification(name) {
  const empty = { category: '', tags: [] };
  if (!name || typeof name !== 'string') return empty;
  const text = name.trim();
  if (text === '') return empty;

  let category = '';
  const tags = [];

  for (let i = 0; i < SORTED_CATEGORY_RULES.length; i++) {
    const rule = SORTED_CATEGORY_RULES[i];
    if (text.indexOf(rule[0]) !== -1) {
      category = rule[1];
      for (let j = 0; j < rule[2].length; j++) {
        if (tags.indexOf(rule[2][j]) === -1) tags.push(rule[2][j]);
      }
      break; // 只採用最長（最具體）的那一條
    }
  }

  for (let i = 0; i < SORTED_EQUIPMENT_RULES.length; i++) {
    const rule = SORTED_EQUIPMENT_RULES[i];
    if (text.indexOf(rule[0]) !== -1) {
      if (tags.indexOf(rule[1]) === -1) tags.push(rule[1]);
      break; // 器材只取一種
    }
  }

  if (category === '') return empty; // 分類認不出來時，連 tag 也不猜
  return { category: category, tags: tags };
}
