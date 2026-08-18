# FitnessApp Schema V3 / Product Architecture 定稿

> 定稿日期：2026-08-18
>
> 目的：把目前 FitnessApp 的資料結構、產品方向、近期修改事項與未來 migration 原則整理成單一基準文件。後續功能設計與實作以此文件為準，若要改變核心資料模型，應先更新本文件。

---

## 1. 專案定位

FitnessApp 現階段定位為：

- 個人重量訓練紀錄工具
- 長期身體組成與照片追蹤工具
- 已具備教練 / 管理員檢視學員資料的雛形
- 未來可逐步發展為「個人訓練 OS + Coach / Client 平台」

目前不急著改成大型 SaaS，也不急著遷離 GAS / Google Sheets。近期優先把「資料可靠、訓練現場好用、資料模型可擴充」做好。

---

## 2. 現行系統架構：保留

```text
GitHub Pages / Vite 前端
        ↓ HTTPS JSON API
Google Apps Script
        ↓
Google Sheets + Google Drive
```

現階段保留：

- GitHub Pages / Vite 前端
- GAS JSON API
- 一個使用者一份 Spreadsheet
- 一個使用者一個 Photos Drive folder
- Sheet 保存 Drive file ID
- 3 小時 sliding HMAC session
- session token 存 localStorage
- 每次成功 API 續期
- 每次 session 驗證重新檢查 whitelist
- `MAX_CONCURRENT_REQUESTS = 3`
- 唯讀 API transport failure retry
- 寫入 API不自動 retry

近期不做：

- 不延長 session 至 24 小時或 7 天
- 不急著 GAS → Firebase / Supabase / Cloud Run
- 不先重寫 Native App
- 不先大改照片 Drive 資料夾結構

---

## 3. 資料責任：Source of Truth 原則

### 3.1 Google Sheet

正式資料來源（source of truth）。

### 3.2 localStorage

只負責：

- session token
- 尚未成功寫入後端的 Workout Draft

不得當作唯一正式訓練紀錄。

### 3.3 CacheService

只保存可重新產生的資料，例如：

- analysis data
- exercise names
- templates（視效能需要）
- exercise catalog / classification map

Cache 可隨時清除，不得成為唯一資料來源。

### 3.4 衍生資料

`PRs`、`Bests`、未來各種 Summary / Analytics 都視為可由原始資料重建的 materialized / derived data。

`WorkoutLog` 不可依賴 PRs / Bests 才能還原訓練歷史。

---

## 4. 使用者資料檔案：保留一人一份 Spreadsheet

每個使用者 Spreadsheet 現有 / 預計結構：

```text
Profile
WorkoutLog
WorkoutSessions        ← V3 新增
Templates
ExerciseMaster
InBodyLog
BodyPhotos / Media
PRs
PR_Log
Bests
```

月份頁籤（如 `2025-08`、`2025-09`、`2025-10`）視為舊版報表 / 歷史結構。

### 月份頁籤處理原則

1. 先確認程式已完全不讀寫月份頁籤。
2. 確認歷史訓練都存在 WorkoutLog。
3. 先隱藏或移到 Archive。
4. 觀察一段時間後再決定是否刪除。

新功能不得再依賴月份頁籤。

---

# 5. Workout 資料模型 V3

## 5.1 WorkoutLog：保留「一組一列」

現有一組一列的方向正確，繼續保留。

V3 目標欄位：

| 欄位 | 用途 |
|---|---|
| `SessionId` | 此組屬於哪一次訓練 |
| `Date` | 訓練日期 |
| `ExerciseId` | ExerciseMaster 唯一 ID |
| `Motion` | 當時動作名稱快照 |
| `SetNo` | 第幾組 |
| `SetType` | `warmup` / `working`；未來可擴充 |
| `TrackingType` | `weight_reps` / `duration` / `distance` 等 |
| `Weight` | 使用者輸入重量 |
| `Unit` | kg / lb |
| `WeightKg` | 統一分析使用重量 |
| `Reps` | 次數 |
| `DurationSec` | 秒數型動作 |
| `Distance` | 未來距離型動作 |
| `Side` | `left` / `right` / `both` |
| `LoadMode` | `total` / `per_hand` / `bodyweight` / `assisted` 等 |
| `RIR` | 預留；未來訓練強度資料 |
| `RestSec` | 預留；可記錄實際休息 |
| `Note` | 單組備註 |

