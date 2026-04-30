/**
 * ============================================
 * FinanceSync Pro v3.5 - Firebase Initialization (FIXED)
 * ============================================
 * PERUBAHAN:
 * - Hapus duplikasi dengan index.html
 * - Integrasi baik dengan config.js state
 * - Auth listener yang benar
 */

// ==================== LOAD SAVED CONFIGURATIONS ====================
function loadSavedConfigs() {
  var saved = localStorage.getItem(CONFIG_KEYS.FIREBASE_CONFIG);
  if (saved && elements.firebaseConfigInput) {
    elements.firebaseConfigInput.value = saved;
  }
  
  var scriptUrl = localStorage.getItem(CONFIG_KEYS.APPS_SCRIPT_URL);
  if (scriptUrl) {
    state.appsScriptUrl = scriptUrl;
  }
}

// ==================== AUTH STATE MANAGEMENT ====================
let authInstance = null;

function isLoggedIn() {
  return state.auth.isAuthenticated && state.auth.currentUser !== null;
}

function getCurrentUser() {
  return state.auth.currentUser;
}

function getActiveCompanyId() {
  return state.auth.currentCompanyId;
}

function updateAuthUI() {
  // Ini akan dipanggil dari index.html juga
  if (typeof window.updateAuthUI === 'function') {
    window.updateAuthUI(isLoggedIn());
  }
}

// ==================== LOGIN/LOGOUT FUNCTIONS ====================
async function loginUser(email, password) {
  try {
    console.log('[Auth] Login attempt for:', email);
    
    if (!authInstance) {
      throw new Error('Firebase Auth belum siap!');
    }
    
    // Login via Firebase Auth
    const userCredential = await authInstance.signInWithEmailAndPassword(email, password);
    const firebaseUser = userCredential.user;
    
    console.log('[Auth] ✅ Firebase auth success! UID:', firebaseUser.uid);
    
    // Detect company dari email atau gunakan yang sudah dipilih sebelum login
    let detectedCompanyId = state.auth.currentCompanyId; // Pakai yang sudah dipilih di login modal
    
    if (!detectedCompanyId) {
      // Auto-detect dari email
      for (const cid of COMPANY_IDS) {
        if (COMPANY_CONFIG[cid].testCredentials?.email === email) {
          detectedCompanyId = cid;
          break;
        }
      }
    }
    
    if (!detectedCompanyId) {
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
    
    // Set company
    setCurrentCompany(detectedCompanyId);
    
    // Save session
    localStorage.setItem(CONFIG_KEYS.CURRENT_USER_SESSION, JSON.stringify({
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName || email.split('@')[0],
      companyId: detectedCompanyId,
      loginTime: new Date().toISOString()
    }));
    
    console.log(`[Auth] ✅ Login berhasil! Company: ${COMPANY_CONFIG[detectedCompanyId].displayName}`);
    
    return {
      success: true,
      user: state.auth.currentUser,
      companyId: detectedCompanyId,
      companyName: COMPANY_CONFIG[detectedCompanyId].displayName
    };
    
  } catch (error) {
    console.error('[Auth] Error:', error.code, error.message);
    
    let msg = error.message;
    if (error.code === 'auth/user-not-found') msg = 'Email tidak ditemukan!';
    else if (error.code === 'auth/wrong-password') msg = 'Password salah!';
    else if (error.code === 'auth/too-many-requests') msg = 'Terlalu banyak percobaan. Tunggu sebentar.';
    else if (error.code === 'auth/invalid-email') msg = 'Format email tidak valid!';
    
    return { success: false, error: msg };
  }
}

async function logoutUser() {
  try {
    if (authInstance) await authInstance.signOut();
    clearCurrentCompany();
    showToast('👋 Berhasil logout!', 'success');
  } catch (e) {
    showToast('Logout error: ' + e.message, 'error');
  }
}

async function restoreSession() {
  try {
    const sessionStr = localStorage.getItem(CONFIG_KEYS.CURRENT_USER_SESSION);
    if (!sessionStr) return false;
    
    const session = JSON.parse(sessionStr);
    
    // Cek apakah Firebase Auth masih aktif
    if (authInstance?.currentUser) {
      state.auth.currentUser = {
        uid: authInstance.currentUser.uid,
        email: authInstance.currentUser.email,
        displayName: authInstance.currentUser.displayName || session.displayName
      };
      state.auth.isAuthenticated = true;
      
      if (session.companyId && COMPANY_CONFIG[session.companyId]) {
        setCurrentCompany(session.companyId);
      }
      
      console.log(`[Auth] ✅ Session restored: ${state.auth.currentCompanyData?.displayName}`);
      return true;
    } else {
      console.warn('[Auth] Session expired');
      clearCurrentCompany();
      return false;
    }
  } catch (e) {
    console.error('[Auth] Restore error:', e);
    clearCurrentCompany();
    return false;
  }
}

// ==================== MAIN INITIALIZATION ====================
async function initConnection() {
  console.log('[Firebase] Starting connection...');
  
  // Update UI
  if (typeof updateStatus === 'function') updateStatus('connecting', 'Menghubungkan...');
  
  const hasConfig = !!localStorage.getItem(CONFIG_KEYS.FIREBASE_CONFIG);
  if (!hasConfig) {
    console.warn('[Firebase] No config found!');
    if (typeof updateStatus === 'function') updateStatus('error', 'Belum dikonfigurasi');
    setTimeout(() => { if (typeof openSetupModal === 'function') openSetupModal(); }, 1000);
    return;
  }

  try {
    const config = JSON.parse(localStorage.getItem(CONFIG_KEYS.FIREBASE_CONFIG));
    console.log('[Firebase] Initializing project:', config.projectId);
    
    // Initialize Firebase (hanya sekali!)
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
      console.log('[Firebase] ✅ App initialized');
    }
    
    // Initialize Auth
    authInstance = firebase.auth();
    console.log('[Firebase] ✅ Auth initialized');
    
    // Initialize Firestore
    state.db = firebase.firestore();
    
    // Test connection
    await state.db.collection('Invoice-NMSA').limit(1).get(); // Test dengan salah satu collection
    
    // Update state
    state.isConnected = true;
    state.isConnecting = false;
    
    if (typeof updateStatus === 'function') updateStatus('connected', '✅ Terhubung');
    
    // Restore session jika ada
    const restored = await restoreSession();
    if (restored) {
      console.log('[Firebase] ✅ Session restored, starting listener...');
      if (typeof applyDateFilter === 'function') applyDateFilter();
    }
    
  } catch (error) {
    console.error('[Firebase Error]:', error);
    state.isConnected = false;
    state.isConnecting = false;
    if (typeof updateStatus === 'function') updateStatus('error', 'Gagal: ' + error.message);
    showToast('Firebase error: ' + error.message, 'error');
  }
}

