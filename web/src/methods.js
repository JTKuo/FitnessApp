import { app } from './app.js';                 // call-time 引用，無循環問題
import { APP_CONSTANTS } from './constants.js';
import { renderDrivePhoto } from './photos.js';

export const methods = {
                handleError(error, contextMessage = "發生錯誤") {
                    console.error(`[${contextMessage}]`, error); // 保留 console.error 供開發者除錯

                    let userFriendlyMessage = "請稍後再試。"; // 預設訊息

                    if (error instanceof Error) {
                        // 如果是標準 Error 物件，嘗試使用它的 message
                        userFriendlyMessage = error.message;
                    } else if (typeof error === 'string') {
                        // 如果錯誤本身就是字串
                        userFriendlyMessage = error;
                    } else if (error && typeof error === 'object' && error.message) {
                      // 處理來自 google.script.run 的錯誤物件 (通常有 message 屬性)
                      userFriendlyMessage = error.message;
                    }

                    // 組合訊息並顯示 Toast
                    app.ui.showToast(`${contextMessage}: ${userFriendlyMessage}`, 'error');
                },
                
                switchUser(selectedEmail) {
                    console.log(`管理者切換至: ${selectedEmail}`);
                    app.ui.showLoading(true);

                    // 🆕 使用快取管理系統清除所有快取
                    app.cache.clearAll();
    
                    app.ui.clearWorkoutLog();
                    if (app.state.charts.heatmap && typeof app.state.charts.heatmap.destroy === 'function') {
                        try {
                            app.state.charts.heatmap.destroy();
                            app.state.charts.heatmap = null;
                        } catch (e) {
                            console.warn('銷毀 heatmap 時發生錯誤:', e);
                        }
                    }

                    app.api.getInitialData(selectedEmail).then(data => {
                        if (!data || data.error) {
                            throw new Error(data.error || "切換使用者失敗。");
                        }
                        
                        const { profile, templates, exerciseNames } = data;

                        // 🆕 使用新結構更新狀態
                        app.state.user.currentUser = profile.email;
                        app.state.ui.shouldShowReminder = profile.shouldShowReminder;
                        app.state.cache.workoutTemplates = templates;
                        app.state.cache.exerciseNameList = exerciseNames;
                        app.state.user.profileData = data.profile.profileData;

                        app.ui.populateProfileData(profile.profileData);
                        app.methods.loadInBodyRecords();
                        app.methods.calculateRecommendations();
                        app.ui.populateLatestPhotos(profile.latestPhotos);
                        app.ui.populateTemplateList(templates);

                        app.ui.showReminderBanner(profile.shouldShowReminder);
                        app.ui.updateWelcomeMessage(profile.name);
                        
                        app.navigateTo('dashboard');

                    }).catch(error => {
                        this.handleError(error, '切換使用者失敗');
                    }).finally(() => {
                        app.ui.showLoading(false);
                    });
                },

                handleRefreshAnalysis() {
                    app.ui.showToast('正在重新載入分析數據...');
    
                    // 🆕 使用快取管理系統清除
                    app.cache.clear(app.cache.keys.ANALYSIS_DATA);
                    
                    app.methods.loadHistoryData();
                },

                initSortable() {
                    const workoutList = document.getElementById('workout-list');
                    if (workoutList) {
                        new Sortable(workoutList, {
                            animation: 150,
                            ghostClass: 'sortable-ghost',
                            chosenClass: 'sortable-chosen',
                            handle: '.js-drag-handle',
                            delay: 50,
                            delayOnTouchOnly: true
                        });
                    }
                },

                toggleProfileEditMode(isEditing) {
                    const profileSection = document.getElementById('profile-section');
                    if (!profileSection) return;

                    const viewElements = profileSection.querySelectorAll('.view-mode');
                    const editElements = profileSection.querySelectorAll('.edit-mode, .profile-input');
                    
                    if (isEditing) {
                        viewElements.forEach(viewEl => {
                            let editEl = viewEl.nextElementSibling;
                            if (!editEl || (!editEl.classList.contains('edit-mode') && !editEl.classList.contains('profile-input'))) {
                                const parentGrid = viewEl.closest('.grid');
                                if (parentGrid) {
                                    const placeholder = viewEl.dataset.placeholder;
                                    if(placeholder) {
                                       const key = placeholder.split(':')[0];
                                       editEl = parentGrid.querySelector(`[placeholder="${key}"]`);
                                    }
                                }
                            }
                           
                            if (editEl && (editEl.classList.contains('edit-mode') || editEl.classList.contains('profile-input'))) {
                                if (editEl.tagName === 'INPUT' || editEl.tagName === 'TEXTAREA') {
                                    const placeholder = viewEl.dataset.placeholder || '';
                                    let currentText = viewEl.textContent.trim();
                                    
                                    if(placeholder.includes(':')) {
                                        currentText = currentText.replace(placeholder.split(':')[0] + ':', '').trim();
                                    }

                                    editEl.value = (currentText === placeholder || currentText === '未設定' || currentText === '無' || currentText === '--') ? '' : currentText;
                                } else if (editEl.tagName === 'SELECT') {
                                    const matchingOption = [...editEl.options].find(opt => opt.textContent === viewEl.textContent);
                                    if (matchingOption) editEl.value = matchingOption.value;
                                }
                            } 
                        });
                    }

                    viewElements.forEach(el => el.classList.toggle('hidden', isEditing));
                    editElements.forEach(el => el.classList.toggle('hidden', !isEditing));
                    
                    const editBtn = document.getElementById('edit-profile-btn');
                    if(editBtn) editBtn.classList.toggle('hidden', isEditing);
                    
                    const editActions = document.getElementById('edit-profile-actions');
                    if(editActions) editActions.classList.toggle('hidden', !isEditing);
                },

                handleSaveProfile() {
                    const profileSection = document.getElementById('profile-section');
                    // `newDataFromForm` 只包含使用者在編輯模式下輸入的資料
                    const newDataFromForm = {};
                    
                    profileSection.querySelectorAll('[data-key]').forEach(el => {
                        // 只收集可見的 (即編輯模式下的) input/select 的值
                        if (el.offsetParent !== null) { 
                          newDataFromForm[el.dataset.key] = el.value;
                        }
                    });
                    
                    app.ui.showLoading(true);
                    
                    // 將新資料送到後端儲存 (這部分的 API 呼叫不變)
                    app.api.saveProfileData('profile-all', newDataFromForm)
                        .then(response => {
                            if (response.status === 'error') {
                                throw new Error(response.message);
                            }
                            app.ui.showToast(response.message);

                            // 🆕 更新個人資料後，清除分析資料快取（因為體重等可能影響分析）
                            app.cache.clear(app.cache.keys.ANALYSIS_DATA);

                            app.state.user.profileData = { ...app.state.user.profileData, ...newDataFromForm };
                            app.ui.populateProfileData(app.state.user.profileData);
                            app.methods.loadInBodyRecords();
                            app.methods.toggleProfileEditMode(false);
                            app.methods.calculateRecommendations();
                        })
                        .catch(err => {
                            this.handleError(err, '儲存個人資料失敗');
                        })
                        .finally(() => {
                            app.ui.showLoading(false);
                    });
                },

                async loadHistoryData() {
                    app.ui.showHistoryState('loading');
                    try {
                        // 🆕 使用快取管理系統檢查
                        if (!app.cache.isValid(app.cache.keys.ANALYSIS_DATA, app.state.user.currentUser)) {
                            console.log(`為 ${app.state.user.currentUser} 重新載入分析資料...`);
                            app.state.cache.analysisData = await app.api.getAnalysisData(app.state.user.currentUser);
                            if(app.state.cache.analysisData) {
                                app.state.cache.analysisData.currentUser = app.state.user.currentUser;
                            }
                        } else {
                            console.log(`使用 ${app.state.user.currentUser} 的快取分析資料`);
                        }
                        
                        const data = app.state.cache.analysisData;
                        if (data.error) throw new Error(data.error);

                        const hasData = data.weightHistory.length > 0 || 
                                      data.volumeHistory.length > 0 || 
                                      data.workoutFrequency.length > 0;
                        
                        if (hasData) {
                            this.renderHistoryCharts(data);
                            app.ui.showHistoryState('content');
                        } else {
                            app.ui.showHistoryState('empty');
                        }
                    } catch (error) {
                        this.handleError(error, '無法載入歷史數據');
                        app.ui.showHistoryState('empty');
                    }
                },

                renderHistoryCharts(data) {
                    Object.values(app.state.charts).forEach(chart => {
                        if (chart && typeof chart.destroy === 'function') {
                            try {
                                chart.destroy();
                            } catch (e) {
                                console.warn('銷毀圖表時發生錯誤:', e);
                            }
                        }
                    });

                    // --- 功能 4: 填充單一動作下拉選單 ---
                    this._populateExerciseSelect(data.singleExerciseProgress);
                    const exerciseSelect = document.getElementById('exercise-progress-select');
                    if (exerciseSelect) {
                        exerciseSelect.removeEventListener('change', this._handleExerciseSelectChange);
                        exerciseSelect.addEventListener('change', this._handleExerciseSelectChange);
                    } 

                    // --- 圖表 1: 體態趨勢 ---
                    const bodyStatsCtx = document.getElementById('body-stats-chart');
                    if (bodyStatsCtx) {
                        app.state.charts.bodyStats = new Chart(bodyStatsCtx.getContext('2d'), {
                            type: 'line',
                            data: { datasets: [ { label: '體重 (kg)', data: data.weightHistory, borderColor: '#ffc300', backgroundColor: 'rgba(255, 195, 0, 0.2)', yAxisID: 'y', tension: 0.1, fill: true, }, { label: '體脂率 (%)', data: data.bodyfatHistory, borderColor: '#38bdf8', backgroundColor: 'rgba(56, 189, 248, 0.2)', yAxisID: 'y1', tension: 0.1, fill: true, } ] },
                            options: {
                                responsive: true,
                                aspectRatio: 1.6,
                                interaction: { mode: 'index', intersect: false },
                                scales: {
                                    x: {
                                        type: 'time',
                                        time: { unit: 'day', displayFormats: { day: 'MMM d' }, tooltipFormat: 'yyyy-MM-dd' },
                                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                                        ticks: { color: '#9ca3af' }
                                    },
                                    y: { type: 'linear', display: true, position: 'left', title: { display: true, text: '體重 (kg)', color: '#ffc300' }, grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#ffc300' } },
                                    y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: '體脂率 (%)', color: '#38bdf8' }, grid: { drawOnChartArea: false }, ticks: { color: '#38bdf8' } }
                                },
                                plugins: {
                                    legend: { labels: { color: '#e5e7eb' } },
                                    datalabels: { display: false }
                                }
                            }
                        });
                    }                    

                    // --- 圖表 2: 訓練容量分佈 (V4 - 簡化為總容量折線圖並修正點擊) ---
                    const volumeCtx = document.getElementById('volume-chart');
                    if (volumeCtx && data.volumeHistory) {
                        // ✨✨✨ 關鍵修正 1：直接使用後端已算好的總容量數據 volumeHistory ✨✨✨
                        app.state.charts.volume = new Chart(volumeCtx.getContext('2d'), {
                            type: 'line', // 改為折線圖更清晰
                            data: {
                                datasets: [{
                                    label: '總訓練容量 (kg)',
                                    data: data.volumeHistory, // 直接使用總容量數據
                                    borderColor: '#4ade80', // 綠色
                                    backgroundColor: 'rgba(74, 222, 128, 0.2)',
                                    fill: true,
                                    tension: 0.1,
                                    pointRadius: 4,          // 點的半徑 (可見)
                                    pointHoverRadius: 8,     // 滑鼠懸停/點擊時的半徑 (可見)
                                    pointHitRadius: 15       // 點擊的偵測半徑 (不可見)
                                }]
                            },
                            options: {
                                responsive: true,
                                aspectRatio: 1.6,
                                plugins: {
                                    legend: { display: false }, // 不需要圖例了
                                    tooltip: {
                                        callbacks: {
                                            label: (context) => `${context.dataset.label}: ${context.raw.y.toLocaleString()} kg`
                                        }
                                    },
                                    datalabels: { display: false }
                                },
                                scales: {
                                    x: {
                                        type: 'time',
                                        time: { unit: 'day', displayFormats: { day: 'MMM d' }, tooltipFormat: 'yyyy-MM-dd' },
                                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                                        ticks: { color: '#9ca3af' }
                                    },
                                    y: {
                                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                                        ticks: { color: '#e5e7eb' },
                                        beginAtZero: true,
                                        title: { display: true, text: '訓練容量 (kg)', color: '#e5e7eb' }
                                    }
                                },
                                // ✨✨✨ 關鍵修正 2：onClick 現在可以正確運作 ✨✨✨
                                onClick: (event, elements, chart) => {
                                    if (elements.length === 0) return;
                                    
                                    const clickedIndex = elements[0].index;
                                    // 對於非堆疊圖表，可以直接從 data.datasets[0].data 取得對應的資料點
                                    const clickedDataPoint = chart.data.datasets[0].data[clickedIndex];
                                    const clickedDateISO = clickedDataPoint.x; // 這就是正確的 ISO 日期字串

                                    const targetDate = new Date(clickedDateISO);
                                    targetDate.setHours(0,0,0,0); // 標準化為當天零點

                                    const exercisesOnDay = [];
                                    const allProgressData = app.state.cache.analysisData.singleExerciseProgress;
                                    for (const exercise in allProgressData) {
                                        const hasDataOnDay = allProgressData[exercise].some(dataPoint => {
                                            const recordDate = new Date(dataPoint.x);
                                            recordDate.setHours(0,0,0,0);
                                            return recordDate.getTime() === targetDate.getTime();
                                        });

                                        if (hasDataOnDay) {
                                            exercisesOnDay.push(exercise);
                                        }
                                    }
                                    
                                    const selectEl = document.getElementById('exercise-progress-select');

                                    if (exercisesOnDay.length > 0) {
                                        app.methods._populateExerciseSelect(allProgressData, exercisesOnDay);
                                        selectEl.value = exercisesOnDay[0];
                                        selectEl.dispatchEvent(new Event('change'));

                                        // 讓頁面滾動到下拉選單的位置，方便查看
                                        selectEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }
                                }
                            }
                        });
                    }

                    // --- 圖表 3: 肌肉部位訓練量佔比 (V3 - 修正圖例順序) ---
                    const categoryCtx = document.getElementById('category-distribution-chart');
                    const legendContainer = document.getElementById('category-legend-container');

                    if (categoryCtx && legendContainer && data.categoryVolumeDistribution && Object.keys(data.categoryVolumeDistribution).length > 0) {
                        
                        // ✨ 修正 1：定義固定的圖例順序
                        const fixedCategoryOrder = ['胸', '肩', '背', '臀', '腿', '手', '其他'];
                        const originalLabels = Object.keys(data.categoryVolumeDistribution);
                        
                        // 根據固定順序篩選和排序已存在的標籤
                        const sortedCategoryLabels = fixedCategoryOrder.filter(label => originalLabels.includes(label));
                        
                        // 找出不在固定順序中但卻存在的標籤 (以防未來有新分類)，並加到尾部
                        originalLabels.forEach(label => {
                            if (!sortedCategoryLabels.includes(label)) {
                                sortedCategoryLabels.push(label);
                            }
                        });
                        
                        // 根據排序好的標籤，重新產生對應的數據陣列
                        const sortedCategoryData = sortedCategoryLabels.map(label => data.categoryVolumeDistribution[label]);

                        const categoryColors = {
                            '胸': 'rgba(239, 68, 68, 0.8)', '背': 'rgba(59, 130, 246, 0.8)',
                            '腿': 'rgba(34, 197, 94, 0.8)', '臀': 'rgba(249, 115, 22, 0.8)',
                            '肩': 'rgba(168, 85, 247, 0.8)', '手': 'rgba(234, 179, 8, 0.8)',
                            '其他': 'rgba(156, 163, 175, 0.8)'
                        };
                        const backgroundColors = sortedCategoryLabels.map(label => categoryColors[label] || categoryColors['其他']);

                        if (app.state.charts.categoryDistribution) {
                            app.state.charts.categoryDistribution.destroy();
                        }

                        app.state.charts.categoryDistribution = new Chart(categoryCtx.getContext('2d'), {
                            type: 'doughnut',
                            data: {
                                labels: sortedCategoryLabels, // 使用排序後的標籤
                                datasets: [{
                                    data: sortedCategoryData, // 使用排序後的數據
                                    backgroundColor: backgroundColors,
                                    borderColor: '#2d2a27',
                                    borderWidth: 2
                                }]
                            },
                            options: {
                                responsive: true,
                                plugins: {
                                    legend: { display: false },
                                    datalabels: {
                                        formatter: (value, ctx) => {
                                            const sum = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                                            const percentage = (value * 100 / sum);
                                            return percentage < 5 ? '' : percentage.toFixed(0) + '%';
                                        },
                                        color: '#FFFFFF', font: { weight: 'bold', size: 16 },
                                        textStrokeColor: '#000000', textStrokeWidth: 2
                                    },
                                    tooltip: {
                                        callbacks: {
                                            label: function(context) {
                                                let label = '';
                                                if (context.raw !== null) {
                                                    // 使用 toLocaleString() 讓數字加上千分位符號，更好閱讀
                                                    label += context.raw.toLocaleString() + ' kg';
                                                }
                                                return label;
                                            }
                                        }
                                    }
                                }                                
                            }
                        });

                        legendContainer.innerHTML = '';
                        // ✨ 修正 1：使用排序後的標籤來產生圖例
                        app.state.charts.categoryDistribution.data.labels.forEach((label, index) => {
                            const color = backgroundColors[index];
                            const legendItemHtml = `
                                <div class="flex items-center">
                                    <span class="w-3 h-3 rounded-sm mr-2" style="background-color: ${color}"></span>
                                    <span class="text-gray-300 text-sm">${label}</span>
                                </div>
                            `;
                            legendContainer.innerHTML += legendItemHtml;
                        });
                    }

                    // --- 圖表 3: 訓練頻率熱力圖 ---
                    this._renderWorkoutHeatmap(data.workoutFrequency);                                       
                },

                _renderWorkoutHeatmap(frequencyData) {
                    if (app.state.charts.heatmap && typeof app.state.charts.heatmap.destroy === 'function') {
                        try {
                            app.state.charts.heatmap.destroy();
                            app.state.charts.heatmap = null;
                        } catch (e) {
                            console.warn('銷毀 heatmap 時發生錯誤:', e);
                        }
                    }
                    
                    const container = document.getElementById('heatmap-container');
                    if (!container || !frequencyData || frequencyData.length === 0) {
                        if (container) container.innerHTML = '';
                        return;
                    }

                    setTimeout(() => {
                        const cal = new CalHeatmap();
                        
                        const heatmapData = frequencyData.map(dateStr => ({
                            date: dateStr,
                            value: 1
                        }));

                        // === [修正] 更精確的起始日期計算方式 ===
                        const now = new Date();
                        // 直接建立一個新的 Date 物件，設定為 2 個月前的 1 號
                        // 例如：10月執行時，now.getMonth() 是 9，9-2=7，代表 8 月
                        const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                        // === [修正] 程式碼結束 ===

                        cal.paint({
                            itemSelector: container,
                            domain: {
                                type: 'month',
                                label: { text: 'MMM', textAlign: 'start', position: 'top' },
                            },
                            subDomain: { type: 'day', radius: 2, width: 11, height: 11, gutter: 4 },
                            data: {
                                source: heatmapData,
                                x: 'date',
                                y: 'value'
                            },
                            date: { start: startDate }, // <--- 確保這裡使用的是 startDate
                            range: 3, // 顯示 3 個月的範圍
                            scale: {
                                color: {
                                    type: 'threshold',
                                    scheme: 'YlGn',
                                    domain: [1],
                                },
                            },
                            theme: 'dark'
                        });
                        
                        app.state.charts.heatmap = cal;
                    }, 50);
                },

                _populateExerciseSelect(progressData, filterList = null) {
                    const selectEl = document.getElementById('exercise-progress-select');
                    if (!selectEl || !progressData) return;
                    selectEl.innerHTML = '<option value="">請選擇一個動作來分析</option>';

                    // 如果有傳入 filterList，就用它當作選項；否則，就用全部的動作名稱
                    const exerciseNames = filterList ? filterList.sort() : Object.keys(progressData).sort();

                    exerciseNames.forEach(name => {
                        const option = document.createElement('option');
                        option.value = name;
                        option.textContent = name;
                        selectEl.appendChild(option);
                    });
                },

                _handleExerciseSelectChange(event) {
                    const exerciseName = event.target.value;
                    const progressData = app.state.cache.analysisData.singleExerciseProgress;
                    app.methods._renderExerciseProgressChart(exerciseName, progressData);
                },

                _renderExerciseProgressChart(exerciseName, allProgressData) {
                    const ctx = document.getElementById('exercise-progress-chart')?.getContext('2d');
                    const notesContainer = document.getElementById('exercise-notes-container');
                    if (!ctx || !notesContainer) return;

                    notesContainer.innerHTML = '<h4 class="text-base font-semibold text-yellow-500 border-b border-yellow-500/30 pb-1">訓練備註</h4>';
                    notesContainer.classList.add('hidden');
                    if (app.state.charts.exerciseProgress && typeof app.state.charts.exerciseProgress.destroy === 'function') {
                        try {
                            app.state.charts.exerciseProgress.destroy();
                        } catch (e) {
                            console.warn('銷毀 exerciseProgress 圖表時發生錯誤:', e);
                        }
                    }
                    if (!exerciseName) {
                        return;
                    }

                    const exerciseData = allProgressData[exerciseName];
                    let notesFound = 0;

                    exerciseData.forEach(d => {
                        const hasUserNote = d.note && d.note.trim() !== '';
                        const hasAdminNote = d.adminNote && d.adminNote.trim() !== '';

                        // 判斷是否需要顯示此日期的備註區塊 (邏輯不變)
                        if (hasUserNote || hasAdminNote || app.state.user.isAdmin) {
                            notesFound++;
                            
                            const noteDate = new Date(d.x).toLocaleDateString('sv');
                            
                            let noteHtml = `<div class="bg-black/40 p-3 rounded-md space-y-3">`;

                            // ⭐ [修改 1/3] 無條件顯示日期，因為只要能進到這個 if 區塊，就代表需要顯示日期
                            noteHtml += `<p class="text-sm font-semibold text-gray-400">${noteDate}</p>`;
                            
                            // ⭐ [修改 2/3] 如果有使用者備註，則顯示備註內容 (不再包含日期)
                            if (hasUserNote) {
                                noteHtml += `
                                    <div class="pl-2 border-l-2 border-gray-600">
                                        <p class="text-xs text-gray-500">您的備註</p>
                                        <p class="text-base text-gray-200 whitespace-pre-wrap">${d.note}</p>
                                    </div>
                                `;
                            }
                            
                            // 建立管理員區塊 (邏輯不變)
                            let adminSection = '';
                            if (hasAdminNote) {
                                adminSection += `
                                    <div>
                                        <p class="text-sm font-semibold text-yellow-400 mb-1">
                                            <ion-icon name="ribbon-outline" class="mr-1"></ion-icon>指導建議
                                        </p>
                                        <p class="text-base text-yellow-200/90 whitespace-pre-wrap">${d.adminNote}</p>
                                    </div>
                                `;
                            }
                            if (app.state.user.isAdmin) {
                                adminSection += `
                                    <div class="pt-2 text-right">
                                        <button class="js-admin-comment-btn text-sm text-yellow-500 hover:text-yellow-300 font-semibold"
                                                data-date="${noteDate}" 
                                                data-motion="${exerciseName}"
                                                data-current-comment="${d.adminNote || ''}">
                                            ${hasAdminNote ? '編輯建議' : '新增建議'}
                                        </button>
                                    </div>
                                `;
                            }

                            // ⭐ [修改 3/3] 只有在同時有「使用者備註」和「管理員區塊」時，才新增分隔線
                            if (hasUserNote && adminSection.trim() !== '') {
                                noteHtml += `<div class="border-t border-yellow-500/30 pt-3 mt-3">` + adminSection + `</div>`;
                            } else {
                                noteHtml += adminSection;
                            }

                            noteHtml += `</div>`;
                            notesContainer.innerHTML += noteHtml;
                        }
                    });

                    if (notesFound > 0) {
                        notesContainer.classList.remove('hidden');
                    }

                    // --- Chart.js 繪圖程式碼 (保持不變) ---
                    app.state.charts.exerciseProgress = new Chart(ctx, {
                        type: 'line',
                        data: {
                            datasets: [
                                {
                                    label: '最大重量 (kg)',
                                    data: exerciseData.map(d => ({ x: d.x, y: d.maxWeight })),
                                    borderColor: '#ffc300',
                                    yAxisID: 'y_weight',
                                    tension: 0.1,
                                },
                                {
                                    label: '推估 1RM (kg)',
                                    data: exerciseData.map(d => ({ x: d.x, y: d.bestE1RM })),
                                    borderColor: '#f87171',
                                    borderDash: [5, 5],
                                    yAxisID: 'y_weight',
                                    tension: 0.1,
                                },
                                {
                                    label: '總訓練量 (kg)',
                                    data: exerciseData.map(d => ({ x: d.x, y: d.totalVolume })),
                                    borderColor: '#38bdf8',
                                    yAxisID: 'y_volume',
                                    tension: 0.1,
                                }
                            ]
                        },
                        options: {
                            responsive: true,
                            aspectRatio: 1.6,
                            interaction: { mode: 'index', intersect: false },
                            scales: {
                                x: { 
                                    type: 'time', 
                                    time: { 
                                        unit: 'day',
                                        displayFormats: { day: 'MMM d' }
                                    },
                                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                                    ticks: { color: '#9ca3af' }
                                },
                                y_weight: {
                                    type: 'linear', display: true, position: 'left',
                                    title: { display: true, text: '重量 (kg)', color: '#ffc300' },
                                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                                    ticks: { color: '#ffc300' }
                                },
                                y_volume: {
                                    type: 'linear', display: true, position: 'right',
                                    title: { display: true, text: '總訓練量 (kg)', color: '#38bdf8' },
                                    grid: { drawOnChartArea: false },
                                    ticks: { color: '#38bdf8' }
                                }
                            },
                            plugins: { 
                                legend: { labels: { color: '#e5e7eb' } },
                                datalabels: {
                                    display: false
                                }
                            }
                        }
                    });
                },

                async handleSaveBodyPhotos() {
                    const dateInput = document.getElementById('photo-date-input');
                    const weightInput = document.getElementById('photo-weight-input');
                    const bodyfatInput = document.getElementById('photo-bodyfat-input');
                    const photoInputs = {
                        front: document.getElementById('photo-front-upload'),
                        side: document.getElementById('photo-side-upload'),
                        back: document.getElementById('photo-back-upload')
                    };

                    const files = {
                        front: photoInputs.front.files[0],
                        side: photoInputs.side.files[0],
                        back: photoInputs.back.files[0]
                    };

                    const weightValue = weightInput.value;
                    const bodyfatValue = bodyfatInput.value;
                    const hasPhotos = files.front || files.side || files.back;
                    const hasData = weightValue || bodyfatValue;

                    if (!hasPhotos && !hasData) {
                        app.ui.showToast('請至少上傳一張照片或填寫一項身體數據。', 'error');
                        return;
                    }

                    app.ui.showLoading(true);

                    const photoData = { 
                        date: dateInput.value,
                        weight: weightValue,
                        bodyfat: bodyfatValue
                    };

                    // 🆕 優化：使用 Promise.all 並行壓縮所有照片
                    const compressionTasks = [];
                    
                    if (files.front) {
                        compressionTasks.push(
                            app.methods._compressAndReadFileAsBase64(files.front)
                                .then(base64 => ({ type: 'front', data: base64 }))
                        );
                    }
                    if (files.side) {
                        compressionTasks.push(
                            app.methods._compressAndReadFileAsBase64(files.side)
                                .then(base64 => ({ type: 'side', data: base64 }))
                        );
                    }
                    if (files.back) {
                        compressionTasks.push(
                            app.methods._compressAndReadFileAsBase64(files.back)
                                .then(base64 => ({ type: 'back', data: base64 }))
                        );
                    }

                    try {
                        // ✅ 並行處理所有照片壓縮（比原本快 3 倍！）
                        const compressedPhotos = await Promise.all(compressionTasks);
                        
                        // 將結果填入 photoData
                        compressedPhotos.forEach(photo => {
                            photoData[photo.type] = photo.data;
                        });

                        const response = await app.api.saveBodyPhotos(photoData);
                        
                        if (response.status === 'error') {
                            throw new Error(response.message);
                        }
                        
                        app.ui.showToast(response.message);
                        app.cache.clearBodyStatsRelated();

                        // 清空輸入框
                        photoInputs.front.value = '';
                        photoInputs.side.value = '';
                        photoInputs.back.value = '';
                        weightInput.value = '';
                        bodyfatInput.value = '';

                        document.getElementById('photo-front-preview').innerHTML = '<span class="text-gray-500">正面預覽</span>';
                        document.getElementById('photo-side-preview').innerHTML = '<span class="text-gray-500">側面預覽</span>';
                        document.getElementById('photo-back-preview').innerHTML = '<span class="text-gray-500">背面預覽</span>';

                        if (response.latestPhotos) {
                            app.ui.populateLatestPhotos(response.latestPhotos);
                        }
                        if(response.updatedProfileData){
                            app.ui.populateProfileData(response.updatedProfileData);
                            app.methods.loadInBodyRecords();
                            app.methods.calculateRecommendations();
                        }

                    } catch (error) {
                        this.handleError(error, '照片上傳失敗');
                    } finally {
                        app.ui.showLoading(false);
                    }
                },

                async _compressAndReadFileAsBase64(file) {
                    // 🆕 使用常數
                    const options = {
                        maxSizeMB: APP_CONSTANTS.IMAGE.MAX_SIZE_MB,
                        maxWidthOrHeight: APP_CONSTANTS.IMAGE.MAX_DIMENSION,
                        useWebWorker: true
                    };

                    try {
                        console.log(`原始圖片大小: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
                        const compressedFile = await imageCompression(file, options);
                        console.log(`壓縮後圖片大小: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);

                        return new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result);
                            reader.onerror = error => reject(error);
                            reader.readAsDataURL(compressedFile);
                        });
                    } catch (error) {
                        console.error('圖片壓縮失敗:', error);
                        throw new Error('圖片壓縮失敗，請稍後再試。');
                    }
                },

                // === InBody 量測記錄 (R1) ===
                async loadInBodyRecords() {
                    const list = document.getElementById('inbody-list');
                    if (!list) return;
                    try {
                        const records = await app.api.getInBodyRecords(app.state.user.currentUser);
                        this.renderInBodyList(records);
                    } catch (error) {
                        list.innerHTML = '<p class="text-red-400 text-sm">量測記錄載入失敗</p>';
                    }
                },

                renderInBodyList(records) {
                    const list = document.getElementById('inbody-list');
                    if (!list) return;
                    const isViewingSelf = !app.state.user.loggedInEmail || app.state.user.currentUser === app.state.user.loggedInEmail;
                    const addBtn = document.getElementById('add-inbody-btn');
                    if (addBtn) addBtn.classList.toggle('hidden', !isViewingSelf);
                    if (!records || records.length === 0) {
                        list.innerHTML = '<p class="text-gray-500 text-sm">尚無量測記錄</p>';
                        return;
                    }
                    list.innerHTML = records.map(r => {
                        const dateStr = String(r.date).slice(0, 10);
                        const nums = [
                            r.weight != null ? `體重 ${r.weight} kg` : null,
                            r.bodyfat != null ? `體脂 ${r.bodyfat}%` : null,
                            r.smm != null ? `骨骼肌 ${r.smm} kg` : null,
                        ].filter(Boolean).join('｜');
                        return `
                        <div class="border border-gray-700 rounded-md p-2">
                            <div class="flex justify-between items-center">
                                <div class="text-sm"><span class="text-yellow-400">${dateStr}</span>　${nums}</div>
                                <div class="flex items-center gap-2">
                                    ${r.photoId ? `<button onclick="app.methods.toggleInBodyPhoto('${r.id}', '${r.photoId}')" class="p-1" aria-label="檢視量測單"><ion-icon name="image-outline" class="text-xl text-yellow-400 pointer-events-none"></ion-icon></button>` : ''}
                                    ${isViewingSelf ? `<button onclick="app.methods.removeInBodyRecord('${r.id}')" class="p-1" aria-label="刪除記錄"><ion-icon name="trash-outline" class="text-xl text-gray-500 hover:text-red-500 pointer-events-none"></ion-icon></button>` : ''}
                                </div>
                            </div>
                            <div id="inbody-photo-${r.id}" class="hidden mt-2 h-48"></div>
                        </div>`;
                    }).join('');
                },

                toggleInBodyPhoto(recordId, photoId) {
                    const container = document.getElementById(`inbody-photo-${recordId}`);
                    if (!container) return;
                    container.classList.toggle('hidden');
                    if (!container.classList.contains('hidden') && !container.dataset.loaded) {
                        container.dataset.loaded = '1';
                        renderDrivePhoto(container, photoId, 'InBody 量測單');
                    }
                },

                openInBodyModal() {
                    const dateInput = document.getElementById('inbody-date');
                    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
                    ['inbody-weight', 'inbody-bodyfat', 'inbody-smm', 'inbody-photo'].forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.value = '';
                    });
                    document.getElementById('inbody-modal')?.classList.remove('hidden');
                },

                closeInBodyModal() {
                    document.getElementById('inbody-modal')?.classList.add('hidden');
                },

                async saveInBodyRecordFromModal() {
                    const date = document.getElementById('inbody-date')?.value;
                    const weight = document.getElementById('inbody-weight')?.value;
                    const bodyfat = document.getElementById('inbody-bodyfat')?.value;
                    const smm = document.getElementById('inbody-smm')?.value;
                    const photoFile = document.getElementById('inbody-photo')?.files[0];
                    if (!date) { app.ui.showToast('請選擇量測日期', 'error'); return; }
                    if (!weight && !bodyfat && !smm) { app.ui.showToast('體重、體脂率、骨骼肌至少填一項', 'error'); return; }
                    try {
                        app.ui.showLoading(true);
                        const record = { date, weight, bodyfat, smm };
                        if (photoFile) record.photo = await this._compressAndReadFileAsBase64(photoFile);
                        const res = await app.api.saveInBodyRecord(record);
                        if (res.updatedProfileData) {
                            app.state.user.profileData = res.updatedProfileData;
                            app.ui.populateProfileData(res.updatedProfileData);
                        }
                        this.closeInBodyModal();
                        app.ui.showToast(res.message || 'InBody 量測已儲存！', 'success');
                        await this.loadInBodyRecords();
                    } catch (error) {
                        this.handleError(error, '儲存 InBody 量測失敗');
                    } finally {
                        app.ui.showLoading(false);
                    }
                },

                async removeInBodyRecord(recordId) {
                    if (!confirm('確定要刪除這筆量測記錄嗎？（照片將一併刪除）')) return;
                    try {
                        app.ui.showLoading(true);
                        await app.api.deleteInBodyRecord(recordId);
                        app.ui.showToast('記錄已刪除', 'success');
                        await this.loadInBodyRecords();
                    } catch (error) {
                        this.handleError(error, '刪除失敗');
                    } finally {
                        app.ui.showLoading(false);
                    }
                },

                calculateRecommendations() {
                    const basicInfoCard = document.getElementById('card-basic-info');
                    const recommendationsCard = document.getElementById('card-recommendations');

                    // ⭐ [修正 1/3] 採用更穩健的 getVal 函式，直接從 profileData 狀態讀取，不再依賴解析 UI
                    const getVal = (key) => {
                        // app.state.user.profileData 是在 App 初始化時從後端獲取的原始、乾淨的資料
                        const value = app.state.user.profileData ? app.state.user.profileData[key] : null;
                        
                        // 特別處理 select 元素，因為它們儲存的是 value，但我們需要的是數字
                        if (key === 'frequency' && value) {
                            return value; // frequency 的 value 本身就是數字
                        }
                        if (key === 'diet_plan' && value) {
                            return value;
                        }
                        return value || null;
                    };

                    const weight = parseFloat(getVal('weight'));
                    const height = parseFloat(getVal('height'));
                    const age = parseInt(getVal('age'));
                    const gender = getVal('gender');
                    const activityLevel = parseFloat(getVal('frequency'));
                    const dietPlan = getVal('diet_plan') || 'standard';

                    const display = (goal, value) => {
                        const el = document.querySelector(`#nutrition-goals-container [data-goal="${goal}"]`);
                        if (el) el.textContent = (value !== null && !isNaN(value)) ? Math.round(value) : '--';
                    };

                    const displayBMR = (id, value) => {
                        const el = document.getElementById(id);
                        if (el) el.textContent = (value !== null && !isNaN(value)) ? Math.round(value) : '--';
                    };

                    // 隱藏所有範本，稍後再根據選擇顯示
                    document.querySelectorAll('#nutrition-goals-container > div').forEach(el => el.classList.add('hidden'));
                    document.querySelectorAll('[data-diet-note]').forEach(el => el.classList.add('hidden'));
                    
                    // 如果基本資料不全，清空所有數據並返回
                    if (!weight || !height || !age || !gender || !activityLevel) {
                        displayBMR('bmr-display', null);
                        displayBMR('tdee-display', null);
                        displayBMR('water-display', null);
                        document.getElementById('template-standard-diet').classList.remove('hidden');
                        return;
                    }

                    let bmr = (gender === 'male') 
                        ? (10 * weight + 6.25 * height - 5 * age + 5)
                        : (10 * weight + 6.25 * height - 5 * age - 161);
                    
                    const tdee = bmr * activityLevel;
                    const water = weight * 35;
                    
                    // ⭐ [修正 2/3] BMR 欄位現在改回顯示 BMR，TDEE 欄位顯示 TDEE
                    displayBMR('bmr-display', bmr);
                    displayBMR('tdee-display', tdee);
                    displayBMR('water-display', water);

                    // --- 根據選擇的飲食法，執行不同的計算和 UI 更新 ---
                    switch (dietPlan) {
                        case 'intermittent-fasting':
                            document.querySelector('[data-diet-note="intermittent-fasting"]').classList.remove('hidden');
                        case 'standard':
                            document.getElementById('template-standard-diet').classList.remove('hidden');
                            
                            let protM = weight * 1.6, fatM = weight * 0.8;
                            display('maintain-calories', tdee);
                            display('maintain-protein', protM);
                            display('maintain-fat', fatM);
                            display('maintain-carbs', (tdee - protM*4 - fatM*9) / 4);
                            
                            let protB = weight * 2.0, fatB = weight * 1.0;
                            display('bulk-calories', tdee + 300);
                            display('bulk-protein', protB);
                            display('bulk-fat', fatB);
                            display('bulk-carbs', (tdee + 300 - protB*4 - fatB*9) / 4);

                            let protC = weight * 2.2, fatC = weight * 0.8;
                            display('cut-calories', tdee - 300);
                            display('cut-protein', protC);
                            display('cut-fat', fatC);
                            display('cut-carbs', (tdee - 300 - protC*4 - fatC*9) / 4);
                            break;

                        case 'keto':
                            document.getElementById('template-keto-diet').classList.remove('hidden');
                            const ketoCals = tdee - 400;
                            const ketoProt = weight * 1.5;
                            const ketoCarbs = 25;
                            const ketoFat = (ketoCals - ketoProt*4 - ketoCarbs*4) / 9;
                            
                            display('keto-calories', ketoCals);
                            display('keto-protein', ketoProt);
                            display('keto-fat', ketoFat);
                            display('keto-carbs', ketoCarbs);
                            break;
                        
                        case 'carb-cycling':
                            document.getElementById('template-carb-cycling-diet').classList.remove('hidden');
                            
                            const hcCals = tdee + 200;
                            const hcProt = weight * 2.0;
                            const hcFat = weight * 0.6;
                            const hcCarbs = (hcCals - hcProt*4 - hcFat*9) / 4;
                            
                            display('highcarb-calories', hcCals);
                            display('highcarb-protein', hcProt);
                            display('highcarb-fat', hcFat);
                            display('highcarb-carbs', hcCarbs);

                            const lcCals = tdee - 400;
                            const lcProt = weight * 2.2;
                            const lcFat = weight * 1.0;
                            const lcCarbs = (lcCals - lcProt*4 - lcFat*9) / 4;

                            display('lowcarb-calories', lcCals);
                            display('lowcarb-protein', lcProt);
                            display('lowcarb-fat', lcFat);
                            display('lowcarb-carbs', lcCarbs);
                            break;
                    }
                },

                handleSaveWorkout() {
                    const workoutData = app.methods.collectWorkoutData();
                    if (workoutData.length === 0) {
                        app.ui.showToast('沒有任何訓練資料可以儲存。');
                        return;
                    }

                    app.ui.showLoading(true);
                    
                    app.api.saveWorkoutData(workoutData)
                        .then(response => {
                            app.ui.showToast(response.message);
                            
                            // 🆕 儲存成功後，立即清除相關快取
                            app.cache.clearWorkoutRelated();
                            
                            return app.api.processWorkoutForPRs(workoutData);
                        })
                        .then(prResponse => {
                            if (prResponse && prResponse.status === 'success' && prResponse.newPRs.length > 0) {
                                const prMessage = "<strong>恭喜達成新紀錄！</strong><br>" + prResponse.newPRs.join("<br>");
                                app.ui.showToast(prMessage);
                            }
                        })
                        .catch(error => {
                            this.handleError(error, '儲存訓練日誌或處理 PR 失敗');
                        })
                        .finally(() => {
                            app.ui.showLoading(false);
                        });
                },

                collectWorkoutData() {
                    const LB_TO_KG = 0.45359237;
                    const allExerciseCards = document.querySelectorAll('#workout-list .card');
                    const workoutData = [];
                    const selectedDateString = document.getElementById('workout-date-input').value;

                    const now = new Date();
                    const finalDate = new Date(selectedDateString);

                    finalDate.setHours(now.getHours());
                    finalDate.setMinutes(now.getMinutes());
                    finalDate.setSeconds(now.getSeconds());

                    const dateToSave = finalDate.toISOString();

                    allExerciseCards.forEach(card => {
                      const exerciseName = card.querySelector('h3').textContent;
                      const note = card.querySelector('.js-exercise-note').value; // 讀取備註
                      const sets = card.querySelectorAll('.js-set-row');

                      sets.forEach((set, index) => {
                        const weightInput = set.querySelector('.js-weight-input');
                        const repsInput = set.querySelector('.js-reps-input');
                        const unitSelect = set.querySelector('.js-unit-select');

                        const weight = parseFloat(weightInput.value) || 0;
                        const reps = parseInt(repsInput.value) || 0;
                        const unit = unitSelect.value;

                        let weightInKg = weight;
                        if (unit === '磅') {
                          weightInKg = parseFloat((weight * LB_TO_KG).toFixed(2));
                        }

                        if (weight > 0 || reps > 0) {
                          workoutData.push({
                            date: dateToSave,
                            motion: exerciseName,
                            set: index + 1,
                            weight: weight,
                            unit: unit,
                            reps: reps,
                            weight_in_kg: weightInKg,
                            note: note // 將備註加入到每一組的資料中
                          });
                        }
                      });
                    });
                    console.log("收集到的訓練資料:", workoutData);
                    return workoutData;
                },

                updateDailyTotalVolume() {
                    const LB_TO_KG = 0.45359237;
                    const allExerciseCards = document.querySelectorAll('#workout-list .card');
                    let dailyTotalVolumeInKg = 0;

                    allExerciseCards.forEach(card => {
                        const sets = card.querySelectorAll('.js-set-row');
                        sets.forEach(set => {
                            const weightInput = set.querySelector('.js-weight-input');
                            const repsInput = set.querySelector('.js-reps-input');
                            const unitSelect = set.querySelector('.js-unit-select');
                            
                            let weight = parseFloat(weightInput.value) || 0;
                            const reps = parseInt(repsInput.value) || 0;
                            const currentUnit = unitSelect.value;

                            if (currentUnit === '磅') {
                                weight = weight * LB_TO_KG;
                            }
                            
                            dailyTotalVolumeInKg += weight * reps;
                        });
                    });

                    const displayElement = document.getElementById('daily-total-volume-display');
                    if (displayElement) {
                        const finalVolume = parseFloat(dailyTotalVolumeInKg.toFixed(2));
                        displayElement.textContent = `${finalVolume} 公斤`;
                    }
                },

                calculateVolume(exerciseCard) {
                    const LB_TO_KG = 0.45359237;
                    const KG_TO_LB = 2.20462262;
                    const sets = exerciseCard.querySelectorAll('.js-set-row');
                    let totalVolumeInKg = 0;
                    let displayUnit = '公斤';

                    if (sets.length > 0) {
                        const firstUnitSelect = sets[0].querySelector('.js-unit-select');
                        if (firstUnitSelect) {
                            displayUnit = firstUnitSelect.value;
                        }
                    }

                    sets.forEach(set => {
                        const weightInput = set.querySelector('.js-weight-input');
                        const repsInput = set.querySelector('.js-reps-input');
                        const unitSelect = set.querySelector('.js-unit-select');
                        
                        let weight = parseFloat(weightInput.value) || 0;
                        const reps = parseInt(repsInput.value) || 0;
                        const currentUnit = unitSelect.value;

                        if (currentUnit === '磅') {
                            weight = weight * LB_TO_KG;
                        }
                        
                        totalVolumeInKg += weight * reps;
                    });

                    let displayVolume = totalVolumeInKg;
                    if (displayUnit === '磅') {
                        displayVolume = totalVolumeInKg * KG_TO_LB;
                    }
                    
                    const displayElement = exerciseCard.querySelector('.js-volume-display');
                    if (displayElement) {
                        const finalVolume = parseFloat(displayVolume.toFixed(2));
                        displayElement.textContent = `${finalVolume} ${displayUnit}`;
                    }
                },
				
                // 輔助函式：專門用來從模板創建一個「組」元素
                createSetElement(setNumber) {
                    const template = document.getElementById('set-row-template');
                    const newSet = document.importNode(template.content, true); // 複製模板
                    
                    // 填入組別編號
                    newSet.querySelector('.js-set-number').textContent = `SET ${setNumber}`;
                    return newSet;
                },
                
                addSet(exerciseCard) {
                    const setsContainer = exerciseCard.querySelector('.js-sets-container');
                    const allSets = setsContainer.querySelectorAll('.js-set-row');
                    const setNumber = allSets.length + 1;

                    // (新功能) 獲取上一組的數據
                    let lastWeight = '';
                    let lastUnit = '公斤';
                    if (allSets.length > 0) {
                        const lastSet = allSets[allSets.length - 1];
                        lastWeight = lastSet.querySelector('.js-weight-input').value;
                        lastUnit = lastSet.querySelector('.js-unit-select').value;
                    }

                    const newSetElement = this.createSetElement(setNumber);
                    newSetElement.firstElementChild.classList.add('animated-item', 'fade-in');
                    
                    // (新功能) 將數據填入新的一組
                    newSetElement.querySelector('.js-weight-input').value = lastWeight;
                    newSetElement.querySelector('.js-unit-select').value = lastUnit;
                    
                    setsContainer.appendChild(newSetElement);
                    const addedSet = setsContainer.querySelector('.js-set-row:last-child');
                    if(addedSet) {
                        setTimeout(() => addedSet.classList.add('is-visible'), 10);
                    }

                    this.calculateVolume(exerciseCard);
                    this.updateDailyTotalVolume();
                    
                    // (新功能) 自動將焦點移至新組的「次數」輸入框，方便快速輸入
                    const newRepsInput = setsContainer.querySelector('.js-set-row:last-child .js-reps-input');
                    if (newRepsInput) {
                        newRepsInput.focus();
                    }
                },

                deleteSet(setRow) {
                    const exerciseCard = setRow.closest('.card');
                    const setsContainer = setRow.parentElement;

                    // 1. 啟動單一組別的刪除動畫
                    app.ui.removeWithAnimation(setRow);

                    // 2. 等待動畫結束後，再執行後續判斷
                    setTimeout(() => {
                        const remainingSets = setsContainer.querySelectorAll('.js-set-row');

                        // ✅ 核心判斷邏輯
                        if (remainingSets.length === 0) {
                            // 如果這是最後一組，就刪除整個動作卡片
                            // 並將更新總容量的函式作為回呼，在卡片刪除後執行
                            app.ui.removeWithAnimation(exerciseCard, app.methods.updateDailyTotalVolume);
                        } else {
                            // 如果還有剩餘組別，就執行原本的重新編號和更新容量
                            remainingSets.forEach((set, index) => {
                                const setNumberSpan = set.querySelector('.js-set-number');
                                if (setNumberSpan) {
                                    setNumberSpan.textContent = `SET ${index + 1}`;
                                }
                            });

                            if (exerciseCard) {
                                app.methods.calculateVolume(exerciseCard);
                            }
                            app.methods.updateDailyTotalVolume();
                        }
                    }, 300); // 這個延遲時間必須與動畫時間一致
                },
                
                handleAddExerciseClick() {
                    app.ui.showAutocompleteModal(true, (exerciseName) => {
                      if (exerciseName && exerciseName.trim() !== '') {
                        app.methods.addExercise(exerciseName.trim());
                        app.ui.showAutocompleteModal(false);
                      } else {
                        app.ui.showToast('請輸入動作名稱！');
                      }
                    });
                },
				
                updateAutocompleteSuggestions(inputValue) {
                    const suggestionsList = document.getElementById('suggestions-list');
                    suggestionsList.innerHTML = ''; // 清空舊的建議
                    const query = inputValue.toLowerCase().trim();

                    if (query.length === 0) {
                      return; // 如果輸入為空，不顯示任何建議
                    }

                    const filteredNames = app.state.cache.exerciseNameList.filter(name => 
                      name.toLowerCase().includes(query)
                    );

                    filteredNames.slice(0, 5).forEach(name => { // 最多顯示 5 筆建議
                      const item = document.createElement('button');
                      item.className = 'w-full text-left p-2 bg-gray-800 hover:bg-gray-700 rounded-md js-suggestion-item';
                      item.textContent = name;
                      suggestionsList.appendChild(item);
                    });
                },
                
                handleSaveAsTemplateClick() {
                    const exerciseCards = document.querySelectorAll('#workout-list .card');
                    if (exerciseCards.length === 0) {
                        app.ui.showToast('日誌中沒有任何動作可以儲存為範本。');
                        return;
                    }
                    app.ui.showPromptModal(true, '另存為範本', '請輸入範本名稱...', (templateName) => {
                        if (templateName) {
                            const exercises = [...exerciseCards].map(card => card.querySelector('h3').textContent);
                            app.ui.showLoading(true);
                            app.api.saveWorkoutTemplate(templateName, exercises)
                                .then(response => {
                                    app.ui.showToast(response.message);
                                    return app.api.getWorkoutTemplates();
                                })
                                .then(templates => {
                                    app.state.cache.workoutTemplates = templates;
                                    app.ui.populateTemplateList(templates);
                                })
                                .catch(err => {
                                    // 【修改】
                                    this.handleError(err, '儲存範本失敗');
                                })
                                .finally(() => { //
                                    app.ui.showPromptModal(false);
                                    app.ui.showLoading(false);
                                });
                        } else {
                            app.ui.showToast('請輸入範本名稱！');
                        }
                    });
                },

                handleLoadTemplate(templateName) {
                    const template = app.state.cache.workoutTemplates[templateName];
                    if (template && confirm('確定要載入範本「' + templateName + '」嗎？這將會覆蓋目前的日誌內容。')) {
                        app.ui.clearWorkoutLog();
                        template.forEach(exercise => app.methods.addExercise(exercise.name));
                        app.ui.showLoadTemplateModal(false);
                    }
                },

                handleDeleteTemplate(templateName) {
                    // 顯示確認對話框
                    app.state.modal.confirmCallback = () => {
                        app.ui.showLoading(true);
                        app.api.deleteWorkoutTemplate(templateName)
                            .then(response => {
                                if (response.status === 'error') throw new Error(response.message);
                                
                                app.ui.showToast(response.message);
                                
                                // 刪除成功後，重新獲取最新的範本列表並更新UI
                                return app.api.getWorkoutTemplates();
                            })
                            .then(templates => {
                                app.state.cache.workoutTemplates = templates;
                                app.ui.populateTemplateList(templates);
                            })
                            .catch(err => {
                                this.handleError(err, '刪除範本失敗');
                            })
                            .finally(() => {
                                app.ui.showLoading(false);
                            });
                    };
                    app.ui.showConfirmDeleteModal(true, `您確定要刪除範本「${templateName}」嗎？此操作無法復原。`);
                },
                
                handleClearWorkoutClick() {
                    const exerciseCards = document.querySelectorAll('#workout-list .card');
                    if (exerciseCards.length === 0) {
                        app.ui.showToast('日誌已經是空的。');
                        return;
                    }
                    app.state.modal.confirmCallback = () => app.ui.clearWorkoutLog();
                    app.ui.showConfirmDeleteModal(true, '您確定要清空所有訓練動作嗎？此操作無法復原。');
                },
                
                addExercise(name) {
                    const workoutList = document.getElementById('workout-list');
                    if (!workoutList) return;
                    
                    // 1. 取得並複製 "動作卡片" 模板
                    const template = document.getElementById('exercise-card-template');
                    const newCardFragment = document.importNode(template.content, true);
                    
                    // 2. 取得卡片根元素並設定動態內容
                    const cardElement = newCardFragment.querySelector('.card');
                    const cardId = 'exercise-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
                    cardElement.id = cardId;
                    cardElement.classList.add('animated-item', 'fade-in');
                    cardElement.querySelector('h3').textContent = name;
                    
                    // 3. 在卡片中新增第一組
                    const setsContainer = cardElement.querySelector('.js-sets-container');
                    const firstSetElement = this.createSetElement(1);
                    setsContainer.appendChild(firstSetElement);

                    // 4. 將完成的卡片加到畫面上
                    workoutList.appendChild(newCardFragment);
                    setTimeout(() => {
                        cardElement.classList.add('is-visible');
                    }, 10);

                    // 5. (邏輯不變) 查詢上次表現
                    const performanceEl = cardElement.querySelector('.js-last-performance');
                    app.api.getLatestPerformance(name, app.state.user.currentUser).then(data => {
                      if (data && data.weight_kg != null && data.reps != null) { // 檢查 weight_kg 和 reps 是否存在
                        //performanceEl.innerHTML = `上次: <span class="font-bold">${data.weight_kg} kg(${data.weight_lbs} lbs) x ${data.reps} 次</span>`;
                        performanceEl.innerHTML = `上次: <span class="font-bold">${data.weight_kg} kg x ${data.reps} 次</span>`;
                      } else {
                        performanceEl.textContent = '無歷史紀錄'; //
                      }
                    }).catch(err => {
                      performanceEl.textContent = '查詢失敗';
                      this.handleError(err, `查詢 ${name} 上次表現失敗`);
                    });

                    this.updateDailyTotalVolume();
                },

                copyLastSet(exerciseCard) {
                    const setsContainer = exerciseCard.querySelector('.js-sets-container');
                    const lastSet = setsContainer.querySelector('.js-set-row:last-child');

                    if (!lastSet) {
                        // 如果連一組都沒有，就執行新增空白組
                        this.addSet(exerciseCard);
                        return;
                    }

                    // 讀取最後一組的數據
                    const lastWeight = lastSet.querySelector('.js-weight-input').value;
                    const lastReps = lastSet.querySelector('.js-reps-input').value;
                    const lastUnit = lastSet.querySelector('.js-unit-select').value;
                    
                    // 先新增一個空白組
                    this.addSet(exerciseCard);
                    
                    // 找到剛剛新增的那一組 (現在的最後一組)
                    const newSet = setsContainer.querySelector('.js-set-row:last-child');
                    if (newSet) {
                        // 將上一組的數據填入
                        newSet.querySelector('.js-weight-input').value = lastWeight;
                        newSet.querySelector('.js-reps-input').value = lastReps;
                        newSet.querySelector('.js-unit-select').value = lastUnit;
                    }
                    
                    // 更新總容量計算
                    this.calculateVolume(exerciseCard);
                    this.updateDailyTotalVolume();
                },

                deleteExercise(exerciseCard) {
                    const exerciseName = exerciseCard.querySelector('h3').textContent;
                    app.state.modal.elementToDelete = exerciseCard;
                    app.state.modal.confirmCallback = () => {
                        if(app.state.modal.elementToDelete) {
                            app.ui.removeWithAnimation(app.state.modal.elementToDelete, app.methods.updateDailyTotalVolume);
                        }
                    };
                    app.ui.showConfirmDeleteModal(true, '您確定要刪除「' + exerciseName + '」這個動作嗎？');
                },
				
                // 格式化秒數為 mm:ss
                formatTime(seconds) {
                    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
                    const secs = (seconds % 60).toString().padStart(2, '0');
                    return `${mins}:${secs}`;
                },

                // 更新計時器顯示
                updateTimerDisplay() {
                    const timerDisplay = document.getElementById('timer-display');
                    if (timerDisplay) {
                        timerDisplay.textContent = this.formatTime(app.state.timer.secondsLeft); // 🆕
                    }
                },

                // 開始計時
                startTimer(seconds) {
                    if (app.state.timer.interval) { // 🆕
                        clearInterval(app.state.timer.interval); // 🆕
                    }
                    app.state.timer.secondsLeft = seconds; // 🆕
                    this.updateTimerDisplay();

                    const timerBar = document.getElementById('rest-timer-bar');
                    timerBar.classList.remove('hidden');

                    app.state.timer.interval = setInterval(() => { // 🆕
                        app.state.timer.secondsLeft--; // 🆕
                        this.updateTimerDisplay();
                        if (app.state.timer.secondsLeft <= 0) { // 🆕
                            this.resetTimer();
                            alert('休息結束！');
                        }
                    }, 1000);
                },

                // 增加或減少時間
                addTimerTime(seconds) {
                    if(app.state.timer.interval) { // 🆕
                        app.state.timer.secondsLeft += seconds; // 🆕
                        if(app.state.timer.secondsLeft < 0) app.state.timer.secondsLeft = 0; // 🆕
                        this.updateTimerDisplay();
                    }
                },

                // 重置並隱藏計時器
                resetTimer() {
                    if (app.state.timer.interval) { // 🆕
                        clearInterval(app.state.timer.interval); // 🆕
                        app.state.timer.interval = null; // 🆕
                    }
                    const timerBar = document.getElementById('rest-timer-bar');
                    timerBar.classList.add('hidden');
                },

                async handleOpenCompareModal() {
                    app.ui.showCompareModal(true);
                    // 如果從未載入過歷史資料，就去後端讀取一次
                    if (app.state.cache.photoHistory.length === 0 || app.state.cache.photoHistory.currentUser !== app.state.user.currentUser) {
                        try {
                            app.ui.showLoading(true);
                            const records = await app.api.getAllPhotoRecords(app.state.user.currentUser);
                            if (records.error) throw new Error(records.error);

                            app.state.cache.photoHistory = records; // 將資料存起來
                            app.state.cache.photoHistory.currentUser = app.state.user.currentUser;

                            // 填充下拉選單
                            const selectBefore = document.getElementById('compare-select-before');
                            const selectAfter = document.getElementById('compare-select-after');
                            selectBefore.innerHTML = '<option value="">選擇對比日期 (之前)</option>';
                            selectAfter.innerHTML = '<option value="">選擇對比日期 (之後)</option>';

                            records.forEach(record => {
                                const date = new Date(record.date).toLocaleDateString();
                                const option = `<option value="${record.date}">${date}</option>`;
                                selectBefore.innerHTML += option;
                                selectAfter.innerHTML += option;
                            });
                        } catch (e) {
                            this.handleError(e, '無法載入照片歷史紀錄');
                        } finally {
                            app.ui.showLoading(false);
                        }
                    } else {
                        console.log(`Using cached photo history for ${app.state.user.currentUser}.`);
                        // 如果快取有效，也需要重新填充下拉選單 (因為 modal 可能被重用了)
                        const selectBefore = document.getElementById('compare-select-before');
                        const selectAfter = document.getElementById('compare-select-after');
                        selectBefore.innerHTML = '<option value="">選擇對比日期 (之前)</option>';
                        selectAfter.innerHTML = '<option value="">選擇對比日期 (之後)</option>';
                        app.state.cache.photoHistory.forEach(record => {
                            const date = new Date(record.date).toLocaleDateString();
                            const option = `<option value="${record.date}">${date}</option>`;
                            selectBefore.innerHTML += option;
                            selectAfter.innerHTML += option;
                        });
                    }
                },

                // 當下拉選單變更時，更新對應的圖片
                updateCompareImage(position, dateISO) { // position is 'before' or 'after'
                    const record = app.state.cache.photoHistory.find(r => r.date === dateISO);

                    const types = ['front', 'side', 'back'];
                    types.forEach(type => {
                        const container = document.getElementById(`compare-${type}-${position}`);
                        if (!record) { // 如果是選擇 "請選擇..."
                            container.innerHTML = `<span class="text-gray-500">${type === 'front' ? '正面' : (type === 'side' ? '側面' : '背面')}</span>`;
                            return;
                        }

                        const photoId = record[`photo_${type}_id`];
                        if (photoId) {
                            renderDrivePhoto(container, photoId, '歷史照片對比');
                        } else {
                            container.innerHTML = '<span class="text-gray-500">無照片</span>';
                        }
                    });
                },

                async loadPRData() {
                    // 🆕 使用快取管理系統檢查
                    if (app.cache.isValid(app.cache.keys.PR_DATA, app.state.user.currentUser)) {
                        console.log(`使用 ${app.state.user.currentUser} 的快取 PR 資料`);
                        app.ui.showPRsState(app.state.cache.prData.bests.length > 0 || app.state.cache.prData.repPRs.length > 0 ? 'content' : 'empty');
                        this.renderPRs(app.state.cache.prData);
                        return;
                    }

                    app.ui.showPRsState('loading');
                    try {
                        console.log(`為 ${app.state.user.currentUser} 重新載入 PR 資料...`);
                        const data = await app.api.getAllPRs(app.state.user.currentUser);
                        if (data.error) throw new Error(data.error);

                        app.state.cache.prData = data;
                        app.state.cache.prData.currentUser = app.state.user.currentUser;

                        const hasData = data.bests.length > 0 || data.repPRs.length > 0;
                        if (hasData) {
                            this.renderPRs(data);
                            app.ui.showPRsState('content');
                        } else {
                            app.ui.showPRsState('empty');
                        }
                    } catch (e) {
                        this.handleError(e, '無法載入個人紀錄');
                        app.ui.showPRsState('empty');
                    }
                },

                // 將 PR 資料渲染成 HTML 並顯示在頁面上
                renderPRs(data) {
                    const bestsContainer = document.getElementById('bests-container');
                    const repPRsContainer = document.getElementById('rep-prs-container');
                    if (!bestsContainer || !repPRsContainer) return;

                    bestsContainer.innerHTML = '';
                    repPRsContainer.innerHTML = '';

                    const todayString = new Date().toDateString();
                    const categoryOrder = ['胸', '肩', '背', '臀', '腿', '手', '其他'];

                    // 渲染 Bests 區塊
                    const groupedBests = data.bests.reduce((acc, b) => {
                        if (!acc[b.category]) acc[b.category] = [];
                        acc[b.category].push(b);
                        return acc;
                    }, {});

                    categoryOrder.forEach(category => {
                        const titleEl = document.createElement('h4');
                        titleEl.className = 'text-xl font-semibold text-yellow-400 mt-6 mb-3 category-title';
                        titleEl.textContent = category;
                        bestsContainer.appendChild(titleEl);

                        const itemsContainer = document.createElement('div');
                        itemsContainer.className = 'space-y-3 pr-sortable-container';
                        itemsContainer.dataset.category = category;

                        if (groupedBests[category] && groupedBests[category].length > 0) {
                            groupedBests[category].forEach(b => {
                                const isNewPR = (b.heaviestDateISO && new Date(b.heaviestDateISO).toDateString() === todayString) || (b.e1rmDateISO && new Date(b.e1rmDateISO).toDateString() === todayString);
                                const itemHtml = `
                                <div class="card p-3 rounded-md pr-card ${isNewPR ? 'is-new-pr' : ''}" data-motion="${b.motion}">
                                    ${isNewPR ? '<ion-icon name="ribbon-outline" class="new-pr-crown"></ion-icon><span class="new-pr-badge">NEW!</span>' : ''}
                                    <div class="flex items-center gap-2 pointer-events-none">
                                        <ion-icon name="menu-outline" class="js-pr-drag-handle hidden text-2xl text-gray-500 cursor-grab pointer-events-auto"></ion-icon>
                                        <p class="font-semibold text-base text-yellow-400">${b.motion}</p>
                                    </div>
                                    <div class="flex justify-between items-center text-sm mt-1 pointer-events-none">
                                        <span class="text-gray-400">最重重量:</span><span class="font-bold text-white">${b.heaviestWeight} kg <span class="text-xs text-gray-500">(${b.heaviestDate})</span></span>
                                    </div>
                                    <div class="flex justify-between items-center text-sm mt-1 pointer-events-none">
                                        <span class="text-gray-400">最高 E1RM:</span><span class="font-bold text-white">${b.bestEst1RM} kg <span class="text-xs text-gray-500">(${b.e1rmDate})</span></span>
                                    </div>
                                </div>`;
                                itemsContainer.innerHTML += itemHtml;
                            });
                        } else {
                            itemsContainer.innerHTML = '<p class="text-gray-500 text-sm pl-4 pr-placeholder">尚無 Bests 紀錄。</p>';
                        }
                        bestsContainer.appendChild(itemsContainer);
                    });

                    // 渲染 Rep PRs 區塊
                    const groupedRepPRs = data.repPRs.reduce((acc, pr) => {
                        if (!acc[pr.category]) acc[pr.category] = {};
                        if (!acc[pr.category][pr.motion]) acc[pr.category][pr.motion] = [];
                        acc[pr.category][pr.motion].push(pr);
                        return acc;
                    }, {});

                    categoryOrder.forEach(category => {
                        const titleEl = document.createElement('h4');
                        titleEl.className = 'text-xl font-semibold text-yellow-400 mt-8 mb-3 category-title';
                        titleEl.textContent = category;
                        repPRsContainer.appendChild(titleEl);

                        const motionContainer = document.createElement('div');
                        motionContainer.className = 'space-y-4 pr-sortable-container';
                        motionContainer.dataset.category = category;

                        if (groupedRepPRs[category] && Object.keys(groupedRepPRs[category]).length > 0) {
                            for (const motion in groupedRepPRs[category]) {
                                const prsForMotion = groupedRepPRs[category][motion];
                                prsForMotion.sort((a, b) => a.rmCategory - b.rmCategory);
                                const hasNewPRInGroup = prsForMotion.some(pr => pr.dateISO && (new Date(pr.dateISO).toDateString() === todayString));

                                let motionHtml = `<div class="card p-3 rounded-md pr-card ${hasNewPRInGroup ? 'is-new-pr' : ''}" data-motion="${motion}">
                                                      ${hasNewPRInGroup ? '<ion-icon name="ribbon-outline" class="new-pr-crown"></ion-icon><span class="new-pr-badge">NEW!</span>' : ''}
                                                      <div class="flex items-center gap-2 pointer-events-none mb-2">
                                                          <ion-icon name="menu-outline" class="js-pr-drag-handle hidden text-2xl text-gray-500 cursor-grab pointer-events-auto"></ion-icon>
                                                          <p class="font-semibold text-base text-white">${motion}</p>
                                                      </div>
                                                      <div class="space-y-1 pointer-events-none">`;
                                prsForMotion.forEach(pr => {
                                    motionHtml += `<div class="flex justify-between items-center text-sm bg-black/30 p-1 rounded">
                                                        <span class="text-yellow-400 w-16">${pr.rmCategory}RM</span><span class="text-white flex-grow">${pr.weight} kg</span><span class="text-xs text-gray-500">${pr.date}</span>
                                                    </div>`;
                                });
                                motionHtml += '</div></div>';
                                motionContainer.innerHTML += motionHtml;
                            }
                        } else {
                            motionContainer.innerHTML = '<p class="text-gray-500 text-sm pl-4 pr-placeholder">尚無 Rep PRs 紀錄。</p>';
                        }
                        repPRsContainer.appendChild(motionContainer);
                    });

                    // 渲染完成後，立即初始化拖曳功能
                    this.initPRsDragAndDrop();
                },

                initPRsDragAndDrop() {
                    const containers = document.querySelectorAll('.pr-sortable-container');
                    if (containers.length === 0) return;

                    const placeholderHtml = {
                        bests: '<p class="text-gray-500 text-sm pl-4 pr-placeholder">尚無 Bests 紀錄。</p>',
                        repPRs: '<p class="text-gray-500 text-sm pl-4 pr-placeholder">尚無 Rep PRs 紀錄。</p>'
                    };

                    containers.forEach(container => {
                        new Sortable(container, {
                            group: 'sharedPRs',
                            animation: 150,
                            ghostClass: 'sortable-ghost',
                            chosenClass: 'sortable-chosen',
                            disabled: !app.state.ui.isPREditMode,
                            handle: '.js-pr-drag-handle',
                            delay: 50,
                            delayOnTouchOnly: true,

                            onAdd: function(evt) {
                                const motion = evt.item.dataset.motion;
                                const newCategory = evt.to.dataset.category;
                                
                                const placeholder = evt.to.querySelector('.pr-placeholder');
                                if (placeholder) placeholder.remove();

                                app.state.pr.categoryChanges.set(motion, newCategory);
                                app.methods.syncPRCardCategory(motion, newCategory, evt.item);
                            },

                            onRemove: function(evt) {
                                if (evt.from.querySelectorAll('.pr-card').length === 0) {
                                    const containerType = evt.from.closest('#bests-container') ? 'bests' : 'repPRs';
                                    evt.from.innerHTML = placeholderHtml[containerType];
                                }
                            }
                        });
                    });
                },

                syncPRCardCategory(motion, newCategory, draggedItem) {
                    const isBestsCard = draggedItem.closest('#bests-container');
                    
                    const selector = isBestsCard 
                        ? `#rep-prs-container .pr-card[data-motion="${motion}"]`
                        : `#bests-container .pr-card[data-motion="${motion}"]`;
                    const cardToSync = document.querySelector(selector);

                    if (cardToSync) {
                        const oldContainer = cardToSync.parentElement;
                        const newContainerSelector = isBestsCard
                            ? `#rep-prs-container .pr-sortable-container[data-category="${newCategory}"]`
                            : `#bests-container .pr-sortable-container[data-category="${newCategory}"]`;
                        const newContainer = document.querySelector(newContainerSelector);
                        
                        if (newContainer && oldContainer !== newContainer) {
                            const placeholderInNew = newContainer.querySelector('.pr-placeholder');
                            if (placeholderInNew) placeholderInNew.remove();
                            
                            newContainer.appendChild(cardToSync);

                            if (oldContainer.querySelectorAll('.pr-card').length === 0) {
                                const containerType = isBestsCard ? 'repPRs' : 'bests';
                                oldContainer.innerHTML = (containerType === 'bests')
                                    ? '<p class="text-gray-500 text-sm pl-4 pr-placeholder">尚無 Bests 紀錄。</p>'
                                    : '<p class="text-gray-500 text-sm pl-4 pr-placeholder">尚無 Rep PRs 紀錄。</p>';
                            }
                        }
                    }
                },
                
                togglePREditMode(isEditing) {
                    app.state.ui.isPREditMode = isEditing;
                    
                    document.getElementById('edit-prs-btn').classList.toggle('hidden', isEditing);
                    document.getElementById('prs-edit-actions').classList.toggle('hidden', !isEditing);
                    
                    document.querySelectorAll('.pr-sortable-container').forEach(container => {
                        const sortableInstance = Sortable.get(container);
                        if (sortableInstance) {
                            sortableInstance.option('disabled', !isEditing);
                        }
                    });

                    document.querySelectorAll('.pr-card').forEach(card => {
                        card.classList.toggle('is-editable', isEditing);
                    });

                    document.querySelectorAll('.js-pr-drag-handle').forEach(handle => handle.classList.toggle('hidden', !isEditing));

                    if (!isEditing) {
                        app.state.pr.categoryChanges.clear();
                        // ⭐️ 修正取消邏輯：清除快取再重新載入
                        app.state.cache.prData = null; 
                        app.methods.loadPRData();
                    }
                },

                handleSavePRCategories() {
                    if (app.state.pr.categoryChanges.size === 0) {
                        app.ui.showToast('沒有任何分類變更需要儲存。');
                        this.togglePREditMode(false);
                        return;
                    }

                    app.ui.showLoading(true);

                    const changesArray = Array.from(app.state.pr.categoryChanges, ([motion, category]) => ({ motion, category }));

                    app.api.updateMultipleExerciseCategories(changesArray)
                        .then(response => {
                            if (response.status === 'success') {
                                app.ui.showToast(response.message);
                                app.state.pr.categoryChanges.clear();
                                app.state.cache.prData = null; // 清除快取
                                this.togglePREditMode(false);
                                app.methods.loadPRData();
                            } else {
                                throw new Error(response.message);
                            }
                        })
                        .catch(err => {
                            this.handleError(err, '儲存分類變更失敗');
                        })
                        .finally(() => {
                            app.ui.showLoading(false);
                        });
                },

                // ⭐ [新增] 當點擊 "新增/編輯建議" 按鈕時的處理函式
                handleAdminCommentClick(button) {
                    const { date, motion, currentComment } = button.dataset;
                    app.ui.showPromptModal(true, `給「${motion}」的建議`, '請輸入您的指導建議...', (newComment) => {
                        // 使用者按下確認後，呼叫儲存函式
                        if (newComment !== null) { // 允許儲存空字串來刪除留言
                            app.methods.handleSaveAdminComment(date, motion, newComment);
                        }
                    });
                    // 預先將目前的留言填入輸入框，方便編輯
                    const promptInput = document.getElementById('prompt-input');
                    if(promptInput) {
                        promptInput.value = currentComment;
                    }
                },

                // ⭐ [新增] 處理儲存管理員建議的函式
                handleSaveAdminComment(date, motion, comment) {
                    app.ui.showLoading(true);
                    app.api.saveAdminComment(app.state.user.currentUser, date, motion, comment)
                        .then(response => {
                            if (response.status === 'error') throw new Error(response.message);
                            app.ui.showToast(response.message);

                            const progressDataForMotion = app.state.cache.analysisData?.singleExerciseProgress?.[motion];
                            if (progressDataForMotion) {
                                
                                // ⭐ [關鍵修正] 在比較前，將 dp.x (ISO 字串) 也轉換成 'yyyy-MM-dd' 格式
                                const dataPointToUpdate = progressDataForMotion.find(dp => new Date(dp.x).toLocaleDateString('sv') === date);

                                if (dataPointToUpdate) {
                                    dataPointToUpdate.adminNote = comment;
                                    console.log('前端狀態已即時更新:', motion, date);
                                } else {
                                    // 這個警告現在應該不會再出現了
                                    console.warn('在前端狀態中找不到要更新的資料點:', date);
                                }
                            } else {
                                console.warn('在前端狀態中找不到對應的動作:', motion);
                            }

                            // 只重新渲染受影響的圖表和備註區
                            app.methods._renderExerciseProgressChart(motion, app.state.cache.analysisData.singleExerciseProgress);

                            const selectEl = document.getElementById('exercise-progress-select');
                            if (selectEl) {
                                selectEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                            
                        })
                        .catch(err => {
                            this.handleError(err, '儲存指導建議失敗');
                        })
                        .finally(() => {
                            app.ui.showPromptModal(false);
                            app.ui.showLoading(false);
                        });
                }
};
