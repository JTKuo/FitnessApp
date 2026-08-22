from pathlib import Path
import re

# Temporary branch-only patch runner; removed automatically after validation.
path = Path('web/src/methods.js')
text = path.read_text(encoding='utf-8')

replacement = r'''                handleSaveWorkout() {
                    const workoutData = app.methods.collectWorkoutData();
                    if (workoutData.length === 0) {
                        app.ui.showToast('沒有任何訓練資料可以儲存。');
                        return;
                    }

                    const saveStartedAt = performance.now();
                    app.ui.showLoading(true);

                    // WorkoutLog 是正式 commit gate：核心儲存成功就立即解除 blocking loading。
                    // PR/Bests 屬於可重建的後處理，不應讓使用者多等一個 GAS round trip。
                    app.api.saveWorkoutData(workoutData)
                        .then(response => {
                            console.info(`[Workout Save] 核心儲存 ${Math.round(performance.now() - saveStartedAt)} ms`);
                            app.ui.showToast(response.message);
                            app.cache.clearWorkoutRelated();
                            app.ui.showLoading(false);

                            const prTask = () => {
                                const prStartedAt = performance.now();
                                return app.api.processWorkoutForPRs(workoutData)
                                    .then(prResponse => {
                                        console.info(`[Workout Save] PR 後處理 ${Math.round(performance.now() - prStartedAt)} ms`);
                                        if (prResponse && prResponse.status === 'success' && prResponse.newPRs.length > 0) {
                                            const prMessage = "<strong>恭喜達成新紀錄！</strong><br>" + prResponse.newPRs.join("<br>");
                                            app.ui.showToast(prMessage);
                                        }
                                    })
                                    .catch(error => {
                                        console.error('[Workout Save] PR 後處理失敗；WorkoutLog 已成功儲存。', error);
                                        app.ui.showToast('訓練已儲存，但 PR 更新暫時失敗。', 'error');
                                    });
                            };

                            // 若短時間連續重存，序列化 PR 寫入，避免兩個 PR 更新同時改同一份 Sheet。
                            this._prProcessingQueue = (this._prProcessingQueue || Promise.resolve())
                                .then(prTask, prTask);
                        })
                        .catch(error => {
                            console.info(`[Workout Save] 核心儲存失敗於 ${Math.round(performance.now() - saveStartedAt)} ms`);
                            app.ui.showLoading(false);
                            this.handleError(error, '儲存訓練日誌失敗');
                        });
                },'''

pattern = re.compile(
    r"                handleSaveWorkout\(\) \{.*?\n                \},\n\n                collectWorkoutData\(\) \{",
    re.S,
)
text, count = pattern.subn(replacement + '\n\n                collectWorkoutData() {', text, count=1)
if count != 1:
    raise SystemExit(f'expected exactly one handleSaveWorkout replacement, got {count}')

path.write_text(text, encoding='utf-8')
print('Workout save latency patch applied.')
