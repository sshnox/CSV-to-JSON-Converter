/* ─────────────────────────────────────────────────────────────
   CSV → JSON  |  Browser App  |  app.js
   ───────────────────────────────────────────────────────────── */
'use strict';

/* ── DOM refs ────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

const dropzone         = $('dropzone');
const dropzoneInner    = $('dropzoneInner');
const fileInput        = $('fileInput');
const btnStartStop     = $('btnStartStop');
const btnPreviewToggle = $('btnPreviewToggle');
const btnCopy          = $('btnCopy');
const btnDownload      = $('btnDownload');
const hdrStat          = $('hdrStat');
const hdrLed           = $('hdrLed');
const toolbarFilename  = $('toolbarFilename');
const toolbarMeta      = $('toolbarMeta');
const emptyState       = $('emptyState');
const jsonOutput       = $('jsonOutput');
const jsonCode         = $('jsonCode');
const tableOutput      = $('tableOutput');
const tableWrap        = $('tableWrap');
const errorState       = $('errorState');
const errorMsg         = $('errorMsg');
const sbRows           = $('sbRows');
const sbCols           = $('sbCols');
const sbSize           = $('sbSize');
const sbTime           = $('sbTime');
const toastEl          = $('toast');

// Option controls
const optDelimiter  = $('optDelimiter');
const optHeaderTog  = $('optHeaderToggle');
const optTypesTog   = $('optTypesToggle');
const optNullsTog   = $('optNullsToggle');
const optFormat     = $('optFormat');
const optIndent     = $('optIndent');

/* ── State ───────────────────────────────────────────────────── */
let currentCSV    = null;  // raw CSV string
let currentResult = null;  // last convert() result
let currentFile   = null;  // File object
let showingTable  = false;

/* ── Toast ───────────────────────────────────────────────────── */
let toastTimer;
function toast(msg, duration = 2000) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), duration);
}

/* ── Toggle helpers ──────────────────────────────────────────── */
function initToggle(el) {
  el.addEventListener('click', () => {
    el.classList.toggle('on');
    el.setAttribute('aria-checked', el.classList.contains('on'));
    if (currentCSV) runConversion();
  });
  el.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); el.click(); }
  });
}
initToggle(optHeaderTog);
initToggle(optTypesTog);
initToggle(optNullsTog);

function getOptions() {
  const indent = optIndent.value;
  return {
    delimiter: optDelimiter.value,
    header:    optHeaderTog.classList.contains('on'),
    autoTypes: optTypesTog.classList.contains('on'),
    nullEmpty: optNullsTog.classList.contains('on'),
    format:    optFormat.value,
    indent:    indent === '0' ? 0 : indent === 'tab' ? 'tab' : parseInt(indent),
  };
}

/* ── File handling ───────────────────────────────────────────── */
function handleFile(file) {
  if (!file) return;
  if (!file.name.match(/\.csv$/i) && file.type !== 'text/csv' && file.type !== '') {
    showError('Only .csv files are supported.');
    return;
  }
  if (file.size > 52_428_800) { // 50 MB
    showError('File exceeds the 50 MB limit.');
    return;
  }

  currentFile = file;
  setLed('loading');
  hdrStat.textContent = 'reading…';

  const reader = new FileReader();
  reader.onload = e => {
    currentCSV = e.target.result;
    updateDropzoneLoaded(file);
    runConversion();
  };
  reader.onerror = () => showError('Failed to read file.');
  reader.readAsText(file);
}

function updateDropzoneLoaded(file) {
  dropzone.classList.add('loaded');
  dropzoneInner.innerHTML = `
    <div class="dropzone__icon">
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <circle cx="18" cy="18" r="16" stroke="currentColor" stroke-width="1.5"/>
        <path d="M11 18l5 5 9-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <div class="dropzone__loaded-name" title="${escHtml(file.name)}">${escHtml(file.name)}</div>
    <div class="dropzone__loaded-meta">${formatBytes(file.size)}</div>
    <div class="dropzone__change">Drop another file to replace</div>
  `;
}

