from pathlib import Path
import re


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one match, got {count}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


def sub_once(path, pattern, replacement):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    new_text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one regex match, got {count}')
    p.write_text(new_text, encoding='utf-8')


# --- Config: vfi is canonical; vfl remains a legacy alias. ---
replace_once(
    'src/Config.gs',
    """    BMI: 'bmi',\n    VFL: 'vfl',""",
    """    BMI: 'bmi',\n    VFI: 'vfi',\n    VFL: 'vfl', // legacy alias; canonical field is vfi""",
)

# --- Profile schema: additive vfi column, keep vfl. ---
replace_once(
    'src/Internal.gs',
    """    'smm', 'bfm', 'bmi', 'vfl', 'training_direction'""",
    """    'smm', 'bfm', 'bmi', 'vfl', 'vfi', 'training_direction'""",
)
replace_once(
    'src/Internal.gs',
    """        CONSTANTS.HEADERS.BMI,\n        CONSTANTS.HEADERS.VFL,\n        'training_direction'""",
    """        CONSTANTS.HEADERS.BMI,\n        CONSTANTS.HEADERS.VFL,\n        CONSTANTS.HEADERS.VFI,\n        'training_direction'""",
)
replace_once(
    'src/Internal.gs',
    """  return profile;\n}\n\nfunction _getLatestPhotos""",
    """  // vfi is canonical. Keep the legacy vfl alias readable during migration.\n  const hasVfi = profile.vfi !== undefined && profile.vfi !== null && profile.vfi !== '';\n  const hasVfl = profile.vfl !== undefined && profile.vfl !== null && profile.vfl !== '';\n  if (!hasVfi && hasVfl) profile.vfi = profile.vfl;\n  if (!hasVfl && hasVfi) profile.vfl = profile.vfi;\n  return profile;\n}\n\nfunction _getLatestPhotos""",
)

# --- Analysis: read InBody by header names instead of fixed six columns. ---
replace_once(
    'src/API.gs',
    """    const inbodySheet = userSheet.getSheetByName(CONSTANTS.SHEETS.INBODY_LOG);\n    if (inbodySheet && inbodySheet.getLastRow() > 1) {\n      const ibWeight = [], ibBodyfat = [];\n      const ibRows = inbodySheet.getRange(2, 1, inbodySheet.getLastRow() - 1, 6).getValues();\n      ibRows.forEach(function (row) {\n        const d = row[1];\n        if (!(d instanceof Date)) return;\n        const iso = d.toISOString();\n        if (row[2] !== '') ibWeight.push({ x: iso, y: parseFloat(row[2]) });\n        if (row[3] !== '') ibBodyfat.push({ x: iso, y: parseFloat(row[3]) });\n        if (row[4] !== '') smmHistory.push({ x: iso, y: parseFloat(row[4]) });\n      });\n      weightHistory = mergeBodyHistory(weightHistory, ibWeight);\n      bodyfatHistory = mergeBodyHistory(bodyfatHistory, ibBodyfat);\n      smmHistory = mergeBodyHistory([], smmHistory); // 排序 + 同日去重（後者為準）\n    }""",
    """    const inbodySheet = userSheet.getSheetByName(CONSTANTS.SHEETS.INBODY_LOG);\n    if (inbodySheet && inbodySheet.getLastRow() > 1) {\n      _ensureInBodyV3Headers(inbodySheet);\n      const ibWeight = [], ibBodyfat = [];\n      const ibHeaders = inbodySheet.getRange(1, 1, 1, inbodySheet.getLastColumn()).getValues()[0]\n        .map(function (value) { return String(value || '').trim(); });\n      const ibIndex = {};\n      ibHeaders.forEach(function (header, index) { if (header) ibIndex[header] = index; });\n      const ibRows = inbodySheet.getRange(2, 1, inbodySheet.getLastRow() - 1, inbodySheet.getLastColumn()).getValues();\n      ibRows.forEach(function (row) {\n        const d = row[ibIndex.date];\n        if (!(d instanceof Date)) return;\n        const iso = d.toISOString();\n        if (row[ibIndex.weight] !== '') ibWeight.push({ x: iso, y: parseFloat(row[ibIndex.weight]) });\n        if (row[ibIndex.bodyfat] !== '') ibBodyfat.push({ x: iso, y: parseFloat(row[ibIndex.bodyfat]) });\n        if (row[ibIndex.smm] !== '') smmHistory.push({ x: iso, y: parseFloat(row[ibIndex.smm]) });\n      });\n      weightHistory = mergeBodyHistory(weightHistory, ibWeight);\n      bodyfatHistory = mergeBodyHistory(bodyfatHistory, ibBodyfat);\n      smmHistory = mergeBodyHistory([], smmHistory); // 排序 + 同日去重（後者為準）\n    }""",
)

