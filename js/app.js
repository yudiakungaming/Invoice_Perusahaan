/**
 * FinanceSync Pro v3.5 - Application Orchestrator
 * Mengatur: init, event listeners, form handling, history render
 * Auth → firebase-init.js | Data → firestore-db.js | Upload → drive-sync.js
 */

// ==================== ENTRY POINT ====================
function init() {
  console.log('[App] Initializing FinanceSync Pro v3.5...');
  cacheDOMElements();
  setupEventListeners();

  // Default tanggal hari ini
  var t = document.getElementById('fTgl');
  if (t) t.valueAsDate = new Date();

  // Initial form item
  if (typeof addFormItem === 'function') addFormItem();

  // Status field: hide payment date default
  var payContainer = document.getElementById('fTglBayarContainer');
  if (payContainer) payContainer.style.display = 'none';

  // Start Firebase → ini memicu auth.onAuthStateChanged → onAuthStateChanged di bawah
  if (typeof initConnection === 'function') initConnection();

  console.log('[App] Ready — waiting for auth state...');
}

// ==================== AUTH STATE CALLBACK ====================
// Dipanggil oleh firebase-init.js setiap kali auth state berubah
window.onAuthStateChanged = function(loggedIn) {
  if (loggedIn) {
    showDashboard();
    // Mulai listen data setelah login
    if (typeof startRealtimeListener === 'function') startRealtimeListener();
    // Auto-generate invoice number
    if (typeof autoGenerateInvoice === 'function') {
      autoGenerateInvoice().then(function(inv) {
        var el = document.getElementById('fNoInv');
        if (el && inv) el.value = inv;
      });
    }
  } else {
    showLoginScreen();
    // Bersihkan
    if (state.unsubscribeListener) { state.unsubscribeListener(); state.unsubscribeListener = null; }
    state.history = [];
    renderHistory();
    updateStats();
  }
};

// ==================== DOM CACHE ====================
function cacheDOMElements() {
  elements = {
    form: document.getElementById('mainForm'),
    submitBtn: document.getElementById('subBtn'),
    historyList: document.getElementById('hList'),
    clearHistory: document.getElementById('clearHistory'),
    fTotal: document.getElementById('fTotal'),
    fStatus: document.getElementById('fStatus'),
    fTglBayarContainer: document.getElementById('fTglBayarContainer'),
    fInput: document.getElementById('fInput'),
    fList: document.getElementById('fList'),
    fPlaceholder: document.getElementById('upPlaceholder'),
    fActions: document.getElementById('fActions'),
    fCount: document.getElementById('fCount'),
    upBarWrap: document.getElementById('upBarWrap'),
    upBarFill: document.getElementById('upBarFill')
  };
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
  // Form submit
  if (elements.form) {
    elements.form.addEventListener('submit', handleSubmit);
  }

  // Status → toggle tanggal pembayaran
  if (elements.fStatus) {
    elements.fStatus.addEventListener('change', function() {
      if (elements.fTglBayarContainer) {
        elements.fTglBayarContainer.style.display = this.value === 'Lunas' ? 'block' : 'none';
      }
    });
  }

  // Clear history
  if (elements.clearHistory) {
    elements.clearHistory.addEventListener('click', function() {
      if (!isLoggedIn()) { showToast('Login dulu!', 'warning'); return; }
      if (!getActiveCompanyId()) return;
      if (confirm('Hapus SEMUA data ' + getCurrentCompanyConfig()?.fullName + '?')) {
        deleteAllSubmissions()
          .then(function() { showToast('Semua data dihapus', 'success'); })
          .catch(function(e) { showToast('Gagal: ' + e.message, 'error'); });
      }
    });
  }

  // Keyboard
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      if (typeof closeDoc === 'function') closeDoc();
      if (typeof hideLoginModal === 'function') hideLoginModal();
    }
    if (e.key === 'Enter' && document.getElementById('scrLogin')?.style.display !== 'none') {
      var f = document.activeElement;
      if (f && (f.id === 'lEmail' || f.id === 'lPass')) {
        e.preventDefault();
        if (typeof doLogin === 'function') doLogin();
      }
    }
  });
}

// ==================== FORM TOTAL ====================
function calcTotal() {
  var total = 0;
  document.querySelectorAll('.item-row').forEach(function(row) {
    var q = parseFloat(row.querySelector('[name^="iq_"]')?.value) || 0;
    var p = parseFloat(row.querySelector('[name^="ip_"]')?.value) || 0;
    var sub = q * p;
    total += sub;
    var id = row.id.replace('it-', '');
    var el = document.getElementById('sub-' + id);
    if (el) el.textContent = formatCurrency(sub);
  });
  if (elements.fTotal) elements.fTotal.value = formatCurrency(total);
  return total;
}
window.calcTotal = calcTotal;