/* ── Conversion ──────────────────────────────────────────────── */
function runConversion() {
  if (!currentCSV) return;
  const opts = getOptions();
  const t0   = performance.now();

  try {
    const result = CsvConverter.convert(currentCSV, opts);
    const elapsed = (performance.now() - t0).toFixed(1);
    currentResult  = result;

    // Toolbar
    toolbarFilename.textContent = currentFile ? currentFile.name : 'converted.json';
    toolbarMeta.textContent     = `${result.rows} rows · ${result.cols} cols · delim: "${result.delimiter === '\t' ? '\\t' : result.delimiter}"`;

    // Status bar
    sbRows.textContent = `${result.rows} rows`;
    sbCols.textContent = `${result.cols} cols`;
    sbSize.textContent = formatBytes(result.json.length);
    sbTime.textContent = `${elapsed}ms`;

    setLed('active');
    hdrStat.textContent = 'converted';
    btnCopy.disabled     = false;
    btnDownload.disabled = false;
    btnPreviewToggle.disabled = false;

    if (showingTable) renderTable(result);
    else              renderJSON(result.json);

    hideError();
  } catch (err) {
    showError(err.message);
  }
}

/* ── Render JSON with syntax highlighting ────────────────────── */
function renderJSON(jsonStr) {
  showView('json');
  jsonCode.innerHTML = syntaxHighlight(jsonStr);
}

function syntaxHighlight(json) {
  // Escape HTML first
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?|[{}\[\],:])/g,
    match => {
      if (/^"/.test(match)) {
        if (/:$/.test(match)) return `<span class="j-key">${match}</span>`;
        return `<span class="j-str">${match}</span>`;
      }
      if (/true|false/.test(match)) return `<span class="j-bool">${match}</span>`;
      if (/null/.test(match))       return `<span class="j-null">${match}</span>`;
      if (/[{}\[\]]/.test(match))   return `<span class="j-punct">${match}</span>`;
      if (/[,:]/.test(match))       return `<span class="j-punct">${match}</span>`;
      return `<span class="j-num">${match}</span>`;
    }
  );
}

