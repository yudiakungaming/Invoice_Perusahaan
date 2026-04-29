/**
 * ============================================
 * FinanceSync Pro v3.4 - Firebase Initialization
 * ============================================
 * File ini menangani inisialisasi dan koneksi ke Firebase Firestore.
 * Ini adalah titik masuk utama untuk koneksi database.
 *
 * Version: 3.4.0
 * Update: Added Authentication & Multi-Company Login Support
 * Date: April 2026
 *
 * ★ PERUBAHAN (v3.4):
 *    - Menambahkan Firebase Authentication (Email/Password)
 *    - Menambahkan Login/Logout functions
 *    - Auto-detect company saat user login
 *    - Session management dengan localStorage
 */

// ==================== LOAD SAVED CONFIGURATIONS ====================
/**
 * Memuat konfigurasi yang tersimpan di localStorage
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
    elements.connectionBanner.className = 'connection-banner connected no-print';
    dot.className = 'status-dot success';
    text.textContent = 'Firestore Connected';
    text.className = 'status-text status-text-success';
    
    if (elements.bannerTitle) elements.bannerTitle.textContent = '✅ Firebase Terhubung';
    if (elements.bannerMessage) {
      elements.bannerMessage.textContent = 'Data & File (Base64) akan disimpan ke Firestore. Apps Script akan sync ke Google Drive.';
    }
    
    if (elements.archBanner) elements.archBanner.style.display = 'block';
    
  } else {
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

// ═══════════════════════════════════════════════════════════════
// ★★★ TAMBAHAN BARU (v3.4): AUTHENTICATION STATE ★★★
// ═══════════════════════════════════════════════════════════════

/**
 * Auth state reference (diisi setelah init)
 */
let authInstance = null;

/**
 * Cek apakah user sudah login
 * @returns {boolean}
 */
function isLoggedIn() {
  return state.auth.isAuthenticated && state.auth.currentUser !== null;
}

/**
 * Get current logged-in user info
 * @returns {Object|null} User object atau null
 */
function getCurrentUser() {
  return state.auth.currentUser;
}

/**
 * Get current company ID yang aktif
 * @returns {string|null} 'nmsa', 'ipn', atau null
 */
function getActiveCompanyId() {
  return state.auth.currentCompanyId;
}

/**
 * Update UI untuk menampilkan status login & company
 * Dipanggil setelah berhasil login atau logout
 */
function updateAuthUI() {
  const userInfoEl = document.getElementById('userInfo');
  const companyBadgeEl = document.getElementById('companyBadge');
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  
  if (isLoggedIn()) {
    // User sudah login - tampilkan info
    const user = getCurrentUser();
    const company = getCurrentCompanyConfig();
    
    if (userInfoEl) {
      userInfoEl.innerHTML = `
        <span class="user-name">👤 ${user.displayName || user.email}</span>
        <span class="user-email">${user.email}</span>
      `;
      userInfoEl.style.display = 'inline-block';
    }
    
    if (companyBadgeEl && company) {
      companyBadgeEl.innerHTML = `
        <span class="company-icon">${company.branding.icon}</span>
        <span class="company-name" style="color: ${company.branding.primaryColor}">
          ${company.displayName}
        </span>
      `;
      companyBadgeEl.style.display = 'inline-flex';
    }
    
    if (loginBtn) loginBtn.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'inline-block';
    
    console.log(`[Auth] UI updated: Logged in as ${user.email} (${company ? company.displayName : 'No Company'})`);
    
  } else {
    // Belum login - tampilkan tombol login
    if (userInfoEl) userInfoEl.style.display = 'none';
    if (companyBadgeEl) companyBadgeEl.style.display = 'none';
    if (loginBtn) loginBtn.style.display = 'inline-block';
    if (logoutBtn) logoutBtn.style.display = 'none';
    
    console.log('[Auth] UI updated: Not logged in');
  }
}

// ═══════════════════════════════════════════════════════════════
// ★★★ TAMBAHAN BARU (v3.4): LOGIN FUNCTION ★★★
// ═══════════════════════════════════════════════════════════════

/**
 * Login user dengan email dan password
 * Setelah login sukses, otomatis detect company dari email
 * 
 * @param {string} email - Email user
 * @param {string} password - Password user
 * @returns {Promise<Object>} {success: boolean, user?: Object, error?: string}
 */
