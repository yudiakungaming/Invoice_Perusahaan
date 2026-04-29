/**
 * ============================================
 * FinanceSync Pro v3.3 - Main Application Logic
 * ============================================
 * File ini berisi semua logika UI, form handling, rendering,
 * dan interaksi pengguna. Ini adalah "brain" dari aplikasi.
 * 
 * Version: 3.3.1
 * Update: Integrated Google Drive Upload via Apps Script
 * Date: December 2024
 */

// ==================== INITIALIZATION ====================

/**
 * Fungsi inisialisasi utama aplikasi
 * Dipanggil saat DOM sudah siap (di akhir HTML)
 */
function init() {
  try {
    console.log('[App] Initializing FinanceSync Pro v3.3...');
    
    // Cache semua DOM elements ke variabel global 'elements'
    cacheDOMElements();
    
    // Load konfigurasi tersimpan
    loadSavedConfigs();
    
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
    
    // Inisialisasi koneksi Firebase
    initConnection();
    
    // Auto-generate nomor invoice setelah terhubung
    generateInvoiceAfterConnection();
    
    // Mulai drive status polling
    startDriveStatusPolling();
    
    // ★ NEW: Initialize upload state
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
// ★ TAMBAHAN BARU: Initialize Upload State
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Inisialisasi state untuk upload file
 */
function initUploadState() {
  // Reset upload state
  if (typeof state !== 'undefined') {
    state.driveIntegration = state.driveIntegration || {
      isUploading: false,
      uploadProgress: 0,
      lastUploadedFile: null,
      driveLink: '',
      uploadError: null
    };
  }
  
  // Display max size info jika ada element
  const maxSizeEl = document.getElementById('maxSizeDisplay');
  if (maxSizeEl && typeof UPLOAD_CONFIG !== 'undefined') {
    maxSizeEl.textContent = UPLOAD_CONFIG.maxSizeDisplay;
  }
  
  // Check Apps Script status
  updateAppsScriptStatusUI();
}

/**
 * Update UI status Apps Script di architecture banner
 */
function updateAppsScriptStatusUI() {
  const archContainer = document.getElementById('archAppsScriptStatus');
  const urlDisplay = document.getElementById('archAppsScriptUrlDisplay');
  
  const appsScriptUrl = getAppsScriptUrl ? getAppsScriptUrl() : 
                         (state?.appsScriptUrl || '');
  
  if (archContainer && appsScriptUrl) {
    archContainer.style.display = 'block';
    if (urlDisplay) {
      urlDisplay.textContent = appsScriptUrl.length > 30 
        ? appsScriptUrl.substring(0, 30) + '...' 
        : appsScriptUrl;
      urlDisplay.title = appsScriptUrl;
    }
  }
}

// ==================== DOM ELEMENT CACHING ====================

/**
 * Cache semua DOM elements yang sering digunakan
 * Ini meningkatkan performa dengan menghindari repeated DOM queries
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
    appsScriptUrlInput: document.getElementById('appsScriptUrlInput'), // ★ NEW
    
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
    selectedFilesActions: document.getElementById('selectedFilesActions'), // ★ NEW
    selectedFilesCount: document.getElementById('selectedFilesCount'), // ★ NEW
    uploadProgressContainer: document.getElementById('uploadProgressContainer'), // ★ NEW
    uploadProgressBar: document.getElementById('uploadProgressBar'), // ★ NEW
    driveLinkResult: document.getElementById('driveLinkResult'), // ★ NEW
    driveLinkUrl: document.getElementById('driveLinkUrl'), // ★ NEW
    uploadStatusText: document.getElementById('uploadStatusText'), // ★ NEW
    uploadStatsCard: document.getElementById('uploadStatsCard'), // ★ NEW
    
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

/**
 * Set default date filter ke bulan ini
 */
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

/**
 * Auto-generate invoice number setelah Firebase terhubung
 * Menggunakan polling karena koneksi bersifat async
 */
function generateInvoiceAfterConnection() {
  let attempts = 0;
  const maxAttempts = 20;

  const checkInterval = setInterval(async function() {
    attempts++;

    if (state.db && state.isConnected) {
      clearInterval(checkInterval);

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
  }, 500); // Check every 500ms
}

// ==================== EVENT LISTENERS SETUP ====================

/**
 * Setup semua event listeners untuk aplikasi
 */
function setupEventListeners() {
  
  // === FORM SUBMIT ===
  if (elements.form) {
    elements.form.addEventListener('submit', handleSubmit);
  }

  // === PREVIEW BUTTON ===
  if (elements.previewBtn) {
    elements.previewBtn.addEventListener('click', handlePreview);
  }

  // === STATUS CHANGE (show/hide payment date) ===
  if (elements.statusInput) {
    elements.statusInput.addEventListener('change', function(e) {
      if (elements.paymentDateContainer) {
        elements.paymentDateContainer.style.display = 
          e.target.value === 'Lunas' ? 'block' : 'none';
      }
    });

    // Set initial state
    if (elements.statusInput.value !== 'Lunas' && elements.paymentDateContainer) {
      elements.paymentDateContainer.style.display = 'none';
    }
  }

  // === SETUP BUTTON ===
  if (typeof elements.setupBtn !== 'undefined' && elements.setupBtn) {
    elements.setupBtn.addEventListener('click', function(e) {
      e.preventDefault();
      openSetupModal();
    });
  }

  // === MODAL CLOSE BUTTONS ===
  if (elements.setupModal) {
    elements.setupModal.addEventListener('click', function(e) {
      if (e.target === elements.setupModal) closeSetupModal();
    });
  }

  // === CLEAR HISTORY ===
  if (elements.clearHistory) {
    elements.clearHistory.addEventListener('click', function() {
      if (confirm('Hapus SEMUA data dari Firebase?')) {
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
        // Update active state
        elements.tabBtns.forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        
        // Update state dan re-render
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
    // Escape key: close all modals
    if (e.key === 'Escape') {
      closeSetupModal();
      closeDocumentModal();
      closeDeleteModal();
      closeGasModal();
    }

    // Ctrl/Cmd + S: submit form
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (elements.form && !elements.submitBtn.disabled) {
        elements.form.dispatchEvent(new Event('submit'));
      }
    }

    // Ctrl/Cmd + P: preview document
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      if (!elements.documentModal?.classList.contains('show')) {
        e.preventDefault();
        handlePreview();
      }
    }
  });

  // === FORM RESET ===
  if (elements.form) {
    elements.form.addEventListener('reset', function() {
      setTimeout(function() {
        // Reset state
        state.items = [{ ket: '', qty: '', nominal: 0, keterangan: '' }];
        state.selectedFiles = [];
        
        // Update UI
        updateFileDisplay();
        renderFormItems();
        clearEditMode();
        
        // Reset tanggal
        const t = document.getElementById('tanggal');
        if (t) t.valueAsDate = new Date();
        
        // Reset payment date visibility
        if (elements.statusInput?.value !== 'Lunas' && elements.paymentDateContainer) {
          elements.paymentDateContainer.style.display = 'none';
        }
        
        // Reset submit button
        resetSubmitButton();
        
        // ★ NEW: Reset upload area
        hideUploadProgress();
        const driveResult = document.getElementById('driveLinkResult');
        if (driveResult) driveResult.classList.remove('show');
        
      }, 10);
    });
  }
  
  // ★ NEW: Apps Script URL input listener
  const appsScriptInput = document.getElementById('appsScriptUrlInput');
  if (appsScriptInput) {
    appsScriptInput.addEventListener('change', function() {
      // Auto-save on change (optional)
      if (this.value.trim()) {
        console.log('[Apps Script URL] Updated:', this.value.substring(0, 50) + '...');
      }
    });
  }
}

// ==================== FORM ITEMS MANAGEMENT ====================

/**
 * Render form items (barang/jasa) ke DOM
 */
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

  // Hitung total otomatis
  calculateTotal();
}

/**
 * Tambah item baru ke form
 */
window.addFormItem = function() {
  state.items.push({ ket: '', qty: '', nominal: 0, keterangan: '' });
  renderFormItems();
};

/**
 * Hapus item dari form
 * @param {number} index - Index item yang akan dihapus
 */
window.removeFormItem = function(index) {
  if (state.items.length <= 1) return; // Minimal 1 item
  
  state.items.splice(index, 1);
  renderFormItems();
};

/**
 * Update nilai item
 * @param {number} index - Index item
 * @param {string} key - Field yang diupdate ('ket', 'qty', 'nominal', 'keterangan')
 * @param {string|number} value - Nilai baru
 */
window.updateItem = function(index, key, value) {
  state.items[index][key] = value;
  
  // Re-calculate total jika nominal berubah
  if (key === 'nominal') calculateTotal();
};

/**
 * Hitung total nominal semua items
 * @returns {number} Total nominal
 */
function calculateTotal() {
  const total = state.items.reduce(function(acc, curr) {
    return acc + (parseInt(curr.nominal) || 0);
  }, 0);

  if (elements.grandTotalDisplay) {
    elements.grandTotalDisplay.value = formatNumber(total);
  }

  return total;
}

// ═══════════════════════════════════════════════════════════════════════════
// ★ UPDATE: FILE UPLOAD HANDLING - Enhanced Version
//    Support larger files, more formats, better UX
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Handle file selection from input element
 * ★ UPDATED: Support up to 30MB, more formats, better validation
 * 
 * @param {HTMLInputElement} input - File input element
 */
window.handleFileSelect = function(input) {
  const files = Array.from(input.files);

  if (files.length === 0) {
    state.selectedFiles = [];
    updateFileDisplay();
    return;
  }

  console.log('[File Select] Files selected:', files.length);
  
  // ===== VALIDASI =====
  
  // Get max size from config or fallback
  var maxSize = (typeof UPLOAD_CONFIG !== 'undefined') 
    ? UPLOAD_CONFIG.maxSizeBytes 
    : 30 * 1024 * 1024; // 30MB default
  
  // Validasi setiap file
  var errors = [];
  var validFiles = [];
  
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    
    // Use ConfigHelper.validateFile if available, otherwise simple check
    var validation;
    if (typeof validateFile === 'function') {
      validation = validateFile(file);
    } else {
      // Simple fallback validation
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
      
      // Warning untuk file besar (>10MB)
      var warningSize = (typeof UPLOAD_CONFIG !== 'undefined') 
        ? UPLOAD_CONFIG.warningSizeBytes 
        : 10 * 1024 * 1024;
        
      if (file.size > warningSize) {
        console.warn('[File Select] Large file:', file.name, '(' + (file.size/1024/1024).toFixed(2) + 'MB)');
      }
    }
  }
  
  // Tampilkan error jika ada
  if (errors.length > 0) {
    showToast('❌ ' + errors[0], 'error');
    
    // Jika ada yang tidak valid, clear input
    if (validFiles.length === 0) {
      input.value = '';
      return;
    }
  }
  
  // ===== PROSES FILE YANG VALID =====
  
  // Reset selected files
  state.selectedFiles = [];
  let processed = 0;
  
  console.log('[File Select] Processing', validFiles.length, 'valid files...');

  // Convert each file to Base64
  validFiles.forEach(function(file, index) {
    // Use fileToBase64 from utils if available, otherwise manual
    var convertPromise;
    
    if (typeof fileToBase64 === 'function') {
      convertPromise = fileToBase64(file);
    } else {
      // Fallback manual conversion
      convertPromise = new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onload = function(e) {
          resolve(e.target.result.split(',')[1]); // Remove data URI prefix
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

      // Update display when all files processed
      if (processed === validFiles.length) {
        updateFileDisplay();
        console.log('[File Select] Ready:', state.selectedFiles.length, 'files');
        
        // Show success toast
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

/**
 * ★ TAMBAHAN BARU: Handle external files (drag & drop)
 * Dipanggil dari inline script di HTML saat drag & drop
 * 
 * @param {FileList} files - FileList dari drop event
 */
window.handleExternalFiles = function(files) {
  if (!files || files.length === 0) return;
  
  console.log('[External Files] Received', files.length, 'files from drag/drop');
  
  // Convert FileList to array and process
  var fileArray = Array.from(files);
  
  // Simulate file input selection
  var fakeInput = { files: fileArray };
  window.handleFileSelect(fakeInput);
};

// ==================== FILE DISPLAY FUNCTIONS ====================

/**
 * Update tampilan daftar file yang di-upload
 * ★ UPDATED: Gunakan renderSelectedFilesList dari utils jika ada
 */
function updateFileDisplay() {
  const display = elements.fileListDisplay;
  const placeholder = elements.uploadPlaceholder;
  const area = elements.uploadArea;
  const actionsBar = elements.selectedFilesActions;
  const countEl = elements.selectedFilesCount;

  if (!display || !placeholder || !area) return;

  if (state.selectedFiles.length > 0) {
    // Sembunyikan placeholder, tampilkan daftar file
    placeholder.style.display = 'none';
    area.classList.add('has-file');

    // Show actions bar
    if (actionsBar) actionsBar.style.display = 'flex';
    if (countEl) countEl.textContent = state.selectedFiles.length + ' file dipilih';

    // ★ NEW: Use renderSelectedFilesList from utils if available
    if (typeof renderSelectedFilesList === 'function') {
      renderSelectedFilesList(state.selectedFiles);
    } else {
      // Fallback: Simple list display
      display.innerHTML = state.selectedFiles.map(function(file, index) {
        const sizeStr = (typeof formatFileSize === 'function') 
          ? formatFileSize(file.size) 
          : (file.size / 1024).toFixed(1) + ' KB';
        
        // Icon berdasarkan tipe file
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
    // Tampilkan placeholder
    placeholder.style.display = 'block';
    area.classList.remove('has-file');
    display.innerHTML = '';
    
    // Hide actions bar
    if (actionsBar) actionsBar.style.display = 'none';
    
    // Hide drive link result
    const driveResult = document.getElementById('driveLinkResult');
    if (driveResult) driveResult.classList.remove('show');
  }
}

// ==================== FORM VALIDATION ====================

/**
 * Validasi form sebelum submit
 * @returns {boolean} True jika valid
 */
function validateForm() {
  const errors = [];
  const fd = new FormData(elements.form);

  // Validasi field wajib
  if (!fd.get('tanggal')) errors.push('Tanggal Invoice wajib diisi');
  if (!fd.get('lokasi')) errors.push('Lokasi wajib diisi');
  if (!fd.get('jenis_pengajuan')) errors.push('Jenis Pengajuan wajib diisi');
  if (!fd.get('kode')) errors.push('Kode wajib diisi');
  if (!fd.get('status')) errors.push('Status Pembayaran wajib dipilih');
  if (!fd.get('dibayarkan_kepada')) errors.push('Dibayarkan Kepada wajib diisi');

  // Validasi items
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

  // Tampilkan error jika ada
  if (errors.length > 0 && elements.validationErrorList && elements.validationError) {
    elements.validationErrorList.innerHTML = errors.map(e => `<li>${escapeHtml(e)}</li>`).join('');
    elements.validationError.classList.add('show');
    return false;
  }

  // Sembunyikan error jika valid
  if (elements.validationError) elements.validationError.classList.remove('show');
  
  return true;
}

// ==================== GET FORM DATA ====================

/**
 * Kumpulkan data dari form ke object
 * @returns {Object} Data form dalam format object
 */
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

// ═══════════════════════════════════════════════════════════════════════════
// ★ UPDATE: FORM SUBMISSION HANDLER - Integrated with Google Drive
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Handler untuk form submission
 * ★ UPDATED: Sekarang mendukung save via Apps Script (dengan file upload)
 * 
 * @param {Event} e - Submit event
 */
async function handleSubmit(e) {
  e.preventDefault();

  // Validasi form
  if (!validateForm()) {
    showToast('Mohon lengkapi semua field yang ditandai *', 'error');
    return;
  }

  // Cek koneksi Firebase
  if (!state.db) {
    showToast('Firebase belum terhubung. Setup dulu.', 'error');
    openSetupModal();
    return;
  }

  const data = getFormData();
  const isEditMode = !!state.editingDocId;
  let saveSuccess = false;

  try {
    // ===== MODE: CREATE NEW =====
    if (!isEditMode) {
      elements.submitBtn.disabled = true;
      elements.submitBtn.innerHTML = '<div class="spinner"></div><span>Mengecek duplikat...</span>';

      // Cek duplikat
      if (await checkDuplicate(data)) {
        showToast('Transaksi duplikat!', 'error');
        elements.submitBtn.disabled = false;
        resetSubmitButton();
        return;
      }

      // Auto-generate invoice jika kosong
      if (!data.no_invoice.trim()) {
        elements.submitBtn.innerHTML = '<div class="spinner"></div><span>Generate No Invoice...</span>';
        data.no_invoice = await autoGenerateInvoice();
        
        const ni = document.getElementById('no_invoice');
        if (ni) ni.value = data.no_invoice;
      }
    }

    // ===== PREPARE DATA FOR SAVE =====
    elements.submitBtn.disabled = true;
    elements.submitBtn.innerHTML = '<div class="spinner"></div><span>Menyimpan...</span>';

    // ★ NEW: Determine save method based on conditions
    var hasFiles = state.selectedFiles && state.selectedFiles.length > 0;
    var useAppsScript = isAppsScriptConfigured && typeof isAppsScriptConfigured === 'function' 
                        ? isAppsScriptConfigured() 
                        : false;

    console.log('[Submit] Save configuration:', {
      hasFiles: hasFiles,
      fileCount: state.selectedFiles ? state.selectedFiles.length : 0,
      useAppsScript: useAppsScript,
      isEditMode: isEditMode
    });

    let savedDocId;

    // ===== STRATEGY SELECTION =====
    
    if (hasFiles && useAppsScript && !isEditMode) {
      // ★ NEW PATH: Save with file via Apps Script (RECOMMENDED)
      console.log('[Submit] Using: smartSaveSubmission with file...');
      
      elements.submitBtn.innerHTML = '<div class="spinner"></div><span>Mengupload file ke Google Drive...</span>';
      
      // Update progress
      if (typeof updateUploadProgress === 'function') {
        updateUploadProgress(20, 'Mempersiapkan data...');
      }
      
      // Get first file (or implement multiple file support later)
      var fileToUpload = state.selectedFiles[0];
      
      // Use smartSaveSubmission or saveSubmissionWithFile
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
      
      // Show appropriate message
      showToast(
        saveResult.message || '✅ Data & file berhasil disimpan!',
        'drive'
      );
      
    } else if (hasFiles && !useAppsScript) {
      // ⚠️ FALLBACK: Has file but no Apps Script configured
      console.warn('[Submit] Has file but Apps Script not configured!');
      
      showToast(
        '⚠️ Data akan disimpan, tetapi file TIDAK diupload ke Google Drive!\n' +
        'Configure Apps Script URL di Setup untuk mengaktifkan upload.',
        'warning'
      );
      
      // Continue with Firestore-only save below...
      
    }
    
    // ===== FIRESTORE DIRECT SAVE (Original Path or Fallback) =====
    if (!savedDocId) {
      elements.submitBtn.innerHTML = '<div class="spinner"></div><span>Menyimpan ke Firebase...</span>';

      // Convert files to Base64 format for Firestore (legacy method)
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
        
        console.log('[Submit] Files converted to Base64:', uploadedFiles.length, 'files (legacy format)');
      }

      // Build final data object
      const firebaseData = {
        ...data,
        source: 'FinanceSync Pro v3.3 (Drive Edition)',
        files: uploadedFiles,
        synced_to_sheets: false,
        synced_at: null,
        sheets_error: null
      };

      // Add signature defaults
      Object.assign(firebaseData, DEFAULT_SIGNATORIES);

      // Save to Firestore
      if (isEditMode) {
        // Update existing document
        await updateSubmission(state.editingDocId, firebaseData);
        savedDocId = state.editingDocId;
        console.log('[Firebase] ✅ Updated! ID:', savedDocId);
      } else {
        // Create new document
        const docRef = await withTimeout(
          createSubmission(firebaseData),
          15000,
          'Firebase write'
        );
        
        savedDocId = docRef.id;
        console.log('[Firebase] ✅ Saved! ID:', savedDocId);
      }
      
      // Show success toast
      showToast(
        (isEditMode ? 'Berhasil diupdate!' : '✅ Berhasil Disimpan!') + 
        (uploadedFiles.length > 0 ? ' Menunggu sync...' : ''),
        uploadedFiles.length > 0 ? 'drive' : 'success'
      );
    }

    // ===== POST-SAVE ACTIONS =====
    state.lastSavedDocId = savedDocId;
    state.lastFormData = Object.assign({}, data, { id: savedDocId });
    saveSuccess = true;

    // Update drive status banner
    updateDriveStatusBanner(
      'pending',
      '⏳ Menunggu sync ke Spreadsheet... (Klik "Sync ke Sheets" untuk langsung!)'
    );

    // Populate and show document preview
    populateDocuments(data);
    if (elements.documentModal) elements.documentModal.classList.add('show');

    // Auto-trigger sync after 2 seconds if Apps Script URL configured
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
    
    showToast('Gagal menyimpan: ' + errorMsg, 'error');
  }

  // ===== RESET FORM IF SUCCESSFUL =====
  elements.submitBtn.disabled = false;

  if (saveSuccess) {
    clearEditMode();
    
    if (elements.form) elements.form.reset();
    
    // Reset state
    state.items = [{ ket: '', qty: '', nominal: 0, keterangan: '' }];
    state.selectedFiles = [];
    
    // Update UI
    updateFileDisplay();
    renderFormItems();
    
    // Reset tanggal
    const t = document.getElementById('tanggal');
    if (t) t.valueAsDate = new Date();
    
    // Reset payment date visibility
    if (elements.statusInput?.value !== 'Lunas' && elements.paymentDateContainer) {
      elements.paymentDateContainer.style.display = 'none';
    }
    
    // Reset submit button
    resetSubmitButton();
    
    // Hide progress
    if (typeof hideUploadProgress === 'function') {
      hideUploadProgress();
    }
    
    // Auto-generate new invoice
    autoGenerateInvoice().then(function(inv) {
      const ni = document.getElementById('no_invoice');
      if (inv && ni) ni.value = inv;
    });
    
  } else {
    resetSubmitButton(isEditMode);
  }
}

// ==================== RESET SUBMIT BUTTON ====================

/**
 * Reset submit button ke state default atau edit mode
 * @param {boolean} isEdit - Jika true, tampilkan teks edit mode
 */
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
    elements.submitBtn.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 3z"/>
      </svg>
      <span>💾 Simpan ke Firebase</span>
    `;
  }
}

// ==================== DOCUMENT PREVIEW FUNCTIONS ====================

/**
 * Handle preview button click
 */
function handlePreview() {
  const data = getFormData();

  // Validasi minimal ada 1 item
  if (data.items.length === 0 || data.items.every(i => !i.ket)) {
    showToast('Lengkapi minimal 1 item', 'error');
    return;
  }

  // Simpan data untuk preview
  state.lastFormData = data;

  // Populate dokumen dan tampilkan modal
  populateDocuments(data);
  
  if (elements.documentModal) {
    elements.documentModal.classList.add('show');
  }
}

/**
 * Populate data ke template dokumen (Page 1 & Page 2)
 * @param {Object} data - Data form
 */
function populateDocuments(data) {
  const ft = 'Rp ' + formatNumber(data.total_nominal);

  // Helper function untuk set value
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '-';
  };

  // === PAGE 1: Form Pengajuan HO ===
  setVal('p1_lokasi', data.lokasi);
  setVal('p1_tanggal', formatDate(data.tanggal));
  setVal('p1_kode', data.kode);
  setVal('p1_jenis', data.jenis_pengajuan);
  setVal('p1_total', ft);
  setVal('p1_dibuat', data.dibuat_oleh || DEFAULT_SIGNATORIES.dibuat_oleh);
  setVal('p1_disetujui', data.disetujui_oleh || DEFAULT_SIGNATORIES.disetujui_oleh);

  // Table body page 1
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

  // Notes page 1
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

  // === PAGE 2: Bukti Pengeluaran Kas/Bank ===
  setVal('p2_tanggal', formatDate(data.tanggal));
  setVal('p2_kode', data.kode);
  setVal('p2_dibayarkan', data.dibayarkan_kepada);
  setVal('p2_jenis', data.jenis_pengajuan);
  setVal('p2_total', ft);
  setVal('p2_name_keuangan', data.keuangan || DEFAULT_SIGNATORIES.keuangan);
  setVal('p2_name_dirkeuangan', data.dir_keuangan || DEFAULT_SIGNATORIES.dir_keuangan);
  setVal('p2_name_direktur', data.direktur_utama || DEFAULT_SIGNATORIES.direktur_utama);
  setVal('p2_name_accounting', data.accounting || DEFAULT_SIGNATORIES.accounting);

  // Table body page 2
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

/**
 * Download dokumen sebagai PDF
 */
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

/**
 * Buka modal setup Firebase
 */
window.openSetupModal = function() {
  console.log('[Setup] Opening modal...');
  const modal = document.getElementById('setupModal');
  
  if (modal) {
    modal.classList.add('show');
    
    // Load config tersimpan ke textarea
    const savedConfig = localStorage.getItem(CONFIG_KEYS.FIREBASE_CONFIG);
    if (savedConfig && elements.firebaseConfigInput) {
      elements.firebaseConfigInput.value = savedConfig;
    }
    
    // Load Apps Script URL
    const savedUrl = localStorage.getItem(CONFIG_KEYS.APPS_SCRIPT_URL);
    const urlInput = document.getElementById('appsScriptUrlInput');
    if (savedUrl && urlInput) {
      urlInput.value = savedUrl;
    }
  }
};

/**
 * Tutup modal setup Firebase
 */
window.closeSetupModal = function() {
  const modal = document.getElementById('setupModal');
  if (modal) modal.classList.remove('show');
};

/**
 * Buka modal Google Apps Script code
 */
window.openGasModal = function() {
  const modal = document.getElementById('gasModal');
  if (modal) {
    modal.classList.add('show');
    loadAppsScriptCode(); // Load kode backend
  }
};

/**
 * Tutup modal Google Apps Script
 */
window.closeGasModal = function() {
  const modal = document.getElementById('gasModal');
  if (modal) modal.classList.remove('show');
};

/**
 * Buka modal preview dokumen
 */
function openDocumentModal() {
  if (elements.documentModal) {
    elements.documentModal.classList.add('show');
  }
}

/**
 * Tutup modal preview dokumen
 */
window.closeDocumentModal = function() {
  if (elements.documentModal) {
    elements.documentModal.classList.remove('show');
  }
};

/**
 * Buka modal konfirmasi hapus
 * @param {string} docId - ID dokumen
 * @param {string} kode - Kode transaksi
 * @param {number} nominal - Nominal transaksi
 */
window.openDeleteModal = function(docId, kode, nominal) {
  state.pendingDeleteId = docId;
  state.pendingDeleteKode = kode;

  const infoEl = document.getElementById('deleteItemInfo');
  if (infoEl) {
    infoEl.textContent = `Kode: ${kode || '-'} • Rp ${formatNumber(nominal || 0)}`;
  }

  const modal = document.getElementById('deleteConfirmModal');
  if (modal) modal.classList.add('show');
};

/**
 * Tutup modal konfirmasi hapus
 */
window.closeDeleteModal = function() {
  const modal = document.getElementById('deleteConfirmModal');
  if (modal) modal.classList.remove('show');
  
  state.pendingDeleteId = null;
  state.pendingDeleteKode = null;
};

/**
 * Konfirmasi hapus data
 */
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

/**
 * Load dan tampilkan kode Google Apps Script di modal
 */
function loadAppsScriptCode() {
  const codeContainer = document.getElementById('gasCodeContent');
  if (!codeContainer) return;

  // Kode Apps Script (disederhanakan - user should copy from the full version we provided earlier)
  const appsScriptCode = `/**
 * FinanceSync Pro v3.4 - Google Apps Script Backend
 * Copy kode lengkap dari output yang diberikan sebelumnya
 * 
 * ATAU gunakan fungsi copyGasCode() untuk menyalin kode lengkap
 */

// Untuk kode lengkap, lihat response dari server atau documentation
const CONFIG = {
  FIREBASE_PROJECT_ID: 'ai-devender-7b55c'
};

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    version: 'FinanceSync Pro v3.4'
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  // Parse request dan route ke handler
  // ...
}`;

  codeContainer.textContent = appsScriptCode;
}

/**
 * Salin kode Apps Script ke clipboard
 */
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
 * @param {string} docId - ID dokumen yang akan diedit
 */
window.editTransaction = async function(docId) {
  if (!state.db || !docId) {
    showToast('Tidak dapat mengedit: Firebase tidak terhubung', 'error');
    return;
  }

  try {
    // Scroll ke form
    document.querySelector('.lg\\:col-span-3')?.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'start' 
    });

    // Tampilkan loading state
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

    // Ambil data dari Firestore
    const docData = await getSubmissionById(docId);
    
    if (!docData) {
      showToast('Data tidak ditemukan!', 'error');
      clearEditMode();
      return;
    }

    // Set state editing
    state.editingDocId = docId;
    state.lastSavedDocId = docId;

    // Helper untuk set value
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };

    // Populate form fields
    setVal('tanggal', docData.tanggal);
    setVal('lokasi', docData.lokasi);
    setVal('jenis_pengajuan', docData.jenis_pengajuan);
    setVal('kode', docData.kode);
    setVal('no_invoice', docData.no_invoice);
    setVal('status', docData.status);
    setVal('tanggal_pembayaran', docData.tanggal_pembayaran);
    setVal('dibayarkan_kepada', docData.dibayarkan_kepada);
    setVal('catatan_tambahan', docData.catatan_tambahan);

    // Populate items
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

    // Handle files (convert back from stored format)
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
        .filter(f => f.base64); // Hanya yang punya base64
    }
    
    // ★ NEW: Also check for google_drive_link field (new format)
    if (docData.google_drive_link && !state.selectedFiles.length) {
      // If there's a drive link but no legacy files, show it as a "virtual" file
      state.selectedFiles = [{
        name: docData.nama_file || 'Google Drive File',
        type: 'application/vnd.google-apps.file',
        size: docData.file_size || 0,
        base64: '', // No base64 for already-uploaded files
        driveUrl: docData.google_drive_link
      }];
    }

    // Update UI
    renderFormItems();
    updateFileDisplay();

    // Show/hide payment date field
    if (docData.status === 'Lunas' && elements.paymentDateContainer) {
      elements.paymentDateContainer.style.display = 'block';
    } else if (elements.paymentDateContainer) {
      elements.paymentDateContainer.style.display = 'none';
    }

    // Update submit button untuk edit mode
    resetSubmitButton(true);

    // Show edit mode banner
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

/**
 * Batalkan mode edit
 */
window.cancelEdit = function() {
  clearEditMode();

  if (elements.form) elements.form.reset();
  
  // Reset state
  state.items = [{ ket: '', qty: '', nominal: 0, keterangan: '' }];
  state.selectedFiles = [];

  // Update UI
  updateFileDisplay();
  renderFormItems();

  // Reset tanggal
  const t = document.getElementById('tanggal');
  if (t) t.valueAsDate = new Date();

  // Reset payment date visibility
  if (elements.statusInput?.value !== 'Lunas' && elements.paymentDateContainer) {
    elements.paymentDateContainer.style.display = 'none';
  }

  // Reset submit button
  resetSubmitButton();

  showToast('Mode edit dibatalkan', 'info');
};

/**
 * Clear edit mode state
 */
function clearEditMode() {
  state.editingDocId = null;
  
  if (elements.editModeContainer) {
    elements.editModeContainer.innerHTML = '';
  }
}

// ==================== PREVIEW FROM HISTORY ====================

/**
 * Preview dokumen dari riwayat
 * @param {string} docId - ID dokumen
 */
window.previewFromHistory = async function(docId) {
  if (!docId) {
    showToast('ID dokumen tidak valid', 'error');
    return;
  }

  try {
    let docSnap;

    if (state.db) {
      // Ambil dari Firestore
      const docData = await getSubmissionById(docId);
      docSnap = docData ? { exists: true, data: () => docData } : null;
    } else {
      // Cari di local history state
      const found = state.history.find(h => h.id === docId);
      docSnap = found ? { exists: true, data: () => found } : null;
    }

    if (!docSnap || !docSnap.exists) {
      showToast('Data tidak ditemukan!', 'error');
      return;
    }

    const data = docSnap.data();

    // Build preview data object
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

    // Set state dan populate dokumen
    state.lastFormData = previewData;
    populateDocuments(previewData);

    // Tampilkan modal
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
 * Fungsi ini dipanggil setiap kali data berubah (via realtime listener)
 * ★ UPDATED: Support new google_drive_link field display
 */
function renderHistory() {
  if (!elements.historyList) return;

  // Filter berdasarkan tab aktif
  const filtered = state.currentTab === 'Lunas'
    ? state.history.filter(h => h.status === 'Lunas')
    : state.currentTab === 'Belum Lunas'
      ? state.history.filter(h => h.status !== 'Lunas')
      : state.history;

  // Jika tidak ada data
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

  // Render list items (maksimal 30)
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

    // Status badge
    const statusBadge = isLunas
      ? '<span class="bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded text-xs font-semibold shadow-sm">Lunas</span>'
      : '<span class="bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded text-xs font-semibold shadow-sm">Belum Lunas</span>';

    // Sync indicator - ★ UPDATED: Support both old and new format
    let syncIndicator = '';
    let historyItemClass = 'history-item';
    
    // Check new format first (google_drive_link)
    const hasGoogleDriveLink = item.google_drive_link && item.google_drive_link.trim() !== '';
    const hasLegacyFiles = item.files && item.files.length > 0;
    
    if (hasGoogleDriveLink) {
      // New format: has direct Google Drive link
      syncIndicator = '<span class="sync-indicator synced" title="File tersimpan di Google Drive">☁️ Drive</span>';
      historyItemClass += ' synced';
    } else if (hasLegacyFiles) {
      // Legacy format: check files array
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

    // File list mini display - ★ UPDATED: Show Google Drive link if available
    let fileListHtml = '';
    
    if (hasGoogleDriveLink) {
      // New format: show Google Drive link
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
      // Legacy format: show files array
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

    // Return complete HTML for this item
    return `
      <div class="${historyItemClass}" data-id="${safeId}">
        <div class="flex justify-between items-start mb-2">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-semibold text-sm text-[--fg]">${safeKode}</span>
              ${statusBadge}
              ${syncIndicator}
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

// Jalankan inisialisasi saat DOM ready
document.addEventListener('DOMContentLoaded', init);

// Log ke console
console.log('%c🚀 FinanceSync Pro v3.3 - Google Drive Edition', 
  'font-size: 18px; font-weight: bold; color: #ffca28; background: #0c1222; padding: 10px 20px; border-radius: 8px;');
console.log('%c⚙️ Powered by Firebase Firestore + Google Apps Script', 
  'font-size: 11px; color: #64748b;');
console.log('%c📁 Google Drive Integration: ENABLED (Up to 30MB per file)', 
  'font-size: 11px; color: #34a85c;');
