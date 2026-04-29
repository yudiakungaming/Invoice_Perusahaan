/**
 * ============================================
 * FinanceSync Pro v3.4 - Main Application Logic
 * ============================================
 * File ini berisi semua logika UI, form handling, rendering,
 * dan interaksi pengguna.
 * 
 * Version: 3.4.0
 * Update: Added Multi-Company Login & Authentication Integration
 * Date: April 2026
 *
 * ★ PERUBAHAN (v3.4):
 *    - Integrasi dengan Firebase Authentication (login/logout)
 *    - Cek company session sebelum operasi apa pun
 *    - Tampilkan company badge di header
 *    - Form login modal untuk akses multi-company
 */

// ==================== INITIALIZATION ====================

/**
 * Fungsi inisialisasi utama aplikasi
 * ★ UPDATE (v3.4): Sekarang cek auth state terlebih dahulu!
 */
function init() {
  try {
    console.log('[App] Initializing FinanceSync Pro v3.4 (Multi-Company)...');
    
    // Cache semua DOM elements
    cacheDOMElements();
    
    // Load konfigurasi tersimpan
    loadSavedConfigs();
    
    // ★★★ BARU (v3.4): Setup Login UI Elements ★★★
    setupLoginUI();
    
    // Set default tanggal ke hari ini
    const tanggalInput = document.getElementById('tanggal');
    if (tanggalInput) {
      tanggalInput.valueAsDate = new Date();
    }
    
    // Set default filter tanggal ke bulan ini
    setDefaultDateFilter();
    
    // Render form items awal
    renderFormItems();
    
    // Setup semua event listeners
    setupEventListeners();
    
    // Inisialisasi koneksi Firebase (ini juga akan restore auth session)
    initConnection();
    
    // Auto-generate nomor invoice setelah terhubung
    generateInvoiceAfterConnection();
    
    // Mulai drive status polling
    startDriveStatusPolling();
    
    // Initialize upload state
    initUploadState();
    
    // Setup cleanup saat page unload
    window.addEventListener('beforeunload', function() {
      if (state.unsubscribeListener) state.unsubscribeListener();
      stopDriveStatusPolling();
    });
    
    console.log('[App] ✅ Initialization complete!');
    
  } catch (error) {
    console.error('[Init Error]:', error);
    showToast('Error saat inisialisasi: ' + error.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ★★★ TAMBAHAN BARU (v3.4): LOGIN UI SETUP & MANAGEMENT ★★★
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Setup elemen-elemen UI untuk login dan company badge
 * Dipanggil dari init()
 */
function setupLoginUI() {
  console.log('[Login UI] Setting up login elements...');
  
  // Cek apakah elemen login sudah ada di HTML, jika tidak buat dinamis
  var loginBtn = document.getElementById('loginBtn');
  var logoutBtn = document.getElementById('logoutBtn');
  var userInfo = document.getElementById('userInfo');
  var companyBadge = document.getElementById('companyBadge');
  
  // Jika belum ada di HTML, buat secara dinamis
  if (!loginBtn) {
    createLoginUIDynamic();
  } else {
    // Sudah ada, setup event listener
    if (loginBtn) {
      loginBtn.addEventListener('click', showLoginModal);
    }
    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleLogout);
    }
  }
}

/**
 * Buat elemen login UI secara dinamis (jika tidak ada di HTML)
 */
function createLoginUIDynamic() {
  console.log('[Login UI] Creating dynamic login elements...');
  
  // Cari tempat untuk menyisipkan (biasanya di header/navbar)
  var headerArea = document.querySelector('header') || 
                   document.querySelector('.navbar') || 
                   document.querySelector('body > div:first-child');
  
  if (!headerArea) {
    console.warn('[Login UI] Tidak menemukan area header, skip dynamic creation');
    return;
  }
  
  // Buat container untuk auth info
  var authContainer = document.createElement('div');
  authContainer.id = 'authContainer';
  authContainer.className = 'auth-container';
  authContainer.innerHTML = `
    <div id="companyBadge" class="company-badge" style="display:none;">
      <span class="company-icon">🏢</span>
      <span class="company-name"></span>
    </div>
    <div id="userInfo" class="user-info" style="display:none;">
      <span class="user-name"></span>
    </div>
    <button id="loginBtn" class="btn-login" title="Login">
      🔐 Login
    </button>
    <button id="logoutBtn" class="btn-logout" style="display:none;" title="Logout">
      🚪 Logout
    </button>
  `;
  
  // Insert di awal header
  headerArea.insertBefore(authContainer, headerArea.firstChild);
  
  // Style sederhana (bisa di-override di CSS)
  var style = document.createElement('style');
  style.textContent = `
    .auth-container {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 16px;
      background: rgba(0,0,0,0.2);
      border-radius: 8px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    .company-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      background: rgba(37, 99, 235, 0.2);
      color: #60a5fa;
      border: 1px solid rgba(37, 99, 235, 0.3);
    }
    .user-info {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #e2e8f0;
    }
    .btn-login, .btn-logout {
      padding: 6px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }
    .btn-login {
      background: linear-gradient(135deg, #2563eb, #7c3aed);
      color: white;
    }
    .btn-login:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
    }
    .btn-logout {
      background: rgba(239, 68, 68, 0.2);
      color: #fca5a5;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }
    .btn-logout:hover {
      background: rgba(239, 68, 68, 0.3);
    }
    
    /* Login Modal Styles */
    .login-modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    }
    .login-modal-overlay.hidden { display: none; }
    .login-modal {
      background: #1e293b;
      border-radius: 16px;
      padding: 32px;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
      border: 1px solid #334155;
    }
    .login-modal h2 {
      color: white;
      margin-bottom: 24px;
      text-align: center;
      font-size: 22px;
    }
    .login-modal .form-group {
      margin-bottom: 16px;
    }
    .login-modal label {
      display: block;
      color: #94a3b8;
      font-size: 13px;
      margin-bottom: 6px;
      font-weight: 500;
    }
    .login-modal input {
      width: 100%;
      padding: 12px 16px;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      color: white;
      font-size: 15px;
      box-sizing: border-box;
    }
    .login-modal input:focus {
      outline: none;
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
    }
    .login-btn-submit {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #2563eb, #7c3aed);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 8px;
      transition: all 0.2s;
    }
    .login-btn-submit:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 25px rgba(37, 99, 235, 0.4);
    }
    .login-btn-submit:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    .login-error {
      background: rgba(239, 68, 68, 0.15);
      color: #fca5a5;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      margin-bottom: 16px;
      border: 1px solid rgba(239, 68, 68, 0.2);
      display: none;
    }
    .login-error.show { display: block; }
    .login-close {
      position: absolute;
      top: 16px;
      right: 16px;
      background: none;
      border: none;
      color: #64748b;
      font-size: 24px;
      cursor: pointer;
      line-height: 1;
    }
    .login-close:hover { color: white; }
    .login-hint {
      text-align: center;
      margin-top: 16px;
      font-size: 12px;
      color: #64748b;
    }
    .login-company-options {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }
    .login-company-option {
      flex: 1;
      padding: 12px;
      background: #0f172a;
      border: 2px solid #334155;
      border-radius: 10px;
      cursor: pointer;
      text-align: center;
      transition: all 0.2s;
    }
    .login-company-option:hover {
      border-color: #475569;
    }
    .login-company-option.selected {
      border-color: #2563eb;
      background: rgba(37, 99, 235, 0.1);
    }
    .login-company-option .icon {
      font-size: 28px;
      margin-bottom: 6px;
    }
    .login-company-option .name {
      font-size: 12px;
      color: #94a3b8;
      font-weight: 500;
    }
  `;
  document.head.appendChild(style);
  
  // Buat login modal
  var loginModal = document.createElement('div');
  loginModal.id = 'loginModal';
  loginModal.className = 'login-modal-overlay hidden';
  loginModal.innerHTML = `
    <div class="login-modal" style="position:relative;">
      <button class="login-close" onclick="hideLoginModal()">&times;</button>
      <h2>🔐 Login - FinanceSync Pro</h2>
      
      <div id="loginError" class="login-error"></div>
      
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="loginEmail" placeholder="admin@nmsa.com atau admin-ipn@gmail.com" autocomplete="email">
      </div>
      
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="loginPassword" placeholder="Masukkan password" autocomplete="current-password">
      </div>
      
      <button class="login-btn-submit" id="loginSubmitBtn" onclick="handleLoginForm()">
        Masuk ke Dashboard
      </button>
      
      <div class="login-hint">
        📌 Gunakan akun perusahaan Anda untuk login<br>
        Data akan difilter otomatis sesuai perusahaan
      </div>
    </div>
  `;
  document.body.appendChild(loginModal);
  
  // Attach event listeners
  setTimeout(function() {
    var btn = document.getElementById('loginBtn');
    var outBtn = document.getElementById('logoutBtn');
    if (btn) btn.addEventListener('click', showLoginModal);
    if (outBtn) outBtn.addEventListener('click', handleLogout);
    
    // Enter key submit
    var passInput = document.getElementById('loginPassword');
    if (passInput) {
      passInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') handleLoginForm();
      });
    }
  }, 100);
}