# --- Profile direct edits: canonicalize vfi/vfl aliases. ---
replace_once(
    'src/API.gs',
    """    const latestData = _getLatestProfileData(userSheet);\n\n    const mergedData = { ...latestData, ...data };""",
    """    const latestData = _getLatestProfileData(userSheet);\n    const normalizedData = { ...data };\n    if (Object.prototype.hasOwnProperty.call(normalizedData, 'vfi')) normalizedData.vfl = normalizedData.vfi;\n    else if (Object.prototype.hasOwnProperty.call(normalizedData, 'vfl')) normalizedData.vfi = normalizedData.vfl;\n\n    const mergedData = { ...latestData, ...normalizedData };""",
)
replace_once(
    'src/API.gs',
    """              'inbody_score', 'smm', 'bfm', 'bmi', 'vfl'""",
    """              'inbody_score', 'smm', 'bfm', 'bmi', 'vfi', 'vfl'""",
)

# --- Replace the isolated InBody R1 service with header-driven V3. ---
inbody_v3 = r'''// =======================================================
// InBody 量測記錄 (V3)
// =======================================================

// New sheets use the canonical order. Existing R1 sheets are migrated additively:
// their original columns remain in place and missing V3 headers are appended.
const INBODY_HEADERS = [
  'id', 'date', 'weight', 'bodyfat', 'smm',
  'bfm', 'bmi', 'vfi', 'inbody_score', 'photo_id', 'note'
];
const INBODY_RANGES = {
  weight: [20, 300],
  bodyfat: [1, 70],
  smm: [10, 100],
  bfm: [0, 200],
  bmi: [5, 80],
  vfi: [0, 50],
  inbody_score: [0, 200]
};
const INBODY_FIELD_NAMES = {
  weight: '體重',
  bodyfat: '體脂率',
  smm: '骨骼肌重',
  bfm: '體脂肪重',
  bmi: 'BMI',
  vfi: '內臟脂肪等級',
  inbody_score: 'InBody 分數'
};
const INBODY_NUMERIC_FIELDS = ['weight', 'bodyfat', 'smm', 'bfm', 'bmi', 'vfi', 'inbody_score'];

function _ensureInBodyV3Headers(sheet) {
  if (!sheet) throw new Error('InBodyLog 工作表不存在。');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(INBODY_HEADERS);
    sheet.getRange(1, 1, 1, INBODY_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
  }
  const width = Math.max(1, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, width).getValues()[0]
    .map(function (value) { return String(value || '').trim(); });
  const missing = INBODY_HEADERS.filter(function (header) { return headers.indexOf(header) < 0; });
  if (missing.length > 0) {
    sheet.getRange(1, width + 1, 1, missing.length).setValues([missing]);
    sheet.getRange(1, 1, 1, width + missing.length).setFontWeight('bold');
  }
  if (sheet.getFrozenRows() < 1) sheet.setFrozenRows(1);
  return sheet;
}

function _getInBodyHeaderIndex(sheet) {
  _ensureInBodyV3Headers(sheet);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function (value) { return String(value || '').trim(); });
  const index = {};
  headers.forEach(function (header, i) { if (header) index[header] = i; });
  return { headers: headers, index: index };
}

function _getInBodySheet(userSheet) {
  return _ensureInBodyV3Headers(_getOrCreateSheet(userSheet, CONSTANTS.SHEETS.INBODY_LOG));
}

function _parseInBodyNumber(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const num = parseFloat(value);
  const range = INBODY_RANGES[field];
  if (!range || !Number.isFinite(num) || num < range[0] || num > range[1]) {
    throw new Error(INBODY_FIELD_NAMES[field] + ' 數值不合理（允許範圍 ' + range[0] + '–' + range[1] + '）。');
  }
  return num;
}

function _appendInBodyV3Row(sheet, valuesByHeader) {
  const schema = _getInBodyHeaderIndex(sheet);
  const row = schema.headers.map(function (header) {
    return Object.prototype.hasOwnProperty.call(valuesByHeader, header) ? valuesByHeader[header] : '';
  });
  sheet.appendRow(row);
}

/**
 * (API) 新增一筆 InBody 量測：InBodyLog 是歷史 source of truth；
 * Profile 只同步最新快照。僅限本人。
 */
function saveInBodyRecord(authedEmail, record) {
  if (!record || typeof record !== 'object' || !record.date || typeof record.date !== 'string') {
    throw new Error('無效的量測資料格式或缺少日期。');
  }

  const metrics = {};
  INBODY_NUMERIC_FIELDS.forEach(function (field) {
    metrics[field] = _parseInBodyNumber(record[field], field);
  });
  const hasMetric = INBODY_NUMERIC_FIELDS.some(function (field) { return metrics[field] !== null; });
  if (!hasMetric) throw new Error('InBody 數值至少須填一項。');
  const note = String(record.note || '').trim();

  const userSheet = _getUserSheet(authedEmail, true);
  if (!userSheet) throw new Error('找不到您的資料檔案。');
  const sheet = _getInBodySheet(userSheet);

  const dateParts = record.date.split('-');
  if (dateParts.length !== 3) throw new Error('量測日期格式不正確。');
  const recordDate = new Date();
  recordDate.setFullYear(parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[2], 10));

  let photoId = '';
  if (record.photo) {
    const photosFolder = DriveApp.getFolderById(CONFIG.PHOTOS_FOLDER_ID);
    const folders = photosFolder.getFoldersByName(authedEmail);
    const userPhotoFolder = folders.hasNext() ? folders.next() : photosFolder.createFolder(authedEmail);
    const dateString = Utilities.formatDate(recordDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const fileData = record.photo;
    const mimeType = fileData.substring(5, fileData.indexOf(';'));
    const bytes = Utilities.base64Decode(fileData.substring(fileData.indexOf('base64,') + 7));
    const blob = Utilities.newBlob(bytes, mimeType, 'inbody_' + dateString + '_' + recordDate.getTime() + '.jpg');
    photoId = userPhotoFolder.createFile(blob).getId();
  }

  const id = 'ib_' + recordDate.getTime();
  const valuesByHeader = {
    id: id,
    date: recordDate,
    photo_id: photoId,
    note: note
  };
  INBODY_NUMERIC_FIELDS.forEach(function (field) {
    valuesByHeader[field] = metrics[field] === null ? '' : metrics[field];
  });
  _appendInBodyV3Row(sheet, valuesByHeader);

  // Profile snapshot: update every metric supplied by this measurement.
  // vfi is canonical, while vfl is mirrored only for legacy compatibility.
  const profileUpdateData = {};
  INBODY_NUMERIC_FIELDS.forEach(function (field) {
    if (metrics[field] !== null) profileUpdateData[field] = metrics[field];
  });
  if (metrics.vfi !== null) profileUpdateData.vfl = metrics.vfi;

  const profileSheet = _getOrCreateSheet(userSheet, CONSTANTS.SHEETS.PROFILE);
  _ensureProfileHeaders(profileSheet);
  const latestData = _getLatestProfileData(userSheet);
  const mergedData = { ...latestData, ...profileUpdateData, '更新日期': recordDate };
  const headers = profileSheet.getRange(1, 1, 1, profileSheet.getLastColumn()).getValues()[0];
  profileSheet.appendRow(headers.map(function (h) { return mergedData[h] !== undefined ? mergedData[h] : ''; }));
  profileSheet.sort(1, false);

  const updatedProfileData = _getLatestProfileData(userSheet);
  if (updatedProfileData && updatedProfileData['更新日期'] instanceof Date) {
    updatedProfileData['更新日期'] = updatedProfileData['更新日期'].toISOString();
  }

  CacheService.getUserCache().remove('analysis_data_' + authedEmail);
  return { status: 'success', message: 'InBody 量測已儲存！', newRecordId: id, updatedProfileData: updatedProfileData };
}

/** (API) 取得 InBody 量測歷史（新→舊）。 */
function getInBodyRecords(authedEmail, requestedEmail) {
  const target = _resolveTarget(authedEmail, requestedEmail);
  const userSheet = _getUserSheet(target.targetEmail, false);
  if (!userSheet) return [];
  const sheet = userSheet.getSheetByName(CONSTANTS.SHEETS.INBODY_LOG);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const schema = _getInBodyHeaderIndex(sheet);
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  const records = rows.map(function (row) {
    const value = function (header) {
      const idx = schema.index[header];
      return idx === undefined ? '' : row[idx];
    };
    const numeric = function (header) {
      const raw = value(header);
      return raw === '' || raw === null || raw === undefined ? null : parseFloat(raw);
    };
    const dateValue = value('date');
    return {
      id: String(value('id') || ''),
      date: dateValue instanceof Date ? dateValue.toISOString() : String(dateValue || ''),
      weight: numeric('weight'),
      bodyfat: numeric('bodyfat'),
      smm: numeric('smm'),
      bfm: numeric('bfm'),
      bmi: numeric('bmi'),
      vfi: numeric('vfi'),
      inbody_score: numeric('inbody_score'),
      photoId: value('photo_id') || null,
      note: String(value('note') || '')
    };
  }).filter(function (record) { return record.id && record.date; });
  records.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
  return records;
}

/** (API) 刪除一筆 InBody 量測（含關聯照片移至垃圾桶）。僅限本人。 */
function deleteInBodyRecord(authedEmail, recordId) {
  if (!recordId || typeof recordId !== 'string') throw new Error('缺少記錄 ID。');
  const userSheet = _getUserSheet(authedEmail, false);
  if (!userSheet) throw new Error('找不到您的資料檔案。');
  const sheet = userSheet.getSheetByName(CONSTANTS.SHEETS.INBODY_LOG);
  if (sheet && sheet.getLastRow() >= 2) {
    const schema = _getInBodyHeaderIndex(sheet);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][schema.index.id] || '') === recordId) {
        const photoIdx = schema.index.photo_id;
        const photoId = photoIdx === undefined ? '' : data[i][photoIdx];
        if (photoId) {
          try { DriveApp.getFileById(photoId).setTrashed(true); }
          catch (e) { Logger.log('刪除 InBody 照片失敗: ' + e.message); }
        }
        sheet.deleteRow(i + 2);
        CacheService.getUserCache().remove('analysis_data_' + authedEmail);
        return { status: 'success', message: '記錄已刪除。' };
      }
    }
  }
  throw new Error('找不到該筆記錄。');
}

'''
sub_once(
    'src/API.gs',
    r"// =======================================================\n// InBody 量測記錄 \(R1\)\n// =======================================================\n.*?(?=// =======================================================\n// 動作分類與 Tag \(R3a\)\n// =======================================================)",
    inbody_v3,
)

