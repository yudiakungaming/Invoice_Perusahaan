/**
 * FinanceSync Pro v3.5 - Configuration & Global State
 * Semua config di-hardcode — tidak perlu setup modal
 */

// ==================== CONFIGURATION KEYS (hanya untuk session) ====================
const CONFIG_KEYS = {
  APPS_SCRIPT_URL: 'financesync_apps_script_url_v35',
  CURRENT_COMPANY_ID: 'financesync_current_company_id',
  CURRENT_USER_SESSION: 'financesync_user_session_v35'
};

// ==================== GLOBAL STATE ====================
const state = {
  isConnected: false,
  isConnecting: true,
  db: null,
  history: [],
  currentTab: 'Lunas',
  lastFormData: null,
  lastSavedDocId: null,
  items: [{ ket: '', qty: '', nominal: 0, keterangan: '' }],
  selectedFiles: [],
  unsubscribeListener: null,
  driveSyncListeners: {},
  pollingInterval: null,
  isSyncing: false,
  appsScriptUrl: '',
  editingDocId: null,
  pendingDeleteId: null,
  pendingDeleteKode: null,
  filterDateFrom: '',
  filterDateTo: '',
  driveIntegration: {
    isUploading: false,
    uploadProgress: 0,
    lastUploadedFile: null,
    driveLink: '',
    uploadError: null
  },
  auth: {
    currentUser: null,
    currentCompanyId: null,
    currentCompanyData: null,
    isAuthenticated: false
  }
};

let elements = {};
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
// FIREBASE CONFIG — HARDCODED, TIDAK PERLU SETUP
// ═══════════════════════════════════════════════════════════════
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAc78YtHdF6uaE5mr4inU8xG4EYDU5FWVY",
  authDomain: "ai-devender-7b55c.firebaseapp.com",
  databaseURL: "https://ai-devender-7b55c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ai-devender-7b55c",
  storageBucket: "ai-devender-7b55c.firebasestorage.app",
  messagingSenderId: "11961460704",
  appId: "1:11961460704:web:f6ca0b3a1e329856486d85"
};

// ═══════════════════════════════════════════════════════════════
// APPS SCRIPT URL — HARDCODED
// ═══════════════════════════════════════════════════════════════
const HARDCODED_DRIVE_URL = "https://script.google.com/macros/s/AKfycbzl7mTGYp5qJL0t-0fiCw56BM2yX3bNta4S_Y1esyVGHSl_iEAMtKLnpBNntjGzB4E5/exec";

// ═══════════════════════════════════════════════════════════════
// MULTI-COMPANY CONFIG
// Setiap company punya collection Firestore sendiri
// ═══════════════════════════════════════════════════════════════
const COMPANY_CONFIG = {
  nmsa: {
    id: 'nmsa',
    code: 'NMSA',
    name: 'PT Nusantara Mineral Sukses Abadi',
    displayName: 'Invoice-NMSA',
    collectionName: 'Invoice-NMSA',
    no_invoice_prefix: 'BKK-NMSA',
    branding: { primaryColor: '#2563eb', secondaryColor: '#1e40af', logoUrl: '', icon: '🏢' },
    defaultSignatures: {
      dibuat_oleh: 'Nur Wahyudi',
      disetujui_oleh: 'Harijon',
      keuangan: 'Andi Dhiya Salsabila',
      dir_keuangan: 'Harijon',
      direktur_utama: 'H. Andi Nursyam Halid',
      accounting: 'Sri Ekowati'
    },
    defaults: { lokasi: 'Lt. 1', kode: 'LP', jenis_pengajuan: 'Biaya Operasional' }
  },
  ipn: {
    id: 'ipn',
    code: 'IPN',
    name: 'PT Industri Padi Nusantara',
    displayName: 'Invoice-IPN',
    collectionName: 'Invoice-IPN',
    no_invoice_prefix: 'BKK-IPN',
    branding: { primaryColor: '#dc2626', secondaryColor: '#991b1b', logoUrl: '', icon: '🏭' },
    defaultSignatures: {
      dibuat_oleh: 'Admin IPN',
      disetujui_oleh: 'Manager IPN',
      keuangan: 'Finance IPN',
      dir_keuangan: 'Director IPN',
      direktur_utama: 'Direktur IPN',
      accounting: 'Accounting IPN'
    },
    defaults: { lokasi: 'Lt. 2', kode: 'LP', jenis_pengajuan: 'Biaya Operasional' }
  }
};

const COMPANY_IDS = ['nmsa', 'ipn'];

// ==================== COMPANY HELPERS ====================
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

function getCurrentUser() {
  return state.auth.currentUser;
}

function isLoggedIn() {
  return state.auth.isAuthenticated && state.auth.currentUser !== null;
}

function getActiveCompanyId() {
  return state.auth.currentCompanyId;
}