/**
 * Tampilkan modal login
 */
function showLoginModal() {
  var modal = document.getElementById('loginModal');
  if (modal) {
    modal.classList.remove('hidden');
    
    // Focus ke email field
    setTimeout(function() {
      var emailInput = document.getElementById('loginEmail');
      if (emailInput) emailInput.focus();
    }, 200);
  }
}

/**
 * Sembunyikan modal login
 */
function hideLoginModal() {
  var modal = document.getElementById('loginModal');
  if (modal) {
    modal.classList.add('hidden');
    
    // Clear form
    var emailInput = document.getElementById('loginEmail');
    var passInput = document.getElementById('loginPassword');
    var errorEl = document.getElementById('loginError');
    if (emailInput) emailInput.value = '';
    if (passInput) passInput.value = '';
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.remove('show');
    }
  }
}

/**
 * Handler untuk form login
 * Dipanggil saat user klik "Masuk" atau tekan Enter
 */
async function handleLoginForm() {
  var emailInput = document.getElementById('loginEmail');
  var passInput = document.getElementById('loginPassword');
  var submitBtn = document.getElementById('loginSubmitBtn');
  var errorEl = document.getElementById('loginError');
  
  if (!emailInput || !passInput) return;
  
  var email = emailInput.value.trim();
  var password = passInput.value;
  
  // Validasi
  if (!email || !password) {
    showLoginError('Mohon isi email dan password!');
    return;
  }
  
  // Disable button & show loading
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner"></div> Memproses...';
  }
  
  try {
    // Panggil fungsi login dari firebase-init.js
    var result = await loginUser(email, password);
    
    if (result.success) {
      // Login berhasil!
      hideLoginModal();
      showToast(`✅ Selamat datang! Anda masuk sebagai ${result.companyName}`, 'success');
      
      // Restart listener dengan company baru
      if (typeof applyDateFilter === 'function') {
        applyDateFilter();
      }
      
    } else {
      // Login gagal
      showLoginError(result.error || 'Login gagal. Periksa kembali email dan password.');
    }
    
  } catch (error) {
    showLoginError('Terjadi kesalahan: ' + error.message);
  } finally {
    // Restore button
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Masuk ke Dashboard';
    }
  }
}

/**
 * Tampilkan error di modal login
 * @param {string} msg - Pesan error
 */
function showLoginError(msg) {
  var el = document.getElementById('loginError');
  if (el) {
    el.textContent = msg;
    el.classList.add('show');
  }
}

/**
 * Handler untuk logout
 */
async function handleLogout() {
  if (!confirm('Apakah Anda yakin ingin keluar?')) return;
  
  try {
    await logoutUser();
    
    // Clear history
    state.history = [];
    if (typeof renderHistory === 'function') renderHistory();
    
    showToast('👋 Berhasil logout! Silakan login kembali.', 'info');
    
  } catch (error) {
    showToast('Gagal logout: ' + error.message, 'error');
  }
}

/**
 * Cek apakah user bisa melakukan operasi (sudah login & ada company)
 * @returns {boolean}
 */
function canPerformOperation() {
  if (!isLoggedIn()) {
    showLoginModal();
    showToast('Silakan login terlebih dahulu!', 'warning');
    return false;
  }
  
  if (!getActiveCompanyId()) {
    showToast('Tidak ada active company! Hubungi admin.', 'error');
    return false;
  }
  
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// END OF LOGIN UI SECTION
// ═══════════════════════════════════════════════════════════════════════════

// ==================== DOM ELEMENT CACHING ====================
/**
 * Cache semua DOM elements
 * ★ UPDATE (v3.4): Tambahkan elemen login/company badge
 */
function cacheDOMElements() {
  elements = {
    // Form elements
    form: document.getElementById('dataForm'),
    submitBtn: document.getElementById('submitBtn'),
    previewBtn: document.getElementById('previewBtn'),
    
    // History panel
    historyList: document.getElementById('historyList'),
    clearHistory: document.getElementById('clearHistory'),
    tabBtns: document.querySelectorAll('.tab-btn'),
    
    // Display elements
    grandTotalDisplay: document.getElementById('grandTotalDisplay'),
    statusInput: document.getElementById('status'),
    paymentDateContainer: document.getElementById('paymentDateContainer'),
    
    // Connection status
    connectionBanner: document.getElementById('connectionBanner'),
    bannerTitle: document.getElementById('bannerTitle'),
    bannerMessage: document.getElementById('bannerMessage'),
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    
    // Modals
    setupModal: document.getElementById('setupModal'),
    gasModal: document.getElementById('gasModal'),
    documentModal: document.getElementById('documentModal'),
    deleteConfirmModal: document.getElementById('deleteConfirmModal'),
    
    // Config inputs
    firebaseConfigInput: document.getElementById('firebaseConfigInput'),
    configError: document.getElementById('configError'),
    appsScriptUrlInput: document.getElementById('appsScriptUrlInput'),
    
    // Validation
    validationError: document.getElementById('validationError'),
    validationErrorList: document.getElementById('validationErrorList'),
    
    // Info banners
    archBanner: document.getElementById('archBanner'),
    editModeContainer: document.getElementById('editModeContainer'),
    
    // File upload
    uploadArea: document.getElementById('uploadArea'),
    fileListDisplay: document.getElementById('fileListDisplay'),
    uploadPlaceholder: document.getElementById('uploadPlaceholder'),
    selectedFilesActions: document.getElementById('selectedFilesActions'),
    selectedFilesCount: document.getElementById('selectedFilesCount'),
    uploadProgressContainer: document.getElementById('uploadProgressContainer'),
    uploadProgressBar: document.getElementById('uploadProgressBar'),
    driveLinkResult: document.getElementById('driveLinkResult'),
    driveLinkUrl: document.getElementById('driveLinkUrl'),
    uploadStatusText: document.getElementById('uploadStatusText'),
    uploadStatsCard: document.getElementById('uploadStatsCard'),
    
    // Sync button
    forceSyncBtn: document.getElementById('forceSyncBtn'),
    syncBtnText: document.getElementById('syncBtnText'),
    syncIcon: document.getElementById('syncIcon'),
    manualSyncStatus: document.getElementById('manualSyncStatus'),
    lastSyncInfoContainer: document.getElementById('lastSyncInfoContainer'),
    lastSyncTimeDisplay: document.getElementById('lastSyncTimeDisplay'),
    
    // Drive status
    driveStatusBanner: document.getElementById('driveStatusBanner'),
    driveStatusText: document.getElementById('driveStatusText'),
    driveStatusBadge: document.getElementById('driveStatusBadge'),
    
    // Stats
    totalData: document.getElementById('totalData'),
    sentData: document.getElementById('sentData'),
    sheetsData: document.getElementById('sheetsData'),
    pendingData: document.getElementById('pendingData')
  };
}

// ==================== DATE FILTER DEFAULT ====================
function setDefaultDateFilter() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  state.filterDateFrom = firstDay.toISOString().split('T')[0];
  state.filterDateTo = lastDay.toISOString().split('T')[0];

  const fromInput = document.getElementById('filterDateFrom');
  const toInput = document.getElementById('filterDateTo');

  if (fromInput) fromInput.value = state.filterDateFrom;
  if (toInput) toInput.value = state.filterDateTo;
}

