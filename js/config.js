/**
 * ============================================
 * FinanceSync Pro v3.3 - Configuration & Global State
 * ============================================
 * File ini berisi semua konfigurasi dan variabel global
 * yang digunakan di seluruh aplikasi.
 * 
 * Version: 3.4.0
 * Update: Added Multi-Company Support (NMSA & IPN)
 * Date: April 2026
 * 
 * ★ PERUBAHAN: Sekarang mendukung 2 perusahaan dalam 1 aplikasi!
 *    - PT Nusantara Mineral Sukses Abadi (NMSA)
 *    - PT Industri Padi Nusantara (IPN)
 */

// ==================== CONFIGURATION KEYS ====================
const CONFIG_KEYS = {
  FIREBASE_CONFIG: 'financesync_firebase_config_v34',
  APPS_SCRIPT_URL: 'financesync_apps_script_url_v34',
  
  // ★ TAMBAHAN BARU: Keys untuk pengaturan upload
  UPLOAD_MAX_SIZE: 'financesync_upload_max_size_v34',
  UPLOAD_ALLOWED_TYPES: 'financesync_upload_allowed_types_v34',
  
  // ★★★ TAMBAHAN BARU (v3.4): Multi-Company Session ★★★
  CURRENT_COMPANY_ID: 'financesync_current_company_id',
  CURRENT_USER_SESSION: 'financesync_user_session'
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
  
  // ═══════════════════════════════════════════════════════════════
  // ★ TAMBAHAN BARU: Google Drive Integration State
  // ═══════════════════════════════════════════════════════════════
  driveIntegration: {
    isUploading: false,
    uploadProgress: 0,
    lastUploadedFile: null,
    driveLink: '',
    uploadError: null
  },
  
  // ═══════════════════════════════════════════════════════════════
  // ★★★ TAMBAHAN BARU (v3.4): Multi-Company State ★★★
  //    Untuk melacak company yang sedang aktif dan user login
  // ═══════════════════════════════════════════════════════════════
  auth: {
    currentUser: null,           // Object user dari Firebase Auth
    currentCompanyId: null,      // ID company yang sedang aktif ('nmsa' atau 'ipn')
    currentCompanyData: null,    // Data lengkap company dari Firestore
    isAuthenticated: false       // Status apakah user sudah login
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
// ★★★ TAMBAHAN BARU (v3.4): MULTI-COMPANY CONFIGURATION ★★★
//    Konfigurasi untuk 2 perusahaan: NMSA dan IPN
// ═══════════════════════════════════════════════════════════════

/**
 * COMPANY_CONFIG - Konfigurasi lengkap untuk setiap perusahaan
 * 
 * Struktur:
 * - id: ID unik company (sesuai document ID di Firestore)
 * - code: Kode singkat
 * - name: Nama resmi perusahaan
 * - displayName: Nama tampilan di UI
 * - no_invoice_prefix: Prefix nomor invoice (contoh: "BKK-NMSA")
 * - branding: Warna tema untuk UI
 */
const COMPANY_CONFIG = {
  nmsa: {
    id: 'nmsa',
    code: 'NMSA',
    name: 'PT Nusantara Mineral Sukses Abadi',
    displayName: 'Invoice-NMSA',
    no_invoice_prefix: 'BKK-NMSA',
    
    // Branding & UI
    branding: {
      primaryColor: '#2563eb',      // Blue
      secondaryColor: '#1e40af',
      logoUrl: '',
      icon: '🏢'
    },
    
    // Default signatures untuk company ini (bisa beda per company)
    defaultSignatures: {
      dibuat_oleh: 'Nur Wahyudi',
      disetujui_oleh: 'Harijon',
      keuangan: 'Andi Dhiya Salsabila',
      dir_keuangan: 'Harijon',
      direktur_utama: 'H. Andi Nursyam Halid',
      accounting: 'Sri Ekowati'
    },
    
    // Default values untuk form
    defaults: {
      lokasi: 'Lt. 1',
      kode: 'LP',
      jenis_pengajuan: 'Biaya Operasional'
    },
    
    // User credentials (untuk testing/dev - hapus di production!)
    testCredentials: {
      email: 'admin@nmsa.com',
      password: 'Nmsa2024!'  // ← Ganti dengan password yang Anda buat!
    }
  },
  
  ipn: {
    id: 'ipn',
    code: 'IPN',
    name: 'PT Industri Padi Nusantara',
    displayName: 'Invoice-IPN',
    no_invoice_prefix: 'BKK-IPN',
    
    // Branding & UI
    branding: {
      primaryColor: '#dc2626',      // Red (beda dari NMSA!)
      secondaryColor: '#991b1b',
      logoUrl: '',
      icon: '🏭'
    },
    
    // Default signatures untuk IPN (bisa beda!)
    defaultSignatures: {
      dibuat_oleh: 'Admin IPN',        // ← Sesuaikan dengan orang IPN
      disetujui_oleh: 'Manager IPN',   // ← Sesuaikan
      keuangan: 'Finance IPN',         // ← Sesuaikan
      dir_keuangan: 'Director IPN',    // ← Sesuaikan
      direktur_utama: 'Direktur IPN',  // ← Sesuaikan
      accounting: 'Accounting IPN'     // ← Sesuaikan
    },
    
    // Default values untuk form
    defaults: {
      lokasi: 'Lt. 2',
      kode: 'LP',
      jenis_pengajuan: 'Biaya Operasional'
    },
    
    // User credentials (untuk testing/dev)
    testCredentials: {
      email: 'admin-ipn@gmail.com',
      password: 'Ipn2024!'  // ← Ganti dengan password yang Anda buat!
    }
  }
};

/**
 * Daftar semua company IDs (untuk iterasi)
 */
const COMPANY_IDS = ['nmsa', 'ipn'];

/**
 * Get company config by ID
 * @param {string} companyId - ID company ('nmsa' atau 'ipn')
 * @returns {Object|null} Company config object atau null jika tidak ditemukan
 */
function getCompanyConfig(companyId) {
  return COMPANY_CONFIG[companyId] || null;
}

/**
 * Get current active company config
 * @returns {Object|null} Config company yang sedang aktif
 */
function getCurrentCompanyConfig() {
  const companyId = state.auth.currentCompanyId;
  return companyId ? COMPANY_CONFIG[companyId] : null;
}

/**
 * Set current active company
 * @param {string} companyId - ID company ('nmsa' atau 'ipn')
 */
function setCurrentCompany(companyId) {
  if (COMPANY_CONFIG[companyId]) {
    state.auth.currentCompanyId = companyId;
    state.auth.currentCompanyData = COMPANY_CONFIG[companyId];
    // Simpan ke localStorage agar persisten
    localStorage.setItem(CONFIG_KEYS.CURRENT_COMPANY_ID, companyId);
    console.log(`✅ Company aktif diubah ke: ${COMPANY_CONFIG[companyId].displayName}`);
    return true;
  } else {
    console.error(`❌ Company ID tidak valid: ${companyId}`);
    return false;
  }
}

/**
 * Clear current company (logout)
 */
function clearCurrentCompany() {
  state.auth.currentCompanyId = null;
  state.auth.currentCompanyData = null;
  state.auth.currentUser = null;
  state.auth.isAuthenticated = false;
  localStorage.removeItem(CONFIG_KEYS.CURRENT_COMPANY_ID);
  localStorage.removeItem(CONFIG_KEYS.CURRENT_USER_SESSION);
  console.log('🔄 Company session di-clear');
}

/**
 * Initialize company from saved session
 * Dipanggil saat aplikasi pertama kali load
 */
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
// END OF MULTI-COMPANY CONFIGURATION
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// ★ TAMBAHAN BARU: FIREBASE CONFIGURATION
// ═══════════════════════════════════════════════════════════════
const FIREBASE_CONFIG = {
  projectId: 'ai-devender-7b55c',
  
  // Nama koleksi Firestore yang digunakan
  collections: {
    submissions: 'submissions',           // Koleksi utama submission/pengajuan
    companies: 'companies',               // ★★★ BARU: Koleksi config perusahaan
    users: 'users',                       // ★★★ BARU: Koleksi data user
    uploadLogs: 'upload_logs',            // Log upload file (opsional)
    settings: 'settings'                  // Pengaturan aplikasi (opsional)
  },
  
  // Field mapping (sesuai struktur di Firestore)
  fields: {
    // Fields submission utama
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
    
    // ★★★ BARU: Field untuk multi-company filtering
    companyId: 'company_id',              // ID company (nmsa/ipn)
    companyName: 'company_name',          // Nama company untuk display
    
    // Fields Google Drive integration
    googleDriveLink: 'google_drive_link',
    fileName: 'nama_file',
    fileId: 'file_id',
    fileSize: 'file_size',
    mimeType: 'mime_type',
    uploadedAt: 'uploaded_at'
  }
};

// ═══════════════════════════════════════════════════════════════
// ★ TAMBAHAN BARU: UPLOAD CONFIGURATION
// ═══════════════════════════════════════════════════════════════
const UPLOAD_CONFIG = {
  maxSizeBytes: 30 * 1024 * 1024,
  maxSizeDisplay: '30MB',
  warningSizeBytes: 10 * 1024 * 1024,
  warningSizeDisplay: '10MB',
  
  allowedMimeTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'application/zip',
    'application/x-rar-compressed',
    'text/plain',
    'text/csv'
  ],
  
  allowedExtensions: [
    '.pdf',
    '.doc', '.docx',
    '.xls', '.xlsx',
    '.ppt', '.pptx',
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
    '.zip', '.rar',
    '.txt', '.csv'
  ],
  
  drive: {
    defaultFolderName: 'Submission_Files_FinanceSync',
    folderId: ''
  },
  
  validation: {
    maxFileNameLength: 255,
    blockedPatterns: [
      /\.\./,
      /[<>:"|?*]/,
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i
    ]
  }
};

// ═══════════════════════════════════════════════════════════════
// ★ TAMBAHAN BARU: APPS SCRIPT ENDPOINT CONFIGURATION
// ═══════════════════════════════════════════════════════════════
const APPS_SCRIPT_CONFIG = {
  getUrl: function() {
    return localStorage.getItem(CONFIG_KEYS.APPS_SCRIPT_URL) || '';
  },
  
  setUrl: function(url) {
    if (url && url.trim() !== '') {
      localStorage.setItem(CONFIG_KEYS.APPS_SCRIPT_URL, url.trim());
      state.appsScriptUrl = url.trim();
      return true;
    }
    return false;
  },
  
  clearUrl: function() {
    localStorage.removeItem(CONFIG_KEYS.APPS_SCRIPT_URL);
    state.appsScriptUrl = '';
  },
  
  isConfigured: function() {
    const url = this.getUrl();
    return url && url.trim() !== '' && url.includes('script.google.com');
  },
  
  actions: {
    SAVE_SUBMISSION: 'save',
    SYNC_SHEET: 'sync',
    UPLOAD_ONLY: 'upload_only',
    TEST_CONNECTION: 'test_connection'
  },
  
  timeout: {
    normal: 30000,
    upload: 120000,
    largeFile: 300000
  }
};

// ═══════════════════════════════════════════════════════════════
// ★ TAMBAHAN BARU: HELPER FUNCTIONS UNTUK CONFIG
// ═══════════════════════════════════════════════════════════════
const ConfigHelper = {
  validateFile: function(file) {
    if (!file) {
      return { valid: false, error: 'Tidak ada file yang dipilih' };
    }
    
    if (file.size > UPLOAD_CONFIG.maxSizeBytes) {
      return {
        valid: false,
        error: `File terlalu besar! Maksimal ${UPLOAD_CONFIG.maxSizeDisplay}. ` +
               `Ukuran file Anda: ${(file.size / 1024 / 1024).toFixed(2)} MB`
      };
    }
    
    if (file.size > UPLOAD_CONFIG.warningSizeBytes) {
      console.warn(`⚠️ File cukup besar (${(file.size/1024/1024).toFixed(2)}MB), upload mungkin memerlukan waktu lebih lama`);
    }
    
    const fileName = file.name.toLowerCase();
    const ext = '.' + fileName.split('.').pop();
    
    if (!UPLOAD_CONFIG.allowedExtensions.includes(ext)) {
      return {
        valid: false,
        error: `Tipe file tidak diizinkan: ${ext}\n` +
               `Gunakan: ${UPLOAD_CONFIG.allowedExtensions.join(', ')}`
      };
    }
    
    if (file.type && !UPLOAD_CONFIG.allowedMimeTypes.includes(file.type)) {
      console.warn(`⚠️ MIME type tidak dikenali: ${file.type}, melanjutkan berdasarkan extension...`);
    }
    
    if (file.name.length > UPLOAD_CONFIG.validation.maxFileNameLength) {
      return {
        valid: false,
        error: `Nama file terlalu panjang! Maksimal ${UPLOAD_CONFIG.validation.maxFileNameLength} karakter`
      };
    }
    
    for (const pattern of UPLOAD_CONFIG.validation.blockedPatterns) {
      if (pattern.test(file.name)) {
        return {
          valid: false,
          error: 'Nama file mengandung karakter atau pattern yang tidak diizinkan'
        };
      }
    }
    
    return { valid: true, error: null };
  },
  
  formatFileSize: function(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },
  
  getMimeTypeFromExtension: function(filename) {
    const ext = filename.toLowerCase().split('.').pop();
    
    const mimeMap = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'bmp': 'image/bmp',
      'zip': 'application/zip',
      'rar': 'application/x-rar-compressed',
      'txt': 'text/plain',
      'csv': 'text/csv'
    };
    
    return mimeMap[ext] || 'application/octet-stream';
  },
  
  checkAppsScriptReady: function() {
    if (!APPS_SCRIPT_CONFIG.isConfigured()) {
      return {
        ready: false,
        message: '❌ Google Apps Script URL belum dikonfigurasi!\n' +
                 'Silakan masukkan URL di Settings → Apps Script URL'
      };
    }
    
    return {
      ready: true,
      message: '✅ Apps Script siap digunakan'
    };
  },
  
  // ═══════════════════════════════════════════════════════════════
  // ★★★ TAMBAHAN BARU (v3.4): Company Helper Functions ★★★
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Generate nomor invoice otomatis berdasarkan company
   * Format: BKK-{CODE}/{MM}/YY/{XXXX}
   * Contoh: BKK-NMSA/04/26/00105
   * 
   * @param {string} companyId - ID company
   * @param {number} nextNumber - Nomor urut selanjutnya
   * @returns {string} Nomor invoice formatted
   */
  generateInvoiceNumber: function(companyId, nextNumber) {
    const config = getCompanyConfig(companyId);
    if (!config) {
      console.error('Company config not found for:', companyId);
      return 'UNKNOWN-ERROR';
    }
    
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const num = String(nextNumber).padStart(5, '0');
    
    return `${config.no_invoice_prefix}/${month}/${year}/${num}`;
  },
  
  /**
   * Get default signatures untuk company tertentu
   * Jika company tidak punya signature custom, pakai global DEFAULT_SIGNATORIES
   * 
   * @param {string} companyId - ID company
   * @returns {Object} Signatures object
   */
  getSignaturesForCompany: function(companyId) {
    const config = getCompanyConfig(companyId);
    if (config && config.defaultSignatures) {
      return config.defaultSignatures;
    }
    // Fallback ke default global
    return DEFAULT_SIGNATORIES;
  },
  
  /**
   * Get default form values untuk company tertentu
   * 
   * @param {string} companyId - ID company
   * @returns {Object} Default values
   */
  getDefaultsForCompany: function(companyId) {
    const config = getCompanyConfig(companyId);
    if (config && config.defaults) {
      return { ...config.defaults };
    }
    return {
      lokasi: '',
      kode: 'LP',
      jenis_pengajuan: ''
    };
  },
  
  /**
   * Cek apakah user memiliki akses ke company tertentu
   * 
   * @param {string} userEmail - Email user
   * @param {string} companyId - ID company yang dicek
   * @returns {boolean}
   */
  hasAccessToCompany: function(userEmail, companyId) {
    const config = getCompanyConfig(companyId);
    if (!config) return false;
    
    // Cek apakah email cocok dengan test credentials
    // Di production, cek dari database users collection
    if (config.testCredentials && config.testCredentials.email === userEmail) {
      return true;
    }
    
    return false;
  }
};

// ==================== EXPORT FOR GLOBAL ACCESS ====================
// Membuat fungsi dan variabel dapat diakses secara global
window.CONFIG_KEYS = CONFIG_KEYS;
window.state = state;
window.elements = elements;
window.DEFAULT_SIGNATORIES = DEFAULT_SIGNATORIES;

// ★ EXPORT ORIGINAL
window.FIREBASE_CONFIG = FIREBASE_CONFIG;
window.UPLOAD_CONFIG = UPLOAD_CONFIG;
window.APPS_SCRIPT_CONFIG = APPS_SCRIPT_CONFIG;
window.ConfigHelper = ConfigHelper;

// ★★★ EXPORT TAMBAHAN BARU (v3.4): Multi-Company ★★★
window.COMPANY_CONFIG = COMPANY_CONFIG;
window.COMPANY_IDS = COMPANY_IDS;
window.getCompanyConfig = getCompanyConfig;
window.getCurrentCompanyConfig = getCurrentCompanyConfig;
window.setCurrentCompany = setCurrentCompany;
window.clearCurrentCompany = clearCurrentCompany;
window.initializeCompanySession = initializeCompanySession;

// ═══════════════════════════════════════════════════════════════
// ★ AUTO-INITIALIZE COMPANY SESSION ON LOAD ★★★
//    Panggil fungsi ini saat aplikasi pertama kali load
//    untuk memulihkan session company dari localStorage
// ═══════════════════════════════════════════════════════════════
initializeCompanySession();

// ═══════════════════════════════════════════════════════════════
// END OF FILE - config.js v3.4.0 (Multi-Company Ready)
// ═══════════════════════════════════════════════════════════════