function setCurrentCompany(companyId) {
  if (COMPANY_CONFIG[companyId]) {
    state.auth.currentCompanyId = companyId;
    state.auth.currentCompanyData = COMPANY_CONFIG[companyId];
    localStorage.setItem(CONFIG_KEYS.CURRENT_COMPANY_ID, companyId);
    console.log('Company aktif:', COMPANY_CONFIG[companyId].displayName, '| Collection:', COMPANY_CONFIG[companyId].collectionName);
    return true;
  }
  console.error('Company ID tidak valid:', companyId);
  return false;
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
    return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════
// UPLOAD CONFIG
// ═══════════════════════════════════════════════════════════════
const UPLOAD_CONFIG = {
  maxSizeBytes: 30 * 1024 * 1024,
  maxSizeDisplay: '30MB',
  warningSizeBytes: 10 * 1024 * 1024,
  warningSizeDisplay: '10MB',
  allowedExtensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.zip', '.txt', '.csv'],
  drive: { defaultFolderName: 'Submission_Files_FinanceSync', folderId: '' },
  validation: { maxFileNameLength: 255, blockedPatterns: [/\.\./, /[<>:"|?*]/] }
};

// ═══════════════════════════════════════════════════════════════
// APPS SCRIPT CONFIG — pakai hardcoded, fallback ke localStorage
// ═══════════════════════════════════════════════════════════════
const APPS_SCRIPT_CONFIG = {
  getUrl: () => HARDCODED_DRIVE_URL || localStorage.getItem(CONFIG_KEYS.APPS_SCRIPT_URL) || '',
  setUrl: (url) => {
    if (url?.trim()) {
      localStorage.setItem(CONFIG_KEYS.APPS_SCRIPT_URL, url.trim());
      state.appsScriptUrl = url.trim();
      return true;
    }
    return false;
  },
  isConfigured: () => {
    const url = APPS_SCRIPT_CONFIG.getUrl();
    return !!url && url.includes('script.google.com');
  },
  actions: { SAVE_SUBMISSION: 'save', SYNC_SHEET: 'sync', UPLOAD_ONLY: 'upload_only', TEST_CONNECTION: 'test_connection' },
  timeout: { normal: 30000, upload: 120000, largeFile: 300000 }
};

// Inisialisasi appsScriptUrl dari hardcoded value
state.appsScriptUrl = HARDCODED_DRIVE_URL;

// ═══════════════════════════════════════════════════════════════
// CONFIG HELPERS
// ═══════════════════════════════════════════════════════════════
const ConfigHelper = {
  validateFile: (file) => {
    if (!file) return { valid: false, error: 'Tidak ada file!' };
    if (file.size > UPLOAD_CONFIG.maxSizeBytes) return { valid: false, error: 'File terlalu besar! Maks ' + UPLOAD_CONFIG.maxSizeDisplay };
    const ext = '.' + file.name.toLowerCase().split('.').pop();
    if (!UPLOAD_CONFIG.allowedExtensions.includes(ext)) return { valid: false, error: 'Tipe tidak diizinkan: ' + ext };
    return { valid: true, error: null };
  },

  formatFileSize: (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  generateInvoiceNumber: (companyId, nextNumber) => {
    const config = getCompanyConfig(companyId);
    if (!config) return 'ERROR';
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const num = String(nextNumber).padStart(5, '0');
    return config.no_invoice_prefix + '/' + month + '/' + year + '/' + num;
  },

  getSignaturesForCompany: (companyId) => {
    const config = getCompanyConfig(companyId);
    return (config && config.defaultSignatures) ? config.defaultSignatures : DEFAULT_SIGNATORIES;
  },

  getDefaultsForCompany: (companyId) => {
    const config = getCompanyConfig(companyId);
    return (config && config.defaults) ? { ...config.defaults } : { lokasi: '', kode: 'LP', jenis_pengajuan: '' };
  }
};

// ==================== GLOBAL EXPORTS ====================
window.CONFIG_KEYS = CONFIG_KEYS;
window.state = state;
window.elements = elements;
window.DEFAULT_SIGNATORIES = DEFAULT_SIGNATORIES;
window.FIREBASE_CONFIG = FIREBASE_CONFIG;
window.UPLOAD_CONFIG = UPLOAD_CONFIG;
window.APPS_SCRIPT_CONFIG = APPS_SCRIPT_CONFIG;
window.ConfigHelper = ConfigHelper;
window.COMPANY_CONFIG = COMPANY_CONFIG;
window.COMPANY_IDS = COMPANY_IDS;
window.getCompanyConfig = getCompanyConfig;
window.getCurrentCompanyConfig = getCurrentCompanyConfig;
window.getCurrentUser = getCurrentUser;
window.isLoggedIn = isLoggedIn;
window.getActiveCompanyId = getActiveCompanyId;
window.setCurrentCompany = setCurrentCompany;
window.clearCurrentCompany = clearCurrentCompany;
window.initializeCompanySession = initializeCompanySession;
window.getCollectionName = getCollectionName;

// Auto-init session
initializeCompanySession();

console.log('%c config.js loaded | Project: ' + FIREBASE_CONFIG.projectId + ' | Drive: ' + (APPS_SCRIPT_CONFIG.isConfigured() ? 'OK' : 'MISSING'), 'color:#34a85c;');
