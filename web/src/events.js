import { app } from './app.js';                 // call-time 引用，無循環問題
import { APP_CONSTANTS } from './constants.js';

export const events = {
                _setupPhotoPreview(inputId, previewContainerId) {
                    const inputElement = document.getElementById(inputId);
                    const previewContainer = document.getElementById(previewContainerId);

                    if (inputElement && previewContainer) {
                        inputElement.addEventListener('change', (e) => {
                            const file = e.target.files[0];
                            if (file) {
                                // 建立一個暫時的 URL 來預覽圖片
                                const previewUrl = URL.createObjectURL(file);
                                // ⭐ 修改：用 <a> 標籤包住 <img>，並加上 cursor-pointer 樣式
                                previewContainer.innerHTML = `<img src="${previewUrl}" data-fullsize-url="${previewUrl}" class="w-full h-full object-cover rounded cursor-pointer" alt="圖片預覽">`;
                            } else {
                                // 如果使用者取消選擇，可以回復到預設狀態
                                previewContainer.innerHTML = '<span class="text-gray-500">預覽</span>';
                            }
                        });
                    }
                },

                init() {
                    const userSwitcher = document.getElementById('user-switcher');
                    const dashboard = document.getElementById('page-dashboard');
                    const workoutPage = document.getElementById('page-workout');
                    const savePhotosBtn = document.getElementById('save-photos-btn');
                    
                    const promptModal = document.getElementById('prompt-modal');
                    const loadTemplateModal = document.getElementById('load-template-modal');
                    const confirmDeleteModal = document.getElementById('confirm-delete-modal');
                    const autocompleteModal = document.getElementById('autocomplete-modal');
                    const compareModal = document.getElementById('compare-photos-modal');
                    const openCompareBtn = document.getElementById('open-compare-modal-btn');

                    const timerBar = document.getElementById('rest-timer-bar');

                    const prsPage = document.getElementById('page-prs');
                    const historyPage = document.getElementById('page-history');

                    if (userSwitcher) {
                      userSwitcher.addEventListener('change', (e) => {
                        app.methods.switchUser(e.target.value);
                      });
                    }

                    if (historyPage) {
                        historyPage.addEventListener('click', this.handleHistoryPageClick.bind(this));
                    }

                    const refreshBtn = document.getElementById('refresh-analysis-btn');
                    if (refreshBtn) {
                        refreshBtn.addEventListener('click', app.methods.handleRefreshAnalysis);
                    }

                    if (dashboard) {
                        dashboard.addEventListener('click', this.handleDashboardClick.bind(this));
                        dashboard.addEventListener('input', this.handleDashboardInput.bind(this));
                        dashboard.addEventListener('change', this.handleDashboardInput.bind(this));
                    }
                    if (workoutPage) {
                        const workoutList = workoutPage.querySelector('#workout-list');
                        workoutPage.addEventListener('click', this.handleWorkoutPageClick.bind(this));
                        if(workoutList) {
                            workoutList.addEventListener('input', this.handleWorkoutListInput.bind(this));
                            workoutList.addEventListener('change', this.handleWorkoutListInput.bind(this));
                        }
                    }
                    if(savePhotosBtn) {
                        savePhotosBtn.addEventListener('click', app.methods.handleSaveBodyPhotos);
                    }
                    
                    if(promptModal) {
                        promptModal.querySelector('#prompt-cancel').addEventListener('click', () => 
                            app.ui.showPromptModal(false)
                        );
                        promptModal.querySelector('.modal-backdrop').addEventListener('click', () => 
                            app.ui.showPromptModal(false)
                        );
                        promptModal.querySelector('#prompt-confirm').addEventListener('click', () => {
                            // 🆕 使用新結構
                            if (app.state.modal.promptCallback) {
                                const input = document.getElementById('prompt-input').value;
                                app.state.modal.promptCallback(input);
                            }
                        });
                    }

                    if(loadTemplateModal) {
                        loadTemplateModal.querySelector('#load-template-cancel').addEventListener('click', () => app.ui.showLoadTemplateModal(false));
                        loadTemplateModal.querySelector('.modal-backdrop').addEventListener('click', () => app.ui.showLoadTemplateModal(false));
                        
                        // 修改這裡的事件監聽，以處理整個列表的點擊
                        loadTemplateModal.querySelector('#template-list').addEventListener('click', (e) => {
                            const loadBtn = e.target.closest('.js-load-template');
                            if (loadBtn) {
                                app.methods.handleLoadTemplate(loadBtn.dataset.templateName);
                            }

                            const deleteBtn = e.target.closest('.js-delete-template');
                            if (deleteBtn) {
                                app.methods.handleDeleteTemplate(deleteBtn.dataset.templateName);
                            }
                        });
                    }
                    
                    if(confirmDeleteModal){
                        confirmDeleteModal.querySelector('#cancel-delete').addEventListener('click', () => 
                            app.ui.showConfirmDeleteModal(false)
                        );
                        confirmDeleteModal.querySelector('.modal-backdrop').addEventListener('click', () => 
                            app.ui.showConfirmDeleteModal(false)
                        );
                        confirmDeleteModal.querySelector('#confirm-delete').addEventListener('click', () => {
                            // 🆕 使用新結構
                            if (app.state.modal.confirmCallback) {
                                app.state.modal.confirmCallback();
                            }
                            app.ui.showConfirmDeleteModal(false);
                        });
                    }
					
                    if(autocompleteModal){
                      autocompleteModal.querySelector('#autocomplete-cancel').addEventListener('click', () => app.ui.showAutocompleteModal(false));
                      autocompleteModal.querySelector('.modal-backdrop').addEventListener('click', () => app.ui.showAutocompleteModal(false));
                      autocompleteModal.querySelector('#autocomplete-confirm').addEventListener('click', () => {
                        if (app.state.modal.promptCallback) {
                          const input = document.getElementById('autocomplete-input').value;
                          app.state.modal.promptCallback(input);
                        }
                      });
                      // 當在輸入框打字時，更新建議列表
                      autocompleteModal.querySelector('#autocomplete-input').addEventListener('input', (e) => {
                        app.methods.updateAutocompleteSuggestions(e.target.value);
                      });
                      // 監聽整個建議列表的點擊事件
                      autocompleteModal.querySelector('#suggestions-list').addEventListener('click', (e) => {
                        if (e.target.classList.contains('js-suggestion-item')) {
                          const selectedName = e.target.textContent;
                          if (app.state.modal.promptCallback) {
                            app.state.modal.promptCallback(selectedName);
                          }
                        }
                      });
                    }
                    
                    if(openCompareBtn) {
                        openCompareBtn.addEventListener('click', app.methods.handleOpenCompareModal);
                    }

                    if(compareModal) {
                        compareModal.querySelector('#compare-modal-close').addEventListener('click', () => app.ui.showCompareModal(false));
                        compareModal.querySelector('.modal-backdrop').addEventListener('click', () => app.ui.showCompareModal(false));
                        compareModal.querySelector('#compare-select-before').addEventListener('change', (e) => app.methods.updateCompareImage('before', e.target.value));
                        compareModal.querySelector('#compare-select-after').addEventListener('change', (e) => app.methods.updateCompareImage('after', e.target.value));
                    }

                    if(timerBar){
                      timerBar.querySelector('#timer-plus-15').addEventListener('click', () => app.methods.addTimerTime(APP_CONSTANTS.WORKOUT.REST_TIME_ADJUSTMENT));
                      timerBar.querySelector('#timer-minus-15').addEventListener('click', () => app.methods.addTimerTime(-APP_CONSTANTS.WORKOUT.REST_TIME_ADJUSTMENT));
                      timerBar.querySelector('#timer-reset').addEventListener('click', () => app.methods.resetTimer());
                    }

                    const imageModal = document.getElementById('image-modal');
                    if (imageModal) {
                        imageModal.querySelector('#image-modal-close').addEventListener('click', app.ui.closeImageModal);
                        imageModal.querySelector('#image-modal-backdrop').addEventListener('click', app.ui.closeImageModal);
                    }

                    // 使用事件委派來處理所有圖片預覽的點擊事件
                    document.body.addEventListener('click', (e) => {
                        // 檢查被點擊的元素是否為圖片，並且有 data-fullsize-url 屬性
                        if (e.target.tagName === 'IMG' && e.target.dataset.fullsizeUrl) {
                            app.ui.openImageModal(e.target.dataset.fullsizeUrl);
                        }
                    });

                    if(prsPage) {
                        prsPage.addEventListener('click', this.handlePRsPageClick.bind(this));
                    }

                    this._setupPhotoPreview('photo-front-upload', 'photo-front-preview');
                    this._setupPhotoPreview('photo-side-upload', 'photo-side-preview');
                    this._setupPhotoPreview('photo-back-upload', 'photo-back-preview');

                },
                
                handleDashboardInput(event) {
                    if (event.target.closest('#card-basic-info') || event.target.closest('#card-recommendations')) {
                        app.methods.calculateRecommendations();
                    }
                },

                handleDashboardClick(event) {
                    const target = event.target;
                    
                    if (target.id === 'edit-profile-btn' || target.closest('#edit-profile-btn')) {
                        app.methods.toggleProfileEditMode(true);
                    }
                    if (target.id === 'save-profile-btn' || target.closest('#save-profile-btn')) {
                        app.methods.handleSaveProfile();
                    }
                    if (target.id === 'cancel-profile-btn' || target.closest('#cancel-profile-btn')) {
                        app.methods.toggleProfileEditMode(false);
                    }
                },

                handleWorkoutPageClick(event) {
                    const target = event.target;
                    if(target.id === 'add-exercise-btn' || target.closest('#add-exercise-btn')) app.methods.handleAddExerciseClick();
                    if(target.id === 'save-workout-btn' || target.closest('#save-workout-btn')) app.methods.handleSaveWorkout();
                    if(target.id === 'load-template-btn' || target.closest('#load-template-btn')) app.ui.showLoadTemplateModal(true);
                    if(target.id === 'save-as-template-btn' || target.closest('#save-as-template-btn')) app.methods.handleSaveAsTemplateClick();
                    if(target.id === 'clear-workout-btn' || target.closest('#clear-workout-btn')) app.methods.handleClearWorkoutClick();
                    
                    const exerciseCard = target.closest('.card');
                    if (!exerciseCard) return;

                    const addSetButton = target.closest('.js-add-set');
                    const deleteSetButton = target.closest('.js-delete-set');
                    const deleteExerciseButton = target.closest('.js-delete-exercise');
                    const copySetButton = target.closest('.js-copy-set');
					          const startTimerButton = target.closest('.js-start-timer');

                    if (addSetButton) app.methods.addSet(exerciseCard);
                    if (deleteSetButton) app.methods.deleteSet(deleteSetButton.closest('.js-set-row'));
                    if (deleteExerciseButton) app.methods.deleteExercise(exerciseCard);
                    if (copySetButton) app.methods.copyLastSet(exerciseCard);
					          if (startTimerButton) app.methods.startTimer(APP_CONSTANTS.WORKOUT.DEFAULT_REST_TIME); //
                },

                handleWorkoutListInput(event) {
                    const target = event.target;
                    if (target.matches('.js-weight-input, .js-reps-input, .js-unit-select')) {
                        const exerciseCard = target.closest('.card');
                        if (exerciseCard) {
                            app.methods.calculateVolume(exerciseCard);
                            app.methods.updateDailyTotalVolume();
                        }
                    }
                },

                handleHistoryPageClick(event) {
                    const commentBtn = event.target.closest('.js-admin-comment-btn');
                    if (commentBtn) {
                        app.methods.handleAdminCommentClick(commentBtn);
                    }
                },

                handlePRsPageClick(event) {
                    const target = event.target;
                    if (target.id === 'edit-prs-btn') app.methods.togglePREditMode(true);
                    if (target.id === 'cancel-prs-btn') app.methods.togglePREditMode(false);
                    if (target.id === 'save-prs-btn') app.methods.handleSavePRCategories();
                }
};