async function loginUser(email, password) {
  try {
    console.log('[Auth] Attempting login for:', email);
    
    if (!authInstance) {
      throw new Error('Firebase Auth belum diinisialisasi!');
    }
    
    // Login dengan Firebase Auth
    const userCredential = await authInstance.signInWithEmailAndPassword(email, password);
    const firebaseUser = userCredential.user;
    
    console.log('[Auth] Firebase auth success! UID:', firebaseUser.uid);
    
    // Detect company berdasarkan email
    let detectedCompanyId = null;
    
    for (const companyId of COMPANY_IDS) {
      const companyCfg = COMPANY_CONFIG[companyId];
      if (companyCfg.testCredentials && companyCfg.testCredentials.email === email) {
        detectedCompanyId = companyId;
        break;
      }
    }
    
    if (!detectedCompanyId) {
      // Fallback: cek di Firestore collection users
      try {
        const userDoc = await state.db.collection('users')
          .where('email', '==', email)
          .limit(1)
          .get();
        
        if (!userDoc.empty) {
          detectedCompanyId = userDoc.docs[0].data().companyId;
        }
      } catch (err) {
        console.warn('[Auth] Gagal ambil data user dari Firestore:', err);
      }
    }
    
    if (!detectedCompanyId) {
      // Logout karena tidak ada akses ke company manapun
      await authInstance.signOut();
      throw new Error('Email ini tidak terdaftar untuk perusahaan manapun!');
    }
    
    // Set state
    state.auth.currentUser = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName || email.split('@')[0]
    };
    state.auth.isAuthenticated = true;
    
    // Set active company
    setCurrentCompany(detectedCompanyId);
    
    // Simpan session ke localStorage
    localStorage.setItem(CONFIG_KEYS.CURRENT_USER_SESSION, JSON.stringify({
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName || email.split('@')[0],
      companyId: detectedCompanyId,
      loginTime: new Date().toISOString()
    }));
    
    console.log(`[Auth] ✅ Login berhasil! Company: ${COMPANY_CONFIG[detectedCompanyId].displayName}`);
    
    // Update UI
    updateAuthUI();
    
    return {
      success: true,
      user: state.auth.currentUser,
      companyId: detectedCompanyId,
      companyName: COMPANY_CONFIG[detectedCompanyId].displayName
    };
    
  } catch (error) {
    console.error('[Auth] Login error:', error.code, error.message);
    
    // Mapping error code ke pesan yang lebih friendly
    let friendlyMessage = error.message;
    if (error.code === 'auth/user-not-found') {
      friendlyMessage = 'Email tidak ditemukan!';
    } else if (error.code === 'auth/wrong-password') {
      friendlyMessage = 'Password salah!';
    } else if (error.code === 'auth/too-many-requests') {
      friendlyMessage = 'Terlalu banyak percobaan. Coba lagi beberapa menit.';
    } else if (error.code === 'auth/invalid-email') {
      friendlyMessage = 'Format email tidak valid!';
    }
    
    return {
      success: false,
      error: friendlyMessage
    };
  }
}

/**
 * Logout user
 * Menghapus session dan reset state
 * 
 * @returns {Promise<void>}
 */
async function logoutUser() {
  try {
    console.log('[Auth] Logging out...');
    
    // Sign out dari Firebase Auth
    if (authInstance) {
      await authInstance.signOut();
    }
    
    // Clear semua state
    clearCurrentCompany();
    
    // Update UI
    updateAuthUI();
    
    showToast('👋 Berhasil logout!', 'success');
    console.log('[Auth] ✅ Logout berhasil!');
    
    // Optional: redirect ke halaman login atau refresh
    // window.location.reload();
    
  } catch (error) {
    console.error('[Auth] Logout error:', error);
    showToast('Gagal logout: ' + error.message, 'error');
  }
}

/**
 * Restore session dari localStorage (dipanggil saat load aplikasi)
 * Cek apakah ada session tersimpan dan masih valid
 * 
 * @returns {Promise<boolean>} true jika session valid, false jika tidak
 */
