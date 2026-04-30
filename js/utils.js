/**
 * FinanceSync Pro v3.5 - Utility Functions
 * Formatting, toast, file handling, dan helper umum
 */

// ==================== NUMBER FORMATTING ====================
function formatNumber(num) {
  if (!num && num !== 0) return '0';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// ==================== CURRENCY FORMATTING ====================
function formatCurrency(amount) {
  if (!amount && amount !== 0) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}

// ==================== DATE FORMATTING ====================
function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    var date = new Date(dateStr);
    var months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
  } catch (e) { return dateStr; }
}

function formatDateForInput(date) {
  if (!date) return '';
  try {
    var d = new Date(date);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  } catch (e) { return ''; }
}

function formatDateToDDMMYYYY(dateStr) {
  if (!dateStr) return '';
  try {
    var parts = dateStr.split('-');
    if (parts.length === 3) return parts[2] + '/' + parts[1] + '/' + parts[0];
    return dateStr;
  } catch (e) { return dateStr; }
}

function formatDateShort(dateStr) {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (e) { return dateStr; }
}

function timeAgo(timestamp) {
  if (!timestamp) return '-';
  try {
    var date;
    if (timestamp && typeof timestamp.toDate === 'function') date = timestamp.toDate();
    else if (typeof timestamp === 'string') date = new Date(timestamp);
    else if (timestamp instanceof Date) date = timestamp;
    else return '-';

    var diffMs = Date.now() - date;
    var diffMin = Math.floor(diffMs / 60000);
    var diffHour = Math.floor(diffMin / 60);
    var diffDay = Math.floor(diffHour / 24);

    if (diffMin < 1) return 'Baru saja';
    if (diffMin < 60) return diffMin + ' menit lalu';
    if (diffHour < 24) return diffHour + ' jam lalu';
    if (diffDay < 7) return diffDay + ' hari lalu';
    return formatDate(date);
  } catch (e) { return '-'; }
}

