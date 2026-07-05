import { APP_CONSTANTS } from './constants.js';
import { backendApi } from './api.js';
import { initialState } from './state.js';
import { cache } from './cache.js';
import { events } from './events.js';
import { methods } from './methods.js';
import { ui } from './ui.js';

export const app = {
    cache,
    state: initialState,

            init() {
                console.log('App 初始化...');
                this.ui.showLoading(true);
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

                    const { profile, allUsers, templates, exerciseNames } = data;

                    // 🆕 使用新的結構化狀態
                    this.state.user.currentUser = profile.email;
                    if (!this.state.user.loggedInEmail) this.state.user.loggedInEmail = profile.email;
                    this.state.user.isAdmin = profile.isAdmin;
                    this.state.user.profileData = data.profile.profileData;
                    this.state.ui.shouldShowReminder = profile.shouldShowReminder;
                    this.state.cache.workoutTemplates = templates;
                    this.state.cache.exerciseNameList = exerciseNames;

                    this.ui.populateProfileData(profile.profileData);
                    this.methods.loadInBodyRecords();
                    this.methods.calculateRecommendations();
                    this.ui.populateLatestPhotos(profile.latestPhotos);
                    this.ui.populateTemplateList(templates);

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
