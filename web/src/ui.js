import { app } from './app.js';                 // call-time 引用，無循環問題
import { APP_CONSTANTS } from './constants.js';
import { renderDrivePhoto } from './photos.js';

export const ui = {
                renderPage() {
                    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
                    const newPage = document.getElementById('page-' + app.state.ui.currentView);
                    if(newPage) newPage.classList.add('active');
                },
                showLoading(isLoading) {
                    const overlay = document.getElementById('loading-overlay');
                    if (overlay) {
                        overlay.style.display = isLoading ? 'flex' : 'none';
                    }
                },
                showAdminBar(show) {
                    const bar = document.getElementById('admin-bar');
                    if(bar) bar.style.display = show ? 'block' : 'none';
                },
                showReminderBanner(show) {
                    const banner = document.getElementById('reminder-banner');
                    if(banner) banner.style.display = show ? 'block' : 'none';
                },
                showPromptModal(show, title = '', placeholder = '', callback = null) {
                    const modal = document.getElementById('prompt-modal');
                    if (show) {
                        document.getElementById('prompt-title').textContent = title;
                        const input = document.getElementById('prompt-input');
                        input.placeholder = placeholder;
                        input.value = '';
                        app.state.modal.promptCallback = callback; // 🆕
                        modal.classList.remove('hidden');
                        input.focus();
                    } else {
                        modal.classList.add('hidden');
                        app.state.modal.promptCallback = null; // 🆕
                    }
                },
                
                showAutocompleteModal(show, callback = null) {
                    const modal = document.getElementById('autocomplete-modal');
                    if (modal) {
                      if (show) {
                        const input = document.getElementById('autocomplete-input');
                        input.value = ''; // 清空輸入框
                        document.getElementById('suggestions-list').innerHTML = ''; // 清空建議
                        app.state.modal.promptCallback = callback;
                        modal.classList.remove('hidden');
                        input.focus();
                      } else {
                        modal.classList.add('hidden');
                        app.state.modal.promptCallback = null;
                      }
                    }
                },
				
                showLoadTemplateModal(show) {
                    const modal = document.getElementById('load-template-modal');
                    if(modal) modal.classList.toggle('hidden', !show);
                },

                populateTemplateList(templates) {
                    const container = document.getElementById('template-list');
                    if(!container) return;
                    container.innerHTML = '';
                    if (Object.keys(templates).length === 0) {
                        container.innerHTML = '<p class="text-gray-400 text-center">尚未建立任何範本。</p>';
                        return;
                    }
                    for (const templateName in templates) {
                        // 建立一個容器來包裹載入按鈕和刪除按鈕
                        const itemContainer = document.createElement('div');
                        itemContainer.className = "flex items-center justify-between gap-2 bg-gray-800 rounded-md";

                        // 原始的載入按鈕
                        const btn = document.createElement('button');
                        btn.className = "flex-grow text-left p-3 hover:bg-gray-700 rounded-l-md js-load-template";
                        btn.textContent = templateName;
                        btn.dataset.templateName = templateName;

                        // 新增的刪除按鈕
                        const deleteBtn = document.createElement('button');
                        deleteBtn.className = "p-3 text-gray-500 hover:text-red-500 js-delete-template";
                        deleteBtn.dataset.templateName = templateName;
                        // 使用 ionicons 的 "close-circle" 圖示
                        deleteBtn.innerHTML = '<ion-icon name="close-circle-outline" class="text-xl pointer-events-none"></ion-icon>';

                        itemContainer.appendChild(btn);
                        itemContainer.appendChild(deleteBtn);
                        container.appendChild(itemContainer);
                    }
                },

                clearWorkoutLog() {
                    const workoutList = document.getElementById('workout-list');
                    if(workoutList) {
                        workoutList.innerHTML = '';
                        app.methods.updateDailyTotalVolume();
                    }
                },
                showConfirmDeleteModal(show, message = '您確定要刪除嗎？') {
                    const modal = document.getElementById('confirm-delete-modal');
                    if (modal) {
                         if (show) {
                            modal.querySelector('#delete-confirm-message').textContent = message;
                            modal.classList.remove('hidden');
                        } else {
                            modal.classList.add('hidden');
                            app.state.modal.elementToDelete = null; // Clean up
                            app.state.modal.confirmCallback = null;
                        }
                    }
                },
                showHistoryState(state) {
                    const loading = document.getElementById('history-loading');
                    const content = document.getElementById('history-content');
                    const empty = document.getElementById('history-empty');
                    if(loading) loading.style.display = state === 'loading' ? 'block' : 'none';
                    if(content) content.style.display = state === 'content' ? 'block' : 'none';
                    if(empty) empty.style.display = state === 'empty' ? 'block' : 'none';
                },
                populateUserSwitcher(users) {
                    const switcher = document.getElementById('user-switcher');
                    if(!switcher) return;
                    switcher.innerHTML = ''; // 清空
                    users.forEach(user => {
                        const option = document.createElement('option');
                        option.value = user.email;
                        option.textContent = user.name;
                        switcher.appendChild(option);
                    });
                },
                updateWelcomeMessage(name) {
                    const welcomeEl = document.getElementById('welcome-message');
                    if(welcomeEl) {
                        const welcomeText = (name) ? name : '';
                        welcomeEl.textContent = '歡迎回來\t' + welcomeText;
                    }
                },
                setActiveNav(page) {
                    document.querySelectorAll('.nav-item').forEach(item => {
                        item.classList.remove('text-yellow-400');
                        item.classList.add('text-gray-400', 'hover:bg-gray-700/50');
                    });
                    const activeItem = document.querySelector(`.nav-item[onclick="app.navigateTo('${page}')"]`);
                    if(activeItem) {
                        activeItem.classList.add('text-yellow-400');
                        activeItem.classList.remove('text-gray-400', 'hover:bg-gray-700/50');
                    }
                },
                
                populateProfileData(profileData) {
                    if (!profileData) return;
                    document.querySelectorAll('#profile-section .card').forEach(card => {
                        card.querySelectorAll('.edit-mode, .profile-input').forEach(editEl => {
                            const key = editEl.dataset.key;
                            if (!key) return;

                            const value = profileData[key];

                            let viewEl = null;
                            const parentGrid = editEl.closest('.grid');
                            const placeholder = editEl.placeholder;

                            if (placeholder && parentGrid) {
                                viewEl = [...parentGrid.querySelectorAll('.view-mode')].find(v => v.dataset.placeholder && v.dataset.placeholder.startsWith(placeholder));
                            } else {
                                viewEl = editEl.previousElementSibling;
                            }

                            if (viewEl && viewEl.classList.contains('view-mode')) {
                                const hasValue = value !== undefined && value !== null && String(value).trim() !== '';

                                if (editEl.tagName === 'SELECT') {
                                    const matchingOption = hasValue ? [...editEl.options].find(opt => opt.value == value) : null;
                                    viewEl.textContent = matchingOption ? matchingOption.text : viewEl.dataset.placeholder;
                                } else {
                                    if (placeholder && parentGrid) {
                                        viewEl.textContent = hasValue ? (placeholder + ': ' + value) : viewEl.dataset.placeholder;
                                    } else {
                                        viewEl.textContent = hasValue ? value : viewEl.dataset.placeholder;
                                    }
                                }
                            }
                        });
                    });
                },

                populateLatestPhotos(photoData) {
                    const dateEl = document.getElementById('prev-photo-date');
                    const containers = {
                        front: document.getElementById('prev-photo-front-container'),
                        side: document.getElementById('prev-photo-side-container'),
                        back: document.getElementById('prev-photo-back-container')
                    };

                    if(!dateEl || !containers.front || !containers.side || !containers.back) return;
                    
                    if (!photoData || (!photoData.photo_front_id && !photoData.photo_side_id && !photoData.photo_back_id)) {
                        dateEl.textContent = 'N/A';
                        Object.values(containers).forEach(c => c.innerHTML = '<span class="text-gray-500">尚無記錄</span>');
                        return;
                    }

                    dateEl.textContent = new Date(photoData.date).toLocaleDateString();

                    for (const type in containers) {
                        const container = containers[type];
                        const photoId = photoData[`photo_${type}_id`];

                        if (photoId) {
                            renderDrivePhoto(container, photoId, `前一次${type}照片`);
                        } else {
                            container.innerHTML = '<span class="text-gray-500">無照片</span>';
                        }
                    }
                },

                removeWithAnimation(element, callback) {
                    if (!element) return;
                    element.classList.remove('is-visible');
                    setTimeout(() => {
                        element.remove();
                        if (callback) {
                            callback();
                        }
                    }, APP_CONSTANTS.UI.ANIMATION_DURATION); // 🆕 使用常數
                },

                showToast(message, type = 'success', duration = APP_CONSTANTS.UI.TOAST_DURATION) {
                    const toast = document.getElementById('toast-notification');
                    const messageEl = document.getElementById('toast-message');
                    if (!toast || !messageEl) return;

                    // 🆕 清除上一個計時器
                    if (app.state.timer.toastTimer) {
                        clearTimeout(app.state.timer.toastTimer);
                    }

                    messageEl.innerHTML = message;
                    toast.classList.remove('bg-yellow-500', 'bg-red-600');
                    if (type === 'success') {
                        toast.classList.add('bg-yellow-500');
                    } else if (type === 'error') {
                        toast.classList.add('bg-red-600');
                    }

                    toast.classList.remove('hidden', 'toast-out');
                    toast.classList.add('toast-in');

                    // 🆕 設定新的計時器
                    app.state.timer.toastTimer = setTimeout(() => {
                        toast.classList.remove('toast-in');
                        toast.classList.add('toast-out');
                        setTimeout(() => {
                            toast.classList.add('hidden');
                        }, 500);
                    }, duration);
                },

                showCompareModal(show) {
                    const modal = document.getElementById('compare-photos-modal');
                    if(modal) modal.classList.toggle('hidden', !show);
                },

                showPRsState(state) { // state can be 'loading', 'content', or 'empty'
                    const loading = document.getElementById('prs-loading');
                    const content = document.getElementById('prs-content');
                    const empty = document.getElementById('prs-empty');
                    if(loading) loading.style.display = state === 'loading' ? 'block' : 'none';
                    if(content) content.style.display = state === 'content' ? 'block' : 'none';
                    if(empty) empty.style.display = state === 'empty' ? 'block' : 'none';
                },

                openImageModal(imageUrl) {
                    const modal = document.getElementById('image-modal');
                    const img = document.getElementById('modal-image');
                    if (modal && img) {
                        img.src = imageUrl;
                        modal.classList.remove('hidden');
                    }
                },

                closeImageModal() {
                    const modal = document.getElementById('image-modal');
                    const img = document.getElementById('modal-image');
                    if (modal && img) {
                        modal.classList.add('hidden');
                        img.src = ''; // 清空 src 避免佔用記憶體
                    }
                }
};