// ==================== AUTO GENERATE INVOICE ====================
function generateInvoiceAfterConnection() {
  let attempts = 0;
  const maxAttempts = 20;

  const checkInterval = setInterval(async function() {
    attempts++;

    if (state.db && state.isConnected) {
      clearInterval(checkInterval);

      // ★★★ BARU (v3.4): Cek juga apakah sudah login & ada company ★★★
      if (!isLoggedIn() || !getActiveCompanyId()) {
        console.log('[Auto Invoice] Skip: User belum login atau tidak ada active company');
        return;
      }

      try {
        const invoice = await autoGenerateInvoice();

        if (invoice && !document.getElementById('no_invoice').value) {
          document.getElementById('no_invoice').value = invoice;
          console.log('[App] Auto-generated invoice:', invoice);
        }
      } catch (e) {
        console.warn('[Auto Invoice] Failed:', e.message);
      }

    } else if (attempts >= maxAttempts) {
      clearInterval(checkInterval);
      console.warn('[Auto Invoice] Max attempts reached, giving up');
    }
  }, 500);
}

// ==================== EVENT LISTENERS SETUP ====================
/**
 * Setup semua event listeners
 * ★ UPDATE (v3.4): Tambah validasi auth di beberapa action
 */
function setupEventListeners() {
  
  // === FORM SUBMIT ===
  if (elements.form) {
    elements.form.addEventListener('submit', handleSubmit);
  }

  // === PREVIEW BUTTON ===
  if (elements.previewBtn) {
    elements.previewBtn.addEventListener('click', function() {
      // ★★★ BARU (v3.4): Cek login sebelum preview ★★★
      if (!canPerformOperation()) return;
      handlePreview();
    });
  }

  // === STATUS CHANGE ===
  if (elements.statusInput) {
    elements.statusInput.addEventListener('change', function(e) {
      if (elements.paymentDateContainer) {
        elements.paymentDateContainer.style.display = 
          e.target.value === 'Lunas' ? 'block' : 'none';
      }
    });

    if (elements.statusInput.value !== 'Lunas' && elements.paymentDateContainer) {
      elements.paymentDateContainer.style.display = 'none';
    }
  }

  // === CLEAR HISTORY ===
  if (elements.clearHistory) {
    elements.clearHistory.addEventListener('click', function() {
      // ★★★ BARU (v3.4): Cek login sebelum hapus ★★★
      if (!canPerformOperation()) return;
      
      if (confirm('Hapus SEMUA data dari Firebase? (Hanya data company ini)')) {
        deleteAllSubmissions()
          .then(function() {
            showToast('Semua data dihapus', 'success');
          })
          .catch(function(err) {
            showToast('Error: ' + err.message, 'error');
          });
      }
    });
  }

  // === TAB BUTTONS ===
  if (elements.tabBtns) {
    elements.tabBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        elements.tabBtns.forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        
        state.currentTab = btn.dataset.tab;
        renderHistory();
      });
    });
  }

  // === DATE FILTER INPUTS ===
  const filterFrom = document.getElementById('filterDateFrom');
  const filterTo = document.getElementById('filterDateTo');

  if (filterFrom) {
    filterFrom.addEventListener('change', function() {
      state.filterDateFrom = this.value;
      applyDateFilter();
    });
  }

  if (filterTo) {
    filterTo.addEventListener('change', function() {
      state.filterDateTo = this.value;
      applyDateFilter();
    });
  }

  // === KEYBOARD SHORTCUTS ===
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeSetupModal();
      closeDocumentModal();
      closeDeleteModal();
      closeGasModal();
      hideLoginModal(); // ★★★ BARU (v3.4) ★★★
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (elements.form && !elements.submitBtn.disabled) {
        // ★★★ BARU (v3.4): Cek login sebelum save ★★★
        if (!canPerformOperation()) return;
        elements.form.dispatchEvent(new Event('submit'));
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      if (!elements.documentModal?.classList.contains('show')) {
        e.preventDefault();
        if (canPerformOperation()) handlePreview(); // ★★★ BARU (v3.4) ★★★
      }
    }
  });

  // === FORM RESET ===
  if (elements.form) {
    elements.form.addEventListener('reset', function() {
      setTimeout(function() {
        state.items = [{ ket: '', qty: '', nominal: 0, keterangan: '' }];
        state.selectedFiles = [];
        
        updateFileDisplay();
        renderFormItems();
        clearEditMode();
        
        const t = document.getElementById('tanggal');
        if (t) t.valueAsDate = new Date();
        
        if (elements.statusInput?.value !== 'Lunas' && elements.paymentDateContainer) {
          elements.paymentDateContainer.style.display = 'none';
        }
        
        resetSubmitButton();
        hideUploadProgress();
        
        const driveResult = document.getElementById('driveLinkResult');
        if (driveResult) driveResult.classList.remove('show');
        
        // ★★★ BARU (v3.4): Auto-generate invoice baru setelah reset ★★★
        if (isLoggedIn() && getActiveCompanyId()) {
          autoGenerateInvoice().then(function(inv) {
            const ni = document.getElementById('no_invoice');
            if (inv) ni.value = inv;
          });
        }
        
      }, 10);
    });
  }
  
  // Apps Script URL input listener
  const appsScriptInput = document.getElementById('appsScriptUrlInput');
  if (appsScriptInput) {
    appsScriptInput.addEventListener('change', function() {
      if (this.value.trim()) {
        console.log('[Apps Script URL] Updated:', this.value.substring(0, 50) + '...');
      }
    });
  }
}

// ==================== FORM ITEMS MANAGEMENT ====================
function renderFormItems() {
  const container = document.getElementById('itemsContainer');
  if (!container) return;

  container.innerHTML = '';

  state.items.forEach(function(item, index) {
    const row = document.createElement('div');
    row.className = 'grid grid-cols-12 gap-2 items-start';
    
    row.innerHTML = `
      <div class="col-span-4">
        <label class="field-label text-[10px]">Item<span class="required-star">*</span></label>
        <input type="text" class="input-field text-sm" placeholder="Nama barang/jasa"
               value="${escapeHtml(item.ket)}"
               oninput="updateItem(${index}, 'ket', this.value)">
      </div>
      <div class="col-span-2">
        <label class="field-label text-[10px]">Jumlah</label>
        <input type="text" class="input-field text-sm text-center" placeholder="1"
               value="${escapeHtml(item.qty)}"
               oninput="updateItem(${index}, 'qty', this.value)">
      </div>
      <div class="col-span-3">
        <label class="field-label text-[10px]">Nominal<span class="required-star">*</span></label>
        <div class="currency-wrapper">
          <span class="prefix" style="font-size:12px">Rp</span>
          <input type="number" class="input-field text-sm mono" placeholder="0"
                 value="${item.nominal || ''}"
                 oninput="updateItem(${index}, 'nominal', this.value)">
        </div>
      </div>
      <div class="col-span-2">
        <label class="field-label text-[10px]">Ket.</label>
        <input type="text" class="input-field text-sm" placeholder="Keterangan"
               value="${escapeHtml(item.keterangan || '')}"
               oninput="updateItem(${index}, 'keterangan', this.value)">
      </div>
      <div class="col-span-1 flex justify-end">
        ${state.items.length > 1 
          ? `<button type="button" onclick="removeFormItem(${index})" class="btn-remove-item" title="Hapus">
               <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                       d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
               </svg>
             </button>`
          : '<div style="height:38px"></div>'
        }
      </div>
    `;

    container.appendChild(row);
  });

  calculateTotal();
}

window.addFormItem = function() {
  state.items.push({ ket: '', qty: '', nominal: 0, keterangan: '' });
  renderFormItems();
};

window.removeFormItem = function(index) {
  if (state.items.length <= 1) return;
  state.items.splice(index, 1);
  renderFormItems();
};

window.updateItem = function(index, key, value) {
  state.items[index][key] = value;
  if (key === 'nominal') calculateTotal();
};

