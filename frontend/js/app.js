(function () {
  'use strict';

  const API = '/api';
  const palette = ['#4f7cff','#a78bfa','#34d399','#fbbf24','#f87171','#38bdf8','#fb923c','#e879f9'];
  const colorMap = {};
  let colorIdx = 0;

  function companyColor(name) {
    if (!colorMap[name]) colorMap[name] = palette[colorIdx++ % palette.length];
    return colorMap[name];
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }); }
    catch { return iso; }
  }

  function urlHost(u) {
    try { return new URL(u).hostname.replace('www.', ''); } catch { return u.slice(0, 20); }
  }

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function nowLocal() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }

  function toast(msg, type) {
    type = type || 'info';
    const icons = { success:'✓', error:'✕', info:'ℹ' };
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = '<span>' + icons[type] + '</span><span>' + msg + '</span>';
    document.getElementById('toastWrap').appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity 0.3s';
      el.style.opacity = '0';
      setTimeout(function () { el.remove(); }, 300);
    }, 3500);
  }

  var selected = new Set();
  function updateBulkBar() {
    var bar = document.getElementById('bulkBar');
    document.getElementById('bulkCount').textContent = selected.size + ' selected';
    bar.classList.toggle('visible', selected.size > 0);
  }

  function clearSelection() {
    selected.clear();
    document.querySelectorAll('.row-cb').forEach(function (cb) { cb.checked = false; });
    document.getElementById('selAll').checked = false;
    document.querySelectorAll('#tbody tr').forEach(function (tr) { tr.classList.remove('sel'); });
    updateBulkBar();
  }

  function renderTable(apps) {
    var tbody  = document.getElementById('tbody');
    var table  = document.getElementById('mainTable');
    var empty  = document.getElementById('emptyState');

    if (!apps || apps.length === 0) {
      table.style.display = 'none';
      empty.style.display = 'block';
      document.getElementById('badge').textContent = '0 applications';
      return;
    }

    empty.style.display = 'none';
    table.style.display = 'table';
    document.getElementById('badge').textContent = apps.length + ' application' + (apps.length !== 1 ? 's' : '');

    var rows = '';
    for (var i = 0; i < apps.length; i++) {
      var app = apps[i];
      var color = companyColor(app.company);
      var dateStr = fmtDate(app.date_applied);
      var hasResume = app.has_resume == 1 || app.has_resume === true;
      var resumeName = app.resume_original_name || 'resume.pdf';

      rows += '<tr id="row-' + app.id + '">';
      rows += '<td><input type="checkbox" class="row-cb" data-id="' + app.id + '" /></td>';
      rows += '<td class="cell-date">' + dateStr + '</td>';
      rows += '<td class="cell-title" title="' + esc(app.job_title) + '">' + esc(app.job_title) + '</td>';
      rows += '<td><div class="company-chip" title="' + esc(app.company) + '"><span class="dot" style="background:' + color + '"></span>' + esc(app.company) + '</div></td>';
      var desc = app.job_description || '';
      rows += '<td class="cell-desc" title="Click to expand" data-desc="' + esc(desc) + '">' + esc(desc || '—') + '</td>';
      if (app.url) {
        rows += '<td><a class="url-link" href="' + esc(app.url) + '" target="_blank" rel="noopener" title="' + esc(app.url) + '">';
        rows += '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
        rows += esc(urlHost(app.url)) + '</a></td>';
      } else {
        rows += '<td><span style="color:var(--text3)">—</span></td>';
      }
      if (hasResume) {
        rows += '<td><button class="resume-btn" data-id="' + app.id + '" data-name="' + esc(resumeName) + '">';
        rows += '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
        rows += esc(resumeName.slice(0, 14)) + '</button></td>';
      } else {
        rows += '<td><span class="no-resume">No resume</span></td>';
      }
      rows += '</tr>';
    }
    tbody.innerHTML = rows;

    // Attach checkbox listeners
    tbody.querySelectorAll('.row-cb').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var id = parseInt(this.dataset.id);
        if (this.checked) selected.add(id);
        else selected.delete(id);
        var row = document.getElementById('row-' + id);
        if (row) row.classList.toggle('sel', this.checked);
        updateBulkBar();
      });
    });

    tbody.querySelectorAll('.resume-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openPdf(this.dataset.id, this.dataset.name);
      });
    });

    tbody.querySelectorAll('.cell-desc').forEach(function(td) {
      td.addEventListener('click', function() {
        var text = this.dataset.desc;
        if (text) openDesc(text);
      });
    });
  }

  function loadApplications() {
    var sort = document.getElementById('sortSelect').value;
    document.getElementById('loadingTxt').style.display = 'inline';
    clearSelection();

    fetch(API + '/applications?sort=' + sort)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (apps) {
        console.log('[LOAD] received', apps.length, 'rows:', apps);
        renderTable(apps);
      })
      .catch(function (err) {
        console.error('[LOAD ERROR]', err);
        toast('Load failed: ' + err.message, 'error');
      })
      .finally(function () {
        document.getElementById('loadingTxt').style.display = 'none';
      });
  }

  function submitApplication() {
    var title   = document.getElementById('f_title').value.trim();
    var company = document.getElementById('f_company').value.trim();
    if (!title || !company) { toast('Job Title and Company are required', 'error'); return; }

    var btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    var fd = new FormData();
    fd.append('job_title', title);
    fd.append('company', company);
    fd.append('job_description', document.getElementById('f_desc').value.trim());
    fd.append('url', document.getElementById('f_url').value.trim());
    var dv = document.getElementById('f_date').value;
    fd.append('date_applied', dv ? new Date(dv).toISOString() : new Date().toISOString());
    var rf = document.getElementById('f_resume').files[0];
    if (rf) fd.append('resume', rf);

    fetch(API + '/applications', { method: 'POST', body: fd })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.detail || data.error || 'Server error');
          return data;
        });
      })
      .then(function (data) {
        console.log('[INSERT OK]', data);
        toast('Application added!', 'success');
        closeAddModal();
        loadApplications();
      })
      .catch(function (err) {
        console.error('[INSERT ERROR]', err);
        toast('Error: ' + err.message, 'error');
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = 'Add Application';
      });
  }

  function deleteSelected() {
    if (!selected.size) return;
    var ids = Array.from(selected);
    if (!confirm('Delete ' + ids.length + ' application(s)? This cannot be undone.')) return;

    fetch(API + '/applications/delete-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ids })
    })
      .then(function (res) { if (!res.ok) throw new Error('Delete failed'); return res.json(); })
      .then(function () { toast('Deleted ' + ids.length + ' application(s)', 'success'); clearSelection(); loadApplications(); })
      .catch(function (err) { toast(err.message, 'error'); });
  }

  function openPdf(id, name) {
    var url = API + '/applications/' + id + '/resume';
    document.getElementById('pdfTitle').textContent = name;
    document.getElementById('pdfFrame').src = url;
    document.getElementById('pdfDownload').href = url;
    document.getElementById('pdfDownload').download = name;
    document.getElementById('pdfOverlay').classList.add('open');
  }

  function closePdf() {
    document.getElementById('pdfOverlay').classList.remove('open');
    document.getElementById('pdfFrame').src = '';
  }

  function openDesc(text) {
    document.getElementById('descText').textContent = text;
    document.getElementById('descOverlay').classList.add('open');
  }

  function closeDesc() {
    document.getElementById('descOverlay').classList.remove('open');
  }

  function openAddModal() {
    document.getElementById('f_title').value = '';
    document.getElementById('f_company').value = '';
    document.getElementById('f_date').value = nowLocal();
    document.getElementById('f_url').value = '';
    document.getElementById('f_desc').value = '';
    document.getElementById('f_resume').value = '';
    document.getElementById('fileChosen').style.display = 'none';
    document.getElementById('addOverlay').classList.add('open');
    setTimeout(function () { document.getElementById('f_title').focus(); }, 80);
  }

  function closeAddModal() {
    document.getElementById('addOverlay').classList.remove('open');
  }

  document.getElementById('addBtn').addEventListener('click', openAddModal);
  document.getElementById('addBtn2').addEventListener('click', openAddModal);
  document.getElementById('closeAdd').addEventListener('click', closeAddModal);
  document.getElementById('cancelAdd').addEventListener('click', closeAddModal);
  document.getElementById('submitBtn').addEventListener('click', submitApplication);
  document.getElementById('closePdf').addEventListener('click', closePdf);
  document.getElementById('deleteBtn').addEventListener('click', deleteSelected);
  document.getElementById('cancelSelBtn').addEventListener('click', clearSelection);
  document.getElementById('closeDesc').addEventListener('click', closeDesc);
  document.getElementById('descOverlay').addEventListener('click', function(e) { if (e.target === this) closeDesc(); });

  document.getElementById('addOverlay').addEventListener('click', function (e) { if (e.target === this) closeAddModal(); });
  document.getElementById('pdfOverlay').addEventListener('click', function (e) { if (e.target === this) closePdf(); });

  document.getElementById('sortSelect').addEventListener('change', loadApplications);

  document.getElementById('selAll').addEventListener('change', function () {
    document.querySelectorAll('.row-cb').forEach(function (cb) {
      cb.checked = document.getElementById('selAll').checked;
      var id = parseInt(cb.dataset.id);
      if (cb.checked) selected.add(id); else selected.delete(id);
      var row = document.getElementById('row-' + id);
      if (row) row.classList.toggle('sel', cb.checked);
    });
    updateBulkBar();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeAddModal(); closePdf(); closeDesc(); }
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openAddModal(); }
  });

  // File pick
  document.getElementById('f_resume').addEventListener('change', function () {
    var f = this.files[0];
    if (f) { document.getElementById('fileName').textContent = f.name; document.getElementById('fileChosen').style.display = 'flex'; }
  });

  var fileDrop = document.getElementById('fileDrop');
  fileDrop.addEventListener('dragover', function (e) { e.preventDefault(); this.classList.add('over'); });
  fileDrop.addEventListener('dragleave', function () { this.classList.remove('over'); });
  fileDrop.addEventListener('drop', function (e) {
    e.preventDefault(); this.classList.remove('over');
    var f = e.dataTransfer.files[0];
    if (f && f.type === 'application/pdf') {
      document.getElementById('f_resume').files = e.dataTransfer.files;
      document.getElementById('fileName').textContent = f.name;
      document.getElementById('fileChosen').style.display = 'flex';
    } else { toast('Please drop a PDF file', 'error'); }
  });

  // Initialize app
  loadApplications();

}());