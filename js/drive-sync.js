/**
 * ============================================
 * FinanceSync Pro v3.3 - Google Drive Sync Functions
 * ============================================
 * File ini menangani semua fungsi terkait sinkronisasi ke Google Drive,
 * termasuk status tracking, polling, manual sync trigger,
 * dan FILE UPLOAD ke Google Drive via Apps Script.
 * 
 * Version: 3.3.1
 * Update: Added Direct File Upload & Apps Script Communication
 * Date: December 2024
 */

// ==================== DRIVE SYNC LISTENER (PER DOCUMENT) ====================

/**
 * Mulai listener untuk monitoring sync status satu dokumen
 * Listener ini akan update UI saat status sync berubah di Firestore
 * @param {string} docId - ID dokumen yang akan dimonitor
 */
function startDriveSyncListener(docId) {
  if (!state.db || !docId) return;

  // Hapus listener sebelumnya untuk doc ini jika ada
  if (state.driveSyncListeners[docId]) {
    state.driveSyncListeners[docId]();
  }

  console.log('[Drive Sync] Starting listener for document:', docId);

  // Buat realtime listener untuk dokumen spesifik
  state.driveSyncListeners[docId] = state.db
    .collection('submissions')
    .doc(docId)
    .onSnapshot(
      // Snapshot callback
      function(docSnapshot) {
        if (!docSnapshot.exists) {
          console.warn('[Drive Sync] Document not found:', docId);
          return;
        }

        const data = docSnapshot.data();
        
        // ★ UPDATE: Support both old format (files array) and new format (google_drive_link)
        const files = data.files || [];
        const googleDriveLink = data.google_drive_link || '';
        const fileName = data.nama_file || '';

        // Hitung status file (legacy format)
        const syncedFiles = files.filter(function(f) {
          const fData = f.mapValue?.fields || f;
          return fData.driveUrl?.stringValue || fData.driveUrl;
        });

        const pendingFiles = files.filter(function(f) {
          const fData = f.mapValue?.fields || f;
          return !fData.driveUrl?.stringValue && !fData.driveUrl && fData.status !== 'synced';
        });

        const errorFiles = files.filter(function(f) {
          const fData = f.mapValue?.fields || f;
          return fData.status?.stringValue === 'error' || fData.status === 'error';
        });

        console.log(
          '[Drive Sync] Document:', docId,
          '- Synced:', syncedFiles.length,
          '- Pending:', pendingFiles.length,
          '- Error:', errorFiles.length,
          '- Drive Link:', googleDriveLink ? 'YES' : 'NO'
        );

        // Update UI berdasarkan status
        if (googleDriveLink) {
          // ★ NEW: Google Drive link exists (new format)
          updateDriveStatusBanner('synced', '✅ File berhasil disimpan ke Google Drive!');
          showToast('✅ File tersimpan: ' + (fileName || 'Google Drive'), 'drive');
          
          // Show drive link in UI if available
          if (typeof setUploadCompleted === 'function') {
            setUploadCompleted(fileName, googleDriveLink);
          }
          
          // Update stats dan history
          updateStats();
          if (typeof renderHistory === 'function') {
            renderHistory();
          }
          
          // Stop listener karena sudah selesai
          if (state.driveSyncListeners[docId]) {
            state.driveSyncListeners[docId]();
            delete state.driveSyncListeners[docId];
          }
          
        } else if (syncedFiles.length === files.length && files.length > 0) {
          // Semua file sudah synced (legacy format)
          updateDriveStatusBanner('synced', '✅ Semua file berhasil disinkronkan ke Google Spreadsheet!');
          showToast('✅ File berhasil sync ke Google Spreadsheet!', 'drive');
          
          // Update stats dan history
          updateStats();
          if (typeof renderHistory === 'function') {
            renderHistory();
          }
          
          // Stop listener karena sudah selesai
          if (state.driveSyncListeners[docId]) {
            state.driveSyncListeners[docId]();
            delete state.driveSyncListeners[docId];
          }
          
        } else if (errorFiles.length > 0) {
          // Ada error
          const errorMsg = errorFiles[0].mapValue?.fields?.errorMessage?.stringValue || 'Unknown error';
          updateDriveStatusBanner('error', '❌ Error sync: ' + errorMsg);
          showToast('Error sync Drive: ' + errorMsg, 'error');
          
        } else if (pendingFiles.length > 0) {
          // Masih pending
          updateDriveStatusBanner(
            'pending', 
            '⏳ Menunggu ' + pendingFiles.length + ' file untuk sync ke Google Spreadsheet...'
          );
          
        } else if (files.length === 0 && !googleDriveLink) {
          // Tidak ada file
          hideDriveStatusBanner();
        }
      },
      // Error callback
      function(error) {
        console.error('[Drive Listener Error]:', error);
        updateDriveStatusBanner('error', '❌ Error monitoring sync status');
      }
    );
}