function calculateTotal() {
  const total = state.items.reduce(function(acc, curr) {
    return acc + (parseInt(curr.nominal) || 0);
  }, 0);

  if (elements.grandTotalDisplay) {
    elements.grandTotalDisplay.value = formatNumber(total);
  }

  return total;
}

// ==================== FILE UPLOAD HANDLING ====================
window.handleFileSelect = function(input) {
  const files = Array.from(input.files);

  if (files.length === 0) {
    state.selectedFiles = [];
    updateFileDisplay();
    return;
  }

  console.log('[File Select] Files selected:', files.length);
  
  var maxSize = (typeof UPLOAD_CONFIG !== 'undefined') 
    ? UPLOAD_CONFIG.maxSizeBytes 
    : 30 * 1024 * 1024;
  
  var errors = [];
  var validFiles = [];
  
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    
    var validation;
    if (typeof validateFile === 'function') {
      validation = validateFile(file);
    } else {
      validation = {
        valid: file.size <= maxSize,
        errors: file.size > maxSize 
          ? ['File ' + file.name + ' terlalu besar! Maksimal ' + (maxSize / 1024 / 1024) + 'MB'] 
          : []
      };
    }
    
    if (!validation.valid) {
      errors = errors.concat(validation.errors);
    } else {
      validFiles.push(file);
      
      var warningSize = (typeof UPLOAD_CONFIG !== 'undefined') 
        ? UPLOAD_CONFIG.warningSizeBytes 
        : 10 * 1024 * 1024;
        
      if (file.size > warningSize) {
        console.warn('[File Select] Large file:', file.name, '(' + (file.size/1024/1024).toFixed(2) + 'MB)');
      }
    }
  }
  
  if (errors.length > 0) {
    showToast('❌ ' + errors[0], 'error');
    if (validFiles.length === 0) {
      input.value = '';
      return;
    }
  }
  
  state.selectedFiles = [];
  let processed = 0;
  
  console.log('[File Select] Processing', validFiles.length, 'valid files...');

  validFiles.forEach(function(file, index) {
    var convertPromise;
    
    if (typeof fileToBase64 === 'function') {
      convertPromise = fileToBase64(file);
    } else {
      convertPromise = new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onload = function(e) {
          resolve(e.target.result.split(',')[1]);
        };
        reader.onerror = function() { reject(new Error('Gagal membaca file')); };
        reader.readAsDataURL(file);
      });
    }
    
    convertPromise.then(function(base64) {
      state.selectedFiles.push({
        name: file.name,
        type: file.type,
        size: file.size,
        base64: base64,
        lastModified: file.lastModified
      });

      processed++;

      if (processed === validFiles.length) {
        updateFileDisplay();
        console.log('[File Select] Ready:', state.selectedFiles.length, 'files');
        
        if (validFiles.length > 0) {
          showToast(
            validFiles.length + ' file siap diupload (' + 
            validFiles.map(f => (f.size/1024).toFixed(1) + 'KB').join(', ') + ')',
            'info'
          );
        }
      }
    }).catch(function(error) {
      console.error('[File Select] Error processing', file.name, ':', error);
      showToast('Gagal membaca file: ' + file.name, 'error');
      
      processed++;
      if (processed === validFiles.length) {
        updateFileDisplay();
      }
    });
  });
};

window.handleExternalFiles = function(files) {
  if (!files || files.length === 0) return;
  
  var fileArray = Array.from(files);
  var fakeInput = { files: fileArray };
  window.handleFileSelect(fakeInput);
};

// ==================== FILE DISPLAY FUNCTIONS ====================
function updateFileDisplay() {
  const display = elements.fileListDisplay;
  const placeholder = elements.uploadPlaceholder;
  const area = elements.uploadArea;
  const actionsBar = elements.selectedFilesActions;
  const countEl = elements.selectedFilesCount;

  if (!display || !placeholder || !area) return;

  if (state.selectedFiles.length > 0) {
    placeholder.style.display = 'none';
    area.classList.add('has-file');

    if (actionsBar) actionsBar.style.display = 'flex';
    if (countEl) countEl.textContent = state.selectedFiles.length + ' file dipilih';

    if (typeof renderSelectedFilesList === 'function') {
      renderSelectedFilesList(state.selectedFiles);
    } else {
      display.innerHTML = state.selectedFiles.map(function(file, index) {
        const sizeStr = (typeof formatFileSize === 'function') 
          ? formatFileSize(file.size) 
          : (file.size / 1024).toFixed(1) + ' KB';
        
        let icon = '📄';
        if (file.type.startsWith('image/')) icon = '🖼️';
        else if (file.type.includes('pdf')) icon = '📕';
        else if (file.type.includes('sheet') || file.type.includes('excel')) icon = '📊';
        else if (file.type.includes('word') || file.type.includes('document')) icon = '📝';

        return `
          <div class="file-item-card" data-index="${index}">
            <div class="file-item-icon ${file.type.split('/')[0]}" title="${file.type}">
              ${icon}
            </div>
            <div class="file-item-info">
              <div class="file-item-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
              <div class="file-item-size">${sizeStr}</div>
            </div>
            <button type="button" 
                    onclick="removeSelectedFile(${index})" 
                    class="file-item-remove"
                    title="Hapus file ini">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        `;
      }).join('');
    }
    
  } else {
    placeholder.style.display = 'block';
    area.classList.remove('has-file');
    display.innerHTML = '';
    
    if (actionsBar) actionsBar.style.display = 'none';
    
    const driveResult = document.getElementById('driveLinkResult');
    if (driveResult) driveResult.classList.remove('show');
  }
}

// ==================== FORM VALIDATION ====================
function validateForm() {
  const errors = [];
  const fd = new FormData(elements.form);

  // ★★★ BARU (v3.4): Cek login dulu! ★★★
  if (!isLoggedIn()) {
    errors.push('Anda belum login! Silakan login terlebih dahulu.');
    showLoginModal();
  }
  
  if (!getActiveCompanyId()) {
    errors.push('Tidak ada active company! Hubungi administrator.');
  }

  if (!fd.get('tanggal')) errors.push('Tanggal Invoice wajib diisi');
  if (!fd.get('lokasi')) errors.push('Lokasi wajib diisi');
  if (!fd.get('jenis_pengajuan')) errors.push('Jenis Pengajuan wajib diisi');
  if (!fd.get('kode')) errors.push('Kode wajib diisi');
  if (!fd.get('status')) errors.push('Status Pembayaran wajib dipilih');
  if (!fd.get('dibayarkan_kepada')) errors.push('Dibayarkan Kepada wajib diisi');

  if (state.items.length === 0 || state.items.every(i => !i.ket.trim())) {
    errors.push('Minimal 1 item barang/jasa harus diisi');
  } else {
    state.items.forEach(function(item, idx) {
      if (!item.ket.trim()) errors.push(`Item #${idx + 1}: Nama kosong`);
      if (!item.nominal || parseInt(item.nominal) <= 0) {
        errors.push(`Item #${idx + 1}: Nominal harus > 0`);
      }
    });
  }

  if (errors.length > 0 && elements.validationErrorList && elements.validationError) {
    elements.validationErrorList.innerHTML = errors.map(e => `<li>${escapeHtml(e)}</li>`).join('');
    elements.validationError.classList.add('show');
    return false;
  }

  if (elements.validationError) elements.validationError.classList.remove('show');
  
  return true;
}

// ==================== GET FORM DATA ====================
function getFormData() {
  const fd = new FormData(elements.form);

  return {
    tanggal: fd.get('tanggal') || '',
    lokasi: fd.get('lokasi') || '',
    kode: fd.get('kode') || '',
    jenis_pengajuan: fd.get('jenis_pengajuan') || '',
    no_invoice: fd.get('no_invoice') || '',
    status: fd.get('status') || '',
    items: state.items.map(i => ({
      ket: i.ket,
      qty: i.qty,
      nominal: parseInt(i.nominal) || 0,
      keterangan: i.keterangan
    })),
    total_nominal: calculateTotal(),
    tanggal_pembayaran: fd.get('tanggal_pembayaran') || '',
    dibayarkan_kepada: fd.get('dibayarkan_kepada') || '',
    catatan_tambahan: fd.get('catatan_tambahan') || ''
  };
}

