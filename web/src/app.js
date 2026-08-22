import { APP_CONSTANTS } from './constants.js';
import { backendApi } from './api.js';
import { initialState } from './state.js';
import { cache } from './cache.js';
import { events } from './events.js';
import { methods } from './methods.js';
import { ui } from './ui.js';
import { workoutDraft } from './workout-draft.js';
import { restTimer } from './rest-timer.js';
import { workoutNumericInput } from './workout-numeric-input.js';
import { workoutSession } from './workout-session.js';

export const app = {
    cache,
    workoutDraft,
    restTimer,
    workoutNumericInput,
    workoutSession,
    state: initialState,

            init() {
                console.log('App 初始化...');
                this.ui.showLoading(true);

                // Session-level UI 必須先建立，Workout Draft 才能一起監聽/恢復全日備註。
                this.workoutSession.init();

                // 保留既有 collectWorkoutData() 的資料格式，再附加 session metadata。
                // processWorkoutForPRs() 會忽略額外欄位，因此不需要改 PR 流程或 API 簽名。
                const collectWorkoutDataBase = this.methods.collectWorkoutData.bind(this.methods);
                this.methods.collectWorkoutData = () => this.workoutSession.enrichWorkoutData(collectWorkoutDataBase());

                this.workoutDraft.init({
                    getCurrentUser: () => this.state.user.currentUser,
                    onRestored: () => {
                        this.methods.applyTrackingMetadataToWorkout();
                        this.methods.resizeWorkoutNotes();
                        document.querySelectorAll('#workout-list .card').forEach((card) => this.methods.calculateVolume(card));
                        this.methods.updateDailyTotalVolume();
                        this.ui.showToast('已恢復未完成的訓練草稿。');
                    },
                    recalculateVolumes: () => {
                        document.querySelectorAll('#workout-list .card').forEach(card => {
                            this.methods.calculateVolume(card);
                        });
                        this.methods.updateDailyTotalVolume();
                    }
                });

                this.restTimer.init({
                    getCurrentUser: () => this.state.user.currentUser,
                    defaultRestSeconds: APP_CONSTANTS.WORKOUT.DEFAULT_REST_TIME,
                    onFinished: () => this.ui.showToast('休息結束！'),
                    onInvalidComplete: () => this.ui.showToast('請先輸入這一組的訓練數值。', 'error')
                });

                this.workoutNumericInput.init();

                // 保留舊事件層的呼叫介面，但底層全面改由 timestamp timer 處理。
                this.methods.startTimer = (seconds) => this.restTimer.start(seconds);
                this.methods.addTimerTime = (seconds) => this.restTimer.adjust(seconds);
                this.methods.resetTimer = () => this.restTimer.stop();

                if (!this.state.charts) {
                    this.state.charts = {
                        bodyStats: null,
                        volume: null,
                        categoryDistribution: null,
                        exerciseProgress: null,
                        heatmap: null
                    };
                }

                this.api.getInitialData().then(data => {
                    if (!data || data.error) {
                        throw new Error(data.error || "後端伺服器未返回有效的初始資料。");
                    }

                    const { profile, allUsers, templates, exerciseNames, exerciseCatalog = [] } = data;

                    // 🆕 使用新的結構化狀態
                    this.state.user.currentUser = profile.email;
                    if (!this.state.user.loggedInEmail) this.state.user.loggedInEmail = profile.email;
                    this.state.user.isAdmin = profile.isAdmin;
                    this.state.user.profileData = data.profile.profileData;
                    this.state.ui.shouldShowReminder = profile.shouldShowReminder;
                    this.state.cache.workoutTemplates = templates;
                    this.state.cache.exerciseNameList = exerciseNames;
                    this.state.cache.exerciseCatalog = exerciseCatalog;
                    this.state.classify.catalog = exerciseCatalog;

                    this.ui.populateProfileData(profile.profileData);
                    this.methods.loadInBodyRecords();
                    this.methods.calculateRecommendations();
                    this.ui.populateLatestPhotos(profile.latestPhotos);
                    this.ui.populateTemplateList(templates);

                    // 使用者身份確定後才讀取對應本機狀態，避免不同帳號互相污染。
                    this.workoutDraft.restore();
                    this.restTimer.restore();

                    if (this.state.user.isAdmin) {
                        this.ui.showAdminBar(true);
                        this.ui.populateUserSwitcher(allUsers);
                    }
                    if (this.state.ui.shouldShowReminder) {
                        this.ui.showReminderBanner(true);
                    }

                    this.ui.updateWelcomeMessage(profile.name);
                    this.ui.setActiveNav('dashboard');
                    this.ui.showLoading(false);

                }).catch(error => {
                    app.methods.handleError(error, '初始化失敗');
                    this.ui.showLoading(false);
                });

                const workoutDateInput = document.getElementById('workout-date-input');
                if(workoutDateInput) workoutDateInput.value = new Date().toLocaleDateString('sv');

                const photoDateInput = document.getElementById('photo-date-input');
                if(photoDateInput) photoDateInput.value = new Date().toLocaleDateString('sv');

                this.events.init();
                this.methods.initSortable();
            },

            async navigateTo(page) {
                if (this.state.ui.currentView === page) return;

                this.state.ui.currentView = page;
                this.ui.renderPage();
                this.ui.setActiveNav(page);

                if (page === 'history') { await this.methods.loadHistoryData(); }
                if (page === 'prs') { await this.methods.loadPRData(); }
            },

    events,
    methods,
    ui,
    api: backendApi,   // ★ 舊 api 區段（行 3552–3676）整段淘汰，由 backendApi 頂替
};

window.app = app;      // HTML onclick="app.navigateTo(...)" 依賴全域
