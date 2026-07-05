// Drive 照片改經後端 getPhoto 取回 base64（Drive 檔案維持私有）
import { backendApi } from './api.js';
import { app } from './app.js';

const photoCache = new Map();

async function getPhotoDataUrl(photoId) {
  if (!photoId) return null;
  if (photoCache.has(photoId)) return photoCache.get(photoId);
  const result = await backendApi.getPhoto(photoId, app.state.user.currentUser);
  photoCache.set(photoId, result.dataUrl);
  return result.dataUrl;
}

export function renderDrivePhoto(container, photoId, altText) {
  container.innerHTML = '<span class="text-gray-500 text-sm animate-pulse">載入中...</span>';
  getPhotoDataUrl(photoId)
    .then((dataUrl) => {
      container.innerHTML = `<img src="${dataUrl}" data-fullsize-url="${dataUrl}" class="w-full h-full object-cover rounded cursor-pointer" alt="${altText}">`;
    })
    .catch(() => {
      container.innerHTML = '<span class="text-red-400 text-xs">照片載入失敗</span>';
    });
}
