/**
 * ============================================
 * FinanceSync Pro v3.3 - Firebase Initialization
 * ============================================
 * File ini menangani inisialisasi dan koneksi ke Firebase Firestore.
 * Ini adalah titik masuk utama untuk koneksi database.
 *
 * Version: 3.3.1
 * Update: Added Apps Script URL management & connection testing
 */

// ==================== LOAD SAVED CONFIGURATIONS ====================
/**
 * Memuat konfigurasi yang tersimpan di localStorage
 * Termasuk:
 *   - Firebase config (JSON string)
 *   - Apps Script Web App URL
 */
function loadSavedConfigs() {
  // Load Firebase config
  var saved = localStorage.getItem(CONFIG_KEYS.FIREBASE_CONFIG);
  if (saved && elements.firebaseConfigInput) {
    elements.firebaseConfigInput.value = saved;
    console.log('[Config] Firebase config loaded from localStorage');
  }
  
  // Load Apps Script URL
  var scriptUrl = localStorage.getItem(CONFIG_KEYS.APPS_SCRIPT_URL);
  if (scriptUrl) {
    state.appsScriptUrl = scriptUrl;
    console.log('[Config] Apps Script URL loaded:', scriptUrl.substring(0, 50) + '...');
  } else {
    console.warn('[Config] No Apps Script URL found in localStorage');
  }
}

// ==================== SHOW CONNECTION BANNER ====================
/**
 * Menampilkan banner status koneksi
 * @param {string} type - Tipe banner ('connecting', 'connected', 'error')
 * @param {string} title - Judul banner
 * @param {string} message - Pesan banner
 */
function showBanner(type, title, message) {
  const banner = elements.connectionBanner;
  if (!banner) return;
  
  banner.style.display = 'flex';
  banner.className = 'connection-banner no-print ' + type;
  
  if (elements.bannerTitle) elements.bannerTitle.textContent = title;
  if (elements.bannerMessage) elements.bannerMessage.textContent = message;
  
  // Auto-hide success banner setelah beberapa detik
  if (type === 'connected') {
    setTimeout(function() {
      if (banner) banner.style.display = 'none';
    }, 5000);
  }
}

// ==================== UPDATE CONNECTION UI ====================
/**
 * Update UI berdasarkan status koneksi
 * @param {boolean} connected - Status koneksi (true/false)
 */
function updateConnectionUI(connected) {
  const dot = elements.statusDot;
  const text = elements.statusText;
  
  if (!dot || !text) return;
  
  if (connected) {
    // Sukses terhubung
    elements.connectionBanner.className = 'connection-banner connected no-print';
    dot.className = 'status-dot success';
    text.textContent = 'Firestore Connected';
    text.className = 'status-text status-text-success';
    
    if (elements.bannerTitle) elements.bannerTitle.textContent = '✅ Firebase Terhubung';
    if (elements.bannerMessage) {
      elements.bannerMessage.textContent = 'Data & File (Base64) akan disimpan ke Firestore. Apps Script akan sync ke Google Drive.';
    }
    
    // Tampilkan architecture info
    if (elements.archBanner) elements.archBanner.style.display = 'block';
    
  } else {
    // Gagal terhubung
    elements.connectionBanner.className = 'connection-banner error no-print';
    dot.className = 'status-dot error';
    text.textContent = 'Tidak Terhubung';
    text.className = 'status-text status-text-error';
    
    if (elements.bannerTitle) elements.bannerTitle.textContent = '❌ Koneksi Gagal';
    if (elements.bannerMessage) {
      elements.bannerMessage.textContent = 'Periksa konfigurasi Firebase Anda.';
    }
  }
}

// ==================== INITIALIZE FIREBASE CONNECTION ====================
/**
 * Fungsi utama untuk inisialisasi koneksi Firebase
 * Langkah-langkah:
 * 1. Cek apakah ada config tersimpan di localStorage
 * 2. Jika ada, inisialisasi Firebase dengan config tersebut
 * 3. Test koneksi dengan query sederhana
 * 4. Update UI sesuai hasil
 */
async function initConnection() {
  // Tampilkan status "menghubungkan"
  showBanner('connecting', 'Menyiapkan Koneksi...', 'Menghubungkan Firebase Firestore...');
  
  // Cek apakah ada konfigurasi tersimpan
  const hasConfig = !!localStorage.getItem(CONFIG_KEYS.FIREBASE_CONFIG);

  if (!hasConfig) {
    // Jika tidak ada config, tampilkan setup modal setelah delay
    console.warn('[Firebase] No config found! Showing setup modal...');
    
    setTimeout(function() { 
      openSetupModal(); 
      showBanner('error', 'Belum Terkonfigurasi', 'Klik Setup untuk konfigurasi Firebase');
    }, 1500);
    
    return;
  }

  try {
    // Parse konfigurasi dari localStorage
    const config = JSON.parse(localStorage.getItem(CONFIG_KEYS.FIREBASE_CONFIG));
    
    console.log('[Firebase] Initializing with config:', config.projectId);
    
    // Inisialisasi Firebase app (hanya jika belum ada)
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
      console.log('[Firebase] App initialized successfully');
    }
    
    // Dapatkan Firestore instance
    state.db = firebase.firestore();
    
    // Test koneksi dengan query sederhana
    console.log('[Firebase] Testing connection...');
    await state.db.collection('submissions').limit(1).get();
    
    // Update state
    state.isConnected = true;
    state.isConnecting = false;
    
    console.log('[Firebase] ✅ Connected successfully!');
    
    // Update UI
    updateConnectionUI(true);
    
    // Mulai listener untuk data
    applyDateFilter();
    
  } catch (error) {
    console.error('[Firebase Error]:', error);
    
    // Update state
    state.isConnected = false;
    state.isConnecting = false;
    
    // Tampilkan error
    showBanner('error', 'Koneksi Gagal', error.message);
    showToast('Firebase error: ' + error.message, 'error');
  }
}

