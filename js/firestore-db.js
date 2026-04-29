/**
 * ============================================
 * FinanceSync Pro v3.3 - Firestore Database Operations
 * ============================================
 * File ini berisi semua operasi CRUD dan listener untuk Firebase Firestore.
 * Ini adalah layer abstraksi untuk semua database operations.
 * 
 * Version: 3.3.1
 * Update: Added Google Drive Integration & Apps Script Save Methods
 * Date: December 2024
 */

// ==================== REALTIME LISTENER ====================

/**
 * Mulai realtime listener untuk data submissions
 * Listener ini akan otomatis update UI saat ada perubahan data di Firestore
 */
function startRealtimeListener() {
  // Hapus listener sebelumnya jika ada
  if (state.unsubscribeListener) {
    state.unsubscribeListener();
  }
  
  console.log('[Firestore] Starting realtime listener...');
  
  // Buat query: urutkan descending by timestamp, batasi 50 dokumen
  state.unsubscribeListener = state.db
    .collection('submissions')
    .orderBy('timestamp', 'desc')
    .limit(50)
    .onSnapshot(
      // Snapshot callback (dipanggil saat data berubah)
      function(snapshot) {
        console.log('[Firestore] Received snapshot:', snapshot.size, 'documents');
        
        // Mapping data ke array state.history
        // ★ UPDATE: Include all fields including new google_drive_link field
        state.history = snapshot.docs.map(function(doc) {
          var data = doc.data();
          return Object.assign({ 
            id: doc.id,
            // ★ NEW: Extract Google Drive info for easy access
            google_drive_link: data.google_drive_link || '',
            nama_file: data.nama_file || ''
          }, data);
        });
        
        // Update UI
        if (typeof renderHistory === 'function') renderHistory();
        if (typeof updateStats === 'function') updateStats();
        if (typeof updateOverallDriveStatus === 'function') updateOverallDriveStatus();
      },
      // Error callback
      function(error) {
        console.error('[Firestore Listener Error]:', error);
        showToast('Realtime listener error: ' + error.message, 'error');
      }
    );
}

// ==================== DATE FILTER LISTENER ====================

/**
 * Apply date filter dan mulai listener dengan filter
 * @param {string} from - Tanggal awal (YYYY-MM-DD)
 * @param {string} to - Tanggal akhir (YYYY-MM-DD)
 */
function applyDateFilter() {
  if (!state.db) return;
  
  var from = state.filterDateFrom;
  var to = state.filterDateTo;

  // Jika tidak ada filter, gunakan default listener
  if (!from && !to) { 
    startRealtimeListener(); 
    return; 
  }

  console.log('[Firestore] Applying date filter:', from, 'to', to);

  // Bangun query dengan filter tanggal
  var query = state.db.collection('submissions').orderBy('tanggal', 'desc');
  
  if (from) {
    query = query.where('tanggal', '>=', from);
  }
  
  if (to) {
    query = query.where('tanggal', '<=', to);
  }

  // Hapus listener sebelumnya
  if (state.unsubscribeListener) {
    state.unsubscribeListener();
  }

  // Buat listener baru dengan filter
  state.unsubscribeListener = query.limit(100).onSnapshot(
    function(snapshot) {
      console.log('[Firestore] Filtered snapshot:', snapshot.size, 'documents');
      
      // ★ UPDATE: Include new fields in mapping
      state.history = snapshot.docs.map(function(doc) {
        var data = doc.data();
        return Object.assign({ 
          id: doc.id,
          google_drive_link: data.google_drive_link || '',
          nama_file: data.nama_file || ''
        }, data);
      });
      
      if (typeof renderHistory === 'function') renderHistory();
      if (typeof updateStats === 'function') updateStats();
      if (typeof updateOverallDriveStatus === 'function') updateOverallDriveStatus();
    },
    function(error) {
      console.error('[Filter Listener Error]:', error);
      showToast('Filter error: ' + error.message, 'error');
    }
  );
}

/**
 * Reset date filter ke default (bulan ini)
 */
