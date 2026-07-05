# FitnessApp v2

個人化健身暨健康追蹤系統 — 二次開發版。
基於 FitnessWebApp 的 GAS MVP（Google Apps Script + Google Sheets + Google Drive）。

**正式網址：https://jtkuo.github.io/FitnessApp/**

## 專案結構

```
FitnessApp\
├── src\                  # clasp 推送目錄（GAS 程式碼）
│   ├── API.gs            # JSON API 入口（doPost 統一路由、資料存取、PR 計算、分析）
│   ├── Auth.gs           # 驗證（token、admin 白名單）
│   ├── Internal.gs       # 內部輔助函式（使用者 Sheet 管理、批次讀寫）
│   ├── Config.gs         # 設定與常數（Script Properties、Sheet/欄位名稱）
│   ├── PRLogic.gs        # PR 計算邏輯（自動生成）
│   └── appsscript.json   # GAS 專案設定（時區、進階服務、Web App 權限）
├── web\                  # Vite 前端（部署至 GitHub Pages）
│   ├── src\
│   │   ├── main.js
│   │   └── ...
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── .github\workflows\    # GitHub Actions（自動部署前端）
│   └── deploy.yml
├── scripts\              # 輔助腳本
│   └── sync-pr-logic.mjs # PR 邏輯同步（web → GAS）
├── doc\                  # 文件
│   └── Google sheet 資料結構說明.md
├── .clasp.json.example   # clasp 設定範本
└── .gitignore
```

## 首次設定

1. 安裝工具並登入：

   ```
   npm install -g @google/clasp
   clasp login
   ```

2. 到 https://script.google.com/home/usersettings 開啟「Google Apps Script API」。

3. 建立新的 GAS 專案（不要動舊 MVP）：

   ```
   clasp create --title "FitnessApp v2" --type webapp --rootDir ./src
   ```

   或複製 `.clasp.json.example` 為 `.clasp.json` 並填入既有 Script ID。

4. 推送程式碼：`clasp push`

## 環境隔離（重要）

v2 開發期間不可操作正式資料。在新 GAS 專案的 **專案設定 → 指令碼屬性 (Script Properties)** 設定：

| 屬性 | 說明 |
|---|---|
| `ADMIN_EMAIL` | 管理者（教練）Email |
| `DATA_FOLDER_ID` | 測試用 Drive 資料夾 ID（存放各使用者的 Google Sheet） |
| `PHOTOS_FOLDER_ID` | 測試用 Drive 資料夾 ID（存放體態照片） |
| `OAUTH_CLIENT_ID` | Google OAuth 用戶端 ID（前端 GIS 登入與後端 aud 驗證共用） |
| `USER_WHITELIST` | 允許登入的 email 白名單（逗號分隔；ADMIN_EMAIL 自動併入） |

建議複製一份正式使用者的 Sheet 到測試資料夾當假資料。

## 開發流程

### 後端（GAS）

```bash
clasp push        # 本機 → 雲端（同步至 Google Apps Script）
clasp open        # 開啟線上編輯器
clasp pull        # 雲端 → 本機（若在線上改過）
```

**重要：** 修改後端程式碼後，推送需兩步：

```bash
clasp push        # 第一步：推送程式碼
clasp deploy --deploymentId <YOUR_ID> --description "update"  # 第二步：部署到 /exec
```

只執行 `clasp push` 不會更新正式 `/exec` URL 的版本，需要 `clasp deploy` 才會生效。

### 前端（Vite + GitHub Pages）

```bash
cd web
npm run dev       # 本機開發（http://localhost:5173）
npm run test      # 運行 Vitest（PR 邏輯驗證）
npm run build     # 打包生產版本
git push          # 推送至 GitHub 後自動部署（GitHub Actions）
```

前端每次 `git push` 即自動部署至 GitHub Pages。

## 版控

```
git init
git add .
git commit -m "init: GAS MVP baseline"
```

先 commit MVP 原始碼當 baseline，之後所有改動都有得比對。