// ==================== FORM SUBMISSION HANDLER ====================
/**
 * Handler untuk form submission
 * ★ UPDATE (v3.4): Validasi auth di awal
 */
async function handleSubmit(e) {
  e.preventDefault();

  // ★★★ BARU (v3.4): Cek login & company ★★★
  if (!canPerformOperation()) {
    return;
  }

  if (!validateForm()) {
    showToast('Mohon lengkapi semua field yang ditandai *', 'error');
    return;
  }

  if (!state.db) {
    showToast('Firebase belum terhubung. Setup dulu.', 'error');
    openSetupModal();
    return;
  }

  const data = getFormData();
  const isEditMode = !!state.editingDocId;
  let saveSuccess = false;

  try {
    if (!isEditMode) {
      elements.submitBtn.disabled = true;
      elements.submitBtn.innerHTML = '<div class="spinner"></div><span>Mengecek duplikat...</span>';

      if (await checkDuplicate(data)) {
        showToast('Transaksi duplikat!', 'error');
        elements.submitBtn.disabled = false;
        resetSubmitButton();
        return;
      }

      if (!data.no_invoice.trim()) {
        elements.submitBtn.innerHTML = '<div class="spinner"></div><span>Generate No Invoice...</span>';
        data.no_invoice = await autoGenerateInvoice();
        
        const ni = document.getElementById('no_invoice');
        if (ni) ni.value = data.no_invoice;
      }
    }

    elements.submitBtn.disabled = true;
    elements.submitBtn.innerHTML = '<div class="spinner"></div><span>Menyimpan...</span>';

    var hasFiles = state.selectedFiles && state.selectedFiles.length > 0;
    var useAppsScript = isAppsScriptConfigured && typeof isAppsScriptConfigured === 'function' 
                        ? isAppsScriptConfigured() 
                        : false;

    console.log('[Submit] Save configuration:', {
      hasFiles: hasFiles,
      fileCount: state.selectedFiles ? state.selectedFiles.length : 0,
      useAppsScript: useAppsScript,
      isEditMode: isEditMode,
      companyId: getActiveCompanyId() // ★★★ LOG (v3.4) ★★★
    });

    let savedDocId;

    if (hasFiles && useAppsScript && !isEditMode) {
      console.log('[Submit] Using: smartSaveSubmission with file...');
      
      elements.submitBtn.innerHTML = '<div class="spinner"></div><span>Mengupload file ke Google Drive...</span>';
      
      if (typeof updateUploadProgress === 'function') {
        updateUploadProgress(20, 'Mempersiapkan data...');
      }
      
      var fileToUpload = state.selectedFiles[0];
      
      var saveResult;
      if (typeof smartSaveSubmission === 'function') {
        saveResult = await smartSaveSubmission(data, fileToUpload);
      } else if (typeof saveSubmissionWithFile === 'function') {
        saveResult = await saveSubmissionWithFile(data, fileToUpload);
      } else {
        throw new Error('Save function not available!');
      }
      
      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Gagal menyimpan via Apps Script');
      }
      
      savedDocId = saveResult.docId;
      console.log('[Submit] ✅ Saved via Apps Script! ID:', savedDocId);
      
      showToast(
        saveResult.message || '✅ Data & file berhasil disimpan!',
        'drive'
      );
      
    } else if (hasFiles && !useAppsScript) {
      console.warn('[Submit] Has file but Apps Script not configured!');
      
      showToast(
        '⚠️ Data akan disimpan, tetapi file TIDAK diupload ke Google Drive!\n' +
        'Configure Apps Script URL di Setup untuk mengaktifkan upload.',
        'warning'
      );
    }
    
    if (!savedDocId) {
      elements.submitBtn.innerHTML = '<div class="spinner"></div><span>Menyimpan ke Firebase...</span>';

      let uploadedFiles = [];
      
      if (state.selectedFiles.length > 0) {
        uploadedFiles = state.selectedFiles.map(file => ({
          name: file.name,
          type: file.type,
          size: file.size,
          base64Data: file.base64,
          uploadedAt: new Date().toISOString(),
          status: 'pending_drive_upload',
          driveUrl: null,
          syncedAt: null
        }));
        
        console.log('[Submit] Files converted to Base64:', uploadedFiles.length, 'files');
      }

      const firebaseData = {
        ...data,
        source: 'FinanceSync Pro v3.4 (Multi-Company)',
        files: uploadedFiles,
        synced_to_sheets: false,
        synced_at: null,
        sheets_error: null
      };

      // ★★★ UPDATE (v3.4): Pakai signatures dari company config ★★★
      var signaturesToUse = DEFAULT_SIGNATORIES;
      if (typeof ConfigHelper !== 'undefined' && typeof ConfigHelper.getSignaturesForCompany === 'function') {
        var companySignatures = ConfigHelper.getSignaturesForCompany(getActiveCompanyId());
        if (companySignatures) signaturesToUse = companySignatures;
      }
      Object.assign(firebaseData, signaturesToUse);

      if (isEditMode) {
        await updateSubmission(state.editingDocId, firebaseData);
        savedDocId = state.editingDocId;
        console.log('[Firebase] ✅ Updated! ID:', savedDocId);
      } else {
        const docRef = await withTimeout(
          createSubmission(firebaseData),
          15000,
          'Firebase write'
        );
        
        savedDocId = docRef.id;
        console.log('[Firebase] ✅ Saved! ID:', savedDocId);
      }
      
      showToast(
        (isEditMode ? 'Berhasil diupdate!' : '✅ Berhasil Disimpan!') + 
        (uploadedFiles.length > 0 ? ' Menunggu sync...' : ''),
        uploadedFiles.length > 0 ? 'drive' : 'success'
      );
    }

    state.lastSavedDocId = savedDocId;
    state.lastFormData = Object.assign({}, data, { id: savedDocId });
    saveSuccess = true;

    updateDriveStatusBanner(
      'pending',
      '⏳ Menunggu sync ke Spreadsheet... (Klik "Sync ke Sheets" untuk langsung!)'
    );

    populateDocuments(data);
    if (elements.documentModal) elements.documentModal.classList.add('show');

    if (state.appsScriptUrl || (typeof getAppsScriptUrl === 'function' && getAppsScriptUrl())) {
      setTimeout(function() {
        console.log('[Auto-Trigger] Calling triggerManualSync in 2 seconds...');
        triggerManualSync();
      }, 2000);
    }

  } catch (error) {
    console.error('[Submit Error]:', error);
    
    let errorMsg = error.message || 'Unknown error';
    
    if (errorMsg.indexOf('PERMISSION_DENIED') > -1 || 
        errorMsg.indexOf('Missing or insufficient permissions') > -1) {
      errorMsg = 'Permission denied! Cek Firestore Rules.';
    }
    
    if (errorMsg.includes('Tidak ada active company') || errorMsg.includes('belum login')) {
      showLoginModal(); // ★★★ BARU (v3.4): Buka login modal ★★★
    }
    
    showToast('Gagal menyimpan: ' + errorMsg, 'error');
  }

  elements.submitBtn.disabled = false;

  if (saveSuccess) {
    clearEditMode();
    
    if (elements.form) elements.form.reset();
    
    state.items = [{ ket: '', qty: '', nominal: 0, keterangan: '' }];
    state.selectedFiles = [];
    
    updateFileDisplay();
    renderFormItems();
    
    const t = document.getElementById('tanggal');
    if (t) t.valueAsDate = new Date();
    
    if (elements.statusInput?.value !== 'Lunas' && elements.paymentDateContainer) {
      elements.paymentDateContainer.style.display = 'none';
    }
    
    resetSubmitButton();
    
    if (typeof hideUploadProgress === 'function') {
      hideUploadProgress();
    }
    
    // ★★★ UPDATE (v3.4): Auto-generate dengan prefix company ★★★
    if (isLoggedIn() && getActiveCompanyId()) {
      autoGenerateInvoice().then(function(inv) {
        const ni = document.getElementById('no_invoice');
        if (inv) ni.value = inv;
      });
    }
    
  } else {
    resetSubmitButton(isEditMode);
  }
}

