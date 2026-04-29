/**
 * ============================================
 * FinanceSync Pro v3.4 - Firestore Database Operations
 * ============================================
 * File ini berisi semua operasi CRUD dan listener untuk Firebase Firestore.
 * 
 * Version: 3.4.0
 * Update: Added Multi-Company Support (companyId filtering)
 * Date: April 2026
 *
 * ★ PERUBAHAN (v3.4):
 *    - Semua query sekarang filter by companyId (NMSA/IPN)
 *    - Auto-generate nomor invoice sesuai prefix company
 *    - Data otomatis tersimpan dengan companyId & companyName
 *    - Security: User hanya bisa akses data company-nya sendiri
 */

// ==================== REALTIME LISTENER ====================

/**
 * Mulai realtime listener untuk data submissions
 * ★ UPDATE (v3.4): Sekarang filter by current active company!
 */
function startRealtimeListener() {
  // Hapus listener sebelumnya jika ada
  if (state.unsubscribeListener) {
    state.unsubscribeListener();
  }
  
  // ★★★ BARU (v3.4): Cek apakah user sudah login & ada active company ★★★
  var companyId = getActiveCompanyId();
  
  if (!companyId) {
    console.warn('[Firestore] Tidak ada active company! Listener tidak dimulai.');
    console.warn('[Firestore] Silakan login terlebih dahulu.');
    state.history = [];
    if (typeof renderHistory === 'function') renderHistory();
    return;
  }
  
  console.log(`[Firestore] Starting realtime listener for company: ${companyId}...`);
  
  // ★★★ UBAHAN (v3.4): Tambah where clause for companyId ★★★
  var query = state.db
    .collection('submissions')
    .where(FIREBASE_CONFIG.fields.companyId, '==', companyId)  // ← FILTER COMPANY!
    .orderBy('timestamp', 'desc')
    .limit(50);
  
  // Buat listener
  state.unsubscribeListener = query.onSnapshot(
    // Snapshot callback
    function(snapshot) {
      console.log(`[Firestore] Received snapshot for ${companyId}:`, snapshot.size, 'documents');
      
      // Mapping data ke array state.history
      state.history = snapshot.docs.map(function(doc) {
        var data = doc.data();
        return Object.assign({ 
          id: doc.id,
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
 * ★ UPDATE (v3.4): Sekarang juga filter by companyId
 * @param {string} from - Tanggal awal (YYYY-MM-DD)
 * @param {string} to - Tanggal akhir (YYYY-MM-DD)
 */
function applyDateFilter() {
  if (!state.db) return;
  
  // ★★★ BARU (v3.4): Get active company ID ★★★
  var companyId = getActiveCompanyId();
  
  if (!companyId) {
    console.warn('[Firestore] Tidak ada active company!');
    return;
  }
  
  var from = state.filterDateFrom;
  var to = state.filterDateTo;

  // Jika tidak ada filter tanggal, gunakan default listener (sudah include companyId)
  if (!from && !to) { 
    startRealtimeListener(); 
    return; 
  }

  console.log(`[Firestore] Applying date filter for ${companyId}:`, from, 'to', to);

  // ★★★ UBAHAN (v3.4): Base query sudah include companyId ★★★
  var query = state.db.collection('submissions')
    .where(FIREBASE_CONFIG.fields.companyId, '==', companyId)  // ← FILTER COMPANY!
    .orderBy('tanggal', 'desc');
  
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
      console.log(`[Firestore] Filtered snapshot for ${companyId}:`, snapshot.size, 'documents');
      
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
  
  if (f) state.filterDateFrom = f.value;
  if (t) state.filterDateTo = t.value;
  
  startRealtimeListener();
  
  showToast('Filter tanggal direset', 'info');
};

// ═══════════════════════════════════════════════════════════════════════════
// DATA MAPPING & PREPARATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Map dan normalisasi data dari form ke format Firestore
 * ★ UPDATE (v3.4): Sekarang otomatis menambahkan companyId & companyName
 * 
 * @param {Object} formData - Data mentah dari form HTML
 * @returns {Object} Data yang sudah dinormalisasi untuk Firestore
 */
function mapFormDataToFirestore(formData) {
  var data = Object.assign({}, formData);
  
  // ===== FORMAT TANGGAL =====
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
  if (data.total_nominal !== undefined && data.total_nominal !== null) {
    if (typeof data.total_nominal === 'string') {
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
  
  // ★★★ BARU (v3.4): Auto-inject Company ID & Name ★★★
  var companyConfig = getCurrentCompanyConfig();
  if (companyConfig) {
    data[FIREBASE_CONFIG.fields.companyId] = companyConfig.id;           // 'nmsa' atau 'ipn'
    data[FIREBASE_CONFIG.fields.companyName] = companyConfig.name;       // Nama lengkap PT
    
    console.log(`[Data Mapping] Auto-injected companyId: ${companyConfig.id}`);
  } else {
    console.warn('[Data Mapping] No active company! Data will be saved without companyId.');
  }
  
  console.log('[Data Mapping] Form data mapped:', data);
  
  return data;
}

/**
 * Build complete submission object dengan metadata
 * ★ UPDATE (v3.4): Sekarang pakai signatures dari company config
 * 
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
  doc.source = options.source || 'FinanceSync Pro v3.4 (Multi-Company)';
  doc.version = '3.4';
  
  // ===== SIGNATURES (★ UPDATE v3.4: Pakai company-specific signatures!) =====
  if (options.includeSignatures !== false) {
    var companyId = getActiveCompanyId();
    var companySignatures = null;
    
    // Cek apakah ConfigHelper tersedia dan ada signatures untuk company ini
    if (typeof ConfigHelper !== 'undefined' && typeof ConfigHelper.getSignaturesForCompany === 'function') {
      companySignatures = ConfigHelper.getSignaturesForCompany(companyId);
    }
    
    // Gunakan company signatures atau fallback ke global DEFAULT_SIGNATORIES
    var signaturesToUse = companySignatures || (typeof DEFAULT_SIGNATORIES !== 'undefined' ? DEFAULT_SIGNATORIES : {});
    
    Object.assign(doc, signaturesToUse);
    
    console.log('[Build Document] Using signatures for company:', companyId);
  }
  
  // ===== SYNC STATUS FLAGS =====
  doc.synced_to_sheets = false;
  doc.synced_at = null;
  doc.sheets_error = null;
  
  // ===== GOOGLE DRIVE FIELDS (default empty) =====
  doc.google_drive_link = '';
  doc.nama_file = '';
  doc.file_id = '';
  doc.file_size = 0;
  doc.mime_type = '';
  doc.uploaded_at = null;
  
  // ===== ITEMS/RINCIAN =====
  if (!doc.items || !Array.isArray(doc.items)) {
    doc.items = [];
  }
  
  console.log('[Build Document] Document built with companyId:', doc[FIREBASE_CONFIG.fields.companyId]);
  
  return doc;
}

// ==================== CREATE OPERATION ====================

/**
 * Tambah submission baru ke Firestore
 * ★ UPDATE (v3.4): Validasi bahwa user punya active company
 * 
 * @param {Object} data - Data submission yang akan disimpan
 * @returns {Promise<DocumentReference>} Reference ke dokumen yang dibuat
 */
async function createSubmission(data) {
  console.log('[Firestore] Creating new submission...');
  
  // ★★★ BARU (v3.4): Validasi company ★★★
  var companyId = getActiveCompanyId();
  if (!companyId) {
    throw new Error('Tidak ada active company! Silakan login terlebih dahulu.');
  }
  
  // Build complete document (sudah include companyId dari mapFormDataToFirestore)
  var docData = buildSubmissionDocument(data);
  
  try {
    const docRef = await state.db.collection('submissions').add(docData);
    
    console.log(`[Firestore] ✅ Document created with ID: ${docRef.id} (Company: ${companyId})`);
    
    state.lastSavedDocId = docRef.id;
    state.lastFormData = data;
    
    return docRef;
    
  } catch (error) {
    console.error('[Firestore Create Error]:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SMART SAVE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Smart Save: Pilih metode save terbaik
 * ★ UPDATE (v3.4): Validasi company sebelum save
 */
async function smartSaveSubmission(formData, file) {
  console.log('[Smart Save] Determining best save method...');
  
  // ★★★ BARU (v3.4): Cek company ★★★
  var companyId = getActiveCompanyId();
  if (!companyId) {
    return {
      success: false,
      error: 'Tidak ada active company! Silakan login terlebih dahulu.',
      requiresAuth: true
    };
  }
  
  try {
    // Scenario 1: Ada file + Apps Script configured → Via Apps Script
    if (file && typeof isAppsScriptConfigured === 'function' && isAppsScriptConfigured()) {
      console.log('[Smart Save] Using: Apps Script (with file upload)');
      
      if (typeof saveSubmissionWithFile === 'function') {
        return await saveSubmissionWithFile(formData, file);
      } else {
        console.warn('[Smart Save] saveSubmissionWithFile not found, falling back...');
      }
    }
    
    // Scenario 2: Ada file tapi Apps Script tidak available
    if (file && (!typeof isAppsScriptConfigured === 'function' || !isAppsScriptConfigured())) {
      console.log('[Smart Save] Using: Firestore direct (file will not be uploaded)');
      console.warn('[Smart Save] ⚠️ File tidak akan diupload!');
      
      var docRef = await createSubmission(formData);
      
      return {
        success: true,
        docId: docRef.id,
        message: 'Data tersimpan, tetapi file TIDAK diupload',
        fileUploaded: false,
        warning: 'Configure Apps Script URL untuk fitur upload file',
        companyId: companyId
      };
    }
    
    // Scenario 3: Tidak ada file → Langsung ke Firestore
    console.log('[Smart Save] Using: Firestore direct (no file)');
    
    var docRef = await createSubmission(formData);
    
    return {
      success: true,
      docId: docRef.id,
      message: 'Data berhasil disimpan!',
      fileUploaded: false,
      hasFile: false,
      companyId: companyId
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
 * Save submission dengan prioritas
 */
async function saveSubmissionPriority(formData, file, options) {
  options = options || {};
  
  try {
    if (options.forceFirestore) {
      var ref = await createSubmission(formData);
      return { success: true, docId: ref.id, method: 'firestore' };
    }
    
    if (options.forceAppsScript) {
      if (typeof saveSubmissionWithFile === 'function') {
        return await saveSubmissionWithFile(formData, file);
      }
      throw new Error('saveSubmissionWithFile function not available');
    }
    
    return await smartSaveSubmission(formData, file);
    
  } catch (error) {
    console.error('[Save Priority] Error:', error);
    throw error;
  }
}

// ==================== UPDATE OPERATION ====================

/**
 * Update submission yang sudah ada
 * ★ UPDATE (v3.4): Cek ownership (hanya bisa update data company sendiri)
 * 
 * @param {string} docId - ID dokumen yang akan diupdate
 * @param {Object} data - Data baru yang akan disimpan
 * @returns {Promise<void>}
 */
async function updateSubmission(docId, data) {
  console.log('[Firestore] Updating submission:', docId);
  
  // ★★★ BARU (v3.4): Verifikasi ownership ★★★
  await verifyDocumentOwnership(docId);
  
  data.updated_at = new Date().toISOString();
  
  try {
    await state.db.collection('submissions').doc(docId).update(data);
    
    console.log('[Firestore] ✅ Document updated:', docId);
    
  } catch (error) {
    console.error('[Firestore Update Error]:', error);
    throw error;
  }
}

// ==================== GOOGLE DRIVE FIELD UPDATES ====================

/**
 * Update Google Drive link pada submission
 * ★ UPDATE (v3.4): Cek ownership
 */
async function updateGoogleDriveLink(docId, driveUrl, fileName, fileId) {
  console.log('[Firestore] Updating Google Drive link for:', docId);
  
  // ★★★ BARU (v3.4): Verifikasi ownership ★★★
  await verifyDocumentOwnership(docId);
  
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
    
    console.log('[Firestore] ✅ Google Drive link updated');
    
    // Update local state
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
 * Clear/remove Google Drive link
 * ★ UPDATE (v3.4): Cek ownership
 */
async function clearGoogleDriveLink(docId) {
  console.log('[Firestore] Clearing Google Drive link for:', docId);
  
  await verifyDocumentOwnership(docId);
  
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
 * ★ UPDATE (v3.4): Filter by company
 */
async function batchUpdateDriveLinks(updates) {
  if (!updates || updates.length === 0) return;
  
  // ★★★ BARU (v3.4): Filter updates untuk company ini saja ★★★
  var companyId = getActiveCompanyId();
  
  console.log(`[Firestore] Batch updating drive links for ${companyId}...`);
  
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
 * ★ UPDATE (v3.4): Cek ownership
 * 
 * @param {string} docId - ID dokumen yang akan dihapus
 * @returns {Promise<void>}
 */
async function deleteSubmission(docId) {
  console.log('[Firestore] Deleting submission:', docId);
  
  // ★★★ BARU (v3.4): Verifikasi ownership ★★★
  await verifyDocumentOwnership(docId);
  
  try {
    await state.db.collection('submissions').doc(docId).delete();
    
    console.log('[Firestore] ✅ Document deleted:', docId);
    
  } catch (error) {
    console.error('[Firestore Delete Error]:', error);
    throw error;
  }
}

/**
 * Hapus SEMUA submissions untuk company saat ini
 * ★★ PERINGATAN: Fungsi berbahaya! Hanya hapus untuk company aktif ★★
 * 
 * @returns {Promise<void>}
 */
async function deleteAllSubmissions() {
  console.log('[Firestore] Deleting ALL submissions for current company...');
  
  // ★★★ BARU (v3.4): Hanya hapus data company aktif, bukan semua! ★★★
  var companyId = getActiveCompanyId();
  if (!companyId) {
    throw new Error('Tidak ada active company!');
  }
  
  try {
    const snapshot = await state.db.collection('submissions')
      .where(FIREBASE_CONFIG.fields.companyId, '==', companyId)
      .get();
    
    const batch = state.db.batch();
    
    snapshot.docs.forEach(function(doc) {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    console.log(`[Firestore] ✅ Deleted ${snapshot.size} documents for company: ${companyId}`);
    
  } catch (error) {
    console.error('[Firestore Delete All Error]:', error);
    throw error;
  }
}

// ==================== READ OPERATIONS ====================

/**
 * Ambil satu submission berdasarkan ID
 * ★ UPDATE (v3.4): Cek ownership
 * 
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
    
    // ★★★ BARU (v3.4): Cek apakah data milik company ini ★★★
    var companyId = getActiveCompanyId();
    var docCompanyId = data[FIREBASE_CONFIG.fields.companyId];
    
    if (companyId && docCompanyId && docCompanyId !== companyId) {
      console.warn(`[Firestore] Access denied! Document belongs to ${docCompanyId}, not ${companyId}`);
      return null;
    }
    
    console.log('[Firestore] ✅ Document retrieved:', docId);
    
    return { 
      id: docSnap.id, 
      ...data,
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
 * ★ UPDATE (v3.4): Filter by company
 * 
 * @returns {Promise<Array>} Array of documents with drive links
 */
async function getSubmissionsWithDriveLinks() {
  if (!state.db) return [];
  
  // ★★★ BARU (v3.4): Get company ID ★★★
  var companyId = getActiveCompanyId();
  if (!companyId) return [];
  
  try {
    console.log(`[Firestore] Fetching submissions with Drive links for ${companyId}...`);
    
    const snapshot = await state.db
      .collection('submissions')
      .where(FIREBASE_CONFIG.fields.companyId, '==', companyId)  // ← FILTER!
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
 * ★ UPDATE (v3.4): Filter by company
 * 
 * @param {Object} data - Data yang akan dicek
 * @returns {Promise<boolean>} True jika ada duplikat
 */
async function checkDuplicate(data) {
  if (!state.db) return false;
  
  // ★★★ BARU (v3.4): Get company ID ★★★
  var companyId = getActiveCompanyId();
  if (!companyId) return false;
  
  try {
    console.log('[Firestore] Checking for duplicates...');
    
    var normalizedData = mapFormDataToFirestore(data);
    
    // ★★★ UBAHAN (v3.4): Tambah companyId ke query ★★★
    const snapshot = await state.db.collection('submissions')
      .where(FIREBASE_CONFIG.fields.companyId, '==', normalizedData[FIREBASE_CONFIG.fields.companyId])  // ← FILTER!
      .where('tanggal', '==', normalizedData.tanggal)
      .where('total_nominal', '==', normalizedData.total_nominal)
      .where('dibayarkan_kepada', '==', normalizedData.dibayarkan_kepada)
      .get();

    let isDuplicate = false;
    
    snapshot.docs.forEach(function(doc) {
      const existing = doc.data();
      
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
    return false;
  }
}

/**
 * ★★★ UBAH BESAR (v3.4): Auto-generate nomor invoice ★★★
 * Sekarang menggunakan prefix dari CONFIG COMPANY yang aktif!
 * Format: {PREFIX}/{ROMAN_MONTH}/{YEAR}/{NUMBER}
 * Contoh NMSA: BKK-NMSA/IV/26/00105
 * Contoh IPN:  BKK-IPN/IV/26/00042
 * 
 * @returns {Promise<string>} Nomor invoice yang digenerate
 */
async function autoGenerateInvoice() {
  if (!state.db) return null;
  
  // ★★★ BARU (v3.4): Get active company config ★★★
  var companyConfig = getCurrentCompanyConfig();
  if (!companyConfig) {
    console.error('[Auto Invoice] No active company!');
    return null;
  }
  
  try {
    console.log(`[Auto Invoice] Generating invoice for: ${companyConfig.displayName}`);
    console.log(`[Auto Invoice] Using prefix: ${companyConfig.no_invoice_prefix}`);
    
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    
    // Range tanggal untuk bulan ini (format YYYY-MM-DD untuk query)
    const startDate = year + '-' + String(month + 1).padStart(2, '0') + '-01';
    const endDate = year + '-' + String(month + 1).padStart(2, '0') + '-31';

    // ★★★ UBAHAN (v3.4): Query HANYA untuk company ini! ★★★
    const snapshot = await state.db.collection('submissions')
      .where(FIREBASE_CONFIG.fields.companyId, '==', companyConfig.id)  // ← FILTER COMPANY!
      .where('tanggal', '>=', startDate)
      .where('tanggal', '<=', endDate)
      .orderBy('tanggal', 'desc')
      .get();

    // Cari nomor terbesar untuk company ini
    let maxNum = 0;
    
    snapshot.docs.forEach(function(doc) {
      const noInvoice = doc.data().no_invoice || '';
      const parts = noInvoice.split('/');
      const match = parts[parts.length - 1]?.match(/^(\d+)$/);
      
      if (match) {
        const n = parseInt(match[1]);
        if (n > maxNum) maxNum = n;
      }
    });

    // ★★★ UBAHAN (v3.4): Gunakan prefix dari company config! ★★★
    const prefix = companyConfig.no_invoice_prefix;  // "BKK-NMSA" atau "BKK-IPN"
    const romanMonth = toRoman(month + 1);
    const paddedNumber = String(maxNum + 1).padStart(4, '0');  // 0001, 0002, dst
    
    const invoiceNumber = `${prefix}/${romanMonth}/${year}/${paddedNumber}`;
    
    console.log(`[Auto Invoice] ✅ Generated: ${invoiceNumber}`);
    
    return invoiceNumber;
    
  } catch (error) {
    console.warn('[Auto Invoice Error]:', error.message);
    
    // Fallback: Generate dengan prefix company tapi nomor aman
    var fallbackPrefix = companyConfig ? companyConfig.no_invoice_prefix : 'BKK-UNKNOWN';
    return `${fallbackPrefix}/${toRoman(new Date().getMonth() + 1)}/${new Date().getFullYear()}/0001`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STATISTICS & ANALYTICS HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get statistics summary dari submissions
 * ★ UPDATE (v3.4): Filter by company
 * 
 * @returns {Promise<Object>} Statistics object
 */
async function getSubmissionStats() {
  if (!state.db) {
    return { total: 0, withFiles: 0, withoutFiles: 0, totalNominal: 0 };
  }
  
  // ★★★ BARU (v3.4): Get company ID ★★★
  var companyId = getActiveCompanyId();
  if (!companyId) {
    return { total: 0, error: 'No active company' };
  }
  
  try {
    // ★★★ UBAHAN (v3.4): Query dengan companyId ★★★
    const snapshot = await state.db.collection('submissions')
      .where(FIREBASE_CONFIG.fields.companyId, '==', companyId)
      .get();
    
    var stats = {
      total: snapshot.size,
      withFiles: 0,
      withoutFiles: 0,
      totalNominal: 0,
      byStatus: {},
      byLocation: {},
      companyId: companyId
    };
    
    snapshot.docs.forEach(function(doc) {
      var data = doc.data();
      
      if (data.google_drive_link || (data.files && data.files.length > 0)) {
        stats.withFiles++;
      } else {
        stats.withoutFiles++;
      }
      
      if (data.total_nominal) {
        stats.totalNominal += (parseInt(data.total_nominal) || 0);
      }
      
      var status = data.status || 'Unknown';
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
      
      var location = data.lokasi || 'Unknown';
      stats.byLocation[location] = (stats.byLocation[location] || 0) + 1;
    });
    
    console.log(`[Stats] Statistics for ${companyId}:`, stats);
    
    return stats;
    
  } catch (error) {
    console.error('[Stats Error]:', error);
    return { total: 0, error: error.message };
  }
}

/**
 * Search submissions by keyword
 * ★ UPDATE (v3.4): Filter by company
 * 
 * @param {string} keyword - Kata kunci pencarian
 * @returns {Promise<Array>} Matching documents
 */
async function searchSubmissions(keyword) {
  if (!state.db || !keyword) return [];
  
  // ★★★ BARU (v3.4): Get company ID ★★★
  var companyId = getActiveCompanyId();
  if (!companyId) return [];
  
  try {
    console.log(`[Search] Searching in ${companyId} for:`, keyword);
    
    // ★★★ UBAHAN (v3.4): Query dengan companyId ★★★
    const snapshot = await state.db
      .collection('submissions')
      .where(FIREBASE_CONFIG.fields.companyId, '==', companyId)  // ← FILTER!
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
    
    console.log('[Search] Found', results.length, 'results');
    
    return results;
    
  } catch (error) {
    console.error('[Search Error]:', error);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ★★★ TAMBAHAN BARU (v3.4): OWNERSHIP VERIFICATION HELPER ★★★
//    Fungsi utilitas untuk memastikan user hanya akses data company-nya
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Verifikasi bahwa document milik company yang sedang aktif
 * Dipanggil sebelum setiap update/delete operation
 * 
 * @param {string} docId - ID dokumen yang akan diverifikasi
 * @throws {Error} Jika document tidak ditemukan atau bukan milik company ini
 */
async function verifyDocumentOwnership(docId) {
  if (!state.db) return;
  
  var companyId = getActiveCompanyId();
  
  // Jika tidak ada active company, skip verifikasi (backward compatibility)
  if (!companyId) {
    console.warn('[Ownership] No active company, skipping verification');
    return;
  }
  
  try {
    const docSnap = await state.db.collection('submissions').doc(docId).get();
    
    if (!docSnap.exists) {
      throw new Error('Document tidak ditemukan!');
    }
    
    var data = docSnap.data();
    var docCompanyId = data[FIREBASE_CONFIG.fields.companyId];
    
    // Jika document punya companyId dan beda dengan active company → DENY!
    if (docCompanyId && docCompanyId !== companyId) {
      throw new Error(`Akses ditolak! Document milik company: ${docCompanyId}, bukan company Anda: ${companyId}`);
    }
    
    // Jika document tidak punya companyId (data lama), izinkan saja (backward compat)
    if (!docCompanyId) {
      console.warn('[Ownership] Document tanpa companyId (data lama), access allowed');
    }
    
    console.log(`[Ownership] ✓ Verified: ${docId} belongs to ${companyId}`);
    
  } catch (error) {
    if (error.message.includes('Akses ditolak') || error.message.includes('tidak ditemukan')) {
      throw error; // Re-throw ownership errors
    }
    // Jika error lain (misal network), log tapi jangan block
    console.error('[Ownership Verification Error]:', error);
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

// Data Mapping & Preparation
window.mapFormDataToFirestore = mapFormDataToFirestore;
window.buildSubmissionDocument = buildSubmissionDocument;

// Smart Save Functions
window.smartSaveSubmission = smartSaveSubmission;
window.saveSubmissionPriority = saveSubmissionPriority;

// Google Drive Field Updates
window.updateGoogleDriveLink = updateGoogleDriveLink;
window.clearGoogleDriveLink = clearGoogleDriveLink;
window.batchUpdateDriveLinks = batchUpdateDriveLinks;

// Read Operations
window.getSubmissionsWithDriveLinks = getSubmissionsWithDriveLinks;

// Statistics & Search
window.getSubmissionStats = getSubmissionStats;
window.searchSubmissions = searchSubmissions;

// ★★★ EXPORT TAMBAHAN BARU (v3.4): Ownership Verification ★★★
window.verifyDocumentOwnership = verifyDocumentOwnership;

// ═══════════════════════════════════════════════════════════════════════════
// END OF FILE - firestore-db.js v3.4.0 (Multi-Company Ready)
// ═══════════════════════════════════════════════════════════════════════════
