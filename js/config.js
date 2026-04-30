/**
 * ============================================
 * FinanceSync Pro v3.5 - Configuration & Global State (FIXED)
 * ============================================
 * PERUBAHAN:
 * - Fix collection names agar konsisten dengan kebutuhan multi-company
 * - Tambahkan helper getCollectionName()
 * - Pastikan state terintegrasi dengan baik
 */

// ==================== CONFIGURATION KEYS ====================
const CONFIG_KEYS = {
  FIREBASE_CONFIG: 'financesync_firebase_config_v35',
  APPS_SCRIPT_URL: 'financesync_apps_script_url_v35',
  CURRENT_COMPANY_ID: 'financesync_current_company_id',
  CURRENT_USER_SESSION: 'financesync_user_session_v35'
};

// ==================== GLOBAL STATE ====================
const state = {
  // Firebase Connection State
  isConnected: false,
  isConnecting: true,
  
  // Database Reference
  db: null,
  
  // Application Data
  history: [],
  currentTab: 'Lunas',
  lastFormData: null,
  lastSavedDocId: null,
  
  // Form Items State
  items: [{ ket: '', qty: '', nominal: 0, keterangan: '' }],
  
  // File Upload State
  selectedFiles: [],
  
  // Listener Management
  unsubscribeListener: null,
  driveSyncListeners: {},
  pollingInterval: null,
  
  // Sync State
  isSyncing: false,
  appsScriptUrl: localStorage.getItem(CONFIG_KEYS.APPS_SCRIPT_URL) || '',
  
  // Edit Mode State
  editingDocId: null,
  pendingDeleteId: null,
  pendingDeleteKode: null,
  
  // Filter State
  filterDateFrom: '',
  filterDateTo: '',
  
  // Google Drive Integration State
  driveIntegration: {
    isUploading: false,
    uploadProgress: 0,
    lastUploadedFile: null,
    driveLink: '',
    uploadError: null
  },
  
  // ★ MULTI-COMPANY STATE (v3.5)
  auth: {
    currentUser: null,
    currentCompanyId: null,
    currentCompanyData: null,
    isAuthenticated: false
  }
};

// ==================== DOM ELEMENTS CACHE ====================
let elements = {};

// ==================== TOAST TIMEOUT ====================
let toastTimeout = null;

// ==================== DEFAULT SIGNATORIES ====================
const DEFAULT_SIGNATORIES = {
  dibuat_oleh: 'Nur Wahyudi',
  disetujui_oleh: 'Harijon',
  keuangan: 'Andi Dhiya Salsabila',
  dir_keuangan: 'Harijon',
  direktur_utama: 'H. Andi Nursyam Halid',
  accounting: 'Sri Ekowati'
};

// ═══════════════════════════════════════════════════════════════
// ★★★ MULTI-COMPANY CONFIGURATION (FIXED v3.5) ★★★
// ═══════════════════════════════════════════════════════════════

/**
 * COMPANY_CONFIG - Konfigurasi untuk setiap perusahaan
 * 
 * ⚠️ PENTING: Setiap company punya koleksi Firestore SENDIRI!
 * - NMSA → Collection: 'Invoice-NMSA'
 * - IPN  → Collection: 'Invoice-IPN'
 */
const COMPANY_CONFIG = {
  nmsa: {
    id: 'nmsa',
    code: 'NMSA',
    name: 'PT Nusantara Mineral Sukses Abadi',
    displayName: 'Invoice-NMSA',
    
    // ★ NAMA KOLEKSI FIRESTORE UNTUK COMPANY INI
    collectionName: 'Invoice-NMSA',  // ← PENTING!
    
    no_invoice_prefix: 'BKK-NMSA',
    
    branding: {
      primaryColor: '#2563eb',
      secondaryColor: '#1e40af',
      logoUrl: '',
      icon: '🏢'
    },
    
    defaultSignatures: {
      dibuat_oleh: 'Nur Wahyudi',
      disetujui_oleh: 'Harijon',
      keuangan: 'Andi Dhiya Salsabila',
      dir_keuangan: 'Harijon',
      direktur_utama: 'H. Andi Nursyam Halid',
      accounting: 'Sri Ekowati'
    },
    
    defaults: {
      lokasi: 'Lt. 1',
      kode: 'LP',
      jenis_pengajuan: 'Biaya Operasional'
    }
  },
  
  ipn: {
    id: 'ipn',
    code: 'IPN',
    name: 'PT Industri Padi Nusantara',
    displayName: 'Invoice-IPN',
    
    // ★ NAMA KOLEKSI FIRESTORE UNTUK COMPANY INI
    collectionName: 'Invoice-IPN',  // ← PENTING!
    
    no_invoice_prefix: 'BKK-IPN',
    
    branding: {
      primaryColor: '#dc2626',
      secondaryColor: '#991b1b',
      logoUrl: '',
      icon: '🏭'
    },
    
    defaultSignatures: {
      dibuat_oleh: 'Admin IPN',
      disetujui_oleh: 'Manager IPN',
      keuangan: 'Finance IPN',
      dir_keuangan: 'Director IPN',
      direktur_utama: 'Direktur IPN',
      accounting: 'Accounting IPN'
    },
    
    defaults: {
      lokasi: 'Lt. 2',
      kode: 'LP',
      jenis_pengajuan: 'Biaya Operasional'
    }
  }
};

