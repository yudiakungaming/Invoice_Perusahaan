/**
 * FinanceSync Pro v3.5 - Firestore Operations
 * Semua operasi CRUD Firestore
 * Collection dinamis via getCollectionName() dari config.js
 */

// ==================== REALTIME LISTENER ====================
function startRealtimeListener() {
  if (state.unsubscribeListener) {
    state.unsubscribeListener();
    state.unsubscribeListener = null;
  }

  var companyId = getActiveCompanyId();
  if (!companyId || !state.db) {
    console.warn('[Firestore] No active company or no db!');
    state.history = [];
    if (typeof renderHistory === 'function') renderHistory(state.history);
    if (typeof updateStats === 'function') updateStats(state.history);
    return;
  }

  var collectionName = getCollectionName(companyId);
  console.log('[Firestore] Starting listener:', collectionName);

  try {
    var query = state.db
      .collection(collectionName)
      .orderBy('created_at', 'desc')
      .limit(100);

    state.unsubscribeListener = query.onSnapshot(
      function(snapshot) {
        console.log('[Firestore] Snapshot:', snapshot.size, 'docs');
        state.history = snapshot.docs.map(function(doc) {
          var d = doc.data();
          return {
            id: doc.id,
            ...d,
            google_drive_link: d.google_drive_link || '',
            nama_file: d.nama_file || ''
          };
        });

        if (typeof renderHistory === 'function') renderHistory(state.history);
        if (typeof updateStats === 'function') updateStats(state.history);
      },
      function(error) {
        console.error('[Firestore Listener Error]:', error);

        // Fallback: coba order by tanggal jika created_at bermasalah
        if (error.message && error.message.includes('created_at')) {
          console.warn('[Firestore] Falling back to order by tanggal');
          startListenerFallback(companyId, collectionName);
        } else {
          showToast('Gagal memuat data: ' + error.message, 'error');
        }
      }
    );
  } catch (e) {
    console.error('[Firestore] Query error:', e);
    startListenerFallback(companyId, collectionName);
  }
}

function startListenerFallback(companyId, collectionName) {
  if (state.unsubscribeListener) {
    state.unsubscribeListener();
    state.unsubscribeListener = null;
  }

  try {
    var query = state.db
      .collection(collectionName)
      .orderBy('tanggal', 'desc')
      .limit(100);

    state.unsubscribeListener = query.onSnapshot(
      function(snapshot) {
        state.history = snapshot.docs.map(function(doc) {
          return { id: doc.id, ...doc.data() };
        });
        if (typeof renderHistory === 'function') renderHistory(state.history);
        if (typeof updateStats === 'function') updateStats(state.history);
      },
      function(error) {
        console.error('[Firestore Fallback Error]:', error);
        // Last resort: tanpa order
        startListenerNoOrder(companyId, collectionName);
      }
    );
  } catch (e) {
    startListenerNoOrder(companyId, collectionName);
  }
}

function startListenerNoOrder(companyId, collectionName) {
  try {
    state.unsubscribeListener = state.db.collection(collectionName).limit(100).onSnapshot(
      function(snapshot) {
        state.history = snapshot.docs.map(function(doc) {
          return { id: doc.id, ...doc.data() };
        });
        if (typeof renderHistory === 'function') renderHistory(state.history);
        if (typeof updateStats === 'function') updateStats(state.history);
      },
      function(error) {
        console.error('[Firestore NoOrder Error]:', error);
        showToast('Gagal memuat data: ' + error.message, 'error');
      }
    );
  } catch (e) {
    console.error('[Firestore] All listener attempts failed:', e);
  }
}

// ==================== DATE FILTER ====================
function applyDateFilter() {
  if (!state.db) return;

  var companyId = getActiveCompanyId();
  if (!companyId) return;

  var collectionName = getCollectionName(companyId);
  var from = state.filterDateFrom;
  var to = state.filterDateTo;

  if (!from && !to) {
    startRealtimeListener();
    return;
  }

  console.log('[Firestore] Filter:', collectionName, from, '→', to);

  if (state.unsubscribeListener) {
    state.unsubscribeListener();
    state.unsubscribeListener = null;
  }

  try {
    var query = state.db.collection(collectionName);

    // Tanggal di Firestore format YYYY-MM-DD, jadi string comparison langsung benar
    if (from) query = query.where('tanggal', '>=', from);
    if (to) query = query.where('tanggal', '<=', to);
    query = query.orderBy('tanggal', 'desc');

    state.unsubscribeListener = query.limit(200).onSnapshot(
      function(snapshot) {
        state.history = snapshot.docs.map(function(doc) {
          return { id: doc.id, ...doc.data() };
        });
        if (typeof renderHistory === 'function') renderHistory(state.history);
        if (typeof updateStats === 'function') updateStats(state.history);
      },
      function(error) {
        console.error('[Filter Error]:', error);
        showToast('Filter gagal. Mungkin perlu composite index di Firestore.', 'warning');
        startRealtimeListener();
      }
    );
  } catch (e) {
    showToast('Filter error: ' + e.message, 'error');
    startRealtimeListener();
  }
}