async function restoreSession() {
  try {
    const sessionStr = localStorage.getItem(CONFIG_KEYS.CURRENT_USER_SESSION);
    
    if (!sessionStr) {
      console.log('[Auth] Tidak ada session tersimpan');
      return false;
    }
    
    const sessionData = JSON.parse(sessionStr);
    
    console.log('[Auth] Mencoba restore session untuk:', sessionData.email);
    
    // Cek apakah Firebase Auth masih aktif (tidak expired)
    if (authInstance && authInstance.currentUser) {
      // User masih login di Firebase Auth
      state.auth.currentUser = {
        uid: authInstance.currentUser.uid,
        email: authInstance.currentUser.email,
        displayName: authInstance.currentUser.displayName || sessionData.displayName
      };
      state.auth.isAuthenticated = true;
      
      // Restore company
      if (sessionData.companyId && COMPANY_CONFIG[sessionData.companyId]) {
        setCurrentCompany(sessionData.companyId);
      }
      
      console.log(`[Auth] ✅ Session restored! Company: ${state.auth.currentCompanyData?.displayName}`);
      updateAuthUI();
      return true;
      
    } else {
      // Session di localStorage tapi Firebase Auth sudah expired
      console.warn('[Auth] Session expired (Firebase Auth tidak aktif)');
      clearCurrentCompany();
      return false;
    }
    
  } catch (error) {
    console.error('[Auth] Restore session error:', error);
    clearCurrentCompany();
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// END OF AUTHENTICATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════

// ==================== INITIALIZE FIREBASE CONNECTION ====================
/**
 * Fungsi utama untuk inisialisasi koneksi Firebase
 * 
 * ★ UPDATE (v3.4):
 *    - Sekarang juga menginisialisasi Firebase Auth
 *    - Auto-restore session jika ada
 *    - Setelah connect, cek auth state
 */
async function initConnection() {
  // Tampilkan status "menghubungkan"
  showBanner('connecting', 'Menyiapkan Koneksi...', 'Menghubungkan Firebase Firestore...');
  
  // Cek apakah ada konfigurasi tersimpan
  const hasConfig = !!localStorage.getItem(CONFIG_KEYS.FIREBASE_CONFIG);

  if (!hasConfig) {
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
    
    // ★★★ BARU (v3.4): Inisialisasi Firebase Auth ★★★
    authInstance = firebase.auth();
    console.log('[Firebase] Auth initialized');
    
    // Dapatkan Firestore instance
    state.db = firebase.firestore();
    
    // Test koneksi dengan query sederhana
    console.log('[Firebase] Testing connection...');
    await state.db.collection('submissions').limit(1).get();
    
    // Update state
    state.isConnected = true;
    state.isConnecting = false;
    
    console.log('[Firebase] ✅ Connected successfully!');
    
    // Update UI koneksi
    updateConnectionUI(true);
    
    // ★★★ BARU (v3.4): Restore auth session jika ada ★★★
    const sessionRestored = await restoreSession();
    
    if (sessionRestored) {
      showBanner('connected', '✅ Terhubung & Login', 
        `Selamat datang! ${getCurrentCompanyConfig()?.displayName || ''}`);
    }
    
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
 */
window.saveFirebaseConfig = async function() {
  try {
    const inputEl = document.getElementById('firebaseConfigInput');
    const inputStr = inputEl ? inputEl.value.trim() : '';
    const errorEl = document.getElementById('configError');
    
    if (errorEl) { 
      errorEl.classList.add('hidden'); 
      errorEl.textContent = ''; 
    }
    
    if (!inputStr) { 
      showError('Paste Firebase config!'); 
      return; 
    }
    
    let config;
    try { 
      config = JSON.parse(inputStr); 
    } catch (parseErr) { 
      showError('Format JSON tidak valid!'); 
      return; 
    }
    
    if (!config.apiKey || !config.projectId) { 
      showError('Config tidak lengkap! Pastikan apiKey dan projectId.'); 
      return; 
    }
    
    localStorage.setItem(CONFIG_KEYS.FIREBASE_CONFIG, JSON.stringify(config));
    console.log('[Config] Saved to localStorage');
    
    showToast('Config tersimpan! Menghubungkan...', 'info');
    
    closeSetupModal();
    
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
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'test_connection' }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
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
};

/**
 * Get Apps Script URL (wrapper function)
 * @returns {string}
 */
function getAppsScriptUrl() {
  return state.appsScriptUrl || 
         localStorage.getItem(CONFIG_KEYS.APPS_SCRIPT_URL) || '';
}

// ═══════════════════════════════════════════════════════════════
// ★★★ EXPORT FUNCTIONS FOR GLOBAL ACCESS ★★★
// ═══════════════════════════════════════════════════════════════

// Export original functions
window.loadSavedConfigs = loadSavedConfigs;
window.showBanner = showBanner;
window.updateConnectionUI = updateConnectionUI;
window.initConnection = initConnection;
window.saveFirebaseConfig = saveFirebaseConfig;
window.showError = showError;

// ★★★ EXPORT TAMBAHAN BARU (v3.4): Authentication Functions ★★★
window.loginUser = loginUser;
window.logoutUser = logoutUser;
window.restoreSession = restoreSession;
window.isLoggedIn = isLoggedIn;
window.getCurrentUser = getCurrentUser;
window.getActiveCompanyId = getActiveCompanyId;
window.updateAuthUI = updateAuthUI;

// ═══════════════════════════════════════════════════════════════
// END OF FILE - firebase-init.js v3.4.0 (Multi-Company Auth Ready)
// ═══════════════════════════════════════════════════════════════
