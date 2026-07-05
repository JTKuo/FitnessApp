// app.state 初始值（src/index.html 行 1065–1117 原樣搬移）
export const initialState = {
                // 使用者相關狀態
                user: {
                    currentUser: null,
                    isAdmin: false,
                    profileData: null
                },
                
                // UI 相關狀態
                ui: {
                    currentView: 'dashboard',
                    isLoading: true,
                    isPREditMode: false,
                    shouldShowReminder: false
                },
                
                // 資料快取
                cache: {
                    workoutTemplates: {},
                    exerciseNameList: [],
                    analysisData: null,
                    prData: null,
                    photoHistory: []
                },
                
                // Modal 相關狀態
                modal: {
                    promptCallback: null,
                    confirmCallback: null,
                    elementToDelete: null
                },
                
                // 🔍 確認這裡有正確定義
                charts: {
                    bodyStats: null,
                    volume: null,
                    categoryDistribution: null,
                    exerciseProgress: null,
                    heatmap: null
                },
                
                // 計時器相關
                timer: {
                    interval: null,
                    secondsLeft: 0,
                    toastTimer: null
                },
                
                // PR 編輯相關
                pr: {
                    categoryChanges: new Map()
                }
};
