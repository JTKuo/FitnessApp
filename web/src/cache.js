import { app } from './app.js';                 // call-time 引用，無循環問題

export const cache = {
                // 快取鍵值定義
                keys: {
                    ANALYSIS_DATA: 'analysisData',
                    PR_DATA: 'prData',
                    PHOTO_HISTORY: 'photoHistory',
                    WORKOUT_TEMPLATES: 'workoutTemplates'
                },
                
                // 清除單一快取
                clear(cacheKey) {
                    console.log(`清除快取: ${cacheKey}`);
                    if (cacheKey === this.keys.ANALYSIS_DATA) {
                        app.state.cache.analysisData = null;
                    } else if (cacheKey === this.keys.PR_DATA) {
                        app.state.cache.prData = null;
                    } else if (cacheKey === this.keys.PHOTO_HISTORY) {
                        app.state.cache.photoHistory = [];
                    } else if (cacheKey === this.keys.WORKOUT_TEMPLATES) {
                        app.state.cache.workoutTemplates = {};
                    }
                },
                
                // 清除所有快取
                clearAll() {
                    console.log('清除所有快取');
                    app.state.cache.analysisData = null;
                    app.state.cache.prData = null;
                    app.state.cache.photoHistory = [];
                    // workoutTemplates 通常不需要清除，因為它變動較少
                },
                
                // 清除與訓練相關的快取
                clearWorkoutRelated() {
                    console.log('清除訓練相關快取');
                    this.clear(this.keys.ANALYSIS_DATA);
                    this.clear(this.keys.PR_DATA);
                },
                
                // 清除與體態相關的快取
                clearBodyStatsRelated() {
                    console.log('清除體態相關快取');
                    this.clear(this.keys.ANALYSIS_DATA);
                    this.clear(this.keys.PHOTO_HISTORY);
                },
                
                // 檢查快取是否有效
                isValid(cacheKey, userEmail) {
                    let cacheData = null;
                    
                    if (cacheKey === this.keys.ANALYSIS_DATA) {
                        cacheData = app.state.cache.analysisData;
                    } else if (cacheKey === this.keys.PR_DATA) {
                        cacheData = app.state.cache.prData;
                    } else if (cacheKey === this.keys.PHOTO_HISTORY) {
                        cacheData = app.state.cache.photoHistory;
                    }
                    
                    // 檢查快取是否存在且屬於當前用戶
                    return cacheData && cacheData.currentUser === userEmail;
                }
};