// ==================== RESET SUBMIT BUTTON ====================
function resetSubmitButton(isEdit) {
  if (!elements.submitBtn) return;

  if (isEdit) {
    elements.submitBtn.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002-4 2v-5m-1.414-9.414a2 2 0 112.828L11.828 15H9v-2.828l8.586-8.586z"/>
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
      </svg>
      <span>Update Transaksi</span>
    `;
  } else {
    // ★★★ UPDATE (v3.4): Tampilkan nama company di tombol ★★★
    var companyInfo = '';
    var company = getCurrentCompanyConfig();
    if (company) {
      companyInfo = ` (${company.displayName})`;
    }
    
    elements.submitBtn.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 3z"/>
      </svg>
      <span>💾 Simpan${companyInfo}</span>
    `;
  }
}

// ==================== DOCUMENT PREVIEW FUNCTIONS ====================
function handlePreview() {
  const data = getFormData();

  if (data.items.length === 0 || data.items.every(i => !i.ket)) {
    showToast('Lengkapi minimal 1 item', 'error');
    return;
  }

  state.lastFormData = data;
  populateDocuments(data);
  
  if (elements.documentModal) {
    elements.documentModal.classList.add('show');
  }
}

/**
 * Populate data ke template dokumen
 * ★ UPDATE (v3.4): Pakai signatures dari company config
 */
function populateDocuments(data) {
  const ft = 'Rp ' + formatNumber(data.total_nominal);

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '-';
  };

  // === PAGE 1 ===
  setVal('p1_lokasi', data.lokasi);
  setVal('p1_tanggal', formatDate(data.tanggal));
  setVal('p1_kode', data.kode);
  setVal('p1_jenis', data.jenis_pengajuan);
  setVal('p1_total', ft);
  
  // ★★★ UPDATE (v3.4): Signatures dari company atau fallback ★★★
  var sigDibuat = data.dibuat_oleh;
  var sigDisetujui = data.disetujui_oleh;
  var sigKeuangan = data.keuangan;
  var sigDirKeuangan = data.dir_keuangan;
  var sigDirektur = data.direktur_utama;
  var sigAccounting = data.accounting;
  
  // Jika tidak ada di data, pakai default/global
  if (!sigDibuat && typeof DEFAULT_SIGNATORIES !== 'undefined') sigDibuat = DEFAULT_SIGNATORIES.dibuat_oleh;
  if (!sigDisetujui && typeof DEFAULT_SIGNATORIES !== 'undefined') sigDisetujui = DEFAULT_SIGNATORIES.disetujui_oleh;
  if (!sigKeuangan && typeof DEFAULT_SIGNATORIES !== 'undefined') sigKeuangan = DEFAULT_SIGNATORIES.keuangan;
  if (!sigDirKeuangan && typeof DEFAULT_SIGNATORIES !== 'undefined') sigDirKeuangan = DEFAULT_SIGNATORIES.dir_keuangan;
  if (!sigDirektur && typeof DEFAULT_SIGNATORIES !== 'undefined') sigDirektur = DEFAULT_SIGNATORIES.direktur_utama;
  if (!sigAccounting && typeof DEFAULT_SIGNATORIES !== 'undefined') sigAccounting = DEFAULT_SIGNATORIES.accounting;
  
  setVal('p1_dibuat', sigDibuat);
  setVal('p1_disetujui', sigDisetujui);

  const p1Body = document.getElementById('p1_table_body');
  if (p1Body) {
    p1Body.innerHTML = data.items.map((item, idx) => `
      <tr>
        <td class="col-no">${idx + 1}</td>
        <td class="col-item">${escapeHtml(item.ket)}</td>
        <td class="col-vol">${escapeHtml(item.qty)}</td>
        <td class="col-nominal">${item.nominal ? 'Rp ' + formatNumber(item.nominal) : '-'}</td>
        <td class="col-ket">${escapeHtml(item.keterangan || '-')}</td>
      </tr>
    `).join('');
  }

  const hasNote = data.catatan_tambahan && data.catatan_tambahan.trim;
  ['p1_notes_manual_wrapper', 'p2_notes_manual_wrapper'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = hasNote ? 'block' : 'none';
  });

  if (hasNote) {
    const p1n = document.getElementById('p1_notes_manual');
    const p2n = document.getElementById('p2_notes_manual');
    if (p1n) p1n.textContent = data.catatan_tambahan.trim();
    if (p2n) p2n.textContent = data.catatan_tambahan.trim();
  }

  // === PAGE 2 ===
  setVal('p2_tanggal', formatDate(data.tanggal));
  setVal('p2_kode', data.kode);
  setVal('p2_dibayarkan', data.dibayarkan_kepada);
  setVal('p2_jenis', data.jenis_pengajuan);
  setVal('p2_total', ft);
  setVal('p2_name_keuangan', sigKeuangan);
  setVal('p2_name_dirkeuangan', sigDirKeuangan);
  setVal('p2_name_direktur', sigDirektur);
  setVal('p2_name_accounting', sigAccounting);

  const p2Body = document.getElementById('p2_table_body');
  if (p2Body) {
    p2Body.innerHTML = data.items.map((item, idx) => `
      <tr>
        <td style="text-align:center">${idx + 1}</td>
        <td>${escapeHtml(item.ket)}</td>
        <td style="text-align:center">${escapeHtml(item.qty)}</td>
        <td style="text-align:right">${item.nominal ? 'Rp ' + formatNumber(item.nominal) : '-'}</td>
      </tr>
    `).join('');
  }
}

