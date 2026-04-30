/**
 * FinanceSync Pro v3.5 - Data Migration Tool
 * Memindahkan data dari collection 'submissions' ke 'Invoice-NMSA' / 'Invoice-IPN'
 * 
 * CARA PAKAI:
 * 1. Simpan file ini di folder js/ sebagai migrasi.js
 * 2. Login ke aplikasi
 * 3. Klik tombol "⚙️ Admin Tools" di bagian bawah dashboard
 * 4. Ikuti instruksinya
 * 5. SETELAH SELESAI — HAPUS file ini dari hosting
 */

(function() {
  'use strict';

  var isRunning = false;

  /* ═══════════════════════════════════════════════════
     INISIALISASI — dipanggil dari index.html saat login berhasil
     ═══════════════════════════════════════════════════ */
  window.initMigrasiUI = function() {
    var btnOpen = document.getElementById('migToggle');
    var btnClose = document.getElementById('migClose');
    var panel = document.getElementById('migPanel');
    var btnRun = document.getElementById('migRun');
    var btnClean = document.getElementById('migClean');

    if (!btnOpen || !panel) return;

    btnOpen.addEventListener('click', function() {
      panel.style.display = 'block';
      btnOpen.style.display = 'none';
      clearLog();
      checkSubmissions();
    });

    if (btnClose) btnClose.addEventListener('click', closePanel);
    if (btnRun) btnRun.addEventListener('click', runMigration);
    if (btnClean) btnClean.addEventListener('click', deleteSubmissions);
  };

  function closePanel() {
    var panel = document.getElementById('migPanel');
    var btnOpen = document.getElementById('migToggle');
    if (panel) panel.style.display = 'none';
    if (btnOpen) btnOpen.style.display = 'inline-flex';
  }

  function log(msg, color) {
    var el = document.getElementById('migLog');
    if (!el) return;
    el.innerHTML += '<div style="color:' + (color || '#94a3b8') + ';margin:3px 0;line-height:1.6">' + msg + '</div>';
    el.scrollTop = el.scrollHeight;
  }

  function clearLog() {
    var el = document.getElementById('migLog');
    if (el) el.innerHTML = '';
  }

  function setRunBtn(disabled, text) {
    var btn = document.getElementById('migRun');
    if (!btn) return;
    btn.disabled = disabled;
    btn.innerHTML = disabled ? '<span class="spinner"></span> ' + text : text;
  }

  /* ═══════════════════════════════════════════════════
     CEK: Apakah submissions punya data?
     ═══════════════════════════════════════════════════ */
  async function checkSubmissions() {
    log('🔍 Memeriksa collection <strong>submissions</strong>...', '#f59e0b');

    if (!state.db) {
      log('❌ Firestore belum terhubung! Login dulu.', '#ef4444');
      return;
    }

    try {
      var snap = await state.db.collection('submissions').get();

      if (snap.empty) {
        log('', '');
        log('✅ Collection submissions <strong>kosong</strong>.', '#22c55e');
        log('💡 Tidak perlu migrasi — data sudah bersih.', '#94a3b8');
        setRunBtn(true, 'Tidak Perlu Migrasi');
        return;
      }

      log('', '');
      log('📋 Ditemukan <strong style="font-size:15px">' + snap.size + '</strong> document.', '#3b82f6');
      log('', '');

      /* Hitung per company */
      var nmsa = 0, ipn = 0, other = 0;
      snap.docs.forEach(function(d) {
        var c = d.data().company_id || '';
        if (c === 'nmsa') nmsa++;
        else if (c === 'ipn') ipn++;
        else other++;
      });

      log('   📦 company_id = "nmsa" → <strong>Invoice-NMSA</strong>  (' + nmsa + ' docs)', '#3b82f6');
      log('   📦 company_id = "ipn"  → <strong>Invoice-IPN</strong>   (' + ipn + ' docs)', '#ef4444');
      if (other > 0) log('   ❓ Tidak dikenal           → dilewati       (' + other + ' docs)', '#f59e0b');
      log('', '');
      log('⚠️ Klik <strong>"Mulai Migrasi"</strong> untuk memindahkan.', '#fbbf24');

    } catch (e) {
      log('❌ Gagal membaca: ' + e.message, '#ef4444');
      if (e.message.indexOf('PERMISSION_DENIED') !== -1) {
        log('', '');
        log('═══ PERBAIKAN RULES FIREBASE ═══', '#fbbf24');
        log('', '');
        log('Buka Firebase Console → Firestore → Rules,', '#94a3b8');
        log('tambahkan ini lalu klik <strong>Publish</strong>:', '#94a3b8');
        log('', '');
        log('<code style="display:block;background:rgba(0,0,0,.3);padding:10px;border-radius:6px;font-size:11px;line-height:1.6">match /submissions/{docId} {<br>&nbsp;&nbsp;allow read, write: if request.auth != null;<br>}</code>', '#22c55e');
        log('', '');
        log('Setelah migrasi selesai, hapus rule ini.', '#ef4444');
      }
    }
  }

  /* ═══════════════════════════════════════════════════
     PROSES MIGRASI UTAMA
     ═══════════════════════════════════════════════════ */
  async function runMigration() {
    if (isRunning) return;
    isRunning = true;
    clearLog();
    setRunBtn(true, 'Memproses...');

    if (!state.db) {
      log('❌ Firestore belum terhubung!', '#ef4444');
      setRunBtn(false, 'Coba Lagi');
      isRunning = false;
      return;
    }

    log('🚀 Memulai migrasi data...', '#6366f1');
    log('═════════════════════════════════════════════', '#1e2d4a');
    log('', '');

    try {
      /* STEP 1: Baca semua data */
      log('[1/4] Membaca collection submissions...', '#f59e0b');
      var snap = await state.db.collection('submissions').get();

      if (snap.empty) {
        log('✅ Kosong — tidak ada yang dipindahkan.', '#22c55e');
        setRunBtn(true, 'Tidak Perlu Migrasi');
        isRunning = false;
        return;
      }

      log('   OK: ' + snap.size + ' document dibaca.', '#22c55e');
      log('', '');

      /* STEP 2: Proses */
      log('[2/4] Memproses dan memindahkan...', '#f59e0b');
      log('', '');

      var moved = 0, skipped = 0;
      var nmsaCount = 0, ipnCount = 0, otherCount = 0;
      var batch = state.db.batch();

      for (var i = 0; i < snap.docs.length; i++) {
        var doc = snap.docs[i];
        var data = doc.data();
        var cid = data.company_id || '';

        var targetCol = '';
        if (cid === 'nmsa') { targetCol = 'Invoice-NMSA'; nmsaCount++; }
        else if (cid === 'ipn') { targetCol = 'Invoice-IPN'; ipnCount++; }
        else {
          otherCount++;
          log('   ❌ <code>' + doc.id.substring(0, 12) + '</code> — company_id: "<strong>' + cid + '</strong>"', '#ef4444');
          skipped++;
          continue;
        }

        /* Lengkapi field yang mungkin belum ada di data lama */
        data.version = data.version || '3.5';
        data.source = data.source || 'FinanceSync Pro v3.5 (migrated)';
        data.migrated_from = 'submissions';
        data.migrated_at = new Date().toISOString();
        if (!data.company_name) {
          data.company_name = cid === 'nmsa'
            ? 'PT Nusantara Mineral Sukses Abadi'
            : 'PT Industri Padi Nusantara';
        }
        if (!data.google_drive_link) data.google_drive_link = '';
        if (!data.google_drive_links) data.google_drive_links = [];
        if (data.file_count === undefined || data.file_count === null) data.file_count = 0;
        if (data.synced_to_sheets === undefined) data.synced_to_sheets = false;
        if (!data.items) data.items = [];
        if (!data.total_nominal) data.total_nominal = 0;

        /* Cek duplikat — skip jika sudah ada di target */
        try {
          var exists = await state.db.collection(targetCol).doc(doc.id).get();
          if (exists.exists) {
            log('   ⏭️ <code>' + doc.id.substring(0, 12) + '</code> — sudah di ' + targetCol, '#3b82f6');
            skipped++;
            continue;
          }
        } catch (e) {
          /* Jika cek gagal, lanjutkan — mungkin index belum jadi */
        }

        /* Tambahkan ke batch */
        batch.set(state.db.collection(targetCol).doc(doc.id), data);
        moved++;

        var shortId = doc.id.substring(0, 12);
        log('   ✅ <code>' + shortId + '</code> → ' + targetCol + '  |  ' +
          (data.kode || '-') + '  |  ' + (data.status || '-'), '#22c55e');

        /* Commit tiap 400 docs */
        if (moved % 400 === 0) {
          log('', '');
          log('   📦 Committing batch (' + moved + ')...', '#3b82f6');
          await batch.commit();
          batch = state.db.batch();
        }
      }

      /* Commit sisa */
      if (moved % 400 !== 0) {
        log('', '');
        log('   📦 Committing final batch...', '#3b82f6');
        await batch.commit();
      }

      log('', '');
      log('[3/4] Pemindahan selesai.', '#22c55e');
      log('', '');

      /* STEP 3: Summary */
      log('═════════════════════════════════════════════', '#1e2d4a');
      log('📊 HASIL MIGRASI:', '#fbbf24');
      log('', '');
      log('   Total dibaca:          ' + snap.size, '#f1f5f9');
      log('   ✅ Berhasil dipindah:  ' + moved, '#22c55e');
      log('   ⏭️ Dilewati:            ' + skipped, '#f59e0b');
      log('', '');
      log('   → Invoice-NMSA:  ' + nmsaCount + ' document', '#3b82f6');
      log('   → Invoice-IPN:   ' + ipnCount + ' document', '#ef4444');
      if (otherCount > 0) log('   → Dilewati:      ' + otherCount + ' document', '#94a3b8');
      log('═════════════════════════════════════════════', '#1e2d4a');

      /* STEP 4: Instruksi */
      if (moved > 0) {
        log('', '');
        log('[4/4] LANGKAH SELANJUTNYA:', '#fbbf24');
        log('', '');
        log('   1. ✅ Verifikasi: buka Firebase Console → cek Invoice-NMSA dan Invoice-IPN', '#94a3b8');
        log('   2. 🗑️ Klik tombol merah "Hapus Collection Submissions" di bawah', '#94a3b8');
        log('   3. 🧹 Hapus file <strong>js/migrasi.js</strong> dari hosting', '#ef4444');
        log('   4. 🧹 Hapus blok kode migrasi dari <strong>index.html</strong>', '#ef4444');
        log('   5. 🔄 Refresh aplikasi', '#94a3b8');
        log('', '');

        var btnClean = document.getElementById('migClean');
        if (btnClean) {
          btnClean.style.display = 'inline-flex';
          btnClean.disabled = false;
        }
      }

      setRunBtn(true, 'Selesai ✓');

    } catch (e) {
      log('', '');
      log('❌ ERROR: ' + e.message, '#ef4444');
      log('', '');
      console.error('[Migrasi]', e);

      if (e.message && e.message.indexOf('PERMISSION_DENIED') !== -1) {
        log('═══ PERBAIKAN ═══', '#fbbf24');
        log('', '');
        log('Buka Firebase Console → Firestore → Rules:', '#94a3b8');
        log('', '');
        log('<code style="display:block;background:rgba(0,0,0,.3);padding:10px;border-radius:6px;font-size:11px;line-height:1.6">match /submissions/{docId} {<br>&nbsp;&nbsp;allow read, write: if request.auth != null;<br>}</code>', '#22c55e');
        log('', '');
        log('Publish → coba lagi.', '#94a3b8');
      } else if (e.message && e.message.indexOf('resource-exhausted') !== -1) {
        log('⚠️ Terlalu banyak operasi sekaligus.', '#fbbf24');
        log('   Tunggu 1 menit lalu coba lagi — data yang sudah dipindah akan di-skip otomatis.', '#94a3b8');
      }

      setRunBtn(false, 'Coba Lagi');
    }

    isRunning = false;
  }

  /* ═══════════════════════════════════════════════════
     HAPUS COLLECTION SUBMISSIONS
     ═══════════════════════════════════════════════════ */
  async function deleteSubmissions() {
    var btn = document.getElementById('migClean');
    if (!btn) return;

    if (!confirm('⚠️ HAPUS collection "submissions"?\n\nData sudah dipindahkan ke Invoice-NMSA/IPN.\nTindakan ini TIDAK BISA dibatalkan!')) return;
    if (!confirm('🔥 KONFIRMASI TERAKHIR\n\nBenar-benar HAPUS SEMUA data submissions?')) return;

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Menghapus...';
    log('', '');
    log('🗑️ Menghapus collection submissions...', '#ef4444');

    try {
      var snap = await state.db.collection('submissions').get();

      if (snap.empty) {
        log('✅ Sudah kosong.', '#22c55e');
        btn.innerHTML = 'Sudah Dihapus ✓';
        btn.style.opacity = '0.5';
        return;
      }

      /* Hapus dalam batch (max 400 per batch) */
      var total = snap.docs.length;
      var deleted = 0;

      for (var i = 0; i < total; i += 400) {
        var batch = state.db.batch();
        var chunk = snap.docs.slice(i, i + 400);
        chunk.forEach(function(doc) { batch.delete(doc.ref); });
        await batch.commit();
        deleted += chunk.length;
        log('   📦 Batch ' + (Math.floor(i / 400) + 1) + ': ' + chunk.length + ' doc dihapus', '#94a3b8');
      }

      log('', '');
      log('✅ Berhasil menghapus <strong>' + total + '</strong> document.', '#22c55e');
      log('', '');
      log('🎉 MIGRASI 100% SELESAI!', '#22c55e');
      log('', '');
      log('Bersihkan sekarang:', '#fbbf24');
      log('   1. Hapus file <strong>js/migrasi.js</strong> dari hosting', '#ef4444');
      log('   2. Hapus blok kode migrasi dari <strong>index.html</strong>', '#ef4444');
      log('   3. Hapus rule submissions dari Firebase Rules', '#ef4444');
      log('   4. Refresh aplikasi', '#94a3b8');

      btn.innerHTML = 'Sudah Dihapus ✓';
      btn.style.opacity = '0.5';
      btn.style.cursor = 'default';

    } catch (e) {
      log('❌ Gagal: ' + e.message, '#ef4444');
      btn.disabled = false;
      btn.innerHTML = '🗑️ Hapus Collection Submissions';
    }
  }

  console.log('%c migrasi.js loaded | Tool: submissions → Invoice-NMSA/IPN', 'color:#f59e0b;font-size:11px;');
})();
