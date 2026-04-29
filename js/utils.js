/**
 * ============================================
 * FinanceSync Pro v3.3 - Utility Functions
 * ============================================
 * File ini berisi semua fungsi utilitas yang digunakan
 * di seluruh aplikasi seperti formatting, toast, dll.
 * 
 * Version: 3.3.1
 * Update: Added File Upload & Google Drive Utilities
 * Date: December 2024
 */

// ==================== NUMBER FORMATTING ====================
/**
 * Format angka dengan pemisah ribuan (Indonesian format)
 * @param {number} num - Angka yang akan diformat
 * @returns {string} Angka yang sudah diformat
 */
function formatNumber(num) {
  if (!num && num !== 0) return '0';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// ==================== DATE FORMATTING ====================
/**
 * Format tanggal ke bahasa Indonesia
 * @param {string} dateStr - String tanggal (YYYY-MM-DD)
 * @returns {string} Tanggal dalam format Indonesia
 */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  
  try {
    var date = new Date(dateStr);
    var months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    
    return date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
  } catch (e) {
    return dateStr;
  }
}

/**
 * Format tanggal untuk input date (YYYY-MM-DD)
 * @param {Date|string} date - Date object atau string tanggal
 * @returns {string} Tanggal dalam format YYYY-MM-DD
 */
function formatDateForInput(date) {
  if (!date) return '';
  
  try {
    var d = new Date(date);
    var year = d.getFullYear();
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  } catch (e) {
    return '';
  }
}

/**
 * Format tanggal ke format DD/MM/YYYY (untuk Firestore)
 * @param {string} dateStr - String tanggal dari input date (YYYY-MM-DD)
 * @returns {string} Tanggal dalam format DD/MM/YYYY
 */
function formatDateToDDMMYYYY(dateStr) {
  if (!dateStr) return '';
  
  try {
    var parts = dateStr.split('-');
    if (parts.length === 3) {
      return parts[2] + '/' + parts[1] + '/' + parts[0];
    }
    return dateStr;
  } catch (e) {
    return dateStr;
  }
}

/**
 * Format timestamp ke waktu relatif (contoh: "5 menit lalu")
 * @param {string|Date|Timestamp} timestamp - Timestamp yang akan diformat
 * @returns {string} Waktu relatif
 */
function timeAgo(timestamp) {
  if (!timestamp) return '-';
  
  try {
    var date;
    
    // Handle Firebase Timestamp
    if (timestamp && typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      return '-';
    }
    
    var now = new Date();
    var diffMs = now - date;
    var diffSec = Math.floor(diffMs / 1000);
    var diffMin = Math.floor(diffSec / 60);
    var diffHour = Math.floor(diffMin / 60);
    var diffDay = Math.floor(diffHour / 24);
    
    if (diffSec < 60) return 'Baru saja';
    if (diffMin < 60) return diffMin + ' menit lalu';
    if (diffHour < 24) return diffHour + ' jam lalu';
    if (diffDay < 7) return diffDay + ' hari lalu';
    
    return formatDate(date);
  } catch (e) {
    return '-';
  }
}

// ==================== HTML ESCAPE ====================
/**
 * Escape HTML untuk mencegah XSS
 * @param {string} text - Teks yang akan di-escape
 * @returns {string} Teks yang sudah di-escape
 */