/* ── Render table preview ────────────────────────────────────── */
function renderTable(result) {
  showView('table');
  const MAX_ROWS = 500;
  const { records, headers } = result;
  const displayed = records.slice(0, MAX_ROWS);

  let html = `<table class="csv-table"><thead><tr>
    <th class="row-num">#</th>
    ${headers.map(h => `<th>${escHtml(h)}</th>`).join('')}
  </tr></thead><tbody>`;

  displayed.forEach((row, i) => {
    html += `<tr><td class="row-num">${i + 1}</td>`;
    headers.forEach(h => {
      const val = row[h];
      let cls = '';
      if (val === null) cls = 'td--null';
      else if (typeof val === 'number') cls = 'td--num';
      else if (typeof val === 'boolean') cls = 'td--bool';
      const display = val === null ? 'null' : escHtml(String(val));
      html += `<td class="${cls}" title="${display}">${display}</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table>';
  if (records.length > MAX_ROWS) {
    html += `<div style="padding:10px 16px;font-size:11px;color:var(--text-mute)">Showing first ${MAX_ROWS} of ${records.length} rows</div>`;
  }

  tableWrap.innerHTML = html;
}

/* ── View management ─────────────────────────────────────────── */
function showView(which) {
  emptyState.style.display  = 'none';
  jsonOutput.style.display  = which === 'json'  ? 'flex' : 'none';
  tableOutput.style.display = which === 'table' ? 'flex' : 'none';
  errorState.style.display  = 'none';
}

function showError(msg) {
  emptyState.style.display  = 'none';
  jsonOutput.style.display  = 'none';
  tableOutput.style.display = 'none';
  errorState.style.display  = 'flex';
  errorMsg.textContent      = msg;
  setLed('error');
  hdrStat.textContent = 'error';
  btnCopy.disabled     = true;
  btnDownload.disabled = true;
  btnPreviewToggle.disabled = true;
}

function hideError() {
  errorState.style.display = 'none';
}

/* ── LED status ──────────────────────────────────────────────── */
function setLed(state) {
  hdrLed.className = 'header__led';
  if (state === 'active')  hdrLed.classList.add('active');
  if (state === 'error')   hdrLed.classList.add('error');
}

/* ── Download ────────────────────────────────────────────────── */
function downloadJSON() {
  if (!currentResult) return;
  const blob = new Blob([currentResult.json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const name = currentFile ? currentFile.name.replace(/\.csv$/i, '.json') : 'converted.json';
  a.href = url; a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  toast('✓ Downloaded ' + name);
}

/* ── Copy ────────────────────────────────────────────────────── */
function copyJSON() {
  if (!currentResult) return;
  navigator.clipboard.writeText(currentResult.json)
    .then(() => toast('✓ Copied to clipboard'))
    .catch(() => {
      const ta = document.createElement('textarea');
      ta.value = currentResult.json;
      document.body.appendChild(ta);
      ta.select(); document.execCommand('copy');
      document.body.removeChild(ta);
      toast('✓ Copied to clipboard');
    });
}

/* ── Helpers ─────────────────────────────────────────────────── */
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(2) + ' MB';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Event bindings ──────────────────────────────────────────── */

// Drag and drop
dropzone.addEventListener('dragover', e => {
  e.preventDefault(); dropzone.classList.add('drag-over');
});
dropzone.addEventListener('dragleave', e => {
  if (!dropzone.contains(e.relatedTarget)) dropzone.classList.remove('drag-over');
});
dropzone.addEventListener('drop', e => {
  e.preventDefault(); dropzone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

// Click to browse
dropzone.addEventListener('click', e => {
  if (e.target !== fileInput) fileInput.click();
});
dropzone.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
  fileInput.value = ''; // allow re-selecting same file
});

// Options → re-run
optDelimiter.addEventListener('change', () => { if (currentCSV) runConversion(); });
optFormat.addEventListener('change',    () => { if (currentCSV) runConversion(); });
optIndent.addEventListener('change',    () => { if (currentCSV) runConversion(); });

// Toolbar actions
btnDownload.addEventListener('click', downloadJSON);
btnCopy.addEventListener('click', copyJSON);
btnPreviewToggle.addEventListener('click', () => {
  showingTable = !showingTable;
  btnPreviewToggle.textContent = showingTable ? '{ } JSON' : '⊞ Table';
  btnPreviewToggle.prepend((() => {
    // Rebuild icon inline
    return document.createTextNode('');
  })());
  if (!currentResult) return;
  if (showingTable) { btnPreviewToggle.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 3h12M1 7h12M1 11h12M5 1v12M9 1v12" stroke="currentColor" stroke-width="1.3"/></svg> JSON`; renderTable(currentResult); }
  else              { btnPreviewToggle.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="12" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="8" y="1" width="5" height="12" rx="1" stroke="currentColor" stroke-width="1.3"/></svg> Table`; renderJSON(currentResult.json); }
});

// Keyboard shortcut
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); downloadJSON(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'c' && currentResult && !window.getSelection().toString()) {
    e.preventDefault(); copyJSON();
  }
});

// Paste CSV directly
document.addEventListener('paste', e => {
  const text = e.clipboardData.getData('text');
  if (text && text.includes(',') && text.includes('\n')) {
    currentFile = null;
    currentCSV  = text;
    dropzone.classList.add('loaded');
    dropzoneInner.innerHTML = `
      <div class="dropzone__icon"><svg width="36" height="36" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="16" stroke="currentColor" stroke-width="1.5"/><path d="M11 18l5 5 9-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div class="dropzone__loaded-name">Pasted CSV</div>
      <div class="dropzone__loaded-meta">${formatBytes(text.length)}</div>
      <div class="dropzone__change">Drop a file to replace</div>
    `;
    runConversion();
    toast('CSV pasted from clipboard');
  }
});
