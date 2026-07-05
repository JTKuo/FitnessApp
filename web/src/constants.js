export const APP_CONSTANTS = {
            // 時間相關常數（毫秒）
            TIME: {
                ONE_DAY_MS: 24 * 60 * 60 * 1000,
                ONE_HOUR_MS: 60 * 60 * 1000,
                ONE_MINUTE_MS: 60 * 1000,
                
                // 便捷方法
                days(n) { return n * this.ONE_DAY_MS; },
                hours(n) { return n * this.ONE_HOUR_MS; },
                minutes(n) { return n * this.ONE_MINUTE_MS; }
            },
            
            // 分析數據時間範圍
            ANALYSIS: {
                DAYS_FOR_HISTORY: 90,        // 歷史數據顯示 90 天
                DAYS_FOR_DISTRIBUTION: 30,   // 訓練量分布顯示 30 天
                DAYS_FOR_PHOTO_REMINDER: 30  // 照片提醒週期 30 天
            },
            
            // UI 相關常數
            UI: {
                TOAST_DURATION: 3000,         // Toast 顯示時間 3 秒
                ANIMATION_DURATION: 300,      // 動畫時長 300ms
                DEBOUNCE_DELAY: 300,          // 防抖延遲 300ms
                CACHE_DURATION: 7200,         // 快取時長 2 小時（秒）
                SUGGESTIONS_LIMIT: 5          // 自動完成建議數量上限
            },
            
            // 圖表相關常數
            CHART: {
                ASPECT_RATIO: 1.6,            // 圖表寬高比
                POINT_RADIUS: 4,              // 資料點半徑
                POINT_HOVER_RADIUS: 8,        // 滑鼠懸停時的半徑
                POINT_HIT_RADIUS: 15          // 點擊檢測半徑
            },
            
            // 訓練相關常數
            WORKOUT: {
                DEFAULT_REST_TIME: 30,        // 預設休息時間 30 秒
                REST_TIME_ADJUSTMENT: 15,     // 休息時間調整間隔 15 秒
                MIN_WEIGHT: 0,                // 最小重量
                MAX_WEIGHT: 1000,             // 最大重量（公斤）
                MIN_REPS: 0,                  // 最小次數
                MAX_REPS: 999                 // 最大次數
            },
            
            // 身體數據範圍
            BODY_STATS: {
                MIN_AGE: 10,
                MAX_AGE: 150,
                MIN_HEIGHT: 50,               // 公分
                MAX_HEIGHT: 300,
                MIN_WEIGHT: 20,               // 公斤
                MAX_WEIGHT: 500,
                MIN_BODYFAT: 1,               // 百分比
                MAX_BODYFAT: 70
            },
            
            // 圖片處理
            IMAGE: {
                MAX_SIZE_MB: 1,               // 壓縮後最大檔案大小
                MAX_DIMENSION: 1080           // 最大寬度/高度
            },
            
            // 單位轉換
            CONVERSION: {
                KG_TO_LB: 2.20462262,
                LB_TO_KG: 0.45359237,
                CM_TO_INCH: 0.393701,
                INCH_TO_CM: 2.54
            },
            
            // 分類顏色（與圖表對應）
            COLORS: {
                CHEST: 'rgba(239, 68, 68, 0.8)',
                BACK: 'rgba(59, 130, 246, 0.8)',
                LEGS: 'rgba(34, 197, 94, 0.8)',
                GLUTES: 'rgba(249, 115, 22, 0.8)',
                SHOULDERS: 'rgba(168, 85, 247, 0.8)',
                ARMS: 'rgba(234, 179, 8, 0.8)',
                OTHER: 'rgba(156, 163, 175, 0.8)'
            }
        };