// ==================== FILE HANDLING ====================
// Simpan raw File objects — base64 conversion di drive-sync.js
window.handleFileSelect = function(input) {
  if (!input.files || !input.files.length) return;
  Array.from(input.files).forEach(function(f) {
    if (f.size <= 30 * 1024 * 1024) {
      state.selectedFiles.push(f);
    } else {
      showToast(f.name + ' melebihi 30MB!', 'error');
    }
  });
  renderFiles();
  input.value = '';
};

function renderFiles() {
  var c = elements.fList, p = elements.fPlaceholder, a = elements.fActions, n = elements.fCount;
  if (!c) return;

  if (!state.selectedFiles.length) {
    c.innerHTML = '';
    if (p) p.style.display = 'block';
    if (a) a.style.display = 'none';
    return;
  }

  if (p) p.style.display = 'none';
  if (a) a.style.display = 'flex';
  if (n) n.textContent = state.selectedFiles.length + ' file dipilih';

  c.innerHTML = state.selectedFiles.map(function(f, i) {
    var t = getFileTypeInfo(f.name);
    return '<div class="f-card">' +
      '<div class="f-icon ' + t.category + '">' + t.icon + '</div>' +
      '<div class="f-info"><div class="f-name">' + escapeHtml(f.name) + '</div><div class="f-size">' + formatFileSize(f.size) + '</div></div>' +
      '<button onclick="rmFile(' + i + ')" class="f-del">×</button>' +
    '</div>';
  }).join('');
}

window.rmFile = function(i) { state.selectedFiles.splice(i, 1); renderFiles(); };
window.clearFiles = function() { state.selectedFiles = []; renderFiles(); };
window.resetUploadArea = function() { state.selectedFiles = []; renderFiles(); };

// Drag & drop handlers untuk index.html
window.handleDragOver = function(e) { e.preventDefault(); document.getElementById('upZone')?.classList.add('dragging'); };
window.handleDragLeave = function(e) { e.preventDefault(); document.getElementById('upZone')?.classList.remove('dragging'); };
window.handleDrop = function(e) {
  e.preventDefault();
  document.getElementById('upZone')?.classList.remove('dragging');
  if (e.dataTransfer?.files?.length) {
    Array.from(e.dataTransfer.files).forEach(function(f) {
      if (f.size <= 30 * 1024 * 1024) state.selectedFiles.push(f);
    });
    renderFiles();
  }
};