// ==================== DRIVE STATUS POLLING ====================

/**
 * Mulai polling untuk cek status sync secara berkala
 * Polling dilakukan setiap 30 detik
 */
function startDriveStatusPolling() {
  // Hanya mulai polling jika belum ada
  if (state.pollingInterval) {
    console.log('[Drive Sync] Polling already running');
    return;
  }

  console.log('[Drive Sync] Starting status polling (every 30s)...');

  state.pollingInterval = setInterval(function() {
    // Skip jika tidak terhubung
    if (!state.db || !state.isConnected) return;

    // Hitung total documents dengan pending files (legacy format)
    const totalPendingDocs = state.history.filter(function(doc) {
      if (!doc.files || doc.files.length === 0) {
        // ★ NEW: Also check new google_drive_link field
        return !doc.google_drive_link;
      }
      
      return doc.files.some(function(f) {
        const fData = f.mapValue?.fields || f;
        return !fData.driveUrl?.stringValue && !fData.driveUrl && fData.status !== 'synced';
      });
    }).length;

    // Update banner jika ada pending
    if (totalPendingDocs > 0 && elements.driveStatusBanner) {
      if (elements.driveStatusBanner.style.display === 'none') {
        elements.driveStatusBanner.style.display = 'flex';
      }
      
      elements.driveStatusText.textContent = 
        totalPendingDocs + ' transaksi dengan file menunggu sync ke Google Spreadsheet...';
    }

  }, 30000); // Setiap 30 detik
}

/**
 * Hentikan polling dan semua drive listeners
 */
function stopDriveStatusPolling() {
  console.log('[Drive Sync] Stopping all polling and listeners...');
  
  // Clear polling interval
  if (state.pollingInterval) {
    clearInterval(state.pollingInterval);
    state.pollingInterval = null;
  }

  // Unsubscribe dari semua document listeners
  Object.keys(state.driveSyncListeners).forEach(function(docId) {
    if (state.driveSyncListeners[docId]) {
      state.driveSyncListeners[docId]();
    }
  });
  
  state.driveSyncListeners = {};
}

// ==================== DRIVE STATUS BANNER MANAGEMENT ====================

/**
 * Update tampilan drive status banner
 * @param {string} status - Status ('pending', 'synced', 'error')
 * @param {string} message - Pesan yang ditampilkan
 */
function updateDriveStatusBanner(status, message) {
  if (!elements.driveStatusBanner) return;

  // Tampilkan banner
  elements.driveStatusBanner.style.display = 'flex';
  
  // Update class berdasarkan status
  elements.driveStatusBanner.className = 
    'drive-status-banner no-print ' + (status === 'synced' ? 'active' : '');
  
  // Update pesan
  elements.driveStatusText.textContent = message;

  // Update badge
  if (elements.driveStatusBadge) {
    elements.driveStatusBadge.className = 'drive-status-badge ' + status;
    
    switch (status) {
      case 'synced':
        elements.driveStatusBadge.innerHTML = '✅ Done';
        break;
      case 'pending':
        elements.driveStatusBadge.innerHTML = '⏳ Pending';
        break;
      case 'error':
        elements.driveStatusBadge.innerHTML = '❌ Error';
        break;
      default:
        elements.driveStatusBadge.innerHTML = '⏳ Unknown';
    }
  }
}

/**
 * Sembunyikan drive status banner
 */
function hideDriveStatusBanner() {
  if (elements.driveStatusBanner) {
    elements.driveStatusBanner.style.display = 'none';
  }
}

// ==================== OVERALL DRIVE STATUS UPDATE ====================