const COMPANY_IDS = ['nmsa', 'ipn'];

/**
 * ★ BARU: Get collection name untuk company aktif
 * Ini yang membuat setiap company punya data terpisah!
 * 
 * @param {string} companyId - ID company ('nmsa' atau 'ipn')
 * @returns {string} Nama koleksi Firestore
 */
function getCollectionName(companyId) {
  const id = companyId || state.auth.currentCompanyId || 'nmsa';
  const config = COMPANY_CONFIG[id];
  
  if (!config) {
    console.warn('[Config] Company not found:', id, '- fallback to Invoice-NMSA');
    return 'Invoice-NMSA';
  }
  
  return config.collectionName;
}

function getCompanyConfig(companyId) {
  return COMPANY_CONFIG[companyId] || null;
}

function getCurrentCompanyConfig() {
  const companyId = state.auth.currentCompanyId;
  return companyId ? COMPANY_CONFIG[companyId] : null;
}

function setCurrentCompany(companyId) {
  if (COMPANY_CONFIG[companyId]) {
    state.auth.currentCompanyId = companyId;
    state.auth.currentCompanyData = COMPANY_CONFIG[companyId];
    localStorage.setItem(CONFIG_KEYS.CURRENT_COMPANY_ID, companyId);
    console.log(`✅ Company aktif: ${COMPANY_CONFIG[companyId].displayName} (Collection: ${COMPANY_CONFIG[companyId].collectionName})`);
    return true;
  } else {
    console.error(`❌ Company ID tidak valid: ${companyId}`);
    return false;
  }
}

function clearCurrentCompany() {
  state.auth.currentCompanyId = null;
  state.auth.currentCompanyData = null;
  state.auth.currentUser = null;
  state.auth.isAuthenticated = false;
  localStorage.removeItem(CONFIG_KEYS.CURRENT_COMPANY_ID);
  localStorage.removeItem(CONFIG_KEYS.CURRENT_USER_SESSION);
}