window.clearDateFilter = function() {
  state.filterDateFrom = '';
  state.filterDateTo = '';
  var f = document.getElementById('filterDateFrom');
  var t = document.getElementById('filterDateTo');
  if (f) f.value = '';
  if (t) t.value = '';
  startRealtimeListener();
  showToast('Filter direset', 'info');
};

// ==================== DATA MAPPING ====================
function mapFormDataToFirestore(formData) {
  var data = Object.assign({}, formData);

  // ★ Tanggal tetap YYYY-MM-DD di Firestore (bagus untuk query & sort)
  // Formatting ke DD/MM/YYYY hanya untuk display (di utils.js)

  // Parse nominal ke number
  if (data.total_nominal !== undefined) {
    if (typeof data.total_nominal === 'string') {
      data.total_nominal = parseInt(data.total_nominal.replace(/[^\d-]/g, '')) || 0;
    }
  }

  // Parse nominal per item
  if (data.items && Array.isArray(data.items)) {
    data.items = data.items.map(function(item) {
      if (typeof item.nominal === 'string') {
        item.nominal = parseInt(item.nominal.replace(/[^\d-]/g, '')) || 0;
      }
      return item;
    });
  }

  // Trim strings
  ['lokasi', 'kode', 'no_invoice', 'jenis_pengajuan', 'status', 'dibayarkan_kepada', 'catatan_tambahan'].forEach(function(f) {
    if (data[f] && typeof data[f] === 'string') data[f] = data[f].trim();
  });

  if (!data.status) data.status = 'Pending';

  // Inject company info
  var cfg = getCurrentCompanyConfig();
  if (cfg) {
    data.company_id = cfg.id;
    data.company_name = cfg.name;
  }

  return data;
}

function buildSubmissionDocument(formData, options) {
  options = options || {};
  var doc = mapFormDataToFirestore(formData);

  doc.created_at = new Date().toISOString();
  doc.updated_at = new Date().toISOString();
  doc.timestamp = firebase.firestore.FieldValue.serverTimestamp();
  doc.source = options.source || 'FinanceSync Pro v3.5';
  doc.version = '3.5';

  // Signatures dari company config
  if (options.includeSignatures !== false) {
    var sigs = (typeof ConfigHelper !== 'undefined')
      ? ConfigHelper.getSignaturesForCompany(getActiveCompanyId())
      : DEFAULT_SIGNATORIES;
    Object.assign(doc, sigs);
  }

  // Sync & file flags
  doc.synced_to_sheets = false;
  doc.synced_at = null;
  doc.sheets_error = null;
  doc.google_drive_link = '';
  doc.google_drive_links = [];
  doc.nama_file = '';
  doc.file_id = '';
  doc.file_size = 0;
  doc.mime_type = '';
  doc.uploaded_at = null;
  doc.file_count = 0;

  if (!doc.items || !Array.isArray(doc.items)) doc.items = [];

  return doc;
}

// ==================== CRUD ====================
async function createSubmission(data) {
  var companyId = getActiveCompanyId();
  if (!companyId) throw new Error('No active company! Login dulu.');

  var collectionName = getCollectionName(companyId);
  var docData = buildSubmissionDocument(data);

  console.log('[Firestore] Creating in:', collectionName);

  var docRef = await state.db.collection(collectionName).add(docData);
  state.lastSavedDocId = docRef.id;
  state.lastFormData = data;

  console.log('[Firestore] Created:', docRef.id, 'in', collectionName);
  return docRef;
}

async function updateSubmission(docId, data) {
  var collectionName = getCollectionName(getActiveCompanyId());
  data.updated_at = new Date().toISOString();
  await state.db.collection(collectionName).doc(docId).update(data);
  console.log('[Firestore] Updated:', docId);
}

async function deleteSubmission(docId) {
  var collectionName = getCollectionName(getActiveCompanyId());
  await state.db.collection(collectionName).doc(docId).delete();
  console.log('[Firestore] Deleted:', docId);
}

