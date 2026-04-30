/**
 * FinanceSync Pro v3.5 - Google Drive Upload
 * Upload file ke Drive via Apps Script, update Firestore dengan link
 * Arsitektur: Firestore langsung untuk data, Apps Script hanya untuk upload file
 */

// ==================== APPS SCRIPT COMMUNICATION ====================

/**
 * Kirim request ke Apps Script
 * mode: cors (bukan no-cors) agar response bisa dibaca
 */
async function sendToAppsScript(payload, options) {
  options = options || {};
  var url = APPS_SCRIPT_CONFIG.getUrl();

  if (!url) throw new Error('Apps Script URL belum dikonfigurasi');

  var timeout = options.timeout || APPS_SCRIPT_CONFIG.timeout.upload || 120000;

  console.log('[AppsScript]', payload.action || 'request', '|', payload.fileName || '');

  if (typeof updateUploadProgress === 'function') {
    updateUploadProgress(15, 'Mengirim ke Google Drive...');
  }

  var controller = new AbortController();
  var timeoutId = setTimeout(function() { controller.abort(); }, timeout);

  try {
    var response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }

    var result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Apps Script mengembalikan error');
    }

    console.log('[AppsScript] OK:', result.fileName || result.url || '');
    return result;

  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new Error('Timeout upload (' + (timeout / 1000) + 's)');
    }

    throw error;
  }
}

// ==================== SINGLE FILE UPLOAD ====================

/**
 * Upload 1 file ke Google Drive via Apps Script
 * Payload format sesuai dengan Apps Script yang sudah di-deploy:
 *   { action:'upload', fileName, mimeType, base64Data, folderName, metadata }
 * Response:
 *   { success:true, url, fileId, fileName, folderId }
 */
async function uploadFileToDrive(file, metadata) {
  metadata = metadata || {};

  if (!file) throw new Error('Tidak ada file');
  if (!APPS_SCRIPT_CONFIG.isConfigured()) throw new Error('Apps Script URL belum dikonfigurasi');

  // Validasi ukuran
  if (file.size > UPLOAD_CONFIG.maxSizeBytes) {
    throw new Error('File terlalu besar! Maks ' + UPLOAD_CONFIG.maxSizeDisplay);
  }

  console.log('[Upload]', file.name, '(' + formatFileSize(file.size) + ')');

  if (typeof updateUploadProgress === 'function') {
    updateUploadProgress(25, 'Membaca file...');
  }

  // Convert ke base64
  var base64;
  try {
    base64 = await fileToBase64(file);
  } catch (e) {
    throw new Error('Gagal membaca file: ' + e.message);
  }

  if (typeof updateUploadProgress === 'function') {
    updateUploadProgress(55, 'Mengupload ke Drive...');
  }

  // Bangun folder path berdasarkan company dan tanggal
  var companyLabel = (getActiveCompanyId() || 'unknown').toUpperCase();
  var dateLabel = metadata.tanggal || new Date().toISOString().split('T')[0];
  var folderName = 'FinanceSync/' + companyLabel + '/' + dateLabel;

  // Kirim ke Apps Script
  var result = await sendToAppsScript({
    action: 'upload',
    fileName: file.name,
    mimeType: file.type || getMimeTypeFromFilename(file.name),
    base64Data: base64,
    folderName: folderName,
    metadata: {
      tanggal: metadata.tanggal || '',
      kode: metadata.kode || '',
      company: getActiveCompanyId() || ''
    }
  }, { timeout: APPS_SCRIPT_CONFIG.timeout.largeFile || 300000 });

  if (typeof updateUploadProgress === 'function') {
    updateUploadProgress(100, 'Selesai!');
  }

  return {
    success: true,
    name: file.name,
    size: file.size,
    url: result.url,
    fileId: result.fileId,
    folderId: result.folderId
  };
}

// ==================== MULTIPLE FILE UPLOAD ====================

/**
 * Upload multiple files ke Drive secara berurutan
 */
async function uploadMultipleFilesToDrive(files, metadata) {
  if (!files || !files.length) throw new Error('Tidak ada file');

  var results = [];
  var errors = [];
  var total = files.length;

  for (var i = 0; i < total; i++) {
    var pct = Math.round(((i + 1) / total) * 100);

    if (typeof updateUploadProgress === 'function') {
      updateUploadProgress(pct, 'File ' + (i + 1) + '/' + total + ': ' + files[i].name);
    }

    try {
      var result = await uploadFileToDrive(files[i], metadata);
      results.push(result);

      // Delay antar file agar tidak overload
      if (i < total - 1) await delay(300);

    } catch (e) {
      console.error('[BatchUpload] Error:', files[i].name, e.message);
      errors.push({ name: files[i].name, error: e.message });
    }
  }

  return {
    totalFiles: total,
    successful: results.length,
    failed: errors.length,
    results: results,
    errors: errors
  };
}

// ==================== INTEGRATED SAVE: DATA + FILE ====================