### 範例

槓鈴臥推：

```text
TrackingType = weight_reps
Weight = 80
Reps = 8
Side = both
LoadMode = total
```

棒式：

```text
TrackingType = duration
DurationSec = 60
```

保加利亞分腿蹲：

```text
TrackingType = weight_reps
Weight = 20
LoadMode = per_hand
Side = left
Reps = 10
```

---

## 5.2 不立即刪除「動作總結 / 本日總結」

目前 WorkoutLog 仍可能有：

- `動作總結`
- `本日總結`

V3 的長期方向是停止把 Summary 當作 WorkoutLog 特殊列，但採漸進式 migration：

1. 舊資料全部保留。
2. 先建立 WorkoutSessions。
3. 新程式可同時理解舊格式與新格式。
4. 分析 / PR / Dashboard 改為從真實 set rows + WorkoutSessions 取得資料。
5. 全部確認穩定後，新訓練才停止新增特殊 Summary rows。
6. 舊 Summary rows 最後才評估是否 migration / 保留。

### 重點

「停止 Summary row」不是不要總容量。

容量仍保留：

```text
Set Volume       = 單組容量
Exercise Volume  = 同動作 sets 加總
Session Volume   = 整場 Workout sets 加總
```

只是 Summary 應作為計算結果 / Session summary，而不是假裝成一組訓練資料。

---

# 6. WorkoutSessions：V3 核心新增表

新增 `WorkoutSessions`，正式表示「一次訓練」。

建議欄位：

| 欄位 | 用途 |
|---|---|
| `SessionId` | 唯一 ID |
| `Date` | 訓練日期 |
| `WorkoutName` | Push A / Pull A 等 |
| `ProgramId` | 未來課表 ID |
| `ProgramWeek` | 第幾週 |
| `ProgramSessionId` | 課表內哪一堂 |
| `SessionNote` | 全日備註 |
| `TotalVolume` | 本次總容量（可重算） |
| `WorkingSets` | 工作組數（可重算） |
| `StartedAt` | 預留 |
| `CompletedAt` | 預留 |
| `DurationSec` | 預留 |
| `Status` | completed / draft / cancelled 等，未來使用 |

### WorkoutSessions 解決的功能

- 全日備註
- 本日總容量
- 工作組統計
- 訓練時間
- 週期課表對應
- 課表完成率
- 教練派課
- 未來 session-level 疲勞 / adherence 分析

---

# 7. ExerciseMaster V2

目前：

```text
Motion | Category | Tags
```

保留並升級成真正的 Exercise metadata table。

建議欄位：

| 欄位 | 用途 |
|---|---|
| `ExerciseId` | 唯一 ID |
| `Motion` | 顯示名稱 |
| `Category` | 胸 / 背 / 腿 / 肩 / 手 / 核心等 |
| `Tags` | 槓鈴 / 啞鈴 / Cable / 拉 / 髖鉸鏈等 |
| `TrackingType` | weight_reps / duration / distance 等 |
| `LoadMode` | total / per_hand / bodyweight / assisted |
| `Laterality` | bilateral / unilateral |
| `DefaultRestSec` | 預設休息時間 |
| `DemoMedia` | 未來 GIF / 影片 / media ID |
| `Active` | 是否仍顯示在選單 |

### 原則

Workout UI 不得針對特定動作名稱 hard-code。

錯誤方向：

```js
if (exerciseName === '棒式') ...
if (exerciseName === '北歐彎舉') ...
```