// ==================== HTML ESCAPE ====================
function escapeHtml(text) {
  if (!text) return '';
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==================== TOAST NOTIFICATIONS ====================
function showToast(message, type, duration) {
  type = type || 'info';
  duration = duration || 4000;

  if (toastTimeout) clearTimeout(toastTimeout);

  // Support pola toast container (multiple toasts) jika ada
  var container = document.getElementById('toastBox');
  if (container) {
    var icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️', firebase: '🔥', drive: '📁' };
    var el = document.createElement('div');
    el.className = 'toast-item ' + type;
    el.innerHTML = '<span>' + (icons[type] || 'ℹ️') + '</span><span>' + escapeHtml(message) + '</span>';
    container.appendChild(el);
    requestAnimationFrame(function() { el.classList.add('show'); });
    setTimeout(function() {
      el.classList.remove('show');
      setTimeout(function() { el.remove(); }, 400);
    }, duration);
    return;
  }

  // Fallback: single toast element (pola lama)
  var toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast show ' + type;
  toastTimeout = setTimeout(function() { toast.classList.remove('show'); }, duration);
}

function showToastUploadSuccess(fileName, driveUrl) {
  var msg = 'File berhasil disimpan: ' + fileName;
  if (driveUrl) msg += ' — Buka di Drive';
  showToast(msg, 'drive', 5000);
}

function showToastUploadError(error) {
  showToast('Gagal upload: ' + error, 'error', 5000);
}

// ==================== ROMAN NUMERAL ====================
function toRoman(num) {
  var vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
  var syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
  var result = '';
  for (var i = 0; i < vals.length; i++) {
    while (num >= vals[i]) { result += syms[i]; num -= vals[i]; }
  }
  return result;
}

// ==================== STATISTICS ====================
function updateStats() {
  if (!state.history) return;

  var total = state.history.length;
  var withFiles = 0;
  var lunas = 0;
  var belum = 0;

  state.history.forEach(function(item) {
    if (item.status === 'Lunas') lunas++;
    else if (item.status === 'Belum Lunas') belum++;
    var files = item.files || item.google_drive_links || [];
    if (files.length > 0) withFiles++;
  });

  // Coba dari elements cache dulu, fallback ke getElementById
  var set = function(cacheKey, domId, value) {
    if (elements[cacheKey]) elements[cacheKey].textContent = value;
    var el = document.getElementById(domId);
    if (el) el.textContent = value;
  };

  set('totalData', 'totalData', total);
  set('sentData', 'sentData', total);
  set('sheetsData', 'sheetsData', withFiles);
  set('pendingData', 'pendingData', belum);
}

// ==================== FILE SIZE ====================
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  var k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
  var i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function checkFileSize(fileSize, maxSize) {
  maxSize = maxSize || (typeof UPLOAD_CONFIG !== 'undefined' ? UPLOAD_CONFIG.maxSizeBytes : 30 * 1024 * 1024);
  return { valid: fileSize <= maxSize, size: formatFileSize(fileSize), maxSize: formatFileSize(maxSize) };
}

// ==================== BASE64 ====================
function fileToBase64(file) {
  return new Promise(function(resolve, reject) {
    if (!file) { reject(new Error('Tidak ada file')); return; }
    var reader = new FileReader();
    reader.onload = function() { resolve(reader.result.split(',')[1]); };
    reader.onerror = function(e) { reject(new Error('Gagal membaca file: ' + e)); };
    reader.readAsDataURL(file);
  });
}

function filesToBase64Array(files) {
  return new Promise(async function(resolve) {
    if (!files || !files.length) { resolve({ results: [], errors: [] }); return; }
    var results = [], errors = [];
    for (var i = 0; i < files.length; i++) {
      try {
        results.push({ name: files[i].name, base64: await fileToBase64(files[i]), size: files[i].size, type: files[i].type });
      } catch (e) { errors.push({ name: files[i].name, error: e.message }); }
    }
    resolve({ results: results, errors: errors });
  });
}

// ==================== MIME TYPE ====================
function getMimeTypeFromFilename(filename) {
  if (!filename) return 'application/octet-stream';
  var ext = filename.toLowerCase().split('.').pop();
  var map = {
    pdf:'application/pdf', doc:'application/msword', docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls:'application/vnd.ms-excel', xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt:'application/vnd.ms-powerpoint', pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', gif:'image/gif', webp:'image/webp', bmp:'image/bmp',
    zip:'application/zip', txt:'text/plain', csv:'text/csv'
  };
  return map[ext] || 'application/octet-stream';
}

// ==================== FILE TYPE INFO ====================
function getFileTypeInfo(filename) {
  if (!filename) return { icon: '📎', category: 'default', color: '#9ca3af' };
  var ext = filename.toLowerCase().split('.').pop();
  var types = {
    pdf: { icon: '📕', category: 'pdf', color: '#ef4444' },
    doc: { icon: '📝', category: 'doc', color: '#2563eb' }, docx: { icon: '📝', category: 'doc', color: '#2563eb' },
    xls: { icon: '📊', category: 'doc', color: '#16a34a' }, xlsx: { icon: '📊', category: 'doc', color: '#16a34a' },
    ppt: { icon: '📽️', category: 'doc', color: '#ea580c' }, pptx: { icon: '📽️', category: 'doc', color: '#ea580c' },
    jpg: { icon: '🖼️', category: 'image', color: '#8b5cf6' }, jpeg: { icon: '🖼️', category: 'image', color: '#8b5cf6' },
    png: { icon: '🖼️', category: 'image', color: '#8b5cf6' }, gif: { icon: '🖼️', category: 'image', color: '#8b5cf6' },
    webp: { icon: '🖼️', category: 'image', color: '#8b5cf6' }, bmp: { icon: '🖼️', category: 'image', color: '#8b5cf6' },
    zip: { icon: '📦', category: 'default', color: '#f59e0b' }, rar: { icon: '📦', category: 'default', color: '#f59e0b' },
    txt: { icon: '📃', category: 'default', color: '#6b7280' }, csv: { icon: '📃', category: 'default', color: '#6b7280' }
  };
  return types[ext] || { icon: '📎', category: 'default', color: '#9ca3af' };
}

// ==================== FILE VALIDATION ====================
function validateFile(file) {
  var result = { valid: true, errors: [], warnings: [] };
  if (!file) { result.valid = false; result.errors.push('Tidak ada file'); return result; }

  var maxSize = (typeof UPLOAD_CONFIG !== 'undefined') ? UPLOAD_CONFIG.maxSizeBytes : 30 * 1024 * 1024;
  var allowed = (typeof UPLOAD_CONFIG !== 'undefined') ? UPLOAD_CONFIG.allowedExtensions : ['.pdf','.jpg','.jpeg','.png','.gif','.webp','.doc','.docx','.xls','.xlsx','.ppt','.pptx'];

  if (file.size > maxSize) { result.valid = false; result.errors.push('File terlalu besar! Maks ' + formatFileSize(maxSize)); }
  var ext = '.' + file.name.toLowerCase().split('.').pop();
  if (!allowed.includes(ext)) { result.valid = false; result.errors.push('Tipe tidak diizinkan: ' + ext); }
  if (file.name.length > 255) { result.valid = false; result.errors.push('Nama file terlalu panjang'); }
  return result;
}

function validateMultipleFiles(files) {
  if (!files || !files.length) return { valid: false, results: [], totalErrors: 1 };
  var results = [], errors = 0, ok = true;
  for (var i = 0; i < files.length; i++) {
    var v = validateFile(files[i]);
    results.push({ file: files[i], index: i, valid: v.valid, errors: v.errors });
    if (!v.valid) { ok = false; errors += v.errors.length; }
  }
  return { valid: ok, results: results, totalErrors: errors };
}

// ==================== GOOGLE DRIVE URL ====================
function extractGoogleDriveFileId(url) {
  if (!url) return null;
  var patterns = [/\/file\/d\/([^\/\?]+)/, /\/open\?id=([^&]+)/, /[?&]id=([^&]+)/, /\/d\/([^\/\?]+)/];
  for (var i = 0; i < patterns.length; i++) { var m = url.match(patterns[i]); if (m && m[1]) return m[1]; }
  return null;
}

function getDirectDownloadLink(viewUrl) {
  var id = extractGoogleDriveFileId(viewUrl);
  return id ? 'https://drive.google.com/uc?export=download&id=' + id : viewUrl;
}

function truncateUrl(url, max) {
  max = max || 50;
  return (!url || url.length <= max) ? url : url.substring(0, max) + '...';
}

// ==================== UPLOAD PROGRESS ====================
function updateUploadProgress(percent, statusText) {
  percent = Math.min(100, Math.max(0, percent || 0));
  if (typeof state !== 'undefined' && state.driveIntegration) {
    state.driveIntegration.uploadProgress = percent;
    state.driveIntegration.isUploading = percent > 0 && percent < 100;
  }
  if (typeof showUploadProgress === 'function') showUploadProgress(percent);
}

function setUploadCompleted(fileName, driveUrl) {
  updateUploadProgress(100);
  if (typeof state !== 'undefined' && state.driveIntegration) {
    state.driveIntegration.isUploading = false;
    state.driveIntegration.lastUploadedFile = { name: fileName, url: driveUrl };
    state.driveIntegration.driveLink = driveUrl || '';
  }
  if (typeof hideUploadProgress === 'function') setTimeout(hideUploadProgress, 2000);
}

function setUploadError(errorMessage) {
  updateUploadProgress(0);
  if (typeof state !== 'undefined' && state.driveIntegration) {
    state.driveIntegration.isUploading = false;
    state.driveIntegration.uploadError = errorMessage;
  }
  if (typeof hideUploadProgress === 'function') hideUploadProgress();
  showToastUploadError(errorMessage);
}

// ==================== FILE RENDERING ====================
function renderFileCard(fileInfo, index) {
  var typeInfo = getFileTypeInfo(fileInfo.name || 'file');
  return '<div class="file-item-card" data-index="' + index + '">' +
    '<div class="file-item-icon ' + typeInfo.category + '" style="background:' + typeInfo.color + '20">' + typeInfo.icon + '</div>' +
    '<div class="file-item-info">' +
      '<div class="file-item-name" title="' + escapeHtml(fileInfo.name) + '">' + escapeHtml(fileInfo.name) + '</div>' +
      '<div class="file-item-size">' + formatFileSize(fileInfo.size || 0) + '</div>' +
    '</div>' +
    '<button type="button" class="file-item-remove" onclick="removeSelectedFile(' + index + ')" title="Hapus">×</button>' +
  '</div>';
}

function renderSelectedFilesList(files) {
  var container = document.getElementById('fileListDisplay');
  var placeholder = document.getElementById('uploadPlaceholder');
  var actionsBar = document.getElementById('selectedFilesActions');
  var countEl = document.getElementById('selectedFilesCount');

  if (!container) return;

  if (!files || files.length === 0) {
    container.innerHTML = '';
    if (placeholder) placeholder.style.display = 'block';
    if (actionsBar) actionsBar.style.display = 'none';
    return;
  }

  if (placeholder) placeholder.style.display = 'none';
  if (actionsBar) actionsBar.style.display = 'flex';
  if (countEl) countEl.textContent = files.length + ' file dipilih';

  var html = '';
  for (var i = 0; i < files.length; i++) html += renderFileCard(files[i], i);
  container.innerHTML = html;
}

function removeSelectedFile(index) {
  if (typeof state === 'undefined' || !state.selectedFiles) return;
  if (index >= 0 && index < state.selectedFiles.length) {
    state.selectedFiles.splice(index, 1);
    renderSelectedFilesList(state.selectedFiles);
  }
}

// ==================== MISC UTILITIES ====================
function generateUniqueId(prefix) {
  return (prefix || '') + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function debounce(func, wait) {
  var timeout;
  return function() { var ctx = this, args = arguments; clearTimeout(timeout); timeout = setTimeout(function() { func.apply(ctx, args); }, wait); };
}

function throttle(func, limit) {
  var inThrottle;
  return function() { if (!inThrottle) { func.apply(this, arguments); inThrottle = true; setTimeout(function() { inThrottle = false; }, limit); } };
}

function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(deepClone);
  var cloned = {};
  for (var key in obj) { if (obj.hasOwnProperty(key)) cloned[key] = deepClone(obj[key]); }
  return cloned;
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(function() { showToast('Disalin ke clipboard!', 'success'); return true; }).catch(function() { return fallbackCopy(text); });
  }
  return fallbackCopy(text);
}

