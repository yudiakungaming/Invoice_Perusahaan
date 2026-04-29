/**
 * ============================================
 * FinanceSync Pro v3.3 - Configuration & Global State
 * ============================================
 * File ini berisi semua konfigurasi dan variabel global
 * yang digunakan di seluruh aplikasi.
 * 
 * Version: 3.3.1
 * Update: Added Google Drive Integration Config
 * Date: December 2024
 */

// ==================== CONFIGURATION KEYS ====================
const CONFIG_KEYS = {
  FIREBASE_CONFIG: 'financesync_firebase_config_v33',
  APPS_SCRIPT_URL: 'financesync_apps_script_url_v33',
  
  // ★ TAMBAHAN BARU: Keys untuk pengaturan upload
  UPLOAD_MAX_SIZE: 'financesync_upload_max_size_v33',
  UPLOAD_ALLOWED_TYPES: 'financesync_upload_allowed_types_v33'
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
  //    Untuk melacak status upload dan proses Drive sync
  // ═══════════════════════════════════════════════════════════════
  driveIntegration: {
    isUploading: false,           // Sedang proses upload?
    uploadProgress: 0,            // Progress percentage (0-100)
    lastUploadedFile: null,       // Info file terakhir diupload
    driveLink: '',                // Link Google Drive hasil upload
    uploadError: null             // Error message jika gagal
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
// ★ TAMBAHAN BARU: FIREBASE CONFIGURATION
//    Konfigurasi detail koneksi Firebase Firestore
// ═══════════════════════════════════════════════════════════════
const FIREBASE_CONFIG = {
  projectId: 'ai-devender-7b55c',
  
  // Nama koleksi Firestore yang digunakan
  collections: {
    submissions: 'submissions',           // Koleksi utama submission/pengajuan
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
    
    // Fields Google Drive integration
    googleDriveLink: 'google_drive_link',   // Link file di Google Drive
    fileName: 'nama_file',                   // Nama asli file
    fileId: 'file_id',                       // ID file di Google Drive
    fileSize: 'file_size',                   // Ukuran file dalam bytes
    mimeType: 'mime_type',                   // Tipe MIME file
    uploadedAt: 'uploaded_at'                // Timestamp upload
  }
};

// ═══════════════════════════════════════════════════════════════
// ★ TAMBAHAN BARU: UPLOAD CONFIGURATION
//    Pengaturan batas dan jenis file yang bisa diupload
// ═══════════════════════════════════════════════════════════════
const UPLOAD_CONFIG = {
  // Batas ukuran file (dalam bytes)
  maxSizeBytes: 30 * 1024 * 1024,      // 30 MB (aman untuk base64 encoding)
  maxSizeDisplay: '30MB',              // Untuk tampilan di UI
  
  // Ukuran warning (akan muncul peringatan)
  warningSizeBytes: 10 * 1024 * 1024,  // 10 MB
  warningSizeDisplay: '10MB',
  
  // Tipe MIME yang diizinkan
  allowedMimeTypes: [
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    
    // Archives (jika diperlukan)
    'application/zip',
    'application/x-rar-compressed',
    
    // Text
    'text/plain',
    'text/csv'
  ],
  
  // Extension file yang diizinkan (untuk validasi cepat)
  allowedExtensions: [
    '.pdf',
    '.doc', '.docx',
    '.xls', '.xlsx',
    '.ppt', '.pptx',
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
    '.zip', '.rar',
    '.txt', '.csv'
  ],
  
  // Pengaturan Google Drive folder
  drive: {
    defaultFolderName: 'Submission_Files_FinanceSync',  // Nama folder default di Drive
    folderId: ''  // ID folder spesifik (kosong = auto-create)
  },
  
  // Validasi tambahan
  validation: {
    maxFileNameLength: 255,              // Maksimal panjang nama file
    blockedPatterns: [                   // Pattern nama file yang diblokir
      /\.\./,                           // Path traversal
      /[<>:"|?*]/,                      // Karakter ilegal Windows
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i  // Reserved names
    ]
  }
};

// ═══════════════════════════════════════════════════════════════
// ★ TAMBAHAN BARU: APPS SCRIPT ENDPOINT CONFIGURATION
//    URL dan pengaturan untuk komunikasi dengan Google Apps Script
// ═══════════════════════════════════════════════════════════════
const APPS_SCRIPT_CONFIG = {
  // URL Web App (akan diambil dari localStorage atau default)
  getUrl: function() {
    return localStorage.getItem(CONFIG_KEYS.APPS_SCRIPT_URL) || '';
  },
  
  // Set URL (simpan ke localStorage)
  setUrl: function(url) {
    if (url && url.trim() !== '') {
      localStorage.setItem(CONFIG_KEYS.APPS_SCRIPT_URL, url.trim());
      state.appsScriptUrl = url.trim();
      return true;
    }
    return false;
  },
  
  // Clear URL
  clearUrl: function() {
    localStorage.removeItem(CONFIG_KEYS.APPS_SCRIPT_URL);
    state.appsScriptUrl = '';
  },
  
  // Cek apakah URL sudah dikonfigurasi
  isConfigured: function() {
    const url = this.getUrl();
    return url && url.trim() !== '' && url.includes('script.google.com');
  },
  
  // Action types yang didukung
  actions: {
    SAVE_SUBMISSION: 'save',           // Simpan data + file sekaligus
    SYNC_SHEET: 'sync',                // Force sync Firebase → Sheet
    UPLOAD_ONLY: 'upload_only',        // Upload file saja (tanpa simpan data)
    TEST_CONNECTION: 'test_connection' // Test koneksi ke Apps Script
  },
  
  // Timeout settings (dalam milidetik)
  timeout: {
    normal: 30000,       // 30 detik untuk operasi normal
    upload: 120000,      // 2 menit untuk upload file
    largeFile: 300000    // 5 menit untuk file besar (>20MB)
  }
};

// ═══════════════════════════════════════════════════════════════
// ★ TAMBAHAN BARU: HELPER FUNCTIONS UNTUK CONFIG
//    Utility functions terkait konfigurasi
// ═══════════════════════════════════════════════════════════════
const ConfigHelper = {
  /**
   * Validasi apakah file bisa diupload berdasarkan konfigurasi
   * @param {File} file - File object yang akan divalidasi
   * @returns {Object} {valid: boolean, error: string|null}
   */
  validateFile: function(file) {
    if (!file) {
      return { valid: false, error: 'Tidak ada file yang dipilih' };
    }
    
    // Cek ukuran file
    if (file.size > UPLOAD_CONFIG.maxSizeBytes) {
      return {
        valid: false,
        error: `File terlalu besar! Maksimal ${UPLOAD_CONFIG.maxSizeDisplay}. ` +
               `Ukuran file Anda: ${(file.size / 1024 / 1024).toFixed(2)} MB`
      };
    }
    
    // Warning untuk file cukup besar
    if (file.size > UPLOAD_CONFIG.warningSizeBytes) {
      console.warn(`⚠️ File cukup besar (${(file.size/1024/1024).toFixed(2)}MB), upload mungkin memerlukan waktu lebih lama`);
    }
    
    // Cek extension file
    const fileName = file.name.toLowerCase();
    const ext = '.' + fileName.split('.').pop();
    
    if (!UPLOAD_CONFIG.allowedExtensions.includes(ext)) {
      return {
        valid: false,
        error: `Tipe file tidak diizinkan: ${ext}\n` +
               `Gunakan: ${UPLOAD_CONFIG.allowedExtensions.join(', ')}`
      };
    }
    
    // Cek MIME type (jika tersedia)
    if (file.type && !UPLOAD_CONFIG.allowedMimeTypes.includes(file.type)) {
      console.warn(`⚠️ MIME type tidak dikenali: ${file.type}, melanjutkan berdasarkan extension...`);
    }
    
    // Cek panjang nama file
    if (file.name.length > UPLOAD_CONFIG.validation.maxFileNameLength) {
      return {
        valid: false,
        error: `Nama file terlalu panjang! Maksimal ${UPLOAD_CONFIG.validation.maxFileNameLength} karakter`
      };
    }
    
    // Cek pattern nama file yang diblokir
    for (const pattern of UPLOAD_CONFIG.validation.blockedPatterns) {
      if (pattern.test(file.name)) {
        return {
          valid: false,
          error: 'Nama file mengand karakter atau pattern yang tidak diizinkan'
        };
      }
    }
    
    return { valid: true, error: null };
  },
  
  /**
   * Format ukuran file menjadi string readable
   * @param {number} bytes - Ukuran dalam bytes
   * @returns {string} Ukuran formatted (contoh: "2.5 MB")
   */
  formatFileSize: function(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },
  
  /**
   * Get MIME type dari extension file
   * @param {string} filename - Nama file
   * @returns {string} MIME type
   */
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
  
  /**
   * Cek apakah Apps Script URL sudah siap digunakan
   * @returns {Object} {ready: boolean, message: string}
   */
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
  }
};

// ==================== EXPORT FOR GLOBAL ACCESS ====================
// Membuat fungsi dan variabel dapat diakses secara global
window.CONFIG_KEYS = CONFIG_KEYS;
window.state = state;
window.elements = elements;
window.DEFAULT_SIGNATORIES = DEFAULT_SIGNATORIES;

// ★ EXPORT TAMBAHAN BARU
window.FIREBASE_CONFIG = FIREBASE_CONFIG;
window.UPLOAD_CONFIG = UPLOAD_CONFIG;
window.APPS_SCRIPT_CONFIG = APPS_SCRIPT_CONFIG;
window.ConfigHelper = ConfigHelper;

// ═══════════════════════════════════════════════════════════════
// ★ END OF MODIFICATIONS
//    Semua konfigurasi original tetap utuh dan tidak diubah
//    Hanya penambahan baru untuk mendukung Google Drive integration
// ═══════════════════════════════════════════════════════════════