// ==================== SAVE FIREBASE CONFIG ====================
/**
 * Menyimpan konfigurasi Firebase ke localStorage dan menginisialisasi ulang
 * Fungsi ini dipanggil dari modal setup saat user klik "Simpan & Connect"
 */
window.saveFirebaseConfig = async function() {
  try {
    const inputEl = document.getElementById('firebaseConfigInput');
    const inputStr = inputEl ? inputEl.value.trim() : '';
    const errorEl = document.getElementById('configError');
    
    // Reset error display
    if (errorEl) { 
      errorEl.classList.add('hidden'); 
      errorEl.textContent = ''; 
    }
    
    // Validasi: cek apakah input kosong
    if (!inputStr) { 
      showError('Paste Firebase config!'); 
      return; 
    }
    
    // Validasi: parse JSON
    let config;
    try { 
      config = JSON.parse(inputStr); 
    } catch (parseErr) { 
      showError('Format JSON tidak valid!'); 
      return; 
    }
    
    // Validasi: cek field wajib
    if (!config.apiKey || !config.projectId) { 
      showError('Config tidak lengkap! Pastikan apiKey dan projectId.'); 
      return; 
    }
    
    // Simpan ke localStorage
    localStorage.setItem(CONFIG_KEYS.FIREBASE_CONFIG, JSON.stringify(config));
    console.log('[Config] Saved to localStorage');
    
    // Tampilkan feedback
    showToast('Config tersimpan! Menghubungkan...', 'info');
    
    // Tutup modal
    closeSetupModal();
    
    // Re-inisialisasi koneksi dengan config baru
    await initConnection();
    
  } catch (error) {
    console.error('[Save Config Error]:', error);
    showError('Gagal menyimpan: ' + error.message);
  }
};

/**
 * Menampilkan error di config modal
 * @param {string} msg - Pesan error
 */
function showError(msg) {
  const el = document.getElementById('configError');
  if (el) { 
    el.textContent = msg; 
    el.classList.remove('hidden'); 
  }
  showToast(msg, 'error');
}

// ═══════════════════════════════════════════════════════════════
// ★ TAMBAHAN BARU: TEST APPS SCRIPT CONNECTION
//    Dipanggil dari setup modal step 3 atau tombol test
// ═══════════════════════════════════════════════════════════════

/**
 * Test koneksi ke Google Apps Script
 * @returns {Promise<boolean>}
 */
window.testAppsScriptConnection = async function() {
  const url = getAppsScriptUrl ? getAppsScriptUrl() : state.appsScriptUrl;
  
  if (!url) {
    showToast('⚠️ URL Apps Script belum dikonfigurasi', 'warning');
    console.warn('[Test] No Apps Script URL configured!');
    return false;
  }
  
  try {
    showToast('🧪 Menguji koneksi Apps Script...', 'info');
    
    console.log('[Test] Testing connection to:', url.substring(0, 60) + '...');
    
    // Coba fetch sederhana dengan timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 detik timeout
    
    const response = await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'test_connection' }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Dengan no-cors, jika tidak error = sukses
    console.log('[Test] Response received (no-cors mode)');
    
    showToast('✅ Koneksi Apps Script berhasil!', 'success');
    return true;
    
  } catch (error) {
    if (error.name === 'AbortError') {
      showToast('⏱️ Timeout - Server tidak merespons (>15s)', 'error');
    } else {
      showToast('❌ Error: ' + error.message, 'error');
    }
    
    return false;
  }
}

/**
 * Get Apps Script URL (wrapper function)
 * Mendukung baik dari state maupun CONFIG_KEYS
 * 
 * @returns {string} URL kosong jika tidak ada
 */
function getAppsScriptUrl() {
  return state.appsScriptUrl || 
         localStorage.getItem(CONFIG_KEYS.APPS_SCRIPT_URL) || '';
}

/**
 * Export functions for global access
 */
window.loadSavedConfigs = loadSavedConfigs;
window.showBanner = showBanner;
window.updateConnectionUI = updateConnectionUI;
window.initConnection = initConnection;
window.saveFirebaseConfig = saveFirebaseConfig;
window.showError = showError;

// ═══════════════════════════════════════════════════════════════
// END OF FILE - firebase-init.js