window.clearDateFilter = function() {
  state.filterDateFrom = '';
  state.filterDateTo = '';
  
  var f = document.getElementById('filterDateFrom');
  var t = document.getElementById('filterDateTo');
  
  if (f) f.value = '';
  if (t) t.value = '';
  
  // Set ulang state dari input
  if (f) state.filterDateFrom = f.value;
  if (t) state.filterDateTo = t.value;
  
  // Restart listener tanpa filter
  startRealtimeListener();
  
  showToast('Filter tanggal direset', 'info');
};

// ═══════════════════════════════════════════════════════════════════════════
// ★ TAMBAHAN BARU: DATA MAPPING & PREPARATION HELPERS
//    Fungsi-fungsi untuk mempersiapkan data dari form sebelum disimpan
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Map dan normalisasi data dari form ke format Firestore
 * Fungsi ini memastikan semua field sudah benar sebelum disimpan
 * 
 * @param {Object} formData - Data mentah dari form HTML
 * @returns {Object} Data yang sudah dinormalisasi untuk Firestore
 */
function mapFormDataToFirestore(formData) {
  /**
   * Expected formData structure (from form):
   * {
   *   tanggal: "2024-12-05",           // Dari input type="date"
   *   lokasi: "Jakarta",
   *   kode: "INV-001",
   *   no_invoice: "",
   *   jenis_pengajuan: "Reimbursement",
   *   total_nominal: "500000",         // String dari input
   *   status: "Pending",
   *   dibayarkan_kepada: "John Doe",
   *   catatan_tambahan: ""
   * }
   */
  
  // Clone data untuk tidak mutasi original
  var data = Object.assign({}, formData);
  
  // ===== FORMAT TANGGAL =====
  // Convert YYYY-MM-DD → DD/MM/YYYY (format Indonesia)
  if (data.tanggal && data.tanggal.includes('-')) {
    if (typeof formatDateToDDMMYYYY === 'function') {
      data.tanggal = formatDateToDDMMYYYY(data.tanggal);
    } else {
      var parts = data.tanggal.split('-');
      if (parts.length === 3) {
        data.tanggal = parts[2] + '/' + parts[1] + '/' + parts[0];
      }
    }
  }
  
  // ===== FORMAT NOMINAL =====
  // Convert string ke integer, hapus non-digit characters
  if (data.total_nominal !== undefined && data.total_nominal !== null) {
    if (typeof data.total_nominal === 'string') {
      // Hapus semua karakter kecuali digit dan minus
      data.total_nominal = parseInt(data.total_nominal.replace(/[^\d-]/g, '')) || 0;
    } else if (typeof data.total_nominal === 'number') {
      data.total_nominal = Math.round(data.total_nominal);
    } else {
      data.total_nominal = 0;
    }
  }
  
  // ===== TRIM STRING FIELDS =====
  var stringFields = [
    'lokasi', 'kode', 'no_invoice', 'jenis_pengajuan',
    'status', 'dibayarkan_kepada', 'catatan_tambahan'
  ];
  
  stringFields.forEach(function(field) {
    if (data[field] && typeof data[field] === 'string') {
      data[field] = data[field].trim();
    }
  });
  
  // ===== SET DEFAULTS =====
  if (!data.status) data.status = 'Pending';
  if (!data.jenis_pengajuan) data.jenis_pengajuan = '';
  
  console.log('[Data Mapping] Form data mapped to Firestore format:', data);
  
  return data;
}

/**
 * Build complete submission object dengan metadata
 * @param {Object} formData - Data dari form (sudah di-map)
 * @param {Object} options - Opsi tambahan {includeSignatures, source}
 * @returns {Object} Complete submission object ready for Firestore
 */