/**
 * Simpan data ke Firestore + upload file ke Drive + update Firestore dengan link
 * Ini yang dipanggil oleh smartSaveSubmission di firestore-db.js
 *
 * Flow:
 * 1. Simpan data ke Firestore (langsung, tanpa file)
 * 2. Upload file ke Drive via Apps Script (dapat URL)
 * 3. Update doc Firestore dengan google_drive_links
 */
async function saveSubmissionWithFile(formData, file) {
  console.log('[SaveWithFile] Starting...');

  if (!formData) throw new Error('Data form kosong');

  var companyId = getActiveCompanyId();
  if (!companyId) throw new Error('Login dulu!');

  // ── Step 1: Simpan data ke Firestore langsung ──
  if (typeof updateUploadProgress === 'function') {
    updateUploadProgress(10, 'Menyimpan data ke Firebase...');
  }

  var docRef;
  try {
    docRef = await createSubmission(formData);
  } catch (e) {
    throw new Error('Gagal simpan ke Firestore: ' + e.message);
  }

  var docId = docRef.id;
  console.log('[SaveWithFile] Firestore doc:', docId);

  // ── Step 2: Upload file ke Drive ──
  if (!file) {
    return {
      success: true,
      docId: docId,
      message: 'Data tersimpan!',
      companyId: companyId
    };
  }

  if (typeof updateUploadProgress === 'function') {
    updateUploadProgress(25, 'Mengupload file ke Drive...');
  }

  var driveResult;
  try {
    driveResult = await uploadFileToDrive(file, {
      tanggal: formData.tanggal,
      kode: formData.kode,
      docId: docId
    });
  } catch (e) {
    console.warn('[SaveWithFile] Upload gagal, data tetap tersimpan di Firestore:', e.message);
    // Data sudah tersimpan, file gagal — return partial success
    return {
      success: true,
      docId: docId,
      message: 'Data tersimpan, tapi file gagal diupload: ' + e.message,
      fileError: e.message,
      companyId: companyId
    };
  }

  // ── Step 3: Update Firestore doc dengan Drive link ──
  if (driveResult && driveResult.url) {
    try {
      var collectionName = getCollectionName(companyId);
      await state.db.collection(collectionName).doc(docId).update({
        google_drive_link: driveResult.url,
        google_drive_links: firebase.firestore.FieldValue.arrayUnion({
          name: driveResult.name,
          url: driveResult.url,
          id: driveResult.fileId
        }),
        nama_file: driveResult.name,
        file_id: driveResult.fileId,
        file_size: driveResult.size,
        file_count: 1,
        uploaded_at: new Date().toISOString()
      });

      console.log('[SaveWithFile] Drive link updated in Firestore');
    } catch (e) {
      console.warn('[SaveWithFile] Gagal update Drive link:', e.message);
    }
  }

  if (typeof setUploadCompleted === 'function') {
    setUploadCompleted(driveResult.name, driveResult.url);
  }

  return {
    success: true,
    docId: docId,
    message: 'Data & file tersimpan!',
    driveUrl: driveResult.url,
    fileId: driveResult.fileId,
    fileName: driveResult.name,
    companyId: companyId
  };
}

// ==================== UTILITY EXPORTS ====================

/** Cek apakah Apps Script URL terkonfigurasi */
function isAppsScriptConfigured() {
  return APPS_SCRIPT_CONFIG.isConfigured();
}

/** Dapatkan Apps Script URL */
function getAppsScriptUrl() {
  return APPS_SCRIPT_CONFIG.getUrl();
}

/** Test koneksi ke Apps Script */
async function testAppsScriptConnection() {
  if (!isAppsScriptConfigured()) throw new Error('URL belum dikonfigurasi');

  showToast('Menguji koneksi Apps Script...', 'info');

  try {
    // Coba GET request — Apps Script doGet harus return JSON
    var response = await fetch(APPS_SCRIPT_CONFIG.getUrl());
    var data = await response.json();

    if (data.success || data.version) {
      showToast('Koneksi Apps Script berhasil! v' + (data.version || '?'), 'success');
      return true;
    }

    throw new Error('Response tidak sesuai');
  } catch (e) {
    showToast('Gagal: ' + e.message, 'error');
    return false;
  }
}

// ==================== GLOBAL EXPORTS ====================
window.sendToAppsScript = sendToAppsScript;
window.uploadFileToDrive = uploadFileToDrive;
window.uploadMultipleFilesToDrive = uploadMultipleFilesToDrive;
window.saveSubmissionWithFile = saveSubmissionWithFile;
window.isAppsScriptConfigured = isAppsScriptConfigured;
window.getAppsScriptUrl = getAppsScriptUrl;
window.testAppsScriptConnection = testAppsScriptConnection;

console.log('%c drive-sync.js loaded | URL: ' + (APPS_SCRIPT_CONFIG.isConfigured() ? 'OK' : 'MISSING'), 'color:#10b981;');
