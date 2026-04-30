/**
 * FinanceSync Pro v3.5 - Firebase Initialization
 * Config sudah di-hardcode di config.js
 * File ini hanya menangani init, auth, dan connection
 */

// ==================== AUTH STATE ====================
let authInstance = null;

// ==================== LOGIN ====================
async function loginUser(email, password) {
  try {
    console.log('[Auth] Login attempt:', email);

    if (!authInstance) throw new Error('Firebase Auth belum siap!');

    const userCredential = await authInstance.signInWithEmailAndPassword(email, password);
    const fbUser = userCredential.user;

    console.log('[Auth] Firebase auth OK — UID:', fbUser.uid);

    // Deteksi company: pakai yang sudah dipilih di login modal,
    // fallback ke deteksi dari email
    let companyId = state.auth.currentCompanyId;

    if (!companyId) {
      const em = email.toLowerCase();
      if (em.includes('nmsa')) companyId = 'nmsa';
      else if (em.includes('ipn')) companyId = 'ipn';
    }

    if (!companyId) {
      await authInstance.signOut();
      throw new Error('Tidak bisa mendeteksi perusahaan dari email ini!');
    }

    // Set state
    state.auth.currentUser = {
      uid: fbUser.uid,
      email: fbUser.email,
      displayName: fbUser.displayName || email.split('@')[0]
    };
    state.auth.isAuthenticated = true;
    setCurrentCompany(companyId);

    console.log('[Auth] Login berhasil — Company:', COMPANY_CONFIG[companyId].displayName);

    return {
      success: true,
      user: state.auth.currentUser,
      companyId: companyId,
      companyName: COMPANY_CONFIG[companyId].displayName
    };

  } catch (error) {
    console.error('[Auth] Error:', error.code, error.message);

    let msg = error.message;
    if (error.code === 'auth/user-not-found') msg = 'Email tidak ditemukan di Firebase!';
    else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') msg = 'Email atau password salah!';
    else if (error.code === 'auth/too-many-requests') msg = 'Terlalu banyak percobaan. Tunggu sebentar.';
    else if (error.code === 'auth/invalid-email') msg = 'Format email tidak valid!';

    return { success: false, error: msg };
  }
}

// ==================== LOGOUT ====================
async function logoutUser() {
  try {
    if (authInstance) await authInstance.signOut();
    clearCurrentCompany();
    state.history = [];
    state.isConnected = false;
    if (state.unsubscribeListener) { state.unsubscribeListener(); state.unsubscribeListener = null; }
    showToast('Berhasil keluar', 'info');
  } catch (e) {
    showToast('Logout error: ' + e.message, 'error');
  }
}

// ==================== MAIN INITIALIZATION ====================
async function initConnection() {
  console.log('[Firebase] Initializing...');

  if (typeof updateStatus === 'function') updateStatus('connecting', 'Menghubungkan...');

  // Cek apakah FIREBASE_CONFIG valid (dari config.js)
  if (!FIREBASE_CONFIG || !FIREBASE_CONFIG.apiKey || !FIREBASE_CONFIG.projectId) {
    console.error('[Firebase] FIREBASE_CONFIG tidak valid!');
    if (typeof updateStatus === 'function') updateStatus('error', 'Config tidak valid');
    return;
  }

  try {
    // Initialize Firebase app (hanya sekali)
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
      console.log('[Firebase] App initialized — project:', FIREBASE_CONFIG.projectId);
    }

    // Initialize Auth
    authInstance = firebase.auth();

    // Enable persistence (offline support)
    try {
      await authInstance.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    } catch (e) {
      console.warn('[Firebase] Auth persistence skipped:', e.message);
    }

    // Initialize Firestore
    state.db = firebase.firestore();

    // Enable offline persistence
    try {
      await state.db.enablePersistence({ synchronizeTabs: true });
    } catch (e) {
      console.warn('[Firebase] Firestore persistence:', e.code || e.message);
    }

    // Test koneksi — coba baca collection yang sudah ada
    // Jika collection kosong/belum ada, tetap dianggap OK
    try {
      await state.db.collection('Invoice-NMSA').limit(1).get();
    } catch (e) {
      // Permission error atau collection belum ada — masih OK kalau auth nanti jalan
      console.warn('[Firebase] Test read skipped:', e.message);
    }

    // Update state
    state.isConnected = true;
    state.isConnecting = false;

    if (typeof updateStatus === 'function') updateStatus('connected', 'Firebase terhubung');

    // Set auth state listener — ini yang mengontrol login/dashboard
    authInstance.onAuthStateChanged(function(user) {
      if (user) {
        // User sudah login (session persist atau baru login)
        state.auth.currentUser = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email.split('@')[0]
        };
        state.auth.isAuthenticated = true;

        // Auto-detect company jika belum ada
        if (!state.auth.currentCompanyId) {
          const em = user.email.toLowerCase();
          if (em.includes('nmsa')) setCurrentCompany('nmsa');
          else if (em.includes('ipn')) setCurrentCompany('ipn');
        }

        console.log('[Auth] State changed — logged in:', user.email, '| Company:', state.auth.currentCompanyId);

        // Callback ke index.html untuk show dashboard
        if (typeof window.onAuthStateChanged === 'function') {
          window.onAuthStateChanged(true);
        }

      } else {
        // User logout
        state.auth.currentUser = null;
        state.auth.isAuthenticated = false;

        console.log('[Auth] State changed — logged out');

        // Callback ke index.html untuk show login
        if (typeof window.onAuthStateChanged === 'function') {
          window.onAuthStateChanged(false);
        }
      }
    });

    console.log('[Firebase] Fully initialized — waiting for auth state...');

  } catch (error) {
    console.error('[Firebase] Init error:', error);
    state.isConnected = false;
    state.isConnecting = false;
    if (typeof updateStatus === 'function') updateStatus('error', 'Gagal: ' + error.message);
    showToast('Firebase error: ' + error.message, 'error');
  }
}

// ==================== EXPORT ====================
window.initConnection = initConnection;
window.loginUser = loginUser;
window.logoutUser = logoutUser;

console.log('%c firebase-init.js loaded | Config: ' + (FIREBASE_CONFIG?.projectId || 'NONE'), 'color:#f97316;');