# --- Frontend Profile: vfi is canonical. ---
replace_once('web/index.html', 'data-key="vfl"', 'data-key="vfi"')

# --- Frontend InBody modal: expose the V3 metrics and note. ---
old_modal_fields = '''            <div class="grid grid-cols-3 gap-2">\n                <div><label class="text-sm text-gray-400" for="inbody-weight">體重 (kg)</label><input type="number" step="0.1" min="0" id="inbody-weight" class="w-full rounded-md p-2 mt-1"></div>\n                <div><label class="text-sm text-gray-400" for="inbody-bodyfat">體脂率 (%)</label><input type="number" step="0.1" min="0" id="inbody-bodyfat" class="w-full rounded-md p-2 mt-1"></div>\n                <div><label class="text-sm text-gray-400" for="inbody-smm">骨骼肌 (kg)</label><input type="number" step="0.1" min="0" id="inbody-smm" class="w-full rounded-md p-2 mt-1"></div>\n            </div>'''
new_modal_fields = '''            <div class="grid grid-cols-2 gap-2">\n                <div><label class="text-sm text-gray-400" for="inbody-weight">體重 (kg)</label><input type="number" step="0.1" min="0" id="inbody-weight" class="w-full rounded-md p-2 mt-1"></div>\n                <div><label class="text-sm text-gray-400" for="inbody-bodyfat">體脂率 (%)</label><input type="number" step="0.1" min="0" id="inbody-bodyfat" class="w-full rounded-md p-2 mt-1"></div>\n                <div><label class="text-sm text-gray-400" for="inbody-smm">骨骼肌 (kg)</label><input type="number" step="0.1" min="0" id="inbody-smm" class="w-full rounded-md p-2 mt-1"></div>\n                <div><label class="text-sm text-gray-400" for="inbody-bfm">體脂肪重 (kg)</label><input type="number" step="0.1" min="0" id="inbody-bfm" class="w-full rounded-md p-2 mt-1"></div>\n                <div><label class="text-sm text-gray-400" for="inbody-bmi">BMI</label><input type="number" step="0.1" min="0" id="inbody-bmi" class="w-full rounded-md p-2 mt-1"></div>\n                <div><label class="text-sm text-gray-400" for="inbody-vfi">內臟脂肪等級</label><input type="number" step="0.1" min="0" id="inbody-vfi" class="w-full rounded-md p-2 mt-1"></div>\n                <div><label class="text-sm text-gray-400" for="inbody-score">InBody 分數</label><input type="number" step="0.1" min="0" id="inbody-score" class="w-full rounded-md p-2 mt-1"></div>\n            </div>\n            <div>\n                <label class="text-sm text-gray-400" for="inbody-note">備註（選填）</label>\n                <textarea id="inbody-note" rows="2" class="w-full rounded-md p-2 mt-1" placeholder="量測狀態、飲食、訓練週期等"></textarea>\n            </div>'''
replace_once('web/index.html', old_modal_fields, new_modal_fields)