async function deleteAllSubmissions() {
  var companyId = getActiveCompanyId();
  if (!companyId) throw new Error('No active company!');

  var collectionName = getCollectionName(companyId);
  var snapshot = await state.db.collection(collectionName).get();

  if (snapshot.empty) return;

  // Firestore batch max 500 operations
  var batchSize = 400;
  for (var i = 0; i < snapshot.docs.length; i += batchSize) {
    var batch = state.db.batch();
    var chunk = snapshot.docs.slice(i, i + batchSize);
    chunk.forEach(function(doc) { batch.delete(doc.ref); });
    await batch.commit();
  }

  console.log('[Firestore] Deleted all', snapshot.size, 'from', collectionName);
}

async function getSubmissionById(docId) {
  var collectionName = getCollectionName(getActiveCompanyId());
  var docSnap = await state.db.collection(collectionName).doc(docId).get();

  if (!docSnap.exists) return null;

  var data = docSnap.data();
  if (data.company_id && data.company_id !== getActiveCompanyId()) {
    console.warn('[Firestore] Access denied — wrong company');
    return null;
  }

  return { id: docSnap.id, ...data };
}

// ==================== AUTO INVOICE ====================
async function autoGenerateInvoice() {
  if (!state.db) return null;

  var cfg = getCurrentCompanyConfig();
  if (!cfg) return null;

  var now = new Date();
  var month = String(now.getMonth() + 1).padStart(2, '0');
  var year = String(now.getFullYear());
  var shortYear = year.slice(-2);

  var collectionName = getCollectionName(cfg.id);

  // Cari invoice bulan ini
  var snapshot;
  try {
    snapshot = await state.db.collection(collectionName)
      .where('no_invoice', '>=', cfg.no_invoice_prefix + '/' + month)
      .where('no_invoice', '<=', cfg.no_invoice_prefix + '/' + month + '/ZZZZ')
      .orderBy('no_invoice', 'desc')
      .limit(1)
      .get();
  } catch (e) {
    // Fallback tanpa filter — ambil semua lalu filter di client
    console.warn('[Firestore] Invoice query fallback:', e.message);
    snapshot = await state.db.collection(collectionName)
      .orderBy('created_at', 'desc')
      .limit(50)
      .get();
  }

  var maxNum = 0;
  var romanMonths = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  var roman = romanMonths[now.getMonth() + 1];

  snapshot.docs.forEach(function(doc) {
    var no = doc.data().no_invoice || '';
    // Cari pattern: PREFIX/ROMAN/YY/NNNN
    var parts = no.split('/');
    var lastPart = parts[parts.length - 1];
    var match = lastPart ? lastPart.match(/^(\d+)$/) : null;
    if (match) maxNum = Math.max(maxNum, parseInt(match[1]));
  });

  return cfg.no_invoice_prefix + '/' + roman + '/' + shortYear + '/' + String(maxNum + 1).padStart(4, '0');
}

// ==================== SMART SAVE ====================
async function smartSaveSubmission(formData, file) {
  var companyId = getActiveCompanyId();
  if (!companyId) {
    return { success: false, error: 'Login dulu!', requiresAuth: true };
  }

  try {
    // Jika ada file dan Apps Script terkonfigurasi, coba upload via drive-sync
    if (file && APPS_SCRIPT_CONFIG.isConfigured() && typeof saveSubmissionWithFile === 'function') {
      return await saveSubmissionWithFile(formData, file);
    }

    // Simpan langsung ke Firestore tanpa file
    var docRef = await createSubmission(formData);
    return { success: true, docId: docRef.id, message: 'Data tersimpan!', companyId: companyId };
  } catch (e) {
    console.error('[SmartSave Error]:', e);
    return { success: false, error: e.message };
  }
}

// ==================== EXPORT ====================
window.startRealtimeListener = startRealtimeListener;
window.applyDateFilter = applyDateFilter;
window.createSubmission = createSubmission;
window.updateSubmission = updateSubmission;
window.deleteSubmission = deleteSubmission;
window.deleteAllSubmissions = deleteAllSubmissions;
window.getSubmissionById = getSubmissionById;
window.autoGenerateInvoice = autoGenerateInvoice;
window.smartSaveSubmission = smartSaveSubmission;
window.mapFormDataToFirestore = mapFormDataToFirestore;
window.buildSubmissionDocument = buildSubmissionDocument;

console.log('%c firestore-db.js loaded | Dynamic collections via getCollectionName()', 'color:#60a5fa;');