正確方向：

```text
ExerciseMaster metadata
        ↓
Workout UI 自動決定輸入介面
```

---

# 8. 暖身資料模型

分兩種情況。

## 8.1 Warm-up Set

例如 Bench：

```text
20 × 15  warmup
40 × 10  warmup
60 × 5   warmup
80 × 8   working
```

由 WorkoutLog `SetType` 處理。

## 8.2 Warm-up Exercise

例如：

- Band Pull Apart
- 肩關節活動
- Hip Mobility

這些仍是 ExerciseMaster 裡的正常 Exercise。

兩者不可混為同一概念。

---

# 9. Workout Draft：最高優先可靠性功能

新增前端 `web/src/workout-draft.js`。

要求：

- 使用 localStorage
- key 包含使用者，例如 `fitnessapp_workout_draft:<email>`
- debounce 約 500ms
- `visibilitychange → hidden` 強制存一次
- App 重開 / refresh / 手機回收頁面後自動 restore
- 草稿至少可完整重建：日期、動作、sets、weight、reps、unit，以及 V3 新欄位
- 新增 / 刪除動作、增刪組、複製組、載入 template、修改日期等也需觸發保存

### 清除 draft 的 commit point

`saveWorkoutData()` 成功寫入 WorkoutLog 後立即清除 draft。

不要等待 `processWorkoutForPRs()` 成功才清除，避免 WorkoutLog 已寫入但 PR 後處理失敗造成使用者再次提交、重複寫入。

---

# 10. Workout UX 2.0

## 10.1 Timer 2.0

不要以單純 `secondsLeft--` 當唯一時間來源。

改用：

```text
timerEndsAt = 現在 + rest duration
```

畫面回到前景時由 `timerEndsAt - now` 重算。

未來可支援：

- 每個 Exercise 自訂 default rest
- +15 / -15
- 完成 Set 自動啟動
- PWA / App notification / vibration

## 10.2 自訂數字輸入

重量、reps、duration 不應依賴完整手機鍵盤。

優先設計：

- Weight：快速 +/- 1.25 / 2.5 / 5 等
- Reps：`- / +` 或常用 reps 快捷鍵
- Duration：30 / 45 / 60 / 90 秒等快捷鍵

只有真正文字欄位才叫出系統文字鍵盤。

## 10.3 動作 Picker 2.0

動作數量變多後排序優先：

1. 今天課表
2. 最近使用
3. 我的最愛
4. 肌群 / Tags
5. 搜尋全部

不能讓 ExerciseMaster 越大，使用體驗反而越差。

## 10.4 GIF / Demo

不建議 Workout 畫面大量自動播放 GIF。

建議放在：

- 選動作 modal 的預覽
- Exercise card 的資訊按鈕

按需載入。

---

# 11. Templates → Program / Cycle 演進

目前 Templates：

```text
TemplateName | ExerciseName | Order
```

短期保留。

長期 Program 系統應能描述：

```text
Program
  ↓
Week
  ↓
Workout / Session
  ↓
Exercise Prescription
```

未來預計新增：

- `Programs`
- `ProgramWorkouts`
- `ProgramExercises`
- `ProgramAssignments`

Prescription 未來可包含：

- sets
- rep range
- RIR / RPE
- rest
- warmup requirements
- exercise order

### Program 同時支援

- 週期性課表統計
- Coach 派課
- adherence
- 計畫 vs 實際
- 每週 / 每 cycle 成效分析

因此「週期統計」與「Admin 派送課表」必須共用同一套 Program model，不分開 patch。

---

# 12. Admin / Coach UI

長期不再只用一般使用者畫面 + User Switcher。

Coach / Admin 首頁應逐步變成：

```text
Clients
├ 最後訓練時間
├ 本週完成率
├ PR
├ 體重 / 身體組成趨勢
├ 未完成課表警示
└ 需要注意的學員
```

學員詳細頁：

