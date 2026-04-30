/**
 * ============================================
 * FinanceSync Pro v3.5 - Firestore Operations (FIXED)
 * ============================================
 * PERUBAHAN KRITIS:
 * - Ganti 'submissions' → getCollectionName() 
 * - Sekarang NMSA pakai 'Invoice-NMSA', IPN pakai 'Invoice-IPN'
 */

// ==================== REALTIME LISTENER ====================
function startRealtimeListener() {
  if (state.unsubscribeListener) state.unsubscribeListener();
  
  const companyId = getActiveCompanyId();
  if (!companyId) {
    console.warn('[Firestore] No active company!');
    state.history = [];
    if (typeof renderHistory === 'function') renderHistory();
    return;
  }
  
  // ★ PERUBAHAN: Pakai getCollectionName() bukan hardcoded 'submissions'!
  const collectionName = getCollectionName(companyId);
  console.log(`[Firestore] Starting listener for: ${collectionName}`);
  
  const query = state.db
    .collection(collectionName)  // ← ★ FIX INI!
    .orderBy('timestamp', 'desc')
    .limit(50);
  
  state.unsubscribeListener = query.onSnapshot(
    snapshot => {
      console.log(`[Firestore] Snapshot: ${snapshot.size} documents`);
      state.history = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        google_drive_link: doc.data().google_drive_link || '',
        nama_file: doc.data().nama_file || ''
      }));
      
      if (typeof renderHistory === 'function') renderHistory(state.history);
      if (typeof updateStats === 'function') updateStats(state.history);
    },
    error => {
      console.error('[Firestore Listener Error]:', error);
      showToast('Listener error: ' + error.message, 'error');
    }
  );
}

// ==================== DATE FILTER LISTENER ====================
function applyDateFilter() {
  if (!state.db) return;
  
  const companyId = getActiveCompanyId();
  if (!companyId) {
    console.warn('[Firestore] No active company!');
    return;
  }
  
  // ★ PERUBAHAN: Pakai getCollectionName()!
  const collectionName = getCollectionName(companyId);
  const from = state.filterDateFrom;
  const to = state.filterDateTo;
  
  if (!from && !to) { 
    startRealtimeListener(); 
    return; 
  }
  
  console.log(`[Firestore] Filter ${collectionName}:`, from, 'to', to);
  
  let query = state.db.collection(collectionName);  // ← ★ FIX!
  
  if (from) query = query.where('tanggal', '>=', from);
  if (to) query = query.where('tanggal', '<=', to);
  query = query.orderBy('tanggal', 'desc');
  
  if (state.unsubscribeListener) state.unsubscribeListener();
  
  state.unsubscribeListener = query.limit(100).onSnapshot(
    snapshot => {
      state.history = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        google_drive_link: doc.data().google_drive_link || '',
        nama_file: doc.data().nama_file || ''
      }));
      
      if (typeof renderHistory === 'function') renderHistory(state.history);
      if (typeof updateStats === 'function') updateStats(state.history);
    },
    error => console.error('[Filter Error]:', error)
  );
}

window.clearDateFilter = function() {
  state.filterDateFrom = '';
  state.filterDateTo = '';
  const f = document.getElementById('filterDateFrom');
  const t = document.getElementById('filterDateTo');
  if (f) { f.value = ''; state.filterDateFrom = ''; }
  if (t) { t.value = ''; state.filterDateTo = ''; }
  startRealtimeListener();
  showToast('Filter direset', 'info');
};

// ==================== DATA MAPPING ====================
function mapFormDataToFirestore(formData) {
  var data = Object.assign({}, formData);
  
  // Format tanggal
  if (data.tanggal?.includes('-')) {
    const parts = data.tanggal.split('-');
    if (parts.length === 3) data.tanggal = parts[2] + '/' + parts[1] + '/' + parts[0];
  }
  
  // Format nominal
  if (data.total_nominal !== undefined) {
    if (typeof data.total_nominal === 'string') {
      data.total_nominal = parseInt(data.total_nominal.replace(/[^\d-]/g, '')) || 0;
    }
  }
  
  // Trim strings
  ['lokasi', 'kode', 'no_invoice', 'jenis_pengajuan', 'status', 'dibayarkan_kepada', 'catatan_tambahan']
    .forEach(f => { if (data[f]?.trim) data[f] = data[f].trim(); });
  
  if (!data.status) data.status = 'Pending';
  
  // ★ Inject Company Info
  const cfg = getCurrentCompanyConfig();
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
  
  // Signatures dari company
  if (options.includeSignatures !== false) {
    const sigs = (typeof ConfigHelper !== 'undefined') 
      ? ConfigHelper.getSignaturesForCompany(getActiveCompanyId()) 
      : DEFAULT_SIGNATORIES;
    Object.assign(doc, sigs);
  }
  
  // Sync flags
  doc.synced_to_sheets = false;
  doc.synced_at = null;
  doc.sheets_error = null;
  doc.google_drive_link = '';
  doc.nama_file = '';
  doc.file_id = '';
  doc.file_size = 0;
  doc.mime_type = '';
  doc.uploaded_at = null;
  
  if (!doc.items || !Array.isArray(doc.items)) doc.items = [];
  
  return doc;
}