function fallbackCopy(text) {
  return new Promise(function(resolve) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-999999px';
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand('copy'); showToast('Disalin ke clipboard!', 'success'); resolve(true); }
    catch (e) { showToast('Gagal menyalin', 'error'); resolve(false); }
    document.body.removeChild(ta);
  });
}

function withTimeout(promise, ms, label) {
  return Promise.race([promise, new Promise(function(_, reject) { setTimeout(function() { reject(new Error((label || 'Operation') + ' timeout')); }, ms); })]);
}

function delay(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms); }); }

// ==================== GLOBAL EXPORTS ====================
window.formatNumber = formatNumber;
window.formatCurrency = formatCurrency;
window.formatDate = formatDate;
window.formatDateForInput = formatDateForInput;
window.formatDateToDDMMYYYY = formatDateToDDMMYYYY;
window.formatDateShort = formatDateShort;
window.timeAgo = timeAgo;
window.escapeHtml = escapeHtml;
window.showToast = showToast;
window.showToastUploadSuccess = showToastUploadSuccess;
window.showToastUploadError = showToastUploadError;
window.toRoman = toRoman;
window.updateStats = updateStats;
window.formatFileSize = formatFileSize;
window.checkFileSize = checkFileSize;
window.fileToBase64 = fileToBase64;
window.filesToBase64Array = filesToBase64Array;
window.getMimeTypeFromFilename = getMimeTypeFromFilename;
window.getFileTypeInfo = getFileTypeInfo;
window.validateFile = validateFile;
window.validateMultipleFiles = validateMultipleFiles;
window.extractGoogleDriveFileId = extractGoogleDriveFileId;
window.getDirectDownloadLink = getDirectDownloadLink;
window.truncateUrl = truncateUrl;
window.updateUploadProgress = updateUploadProgress;
window.setUploadCompleted = setUploadCompleted;
window.setUploadError = setUploadError;
window.renderFileCard = renderFileCard;
window.renderSelectedFilesList = renderSelectedFilesList;
window.removeSelectedFile = removeSelectedFile;
window.generateUniqueId = generateUniqueId;
window.debounce = debounce;
window.throttle = throttle;
window.deepClone = deepClone;
window.copyToClipboard = copyToClipboard;
window.withTimeout = withTimeout;
window.delay = delay;

console.log('%c utils.js loaded', 'color:#60a5fa;');