- Overview
- Program
- Workouts
- Progress
- Body / InBody
- Photos
- Coach Notes

Program 系統成熟後加入「派送課表」。

---

# 13. Profile / InBody V2

## 13.1 Profile

Profile 現在包含三類資訊：

1. 基本資料：name / age / gender / height
2. 最新健康狀態：weight / bodyfat / smm / bfm / bmi / vfi / inbody_score
3. 評估 / 訓練方向：frequency / lifestyle / history / static assessment / dynamic assessment / training direction 等

短期不拆表。

### 定義

Profile 裡的 InBody 相關欄位是「最新快照」，不是歷史 source of truth。

## 13.2 InBodyLog

目前程式已有：

```text
id | date | weight | bodyfat | smm | photo_id
```

V2 建議擴充為：

| 欄位 | 用途 |
|---|---|
| `id` | 唯一 ID |
| `date` | 量測日期 |
| `weight` | 體重 |
| `bodyfat` | 體脂率 |
| `smm` | 骨骼肌重 |
| `bfm` | 體脂肪重 |
| `bmi` | BMI |
| `vfi` | 內臟脂肪等級 |
| `inbody_score` | InBody 分數 |
| `photo_id` | 報告照片 |
| `note` | 可選 |

### Source of truth

```text
InBodyLog = 歷史正式資料
        ↓ 最新一筆同步
Profile = 最新狀態快照
```

新增 / 修改 InBody 時，所有最新欄位應一致同步，避免 Profile 的 `bfm / bmi / vfi / inbody_score` 停留在舊資料。

---

# 14. Photos / Media

目前 Drive：

```text
Photos/
└ user@email.com/
   ├ date-front.jpg
   ├ date-side.jpg
   ├ date-back.jpg
   └ inbody_....jpg
```

此結構現階段保留，不必每日期拆 folder。

程式以 Drive File ID 關聯，Drive folder 主要負責檔案儲存。

長期如媒體種類增加，可將 `BodyPhotos` 演進為通用 `Media` metadata：

- body_progress / front
- body_progress / side
- body_progress / back
- inbody / report
- exercise_video
- assessment_photo

此項非近期優先。

---

# 15. Whitelist / User Access

目前有兩種來源：

1. Drive 最上層 Whitelist Sheet：`Email | Role | Status`
2. GAS Script Properties：`ADMIN_EMAIL` + `USER_WHITELIST`

長期必須只保留一個權限 source of truth，避免 Sheet 與 Script Properties 不一致。

未來建議朝：

```text
Users / Access
Email | Role | Status
```

以及需要時：

```text
CoachClients
CoachEmail | ClientEmail | Status
```

但 Authentication 屬高風險區域，近期不與 Workout V3 同時修改。等 Coach / Admin 系統階段再處理。

---

# 16. PR / Bests

目前保留。

正式定義：

```text
WorkoutLog = 原始事實
PRs / Bests = 可重新計算的衍生資料
```

任何 PR / Bests 異常，都應能從 WorkoutLog 重新 rebuild。

---

# 17. 首頁效能與 Cache

現況：

- `getInitialData()` 後仍另外載入 InBody
- `exerciseNames` 初始化會掃 WorkoutLog
- Analysis 已有 CacheService
- concurrency / read-only retry 已完成

待做：

1. 將 InBody records 合併進 bootstrap / initial data
2. `exerciseNames` 加 CacheService
3. Workout 成功寫入後清 `exerciseNames` cache
4. 評估 Templates / Exercise Catalog cache
5. API timing / retry telemetry

Telemetry 至少記：

```text
action
duration
attempt
retry count
HTTP / transport error
```

---

# 18. PWA / App 路線

近期：

```text
Web → 強化 PWA
```

先解決：

- Draft persistence
- Timer resilience
- 健身房輸入 UX
- Offline / interruption tolerance

未來若真正需要：

- HealthKit / Health Connect
- 背景通知
- 更可靠的休息提醒
- SQLite offline sync
- 原生相機能力