// ==================== CRUD OPERATIONS ====================
async function createSubmission(data) {
  const companyId = getActiveCompanyId();
  if (!companyId) throw new Error('No active company! Login dulu.');
  
  // ★ PERUBAHAN: Pakai getCollectionName()!
  const collectionName = getCollectionName(companyId);
  const docData = buildSubmissionDocument(data);
  
  console.log(`[Firestore] Creating document in: ${collectionName}`);
  
  const docRef = await state.db.collection(collectionName).add(docData);
  state.lastSavedDocId = docRef.id;
  state.lastFormData = data;
  
  console.log(`[Firestore] ✅ Created: ${docRef.id} in ${collectionName}`);
  return docRef;
}

async function updateSubmission(docId, data) {
  await verifyDocumentOwnership(docId);
  data.updated_at = new Date().toISOString();
  
  // ★ PERUBAHAN: Pakai getCollectionName()!
  const collectionName = getCollectionName(getActiveCompanyId());
  await state.db.collection(collectionName).doc(docId).update(data);
  console.log('[Firestore] ✅ Updated:', docId);
}

async function deleteSubmission(docId) {
  await verifyDocumentOwnership(docId);
  const collectionName = getCollectionName(getActiveCompanyId());
  await state.db.collection(collectionName).doc(docId).delete();
  console.log('[Firestore] ✅ Deleted:', docId);
}

async function deleteAllSubmissions() {
  const companyId = getActiveCompanyId();
  if (!companyId) throw new Error('No active company!');
  
  // ★ PERUBAHAN: Pakai getCollectionName()!
  const collectionName = getCollectionName(companyId);
  const snapshot = await state.db.collection(collectionName).get();
  
  const batch = state.db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  
  console.log(`[Firestore] ✅ Deleted all ${snapshot.size} docs from ${collectionName}`);
}

async function getSubmissionById(docId) {
  const collectionName = getCollectionName(getActiveCompanyId());
  const docSnap = await state.db.collection(collectionName).doc(docId).get();
  
  if (!docSnap.exists) return null;
  
  const data = docSnap.data();
  // Verify ownership
  if (data.company_id && data.company_id !== getActiveCompanyId()) {
    console.warn('[Firestore] Access denied - wrong company');
    return null;
  }
  
  return { id: docSnap.id, ...data };
}

async function checkDuplicate(data) {
  if (!state.db) return false;
  
  const companyId = getActiveCompanyId();
  if (!companyId) return false;
  
  // ★ PERUBAHAN: Pakai getCollectionName()!
  const collectionName = getCollectionName(companyId);
  const normalized = mapFormDataToFirestore(data);
  
  const snapshot = await state.db.collection(collectionName)
    .where('company_id', '==', normalized.company_id)
    .where('tanggal', '==', normalized.tanggal)
    .where('total_nominal', '==', normalized.total_nominal)
    .get();
  
  return !snapshot.empty;
}

// ★ AUTO-GENERATE INVOICE (Per Company!)
async function autoGenerateInvoice() {
  if (!state.db) return null;
  
  const cfg = getCurrentCompanyConfig();
  if (!cfg) return null;
  
  const now = new Date();
  const startDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const endDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-31`;
  
  // ★ PERUBAHAN: Query di collection yang benar!
  const collectionName = getCollectionName(cfg.id);
  const snapshot = await state.db.collection(collectionName)
    .where('tanggal', '>=', startDate)
    .where('tanggal', '<=', endDate)
    .orderBy('tanggal', 'desc')
    .get();
  
  let maxNum = 0;
  snapshot.docs.forEach(doc => {
    const no = doc.data().no_invoice || '';
    const parts = no.split('/');
    const match = parts[parts.length-1]?.match(/^(\d+)$/);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1]));
  });
  
  const prefix = cfg.no_invoice_prefix;
  const romanMonths = ['','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
  const roman = romanMonths[now.getMonth()+1];
  const num = String(maxNum+1).padStart(4,'0');
  
  return `${prefix}/${roman}/${now.getFullYear()%100}/${num}`;
}

// ==================== SMART SAVE ====================
async function smartSaveSubmission(formData, file) {
  const companyId = getActiveCompanyId();
  if (!companyId) {
    return { success: false, error: 'No active company! Login dulu.', requiresAuth: true };
  }
  
  try {
    if (file && typeof isAppsScriptConfigured === 'function' && isAppsScriptConfigured()) {
      if (typeof saveSubmissionWithFile === 'function') {
        return await saveSubmissionWithFile(formData, file);
      }
    }
    
    const docRef = await createSubmission(formData);
    return { success: true, docId: docRef.id, message: 'Data tersimpan!', companyId };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ==================== OWNERSHIP VERIFICATION ====================
async function verifyDocumentOwnership(docId) {
  if (!state.db) return;
  const companyId = getActiveCompanyId();
  if (!companyId) return;
  
  try {
    const collectionName = getCollectionName(companyId);
    const docSnap = await state.db.collection(collectionName).doc(docId).get();
    
    if (!docSnap.exists) throw new Error('Document tidak ditemukan!');
    
    const data = docSnap.data();
    if (data.company_id && data.company_id !== companyId) {
      throw new Error(`Access denied! Document milik: ${data.company_id}`);
    }
  } catch (e) {
    if (e.message.includes('denied') || e.message.includes('tidak ditemukan')) throw e;
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
window.checkDuplicate = checkDuplicate;
window.autoGenerateInvoice = autoGenerateInvoice;
window.smartSaveSubmission = smartSaveSubmission;
window.verifyDocumentOwnership = verifyDocumentOwnership;
window.mapFormDataToFirestore = mapFormDataToFirestore;
window.buildSubmissionDocument = buildSubmissionDocument;

console.log('%c🗄️ firestore-db.js v3.5 loaded | Using dynamic collection names', 'color:#60a5fa;');