// ==================== FORM SUBMIT ====================
async function handleSubmit(e) {
  e.preventDefault();

  if (!isLoggedIn()) { showToast('Login dulu!', 'warning'); return; }
  if (!getActiveCompanyId()) { showToast('Tidak ada company aktif!', 'error'); return; }

  // Kumpulkan data items dari DOM
  var items = [];
  document.querySelectorAll('.item-row').forEach(function(row) {
    var k = row.querySelector('[name^="in_"]')?.value?.trim() || '';
    var q = parseFloat(row.querySelector('[name^="iq_"]')?.value) || 0;
    var p = parseFloat(row.querySelector('[name^="ip_"]')?.value) || 0;
    if (k && q > 0 && p > 0) items.push({ ket: k, qty: String(q), nominal: p, keterangan: '' });
  });

  // Kumpulkan data form
  var data = {
    tanggal: document.getElementById('fTgl')?.value || '',
    lokasi: document.getElementById('fLokasi')?.value?.trim() || '',
    jenis_pengajuan: document.getElementById('fJenis')?.value?.trim() || '',
    kode: document.getElementById('fKode')?.value?.trim() || '',
    no_invoice: document.getElementById('fNoInv')?.value?.trim() || '',
    status: document.getElementById('fStatus')?.value || '',
    dibayarkan_kepada: document.getElementById('fBayar')?.value?.trim() || '',
    tanggal_pembayaran: document.getElementById('fglBayar')?.value || '',
    catatan_tambahan: document.getElementById('fCatatan')?.value?.trim() || '',
    items: items,
    total_nominal: calcTotal()
  };

  // Validasi
  var errs = [];
  if (!data.tanggal) errs.push('Tanggal');
  if (!data.lokasi) errs.push('Lokasi');
  if (!data.jenis_pengajuan) errs.push('Jenis Pengajuan');
  if (!data.kode) errs.push('Kode');
  if (!data.status) errs.push('Status');
  if (!data.dibayarkan_kepada) errs.push('Dibayarkan Kepada');
  if (!items.length) errs.push('Minimal 1 item');
  if (errs.length) return showToast('Lengkapi: ' + errs.join(', '), 'error');

  // Disable button
  var btn = elements.submitBtn;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Menyimpan...';

  try {
    // Ambil file pertama jika ada (drive-sync handle base64 & upload)
    var fileToUpload = state.selectedFiles.length > 0 ? state.selectedFiles[0] : null;

    // smartSaveSubmission akan:
    // 1. Simpan data ke Firestore langsung
    // 2. Upload file ke Drive via Apps Script (jika ada file & URL configured)
    // 3. Update Firestore doc dengan Drive link
    var result = await smartSaveSubmission(data, fileToUpload);

    if (result.success) {
      showToast(result.message || 'Tersimpan!', 'success');
      resetForm();
    } else {
      throw new Error(result.error || 'Gagal menyimpan');
    }
  } catch (err) {
    console.error('[Submit Error]:', err);
    showToast('Gagal: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Simpan ke Firebase</span>';
  }
}

// ==================== FORM RESET ====================
function resetForm() {
  if (elements.form) elements.form.reset();
  state.selectedFiles = [];
  itemCnt = 0;
  var box = document.getElementById('itemsBox');
  if (box) box.innerHTML = '';
  if (typeof addFormItem === 'function') addFormItem();
  var t = document.getElementById('fTgl');
  if (t) t.valueAsDate = new Date();
  calcTotal();
  renderFiles();
  if (elements.fTglBayarContainer) elements.fTglBayarContainer.style.display = 'none';

  // Auto-generate invoice baru
  if (isLoggedIn() && getActiveCompanyId()) {
    autoGenerateInvoice().then(function(inv) {
      var el = document.getElementById('fNoInv');
      if (el && inv) el.value = inv;
    });
  }
}
window.resetForm = resetForm;

// ==================== HISTORY RENDER ====================
function renderHistory() {
  var c = elements.historyList;
  if (!c) return;

  var tab = state.currentTab || 'Lunas';
  var filtered = tab === 'Semua'
    ? state.history
    : state.history.filter(function(d) { return d.status === tab; });

  if (!filtered.length) {
    c.innerHTML = '<div class="text-center py-12 text-[--muted]">' +
      '<div class="text-4xl mb-2">📋</div>' +
      '<p class="text-xs">Tidak ada data' + (tab !== 'Semua' ? ' ' + tab.toLowerCase() : '') + '</p></div>';
    return;
  }

  c.innerHTML = filtered.map(function(item) {
    var tot = item.total_nominal || 0;
    var hasFiles = (item.google_drive_links && item.google_drive_links.length > 0) || (item.file_count > 0);
    var isLunas = item.status === 'Lunas';
    var safeId = item.id || '';

    return '<div class="h-item" onclick="viewItem(\'' + safeId + '\')">' +
      '<div class="flex justify-between items-start mb-1.5">' +
        '<div><div class="font-semibold text-sm">' + escapeHtml(item.kode || '-') + '</div>' +
        '<div class="text-[11px] text-[--muted]">' + escapeHtml(item.jenis_pengajuan || '-') + '</div></div>' +
        '<div class="text-right"><div class="font-bold text-sm text-[--drive]">' + formatCurrency(tot) + '</div>' +
        '<div class="text-[10px] text-[--muted]">' + formatDateShort(item.tanggal) + '</div></div>' +
      '</div>' +
      '<div class="flex items-center gap-2 flex-wrap">' +
        '<span class="px-2 py-0.5 rounded text-[10px] font-semibold ' +
          (isLunas ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400') + '">' +
          (item.status || '-') + '</span>' +
        (hasFiles ? '<span class="px-2 py-0.5 rounded text-[10px] bg-blue-500/15 text-blue-400">📁 ' +
          ((item.google_drive_links || []).length || item.file_count || 0) + '</span>' : '') +
        '<span class="text-[10px] text-[--muted] ml-auto">' + escapeHtml(item.lokasi || '') + '</span>' +
      '</div></div>';
  }).join('');

  updateStats();
}
window.renderHistory = renderHistory;

// ==================== BOOT ====================
document.addEventListener('DOMContentLoaded', init);

console.log('%c app.js loaded | Orchestrator: init → auth → listen → render', 'color:#ffca28;');
