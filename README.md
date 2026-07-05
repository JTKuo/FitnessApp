# FitnessApp v2

個人化健身暨健康追蹤系統 — 二次開發版。
基於 FitnessWebApp 的 GAS MVP（Google Apps Script + Google Sheets + Google Drive）。

## 專案結構

```
FitnessApp\
├── src\                  # clasp 推送目錄（GAS 程式碼）
│   ├── API.gs            # 前端 API 接口（doGet、資料存取、PR 計算、分析）
│   ├── Internal.gs       # 內部輔助函式（使用者 Sheet 管理、批次讀寫）
│   ├── Config.gs         # 設定與常數（Script Properties、Sheet/欄位名稱）
│   ├── index.html        # SPA 前端（Tailwind、Chart.js、Cal-Heatmap）
│   └── appsscript.json   # GAS 專案設定（時區、進階服務、Web App 權限）
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

建議複製一份正式使用者的 Sheet 到測試資料夾當假資料。

## 開發流程

```
clasp push        # 本機 → 雲端
clasp open        # 開啟線上編輯器
clasp pull        # 雲端 → 本機（若在線上改過）
```

- 測試：部署一次「測試部署」，用結尾為 `/dev` 的 URL，每次 push 即時生效。
- 正式：用 `/exec` URL，透過「部署 → 管理部署」更新版本。

## 版控

```
git init
git add .
git commit -m "init: GAS MVP baseline"
```

先 commit MVP 原始碼當 baseline，之後所有改動都有得比對。
