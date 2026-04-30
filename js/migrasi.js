// js/migrasi.js — Migrasi Interaktif: Pilih data → Tentukan tujuan → Migrasi
(function () {
  'use strict';

  var db = null;
  var scannedDocs = [];
  var assignments = {};

  function getDb() {
    if (!db) {
      try { db = firebase.firestore(); } catch (e) {
        console.error('Firestore belum siap', e);
        return null;
      }
    }
    return db;
  }

  function log(msg, type) {
    var el = document.getElementById('migLog');
    if (!el) return;
    var ph = el.querySelector('[data-ph]');
    if (ph) ph.remove();
    var d = document.createElement('div');
    d.style.cssText = 'margin-bottom:2px;font-size:12px;line-height:1.6;';
    var c = { ok: '#34d399', err: '#f87171', warn: '#fbbf24', info: '#818cf8', head: '#fbbf24', dim: '#4b5563' };
    d.style.color = c[type] || '#94a3b8';
    if (type === 'head') { d.style.fontWeight = '700'; d.style.marginTop = '8px'; }
    d.textContent = msg;
    el.appendChild(d);
    el.scrollTop = el.scrollHeight;
  }

  function clearLog() {
    var el = document.getElementById('migLog');
    if (el) el.innerHTML = '';
  }

  function fmt(n) {
    if (n == null || isNaN(n)) return 'Rp 0';
    return 'Rp ' + Number(n).toLocaleString('id-ID');
  }

  function fmtDate(s) {
    if (!s) return '-';
    var p = s.split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s;
  }

  function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function showEl(id, disp) {
    var el = typeof id === 'string' ? document.getElementById(id) : id;
    if (el) el.style.display = disp || 'block';
  }

  function hideEl(id) {
    var el = typeof id === 'string' ? document.getElementById(id) : id;
    if (el) el.style.display = 'none';
  }

  /* ══════════ INIT ══════════ */
  window.initMigrasiUI = function () {
    var toggle = document.getElementById('migToggle');
    var panel = document.getElementById('migPanel');
    if (!panel) return;

    toggle.onclick = function () {
      var visible = panel.style.display !== 'none';
      panel.style.display = visible ? 'none' : 'block';
      toggle.style.opacity = visible ? '.5' : '1';
    };

    rebuildPanel(panel);
  };

  function rebuildPanel(panel) {
    var inner = panel.querySelector('div');
    if (!inner) return;

    inner.innerHTML =
      /* ── header ── */
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">' +
        '<div style="display:flex;align-items:center;gap:10px">' +
          '<span style="font-size:22px">🔄</span>' +
          '<div>' +
            '<div style="font-size:14px;font-weight:700;color:#fbbf24">Migrasi Data Interaktif</div>' +
            '<div style="font-size:11px;color:#94a3b8">Pilih data → Tentukan tujuan → Migrasi</div>' +
          '</div>' +
        '</div>' +
        '<button id="migClose" class="btn btn-outline" style="padding:6px 12px;font-size:11px">✕</button>' +
      '</div>' +

      /* ── tombol aksi ── */
      '<div id="migActions" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">' +
        '<button id="migScan" class="btn" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:12px;box-shadow:0 4px 12px rgba(99,102,241,.25)">🔍 Scan Data Submissions</button>' +
        '<button id="migAllNmsa" class="btn" style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;font-size:12px;display:none">Semua → NMSA</button>' +
        '<button id="migAllIpn" class="btn" style="background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;font-size:12px;display:none">Semua → IPN</button>' +
        '<button id="migClearSel" class="btn btn-outline" style="font-size:12px;display:none">Batalkan Pilihan</button>' +
      '</div>' +

      /* ── daftar document ── */
      '<div id="migDocList" style="display:none;max-height:340px;overflow-y:auto;border:1px solid rgba(255,255,255,.06);border-radius:10px;background:rgba(10,15,26,.35);padding:6px"></div>' +

      /* ── ringkasan ── */
      '<div id="migSummary" style="display:none;margin-top:10px;padding:10px 14px;background:rgba(99,102,241,.06);border:1px solid rgba(99,102,241,.15);border-radius:8px;font-size:12px;color:#c7d2fe"></div>' +

      /* ── eksekusi ── */
      '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">' +
        '<button id="migRun" class="btn" style="background:linear-gradient(135deg,#f59e0b,#d97706);color:#000;font-size:12px;box-shadow:0 4px 12px rgba(245,158,11,.2);display:none">🚀 Mulai Migrasi</button>' +
        '<button id="migClean" class="btn btn-danger" style="font-size:12px;display:none">🗑️ Hapus Collection Submissions</button>' +
      '</div>' +

      /* ── log ── */
      '<div id="migLog" style="background:rgba(10,15,26,.5);border-radius:8px;padding:14px;font-family:JetBrains Mono,monospace;font-size:12px;max-height:220px;overflow-y:auto;color:#94a3b8;min-height:40px;margin-top:12px">' +
        '<div data-ph style="color:#3e4f6f;text-align:center;padding:8px">Klik "Scan Data" untuk memeriksa collection submissions</div>' +
      '</div>';

    /* bind semua event */
    document.getElementById('migClose').onclick = function () {
      panel.style.display = 'none';
      toggle.style.opacity = '.5';
    };
    document.getElementById('migScan').onclick = scanSubmissions;
    document.getElementById('migAllNmsa').onclick = function () { bulkAssign('nmsa'); };
    document.getElementById('migAllIpn').onclick = function () { bulkAssign('ipn'); };
    document.getElementById('migClearSel').onclick = function () { bulkAssign(''); };
    document.getElementById('migRun').onclick = runMigration;
    document.getElementById('migClean').onclick = cleanSubmissions;
  }

  /* ══════════ SCAN ══════════ */
  async function scanSubmissions() {
    var database = getDb();
    if (!database) { log('Firestore belum siap!', 'err'); return; }

    var btn = document.getElementById('migScan');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Scanning...';

    clearLog();
    scannedDocs = [];
    assignments = {};

    log('═══════════════════════════════════════', 'dim');
    log('Membaca collection "submissions"...', 'head');

    try {
      var snap = await database.collection('submissions').get();
      snap.forEach(function (doc) {
        scannedDocs.push({ id: doc.id, data: doc.data() });
      });
      log('Ditemukan: ' + scannedDocs.length + ' document.', scannedDocs.length > 0 ? 'ok' : 'warn');

      if (scannedDocs.length === 0) {
        log('Collection kosong, tidak ada yang perlu dimigrasi.', 'warn');
        btn.disabled = false;
        btn.textContent = '🔍 Scan Data Submissions';
        return;
      }

      /* tampilkan info company_id */
      var withId = 0, withoutId = 0;
      scannedDocs.forEach(function (d) {
        if (d.data.company_id && d.data.company_id !== '') withId++;
        else withoutId++;
      });
      if (withoutId > 0) log(withoutId + ' data tidak memiliki company_id (perlu dipilih manual).', 'warn');
      if (withId > 0) log(withId + ' data sudah memiliki company_id (akan otomatis ke tujuan).', 'info');

      renderList();
      refreshSummary();

      showEl('migAllNmsa', 'inline-flex');
      showEl('migAllIpn', 'inline-flex');
      showEl('migClearSel', 'inline-flex');

      log('', '');
      log('Tentukan tujuan per data dengan dropdown, atau gunakan tombol bulk.', 'info');

    } catch (e) {
      log('Gagal membaca: ' + e.message, 'err');
    }

    btn.disabled = false;
    btn.textContent = '🔍 Scan Data Submissions';
  }

  /* ══════════ RENDER DAFTAR ══════════ */
  function renderList() {
    var box = document.getElementById('migDocList');
    if (!box) return;
    showEl(box);

    var h = '';
    scannedDocs.forEach(function (doc) {
      var d = doc.data;
      var kode = d.kode || d.no_invoice || '-';
      var tgl = fmtDate(d.tanggal);
      var jenis = d.jenis_pengajuan || '-';
      var total = fmt(d.total_nominal || d.grandTotal || 0);
      var status = d.status || '-';
      var existingCid = d.company_id || '';
      var a = assignments[doc.id] || '';

      /* jika sudah punya company_id dan belum di-assign manual, gunakan yang ada */
      if (!a && existingCid) {
        a = existingCid;
        assignments[doc.id] = a;
      }

      var sBg = status === 'Lunas' ? 'rgba(34,197,94,.1)' : 'rgba(245,158,11,.1)';
      var sClr = status === 'Lunas' ? '#34d399' : '#fbbf24';
      var rowBg = a === 'nmsa' ? 'rgba(59,130,246,.06)' : a === 'ipn' ? 'rgba(239,68,68,.06)' : 'transparent';
      var rowBd = a === 'nmsa' ? 'rgba(59,130,246,.25)' : a === 'ipn' ? 'rgba(239,68,68,.25)' : 'rgba(255,255,255,.04)';

      h +=
        '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:' + rowBg + ';border:1px solid ' + rowBd + ';border-radius:8px;margin-bottom:4px;flex-wrap:wrap;transition:all .15s">' +
          /* id pendek */
          '<span style="font-size:10px;color:#4b5563;font-family:JetBrains Mono,monospace;min-width:50px" title="' + doc.id + '">' + doc.id.substring(0, 6) + '</span>' +
          /* info utama */
          '<div style="flex:1;min-width:100px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
            '<span style="font-size:11px;color:#e2e8f0;font-weight:600;min-width:50px">' + esc(kode) + '</span>' +
            '<span style="font-size:10px;color:#64748b">' + tgl + '</span>' +
            '<span style="font-size:10px;color:#94a3b8;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(jenis) + '">' + esc(jenis) + '</span>' +
            '<span style="font-size:11px;color:#e2e8f0;font-weight:600;font-family:JetBrains Mono,monospace">' + total + '</span>' +
            '<span style="font-size:9px;padding:2px 7px;border-radius:10px;background:' + sBg + ';color:' + sClr + ';font-weight:700">' + esc(status) + '</span>' +
          '</div>' +
          /* dropdown tujuan */
          '<select data-migid="' + doc.id + '" onchange="window.__migSel(this)" style="padding:4px 8px;background:#0f172a;border:1px solid #1e2d4a;border-radius:6px;color:#fff;font-size:11px;font-family:Space Grotesk,sans-serif;cursor:pointer;min-width:120px">' +
            '<option value="">-- Pilih --</option>' +
            '<option value="nmsa"' + (a === 'nmsa' ? ' selected' : '') + '>NMSA</option>' +
            '<option value="ipn"' + (a === 'ipn' ? ' selected' : '') + '>IPN</option>' +
          '</select>' +
        '</div>';
    });

    box.innerHTML = h;
  }

  /* handler global untuk dropdown per-item */
  window.__migSel = function (sel) {
    var id = sel.getAttribute('data-migid');
    if (sel.value) assignments[id] = sel.value;
    else delete assignments[id];
    renderList();
    refreshSummary();
  };

  /* ══════════ BULK ASSIGN ══════════ */
  function bulkAssign(target) {
    scannedDocs.forEach(function (doc) {
      if (target) assignments[doc.id] = target;
      else delete assignments[doc.id];
    });
    renderList();
    refreshSummary();
  }

  /* ══════════ RINGKASAN ══════════ */
  function refreshSummary() {
    var el = document.getElementById('migSummary');
    if (!el) return;
    var nc = 0, ic = 0;
    for (var k in assignments) {
      if (assignments[k] === 'nmsa') nc++;
      else if (assignments[k] === 'ipn') ic++;
    }
    var t = nc + ic;
    if (t > 0) {
      showEl(el);
      el.innerHTML =
        '<span style="color:#93c5fd">NMSA: <b>' + nc + '</b></span> &nbsp;·&nbsp; ' +
        '<span style="color:#fca5a5">IPN: <b>' + ic + '</b></span> &nbsp;·&nbsp; ' +
        '<b>' + t + '</b> / ' + scannedDocs.length + ' dipilih';
      showEl('migRun', 'inline-flex');
    } else {
      hideEl(el);
      hideEl('migRun');
    }
  }

  /* ══════════ EKSEKUSI MIGRASI ══════════ */
  async function runMigration() {
    var database = getDb();
    if (!database) { log('Firestore belum siap!', 'err'); return; }

    var nc = 0, ic = 0;
    for (var k in assignments) {
      if (assignments[k] === 'nmsa') nc++;
      else if (assignments[k] === 'ipn') ic++;
    }
    if (nc + ic === 0) return log('Tidak ada data yang dipilih!', 'warn');

    var btn = document.getElementById('migRun');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Migrasi...';

    clearLog();
    log('═══════════════════════════════════════', 'dim');
    log('Migrasi ' + (nc + ic) + ' document...', 'head');

    var ok = 0, fail = 0;
    var batchN = database.batch();
    var batchI = database.batch();
    var colN = database.collection('Invoice-NMSA');
    var colI = database.collection('Invoice-IPN');
    var countN = 0, countI = 0;

    for (var docId in assignments) {
      var target = assignments[docId];
      var found = null;
      for (var i = 0; i < scannedDocs.length; i++) {
        if (scannedDocs[i].id === docId) { found = scannedDocs[i]; break; }
      }
      if (!found) { fail++; continue; }

      /* deep copy data dan tambahkan metadata */
      var data = JSON.parse(JSON.stringify(found.data));
      data.company_id = target;
      data._migrated_from = 'submissions';
      data._migrated_at = new Date().toISOString();
      data._original_id = docId;

      /* buat document baru di collection tujuan */
      if (target === 'nmsa') {
        batchN.set(colN.doc(), data);
        countN++;
      } else {
        batchI.set(colI.doc(), data);
        countI++;
      }
    }

    try {
      if (countN > 0) {
        await batchN.commit();
        log('Invoice-NMSA: ' + countN + ' document berhasil ditulis.', 'ok');
        ok += countN;
      }
      if (countI > 0) {
        await batchI.commit();
        log('Invoice-IPN: ' + countI + ' document berhasil ditulis.', 'ok');
        ok += countI;
      }

      log('', '');
      log('SELESAI: ' + ok + ' berhasil' + (fail > 0 ? ', ' + fail + ' gagal' : '') + '.', 'head');

      /* hapus data yang sudah dimigrasi dari daftar */
      var migratedIds = Object.keys(assignments);
      scannedDocs = scannedDocs.filter(function (d) {
        return migratedIds.indexOf(d.id) === -1;
      });
      assignments = {};
      renderList();
      refreshSummary();

      if (scannedDocs.length === 0) {
        hideEl('migDocList');
        hideEl('migAllNmsa');
        hideEl('migAllIpn');
        hideEl('migClearSel');
        hideEl('migSummary');
        log('Semua data berhasil dimigrasi!', 'ok');
      } else {
        log(scannedDocs.length + ' data tersisa (belum dipilih). Scan ulang jika perlu.', 'warn');
      }

      if (ok > 0) showEl('migClean', 'inline-flex');

    } catch (e) {
      log('GAGAL: ' + e.message, 'err');
      console.error(e);
    }

    btn.disabled = false;
    btn.innerHTML = '🚀 Mulai Migrasi';
  }

  /* ══════════ HAPUS SUBMISSIONS ══════════ */
  async function cleanSubmissions() {
    var database = getDb();
    if (!database) return;

    var btn = document.getElementById('migClean');

    /* mekanisme konfirmasi 2 klik */
    if (btn.getAttribute('data-cf') === '1') {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Menghapus...';

      log('', '');
      log('═══════════════════════════════════════', 'dim');
      log('Menghapus collection "submissions"...', 'head');

      try {
        var snap = await database.collection('submissions').get();
        if (snap.empty) {
          log('Collection sudah kosong.', 'ok');
        } else {
          /* Firestore batch max 500, tapi 50 doc aman */
          var batch = database.batch();
          var cnt = 0;
          snap.forEach(function (doc) { batch.delete(doc.ref); cnt++; });
          await batch.commit();
          log(cnt + ' document dihapus dari submissions.', 'ok');
        }
        log('Migrasi selesai sepenuhnya!', 'ok');
        hideEl('migClean');
        hideEl('migDocList');
        hideEl('migSummary');
        hideEl('migAllNmsa');
        hideEl('migAllIpn');
        hideEl('migClearSel');
        scannedDocs = [];
        assignments = {};
      } catch (e) {
        log('Gagal menghapus: ' + e.message, 'err');
      }

      btn.disabled = false;
      btn.innerHTML = '🗑️ Hapus Collection Submissions';
      btn.removeAttribute('data-cf');
      btn.style.background = '';
    } else {
      /* klik pertama — tampilkan peringatan konfirmasi */
      btn.setAttribute('data-cf', '1');
      btn.textContent = '⚠️ Klik lagi untuk konfirmasi hapus';
      btn.style.background = 'rgba(239,68,68,.3)';

      /* reset otomatis setelah 5 detik jika tidak dikonfirmasi */
      setTimeout(function () {
        if (btn.getAttribute('data-cf') === '1') {
          btn.removeAttribute('data-cf');
          btn.innerHTML = '🗑️ Hapus Collection Submissions';
          btn.style.background = '';
        }
      }, 5000);
    }
  }

})();
