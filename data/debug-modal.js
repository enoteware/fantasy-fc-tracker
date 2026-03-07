(function() {
  var overlay = document.getElementById('debug-modal-overlay');
  var content = document.getElementById('debug-modal-content');
  var statusEl = document.getElementById('debug-modal-status');
  var closeBtn = document.getElementById('debug-modal-close');
  var submitBtn = document.getElementById('debug-modal-submit');
  var payloads = window.__DEBUG_PAYLOADS__ || {};
  var apiBase = window.__DEBUG_API_BASE__ || '';

  function setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = 'status' + (type ? ' ' + type : '');
  }

  function openModal(entityKey) {
    var payload = payloads[entityKey];
    if (!payload) return;
    var groups = {};
    payload.fields.forEach(function(f) {
      if (!groups[f.schema_group]) groups[f.schema_group] = [];
      groups[f.schema_group].push(f);
    });
    var order = ['player', 'club_stats', 'player_stats', 'asset_map', 'derived'];
    content.textContent = '';
    order.forEach(function(group) {
      if (!groups[group]) return;
      var section = document.createElement('div');
      section.className = 'debug-modal-section';
      var h3 = document.createElement('h3');
      h3.textContent = group;
      section.appendChild(h3);
      groups[group].forEach(function(f) {
        var row = document.createElement('div');
        row.className = 'debug-field-row';
        row.dataset.fieldPath = f.field_path;
        row.dataset.schemaGroup = f.schema_group;
        row.dataset.value = f.value;
        var lab = document.createElement('label');
        lab.textContent = f.field_path;
        var val = document.createElement('span');
        val.className = 'value';
        val.textContent = f.value;
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'wrong-cb';
        cb.setAttribute('aria-label', 'Mark as wrong');
        var wrap = document.createElement('div');
        wrap.className = 'comment-wrap';
        wrap.style.display = 'none';
        var inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'comment-input';
        inp.placeholder = 'Comment (why wrong)';
        wrap.appendChild(inp);
        row.appendChild(lab);
        row.appendChild(val);
        row.appendChild(cb);
        row.appendChild(wrap);
        section.appendChild(row);
        cb.addEventListener('change', function() {
          wrap.style.display = cb.checked ? 'block' : 'none';
          updateSubmitState();
        });
      });
      content.appendChild(section);
    });
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.dataset.entityKey = entityKey;
    overlay.dataset.entityType = payload.entity_type || 'player';
    setStatus('');
    updateSubmitState();
  }

  function updateSubmitState() {
    var checked = content.querySelectorAll('.wrong-cb:checked');
    submitBtn.disabled = checked.length === 0;
  }

  function collectFlagged() {
    var entityKey = overlay.dataset.entityKey;
    var entityType = overlay.dataset.entityType || 'player';
    var payload = payloads[entityKey];
    var reports = [];
    content.querySelectorAll('.debug-field-row').forEach(function(row) {
      var cb = row.querySelector('.wrong-cb');
      if (!cb || !cb.checked) return;
      var path = row.dataset.fieldPath;
      var schemaGroup = row.dataset.schemaGroup;
      var value = row.dataset.value;
      var commentInput = row.querySelector('.comment-input');
      reports.push({ field_path: path, rendered_value: value, schema_group: schemaGroup, comment: commentInput ? commentInput.value.trim() : '' });
    });
    return { entity_type: entityType, entity_key: entityKey, page_context: payload, reports: reports };
  }

  closeBtn.addEventListener('click', function() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  });
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeBtn.click();
  });

  submitBtn.addEventListener('click', function() {
    var body = collectFlagged();
    if (body.reports.length === 0) return;
    setStatus('Sending...');
    submitBtn.disabled = true;
    var url = apiBase ? apiBase + '/debug-reports' : 'debug-reports';
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function(res) {
      if (res.ok) {
        setStatus('Saved.', 'success');
        body.reports.forEach(function(r) {
          var rows = content.querySelectorAll('.debug-field-row');
          for (var i = 0; i < rows.length; i++) {
            if (rows[i].dataset.fieldPath === r.field_path) {
              var row = rows[i];
              var c = row.querySelector('.wrong-cb');
              if (c) c.checked = false;
              var w = row.querySelector('.comment-wrap');
              if (w) { w.style.display = 'none'; w.querySelector('input').value = ''; }
              break;
            }
          }
        });
        updateSubmitState();
      } else {
        setStatus('Save failed: ' + res.status, 'error');
      }
    }).catch(function(err) {
      setStatus('Error: ' + (err.message || 'request failed'), 'error');
    }).finally(function() {
      submitBtn.disabled = false;
      updateSubmitState();
    });
  });

  document.querySelectorAll('.debug-trigger').forEach(function(btn) {
    btn.addEventListener('click', function() {
      openModal(btn.getAttribute('data-entity-key'));
    });
  });
})();