// ==================== SAVE CONFIG ====================
window.saveFirebaseConfig = async function() {
  try {
    const inputEl = document.getElementById('firebaseConfigInput');
    const errorEl = document.getElementById('configError');
    
    if (!inputEl?.value.trim()) {
      showError('Paste Firebase config!');
      return;
    }
    
    const config = JSON.parse(inputEl.value.trim());
    if (!config.apiKey || !config.projectId) {
      showError('Config tidak lengkap! Butuh apiKey & projectId.');
      return;
    }
    
    localStorage.setItem(CONFIG_KEYS.FIREBASE_CONFIG, inputEl.value.trim());
    showToast('Config tersimpan! Menghubungkan...', 'info');
    closeSetupModal();
    
    await initConnection();
    
  } catch (e) {
    showError('Format JSON tidak valid: ' + e.message);
  }
};

function showError(msg) {
  const el = document.getElementById('configError');
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
  showToast(msg, 'error');
}

// ==================== EXPORT ====================
window.loadSavedConfigs = loadSavedConfigs;
window.initConnection = initConnection;
window.saveFirebaseConfig = saveFirebaseConfig;
window.loginUser = loginUser;
window.logoutUser = logoutUser;
window.restoreSession = restoreSession;
window.isLoggedIn = isLoggedIn;
window.getCurrentUser = getCurrentUser;
window.getActiveCompanyId = getActiveCompanyId;
window.updateAuthUI = updateAuthUI;

console.log('%c🔥 firebase-init.js v3.5 loaded', 'color:#f97316;');