function escapeHtml(text) {
  if (!text) return '';
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==================== TOAST NOTIFICATIONS ====================/**
 * Menampilkan toast notification
 * @param {string} message - Pesan yang ditampilkan
 * @param {string} type - Tipe toast ('success', 'error', 'info', 'firebase', 'drive')
 * @param {number} duration - Durasi tampil dalam ms (default: 4000)
 */
function showToast(message, type, duration) {
  type = type || 'info';
  duration = duration || 4000;
  var toast = document.getElementById('toast');
  
  if (!toast) return;
  
  // Clear timeout sebelumnya jika ada
  if (toastTimeout) clearTimeout(toastTimeout);
  
  // Set konten dan kelas
  toast.textContent = message;
  toast.className = 'toast show ' + type;
  
  // Auto-hide setelah duration
  toastTimeout = setTimeout(function() {
    toast.classList.remove('show');
  }, duration);
}

/**
 * Toast khusus untuk sukses upload file
 * @param {string} fileName - Nama file yang diupload
 * @param {string} driveUrl - URL Google Drive (opsional)
 */
function showToastUploadSuccess(fileName, driveUrl) {
  var msg = '✅ File berhasil disimpan: ' + fileName;
  if (driveUrl) {
    msg += '\n📎 Buka di Google Drive';
  }
  showToast(msg, 'drive', 5000);
}

/**
 * Toast khusus untuk error upload
 * @param {string} error - Pesan error
 */
function showToastUploadError(error) {
  showToast('❌ Gagal upload: ' + error, 'error', 5000);
}

// ==================== ROMAN NUMERAL CONVERTER ====================
/**
 * Konversi angka ke angka Romawi
 * @param {number} num - Angka yang akan dikonversi
 * @returns {string} Angka Romawi
 */
function toRoman(num) {
  var vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  var syms = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
  var result = '';
  
  for (var i = 0; i < vals.length; i++) {
    while (num >= vals[i]) {
      result += syms[i];
      num -= vals[i];
    }
  }
  
  return result;
}

// ==================== STATISTICS UPDATE ====================
/**
 * Update statistik di dashboard
 */
function updateStats() {
  if (!state.history) return;
  
  var total = state.history.length;
  var sent = total;
  var synced = 0;
  var pending = 0;

  state.history.forEach(function(item) {
    var files = item.files || [];
    
    if (files.length === 0) {
      synced++;
      return;
    }
    
    // Cek status sync setiap file
    var hasPending = files.some(function(f) {
      var fData = f.mapValue?.fields || f;
      return !fData.driveUrl?.stringValue && !fData.driveUrl && fData.status !== 'synced';
    });
    
    if (hasPending) {
      pending++;
    } else {
      synced++;
    }
  });

  // Update DOM elements
  if (elements.totalData) elements.totalData.textContent = total;
  if (elements.sentData) elements.sentData.textContent = sent;
  if (elements.sheetsData) elements.sheetsData.textContent = synced;
  if (elements.pendingData) elements.pendingData.textContent = pending;
}

// ═══════════════════════════════════════════════════════════════════════════
// ★ TAMBAHAN BARU: FILE UPLOAD UTILITIES
//    Fungsi-fungsi untuk menangani file upload, konversi, dan validasi
// ═══════════════════════════════════════════════════════════════════════════

// ===== FILE SIZE FORMATTING =====

/**
 * Format ukuran file menjadi string readable
 * @param {number} bytes - Ukuran file dalam bytes
 * @returns {string} Ukuran formatted (contoh: "2.5 MB")
 */
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  
  var k = 1024;
  var sizes = ['Bytes', 'KB', 'MB', 'GB'];
  var i = Math.floor(Math.log(bytes) / Math.log(k));
  var size = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
  
  return size + ' ' + sizes[i];
}

/**
 * Cek apakah ukuran file dalam batas yang diizinkan
 * @param {number} fileSize - Ukuran file dalam bytes
 * @param {number} maxSize - Batas maksimal dalam bytes (opsional, default dari config)
 * @returns {Object} {valid: boolean, size: string, maxSize: string}
 */
function checkFileSize(fileSize, maxSize) {
  maxSize = maxSize || (typeof UPLOAD_CONFIG !== 'undefined' ? UPLOAD_CONFIG.maxSizeBytes : 30 * 1024 * 1024);
  
  return {
    valid: fileSize <= maxSize,
    size: formatFileSize(fileSize),
    maxSize: formatFileSize(maxSize),
    exceededBy: fileSize - maxSize
  };
}

// ===== BASE64 CONVERSION =====

/**
 * Convert File object ke Base64 string
 * @param {File} file - File object dari input[type="file"]
 * @returns {Promise<string>} Base64 string
 */