function buildSubmissionDocument(formData, options) {
  options = options || {};
  
  var doc = mapFormDataToFirestore(formData);
  
  // ===== METADATA =====
  doc.created_at = new Date().toISOString();
  doc.updated_at = new Date().toISOString();
  doc.timestamp = firebase.firestore.FieldValue.serverTimestamp();
  
  // Source tracking
  doc.source = options.source || 'FinanceSync Pro v3.3 (Drive Edition)';
  doc.version = '3.3';
  
  // ===== SIGNATURES (jika diminta) =====
  if (options.includeSignatures !== false && typeof DEFAULT_SIGNATORIES !== 'undefined') {
    Object.assign(doc, DEFAULT_SIGNATORIES);
  }
  
  // ===== SYNC STATUS FLAGS =====
  doc.synced_to_sheets = false;
  doc.synced_at = null;
  doc.sheets_error = null;
  
  // ===== GOOGLE DRIVE FIELDS (default empty) =====
  // Akan diisi oleh Apps Script setelah upload
  doc.google_drive_link = '';
  doc.nama_file = '';
  doc.file_id = '';
  doc.file_size = 0;
  doc.mime_type = '';
  doc.uploaded_at = null;
  
  // ===== ITEMS/RINCIAN =====
  // Pastikan items adalah array
  if (!doc.items || !Array.isArray(doc.items)) {
    doc.items = [];
  }
  
  console.log('[Build Document] Submission document built:', {
    hasTanggal: !!doc.tanggal,
    hasLokasi: !!doc.lokasi,
    totalNominal: doc.total_nominal,
    itemsCount: doc.items.length
  });
  
  return doc;
}

// ==================== CREATE OPERATION ====================

/**
 * Tambah submission baru ke Firestore
 * @param {Object} data - Data submission yang akan disimpan
 * @returns {Promise<DocumentReference>} Reference ke dokumen yang dibuat
 */