再考慮：

```text
Vite → Capacitor → iOS / Android
```

即使包成 App，GAS 仍可繼續當 HTTPS backend；App 化與 backend migration 是兩個獨立決策。

---

# 19. 實作階段定稿

## Phase 1 — Reliability + Workout UX

最高優先：

- [ ] Workout Draft
- [ ] Session note 第一版（若 WorkoutSessions 尚未建立，可先前端保留設計、與 Phase 2 一起落地）
- [ ] Timer 2.0
- [ ] 自訂數字輸入 UX

成功標準：

> 在健身房可以放心完全依賴 FitnessApp，不因切 App / 鎖屏 / reload 而失去當次紀錄。

## Phase 2 — Schema V3 Foundation

- [ ] 新增 WorkoutSessions
- [ ] WorkoutLog 新增 SessionId
- [ ] ExerciseMaster V2 metadata
- [ ] Flexible Set Model：TrackingType / SetType / Side / LoadMode / DurationSec
- [ ] Warmup / Working set
- [ ] InBodyLog V2 欄位一致化

成功標準：

> 不再為每種特殊動作寫例外邏輯，資料模型能自然表達重量、秒數、單邊、暖身等訓練。

## Phase 3 — Workout Intelligence UX

- [ ] 動作 Picker 2.0
- [ ] 最近使用 / 最愛 / tags / category
- [ ] Demo GIF / 影片按需載入
- [ ] 每動作預設 rest
- [ ] RIR 第一版評估

## Phase 4 — Performance / Observability

- [ ] bootstrap 合併 InBody
- [ ] exerciseNames cache
- [ ] 其他低頻 cache
- [ ] API telemetry

## Phase 5 — Program / Cycle

- [ ] Programs
- [ ] ProgramWorkouts
- [ ] ProgramExercises
- [ ] ProgramAssignments
- [ ] 週期性統計
- [ ] Program vs Actual / adherence

## Phase 6 — Coach Platform

- [ ] 獨立 Admin / Coach UI
- [ ] Client dashboard
- [ ] 派送課表
- [ ] 教練備註 / alerts
- [ ] Users / Whitelist source of truth 統一
- [ ] Coach / Client 關係與權限

---

# 20. Migration 原則

所有核心資料修改採「加法式 migration」，不直接破壞既有資料。

```text
現有 Schema 繼續可跑
        ↓
新增新 Sheet / 新欄位
        ↓
新程式雙格式相容
        ↓
新寫入逐步改成 V3
        ↓
Analysis / UI / PR 改讀 V3
        ↓
驗證完整
        ↓
最後才淘汰舊特殊格式
```

禁止在尚未確認功能依賴前直接：

- 刪 WorkoutLog 欄位
- 刪「動作總結 / 本日總結」舊資料
- 刪月份頁籤
- 改 Authentication source
- 大量搬移照片

---

# 21. 下一步開始方式

實作前先做一次「Phase 1 implementation review」，確認：

1. Workout Draft 要保存的 DOM / state 欄位
2. restore 時如何重建 exercise card / set row
3. saveWorkoutData 成功的 commit point
4. Timer 現行實作與 UI
5. 數字 input 元件目前在哪些 DOM / methods 中

確認後，Phase 1 拆成小 PR / 小 commit，不與 Schema V3 大改混在同一次修改。

第一個建議 commit：

```text
feat: persist workout draft locally
```

完成 Draft 並實際在手機測試後，再進 Timer 2.0。

---

## 最終核心方向

FitnessApp 不追求短期堆很多功能，而是依序完成：

```text
Reliable Tracking
      ↓
Low-friction Workout UX
      ↓
Flexible Training Model
      ↓
Training Context / Insight
      ↓
Program / Coaching
```

近期最重要的不是換後端，而是讓「資料永遠不丟、每組輸入很快、不同訓練型態都能正確表示」。