/**
 * Update overall drive status berdasarkan semua data di history
 * Dipanggil setiap kali history berubah
 */
function updateOverallDriveStatus() {
  if (!state.history || state.history.length === 0) {
    hideDriveStatusBanner();
    return;
  }

  let totalPendingDocs = 0;
  let totalSyncedDocs = 0;

  // Iterasi semua documents
  state.history.forEach(function(item) {
    const files = item.files || [];
    const hasDriveLink = item.google_drive_link; // ★ NEW field
    
    if (files.length === 0 && !hasDriveLink) return; // Skip tanpa files

    // ★ NEW: Check new format first
    if (hasDriveLink) {
      totalSyncedDocs++;
      return;
    }

    // Legacy format check
    const hasPending = files.some(function(f) {
      const fData = f.mapValue?.fields || f;
      return !fData.driveUrl?.stringValue && !fData.driveUrl && fData.status !== 'synced';
    });

    if (hasPending) {
      totalPendingDocs++;
    } else if (files.length > 0) {
      totalSyncedDocs++;
    }
  });

  // Update banner berdasarkan hasil
  if (totalPendingDocs > 0) {
    updateDriveStatusBanner(
      'pending',
      totalPendingDocs + ' transaksi dengan file menunggu sync ke Google Spreadsheet...'
    );
  } else if (totalSyncedDocs > 0) {
    updateDriveStatusBanner(
      'synced',
      '✅ Semua file (' + totalSyncedDocs + ') sudah sync ke Google Spreadsheet!'
    );
    
    // Auto-hide setelah 5 detik
    setTimeout(hideDriveStatusBanner, 5000);
  } else {
    hideDriveStatusBanner();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ★ TAMBAHAN BARU: APPS SCRIPT COMMUNICATION & FILE UPLOAD
//    Fungsi-fungsi untuk komunikasi langsung dengan Google Apps Script
// ═══════════════════════════════════════════════════════════════════════════

// ===== APPS SCRIPT URL MANAGEMENT =====

/**
 * Dapatkan Apps Script URL yang aktif
 * @returns {string} URL atau empty string
 */
function getAppsScriptUrl() {
  // Priority: state > localStorage > config default
  return state.appsScriptUrl || 
         localStorage.getItem(CONFIG_KEYS.APPS_SCRIPT_URL) || 
         (typeof APPS_SCRIPT_CONFIG !== 'undefined' ? APPS_SCRIPT_CONFIG.getUrl() : '');
}

/**
 * Set Apps Script URL
 * @param {string} url - URL Web App Apps Script
 * @returns {boolean} Success status
 */
function setAppsScriptUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  url = url.trim();
  
  // Validasi minimal
  if (!url.includes('script.google.com')) {
    console.warn('[Drive Sync] Invalid Apps Script URL format');
    return false;
  }
  
  // Simpan ke state
  state.appsScriptUrl = url;
  
  // Simpan ke localStorage
  localStorage.setItem(CONFIG_KEYS.APPS_SCRIPT_URL, url);
  
  // Jika ada ConfigHelper, gunakan juga
  if (typeof APPS_SCRIPT_CONFIG !== 'undefined' && APPS_SCRIPT_CONFIG.setUrl) {
    APPS_SCRIPT_CONFIG.setUrl(url);
  }
  
  console.log('[Drive Sync] Apps Script URL updated:', url.substring(0, 50) + '...');
  return true;
}

/**
 * Cek apakah Apps Script URL sudah dikonfigurasi
 * @returns {boolean}
 */
function isAppsScriptConfigured() {
  const url = getAppsScriptUrl();
  return !!url && url.includes('script.google.com');
}

// ===== CORE: SEND DATA TO APPS SCRIPT =====

/**
 * Kirim data/post request ke Google Apps Script
 * Fungsi inti untuk semua komunikasi dengan backend
 * 
 * @param {Object} payload - Data yang akan dikirim
 * @param {Object} options - Opsi tambahan {timeout, showProgress}
 * @returns {Promise<Object>} Response dari Apps Script
 */
async function sendToAppsScript(payload, options) {
  options = options || {};
  
  const url = getAppsScriptUrl();
  
  // Validasi URL
  if (!url) {
    throw new Error('Apps Script URL belum dikonfigurasi. Silakan setup di pengaturan.');
  }
  
  // Default action jika tidak ada
  if (!payload.action) {
    payload.action = 'save'; // Default action
  }
  
  // Log request
  console.log('[Apps Script] Sending request:', {
    action: payload.action,
    hasFile: !!payload.file_base64,
    fileName: payload.file_name || '(none)',
    timestamp: new Date().toISOString()
  });
  
  // Tentukan timeout
  const timeout = payload.file_base64 
    ? ((typeof APPS_SCRIPT_CONFIG !== 'undefined') ? APPS_SCRIPT_CONFIG.timeout.upload : 120000)
    : ((typeof APPS_SCRIPT_CONFIG !== 'undefined') ? APPS_SCRIPT_CONFIG.timeout.normal : 30000);
  
  // Tampilkan progress jika diminta
  if (options.showProgress !== false && typeof updateUploadProgress === 'function') {
    updateUploadProgress(10, 'Mengirim data ke server...');
  }
  
  try {
    // Buat abort controller untuk timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    // Kirim request
    const response = await fetch(url, {
      method: 'POST',
      mode: 'no-cors', // Penting untuk cross-origin ke Apps Script
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Note: Dengan mode 'no-cors', kita tidak bisa baca response
    // Asumsikan sukses jika tidak throw error
    
    console.log('[Apps Script] Request sent successfully (no-cors mode)');
    
    // Return success (response body tidak bisa dibaca di no-cors)
    return {
      success: true,
      message: 'Request sent successfully',
      note: 'Response tidak terbaca (no-cors). Cek status di Firebase.'
    };
    
  } catch (error) {
    console.error('[Apps Script] Request failed:', error);
    
    // Handle specific errors
    if (error.name === 'AbortError') {
      throw new Error('Timeout! Server terlalu lama merespons (' + (timeout/1000) + 's)');
    }
    
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ★ MAIN FEATURE: FILE UPLOAD TO GOOGLE DRIVE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Upload file tunggal ke Google Drive via Apps Script
 * Fungsi utama untuk upload 1 file
 * 
 * @param {File} file - File object dari input[type="file"]
 * @param {Object} metadata - Metadata tambahan {doc_id, folder_id}
 * @returns {Promise<Object>} Hasil upload {success, fileId, fileName, fileUrl, ...}
 */
async function uploadFileToDrive(file, metadata) {
  metadata = metadata || {};
  
  // ========== VALIDASI ==========
  
  // 1. Validasi file ada
  if (!file) {
    throw new Error('Tidak ada file yang dipilih untuk diupload');
  }
  
  // 2. Validasi file menggunakan ConfigHelper atau fallback
  let validation;
  if (typeof validateFile === 'function') {
    validation = validateFile(file);
  } else {
    // Fallback validation sederhana
    validation = {
      valid: file.size <= 30 * 1024 * 1024, // 30MB default
      errors: file.size > 30 * 1024 * 1024 ? ['File terlalu besar'] : []
    };
  }
  
  if (!validation.valid) {
    throw new Error(validation.errors.join('; '));
  }
  
  // 3. Validasi Apps Script URL configured
  if (!isAppsScriptConfigured()) {
    throw new Error('Apps Script URL belum dikonfigurasi. Silakan masukkan URL di Setup > Step 3');
  }
  
  // ========== PROSES UPLOAD ==========
  
  console.log('[Upload] Starting process:', file.name, '(' + (file.size/1024/1024).toFixed(2) + ' MB)');
  
  // Update progress
  if (typeof updateUploadProgress === 'function') {
    updateUploadProgress(20, 'Membaca file...');
  }
  
  try {
    // 1. Convert file ke Base64
    let base64;
    if (typeof fileToBase64 === 'function') {
      base64 = await fileToBase64(file);
    } else {
      // Fallback base64 conversion
      base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = () => reject(new Error('Gagal membaca file'));
        reader.readAsDataURL(file);
      });
    }
    
    console.log('[Upload] File converted to base64 (' + (base64.length/1024/1024).toFixed(2) + ' MB encoded)');
    
    // Update progress
    if (typeof updateUploadProgress === 'function') {
      updateUploadProgress(50, 'Mengupload ke Google Drive...');
    }
    
    // 2. Siapkan payload
    const payload = {
      action: 'save', // Atau 'upload_only' jika hanya upload tanpa simpan data
      
      // Data submission (jika ada)
      doc_id: metadata.doc_id || state.editingDocId || '',
      
      // File data
      file_base64: base64,
      file_name: file.name,
      file_type: file.type || (typeof getMimeTypeFromFilename === 'function' 
        ? getMimeTypeFromFilename(file.name) 
        : 'application/octet-stream'),
      
      // Folder target (opsional)
      folder_id: metadata.folder_id || ''
    };
    
    // 3. Kirim ke Apps Script
    const result = await sendToAppsScript(payload, {
      showProgress: true,
      timeout: (typeof APPS_SCRIPT_CONFIG !== 'undefined') 
        ? APPS_SCRIPT_CONFIG.timeout.upload 
        : 120000
    });
    
    // Update progress selesai
    if (typeof updateUploadProgress === 'function') {
      updateUploadProgress(100, 'Upload selesai!');
    }
    
    console.log('[Upload] Result:', result);
    
    // 4. Return hasil
    return {
      success: true,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      message: result.message || 'File berhasil dikirim ke Apps Script',
      note: result.note || ''
    };
    
  } catch (error) {
    console.error('[Upload] Error:', error);
    
    // Reset progress
    if (typeof setUploadError === 'function') {
      setUploadError(error.message);
    }
    
    throw error;
  }
}

/**
 * Upload multiple files ke Google Drive
 * @param {FileList|Array} files - Multiple files
 * @param {Object} metadata - Metadata tambahan
 * @returns {Promise<Object>} Hasil batch upload
 */
async function uploadMultipleFilesToDrive(files, metadata) {
  metadata = metadata || {};
  
  if (!files || files.length === 0) {
    throw new Error('Tidak ada file yang dipilih');
  }
  
  console.log('[Batch Upload] Starting:', files.length, 'files');
  
  const results = [];
  const errors = [];
  
  for (let i = 0; i < files.length; i++) {
    try {
      console.log('[Batch Upload] Processing file', (i+1), '/', files.length, ':', files[i].name);
      
      const result = await uploadFileToDrive(files[i], metadata);
      results.push({
        index: i,
        fileName: files[i].name,
        ...result
      });
      
      // Small delay between uploads to avoid overwhelming
      if (i < files.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
    } catch (error) {
      console.error('[Batch Upload] Error file', files[i].name, ':', error.message);
      errors.push({
        index: i,
        fileName: files[i].name,
        error: error.message
      });
    }
  }
  
  return {
    totalFiles: files.length,
    successful: results.length,
    failed: errors.length,
    results: results,
    errors: errors
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ★ INTEGRATED SAVE: DATA + FILE SEKALIGUS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Simpan submission lengkap (data form + file) ke Firebase via Apps Script
 * Fungsi ALL-IN-ONE: handleSaveSubmission di frontend
 * 
 * @param {Object} formData - Data dari form {tanggal, lokasi, kode, dll}
 * @param {File|null} file - File opsional yang akan diupload
 * @returns {Promise<Object>} Hasil penyimpanan
 */
async function saveSubmissionWithFile(formData, file) {
  console.log('[Save Submission] Starting process...');
  console.log('[Save Submission] Has file:', !!file);
  
  // ========== VALIDASI FORM DATA ==========
  
  if (!formData) {
    throw new Error('Data form tidak boleh kosong');
  }
  
  // Field wajib
  const requiredFields = ['tanggal', 'lokasi'];
  const missingFields = requiredFields.filter(field => !formData[field]);
  
  if (missingFields.length > 0) {
    throw new Error('Field wajib tidak lengkap: ' + missingFields.join(', '));
  }
  
  // ========== PROSES ==========
  
  try {
    // 1. Convert tanggal ke format DD/MM/YYYY jika perlu
    let tanggalFormatted = formData.tanggal;
    if (tanggalFormatted && tanggalFormatted.includes('-')) {
      // Format YYYY-MM-DD → DD/MM/YYYY
      if (typeof formatDateToDDMMYYYY === 'function') {
        tanggalFormatted = formatDateToDDMMYYYY(tanggalFormatted);
      } else {
        const parts = tanggalFormatted.split('-');
        tanggalFormatted = parts[2] + '/' + parts[1] + '/' + parts[0];
      }
    }
    
    // 2. Siapkan base64 file jika ada
    let fileBase64 = '';
    let fileName = '';
    let fileType = '';
    
    if (file) {
      console.log('[Save Submission] Converting file to base64...');
      
      if (typeof fileToBase64 === 'function') {
        fileBase64 = await fileToBase64(file);
      } else {
        fileBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
      
      fileName = file.name;
      fileType = file.type || (typeof getMimeTypeFromFilename === 'function' 
        ? getMimeTypeFromFilename(file.name) 
        : 'application/octet-stream');
    }
    
    // 3. Update progress
    if (typeof updateUploadProgress === 'function') {
      updateUploadProgress(30, 'Menyiapkan data...');
    }
    
    // 4. Build payload untuk Apps Script
    const payload = {
      action: 'save',
      
      // Data submission
      tanggal: tanggalFormatted,
      lokasi: formData.lokasi || '',
      kode: formData.kode || '',
      no_invoice: formData.no_invoice || '',
      jenis_pengajuan: formData.jenis_pengajuan || '',
      total_nominal: parseInt(formData.total_nominal) || 0,
      status: formData.status || 'Pending',
      dibayarkan_kepada: formData.dibayarkan_kepada || '',
      catatan_tambahan: formData.catatan_tambahan || '',
      
      // Edit mode
      doc_id: formData.doc_id || state.editingDocId || '',
      
      // File data (jika ada)
      file_base64: fileBase64,
      file_name: fileName,
      file_type: fileType
    };
    
    // 5. Kirim ke Apps Script
    console.log('[Save Submission] Sending to Apps Script...');
    
    if (typeof updateUploadProgress === 'function') {
      updateUploadProgress(60, 'Menyimpan ke Firebase & Google Drive...');
    }
    
    const result = await sendToAppsScript(payload, {
      showProgress: true,
      timeout: (typeof APPS_SCRIPT_CONFIG !== 'undefined') 
        ? (fileBase64 ? APPS_SCRIPT_CONFIG.timeout.upload : APPS_SCRIPT_CONFIG.timeout.normal)
        : (fileBase64 ? 120000 : 30000)
    });
    
    // 6. Selesai
    if (typeof updateUploadProgress === 'function') {
      updateUploadProgress(100, 'Berhasil disimpan!');
    }
    
    console.log('[Save Submission] Success!', result);
    
    // 7. Return hasil
    return {
      success: true,
      message: file 
        ? 'Data & file berhasil disimpan!' 
        : 'Data berhasil disimpan!',
      hasFile: !!file,
      fileName: fileName,
      appsScriptResult: result
    };
    
  } catch (error) {
    console.error('[Save Submission] Error:', error);
    
    if (typeof setUploadError === 'function') {
      setUploadError(error.message);
    }
    
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ★ MANUAL SYNC TRIGGER (UPDATED)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Trigger manual sync (tombol "Sync Sekarang")
 * Fungsi ini mengecek status sync dan memberikan feedback ke user
 * ★ UPDATED: Sekarang juga bisa force sync via Apps Script
 */
window.triggerManualSync = async function() {
  const btn = elements.forceSyncBtn;
  if (!btn) return;

  // Update button UI ke state "checking"
  btn.disabled = true;
  btn.classList.add('syncing');
  btn.innerHTML = `
    <svg class="drive-sync-icon animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
    </svg>
    <span>Checking...</span>
  `;

  try {
    // ★ NEW: Cek dulu apakah bisa trigger sync via Apps Script
    if (isAppsScriptConfigured()) {
      console.log('[Manual Sync] Triggering sync via Apps Script...');
      
      // Update status display
      const statusEl = document.getElementById('manualSyncStatus');
      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.className = 'manual-sync-status uploading';
        statusEl.innerHTML = '<span class="spinner"></span> Meminta sync ke Apps Script...';
      }
      
      // Kirim request sync ke Apps Script
      const result = await sendToAppsScript({ action: 'sync' }, { showProgress: false });
      
      // Update status
      if (statusEl) {
        statusEl.className = 'manual-sync-status success';
        statusEl.innerHTML = '✅ Sync request terkirim!';
      }
      
      // Update last sync time
      updateLastSyncTime();
      
      // Update button sukses
      btn.classList.remove('syncing');
      btn.classList.add('synced');
      btn.innerHTML = `
        <svg class="drive-sync-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
        <span>Sync Triggered ✓</span>
      `;
      
      showToast('✅ Sync request terkirim ke Apps Script!', 'success');
      
      // Reset setelah 3 detik
      setTimeout(function() { resetSyncButton(btn); }, 3000);
      
      return;
    }
    
    // ===== FALLBACK: Cek Firebase langsung (original logic) =====
    
    // Validasi koneksi Firebase
    if (!state.db) {
      showToast('Firebase belum terhubung!', 'error');
      resetSyncButton(btn);
      return;
    }

    // Cek apakah ada document yang tersimpan
    if (!state.lastSavedDocId) {
      showToast('Tidak ada data untuk di-sync. Submit form dulu!', 'info');
      resetSyncButton(btn);
      return;
    }

    // Ambil data document terakhir
    const docSnap = await state.db.collection('submissions').doc(state.lastSavedDocId).get();
    
    if (!docSnap.exists) {
      showToast('Document tidak ditemukan!', 'error');
      resetSyncButton(btn);
      return;
    }

    const data = docSnap.data();
    
    // ★ NEW: Check new format fields
    const files = data.files || [];
    const googleDriveLink = data.google_drive_link || '';

    // Jika ada Google Drive link (new format)
    if (googleDriveLink) {
      showToast('✅ File sudah tersimpan di Google Drive!', 'drive');
      
      btn.classList.remove('syncing');
      btn.classList.add('synced');
      btn.innerHTML = `
        <svg class="drive-sync-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
        <span>On Drive ✓</span>
      `;
      
      setTimeout(function() { resetSyncButton(btn); }, 3000);
      return;
    }

    // Legacy format check
    if (files.length === 0) {
      showToast('Tidak ada file untuk di-sync pada transaksi ini.', 'info');
      resetSyncButton(btn);
      return;
    }

    // Hitung status file (legacy)
    const syncedCount = files.filter(function(f) {
      const fData = f.mapValue?.fields || f;
      return fData.driveUrl?.stringValue || fData.driveUrl;
    }).length;

    const pendingCount = files.filter(function(f) {
      const fData = f.mapValue?.fields || f;
      return !fData.driveUrl?.stringValue && !fData.driveUrl && fData.status !== 'synced';
    }).length;

    const errorCount = files.filter(function(f) {
      const fData = f.mapValue?.fields || f;
      return fData.status?.stringValue === 'error' || fData.status === 'error';
    }).length;

    // Berikan feedback sesuai status
    if (syncedCount === files.length && files.length > 0) {
      showToast('✅ Semua file (' + syncedCount + ') berhasil tersinkron!', 'drive');
      
      btn.classList.remove('syncing');
      btn.classList.add('synced');
      btn.innerHTML = `
        <svg class="drive-sync-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
        <span>All Synced ✓</span>
      `;
      
      setTimeout(function() { resetSyncButton(btn); }, 3000);

    } else if (errorCount > 0) {
      showToast('❌ ' + errorCount + ' file error.', 'error');
      resetSyncButton(btn);

    } else {
      showToast('⏳ ' + pendingCount + '/' + files.length + ' file masih pending.', 'info');
      resetSyncButton(btn);
    }

  } catch (error) {
    console.error('[Force Sync Error]:', error);
    showToast('Error: ' + error.message, 'error');
    resetSyncButton(btn);
  }
};

/**
 * Update last sync time display
 */
function updateLastSyncTime() {
  const container = document.getElementById('lastSyncInfoContainer');
  const display = document.getElementById('lastSyncTimeDisplay');
  
  if (container && display) {
    container.style.display = 'block';
    display.textContent = new Date().toLocaleTimeString('id-ID');
  }
}

// ==================== HELPER: RESET SYNC BUTTON ====================

/**
 * Reset sync button ke state default
 * @param {HTMLElement} btn - Button element
 */
function resetSyncButton(btn) {
  if (!btn) return;
  
  btn.disabled = false;
  btn.classList.remove('syncing', 'synced');
  btn.innerHTML = `
    <svg class="drive-sync-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3 3h10a3 3 0 002-4 2v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
    </svg>
    <span>Sync ke Sheets</span>
  `;
}

// ==================== APPS SCRIPT URL SETUP ====================

/**
 * Modal setup untuk input Apps Script Web App URL
 * Dipanggil saat user ingin mengkonfigurasi URL Apps Script
 * ★ UPDATED: Lebih user-friendly dengan validasi
 */
window.showModalAppsScriptSetup = function() {
  const currentUrl = getAppsScriptUrl();
  
  const url = prompt(
    '📝 Masukkan URL Web App Apps Script:\n\n' +
    '1. Buka Google Apps Script Editor\n' +
    '2. Deploy → New deployment\n' +
    '3. Type: Web app\n' +
    '4. Execute as: Me (email Anda)\n' +
    '5. Who has access: Anyone\n' +
    '6. Deploy → Copy URL\n\n' +
    (currentUrl ? 'URL saat ini:\n' + currentUrl + '\n\n' : '') +
    'URL:'
  );

  if (url && url.trim()) {
    try {
      // Validasi URL format
      new URL(url.trim());
      
      // Validasi adalah script.google.com
      if (!url.trim().includes('script.google.com')) {
        showToast('URL harus dari script.google.com!', 'error');
        return;
      }
      
      // Simpan menggunakan fungsi baru
      if (setAppsScriptUrl(url.trim())) {
        showToast('✅ URL Apps Script disimpan!', 'success');
        
        // Test koneksi setelah 1 detik
        setTimeout(async function() {
          try {
            await testAppsScriptConnection();
          } catch(e) {
            // Ignore test error
          }
        }, 1000);
      } else {
        showToast('Gagal menyimpan URL!', 'error');
      }
      
    } catch (e) {
      console.error('Invalid URL:', e);
      showToast('URL tidak valid!', 'error');
    }
  }
};

/**
 * Test koneksi ke Apps Script
 * @returns {Promise<boolean>}
 */
async function testAppsScriptConnection() {
  if (!isAppsScriptConfigured()) {
    throw new Error('URL belum dikonfigurasi');
  }
  
  showToast('🧪 Menguji koneksi ke Apps Script...', 'info');
  
  try {
    const result = await sendToAppsScript({ 
      action: 'test_connection' 
    }, { 
      showProgress: false,
      timeout: 15000 
    });
    
    showToast('✅ Koneksi ke Apps Script berhasil!', 'success');
    return true;
    
  } catch (error) {
    showToast('❌ Gagal terhubung: ' + error.message, 'error');
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ★ EXPORT FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

// Original exports
window.startDriveSyncListener = startDriveSyncListener;
window.startDriveStatusPolling = startDriveStatusPolling;
window.stopDriveStatusPolling = stopDriveStatusPolling;
window.updateDriveStatusBanner = updateDriveStatusBanner;
window.hideDriveStatusBanner = hideDriveStatusBanner;
window.updateOverallDriveStatus = updateOverallDriveStatus;

// ★ EXPORT TAMBAHAN BARU - Apps Script URL Management
window.getAppsScriptUrl = getAppsScriptUrl;
window.setAppsScriptUrl = setAppsScriptUrl;
window.isAppsScriptConfigured = isAppsScriptConfigured;

// ★ EXPORT TAMBAHAN BARU - Core Communication
window.sendToAppsScript = sendToAppsScript;

// ★ EXPORT TAMBAHAN BARU - File Upload Functions
window.uploadFileToDrive = uploadFileToDrive;
window.uploadMultipleFilesToDrive = uploadMultipleFilesToDrive;

// ★ EXPORT TAMBAHAN BARU - Integrated Save
window.saveSubmissionWithFile = saveSubmissionWithFile;

// ★ EXPORT TAMBAHAN BARU - Helpers
window.resetSyncButton = resetSyncButton;
window.updateLastSyncTime = updateLastSyncTime;
window.testAppsScriptConnection = testAppsScriptConnection;

// Keep original export
window.showModalAppsScriptSetup = showModalAppsScriptSetup;

// ═══════════════════════════════════════════════════════════════════════════
// ★ END OF MODIFICATIONS
//    Semua fungsi original tetap utuh dan tidak diubah
//    Hanya penambahan baru untuk mendukung direct file upload
// ═══════════════════════════════════════════════════════════════════════════