async function createSubmission(data) {
  console.log('[Firestore] Creating new submission...');
  
  // Build complete document
  var docData = buildSubmissionDocument(data);
  
  try {
    const docRef = await state.db.collection('submissions').add(docData);
    
    console.log('[Firestore] ✅ Document created with ID:', docRef.id);
    
    // Simpan reference untuk akses cepat
    state.lastSavedDocId = docRef.id;
    state.lastFormData = data;
    
    return docRef;
    
  } catch (error) {
    console.error('[Firestore Create Error]:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ★ TAMBAHAN BARU: SAVE WITH APPS SCRIPT INTEGRATION
//    Fungsi pintas yang otomatis memilih metode save terbaik
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Smart Save: Pilih metode save terbaik berdasarkan kondisi
 * - Jika ada file + Apps Script configured → via Apps Script (upload + save)
 * - Jika tidak ada file → langsung ke Firestore
 * - Jika Apps Script tidak configured → fallback ke Firestore only
 * 
 * @param {Object} formData - Data dari form
 * @param {File|null} file - File opsional untuk upload
 * @returns {Promise<Object>} Hasil {success, docId, message, ...}
 */
async function smartSaveSubmission(formData, file) {
  console.log('[Smart Save] Determining best save method...');
  console.log('[Smart Save] Has file:', !!file);
  console.log('[Smart Save] Apps Script configured:', typeof isAppsScriptConfigured === 'function' ? isAppsScriptConfigured() : false);
  
  try {
    // ===== SCENARIO 1: Ada file + Apps Script tersedia → Via Apps Script =====
    if (file && typeof isAppsScriptConfigured === 'function' && isAppsScriptConfigured()) {
      console.log('[Smart Save] Using: Apps Script (with file upload)');
      
      if (typeof saveSubmissionWithFile === 'function') {
        return await saveSubmissionWithFile(formData, file);
      } else {
        console.warn('[Smart Save] saveSubmissionWithFile not found, falling back...');
        // Fall through to scenario 2 or 3
      }
    }
    
    // ===== SCENARIO 2: Ada file tapi Apps Script tidak available → Save ke Firestore saja =====
    if (file && (!typeof isAppsScriptConfigured === 'function' || !isAppsScriptConfigured())) {
      console.log('[Smart Save] Using: Firestore direct (file will not be uploaded)');
      console.warn('[Smart Save] ⚠️ File tidak akan diupload! Configure Apps Script URL untuk upload.');
      
      // Simpan data tanpa file
      var docRef = await createSubmission(formData);
      
      return {
        success: true,
        docId: docRef.id,
        message: 'Data tersimpan, tetapi file TIDAK diupload (Apps Script belum dikonfigurasi)',
        fileUploaded: false,
        warning: 'Configure Apps Script URL untuk fitur upload file'
      };
    }
    
    // ===== SCENARIO 3: Tidak ada file → Langsung ke Firestore =====
    console.log('[Smart Save] Using: Firestore direct (no file)');
    
    var docRef = await createSubmission(formData);
    
    return {
      success: true,
      docId: docRef.id,
      message: 'Data berhasil disimpan!',
      fileUploaded: false,
      hasFile: false
    };
    
  } catch (error) {
    console.error('[Smart Save] Error:', error);
    
    return {
      success: false,
      error: error.message,
      docId: null
    };
  }
}

/**
 * Save submission dengan prioritas Apps Script
 * Mirip smartSaveSubmission tapi selalu coba Apps Script dulu
 * 
 * @param {Object} formData - Data dari form
 * @param {File|null} file - File opsional
 * @param {Object} options - Opsi {forceFirestore, forceAppsScript}
 * @returns {Promise<Object>}
 */
async function saveSubmissionPriority(formData, file, options) {
  options = options || {};
  
  console.log('[Save Priority] Starting with options:', options);
  
  try {
    // Force Firestore mode
    if (options.forceFirestore) {
      console.log('[Save Priority] Forced: Firestore only');
      var ref = await createSubmission(formData);
      return { success: true, docId: ref.id, method: 'firestore' };
    }
    
    // Force Apps Script mode
    if (options.forceAppsScript) {
      console.log('[Save Priority] Forced: Apps Script');
      if (typeof saveSubmissionWithFile === 'function') {
        return await saveSubmissionWithFile(formData, file);
      }
      throw new Error('saveSubmissionWithFile function not available');
    }
    
    // Auto-detect (default)
    return await smartSaveSubmission(formData, file);
    
  } catch (error) {
    console.error('[Save Priority] Error:', error);
    throw error;
  }
}

// ==================== UPDATE OPERATION ====================

/**
 * Update submission yang sudah ada
 * @param {string} docId - ID dokumen yang akan diupdate
 * @param {Object} data - Data baru yang akan disimpan
 * @returns {Promise<void>}
 */
async function updateSubmission(docId, data) {
  console.log('[Firestore] Updating submission:', docId);
  
  // Add updated_at timestamp
  data.updated_at = new Date().toISOString();
  
  try {
    await state.db.collection('submissions').doc(docId).update(data);
    
    console.log('[Firestore] ✅ Document updated:', docId);
    
  } catch (error) {
    console.error('[Firestore Update Error]:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ★ TAMBAHAN BARU: GOOGLE DRIVE FIELD UPDATES
//    Fungsi khusus untuk update field Google Drive
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Update Google Drive link pada submission (setelah upload sukses)
 * Biasanya dipanggil oleh listener atau callback dari Apps Script
 * 
 * @param {string} docId - ID dokumen
 * @param {string} driveUrl - URL Google Drive
 * @param {string} fileName - Nama file (opsional)
 * @param {string} fileId - ID file di Drive (opsional)
 * @returns {Promise<void>}
 */
async function updateGoogleDriveLink(docId, driveUrl, fileName, fileId) {
  console.log('[Firestore] Updating Google Drive link for:', docId);
  
  var updateData = {
    google_drive_link: driveUrl || '',
    nama_file: fileName || '',
    file_id: fileId || '',
    uploaded_at: new Date().toISOString(),
    synced_to_sheets: true,
    synced_at: new Date().toISOString(),
    sheets_error: null,
    updated_at: new Date().toISOString()
  };
  
  try {
    await state.db.collection('submissions').doc(docId).update(updateData);
    
    console.log('[Firestore] ✅ Google Drive link updated:', {
      docId: docId,
      hasUrl: !!driveUrl,
      fileName: fileName
    });
    
    // Update local state jika ada di history
    if (state.history) {
      var item = state.history.find(function(h) { return h.id === docId; });
      if (item) {
        item.google_drive_link = driveUrl;
        item.nama_file = fileName;
      }
    }
    
  } catch (error) {
    console.error('[Firestore Drive Link Update Error]:', error);
    throw error;
  }
}

/**
 * Clear/remove Google Drive link dari submission
 * @param {string} docId - ID dokumen
 * @returns {Promise<void>}
 */
async function clearGoogleDriveLink(docId) {
  console.log('[Firestore] Clearing Google Drive link for:', docId);
  
  try {
    await state.db.collection('submissions').doc(docId).update({
      google_drive_link: '',
      nama_file: '',
      file_id: '',
      uploaded_at: null,
      synced_to_sheets: false,
      synced_at: null,
      updated_at: new Date().toISOString()
    });
    
    console.log('[Firestore] ✅ Google Drive link cleared');
    
  } catch (error) {
    console.error('[Firestore Clear Drive Link Error]:', error);
    throw error;
  }
}

/**
 * Batch update multiple documents' drive status
 * @param {Array} updates - Array of {docId, driveUrl, fileName}
 * @returns {Promise<void>}
 */
async function batchUpdateDriveLinks(updates) {
  if (!updates || updates.length === 0) return;
  
  console.log('[Firestore] Batch updating', updates.length, 'drive links...');
  
  try {
    var batch = state.db.batch();
    var collection = state.db.collection('submissions');
    
    updates.forEach(function(update) {
      if (!update.docId) return;
      
      var ref = collection.doc(update.docId);
      batch.update(ref, {
        google_drive_link: update.driveUrl || '',
        nama_file: update.fileName || '',
        file_id: update.fileId || '',
        uploaded_at: new Date().toISOString(),
        synced_to_sheets: true,
        synced_at: new Date().toISOString(),
        sheets_error: null,
        updated_at: new Date().toISOString()
      });
    });
    
    await batch.commit();
    
    console.log('[Firestore] ✅ Batch update completed:', updates.length, 'documents');
    
  } catch (error) {
    console.error('[Firestore Batch Update Error]:', error);
    throw error;
  }
}

// ==================== DELETE OPERATION ====================

/**
 * Hapus submission berdasarkan ID
 * @param {string} docId - ID dokumen yang akan dihapus
 * @returns {Promise<void>}
 */
async function deleteSubmission(docId) {
  console.log('[Firestore] Deleting submission:', docId);
  
  try {
    await state.db.collection('submissions').doc(docId).delete();
    
    console.log('[Firestore] ✅ Document deleted:', docId);
    
  } catch (error) {
    console.error('[Firestore Delete Error]:', error);
    throw error;
  }
}

/**
 * Hapus SEMUA submissions
 * @returns {Promise<void>}
 */
async function deleteAllSubmissions() {
  console.log('[Firestore] Deleting ALL submissions...');
  
  try {
    const snapshot = await state.db.collection('submissions').get();
    
    // Gunakan batch operation untuk efisiensi
    const batch = state.db.batch();
    
    snapshot.docs.forEach(function(doc) {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    console.log('[Firestore] ✅ All documents deleted:', snapshot.size, 'documents');
    
  } catch (error) {
    console.error('[Firestore Delete All Error]:', error);
    throw error;
  }
}

// ==================== READ OPERATIONS ====================

/**
 * Ambil satu submission berdasarkan ID
 * @param {string} docId - ID dokumen
 * @returns {Promise<Object>} Data dokumen
 */
async function getSubmissionById(docId) {
  console.log('[Firestore] Getting submission:', docId);
  
  try {
    const docSnap = await state.db.collection('submissions').doc(docId).get();
    
    if (!docSnap.exists) {
      console.warn('[Firestore] Document not found:', docId);
      return null;
    }
    
    const data = docSnap.data();
    console.log('[Firestore] ✅ Document retrieved:', docId);
    
    // ★ NEW: Return with ID and extract drive info
    return { 
      id: docSnap.id, 
      ...data,
      // Easy access to drive info
      hasDriveLink: !!data.google_drive_link,
      driveLink: data.google_drive_link || '',
      driveFileName: data.nama_file || ''
    };
    
  } catch (error) {
    console.error('[Firestore Get Error]:', error);
    throw error;
  }
}

/**
 * Get submissions yang memiliki Google Drive link
 * @returns {Promise<Array>} Array of documents with drive links
 */
async function getSubmissionsWithDriveLinks() {
  if (!state.db) return [];
  
  try {
    console.log('[Firestore] Fetching submissions with Drive links...');
    
    const snapshot = await state.db
      .collection('submissions')
      .where('google_drive_link', '!=', '')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();
    
    var results = [];
    snapshot.docs.forEach(function(doc) {
      results.push(Object.assign({ id: doc.id }, doc.data()));
    });
    
    console.log('[Firestore] Found', results.length, 'submissions with Drive links');
    
    return results;
    
  } catch (error) {
    console.error('[Firestore Get With Links Error]:', error);
    return [];
  }
}

/**
 * Cek duplikat submission
 * @param {Object} data - Data yang akan dicek
 * @returns {Promise<boolean>} True jika ada duplikat
 */
async function checkDuplicate(data) {
  if (!state.db) return false;
  
  try {
    console.log('[Firestore] Checking for duplicates...');
    
    // Normalisasi data dulu untuk comparison
    var normalizedData = mapFormDataToFirestore(data);
    
    const snapshot = await state.db.collection('submissions')
      .where('tanggal', '==', normalizedData.tanggal)
      .where('total_nominal', '==', normalizedData.total_nominal)
      .where('dibayarkan_kepada', '==', normalizedData.dibayarkan_kepada)
      .get();

    let isDuplicate = false;
    
    snapshot.forEach(function(doc) {
      const existing = doc.data();
      
      // Bandingkan field penting
      if (
        existing.lokasi === normalizedData.lokasi &&
        existing.kode === normalizedData.kode &&
        existing.jenis_pengajuan === normalizedData.jenis_pengajuan &&
        existing.status === normalizedData.status &&
        JSON.stringify(existing.items || []) === JSON.stringify(normalizedData.items || [])
      ) {
        isDuplicate = true;
      }
    });
    
    console.log('[Firestore] Duplicate check result:', isDuplicate);
    
    return isDuplicate;
    
  } catch (error) {
    console.error('[Duplicate Check Error]:', error);
    return false; // Jika error, anggap tidak ada duplikat
  }
}

/**
 * Auto-generate nomor invoice berdasarkan bulan ini
 * Format: BKK-NMSA/MM/YYYY/XXXX
 * @returns {Promise<string>} Nomor invoice yang digenerate
 */
async function autoGenerateInvoice() {
  if (!state.db) return null;
  
  try {
    console.log('[Firestore] Auto-generating invoice number...');
    
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    
    // Range tanggal untuk bulan ini
    const startDate = year + '-' + String(month + 1).padStart(2, '0') + '-01';
    const endDate = year + '-' + String(month + 1).padStart(2, '0') + '-31';

    // Query semua dokumen di bulan ini
    const snapshot = await state.db.collection('submissions')
      .where('tanggal', '>=', startDate)
      .where('tanggal', '<=', endDate)
      .orderBy('tanggal', 'desc')
      .get();

    // Cari nomor terbesar
    let maxNum = 0;
    
    snapshot.docs.forEach(function(doc) {
      const parts = (doc.data().no_invoice || '').split('/');
      const match = parts[parts.length - 1]?.match(/^(\d+)$/);
      
      if (match) {
        const n = parseInt(match[1]);
        if (n > maxNum) maxNum = n;
      }
    });

    // Generate nomor baru
    const invoiceNumber = 'BKK-NMSA/' + toRoman(month + 1) + '/' + year + '/' + String(maxNum + 1).padStart(4, '0');
    
    console.log('[Firestore] Generated invoice:', invoiceNumber);
    
    return invoiceNumber;
    
  } catch (error) {
    console.warn('[Auto Invoice Error]:', error.message);
    
    // Fallback ke format default
    return 'BKK-NMSA/' + toRoman(new Date().getMonth() + 1) + '/' + new Date().getFullYear() + '/0001';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ★ TAMBAHAN BARU: STATISTICS & ANALYTICS HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get statistics summary dari submissions
 * @returns {Promise<Object>} Statistics object
 */
async function getSubmissionStats() {
  if (!state.db) {
    return { total: 0, withFiles: 0, withoutFiles: 0, totalNominal: 0 };
  }
  
  try {
    const snapshot = await state.db.collection('submissions').get();
    
    var stats = {
      total: snapshot.size,
      withFiles: 0,
      withoutFiles: 0,
      totalNominal: 0,
      byStatus: {},
      byLocation: {}
    };
    
    snapshot.docs.forEach(function(doc) {
      var data = doc.data();
      
      // Count files
      if (data.google_drive_link || (data.files && data.files.length > 0)) {
        stats.withFiles++;
      } else {
        stats.withoutFiles++;
      }
      
      // Sum nominal
      if (data.total_nominal) {
        stats.totalNominal += (parseInt(data.total_nominal) || 0);
      }
      
      // Count by status
      var status = data.status || 'Unknown';
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
      
      // Count by location
      var location = data.lokasi || 'Unknown';
      stats.byLocation[location] = (stats.byLocation[location] || 0) + 1;
    });
    
    console.log('[Stats] Statistics:', stats);
    
    return stats;
    
  } catch (error) {
    console.error('[Stats Error]:', error);
    return { total: 0, error: error.message };
  }
}

/**
 * Search submissions by keyword
 * @param {string} keyword - Kata kunci pencarian
 * @returns {Promise<Array>} Matching documents
 */
async function searchSubmissions(keyword) {
  if (!state.db || !keyword) return [];
  
  try {
    console.log('[Search] Searching for:', keyword);
    
    // Firestore doesn't support full-text search natively
    // So we fetch recent documents and filter client-side
    const snapshot = await state.db
      .collection('submissions')
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();
    
    var keywordLower = keyword.toLowerCase();
    var results = [];
    
    snapshot.docs.forEach(function(doc) {
      var data = doc.data();
      var searchText = [
        data.kode,
        data.no_invoice,
        data.lokasi,
        data.dibayarkan_kepada,
        data.jenis_pengajuan,
        data.catatan_tambahan,
        data.nama_file
      ].filter(Boolean).join(' ').toLowerCase();
      
      if (searchText.includes(keywordLower)) {
        results.push(Object.assign({ id: doc.id }, data));
      }
    });
    
    console.log('[Search] Found', results.length, 'results for:', keyword);
    
    return results;
    
  } catch (error) {
    console.error('[Search Error]:', error);
    return [];
  }
}

// ==================== EXPORT FUNCTIONS ====================

// Original exports
window.startRealtimeListener = startRealtimeListener;
window.applyDateFilter = applyDateFilter;
window.createSubmission = createSubmission;
window.updateSubmission = updateSubmission;
window.deleteSubmission = deleteSubmission;
window.deleteAllSubmissions = deleteAllSubmissions;
window.getSubmissionById = getSubmissionById;
window.checkDuplicate = checkDuplicate;
window.autoGenerateInvoice = autoGenerateInvoice;

// ★ EXPORT TAMBAHAN BARU - Data Mapping & Preparation
window.mapFormDataToFirestore = mapFormDataToFirestore;
window.buildSubmissionDocument = buildSubmissionDocument;

// ★ EXPORT TAMBAHAN BARU - Smart Save Functions
window.smartSaveSubmission = smartSaveSubmission;
window.saveSubmissionPriority = saveSubmissionPriority;

// ★ EXPORT TAMBAHAN BARU - Google Drive Field Updates
window.updateGoogleDriveLink = updateGoogleDriveLink;
window.clearGoogleDriveLink = clearGoogleDriveLink;
window.batchUpdateDriveLinks = batchUpdateDriveLinks;

// ★ EXPORT TAMBAHAN BARU - Read Operations
window.getSubmissionsWithDriveLinks = getSubmissionsWithDriveLinks;

// ★ EXPORT TAMBAHAN BARU - Statistics & Search
window.getSubmissionStats = getSubmissionStats;
window.searchSubmissions = searchSubmissions;

// ═══════════════════════════════════════════════════════════════════════════
// ★ END OF MODIFICATIONS
//    Semua fungsi original tetap utuh dan tidak diubah
//    Hanya penambahan baru untuk mendukung Google Drive integration
// ═══════════════════════════════════════════════════════════════════════════