async function downloadAsPDF() {
  const element = document.getElementById('pdf-wrapper');
  if (!element) return;

  const opt = {
    margin: 0,
    filename: `Invoice_${state.lastFormData?.kode || 'FinanceSync'}_${new Date().toISOString().split('T')[0]}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  showToast('Membuat PDF...', 'info');

  try {
    await html2pdf().set(opt).from(element).save();
    showToast('PDF berhasil didownload!', 'success');
  } catch (error) {
    console.error('[PDF Error]:', error);
    showToast('Gagal membuat PDF: ' + error.message, 'error');
  }
}

window.downloadAsPDF = downloadAsPDF;

// ==================== MODAL MANAGEMENT ====================
window.openSetupModal = function() {
  console.log('[Setup] Opening modal...');
  const modal = document.getElementById('setupModal');
  
  if (modal) {
    modal.classList.add('show');
    
    const savedConfig = localStorage.getItem(CONFIG_KEYS.FIREBASE_CONFIG);
    if (savedConfig && elements.firebaseConfigInput) {
      elements.firebaseConfigInput.value = savedConfig;
    }
    
    const savedUrl = localStorage.getItem(CONFIG_KEYS.APPS_SCRIPT_URL);
    const urlInput = document.getElementById('appsScriptUrlInput');
    if (savedUrl && urlInput) {
      urlInput.value = savedUrl;
    }
  }
};

window.closeSetupModal = function() {
  const modal = document.getElementById('setupModal');
  if (modal) modal.classList.remove('show');
};

window.openGasModal = function() {
  const modal = document.getElementById('gasModal');
  if (modal) {
    modal.classList.add('show');
    loadAppsScriptCode();
  }
};

window.closeGasModal = function() {
  const modal = document.getElementById('gasModal');
  if (modal) modal.classList.remove('show');
};

function openDocumentModal() {
  if (elements.documentModal) {
    elements.documentModal.classList.add('show');
  }
}

window.closeDocumentModal = function() {
  if (elements.documentModal) {
    elements.documentModal.classList.remove('show');
  }
};

window.openDeleteModal = function(docId, kode, nominal) {
  // ★★★ BARU (v3.4): Cek login sebelum hapus ★★★
  if (!canPerformOperation()) return;
  
  state.pendingDeleteId = docId;
  state.pendingDeleteKode = kode;

  const infoEl = document.getElementById('deleteItemInfo');
  if (infoEl) {
    infoEl.textContent = `Kode: ${kode || '-'} • Rp ${formatNumber(nominal || 0)}`;
  }

  const modal = document.getElementById('deleteConfirmModal');
  if (modal) modal.classList.add('show');
};

window.closeDeleteModal = function() {
  const modal = document.getElementById('deleteConfirmModal');
  if (modal) modal.classList.remove('show');
  
  state.pendingDeleteId = null;
  state.pendingDeleteKode = null;
};

window.confirmDelete = async function() {
  if (!state.pendingDeleteId || !state.db) return;

  try {
    await deleteSubmission(state.pendingDeleteId);
    showToast('Data berhasil dihapus!', 'success');
    closeDeleteModal();
  } catch (error) {
    showToast('Gagal menghapus: ' + error.message, 'error');
  }
};

// ==================== APPS SCRIPT CODE DISPLAY ====================
function loadAppsScriptCode() {
  const codeContainer = document.getElementById('gasCodeContent');
  if (!codeContainer) return;

  const appsScriptCode = `/**
 * FinanceSync Pro v3.4 - Google Apps Script Backend
 */`;

  codeContainer.textContent = appsScriptCode;
}

window.copyGasCode = function() {
  const codeContainer = document.getElementById('gasCodeContent');
  if (!codeContainer) return;

  navigator.clipboard.writeText(codeContainer.textContent)
    .then(() => {
      showToast('✅ Kode Apps Script disalin ke clipboard!', 'success');
    })
    .catch(err => {
      console.error('Copy failed:', err);
      showToast('Gagal menyalin kode', 'error');
    });
};

// ==================== EDIT TRANSACTION ====================
/**
 * Edit transaksi dari riwayat
 * ★ UPDATE (v3.4): Cek ownership/login
 */
window.editTransaction = async function(docId) {
  // ★★★ BARU (v3.4): Cek login ★★★
  if (!canPerformOperation()) return;
  
  if (!state.db || !docId) {
    showToast('Tidak dapat mengedit: Firebase tidak terhubung', 'error');
    return;
  }

  try {
    document.querySelector('.lg\\:col-span-3')?.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'start' 
    });

    if (elements.editModeContainer) {
      elements.editModeContainer.innerHTML = `
        <div class="edit-banner">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-[--firebase] animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span class="text-sm font-medium text-[--firebase]">Memuat data...</span>
          </div>
        </div>
      `;
    }

    const docData = await getSubmissionById(docId);
    
    if (!docData) {
      showToast('Data tidak ditemukan!', 'error');
      clearEditMode();
      return;
    }

    state.editingDocId = docId;
    state.lastSavedDocId = docId;

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };

    setVal('tanggal', docData.tanggal);
    setVal('lokasi', docData.lokasi);
    setVal('jenis_pengajuan', docData.jenis_pengajuan);
    setVal('kode', docData.kode);
    setVal('no_invoice', docData.no_invoice);
    setVal('status', docData.status);
    setVal('tanggal_pembayaran', docData.tanggal_pembayaran);
    setVal('dibayarkan_kepada', docData.dibayarkan_kepada);
    setVal('catatan_tambahan', docData.catatan_tambahan);

    if (docData.items && docData.items.length > 0) {
      state.items = docData.items.map(i => ({
        ket: i.ket || '',
        qty: i.qty || '',
        nominal: i.nominal || 0,
        keterangan: i.keterangan || ''
      }));
    } else {
      state.items = [{ ket: '', qty: '', nominal: 0, keterangan: '' }];
    }

    state.selectedFiles = [];
    if (docData.files && docData.files.length > 0) {
      state.selectedFiles = docData.files
        .map(f => {
          const fData = f.mapValue?.fields || f;
          return {
            name: fData.name?.stringValue || fData.name || 'file',
            type: fData.type?.stringValue || fData.type || 'application/octet-stream',
            size: parseInt(fData.size?.integerValue || fData.size || 0),
            base64: fData.base64Data?.stringValue || fData.base64Data || ''
          };
        })
        .filter(f => f.base64);
    }
    
    if (docData.google_drive_link && !state.selectedFiles.length) {
      state.selectedFiles = [{
        name: docData.nama_file || 'Google Drive File',
        type: 'application/vnd.google-apps.file',
        size: docData.file_size || 0,
        base64: '',
        driveUrl: docData.google_drive_link
      }];
    }

    renderFormItems();
    updateFileDisplay();

    if (docData.status === 'Lunas' && elements.paymentDateContainer) {
      elements.paymentDateContainer.style.display = 'block';
    } else if (elements.paymentDateContainer) {
      elements.paymentDateContainer.style.display = 'none';
    }

    resetSubmitButton(true);

    if (elements.editModeContainer) {
      elements.editModeContainer.innerHTML = `
        <div class="edit-banner">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-[--firebase]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002-4 2v-5m-1.414-9.414a2 2 0 112.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
            <div>
              <span class="text-sm font-bold text-[--firebase]">MODE EDIT</span>
              <span class="text-xs text-[--muted] ml-2">Mengedit: <strong>${escapeHtml(docData.kode)}</strong></span>
            </div>
          </div>
          <button onclick="cancelEdit()" class="text-xs bg-red-500/20 text-red-400 px-3 py-1 rounded hover:bg-red-500/30 transition-colors">
            Batal Edit
          </button>
        </div>
      `;
    }

    showToast('Data dimuat! Silakan edit lalu simpan.', 'info');

  } catch (error) {
    console.error('[Edit Error]:', error);
    showToast('Gagal memuat data: ' + error.message, 'error');
    clearEditMode();
  }
};

window.cancelEdit = function() {
  clearEditMode();

  if (elements.form) elements.form.reset();
  
  state.items = [{ ket: '', qty: '', nominal: 0, keterangan: '' }];
  state.selectedFiles = [];

  updateFileDisplay();
  renderFormItems();

  const t = document.getElementById('tanggal');
  if (t) t.valueAsDate = new Date();

  if (elements.statusInput?.value !== 'Lunas' && elements.paymentDateContainer) {
    elements.paymentDateContainer.style.display = 'none';
  }

  resetSubmitButton();

  showToast('Mode edit dibatalkan', 'info');
};

function clearEditMode() {
  state.editingDocId = null;
  
  if (elements.editModeContainer) {
    elements.editModeContainer.innerHTML = '';
  }
}

// ==================== PREVIEW FROM HISTORY ====================
window.previewFromHistory = async function(docId) {
  if (!docId) {
    showToast('ID dokumen tidak valid', 'error');
    return;
  }

  try {
    let docSnap;

    if (state.db) {
      const docData = await getSubmissionById(docId);
      docSnap = docData ? { exists: true, data: () => docData } : null;
    } else {
      const found = state.history.find(h => h.id === docId);
      docSnap = found ? { exists: true, data: () => found } : null;
    }

    if (!docSnap || !docSnap.exists) {
      showToast('Data tidak ditemukan!', 'error');
      return;
    }

    const data = docSnap.data();

    const previewData = {
      tanggal: data.tanggal,
      lokasi: data.lokasi,
      kode: data.kode,
      jenis_pengajuan: data.jenis_pengajuan,
      no_invoice: data.no_invoice,
      status: data.status,
      items: data.items || [],
      total_nominal: data.total_nominal || 0,
      tanggal_pembayaran: data.tanggal_pembayaran,
      dibayarkan_kepada: data.dibayarkan_kepada,
      catatan_tambahan: data.catatan_tambahan,
      dibuat_oleh: data.dibuat_oleh || DEFAULT_SIGNATORIES.dibuat_oleh,
      disetujui_oleh: data.disetujui_oleh || DEFAULT_SIGNATORIES.disetujui_oleh || DEFAULT_SIGNATORIES.disetujui_oleh,
      keuangan: data.keuangan || DEFAULT_SIGNATORIES.keuangan,
      dir_keuangan: data.dir_keuangan || DEFAULT_SIGNATORIES.dir_keuangan,
      direktur_utama: data.direktur_utama || DEFAULT_SIGNATORIES.direktur_utama,
      accounting: data.accounting || DEFAULT_SIGNATORIES.accounting
    };

    state.lastFormData = previewData;
    populateDocuments(previewData);

    if (elements.documentModal) {
      elements.documentModal.classList.add('show');
    }

  } catch (error) {
    console.error('[Preview Error]:', error);
    showToast('Gagal memuat preview: ' + error.message, 'error');
  }
};

// ==================== RENDER HISTORY LIST ====================
/**
 * Render daftar riwayat transaksi
 * ★ UPDATE (v3.4): Tampilkan company info jika ada
 */
function renderHistory() {
  if (!elements.historyList) return;

  const filtered = state.currentTab === 'Lunas'
    ? state.history.filter(h => h.status === 'Lunas')
    : state.currentTab === 'Belum Lunas'
      ? state.history.filter(h => h.status !== 'Lunas')
      : state.history;

  if (filtered.length === 0) {
    elements.historyList.innerHTML = `
      <div class="text-center py-10 text-[--muted]">
        <svg class="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" 
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        <p class="text-sm">Tidak ada data ${escapeHtml(state.currentTab)}</p>
        <p class="text-xs mt-2 text-[--drive]">File otomatis tersimpan ke Google Drive</p>
      </div>
    `;
    return;
  }

  elements.historyList.innerHTML = filtered.slice(0, 30).map(function(item) {
    const dateStr = formatDate(item.tanggal);
    const itemsSummary = (item.items || []).map(i => i.ket).filter(k => k).join(', ');
    const displayItems = itemsSummary.length > 50 
      ? itemsSummary.substring(0, 50) + '...' 
      : itemsSummary || '-';

    const safeId = item.id || '';
    const safeKode = escapeHtml(item.kode || '-');
    const safeLabel = escapeHtml(item.no_invoice || item.kode || '-');
    const safeNominal = item.total_nominal || 0;
    const isLunas = item.status === 'Lunas';

    const statusBadge = isLunas
      ? '<span class="bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded text-xs font-semibold shadow-sm">Lunas</span>'
      : '<span class="bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded text-xs font-semibold shadow-sm">Belum Lunas</span>';

    let syncIndicator = '';
    let historyItemClass = 'history-item';
    
    const hasGoogleDriveLink = item.google_drive_link && item.google_drive_link.trim() !== '';
    const hasLegacyFiles = item.files && item.files.length > 0;
    
    if (hasGoogleDriveLink) {
      syncIndicator = '<span class="sync-indicator synced" title="File tersimpan di Google Drive">☁️ Drive</span>';
      historyItemClass += ' synced';
    } else if (hasLegacyFiles) {
      const syncedCount = item.files.filter(f => {
        const fData = f.mapValue?.fields || f;
        return fData.driveUrl?.stringValue || fData.driveUrl;
      }).length;

      const pendingCount = item.files.filter(f => {
        const fData = f.mapValue?.fields || f;
        return !fData.driveUrl?.stringValue && !fData.driveUrl && fData.status !== 'synced';
      }).length;

      const errorCount = item.files.filter(f => {
        const fData = f.mapValue?.fields || f;
        return fData.status?.stringValue === 'error' || fData.status === 'error';
      }).length;

      if (syncedCount === item.files.length && item.files.length > 0) {
        syncIndicator = '<span class="sync-indicator synced" title="Semua file synced">✓ Synced</span>';
        historyItemClass += ' synced';
      } else if (errorCount > 0) {
        syncIndicator = '<span class="sync-indicator error" title="Error sync">⚠ Error</span>';
        historyItemClass += ' sync-error';
      } else if (pendingCount > 0) {
        syncIndicator = `<span class="sync-indicator pending" title="${pendingCount} file pending">⏳ ${pendingCount} pending</span>`;
        historyItemClass += ' pending-sync';
      }
    }

    let fileListHtml = '';
    
    if (hasGoogleDriveLink) {
      const fileName = item.nama_file || 'File';
      const driveIcon = fileName.toLowerCase().includes('.pdf') ? '📕' : 
                           fileName.toLowerCase().includes('.jpg') || fileName.toLowerCase().includes('.png') ? '🖼️' : '📄';
      
      fileListHtml = `
        <div class="mt-2 p-2 bg-blue-900/20 rounded-lg border border-blue-700/30">
          <div class="file-item-drive synced">
            <span>${driveIcon}</span>
            <span class="file-name-drive">${escapeHtml(fileName)}</span>
            <a href="${escapeHtml(item.google_drive_link)}" target="_blank" class="file-link-drive">Buka di Drive →</a>
          </div>
        </div>
      `;
    } else if (hasLegacyFiles) {
      fileListHtml = '<div class="mt-2 space-y-1">';
      
      item.files.forEach(f => {
        const fData = f.mapValue?.fields || f;
        const fName = fData.name?.stringValue || fData.name || 'file';
        const fStatus = fData.status?.stringValue || fData.status || 'pending';
        const driveUrl = fData.driveUrl?.stringValue || fData.driveUrl;

        let fileIcon = '📄';
        if (fName.toLowerCase().includes('.jpg') || fName.toLowerCase().includes('.png')) fileIcon = '🖼️';
        if (fName.toLowerCase().includes('.pdf')) fileIcon = '📕';

        let statusIcon = '⏳';
        let statusClass = 'pending';
        
        if (driveUrl) { 
          statusIcon = '✅'; 
          statusClass = 'synced'; 
        }
        if (fStatus === 'error') { 
          statusIcon = '❌'; 
          statusClass = 'error'; 
        }

        fileListHtml += `
          <div class="file-item-drive ${statusClass}">
            <span>${fileIcon}</span>
            <span class="file-name-drive">${escapeHtml(fName)}</span>
            ${driveUrl 
              ? `<a href="${escapeHtml(driveUrl)}" target="_blank" class="file-link-drive">Buka →</a>`
              : `<span class="file-size-drive">${statusIcon}</span>`
            }
          </div>
        `;
      });
      
      fileListHtml += '</div>';
    }

    // ★★★ BARU (v3.4): Tampilkan company badge jika ada ★★★
    var companyTag = '';
    if (item.company_id || item.companyName) {
      var companyName = item.companyName || item.company_id;
      companyTag = `<span class="text-xs bg-gray-700/50 text-gray-300 px-2 py-0.5 rounded ml-1">${escapeHtml(companyName)}</span>`;
    }

    return `
      <div class="${historyItemClass}" data-id="${safeId}">
        <div class="flex justify-between items-start mb-2">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-semibold text-sm text-[--fg]">${safeKode}</span>
              ${statusBadge}
              ${syncIndicator}
              ${companyTag}
            </div>
            <div class="text-xs text-[--muted] mt-1">${dateStr} • ${safeLabel}</div>
          </div>
          <div class="flex items-center gap-1 ml-2">
            <button onclick="previewFromHistory('${safeId}')" class="btn-action-menu" title="Preview Dokumen">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542 7-4.477 0z"/>
              </svg>
            </button>
            <button onclick="editTransaction('${safeId}')" class="btn-action-menu" title="Edit Data">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002-4 2v-5m-1.414-9.414a2 2 0 112.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </button>
            <button onclick="openDeleteModal('${safeId}', '${safeKode.replace(/'/g, "\\'")}', ${safeNominal})" 
                    class="btn-action-menu" title="Hapus Data" style="color: var(--error);">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="text-xs text-[--muted] mb-2 line-clamp-2">${escapeHtml(displayItems)}</div>

        <div class="flex justify-between items-center">
          <span class="text-sm font-bold text-[--firebase]">Rp ${formatNumber(safeNominal)}</span>
          <span class="text-xs text-[--muted]">→ ${escapeHtml(item.dibayarkan_kepada || '-')}</span>
        </div>

        ${fileListHtml}
      </div>
    `;
  }).join('');
}

// ==================== START APPLICATION ====================
document.addEventListener('DOMContentLoaded', init);

console.log('%c🚀 FinanceSync Pro v3.4 - Multi-Company Edition', 
  'font-size: 18px; font-weight: bold; color: #ffca28; background: #0c1222; padding: 10px 20px; border-radius: 8px;');
console.log('%c⚙️ Powered by Firebase Firestore + Multi-Company Auth', 
  'font-size: 11px; color: #64748b;');
console.log('%c🏢 Companies: NMSA & IPN Ready!', 
  'font-size: 11px; color: #34a85c;');