function initializeCompanySession() {
  const savedCompanyId = localStorage.getItem(CONFIG_KEYS.CURRENT_COMPANY_ID);
  if (savedCompanyId && COMPANY_CONFIG[savedCompanyId]) {
    state.auth.currentCompanyId = savedCompanyId;
    state.auth.currentCompanyData = COMPANY_CONFIG[savedCompanyId];
    console.log(`📦 Session ditemukan: ${COMPANY_CONFIG[savedCompanyId].displayName}`);
    return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════
// FIREBASE CONFIGURATION
// ═══════════════════════════════════════════════════════════════
const FIREBASE_CONFIG = {
  projectId: 'ai-devender-7b55c',
  
  // ⚠️ TIDAK lagi pakai 'submissions' sebagai default!
  // Setiap company punya collection sendiri via getCollectionName()
  
  fields: {
    tanggal: 'tanggal',
    timestamp: 'timestamp',
    lokasi: 'lokasi',
    kode: 'kode',
    no_invoice: 'no_invoice',
    jenis_pengajuan: 'jenis_pengajuan',
    total_nominal: 'total_nominal',
    status: 'status',
    dibayarkan_kepada: 'dibayarkan_kepada',
    catatan_tambahan: 'catatan_tambahan',
    companyId: 'company_id',
    companyName: 'company_name',
    googleDriveLink: 'google_drive_link',
    fileName: 'nama_file',
    fileId: 'file_id',
    fileSize: 'file_size',
    mimeType: 'mime_type',
    uploadedAt: 'uploaded_at'
  }
};

// ═══════════════════════════════════════════════════════════════
// UPLOAD CONFIGURATION
// ═══════════════════════════════════════════════════════════════
const UPLOAD_CONFIG = {
  maxSizeBytes: 30 * 1024 * 1024,
  maxSizeDisplay: '30MB',
  warningSizeBytes: 10 * 1024 * 1024,
  warningSizeDisplay: '10MB',
  
  allowedMimeTypes: [
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'text/plain', 'text/csv', 'application/zip'
  ],
  
  allowedExtensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
                     '.jpg', '.jpeg', '.png', '.gif', '.webp', '.zip', '.txt', '.csv'],
  
  drive: { defaultFolderName: 'Submission_Files_FinanceSync', folderId: '' },
  
  validation: {
    maxFileNameLength: 255,
    blockedPatterns: [/\.\./, /[<>:"|?*]/, /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i]
  }
};

// ═══════════════════════════════════════════════════════════════
// APPS SCRIPT CONFIGURATION
// ═══════════════════════════════════════════════════════════════
const APPS_SCRIPT_CONFIG = {
  getUrl: () => localStorage.getItem(CONFIG_KEYS.APPS_SCRIPT_URL) || '',
  setUrl: (url) => {
    if (url?.trim()) {
      localStorage.setItem(CONFIG_KEYS.APPS_SCRIPT_URL, url.trim());
      state.appsScriptUrl = url.trim();
      return true;
    }
    return false;
  },
  clearUrl: () => {
    localStorage.removeItem(CONFIG_KEYS.APPS_SCRIPT_URL);
    state.appsScriptUrl = '';
  },
  isConfigured: () => {
    const url = APPS_SCRIPT_CONFIG.getUrl();
    return !!url && url.includes('script.google.com');
  },
  
  actions: { SAVE_SUBMISSION: 'save', SYNC_SHEET: 'sync', UPLOAD_ONLY: 'upload_only', TEST_CONNECTION: 'test_connection' },
  timeout: { normal: 30000, upload: 120000, largeFile: 300000 }
};

// ═══════════════════════════════════════════════════════════════
// CONFIG HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════
const ConfigHelper = {
  validateFile: (file) => {
    if (!file) return { valid: false, error: 'Tidak ada file!' };
    if (file.size > UPLOAD_CONFIG.maxSizeBytes) {
      return { valid: false, error: `File terlalu besar! Maks ${UPLOAD_CONFIG.maxSizeDisplay}` };
    }
    const ext = '.' + file.name.toLowerCase().split('.').pop();
    if (!UPLOAD_CONFIG.allowedExtensions.includes(ext)) {
      return { valid: false, error: `Tipe tidak diizinkan: ${ext}` };
    }
    return { valid: true, error: null };
  },
  
  formatFileSize: (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },
  
  getMimeTypeFromExtension: (filename) => {
    const ext = filename.toLowerCase().split('.').pop();
    const mimeMap = {
      pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
      txt: 'text/plain', csv: 'text/csv', zip: 'application/zip'
    };
    return mimeMap[ext] || 'application/octet-stream';
  },
  
  checkAppsScriptReady: () => {
    if (!APPS_SCRIPT_CONFIG.isConfigured()) {
      return { ready: false, message: '❌ Apps Script URL belum dikonfigurasi!' };
    }
    return { ready: true, message: '✅ Apps Script siap' };
  },
  
  // ★ Helper untuk generate nomor invoice sesuai company
  generateInvoiceNumber: (companyId, nextNumber) => {
    const config = getCompanyConfig(companyId);
    if (!config) return 'UNKNOWN-ERROR';
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const num = String(nextNumber).padStart(5, '0');
    return `${config.no_invoice_prefix}/${month}/${year}/${num}`;
  },
  
  getSignaturesForCompany: (companyId) => {
    const config = getCompanyConfig(companyId);
    return (config && config.defaultSignatures) ? config.defaultSignatures : DEFAULT_SIGNATORIES;
  },
  
  getDefaultsForCompany: (companyId) => {
    const config = getCompanyConfig(companyId);
    return (config && config.defaults) ? { ...config.defaults } : { lokasi: '', kode: 'LP', jenis_pengajuan: '' };
  },
  
  hasAccessToCompany: (userEmail, companyId) => {
    const config = getCompanyConfig(companyId);
    if (!config) return false;
    if (config.testCredentials?.email === userEmail) return true;
    return false;
  }
};

// ==================== EXPORT FOR GLOBAL ACCESS ====================
window.CONFIG_KEYS = CONFIG_KEYS;
window.state = state;
window.elements = elements;
window.DEFAULT_SIGNATORIES = DEFAULT_SIGNATORIES;
window.FIREBASE_CONFIG = FIREBASE_CONFIG;
window.UPLOAD_CONFIG = UPLOAD_CONFIG;
window.APPS_SCRIPT_CONFIG = APPS_SCRIPT_CONFIG;
window.ConfigHelper = ConfigHelper;

// ★ EXPORT MULTI-COMPANY
window.COMPANY_CONFIG = COMPANY_CONFIG;
window.COMPANY_IDS = COMPANY_IDS;
window.getCompanyConfig = getCompanyConfig;
window.getCurrentCompanyConfig = getCurrentCompanyConfig;
window.setCurrentCompany = setCurrentCompany;
window.clearCurrentCompany = clearCurrentCompany;
window.initializeCompanySession = initializeCompanySession;
window.getCollectionName = getCollectionName;  // ← ★ PENTING!

// Auto-initialize company session
initializeCompanySession();

console.log('%c📁 config.js v3.5 loaded | Collections: Invoice-NMSA, Invoice-IPN', 'color:#34a85c;');
