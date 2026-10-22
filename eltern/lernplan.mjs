/* Gebaut aus lernplan/lernplan.js (Version 1.2.0). Nicht hier ändern. */
/* Lernplan-Darstellung: gemeinsame Quelle für die Lernplan-Seite in claude.ai und die Eltern-App.
   Quelle: LearningToolsCode/lernplan/lernplan.js (+ lernplan.css). Daraus baut `npm run lernplan`
   die Vorlage (wissensbasis/15-lernplan-seite-vorlage.html, alles eingebettet) und app/eltern/lernplan.mjs.
   Nur hier ändern. Datenformat und Regeln: wissensbasis/15-lernplan-seite.md. */
var Lernplan = (function(){
var VERSION = '1.2.0';
function esc0(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
// Export (Format lernplan-1, daten/<name>/lernplan.json) in die Form der Seite: Sammlungen als Listen mit _id
function ausExport(x){
  function liste(o){ return Object.keys(o || {}).map(function(k){ return Object.assign({ _id: k }, o[k]); }); }
  return { meta: (x && x.meta) || null, rows: liste(x && x.rows), ins: liste(x && x.insights), tage: liste(x && x.bogentage) };
}
/* root: Element, in das der Lernplan gezeichnet wird (claude.ai: document.body).
   opt: name (Überschrift bis die Daten da sind), hash (#bahnen öffnet die Bahnen), speicher (Schlüssel für aufgeklappte Pakete),
        claude (window.claude: Datenbank der Seite, Bearbeiten für Bearbeiter), daten (Export lernplan-1, nur lesbar),
        info (HTML unter der Legende, z. B. Stand und Link), eingebettet (ohne eigenen Seitenrand), hell (immer helle Darstellung). */
function erstellen(root, opt){
opt = opt || {};
var KEY = opt.speicher || 'lp-open';
var esc = esc0;
function $(k){ return root.querySelector('#lp-' + k); }
root.classList.add('lp');
if (opt.eingebettet) root.classList.add('lp-eingebettet');
if (opt.hell) root.setAttribute('data-theme', 'light');
root.insertAdjacentHTML('beforeend', '<div class="wrap">\n' +
  '  <header class="top">\n' +
  '    <div>\n' +
  '      <div class="eyebrow" id="lp-eyebrow">' + esc(opt.name ? 'Lernplan · ' + opt.name : 'Lernplan') + '</div>\n' +
  '      <h1 id="lp-title">Lerninhalte im Zeitverlauf</h1>\n' +
  '    </div>\n' +
  '    <div class="controls">\n' +
  '      <div class="seg" role="group" aria-label="Ansicht">\n' +
  '        <button type="button" id="lp-v-zeit" aria-pressed="true">Zeitleiste</button>\n' +
  '        <button type="button" id="lp-v-bahnen" aria-pressed="false">Bahnen</button>\n' +
  '      </div>\n' +
  '      <button type="button" class="btn" id="lp-edit" aria-pressed="false" hidden>Bearbeiten</button>\n' +
  '    </div>\n' +
  '  </header>\n' +
  '\n' +
  '  <div class="legend" aria-label="Legende">\n' +
  '    <span id="lp-lg-bogen"><i class="sw b"></i>Bogen</span>\n' +
  '    <span><i class="sw a"></i>App</span>\n' +
  '    <span id="lp-lg-plan"><i class="sw p"></i>geplant</span>\n' +
  '    <span id="lp-lg-planapp" hidden><i class="sw pa"></i>App geplant</span>\n' +
  '    <span><i class="sw z"></i>Pause</span>\n' +
  '    <span><i class="dot">1</i>Erkenntnis</span>\n' +
  '    <span id="lp-stand"></span>\n' +
  '  </div>\n' +
  '  <div class="lp-info" id="lp-info" hidden></div>\n' +
  '\n' +
  '  <div id="lp-editbar" class="controls" hidden>\n' +
  '    <button type="button" class="btn primary" id="lp-add-row">Zeile hinzufügen</button>\n' +
  '    <button type="button" class="btn" id="lp-add-ins">Erkenntnis hinzufügen</button>\n' +
  '    <button type="button" class="btn" id="lp-add-tag">Bogentag hinzufügen</button>\n' +
  '    <button type="button" class="btn" id="lp-edit-meta">Zeitraum und Test</button>\n' +
  '    <span class="hint">Im Bearbeiten-Modus öffnet ein Tipp auf eine Zeile oder einen Bogentag das Formular. Erkenntnisse änderst du über „Ändern“ in der eingeblendeten Karte.</span>\n' +
  '  </div>\n' +
  '\n' +
  '  <main id="lp-view"></main>\n' +
  '</div>\n' +
  '<div id="lp-dlg"></div>\n' +
  '<div id="lp-toast" class="toast" role="status" hidden></div>');
var S = { meta:null, rows:[], ins:[], tage:[], view:'zeit', open:{}, sel:null, edit:false, canEdit:false, db:null, loaded:{meta:false,rows:false,ins:false,tage:false}, shift:0 };
try { S.open = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch(e) {}
if (opt.hash && location.hash === '#bahnen') S.view = 'bahnen';

function dn(s){ if(!s) return NaN; var a = String(s).split('-'); return Date.UTC(+a[0], +a[1]-1, +a[2]) / 864e5; }
function iso(n){ var d = new Date(n * 864e5); return d.toISOString().slice(0,10); }
function de(s){ var a = String(s||'').split('-'); return a.length === 3 ? (+a[2]) + '.' + (+a[1]) + '.' : ''; }
function todayIso(){ try { return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin'}).format(new Date()); } catch(e){ return new Date().toISOString().slice(0,10); } }
function qClass(q){ var r = q.r / q.n; return r >= 0.8 ? 'good' : (r >= 0.6 ? 'mid' : 'low'); }
function srcClass(s){ if (/bogen/i.test(s)) return 'src-bogen'; if (/app/i.test(s)) return 'src-app'; return S.meta && S.meta.quellen ? 'src-other' : 'src-bogen'; }
function noBoegen(){ return !!(S.meta && S.meta.boegen === false); }
function qTitle(q){ return 'App, 1. Versuch' + (q.stand ? ', Stand ' + de(q.stand) : '') + (q.kn != null ? ', davon geknobelt ' + q.kn : ''); }
function etName(r){ var g = rowById(r.etappe.paket); return r.etappe.kurz || ((g ? (g.lane || g.label).split(' · ')[0] : r.etappe.paket) + ' E' + r.etappe.nr); }
function toast(t){ var el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function(){ el.hidden = true; }, 2600); }
function saveOpen(){ try { localStorage.setItem(KEY, JSON.stringify(S.open)); } catch(e) {} }
function sortedRows(){ return S.rows.slice().sort(function(a,b){ return (a.order||0) - (b.order||0); }); }
function groups(){ return sortedRows().filter(function(r){ return r.group; }); }
function isOpen(id){ return S.open[id] !== undefined ? S.open[id] : !!(S.meta && S.meta.offen && S.meta.offen.indexOf(id) >= 0); }

/* ---------- Zeitleiste ---------- */
function renderZeit(){
  var m = S.meta, PX = 16, start = dn(m.start), end = dn(m.end), days = end - start + 1, L = 'var(--labw)';
  function x(s){ return (dn(s) - start) * PX; }
  var W = days * PX;
  var h = '<div class="card scroller"><div class="tl" style="min-width:calc(' + L + ' + ' + W + 'px)">';
  // Kopf
  h += '<div class="hdr"><div class="stickyl" style="background:var(--surface-2);color:var(--muted)">Paket / Thema</div>';
  (m.wochen||[]).forEach(function(w){ h += '<div class="wk" style="left:calc(' + L + ' + ' + (x(w.start) + 5) + 'px)"><b>' + esc(w.name) + '</b> <span>' + de(w.start) + '</span></div>'; });
  h += '</div>';
  // Erkenntnisse
  h += '<div class="mrow"><div class="stickyl" style="background:var(--amber-soft);color:var(--amber-ink)">Erkenntnisse</div>';
  var lastX = -1e9;
  S.ins.slice().sort(function(a,b){ return (dn(a.date) - dn(b.date)) || (a.n - b.n); }).forEach(function(e){
    var px = Math.max(x(e.date) - 5, lastX + 30); lastX = px;
    h += '<button type="button" class="mark" data-ins="' + esc(e._id) + '" aria-pressed="' + (S.sel === e._id) + '" aria-label="Erkenntnis ' + esc(e.n) + ' vom ' + esc(de(e.date)) + '" style="left:calc(' + L + ' + ' + px + 'px)">' + esc(e.n) + '</button>';
  });
  h += '</div>';
  // Zeilen
  var body = '';
  var selIns = S.ins.filter(function(e){ return e._id === S.sel; })[0];
  var rows = sortedRows();
  rows.forEach(function(r){
    if (r.parent && !isOpen(r.parent)) return;
    var kids = rows.filter(function(c){ return c.parent === r._id; });
    var hl = selIns && ((selIns.rows||[]).indexOf(r._id) >= 0 || (r.group && !isOpen(r._id) && kids.some(function(c){ return (selIns.rows||[]).indexOf(c._id) >= 0; })));
    body += '<div class="trow' + (r.group ? ' group' : '') + (hl ? ' hl' : '') + '"><div class="lab">';
    if (r.group) body += '<button type="button" class="name" data-toggle="' + esc(r._id) + '" aria-expanded="' + isOpen(r._id) + '"><svg class="chev" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style="transform:rotate(' + (isOpen(r._id) ? 90 : 0) + 'deg)"><path d="M9 6l6 6-6 6" fill="none" stroke="var(--teal)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></path></svg><span>' + esc(r.label) + '</span></button>';
    else body += '<button type="button" class="name" data-row="' + esc(r._id) + '"' + (S.edit ? '' : ' tabindex="-1"') + '><span>' + esc(r.label) + '</span></button>';
    if (r.beispiel) body += '<button type="button" class="bsp-btn" data-bsp="' + esc(r._id) + '" aria-label="Beispielaufgabe: ' + esc(r.label) + '" title="Beispielaufgabe ansehen"><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" fill="none" stroke="var(--teal)" stroke-width="2"></rect><path d="M8.5 8h7M8.5 12h7M8.5 16h4" stroke="var(--teal)" stroke-width="2" stroke-linecap="round"></path></svg></button>';
    if (r.group && S.edit) body += '<button type="button" class="btn ghost" style="min-height:28px;padding:2px 8px;font-size:12px" data-row="' + esc(r._id) + '">Ändern</button>';
    if (r.etappe && !r.etappe.ab) body += '<span class="lock" title="' + esc(r.etappe.bedingung || 'noch nicht freigeschaltet') + '">gesperrt</span>';
    if (r.quote && r.quote.n) body += '<span class="q ' + qClass(r.quote) + '" title="' + esc(qTitle(r.quote)) + '">' + esc(r.quote.r) + '/' + esc(r.quote.n) + (r.quote.kn != null ? ' · K' + esc(r.quote.kn) : '') + '</span>';
    body += '</div>';
    (r.bars||[]).forEach(function(b){
      var f = Math.max(dn(b.from), start), t = Math.min(dn(b.to), end);
      if (isNaN(f) || isNaN(t) || t < f) return;
      var l = (f - start) * PX, w = Math.max((t - f + 1) * PX, 14);
      var thin = b.kind === 'app' || b.kind === 'planapp';
      var lab = thin ? '' : (b.lab || '');
      var fits = lab && (lab.length * 6.6 + 10) <= w;
      body += '<div class="bar ' + esc(b.kind) + '" style="left:calc(' + L + ' + ' + l + 'px);width:' + w + 'px" title="' + esc(b.lab || '') + ' ' + de(b.from) + '–' + de(b.to) + '">' + (fits ? esc(lab) : '') + '</div>';
      if (lab && !fits) body += '<div class="blab" style="left:calc(' + L + ' + ' + (l + w + 4) + 'px)">' + esc(lab) + '</div>';
    });
    body += '</div>';
  });
  if (!rows.length) body = '<div class="empty">Noch keine Zeilen. Claude trägt die Pakete und Themen ein; im Bearbeiten-Modus kannst du selbst Zeilen anlegen.</div>';
  // Linien
  var lines = '';
  (m.wochen||[]).forEach(function(w){ lines += '<div class="vline" style="left:calc(' + L + ' + ' + x(w.start) + 'px)"></div>'; });
  var t = todayIso();
  if (dn(t) >= start && dn(t) <= end) lines += '<div class="today" style="left:calc(' + L + ' + ' + (x(t) + PX/2) + 'px)"></div><div class="flag" style="bottom:4px;color:var(--amber-ink);left:calc(' + L + ' + ' + (x(t) + PX/2 + 4) + 'px)">heute</div>';
  if (m.test && m.test.datum) lines += '<div class="testl" style="left:calc(' + L + ' + ' + (x(m.test.datum) + PX/2) + 'px)"></div><div class="flag" style="bottom:4px;color:var(--clay);left:calc(' + L + ' + ' + (x(m.test.datum) + PX/2 + 4) + 'px)">' + esc(m.test.name || 'Schultest') + (m.test.offen ? ' (Datum offen)' : '') + '</div>';
  h += '<div style="position:relative">' + lines + body + '</div></div></div>';
  // Erkenntnis-Karte (unten fest über der Zeitleiste)
  if (selIns) {
    h += '<section class="ins" aria-live="polite" aria-label="Erkenntnis ' + esc(selIns.n) + '"><div class="num">' + esc(selIns.n) + '</div><div style="min-width:0">' +
      '<div class="meta"><span class="chip ' + srcClass(selIns.src) + '">' + esc(selIns.src) + '</span><span>' + esc(de(selIns.date)) + '</span><span>· betrifft die hervorgehobenen Zeilen</span>' + (S.edit ? '<button type="button" class="btn ghost" style="min-height:28px;padding:2px 10px;font-size:12px" data-editins="' + esc(selIns._id) + '">Ändern</button>' : '') + '</div>' +
      '<div class="three"><div><div class="k">Gesehen</div>' + esc(selIns.obs) + '</div><div><div class="k ch">Geändert</div>' + esc(selIns.eff) + '</div><div><div class="k wa">Wirkt ab</div>' + esc(selIns.when) + '</div></div></div>' +
      '<button type="button" class="x" data-unsel="1" aria-label="Erkenntnis abwählen" title="Abwählen"><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="var(--fg)" stroke-width="2.4" stroke-linecap="round"></path></svg></button></section>';
  } else if (S.ins.length) {
    h += '<p class="hint">Tippe oben auf eine Erkenntnis, um sie einzublenden. Ein zweiter Tipp blendet sie wieder aus. Die Themen, die sie verändert hat, leuchten dann auf.</p>';
  }
  return h;
}

/* ---------- Bahnen ---------- */
function renderBahnen(){
  var m = S.meta, PX = 50, LW = 130;
  var von = dn((m.fenster && m.fenster.von) || m.start) + S.shift * 7, days = 21, bis = von + days - 1;
  function x(n){ return LW + (n - von) * PX; }
  var W = LW + days * PX;
  var h = '<div class="controls"><button type="button" class="btn" id="lp-prev">← 1 Woche</button><span class="chip src-bogen" style="font-size:13px;padding:4px 10px">' + de(iso(von)) + ' – ' + de(iso(bis)) + '</span><button type="button" class="btn" id="lp-next">1 Woche →</button></div>';
  h += '<div class="card scroller"><div style="position:relative;min-width:' + W + 'px;height:600px">';
  // Tage
  for (var i = 0; i < days; i++) {
    var dd = new Date((von + i) * 864e5), we = dd.getUTCDay() === 0 || dd.getUTCDay() === 6;
    h += '<div style="position:absolute;top:30px;bottom:0;width:' + PX + 'px;left:' + x(von + i) + 'px;border-left:1px solid var(--line-soft);background:' + (we ? 'var(--surface-2)' : 'transparent') + '"></div>';
    h += '<div style="position:absolute;top:36px;width:' + PX + 'px;left:' + x(von + i) + 'px;text-align:center;font-size:12px;color:var(--muted)">' + dd.getUTCDate() + '.</div>';
  }
  (m.wochen||[]).forEach(function(w){ var n = dn(w.start); if (n >= von && n <= bis) h += '<div style="position:absolute;top:8px;left:' + (x(n) + 6) + 'px;font-size:13px;font-weight:700">' + esc(w.name) + '</div>'; });
  var tage = noBoegen() ? [] : S.tage.slice().sort(function(a,b){ return dn(a.date) - dn(b.date); });
  if (noBoegen()) h += freiBahn(von, bis, x, PX);
  // Bahn Bögen
  else h += '<div class="lane-lab" style="position:absolute;top:64px;height:124px;background:var(--surface-2)"><div style="font-family:var(--f-display);color:var(--teal);font-size:16px">Bögen</div><div style="font-weight:400;color:var(--muted);margin-top:4px">auf Papier, führt Neues ein</div></div>';
  tage.forEach(function(t){
    var n = dn(t.date); if (n < von || n > bis) return;
    h += '<button type="button" class="tile ' + esc(t.status || 'plan') + '" data-tag="' + esc(t._id) + '" style="top:76px;height:104px;width:' + (PX - 8) + 'px;left:' + (x(n) + 4) + 'px" aria-label="Bogen ' + esc(t.wk) + ' ' + esc(t.day) + ', Details"><div style="font-weight:700;opacity:.85">' + esc(t.wk) + '</div><div class="d">' + esc(t.day) + '</div><div class="t">' + esc(t.theme) + '</div></button>';
  });
  if (m.test && m.test.datum) { var tn = dn(m.test.datum); if (tn >= von && tn <= bis) h += '<button type="button" class="tile test" data-test="1" style="top:76px;height:104px;width:' + (PX - 8) + 'px;left:' + (x(tn) + 4) + 'px"><b>' + esc(m.test.name || 'Schultest') + '</b>' + (m.test.offen ? '<span>Datum offen</span>' : '') + '</button>'; }
  // Rückmeldung
  h += '<div class="lane-lab" style="position:absolute;top:196px;height:84px;background:var(--amber-soft);color:var(--amber-ink)">Rückmeldung<div style="font-weight:400;color:var(--muted);margin-top:3px">' + (noBoegen() ? 'aus App und Feedback in neue Inhalte' : 'aus App und Bogen in den nächsten Bogen') + '</div></div>';
  var feedRow = {};
  S.ins.forEach(function(e){
    if (!e.ab) return; var n = dn(e.ab); if (n < von || n > bis) return;
    var lvl = feedRow[n] || 0; feedRow[n] = lvl + 1; if (lvl > 1) return;
    h += '<button type="button" class="feed" data-feed="' + esc(e._id) + '" style="top:' + (204 + lvl * 36) + 'px;left:' + (x(n) + 3) + 'px;width:' + (2 * PX - 6) + 'px;text-align:left">' + esc(e.n) + ' · ' + esc(e.kurz || e.eff) + '</button>';
  });
  // Bahnen App
  h += '<div style="position:absolute;top:284px;left:12px;font-family:var(--f-display);font-weight:700;color:var(--amber-ink);font-size:13px">App</div>';
  var top = 306;
  groups().forEach(function(g){
    var blocks = (g.bars||[]).filter(function(b){ return b.kind === 'app' || b.kind === 'planapp'; });
    if (!blocks.length) return;
    h += '<div class="lane-lab" style="position:absolute;top:' + (top - 6) + 'px;height:44px;background:var(--surface)">' + esc(g.lane || g.label) + '</div>';
    blocks.forEach(function(b, bi){
      var f = Math.max(dn(b.from), von), t = Math.min(dn(b.to), bis); if (t < f) return;
      h += '<button type="button" class="blk ' + esc(b.kind) + '" data-blk="' + esc(g._id) + '|' + bi + '" style="top:' + top + 'px;left:' + x(f) + 'px;width:' + ((t - f + 1) * PX - 2) + 'px;text-align:left" aria-label="' + esc((g.lane || g.label) + ': ' + (b.lab || 'App')) + ', Details">' + esc(b.lab || '') + '</button>';
    });
    top += 52;
  });
  // Verbindungen Bogen → App (Etappen)
  tage.forEach(function(t){
    if (!t.etappe) return; var n = dn(t.date) + 1; if (n < von || n > bis) return;
    var g = groups().filter(function(gg){ return gg._id === t.etappe.paket; })[0]; if (!g) return;
    var idx = 0, yy = 306; groups().forEach(function(gg){ var has = (gg.bars||[]).some(function(b){ return b.kind === 'app' || b.kind === 'planapp'; }); if (!has) return; if (gg._id === g._id) yy = 306 + idx * 52; idx++; });
    h += '<div class="link" style="top:182px;height:' + (yy - 182) + 'px;left:' + (x(n) + 8) + 'px"></div><div class="flag" style="top:' + (yy - 18) + 'px;left:' + (x(n) + 12) + 'px;color:var(--teal)">ab morgen: E' + esc(t.etappe.nr) + '</div>';
  });
  var td = dn(todayIso());
  if (td >= von && td <= bis) h += '<div class="today" style="top:56px;left:' + (x(td) + PX/2) + 'px"></div><div class="flag" style="top:56px;color:var(--amber-ink);left:' + (x(td) + PX/2 + 4) + 'px">heute</div>';
  h += '</div></div>';
  // Karten
  var near = S.ins.filter(function(e){ var n = dn(e.date); return n >= von - 21 && n <= bis; }).sort(function(a,b){ return b.n - a.n; }).slice(0, 8);
  h += '<h2 style="margin:6px 0 0;font-family:var(--f-display);font-size:19px">Erkenntnisse und ihre Wirkung</h2>';
  h += near.length ? '<div class="cards">' + near.map(function(e){
    return '<button type="button" class="icard" data-ins="' + esc(e._id) + '"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;width:100%"><span class="chip ' + srcClass(e.src) + '">' + esc(e.n) + ' · ' + esc(e.src) + '</span><span style="color:var(--muted)">' + esc(de(e.date)) + '</span></div><div style="font-size:14px"><b>Gesehen:</b> ' + esc(e.obs) + '</div><div style="font-size:12px;font-weight:700;color:var(--teal)">↓ geändert</div><div style="font-size:14px">' + esc(e.eff) + '</div><div class="when">wirkt ab <b>' + esc(e.when) + '</b></div></button>';
  }).join('') + '</div>' : '<p class="hint">In diesem Zeitraum gibt es noch keine Erkenntnisse.</p>';
  return h;
}

/* ---------- Freischaltungen (Schalter boegen: false) ---------- */
function freiBahn(von, bis, x, PX){
  var h = '<div class="lane-lab" style="position:absolute;top:64px;height:124px;background:var(--surface-2)"><div style="font-family:var(--f-display);color:var(--teal);font-size:16px">Freischaltungen</div><div style="font-weight:400;color:var(--muted);margin-top:4px">Etappen schalten in der App automatisch frei</div></div>';
  var et = S.rows.filter(function(r){ return r.etappe; }), td = dn(todayIso()), byDay = {};
  et.forEach(function(r){ if (!r.etappe.ab) return; var n = dn(r.etappe.ab); if (n < von || n > bis) return; (byDay[n] = byDay[n] || []).push(r); });
  Object.keys(byDay).forEach(function(k){
    var n = +k, list = byDay[k];
    h += '<button type="button" class="tile ' + (n <= td ? 'done' : 'next') + '" data-frei="' + esc(list.map(function(r){ return r._id; }).join(',')) + '" style="top:76px;height:104px;width:' + (PX - 8) + 'px;left:' + (x(n) + 4) + 'px;overflow:hidden" aria-label="Freigeschaltet am ' + esc(de(iso(n))) + ', Details"><div class="d">' + new Date(n * 864e5).getUTCDate() + '.</div><div class="t">' + (list.length > 2 ? esc(list.map(function(r){ return 'E' + r.etappe.nr; }).filter(function(v, i, a){ return a.indexOf(v) === i; }).join(', ')) + '\n' + list.length + ' Pakete' : list.map(function(r){ return esc(etName(r)); }).join('\n')) + '</div></button>';
  });
  // offene Etappen: je Paket die nächste, ohne Datum, ab morgen der Reihe nach
  var next = {}; et.forEach(function(r){ if (r.etappe.ab) return; var p = r.etappe.paket; if (!next[p] || r.etappe.nr < next[p].etappe.nr) next[p] = r; });
  var pos = Math.max(td + 1, von), used = {};
  Object.keys(byDay).forEach(function(k){ used[k] = 1; });
  sortedRows().filter(function(r){ return next[r.etappe && r.etappe.paket] === r; }).forEach(function(r){
    while (used[pos] || used[pos + 1]) pos++;
    if (pos > bis) return;
    h += '<button type="button" class="tile offen" data-frei="' + esc(r._id) + '" style="top:76px;height:104px;width:' + (PX - 8) + 'px;left:' + (x(pos) + 4) + 'px;overflow:hidden" aria-label="' + esc(etName(r)) + ', noch gesperrt, Details"><div class="d">?</div><div class="t">' + esc(etName(r)) + '</div></button>';
    used[pos] = 1; pos += 2;
  });
  return h;
}
function openFrei(ids, opener){
  var list = ids.split(',').map(rowById).filter(Boolean); if (!list.length) return;
  var b = '', actions = '';
  list.forEach(function(r){
    var g = rowById(r.etappe.paket);
    b += '<div style="border-bottom:1px solid var(--line-soft);padding-bottom:8px;display:flex;flex-direction:column;gap:4px">' + kv('Paket', esc(g ? g.label : r.etappe.paket)) + kv('Etappe', esc(r.etappe.nr + ' · ' + r.label.replace(/^E\d+ · /, ''))) +
      kv('Freigeschaltet', r.etappe.ab ? esc(de(r.etappe.ab)) : '<span class="chip src-app">noch gesperrt</span>' + (r.etappe.bedingung ? ' ' + esc(r.etappe.bedingung) : '')) + kv('App-Quote', qChip(r)) + '</div>';
    if (r.beispiel) actions += '<button type="button" class="btn" data-bsp-from="' + esc(r._id) + '">Beispiel ' + esc(etName(r)) + '</button>';
  });
  infoSheet(list.length > 1 ? 'Neue Etappen am ' + esc(de(list[0].etappe.ab)) : esc(etName(list[0])), 'Freischaltung', b, opener, actions);
}

function render(){
  var nb = noBoegen();
  $('lg-bogen').hidden = nb;
  $('lg-plan').hidden = nb;
  $('lg-planapp').hidden = !nb;
  $('add-tag').hidden = nb;
  $('v-zeit').setAttribute('aria-pressed', S.view === 'zeit');
  $('v-bahnen').setAttribute('aria-pressed', S.view === 'bahnen');
  $('edit').hidden = !S.canEdit;
  $('edit').setAttribute('aria-pressed', S.edit);
  $('editbar').hidden = !S.edit;
  var v = $('view');
  if (!S.bereit) { v.innerHTML = '<div class="card empty">Der Lernplan wird geladen. Er zeigt Pakete, Themen und Erkenntnisse, sobald die gespeicherten Daten da sind.</div>'; return; }
  if (!S.meta) { v.innerHTML = '<div class="card empty">Noch kein Lernplan gespeichert. Claude legt ihn an und trägt nach jedem Bogen neue Daten ein.</div>'; return; }
  $('stand').textContent = S.meta.stand ? 'Stand ' + de(S.meta.stand) : '';
  if (S.meta.eyebrow) $('eyebrow').textContent = S.meta.eyebrow;
  if (S.meta.titel) $('title').textContent = S.meta.titel;
  v.innerHTML = S.view === 'zeit' ? renderZeit() : renderBahnen();
  var hasCard = S.view === 'zeit' && S.ins.some(function(e){ return e._id === S.sel; });
  root.querySelector('.wrap').style.paddingBottom = hasCard ? 'calc(260px + env(safe-area-inset-bottom, 0px))' : '';
}

/* ---------- Bearbeiten ---------- */
var KINDS = [['bogen','Bogen'],['app','App'],['plan','Bogen geplant'],['planapp','App geplant'],['pause','Pause']];
function closeDlg(){ $('dlg').innerHTML = ''; }
function openPanel(title, inner, onSave, onDelete){
  var d = $('dlg');
  d.innerHTML = '<div class="overlay" id="lp-ov"><form class="panel" id="lp-pf" aria-label="' + esc(title) + '"><h2>' + esc(title) + '</h2>' + inner +
    '<div class="actions"><div style="display:flex;gap:10px">' + (onDelete ? '<button type="button" class="btn danger" id="lp-pdel">Löschen</button>' : '') + '</div><div style="display:flex;gap:10px"><button type="button" class="btn ghost" id="lp-pcancel">Abbrechen</button><button type="submit" class="btn primary">Speichern</button></div></div></form></div>';
  $('pcancel').onclick = closeDlg;
  $('ov').onclick = function(e){ if (e.target.id === 'lp-ov') closeDlg(); };
  $('pf').onsubmit = function(e){ e.preventDefault(); Promise.resolve(onSave(new FormData(e.target), e.target)).then(function(ok){ if (ok !== false) { closeDlg(); toast('Gespeichert'); } }).catch(function(err){ toast('Nicht gespeichert: ' + (err && err.code === 'invalid_argument' ? 'keine Schreibrechte' : 'bitte noch einmal versuchen')); }); };
  if (onDelete) { var b = $('pdel'), armed = false; b.onclick = function(){ if (!armed) { armed = true; b.textContent = 'Wirklich löschen?'; return; } Promise.resolve(onDelete()).then(function(){ closeDlg(); toast('Gelöscht'); }); }; }
  var first = d.querySelector('input,select,textarea'); if (first) first.focus();
}
function slug(s){ return (String(s).toLowerCase().replace(/[äöüß]/g, function(c){ return {'ä':'ae','ö':'oe','ü':'ue','ß':'ss'}[c]; }).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,30) || 'zeile') + '-' + Math.random().toString(36).slice(2,6); }
function barHtml(b, i){
  return '<div class="barbox" data-bar="' + i + '"><div class="row2"><div class="field"><label for="bk' + i + '">Art</label><select id="bk' + i + '" name="bk' + i + '">' + KINDS.map(function(k){ return '<option value="' + k[0] + '"' + (b.kind === k[0] ? ' selected' : '') + '>' + k[1] + '</option>'; }).join('') + '</select></div><div class="field"><label for="bl' + i + '">Beschriftung</label><input id="bl' + i + '" name="bl' + i + '" value="' + esc(b.lab || '') + '"></div></div>' +
    '<div class="row2"><div class="field"><label for="bf' + i + '">von</label><input type="date" id="bf' + i + '" name="bf' + i + '" value="' + esc(b.from || '') + '" required></div><div class="field"><label for="bt' + i + '">bis</label><input type="date" id="bt' + i + '" name="bt' + i + '" value="' + esc(b.to || '') + '" required></div></div>' +
    '<button type="button" class="btn ghost" data-rmbar="' + i + '" style="align-self:flex-start;min-height:32px;padding:4px 10px;font-size:13px">Balken entfernen</button></div>';
}
function editRow(id){
  var r = S.rows.filter(function(x){ return x._id === id; })[0] || { label:'', group:false, parent:'', order: (sortedRows().slice(-1)[0] || {order:0}).order + 10, bars:[] };
  var bars = (r.bars || []).slice();
  function inner(){
    return '<div class="field"><label for="rl">Bezeichnung</label><input id="rl" name="label" value="' + esc(r.label) + '" required></div>' +
      '<div class="row2"><div class="field"><label for="rp">Gehört zu</label><select id="rp" name="parent"><option value="">— ist selbst ein Paket —</option>' + groups().filter(function(g){ return g._id !== id; }).map(function(g){ return '<option value="' + esc(g._id) + '"' + (r.parent === g._id ? ' selected' : '') + '>' + esc(g.label) + '</option>'; }).join('') + '</select></div><div class="field"><label for="ro">Reihenfolge</label><input id="ro" name="order" type="number" value="' + esc(r.order) + '"></div></div>' +
      '<div class="row3"><div class="field"><label for="qr">App richtig</label><input id="qr" name="qr" type="number" min="0" value="' + esc(r.quote ? r.quote.r : '') + '"></div><div class="field"><label for="qn">von</label><input id="qn" name="qn" type="number" min="0" value="' + esc(r.quote ? r.quote.n : '') + '"></div><div class="field"><label for="qs">Stand</label><input id="qs" name="qs" type="date" value="' + esc(r.quote ? r.quote.stand || '' : '') + '"></div></div>' +
      '<div class="flabel">Balken</div><div id="lp-bars" style="display:flex;flex-direction:column;gap:10px">' + bars.map(barHtml).join('') + '</div><button type="button" class="btn" id="lp-addbar" style="align-self:flex-start">Balken hinzufügen</button>';
  }
  function collect(form){
    var fd = new FormData(form);
    return bars.map(function(_, i){ return { kind: fd.get('bk'+i), lab: fd.get('bl'+i) || '', from: fd.get('bf'+i), to: fd.get('bt'+i) }; });
  }
  function wire(){
    var form = $('pf');
    $('addbar').onclick = function(){ bars = collect(form); var last = bars[bars.length-1]; bars.push({ kind:'bogen', from: last ? last.to : todayIso(), to: last ? last.to : todayIso(), lab:'' }); var keep = { label: form.label.value, parent: form.parent.value, order: form.order.value, qr: form.qr.value, qn: form.qn.value, qs: form.qs.value }; r = Object.assign({}, r, { label: keep.label, parent: keep.parent, order: +keep.order, quote: keep.qn ? { r:+keep.qr, n:+keep.qn, stand: keep.qs } : null }); show(); };
    Array.prototype.forEach.call(root.querySelectorAll('[data-rmbar]'), function(b){ b.onclick = function(){ bars = collect(form); bars.splice(+b.getAttribute('data-rmbar'), 1); r = Object.assign({}, r, { label: form.label.value, parent: form.parent.value, order: +form.order.value }); show(); }; });
  }
  function show(){
    openPanel(id ? 'Zeile ändern' : 'Neue Zeile', inner(), function(fd, form){
      var out = { label: String(fd.get('label')).trim(), parent: fd.get('parent') || null, group: !fd.get('parent'), order: +fd.get('order') || 0, bars: collect(form).filter(function(b){ return b.from && b.to; }) };
      if (fd.get('qn')) out.quote = { r: +fd.get('qr') || 0, n: +fd.get('qn'), stand: fd.get('qs') || '' };
      if (out.quote && r.quote && r.quote.kn != null) out.quote.kn = r.quote.kn;
      if (r.etappe) out.etappe = r.etappe;
      if (r.lane) out.lane = r.lane;
      if (r.beispiel) out.beispiel = r.beispiel;
      return S.db.doc('rows/' + (id || slug(out.label))).set(out);
    }, id ? function(){ return S.db.doc('rows/' + id).delete(); } : null);
    wire();
  }
  show();
}
function editIns(id){
  var e = S.ins.filter(function(x){ return x._id === id; })[0] || { n: (S.ins.reduce(function(a,b){ return Math.max(a, b.n || 0); }, 0) + 1), date: todayIso(), src: (S.meta && S.meta.quellen ? S.meta.quellen[0] : 'Bogen'), obs:'', eff:'', when:'', ab:'', kurz:'', rows:[] };
  var leaf = sortedRows();
  var inner = '<div class="row2"><div class="field"><label for="en">Nummer</label><input id="en" name="n" type="number" value="' + esc(e.n) + '"></div><div class="field"><label for="ed">Datum</label><input id="ed" name="date" type="date" value="' + esc(e.date) + '" required></div></div>' +
    '<div class="field"><label for="es">Woher</label><select id="es" name="src">' + ((S.meta && S.meta.quellen) || ['Bogen','App','Bogen und App']).map(function(s){ return '<option' + (e.src === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>' +
    '<div class="field"><label for="eo">Gesehen</label><textarea id="eo" name="obs" required>' + esc(e.obs) + '</textarea></div>' +
    '<div class="field"><label for="ee">Geändert</label><textarea id="ee" name="eff">' + esc(e.eff) + '</textarea></div>' +
    '<div class="row2"><div class="field"><label for="ew">Wirkt ab (Text)</label><input id="ew" name="when" value="' + esc(e.when) + '"></div><div class="field"><label for="ea">Wirkt ab (Datum, für Bahnen)</label><input id="ea" name="ab" type="date" value="' + esc(e.ab || '') + '"></div></div>' +
    '<div class="field"><label for="ek">Kurztext für die Rückmeldung</label><input id="ek" name="kurz" value="' + esc(e.kurz || '') + '"></div>' +
    '<div class="flabel">Betroffene Zeilen</div><div class="checks">' + leaf.map(function(r){ return '<label><input type="checkbox" name="rows" value="' + esc(r._id) + '"' + ((e.rows||[]).indexOf(r._id) >= 0 ? ' checked' : '') + '>' + (r.group ? '<b>' + esc(r.label) + '</b>' : esc(r.label)) + '</label>'; }).join('') + '</div>';
  openPanel(id ? 'Erkenntnis ändern' : 'Neue Erkenntnis', inner, function(fd){
    var out = { n: +fd.get('n'), date: fd.get('date'), src: fd.get('src'), obs: fd.get('obs'), eff: fd.get('eff'), when: fd.get('when'), ab: fd.get('ab') || '', kurz: fd.get('kurz') || '', rows: fd.getAll('rows') };
    var nid = id || ('e' + out.n + '-' + Math.random().toString(36).slice(2,5));
    S.sel = nid;
    return S.db.doc('insights/' + nid).set(out);
  }, id ? function(){ if (S.sel === id) S.sel = null; return S.db.doc('insights/' + id).delete(); } : null);
}
function editTag(id){
  var t = S.tage.filter(function(x){ return x._id === id; })[0] || { wk:'', day:'', date: todayIso(), theme:'', status:'plan', etappe:null };
  var inner = '<div class="row3"><div class="field"><label for="tw">Woche</label><input id="tw" name="wk" value="' + esc(t.wk) + '" placeholder="W6" required></div><div class="field"><label for="td">Tag</label><input id="td" name="day" value="' + esc(t.day) + '" placeholder="T1" required></div><div class="field"><label for="tdt">Datum</label><input id="tdt" name="date" type="date" value="' + esc(t.date) + '" required></div></div>' +
    '<div class="field"><label for="tt">Thema (kurz, Zeilenumbruch erlaubt)</label><textarea id="tt" name="theme">' + esc(t.theme) + '</textarea></div>' +
    '<div class="field"><label for="tsx">Status</label><select id="tsx" name="status">' + [['done','erledigt'],['next','als Nächstes'],['plan','geplant']].map(function(s){ return '<option value="' + s[0] + '"' + (t.status === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select></div>' +
    '<div class="row2"><div class="field"><label for="tep">Führt Etappe ein (Paket)</label><select id="tep" name="ep"><option value="">— keine —</option>' + groups().map(function(g){ return '<option value="' + esc(g._id) + '"' + (t.etappe && t.etappe.paket === g._id ? ' selected' : '') + '>' + esc(g.label) + '</option>'; }).join('') + '</select></div><div class="field"><label for="ten">Etappe Nr.</label><input id="ten" name="en" type="number" min="1" value="' + esc(t.etappe ? t.etappe.nr : '') + '"></div></div>';
  openPanel(id ? 'Bogentag ändern' : 'Neuer Bogentag', inner, function(fd){
    var out = { wk: fd.get('wk'), day: fd.get('day'), date: fd.get('date'), theme: fd.get('theme'), status: fd.get('status'), etappe: fd.get('ep') && fd.get('en') ? { paket: fd.get('ep'), nr: +fd.get('en') } : null };
    var nid = id || slug(out.wk + out.day);
    return S.db.doc('bogentage/' + nid).set(out);
  }, id ? function(){ return S.db.doc('bogentage/' + id).delete(); } : null);
}
function editMeta(){
  var m = S.meta;
  var inner = '<div class="row2"><div class="field"><label for="ms">Zeitleiste von</label><input id="ms" name="start" type="date" value="' + esc(m.start) + '" required></div><div class="field"><label for="me">bis</label><input id="me" name="end" type="date" value="' + esc(m.end) + '" required></div></div>' +
    '<div class="field"><label for="mf">Bahnen starten bei</label><input id="mf" name="fv" type="date" value="' + esc(m.fenster ? m.fenster.von : '') + '"></div>' +
    '<div class="row2"><div class="field"><label for="mt">Test am</label><input id="mt" name="test" type="date" value="' + esc(m.test ? m.test.datum : '') + '"></div><div class="field"><label for="mtn">Bezeichnung</label><input id="mtn" name="testname" value="' + esc(m.test ? m.test.name || 'Schultest' : 'Schultest') + '"></div></div>' +
    '<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="offen"' + (m.test && m.test.offen ? ' checked' : '') + '> Datum noch nicht sicher</label>' +
    '<div class="field"><label for="mw">Wochen (eine pro Zeile: Name Datum)</label><textarea id="mw" name="wochen" style="min-height:160px">' + esc((m.wochen||[]).map(function(w){ return w.name + ' ' + w.start; }).join('\n')) + '</textarea></div>';
  openPanel('Zeitraum und Test', inner, function(fd){
    var out = Object.assign({}, m, { start: fd.get('start'), end: fd.get('end'), fenster: { von: fd.get('fv') || fd.get('start') }, test: fd.get('test') ? { datum: fd.get('test'), name: fd.get('testname') || 'Schultest', offen: !!fd.get('offen') } : null,
      wochen: String(fd.get('wochen')).split('\n').map(function(l){ var p = l.trim().split(/\s+/); var d = p.pop(); return { name: p.join(' '), start: d }; }).filter(function(w){ return w.name && /^\d{4}-\d{2}-\d{2}$/.test(w.start); }) });
    delete out._id;
    return S.db.doc('plan/meta').set(out);
  }, null);
}

/* ---------- Beispielaufgabe ---------- */
function mth(s){ return fml(esc(s).replace(/A_([GMO])/g, 'A<sub>$1</sub>').replace(/(\d+)\/(\d+)(?= von| ·|$|\s)/g, '<span style="display:inline-flex;flex-direction:column;align-items:center;vertical-align:middle;line-height:1;font-size:.9em;margin:0 2px"><span style="border-bottom:1.6px solid currentColor;padding:0 3px">$1</span><span>$2</span></span>')); }
function fml(h){
  if (!(S.meta && S.meta.formeln)) return h;
  h = h.replace(/([A-Za-zρ])_([A-Za-z0-9]{1,3})/g, '$1<sub>$2</sub>');
  h = h.replace(/(^|[\s(=·:])(N|g|kg|km|m|s|L|J|W)\/(kg|cm³|dm³|m³|cm²|m²|s²|s|h|L)(?=$|[\s),.;·])/g, '$1<span class="ufr"><span>$2</span><span>$3</span></span>');
  return h;
}
function bildSvg(b){
  if (!b) return '';
  var T = 'var(--ink)', A = 'var(--teal)', M = 'var(--amber-line)', F = 'font-family="Atkinson Hyperlegible, sans-serif" font-weight="700"';
  if (b.form === 'rechteck' || b.form === 'streifen') {
    var z = b.zeilen || 1, sp = b.spalten || b.teile, cw = b.form === 'streifen' ? 36 : 30, ch = b.form === 'streifen' ? 30 : 30, o = '', n = 0;
    for (var i = 0; i < z; i++) for (var j = 0; j < sp; j++) { o += '<rect x="' + (2 + j*cw) + '" y="' + (2 + i*ch) + '" width="' + cw + '" height="' + ch + '" fill="' + (n < b.gefaerbt ? '#E9B65A' : 'var(--surface)') + '" stroke="' + T + '" stroke-width="1.4"></rect>'; n++; }
    return '<svg width="' + (sp*cw + 4) + '" height="' + (z*ch + 4) + '" role="img" aria-label="' + (z*sp) + ' Teile, ' + b.gefaerbt + ' gefärbt">' + o + '<rect x="2" y="2" width="' + (sp*cw) + '" height="' + (z*ch) + '" fill="none" stroke="' + T + '" stroke-width="2.5"></rect></svg>';
  }
  if (b.form === 'kreisdiagramm') {
    var cols = ['#7FB8BC','#E9B65A','#C8DDB0','#E6B9A0'], a = -Math.PI/2, o2 = '', leg = '';
    b.segmente.forEach(function(sg, k){ var e = a + 2*Math.PI*sg[1]/100, L = sg[1] > 50 ? 1 : 0;
      o2 += '<path d="M60 60 L' + (60+54*Math.cos(a)).toFixed(1) + ' ' + (60+54*Math.sin(a)).toFixed(1) + ' A54 54 0 ' + L + ' 1 ' + (60+54*Math.cos(e)).toFixed(1) + ' ' + (60+54*Math.sin(e)).toFixed(1) + ' Z" fill="' + cols[k%4] + '" stroke="#1E2A2B" stroke-width="1.2"></path>';
      var m = (a+e)/2; o2 += '<text x="' + (60+34*Math.cos(m)).toFixed(1) + '" y="' + (60+34*Math.sin(m)+4).toFixed(1) + '" text-anchor="middle" font-size="11" fill="#1E2A2B" ' + F + '>' + sg[1] + ' %</text>';
      leg += '<div style="display:flex;gap:6px;align-items:center;font-size:14px"><span style="width:14px;height:14px;border-radius:3px;border:1px solid #1E2A2B;background:' + cols[k%4] + '"></span>' + esc(sg[0]) + '</div>'; a = e; });
    return '<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label="Kreisdiagramm">' + o2 + '</svg><div><div style="font-size:14px;font-weight:700;margin-bottom:4px">' + esc(b.titel || '') + '</div>' + leg + '</div></div>';
  }
  var lab = function(x, y, t, c, anchor){ return '<text x="' + x + '" y="' + y + '" font-size="15" fill="' + c + '" text-anchor="' + (anchor || 'start') + '" ' + F + '>' + t + '</text>'; };
  var v = function(k){ return String(b[k]).replace('.', ','); };
  if (b.form === 'zylinder') {
    var top = '<ellipse cx="70" cy="30" rx="56" ry="14" fill="var(--teal-soft)" stroke="' + A + '" stroke-width="2"></ellipse>';
    var rl = b.d ? '<line x1="14" y1="30" x2="126" y2="30" stroke="' + M + '" stroke-width="2.6"></line>' + lab(70, 12, 'd = ' + v('d') + ' cm', M, 'middle') : '<line x1="70" y1="30" x2="126" y2="30" stroke="' + M + '" stroke-width="2.6"></line><circle cx="70" cy="30" r="3" fill="' + T + '"></circle>' + lab(98, 12, 'r = ' + v('r') + ' cm', M, 'middle');
    return '<svg width="240" height="170" viewBox="0 0 240 170" role="img" aria-label="Zylinder"><path d="M14 30V140A56 14 0 0 0 126 140V30" fill="none" stroke="' + A + '" stroke-width="2"></path><path d="M14 140A56 14 0 0 1 126 140" fill="none" stroke="' + A + '" stroke-width="1.2" stroke-dasharray="4 3"></path>' + top + rl + '<line x1="144" y1="32" x2="144" y2="140" stroke="#993C1D" stroke-width="2"></line><path d="M139 40L144 31L149 40M139 132L144 141L149 132" fill="none" stroke="#993C1D" stroke-width="2"></path>' + lab(152, 92, 'h = ' + v('h') + ' cm', '#993C1D') + '</svg>';
  }
  if (b.form === 'kegel') {
    var o3 = '<path d="M14 140A56 14 0 0 0 126 140" fill="none" stroke="' + A + '" stroke-width="2"></path><path d="M14 140A56 14 0 0 1 126 140" fill="none" stroke="' + A + '" stroke-width="1.2" stroke-dasharray="4 3"></path><line x1="14" y1="140" x2="70" y2="20" stroke="' + A + '" stroke-width="2"></line><line x1="126" y1="140" x2="70" y2="20" stroke="#1F6F75" stroke-width="3.4"></line><line x1="70" y1="140" x2="126" y2="140" stroke="' + M + '" stroke-width="2.6"></line><circle cx="70" cy="140" r="3" fill="' + T + '"></circle>' + lab(98, 160, 'r = ' + v('r') + ' cm', M, 'middle');
    if (b.h) o3 += '<line x1="70" y1="20" x2="70" y2="140" stroke="#993C1D" stroke-width="2" stroke-dasharray="6 4"></line>' + lab(66, 92, 'h', '#993C1D', 'end');
    if (b.s) o3 += lab(104, 74, 's = ' + v('s') + ' cm', '#1F6F75');
    return '<svg width="240" height="170" viewBox="0 0 240 170" role="img" aria-label="Kegel">' + o3 + '</svg>';
  }
  if (b.form === 'pyramide') {
    var o4 = '<path d="M20 150H130L170 124" fill="none" stroke="' + A + '" stroke-width="2"></path><path d="M20 150L60 124H170" fill="none" stroke="' + A + '" stroke-width="1.2" stroke-dasharray="4 3"></path><line x1="95" y1="20" x2="20" y2="150" stroke="' + A + '" stroke-width="2"></line><line x1="95" y1="20" x2="130" y2="150" stroke="' + A + '" stroke-width="2"></line><line x1="95" y1="20" x2="170" y2="124" stroke="' + A + '" stroke-width="2"></line>' + lab(75, 168, 'a = ' + v('a') + ' cm', M, 'middle');
    if (b.h) o4 += '<line x1="95" y1="20" x2="95" y2="137" stroke="#993C1D" stroke-width="2" stroke-dasharray="6 4"></line>' + lab(100, 96, 'h = ' + v('h') + ' cm', '#993C1D');
    if (b.hs) o4 += '<line x1="95" y1="20" x2="75" y2="150" stroke="#1F6F75" stroke-width="3.2"></line>' + lab(18, 84, 'hₛ = ' + v('hs') + ' cm', '#1F6F75');
    return '<svg width="240" height="175" viewBox="0 0 240 175" role="img" aria-label="Pyramide">' + o4 + '</svg>';
  }
  if (b.form === 'kugel') {
    return '<svg width="200" height="140" viewBox="0 0 200 140" role="img" aria-label="Kugel"><circle cx="70" cy="70" r="58" fill="var(--surface-2)" stroke="' + A + '" stroke-width="2"></circle><path d="M12 70A58 16 0 0 0 128 70" fill="none" stroke="' + A + '" stroke-width="1.4"></path><line x1="70" y1="70" x2="128" y2="70" stroke="' + M + '" stroke-width="2.6"></line><circle cx="70" cy="70" r="3" fill="' + T + '"></circle>' + lab(138, 76, 'r = ' + v('r') + ' cm', M) + '</svg>';
  }
  return '';
}
function openBeispiel(id, opener){
  var r = S.rows.filter(function(x){ return x._id === id; })[0]; if (!r || !r.beispiel) return;
  var b = r.beispiel, h = '';
  h += '<div class="src"><span>' + esc(b.quelle || '') + '</span>' + (b.entwurf ? '<span class="draft">Entwurf</span>' : '') + '</div>';
  h += '<h2 id="lp-bsp-t">' + esc(r.label) + '</h2>';
  if (b.geschichte) h += '<div class="story">' + mth(b.geschichte) + '</div>';
  if (b.bild) h += '<div>' + bildSvg(b.bild) + '</div>';
  if (b.rechnung) h += '<div class="rech">' + mth(b.rechnung) + '</div>';
  if (b.rechnungen) h += '<div style="display:flex;flex-wrap:wrap;gap:10px 28px">' + b.rechnungen.map(function(x){ return '<span class="rech" style="font-size:21px">' + mth(x) + ' = <span class="blank"></span></span>'; }).join('') + '</div>';
  h += '<div><b>' + mth(b.frage) + '</b></div>';
  var kn = b.modus === 'knobeln';
  if (kn) h += '<div class="knob">Knobel erst selbst.</div>' + (b.antwort ? '<div class="step">' + mth(b.antwort.split('___')[0]) + '<span class="blank"></span> ' + mth((b.antwort.split('___')[1] || '').trim()) + '</div>' : '') + '<div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="btn" id="lp-bsp-steps-btn" aria-expanded="false">In Schritten rechnen</button></div><div id="lp-bsp-steps" hidden style="display:flex;flex-direction:column;gap:10px">';
  if (b.gegeben) h += '<div class="merk"><b>Merkzettel:</b>' + b.gegeben.map(function(g){ return '<span>' + mth(g[0]) + ' = ' + (/___/.test(g[1]) ? '<span class="blank" style="min-width:50px"></span>' + esc(g[1].replace('___','')) : esc(g[1])) + '</span>'; }).join('') + '</div>';
  if (b.schritte) h += b.schritte.map(function(x){ return '<div class="step"><span>' + mth(x.replace(/ ?___ ?€?$/,'').replace('___ €','')) + '</span>' + (/[=≈]\s*$/.test(x) || /___/.test(x) ? ' <span class="blank"></span>' : '') + '</div>'; }).join('');
  if (b.fragen) h += '<ol style="margin:0;padding-left:22px;display:flex;flex-direction:column;gap:8px">' + b.fragen.map(function(f){ return '<li>' + mth(f) + '<br><span class="blank" style="min-width:160px"></span></li>'; }).join('') + '</ol>';
  if (kn) h += '</div>';
  if (b.antwort && !kn) h += '<div class="step">' + (b.antwort === 'Bruch' ? '<span style="display:inline-flex;flex-direction:column;align-items:center;gap:2px"><span class="blank" style="min-width:36px"></span><span style="border-top:2px solid var(--ink);width:44px"></span><span class="blank" style="min-width:36px"></span></span>' : 'Antwort: <span class="blank"></span> ' + esc(b.antwort.replace('___','').trim())) + '</div>';
  if (b.hinweise && b.hinweise.length) h += '<div class="tags">' + b.hinweise.map(function(t){ return '<span>Hinweis: ' + esc(t) + '</span>'; }).join('') + '</div>';
  h += '<div id="lp-bsp-sol" class="sol" hidden>' + (b.loesung || []).map(function(l, i, arr){ return '<div' + (i === arr.length - 1 ? ' class="res"' : '') + '>' + mth(l) + '</div>'; }).join('') + (b.erklaerung ? '<div style="color:var(--muted);font-style:italic">' + mth(b.erklaerung) + '</div>' : '') + '</div>';
  h += '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><button type="button" class="btn" id="lp-bsp-show" aria-expanded="false">Lösung zeigen</button><button type="button" class="btn primary" id="lp-bsp-close">Schließen</button></div>';
  var d = $('dlg');
  d.innerHTML = '<div class="modal" id="lp-bsp-ov"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="lp-bsp-t">' + h + '</div></div>';
  function close(){ d.innerHTML = ''; if (opener) opener.focus(); }
  $('bsp-close').onclick = close;
  $('bsp-ov').onclick = function(e){ if (e.target.id === 'lp-bsp-ov') close(); };
  var stb = $('bsp-steps-btn');
  if (stb) stb.onclick = function(){ var st = $('bsp-steps'); st.hidden = !st.hidden; stb.textContent = st.hidden ? 'In Schritten rechnen' : 'Schritte ausblenden'; stb.setAttribute('aria-expanded', !st.hidden); };
  var sb = $('bsp-show');
  sb.onclick = function(){ var sol = $('bsp-sol'); sol.hidden = !sol.hidden; sb.textContent = sol.hidden ? 'Lösung zeigen' : 'Lösung verbergen'; sb.setAttribute('aria-expanded', !sol.hidden); };
  $('bsp-close').focus();
}

/* ---------- Detail-Overlays (Bahnen) ---------- */
function rowById(id){ return S.rows.filter(function(r){ return r._id === id; })[0]; }
function stLabel(s){ return { done:'erledigt', next:'als Nächstes', plan:'geplant' }[s] || s; }
function qChip(r){ return r.quote && r.quote.n ? '<span class="q ' + qClass(r.quote) + '" title="' + esc(qTitle(r.quote)) + '">' + esc(r.quote.r) + '/' + esc(r.quote.n) + '</span>' + (r.quote.kn != null ? ' <span class="hint">davon geknobelt ' + esc(r.quote.kn) + '</span>' : '') : '<span class="hint">noch keine App-Daten</span>'; }
function insMini(e){ return '<button type="button" class="icard" data-info-ins="' + esc(e._id) + '" style="width:100%"><div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;width:100%"><span class="chip ' + srcClass(e.src) + '">' + esc(e.n) + ' · ' + esc(e.src) + '</span><span style="color:var(--muted)">' + esc(de(e.date)) + '</span></div><div style="font-size:14px"><b>Gesehen:</b> ' + esc(e.obs) + '</div><div style="font-size:14px"><b>Geändert:</b> ' + esc(e.eff) + '</div></button>'; }
function infoSheet(title, sub, body, opener, actions){
  var d = $('dlg');
  d.innerHTML = '<div class="modal" id="lp-inf-ov"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="lp-inf-t" style="font-size:15.5px">' +
    '<div class="src"><span>' + sub + '</span></div><h2 id="lp-inf-t">' + title + '</h2>' + body +
    '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:4px"><div style="display:flex;gap:10px;flex-wrap:wrap">' + (actions || '') + '</div><button type="button" class="btn primary" id="lp-inf-close">Schließen</button></div></div></div>';
  function close(){ d.innerHTML = ''; if (opener && document.body.contains(opener)) opener.focus(); }
  $('inf-close').onclick = close;
  $('inf-ov').onclick = function(e){
    if (e.target.id === 'lp-inf-ov') { close(); return; }
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.infoIns) { S.sel = b.dataset.infoIns; S.view = 'zeit'; d.innerHTML = ''; render(); }
    if (b.dataset.bspFrom) { openBeispiel(b.dataset.bspFrom, opener); }
    if (b.dataset.editTag) { editTag(b.dataset.editTag); }
    if (b.dataset.editRow) { editRow(b.dataset.editRow); }
    if (b.dataset.editMeta) { editMeta(); }
  };
  $('inf-close').focus();
}
function kv(k, v){ return '<div style="display:grid;grid-template-columns:130px minmax(0,1fr);gap:10px;align-items:baseline"><span style="font-size:12.5px;font-weight:700;color:var(--muted)">' + esc(k) + '</span><span>' + v + '</span></div>'; }
function openTag(id, opener){
  var t = S.tage.filter(function(x){ return x._id === id; })[0]; if (!t) return;
  var b = '';
  b += kv('Datum', esc(de(t.date))) + kv('Status', '<span class="chip ' + (t.status === 'done' ? 'src-bogen' : 'src-app') + '">' + esc(stLabel(t.status)) + '</span>') + kv('Schwerpunkt', esc(String(t.theme || '').replace(/-\n/g,'').replace(/\n/g,' ')));
  var er = null, actions = '';
  if (t.etappe) {
    var g = rowById(t.etappe.paket), appAb = iso(dn(t.date) + 1);
    er = t.row ? rowById(t.row) : null;
    b += kv('Führt ein', esc((g ? g.label.split(' · ')[0] : t.etappe.paket) + ', Etappe ' + t.etappe.nr) + (er ? ' · ' + esc(er.label.replace(/^Etappe \d+ · /,'')) : ''));
    b += kv('In der App', t.status === 'done' ? 'ab ' + esc(de(appAb)) : 'ab dem Tag nach dem Bogen (geplant ' + esc(de(appAb)) + ')');
    if (er && er.beispiel) actions += '<button type="button" class="btn" data-bsp-from="' + esc(er._id) + '">Beispielaufgabe</button>';
  }
  if (t.canvas) b += kv('Übungsblatt', '<a href="' + esc(t.canvas) + '" target="_blank" rel="noopener">Bogen öffnen</a>');
  var rel = S.ins.filter(function(e){ return e.date === t.date || e.ab === t.date; });
  if (rel.length) b += '<div class="flabel" style="margin-top:4px">Erkenntnisse zu diesem Tag</div>' + rel.map(insMini).join('');
  var other = S.rows.filter(function(r){ return !r.group && (r.bars || []).some(function(x){ return (x.kind === 'bogen' || x.kind === 'plan') && dn(x.from) <= dn(t.date) && dn(x.to) >= dn(t.date); }); }).map(function(r){ return esc(r.label); });
  if (other.length) b += kv('Auch auf dem Bogen', other.join(', '));
  if (S.edit) actions += '<button type="button" class="btn" data-edit-tag="' + esc(t._id) + '">Ändern</button>';
  infoSheet('Bogen ' + esc(t.wk) + ' · ' + esc(t.day), 'Bogentag', b, opener, actions);
}
function openBlk(key, opener){
  var p = key.split('|'), g = rowById(p[0]); if (!g) return;
  var blk = (g.bars || []).filter(function(b){ return b.kind === 'app' || b.kind === 'planapp'; })[+p[1]]; if (!blk) return;
  var today = dn(todayIso()), run = blk.kind === 'app' && dn(blk.from) <= today;
  var b = kv('Paket', esc(g.label)) + kv('Abschnitt', esc(blk.lab || 'App')) + kv('Zeitraum', esc(de(blk.from)) + ' – ' + esc(de(blk.to))) +
    kv('Status', '<span class="chip ' + (run ? 'src-bogen' : 'src-app') + '">' + (blk.kind === 'planapp' ? 'geplant' : (run ? 'läuft' : 'beginnt bald')) + '</span>');
  var kids = sortedRows().filter(function(r){ return r.parent === g._id; });
  if (kids.length) b += '<div class="flabel" style="margin-top:4px">Themen und App-Quote (1. Versuch)</div><div style="display:flex;flex-direction:column;gap:6px">' + kids.map(function(r){ return '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;border-bottom:1px solid var(--line-soft);padding-bottom:5px"><span>' + esc(r.label) + '</span><span style="display:flex;gap:8px;align-items:center">' + qChip(r) + (r.beispiel ? '<button type="button" class="bsp-btn" data-bsp-from="' + esc(r._id) + '" aria-label="Beispielaufgabe: ' + esc(r.label) + '"><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" fill="none" stroke="var(--teal)" stroke-width="2"></rect><path d="M8.5 8h7M8.5 12h7M8.5 16h4" stroke="var(--teal)" stroke-width="2" stroke-linecap="round"></path></svg></button>' : '') + '</span></div>'; }).join('') + '</div>';
  var rel = S.ins.filter(function(e){ return (e.rows || []).some(function(id){ return id === g._id || kids.some(function(k){ return k._id === id; }); }); }).sort(function(a,b){ return b.n - a.n; }).slice(0, 3);
  if (rel.length) b += '<div class="flabel" style="margin-top:4px">Letzte Erkenntnisse</div>' + rel.map(insMini).join('');
  infoSheet(esc(g.lane || g.label), 'App', b, opener, S.edit ? '<button type="button" class="btn" data-edit-row="' + esc(g._id) + '">Ändern</button>' : '');
}
function openInsInfo(id, opener){
  var e = S.ins.filter(function(x){ return x._id === id; })[0]; if (!e) return;
  var names = (e.rows || []).map(function(r){ var rr = rowById(r); return rr ? esc(rr.label) : ''; }).filter(Boolean).join(', ');
  var b = kv('Woher', '<span class="chip ' + srcClass(e.src) + '">' + esc(e.src) + '</span> ' + esc(de(e.date))) + kv('Gesehen', esc(e.obs)) + kv('Geändert', esc(e.eff)) + kv('Wirkt ab', esc(e.when)) + (names ? kv('Betrifft', names) : '');
  infoSheet('Erkenntnis ' + esc(e.n), 'Rückmeldung', b, opener, '<button type="button" class="btn" data-info-ins="' + esc(e._id) + '">In der Zeitleiste zeigen</button>');
}
function openTest(opener){
  var m = S.meta.test; if (!m) return;
  var days = dn(m.datum) - dn(todayIso());
  var b = kv('Datum', esc(de(m.datum)) + (m.offen ? ' <span class="chip src-app">noch nicht sicher</span>' : '')) + kv('Noch', days > 0 ? days + ' Tage' : (days === 0 ? 'heute' : 'vorbei')) +
    (m.inhalt ? kv('Inhalt', esc(m.inhalt)) : '') + (m.hilfsmittel ? kv('Hilfsmittel', esc(m.hilfsmittel)) : '');
  infoSheet(esc(m.name || 'Schultest'), 'Termin', b, opener, S.edit ? '<button type="button" class="btn" data-edit-meta="1">Datum ändern</button>' : '');
}

/* ---------- Ereignisse ---------- */
$('v-zeit').onclick = function(){ S.view = 'zeit'; render(); };
$('v-bahnen').onclick = function(){ S.view = 'bahnen'; render(); };
$('edit').onclick = function(){ S.edit = !S.edit; render(); };
$('add-row').onclick = function(){ editRow(null); };
$('add-ins').onclick = function(){ editIns(null); };
$('add-tag').onclick = function(){ editTag(null); };
$('edit-meta').onclick = editMeta;
$('view').addEventListener('click', function(e){
  var t = e.target.closest('button'); if (!t) return;
  if (t.id === 'lp-prev') { S.shift--; render(); return; }
  if (t.id === 'lp-next') { S.shift++; render(); return; }
  if (t.dataset.bsp) { openBeispiel(t.dataset.bsp, t); return; }
  if (t.dataset.toggle) { S.open[t.dataset.toggle] = !isOpen(t.dataset.toggle); saveOpen(); render(); return; }
  if (t.dataset.editins) { editIns(t.dataset.editins); return; }
  if (t.dataset.unsel) { S.sel = null; render(); return; }
  if (t.dataset.ins) { if (S.view === 'zeit' && S.sel === t.dataset.ins) { S.sel = null; render(); return; } S.sel = t.dataset.ins; if (S.view === 'bahnen') S.view = 'zeit'; render(); return; }
  if (t.dataset.row && S.edit) { editRow(t.dataset.row); return; }
  if (t.dataset.tag) { openTag(t.dataset.tag, t); return; }
  if (t.dataset.frei) { openFrei(t.dataset.frei, t); return; }
  if (t.dataset.blk) { openBlk(t.dataset.blk, t); return; }
  if (t.dataset.feed) { openInsInfo(t.dataset.feed, t); return; }
  if (t.dataset.test) { openTest(t); return; }
});
document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && root.isConnected && $('dlg').innerHTML) closeDlg(); });
if (opt.info) { $('info').innerHTML = opt.info; $('info').hidden = false; }
render();

/* ---------- Daten ---------- */
function verbinden(cl){
if (cl && cl.use) {
  cl.use('user').then(function(u){ if (u && u.canEdit) { Promise.resolve(u.canEdit()).then(function(v){ S.canEdit = !!v; render(); }); } });
  cl.use('db').then(function(db){
    if (!db) { $('view').innerHTML = '<div class="card empty">Die gespeicherten Daten sind in dieser Ansicht nicht erreichbar. Öffne den Lernplan in claude.ai.</div>'; return; }
    S.db = db; S.bereit = true; render();
    function list(col, key, after){
      db.collection(col).onSnapshot(function(snap){
        S[key] = snap.docs.map(function(d){ return Object.assign({ _id: d.id }, d.data()); });
        if (after) after(); render();
      }, function(){ toast('Verbindung zu den Daten unterbrochen. Seite neu laden.'); });
    }
    db.doc('plan/meta').onSnapshot(function(d){ S.meta = d.exists ? d.data() : null; render(); }, function(){});
    list('rows', 'rows');
    list('insights', 'ins', function(){ if (S.sel && !S.ins.some(function(e){ return e._id === S.sel; })) S.sel = null; });
    list('bogentage', 'tage');
  });
}
}
if (opt.claude) verbinden(opt.claude);
if (opt.daten) setzen(ausExport(opt.daten));
// Daten von außen setzen (Eltern-App): { meta, rows, ins, tage }
function setzen(d){
  ['meta', 'rows', 'ins', 'tage'].forEach(function(k){ if (d && d[k] !== undefined) S[k] = d[k]; });
  if (S.sel && !S.ins.some(function(e){ return e._id === S.sel; })) S.sel = null;
  S.bereit = true; render();
}
return { setzen: setzen, render: render, zustand: S };
}
return { VERSION: VERSION, erstellen: erstellen, ausExport: ausExport };
})();

export { Lernplan };
export default Lernplan;