function fileToBase64(file) {
  return new Promise(function(resolve, reject) {
    if (!file) {
      reject(new Error('Tidak ada file yang diberikan'));
      return;
    }
    
    var reader = new FileReader();
    
    reader.onload = function() {
      // Hapus prefix "data:mime/type;base64,"
      var base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    
    reader.onerror = function(error) {
      reject(new Error('Gagal membaca file: ' + error));
    };
    
    reader.onabort = function() {
      reject(new Error('Pembacaan file dibatalkan'));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Convert FileList atau array of Files ke array of Base64
 * @param {FileList|Array} files - FileList atau array of File objects
 * @returns {Promise<Array>} Array of {name, base64, size, type}
 */
function filesToBase64Array(files) {
  return new Promise(async function(resolve, reject) {
    if (!files || files.length === 0) {
      resolve([]);
      return;
    }
    
    var results = [];
    var errors = [];
    
    for (var i = 0; i < files.length; i++) {
      try {
        var base64 = await fileToBase64(files[i]);
        results.push({
          name: files[i].name,
          base64: base64,
          size: files[i].size,
          type: files[i].type,
          lastModified: files[i].lastModified
        });
      } catch (error) {
        errors.push({ name: files[i].name, error: error.message });
      }
    }
    
    resolve({ results: results, errors: errors });
  });
}

// ===== MIME TYPE DETECTION =====

/**
 * Dapatkan MIME type dari nama file (berdasarkan extension)
 * @param {string} filename - Nama file
 * @returns {string} MIME type
 */
function getMimeTypeFromFilename(filename) {
  if (!filename) return 'application/octet-stream';
  
  var ext = filename.toLowerCase().split('.').pop();
  
  var mimeMap = {
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    
    // Archives
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
    
    // Text
    'txt': 'text/plain',
    'csv': 'text/csv',
    'json': 'application/json',
    'xml': 'application/xml',
    'html': 'text/html',
    
    // Audio/Video (jika diperlukan)
    'mp3': 'audio/mpeg',
    'mp4': 'video/mp4'
  };
  
  return mimeMap[ext] || 'application/octet-stream';
}

/**
 * Dapatkan icon/kategori file berdasarkan extension
 * @param {string} filename - Nama file
 * @returns {Object} {icon: string, category: string, color: string}
 */
function getFileTypeInfo(filename) {
  if (!filename) return { icon: '📄', category: 'default', color: '#9ca3af' };
  
  var ext = filename.toLowerCase().split('.').pop();
  
  var typeInfo = {
    // Documents
    'pdf': { icon: '📕', category: 'document', color: '#ef4444' },
    'doc': { icon: '📝', category: 'document', color: '#2563eb' },
    'docx': { icon: '📝', category: 'document', color: '#2563eb' },
    'xls': { icon: '📊', category: 'spreadsheet', color: '#16a34a' },
    'xlsx': { icon: '📊', category: 'spreadsheet', color: '#16a34a' },
    'ppt': { icon: '📽️', category: 'presentation', color: '#ea580c' },
    'pptx': { icon: '📽️', category: 'presentation', color: '#ea580c' },
    
    // Images
    'jpg': { icon: '🖼️', category: 'image', color: '#8b5cf6' },
    'jpeg': { icon: '🖼️', category: 'image', color: '#8b5cf6' },
    'png': { icon: '🖼️', category: 'image', color: '#8b5cf6' },
    'gif': { icon: '🖼️', category: 'image', color: '#8b5cf6' },
    'webp': { icon: '🖼️', category: 'image', color: '#8b5cf6' },
    'bmp': { icon: '🖼️', category: 'image', color: '#8b5cf6' },
    'svg': { icon: '🖼️', category: 'image', color: '#8b5cf6' },
    
    // Archives
    'zip': { icon: '📦', category: 'archive', color: '#f59e0b' },
    'rar': { icon: '📦', category: 'archive', color: '#f59e0b' },
    '7z': { icon: '📦', category: 'archive', color: '#f59e0b' },
    
    // Text
    'txt': { icon: '📃', category: 'text', color: '#6b7280' },
    'csv': { icon: '📃', category: 'text', color: '#6b7280' },
    
    // Default
    'default': { icon: '📎', category: 'default', color: '#9ca3af' }
  };
  
  return typeInfo[ext] || typeInfo['default'];
}

// ===== FILE VALIDATION =====

/**
 * Validasi file sebelum upload
 * @param {File} file - File object yang akan divalidasi
 * @returns {Object} {valid: boolean, errors: Array<string>, warnings: Array<string>}
 */
function validateFile(file) {
  var result = {
    valid: true,
    errors: [],
    warnings: []
  };
  
  if (!file) {
    result.valid = false;
    result.errors.push('Tidak ada file yang dipilih');
    return result;
  }
  
  // Dapatkan config jika tersedia
  var maxFileSize = (typeof UPLOAD_CONFIG !== 'undefined') ? UPLOAD_CONFIG.maxSizeBytes : 30 * 1024 * 1024;
  var allowedExtensions = (typeof UPLOAD_CONFIG !== 'undefined') ? UPLOAD_CONFIG.allowedExtensions : 
    ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];
  var maxFileNameLength = (typeof UPLOAD_CONFIG !== 'undefined') ? UPLOAD_CONFIG.validation?.maxFileNameLength : 255;
  
  // Validasi ukuran
  if (file.size > maxFileSize) {
    result.valid = false;
    result.errors.push(
      'File terlalu besar! Maksimal ' + formatFileSize(maxFileSize) + '. ' +
      'Ukuran Anda: ' + formatFileSize(file.size)
    );
  }
  
  // Warning untuk file cukup besar (>10MB)
  var warningSize = (typeof UPLOAD_CONFIG !== 'undefined') ? UPLOAD_CONFIG.warningSizeBytes : 10 * 1024 * 1024;
  if (file.size > warningSize && file.size <= maxFileSize) {
    result.warnings.push(
      'File cukup besar (' + formatFileSize(file.size) + '), upload mungkin memerlukan waktu lebih lama'
    );
  }
  
  // Validasi extension
  var ext = '.' + file.name.toLowerCase().split('.').pop();
  if (!allowedExtensions.includes(ext)) {
    result.valid = false;
    result.errors.push(
      'Tipe file tidak diizinkan: ' + ext + '\nGunakan: ' + allowedExtensions.join(', ')
    );
  }
  
  // Validasi panjang nama file
  if (file.name.length > maxFileNameLength) {
    result.valid = false;
    result.errors.push(
      'Nama file terlalu panjang! Maksimal ' + maxFileNameLength + ' karakter'
    );
  }
  
  // Validasi karakter nama file
  var invalidChars = /[<>:"|?*\x00-\x1F]/;
  if (invalidChars.test(file.name)) {
    result.valid = false;
    result.errors.push('Nama file mengandakan karakter tidak valid');
  }
  
  // Cek reserved names (Windows)
  var reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
  var nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
  if (reservedNames.test(nameWithoutExt)) {
    result.valid = false;
    result.errors.push('Nama file menggunakan kata yang dipesan sistem');
  }
  
  return result;
}

/**
 * Validasi multiple files
 * @param {FileList|Array} files - FileList atau array of File
 * @returns {Object} {valid: boolean, results: Array<Object>, totalErrors: number}
 */
function validateMultipleFiles(files) {
  if (!files || files.length === 0) {
    return {
      valid: false,
      results: [],
      totalErrors: 1,
      errorMessage: 'Tidak ada file yang dipilih'
    };
  }
  
  var results = [];
  var totalErrors = 0;
  var allValid = true;
  
  for (var i = 0; i < files.length; i++) {
    var validation = validateFile(files[i]);
    results.push({
      file: files[i],
      index: i,
      ...validation
    });
    
    if (!validation.valid) {
      allValid = false;
      totalErrors += validation.errors.length;
    }
  }
  
  return {
    valid: allValid,
    results: results,
    totalErrors: totalErrors
  };
}

// ===== GOOGLE DRIVE URL UTILITIES =====

/**
 * Ekstrak file ID dari URL Google Drive
 * @param {string} url - URL Google Drive
 * @returns {string|null} File ID atau null jika tidak ditemukan
 */
function extractGoogleDriveFileId(url) {
  if (!url) return null;
  
  var patterns = [
    /\/file\/d\/([^\/\?]+)/,           // /file/d/FILE_ID/view
    /\/open\?id=([^&]+)/,              // /open?id=FILE_ID
    /[?&]id=([^&]+)/,                 // ?id=FILE_ID or &id=FILE_ID
    /\/d\/([^\/\?]+)/                  // /d/FILE_ID (docs/sheets/slides)
  ];
  
  for (var i = 0; i < patterns.length; i++) {
    var match = url.match(patterns[i]);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Konversi URL Google Drive view ke direct download link
 * @param {string} viewUrl - URL view Google Drive
 * @returns {string|null} Direct download URL
 */
function getDirectDownloadLink(viewUrl) {
  var fileId = extractGoogleDriveFileId(viewUrl);
  
  if (fileId) {
    return 'https://drive.google.com/uc?export=download&id=' + fileId;
  }
  
  return viewUrl; // Return original jika tidak bisa parse
}

/**
 * Deteksi tipe file Google Drive dari URL
 * @param {string} url - URL Google Drive
 * @returns {string} Deskripsi tipe file
 */
function detectDriveFileType(url) {
  if (!url) return 'Unknown';
  
  if (url.includes('/document/d/')) return 'Google Docs';
  if (url.includes('/spreadsheets/d/')) return 'Google Sheets';
  if (url.includes('/presentation/d/')) return 'Google Slides';
  if (url.includes('/forms/d/')) return 'Google Forms';
  if (url.includes('/file/d/') || url.includes('?id=')) return 'File';
  if (url.includes('.pdf')) return 'PDF Document';
  if (url.match(/\.(jpg|jpeg|png|gif|webp)/)) return 'Image';
  
  return 'Link';
}

/**
 * Buat short display URL untuk UI
 * @param {string} url - URL lengkap
 * @param {number} maxLength - Panjang maksimal (default: 50)
 * @returns {string} URL yang dipotong
 */
function truncateUrl(url, maxLength) {
  maxLength = maxLength || 50;
  
  if (!url || url.length <= maxLength) return url;
  
  return url.substring(0, maxLength) + '...';
}

// ===== UPLOAD PROGRESS HELPERS =====

/**
 * Update progress bar di UI
 * @param {number} percent - Persentase progress (0-100)
 * @param {string} statusText - Teks status (opsional)
 */
function updateUploadProgress(percent, statusText) {
  percent = Math.min(100, Math.max(0, percent || 0));
  
  // Update progress bar container
  if (typeof showUploadProgress === 'function') {
    showUploadProgress(percent);
  }
  
  // Update status text jika ada
  var statusEl = document.getElementById('uploadStatusText');
  if (statusEl && statusText) {
    statusEl.textContent = statusText;
  }
  
  // Update global state
  if (typeof state !== 'undefined' && state.driveIntegration) {
    state.driveIntegration.uploadProgress = percent;
    state.driveIntegration.isUploading = percent > 0 && percent < 100;
  }
}

/**
 * Set upload status ke completed
 * @param {string} fileName - Nama file yang selesai diupload
 * @param {string} driveUrl - URL Google Drive hasil upload
 */
function setUploadCompleted(fileName, driveUrl) {
  updateUploadProgress(100);
  
  // Update state
  if (typeof state !== 'undefined' && state.driveIntegration) {
    state.driveIntegration.isUploading = false;
    state.driveIntegration.uploadProgress = 100;
    state.driveIntegration.lastUploadedFile = { name: fileName, url: driveUrl };
    state.driveIntegration.driveLink = driveUrl || '';
    state.driveIntegration.uploadError = null;
  }
  
  // Show success in UI
  if (driveUrl) {
    var driveResult = document.getElementById('driveLinkResult');
    var driveUrlEl = document.getElementById('driveLinkUrl');
    
    if (driveResult && driveUrlEl) {
      driveUrlEl.textContent = driveUrl;
      driveUrlEl.href = driveUrl;
      driveResult.classList.add('show');
    }
  }
  
  // Hide progress after delay
  setTimeout(function() {
    if (typeof hideUploadProgress === 'function') {
      hideUploadProgress();
    }
  }, 2000);
}

/**
 * Set upload status ke error
 * @param {string} errorMessage - Pesan error
 */
function setUploadError(errorMessage) {
  updateUploadProgress(0);
  
  // Update state
  if (typeof state !== 'undefined' && state.driveIntegration) {
    state.driveIntegration.isUploading = false;
    state.driveIntegration.uploadProgress = 0;
    state.driveIntegration.uploadError = errorMessage;
  }
  
  // Hide progress
  if (typeof hideUploadProgress === 'function') {
    hideUploadProgress();
  }
  
  // Show error toast
  showToastUploadError(errorMessage);
}

// ===== FILE LIST RENDERING =====

/**
 * Render file item card di UI
 * @param {Object} fileInfo - Info file {name, size, type, base64?}
 * @param {number} index - Index file dalam list
 * @returns {string} HTML string untuk file card
 */
function renderFileCard(fileInfo, index) {
  var typeInfo = getFileTypeInfo(fileInfo.name || 'file');
  var sizeStr = formatFileSize(fileInfo.size || 0);
  
  return '\
    <div class="file-item-card" data-index="' + index + '">\
      <div class="file-item-icon ' + typeInfo.category + '" style="background:' + typeInfo.color + '20">\
        ' + typeInfo.icon + '\
      </div>\
      <div class="file-item-info">\
        <div class="file-item-name" title="' + escapeHtml(fileInfo.name) + '">\
          ' + escapeHtml(fileInfo.name) + '\
        </div>\
        <div class="file-item-size">' + sizeStr + '</div>\
      </div>\
      <button type="button"\
              class="file-item-remove"\
              onclick="removeSelectedFile(' + index + ')"\
              title="Hapus file ini">\
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>\
        </svg>\
      </button>\
    </div>';
}

/**
 * Render daftar file yang dipilih
 * @param {Array} files - Array of File objects
 */
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
  
  // Hide placeholder
  if (placeholder) placeholder.style.display = 'none';
  
  // Show actions bar
  if (actionsBar) actionsBar.style.display = 'flex';
  if (countEl) countEl.textContent = files.length + ' file dipilih';
  
  // Render each file
  var html = '';
  for (var i = 0; i < files.length; i++) {
    html += renderFileCard(files[i], i);
  }
  
  container.innerHTML = html;
}

/**
 * Hapus file tertentu dari selectedFiles
 * @param {number} index - Index file yang akan dihapus
 */
function removeSelectedFile(index) {
  if (typeof state === 'undefined' || !state.selectedFiles) return;
  
  if (index >= 0 && index < state.selectedFiles.length) {
    var removed = state.selectedFiles.splice(index, 1)[0];
    console.log('🗑️ File removed:', removed.name);
    
    // Re-render list
    renderSelectedFilesList(state.selectedFiles);
    
    // Update file input (tricky part - need to reconstruct)
    updateFileInputFromState();
  }
}

/**
 * Update file input element dari state.selectedFiles
 * Note: Ini adalah workaround karena tidak bisa set files secara programmatic
 */
function updateFileInputFromState() {
  // File input tidak bisa di-set secara programmatic
  // Jadi kita hanya update visual saja via renderSelectedFilesList
  // Data tetap di state.selectedFiles
}

// ===== MISCELLANEOUS UTILITIES =====

/**
 * Generate unique ID
 * @param {string} prefix - Prefix untuk ID (default: '')
 * @returns {string} Unique ID
 */
function generateUniqueId(prefix) {
  prefix = prefix || '';
  return prefix + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Debounce function
 * @param {Function} func - Function yang akan di-debounce
 * @param {number} wait - Waktu tunggu dalam ms
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  var timeout;
  return function() {
    var context = this;
    var args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(function() {
      func.apply(context, args);
    }, wait);
  };
}

/**
 * Throttle function
 * @param {Function} func - Function yang akan di-throttle
 * @param {number} limit - Interval minimum dalam ms
 * @returns {Function} Throttled function
 */
function throttle(func, limit) {
  var inThrottle;
  return function() {
    var context = this;
    var args = arguments;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(function() {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Deep clone object
 * @param {Object} obj - Object yang akan di-clone
 * @returns {Object} Cloned object
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(function(item) { return deepClone(item); });
  if (obj instanceof Object) {
    var clonedObj = {};
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
  
  return obj;
}

/**
 * Copy text to clipboard
 * @param {string} text - Text yang akan di-copy
 * @returns {Promise<boolean>} Success status
 */
function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text)
      .then(function() {
        showToast('✅ Disalin ke clipboard!', 'success');
        return true;
      })
      .catch(function(err) {
        console.error('Clipboard error:', err);
        return fallbackCopyToClipboard(text);
      });
  } else {
    return fallbackCopyToClipboard(text);
  }
}

/**
 * Fallback copy untuk browser lama
 * @param {string} text - Text yang akan di-copy
 * @returns {Promise<boolean>}
 */
function fallbackCopyToClipboard(text) {
  return new Promise(function(resolve) {
    var textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      showToast('✅ Disalin ke clipboard!', 'success');
      resolve(true);
    } catch (err) {
      console.error('Fallback copy failed:', err);
      showToast('❌ Gagal menyalin teks', 'error');
      resolve(false);
    }
    
    document.body.removeChild(textArea);
  });
}

// ==================== TIMEOUT HELPER ====================
/**
 * Wrapper untuk Promise dengan timeout
 * @param {Promise} promise - Promise yang akan di-wrap
 * @param {number} ms - Timeout dalam milidetik
 * @param {string} label - Label untuk error message
 * @returns {Promise} Promise dengan timeout
 */
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise(function(_, reject) {
      setTimeout(function() {
        reject(new Error(label + ' timeout'));
      }, ms);
    })
  ]);
}

/**
 * Delay/Pause execution
 * @param {number} ms - Waktu tunggu dalam milidetik
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms);
  });
}

// ==================== EXPORT FUNCTIONS ====================
// Membuat fungsi dapat diakses secara global

// Original exports
window.formatNumber = formatNumber;
window.formatDate = formatDate;
window.escapeHtml = escapeHtml;
window.showToast = showToast;
window.toRoman = toRoman;
window.updateStats = updateStats;
window.withTimeout = withTimeout;

// ★ EXPORT TAMBAHAN BARU - Date formatting
window.formatDateForInput = formatDateForInput;
window.formatDateToDDMMYYYY = formatDateToDDMMYYYY;
window.timeAgo = timeAgo;

// ★ EXPORT TAMBAHAN BARU - Toast variants
window.showToastUploadSuccess = showToastUploadSuccess;
window.showToastUploadError = showToastUploadError;

// ★ EXPORT TAMBAHAN BARU - File size
window.formatFileSize = formatFileSize;
window.checkFileSize = checkFileSize;

// ★ EXPORT TAMBAHAN BARU - Base64 conversion
window.fileToBase64 = fileToBase64;
window.filesToBase64Array = filesToBase64Array;

// ★ EXPORT TAMBAHAN BARU - MIME types
window.getMimeTypeFromFilename = getMimeTypeFromFilename;
window.getFileTypeInfo = getFileTypeInfo;

// ★ EXPORT TAMBAHAN BARU - Validation
window.validateFile = validateFile;
window.validateMultipleFiles = validateMultipleFiles;

// ★ EXPORT TAMBAHAN BARU - Google Drive URLs
window.extractGoogleDriveFileId = extractGoogleDriveFileId;
window.getDirectDownloadLink = getDirectDownloadLink;
window.detectDriveFileType = detectDriveFileType;
window.truncateUrl = truncateUrl;

// ★ EXPORT TAMBAHAN BARU - Upload progress
window.updateUploadProgress = updateUploadProgress;
window.setUploadCompleted = setUploadCompleted;
window.setUploadError = setUploadError;

// ★ EXPORT TAMBAHAN BARU - File rendering
window.renderFileCard = renderFileCard;
window.renderSelectedFilesList = renderSelectedFilesList;
window.removeSelectedFile = removeSelectedFile;
window.updateFileInputFromState = updateFileInputFromState;

// ★ EXPORT TAMBAHAN BARU - Misc utilities
window.generateUniqueId = generateUniqueId;
window.debounce = debounce;
window.throttle = throttle;
window.deepClone = deepClone;
window.copyToClipboard = copyToClipboard;
window.delay = delay;

// ═══════════════════════════════════════════════════════════════════════════
// ★ END OF MODIFICATIONS
//    Semua fungsi original tetap utuh dan tidak diubah
//    Hanya penambahan baru untuk mendukung Google Drive integration
// ═══════════════════════════════════════════════════════════════════════════
