# doc/ — 定稿技術文件

此目錄放**已定稿、與程式碼一起版控的技術參考文件**：資料模型、schema、設計系統。
功能實作以這裡的文件為準；要改變核心資料模型，應先更新對應文件再改程式碼。

| 檔案 | 內容 |
|---|---|
| `FitnessApp-Schema-V3.md` | 資料結構與產品架構定稿（source of truth 原則、Workout/Session/ExerciseMaster 資料模型、migration 原則） |
| `FitnessApp-UIUX-System.md` | UI/UX 設計系統（brand tokens、字級、icon、motion、canonical 元件） |
| `Google sheet 資料結構說明.md` | 各分頁與欄位的實際結構 |

## 什麼**不該**放這裡

- **過程性的規劃與思考草稿**（brainstorming 產出的 spec / plan）
  → 留在本機的 `docs/`（**注意有 s**），該目錄已被 `.gitignore` 排除，永不進版控。
- **執行進度追蹤**（phase 勾選、待辦）
  → 放 GitHub Issue（目前為 [#1 FitnessApp Roadmap](https://github.com/JTKuo/FitnessApp/issues/1)），
  因為進度會頻繁變動，不適合與程式碼一起版控。

## 命名陷阱

`doc/`（本目錄，**進版控**）與 `docs/`（本機規劃，**被 gitignore**）只差一個字母。
新增檔案前先確認放對地方——放錯會讓草稿意外公開。