# --- Frontend InBody behavior and list rendering. ---
inbody_methods = r'''                // === InBody 量測記錄 (V3) ===
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
                    const escapeHtml = (value) => String(value ?? '')
                        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
                    list.innerHTML = records.map(r => {
                        const dateStr = String(r.date).slice(0, 10);
                        const primary = [
                            r.weight != null ? `體重 ${r.weight} kg` : null,
                            r.bodyfat != null ? `體脂 ${r.bodyfat}%` : null,
                            r.smm != null ? `骨骼肌 ${r.smm} kg` : null,
                        ].filter(Boolean).join('｜');
                        const secondary = [
                            r.bfm != null ? `體脂肪重 ${r.bfm} kg` : null,
                            r.bmi != null ? `BMI ${r.bmi}` : null,
                            r.vfi != null ? `內臟脂肪 ${r.vfi}` : null,
                            r.inbody_score != null ? `InBody ${r.inbody_score}` : null,
                        ].filter(Boolean).join('｜');
                        const note = r.note ? `<div class="text-xs text-gray-400 mt-1 whitespace-pre-wrap">${escapeHtml(r.note)}</div>` : '';
                        return `
                        <div class="border border-gray-700 rounded-md p-2">
                            <div class="flex justify-between items-start gap-2">
                                <div class="min-w-0">
                                    <div class="text-sm"><span class="text-yellow-400">${dateStr}</span>${primary ? `　${primary}` : ''}</div>
                                    ${secondary ? `<div class="text-xs text-gray-400 mt-1">${secondary}</div>` : ''}
                                    ${note}
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
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
                    [
                        'inbody-weight', 'inbody-bodyfat', 'inbody-smm', 'inbody-bfm',
                        'inbody-bmi', 'inbody-vfi', 'inbody-score', 'inbody-note', 'inbody-photo'
                    ].forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.value = '';
                    });
                    document.getElementById('inbody-modal')?.classList.remove('hidden');
                },

                closeInBodyModal() {
                    document.getElementById('inbody-modal')?.classList.add('hidden');
                },

                async saveInBodyRecordFromModal() {
                    const value = (id) => document.getElementById(id)?.value || '';
                    const date = value('inbody-date');
                    const record = {
                        date,
                        weight: value('inbody-weight'),
                        bodyfat: value('inbody-bodyfat'),
                        smm: value('inbody-smm'),
                        bfm: value('inbody-bfm'),
                        bmi: value('inbody-bmi'),
                        vfi: value('inbody-vfi'),
                        inbody_score: value('inbody-score'),
                        note: value('inbody-note')
                    };
                    const photoFile = document.getElementById('inbody-photo')?.files[0];
                    if (!date) { app.ui.showToast('請選擇量測日期', 'error'); return; }
                    const hasMetric = ['weight', 'bodyfat', 'smm', 'bfm', 'bmi', 'vfi', 'inbody_score'].some(key => record[key] !== '');
                    if (!hasMetric) { app.ui.showToast('InBody 數值至少填一項', 'error'); return; }
                    try {
                        app.ui.showLoading(true);
                        if (photoFile) record.photo = await this._compressAndReadFileAsBase64(photoFile);
                        const res = await app.api.saveInBodyRecord(record);
                        if (res.updatedProfileData) {
                            app.state.user.profileData = res.updatedProfileData;
                            app.ui.populateProfileData(res.updatedProfileData);
                            app.methods.calculateRecommendations();
                        }
                        this.closeInBodyModal();
                        app.cache.clear(app.cache.keys.ANALYSIS_DATA);
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
                        app.cache.clear(app.cache.keys.ANALYSIS_DATA);
                        app.ui.showToast('記錄已刪除', 'success');
                        await this.loadInBodyRecords();
                    } catch (error) {
                        this.handleError(error, '刪除失敗');
                    } finally {
                        app.ui.showLoading(false);
                    }
                },

'''
sub_once(
    'web/src/methods.js',
    r"                // === InBody 量測記錄 \(R1\) ===\n.*?(?=                calculateRecommendations\(\) \{)",
    inbody_methods,
)

# Static guards for the intended contract.
api = Path('src/API.gs').read_text(encoding='utf-8')
internal = Path('src/Internal.gs').read_text(encoding='utf-8')
html = Path('web/index.html').read_text(encoding='utf-8')
methods = Path('web/src/methods.js').read_text(encoding='utf-8')
if "'bfm', 'bmi', 'vfi', 'inbody_score'" not in api:
    raise SystemExit('InBody V3 headers/fields missing')
if "CONSTANTS.HEADERS.VFI" not in internal:
    raise SystemExit('Profile VFI header migration missing')
if 'data-key="vfi"' not in html or 'id="inbody-vfi"' not in html or 'id="inbody-note"' not in html:
    raise SystemExit('InBody V3 frontend fields missing')
if "inbody_score: value('inbody-score')" not in methods:
    raise SystemExit('InBody V3 frontend payload missing')
if 'MutationObserver' in '\n'.join([api, internal, html, methods]):
    # Existing project may contain observers elsewhere, but none of these changed InBody files should require one.
    pass
