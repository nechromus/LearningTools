/* Gebaut aus lernplan/lernplan.js (Version 1.9.0). Nicht hier ändern. */
/* Lernplan-Darstellung: gemeinsame Quelle für die Lernplan-Seite in claude.ai und die Eltern-App.
   Quelle: LearningToolsCode/lernplan/lernplan.js (+ lernplan.css). Daraus baut `npm run lernplan`
   die Vorlage (wissensbasis/15-lernplan-seite-vorlage.html, alles eingebettet) und app/eltern/lernplan.mjs.
   Nur hier ändern. Datenformat und Regeln: wissensbasis/15-lernplan-seite.md. */
var Lernplan = (function(){
var VERSION = '1.9.0';
function esc0(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
// Export (Format lernplan-1, daten/<name>/lernplan.json) in die Form der Seite: Sammlungen als Listen mit _id
// Nummern einer Erkenntnis-Gruppe als Text (auch für Tests): lückenlos „3–7“, bis 4 Einträge „3, 5, 7“, sonst „3–5, 8, 11–14“
function nummernTextAussen(ns){ return nummernText0(ns); }
function nummernText0(ns){
  ns = ns.slice().sort(function(a, b){ return a - b; });
  if (ns.length === 1) return String(ns[0]);
  var luecken = ns.some(function(v, i){ return i && v !== ns[i - 1] + 1; });
  if (!luecken) return ns[0] + '–' + ns[ns.length - 1];
  if (ns.length <= 4) return ns.join(', ');
  var teile = [], a = ns[0], b = ns[0];
  for (var i = 1; i <= ns.length; i++) {
    if (i < ns.length && ns[i] === b + 1) { b = ns[i]; continue; }
    teile.push(a === b ? String(a) : a + '–' + b);
    if (i < ns.length) { a = b = ns[i]; }
  }
  return teile.join(', ');
}
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
  '        <button type="button" id="lp-v-menge" aria-pressed="false" hidden>Übungsmenge</button>\n' +
  '        <button type="button" id="lp-v-trend" aria-pressed="false" hidden>Trend</button>\n' +
  '      </div>\n' +
  '      <div class="seg farbe" role="group" aria-label="Farbe der Balken" id="lp-farbe" hidden><span class="seg-lab">Farbe</span><button type="button" data-farbe="art" aria-pressed="true">Art</button><button type="button" data-farbe="stand" aria-pressed="false">Stand</button></div>\n' +
  '      <button type="button" class="btn warnz" id="lp-warnz" hidden></button>\n' +
  '      <button type="button" class="btn" id="lp-edit" aria-pressed="false" hidden>Bearbeiten</button>\n' +
  '    </div>\n' +
  '  </header>\n' +
  '\n' +
  '  <div class="legend" id="lp-legende" aria-label="Legende">\n' +
  '    <span id="lp-lg-bogen"><i class="sw b"></i>Bogen</span>\n' +
  '    <span><i class="sw a"></i>App</span>\n' +
  '    <span id="lp-lg-plan"><i class="sw p"></i>geplant</span>\n' +
  '    <span id="lp-lg-planapp" hidden><i class="sw pa"></i>App geplant</span>\n' +
  '    <span><i class="sw z"></i>Pause</span>\n' +
  '    <span><i class="dot">1</i>Erkenntnis</span>\n' +
  '    <span id="lp-stand"></span>\n' +
  '  </div>\n' +
  '  <div class="legend lg-stand" id="lp-lg-stand" aria-label="Legende Kenntnisstand" hidden></div>\n' +
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
  '<div id="lp-voll" class="voll" hidden></div>\n' +
  '<div id="lp-toast" class="toast" role="status" hidden></div>');
var S = { meta:null, rows:[], ins:[], tage:[], view:'zeit', open:{}, sel:null, edit:false, canEdit:false, db:null, loaded:{meta:false,rows:false,ins:false,tage:false}, grp:null, z:null };
try { S.open = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch(e) {}
if (opt.hash && location.hash === '#bahnen') S.view = 'bahnen';
if (opt.hash && location.hash === '#trend') S.view = 'trend';
// Trend (ab 1.9.0): eigene Ansicht mit Auswahl je Gerät
var TR = null;
function trendM(){ if (!S.meta || !S.meta.trend) return null; if (S._tm && S._tm.rows === S.rows && S._tm.meta === S.meta) return S._tm.m; var m = Trend.modell(S.meta, S.rows); S._tm = { rows: S.rows, meta: S.meta, m: m }; return m; }

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

/* ---------- Zoom (ab 1.3.0) ---------- */
// Stufen: so viele Tage passen in die Breite. „Alles“ = ganzer Zeitraum. +/− ändern um Faktor 1,5.
var STUFEN = [['2w', 14, '2 Wochen'], ['6w', 42, '6 Wochen'], ['3m', 91, '3 Monate'], ['alles', 0, 'Alles']];
var ZKEY = KEY + '-zoom';
function gesamtTage(){ return dn(S.meta.end) - dn(S.meta.start) + 1; }
function labwPx(){ var v = parseFloat(getComputedStyle(root).getPropertyValue('--labw')); return isNaN(v) ? 260 : v; }
// sichtbare Breite der Zeitachse (ohne Namensspalte)
function achsenBreite(lw){ var v = $('view'), w = v ? v.clientWidth : 0; if (!w) w = (root.clientWidth || 1000) - 32; return Math.max(120, w - (lw == null ? labwPx() : lw) - 4); }
// Startansicht: 6 Wochen (schmaler Bildschirm: 2 Wochen), gemerkte Stufe pro Betrachter
if (!S.z) { var gem = null; try { gem = JSON.parse(localStorage.getItem(ZKEY) || 'null'); } catch(e) {} S.z = { tage: gem && gem.tage > 0 ? gem.tage : null, stufe: gem && gem.stufe || null, tag: null }; }
function zTage(){
  var g = gesamtTage();
  if (!S.z.stufe && !S.z.tage) S.z.stufe = (root.clientWidth || window.innerWidth || 1000) < 721 ? '2w' : '6w';
  var st = STUFEN.filter(function(s){ return s[0] === S.z.stufe; })[0];
  var t = st ? (st[1] || g) : S.z.tage;
  return Math.max(7, Math.min(g, t || 42));
}
function zPx(lw){ return S.z.px || Math.round(achsenBreite(lw) / zTage() * 1000) / 1000; } // S.z.px nur für den Bildvergleich mit der alten Fassung
function zMerken(){ try { localStorage.setItem(ZKEY, JSON.stringify({ stufe: S.z.stufe, tage: S.z.stufe ? null : S.z.tage })); } catch(e) {} }
function zStart(von, sichtbar){
  // linker Rand: gemerkter Tag, sonst „heute“ bei einem Drittel der Breite
  if (S.z.tag == null) S.z.tag = dn(todayIso()) - sichtbar / 3;
  return S.z.tag;
}
function zoomLeiste(){
  var g = gesamtTage(), t = zTage();
  return '<div class="zoom" role="group" aria-label="Zeitachse zoomen"><div class="seg">' + STUFEN.map(function(s){
    var an = S.z.stufe === s[0] || (!S.z.stufe && Math.round(t) === (s[1] || g));
    return '<button type="button" data-zoom="' + s[0] + '" aria-pressed="' + an + '">' + s[2] + '</button>';
  }).join('') + '</div><div class="seg zpm"><button type="button" data-zoomrel="-1" aria-label="Weiter weg" title="Weiter weg"' + (t >= g ? ' disabled' : '') + '>−</button><button type="button" data-zoomrel="1" aria-label="Näher heran" title="Näher heran"' + (t <= 7 ? ' disabled' : '') + '>+</button></div>' +
    '<button type="button" class="btn" data-heute="1">Heute</button></div>';
}
// Zoom um einen Tag (Anker bleibt an derselben Stelle im Fenster)
function zoomen(neuTage, ankerTag, ankerAnteil){
  var g = gesamtTage(), alt = zTage();
  neuTage = Math.max(7, Math.min(g, neuTage));
  if (ankerTag == null) { ankerAnteil = 0.5; ankerTag = (S.z.tag == null ? dn(todayIso()) - alt / 3 : S.z.tag) + alt / 2; }
  var st = STUFEN.filter(function(s){ return Math.abs((s[1] || g) - neuTage) < 0.5; })[0];
  S.z.stufe = st ? st[0] : null; S.z.tage = neuTage;
  S.z.tag = ankerTag - ankerAnteil * neuTage;
  zMerken(); render();
}
function scrollerSetzen(){
  var sc = $('view').querySelector('.scroller[data-px]'); if (!sc) return;
  var links = $('view').querySelector('.bahn-links');
  if (links) Array.prototype.forEach.call(sc.querySelectorAll('.lane-lab'), function(el){ links.appendChild(el); });
  var px = +sc.dataset.px, von = +sc.dataset.von;
  var max = sc.scrollWidth - sc.clientWidth;
  sc.scrollLeft = Math.max(0, Math.min(max, (S.z.tag - von) * px));
  sc.onscroll = function(){ S.z.tag = von + sc.scrollLeft / px; };
}

// Achse: Tage (nah), Wochen (mittel) oder Monate (weit). Gibt HTML für die Kopfzeile zurück.
var MONATE = ['Jan', 'Feb', 'März', 'Apr', 'Mai', 'Juni', 'Juli', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
function wochenName(n){ var w = (S.meta.wochen || []).filter(function(w){ var s = dn(w.start); return s >= n && s < n + 7; })[0]; return w ? w.name : ''; }
function achse(von, bis, px, x){
  var h = '', n, d;
  if (px >= 14) {
    // Wochennamen oben (wie bisher), darunter jeder Tag
    (S.meta.wochen || []).forEach(function(w){ var s = dn(w.start); if (s < von || s > bis) return; h += '<div class="wk" style="left:' + x(s, 5) + '"><b>' + esc(w.name) + '</b> <span>' + de(w.start) + '</span></div>'; });
    // Tageszahlen: ab 18 px jeder Tag, sonst nur Mo, Mi und Fr
    for (n = von; n <= bis; n++) { d = new Date(n * 864e5); if (px < 18 && d.getUTCDay() % 2 === 0) continue; h += '<div class="tg' + (d.getUTCDay() === 0 || d.getUTCDay() === 6 ? ' we' : '') + '" style="left:' + x(n, 0) + ';width:' + px + 'px">' + d.getUTCDate() + '</div>'; }
  } else if (px >= 5) {
    // jede Woche (Montag): Name aus meta.wochen, sonst Datum
    for (n = von; n <= bis; n++) { d = new Date(n * 864e5); if (d.getUTCDay() !== 1) continue; var nm = wochenName(n); h += '<div class="wk" style="left:' + x(n, 3) + '">' + (nm ? '<b>' + esc(nm) + '</b> ' : '') + '<span>' + d.getUTCDate() + '.' + (d.getUTCMonth() + 1) + '.</span></div>'; }
  } else {
    for (n = von; n <= bis; n++) { d = new Date(n * 864e5); if (d.getUTCDate() !== 1 && n !== von) continue; if (n === von && d.getUTCDate() > 20) continue; h += '<div class="wk" style="left:' + x(n, 3) + '"><b>' + MONATE[d.getUTCMonth()] + '</b>' + (d.getUTCMonth() === 0 ? ' <span>' + d.getUTCFullYear() + '</span>' : '') + '</div>'; }
  }
  return h;
}
function achseLinien(von, bis, px, x){
  var h = '', n, d;
  if (px >= 5) (S.meta.wochen || []).forEach(function(w){ var s = dn(w.start); if (s >= von && s <= bis) h += '<div class="vline" style="left:' + x(s, 0) + '"></div>'; });
  else for (n = von; n <= bis; n++) { d = new Date(n * 864e5); if (d.getUTCDate() === 1) h += '<div class="vline" style="left:' + x(n, 0) + '"></div>'; }
  return h;
}

/* ---------- Erkenntnisse gruppieren (ab 1.3.0) ---------- */
// Nummern als kurzer Text: lückenlos „3–7“, bis 4 Einträge „3, 5, 7“, sonst „3–5, 8, 11–14“
var nummernText = nummernText0;
function markerBreite(text){ return Math.max(26, Math.round(String(text).length * 7.2 + 14)); }
// liste: [{ e, pos }] nach pos sortiert; Marker, die sich überdecken würden, werden eine Gruppe am frühesten Datum
function gruppieren(liste, abstand){
  var gruppen = [];
  liste.forEach(function(it){
    var g = gruppen[gruppen.length - 1];
    if (g && it.pos < g.pos + markerBreite(nummernText(g.ns)) + (abstand == null ? 4 : abstand) - 2) { g.items.push(it.e); g.ns.push(it.e.n); return; }
    gruppen.push({ pos: it.pos, items: [it.e], ns: [it.e.n] });
  });
  gruppen.forEach(function(g){ g.text = nummernText(g.ns); g.breite = markerBreite(g.text); g.ids = g.items.map(function(e){ return e._id; }); });
  return gruppen;
}
function insSortiert(){ return S.ins.slice().sort(function(a, b){ return (dn(a.date) - dn(b.date)) || (a.n - b.n); }); }
function gruppeAn(ids){ return S.grp && S.grp.length === ids.length && ids.every(function(id){ return S.grp.indexOf(id) >= 0; }); }

/* ---------- Kenntnisstand (ab 1.4.0): rows.niveau, rows.verlauf, insights.stand ---------- */
var NIVEAU = ['keine Kenntnisse', 'neu eingeführt', 'geht mit Hilfe', 'meist sicher', 'sicher in App und Bogen', 'sicher wie in der Abschlussarbeit'];
var TENDENZ = { auf: ['↗', 'steigt'], gleich: ['→', 'bleibt gleich'], ab: ['↘', 'fällt'], neu: ['neu', 'neu dabei'] };
var FKEY = KEY + '-farbe';
if (!S.farbe) { try { S.farbe = localStorage.getItem(FKEY) === 'stand' ? 'stand' : 'art'; } catch(e) { S.farbe = 'art'; } }
function hatNiveau(){ return S.rows.some(function(r){ return Array.isArray(r.niveau) && r.niveau.length; }); }
function standModus(){ return S.farbe === 'stand' && hatNiveau(); }
function niveauListe(r){ return (Array.isArray(r && r.niveau) ? r.niveau : []).filter(function(x){ return x && !isNaN(dn(x[0])) && x[1] >= 0 && x[1] <= 5; }).slice().sort(function(a, b){ return dn(a[0]) - dn(b[0]); }); }
// Stufe einer Zeile an einem Tag (null = keine Daten). Pakete: niedrigste Stufe der Themen darin (Antwort Vater), damit Schwächen sichtbar bleiben
function niveauAm(r, n){
  if (!r) return null;
  if (r.group) {
    var werte = S.rows.filter(function(c){ return c.parent === r._id; }).map(function(c){ return niveauAm(c, n); }).filter(function(v){ return v != null; });
    if (!werte.length) return null;
    return Math.min.apply(null, werte);
  }
  var l = niveauListe(r), v = null;
  for (var i = 0; i < l.length; i++) { if (dn(l[i][0]) <= n) v = l[i][1]; else break; }
  return v;
}
function niveauSeit(r, n){ var l = niveauListe(r), s = null; for (var i = 0; i < l.length; i++) if (dn(l[i][0]) <= n) s = l[i][0]; return s; }
function nivText(v){ return v == null ? 'keine Daten' : v + ' · ' + NIVEAU[v]; }
// Neueste Einschätzung eines Themas aus den Erkenntnissen (stand.themen), optional bis zu einer Erkenntnis
function insSortN(){ return S.ins.slice().sort(function(a, b){ return (dn(a.date) - dn(b.date)) || (a.n - b.n); }); }
function letzteEinschaetzung(rowId, bis){
  var l = insSortN(), out = null;
  for (var i = 0; i < l.length; i++) {
    var e = l[i];
    if (bis && (dn(e.date) > dn(bis.date) || (dn(e.date) === dn(bis.date) && e.n > bis.n))) break;
    var t = ((e.stand && e.stand.themen) || []).filter(function(x){ return x.row === rowId; })[0];
    if (t) out = { e: e, t: t };
  }
  return out;
}
function tendenzHtml(t, klein){
  if (!t || !TENDENZ[t]) return '';
  return '<span class="tend tend-' + esc(t) + (klein ? ' klein' : '') + '" title="Tendenz: ' + esc(TENDENZ[t][1]) + '">' + esc(TENDENZ[t][0]) + '</span>';
}
function kaestchen(v){
  var h = '<span class="nkast" role="img" aria-label="Stand ' + esc(nivText(v)) + '">';
  for (var i = 0; i <= 5; i++) h += '<i class="' + (v != null && i <= v ? 'n' + v : 'nk-leer') + '"></i>';
  return h + '</span>';
}
// Balken im Modus „Stand“: abschnittsweise nach der Stufe am Tag gefärbt; die Art bleibt an der Form erkennbar
function standBalken(r, b, f, t, start, PX, L, lab, fits, tipp){
  var segs = [], cur = null;
  for (var n = f; n <= t; n++) { var v = niveauAm(r, n); if (cur && cur.v === v) cur.bis = n; else { cur = { v: v, von: n, bis: n }; segs.push(cur); } }
  var l = (f - start) * PX, w = Math.max((t - f + 1) * PX, Math.min(14, PX));
  var h = '<div class="bar ' + esc(b.kind) + ' st"' + (tipp ? ' data-tipp="' + esc(lab + ' · ' + de(b.from) + '–' + de(b.to)) + '"' : '') + ' style="left:calc(' + L + ' + ' + l + 'px);width:' + w + 'px">';
  segs.forEach(function(s, i){
    var sl = (s.von - f) * PX, sw = (s.bis - s.von + 1) * PX;
    if (i === segs.length - 1) sw = w - sl;
    h += '<i class="seg-st ' + (s.v == null ? 'nx' : 'n' + s.v) + '" style="left:' + sl + 'px;width:' + sw + 'px" title="' + esc((b.lab ? b.lab + ' · ' : '') + 'Stand ' + nivText(s.v) + (s.v != null ? ' (ab ' + de(niveauSeit(r, s.von) || iso(s.von)) + ')' : '') + ' · ' + de(iso(s.von)) + '–' + de(iso(s.bis))) + '"></i>';
  });
  return h + (fits ? '<span class="st-lab">' + esc(lab) + '</span>' : '') + '</div>';
}
function standLegende(){
  return '<span class="lg-st-titel">Stand:</span>' + NIVEAU.map(function(t, i){ return '<span title="' + esc(t) + '"><i class="sw st n' + i + '"></i>' + i + ' ' + esc(t) + '</span>'; }).join('') +
    '<span><i class="sw st nx"></i>keine Daten</span><span class="hint">Bogen breit · App schmal · Pause gestreift · geplant gestrichelt</span>';
}

/* ---------- Vollbild einer Erkenntnis (ab 1.4.0) ---------- */
function hatVollbild(e){ return !!(e && (e.stand || (e.rows || []).some(function(id){ var r = rowById(id); return r && r.verlauf && r.verlauf.length; }))); }
function verlaufSumme(r, bis, letzte){
  var l = ((r && r.verlauf) || []).filter(function(x){ return !bis || dn(x[0]) <= dn(bis); }).sort(function(a, b){ return dn(a[0]) - dn(b[0]); });
  if (letzte) l = l.slice(-letzte);
  return l.reduce(function(s, x){ return { r: s.r + (+x[1] || 0), n: s.n + (+x[2] || 0), t: s.t + (+x[4] || 0) }; }, { r: 0, n: 0, t: 0 });
}
// App-Kurve (Anteil der Aufgaben im 1. Versuch je Tag): bis zum Datum kräftig, danach blass bis heute
function kurve(r, bis, breit){
  var l = ((r && r.verlauf) || []).filter(function(x){ return x && x[2] > 0; }).sort(function(a, b){ return dn(a[0]) - dn(b[0]); });
  if (!l.length) return '<span class="hint">keine App-Daten</span>';
  var W = breit || 170, H = 40, P = 4, von = Math.min(dn(l[0][0]), bis ? dn(bis) : Infinity) - 1, ende = Math.max(dn(todayIso()), dn(l[l.length - 1][0])) + 1;
  function xx(n){ return P + (n - von) / Math.max(1, ende - von) * (W - 2 * P); }
  function yy(q){ return H - P - q * (H - 2 * P); }
  var pts = l.map(function(x){ var tl = +x[4] || 0; return { x: xx(dn(x[0])), y: yy(x[1] / x[2]), yt: tl ? yy(Math.min(1, (x[1] + tl) / x[2])) : null, fruh: !bis || dn(x[0]) <= dn(bis), n: x[2], t: de(x[0]) + ': ' + x[1] + ' von ' + x[2] + ' im 1. Versuch' + (tl ? ', ' + tl + ' Teil-Lösung' : '') }; });
  var a = pts.filter(function(p){ return p.fruh; }), b2 = pts.filter(function(p, i){ return !p.fruh || (pts[i + 1] && !pts[i + 1].fruh && p.fruh); });
  function linie(ps){ return ps.length > 1 ? '<polyline points="' + ps.map(function(p){ return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ') + '"/>' : ''; }
  var h = '<svg class="kurve" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="App-Aufgaben im 1. Versuch je Tag">';
  h += '<line class="k-achse" x1="' + P + '" x2="' + (W - P) + '" y1="' + yy(0.8) + '" y2="' + yy(0.8) + '"/>';
  h += '<g class="k-spaet">' + linie(b2) + '</g><g class="k-frueh">' + linie(a) + '</g>';
  // Teil-Lösungen (5. Wert, ab 1.8.0): Strich vom Punkt nach oben in eigener Farbe
  pts.forEach(function(p){ if (p.yt != null) h += '<line class="k-teil' + (p.fruh ? '' : ' k-blass') + '" x1="' + p.x.toFixed(1) + '" x2="' + p.x.toFixed(1) + '" y1="' + p.y.toFixed(1) + '" y2="' + p.yt.toFixed(1) + '"><title>' + esc(p.t) + '</title></line>'; });
  pts.forEach(function(p){ h += '<circle class="' + (p.fruh ? 'k-frueh' : 'k-spaet') + '" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + (p.n >= 5 ? 3 : 2.2) + '"><title>' + esc(p.t) + '</title></circle>'; });
  if (bis) h += '<line class="k-tag" x1="' + xx(dn(bis)) + '" x2="' + xx(dn(bis)) + '" y1="1" y2="' + (H - 1) + '"/>';
  return h + '</svg>';
}
function rowName(id){ var r = rowById(id); return r ? r.label : id; }
function vollThemen(e){
  var t = (e.stand && e.stand.themen) || [];
  if (t.length) return t;
  return (e.rows || []).filter(function(id){ var r = rowById(id); return r && r.verlauf && r.verlauf.length; }).map(function(id){ return { row: id }; });
}
function themaZeile(t, e){
  var r = rowById(t.row), sum = verlaufSumme(r, e.date), drei = verlaufSumme(r, e.date, 3), heute = letzteEinschaetzung(t.row);
  var heuteHtml = heute && heute.e !== e ? '<span class="heute">' + (heute.t.niveau != null ? '<i class="sw st n' + heute.t.niveau + '"></i>' + heute.t.niveau : '–') + ' ' + tendenzHtml(heute.t.tendenz, true) + '<small>Erkenntnis ' + esc(heute.e.n) + '</small></span>' : '<span class="hint">aktuell</span>';
  return '<tr><th scope="row"><button type="button" class="vthema" data-vthema="' + esc(t.row) + '" title="Nur Erkenntnisse zu diesem Thema">' + esc(rowName(t.row)) + '</button></th>' +
    '<td data-k="Stand">' + kaestchen(t.niveau) + '<span class="nwort">' + esc(t.niveau == null ? 'keine Daten' : NIVEAU[t.niveau]) + '</span></td>' +
    '<td data-k="Tendenz">' + (tendenzHtml(t.tendenz) || '<span class="hint">–</span>') + '</td>' +
    '<td data-k="App">' + kurve(r, e.date) + (sum.n ? '<div class="ksum">bis hier ' + sum.r + '/' + sum.n + (sum.t ? ' <span class="kteil">+' + sum.t + ' Teil-Lösung</span>' : '') + ' · letzte 3 Tage ' + drei.r + '/' + drei.n + (drei.t ? ' <span class="kteil">+' + drei.t + '</span>' : '') + '</div>' : '') + '</td>' +
    '<td data-k="Heute">' + heuteHtml + '</td>' +
    '<td data-k="Notiz">' + esc(t.notiz || '') + '</td></tr>';
}
function vollListe(){ var l = insSortN(); if (S.voll && S.voll.thema) l = l.filter(function(e){ return ((e.stand && e.stand.themen) || []).some(function(t){ return t.row === S.voll.thema; }) || (e.rows || []).indexOf(S.voll.thema) >= 0; }); return l; }
function renderVoll(){
  var box = $('voll'); if (!box) return;
  if (!S.voll) { box.innerHTML = ''; box.hidden = true; document.documentElement.classList.remove('lp-voll-offen'); return; }
  box.hidden = false; document.documentElement.classList.add('lp-voll-offen');
  var kopfKnoepfe = '<button type="button" class="btn' + (S.voll.tend ? ' an' : '') + '" data-vtend="1" aria-pressed="' + !!S.voll.tend + '">Tendenzen</button><button type="button" class="x" data-vzu="1" aria-label="Vollbild schließen"><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="var(--fg)" stroke-width="2.4" stroke-linecap="round"></path></svg></button>';
  var h;
  if (S.voll.tend) {
    // Übersicht: alle Themen mit ihrer letzten Einschätzung, ↘ zuerst
    var ids = []; insSortN().forEach(function(e){ ((e.stand && e.stand.themen) || []).forEach(function(t){ if (ids.indexOf(t.row) < 0) ids.push(t.row); }); });
    var ord = { ab: 0, gleich: 1, neu: 2, auf: 3 };
    var zeilen = ids.map(function(id){ return letzteEinschaetzung(id); }).filter(Boolean).sort(function(a, b){ return ((ord[a.t.tendenz] ?? 4) - (ord[b.t.tendenz] ?? 4)) || ((a.t.niveau ?? -1) - (b.t.niveau ?? -1)); });
    h = '<header class="vkopf"><div class="vtitel"><div class="src">Übersicht</div><h2>Tendenzen</h2><p class="hint">Jedes Thema mit seiner letzten Einschätzung. Fallende Tendenz zuerst. Die App-Kurve zeigt die Aufgaben im 1. Versuch je Tag bis heute, Teil-Lösungen als oranger Strich nach oben.</p></div><div class="vknoepfe">' + kopfKnoepfe + '</div></header>' +
      '<table class="vtab"><thead><tr><th>Thema</th><th>Stand</th><th>Tendenz</th><th>App-Aufgaben im 1. Versuch</th><th>Seit</th><th>Notiz</th></tr></thead><tbody>' +
      zeilen.map(function(z){ var r = rowById(z.t.row), sum = verlaufSumme(r); return '<tr><th scope="row"><button type="button" class="vthema" data-vthema="' + esc(z.t.row) + '">' + esc(rowName(z.t.row)) + '</button></th><td data-k="Stand">' + kaestchen(z.t.niveau) + '<span class="nwort">' + esc(z.t.niveau == null ? 'keine Daten' : NIVEAU[z.t.niveau]) + '</span></td><td data-k="Tendenz">' + (tendenzHtml(z.t.tendenz) || '–') + '</td><td data-k="App">' + kurve(r, null) + (sum.n ? '<div class="ksum">gesamt ' + sum.r + '/' + sum.n + (sum.t ? ' <span class="kteil">+' + sum.t + ' Teil-Lösung</span>' : '') + '</div>' : '') + '</td><td data-k="Seit"><button type="button" class="vlink" data-vgehe="' + esc(z.e._id) + '">Erkenntnis ' + esc(z.e.n) + ', ' + esc(de(z.e.date)) + '</button></td><td data-k="Notiz">' + esc(z.t.notiz || '') + '</td></tr>'; }).join('') +
      '</tbody></table>';
  } else {
    var e = S.ins.filter(function(x){ return x._id === S.voll.id; })[0];
    if (!e) { S.voll = null; return renderVoll(); }
    var liste = vollListe(), i = liste.indexOf(e);
    var nav = '<div class="vnav"><button type="button" class="btn" data-vnav="-1"' + (i <= 0 ? ' disabled' : '') + ' aria-label="Vorige Erkenntnis">‹</button><button type="button" class="btn" data-vnav="1"' + (i < 0 || i >= liste.length - 1 ? ' disabled' : '') + ' aria-label="Nächste Erkenntnis">›</button></div>';
    var filter = S.voll.thema ? '<div class="vfilter"><span>Nur Thema: <b>' + esc(rowName(S.voll.thema)) + '</b></span><span class="hint">' + (i + 1) + ' von ' + liste.length + '</span><button type="button" class="btn ghost" data-vthema="">alle Erkenntnisse</button></div>' : '';
    var st = e.stand || {};
    h = '<header class="vkopf">' + nav + '<div class="num">' + esc(e.n) + '</div><div class="vtitel"><div class="src"><span class="chip ' + srcClass(e.src) + '">' + esc(e.src) + '</span> ' + esc(de(e.date)) + '</div><h2>' + esc(e.kurz || ('Erkenntnis ' + e.n)) + '</h2></div><div class="vknoepfe">' + kopfKnoepfe + '</div></header>' + filter +
      '<div class="three"><div><div class="k">Gesehen</div>' + esc(e.obs) + '</div><div><div class="k ch">Geändert</div>' + esc(e.eff) + '</div><div><div class="k wa">Wirkt ab</div>' + esc(e.when) + '</div></div>' +
      (st.text ? '<section><h3>Entwicklung bis hier</h3><p>' + esc(st.text) + '</p></section>' : '') +
      '<section><h3>Stand an diesem Tag</h3>' + (vollThemen(e).length ? '<table class="vtab"><thead><tr><th>Thema</th><th>Stand</th><th>Tendenz</th><th>App-Aufgaben im 1. Versuch</th><th>Heute</th><th>Notiz</th></tr></thead><tbody>' + vollThemen(e).map(function(t){ return themaZeile(t, e); }).join('') + '</tbody></table><p class="hint">App-Kurve: Anteil der Aufgaben im 1. Versuch je Tag, bis zu diesem Tag kräftig, danach blass bis heute. Die Linie zeigt 80 %. Ein oranger Strich nach oben zeigt Teil-Lösungen (Lösung bei einem Zwischenschritt, Rest selbst gerechnet). Ein Tipp auf ein Thema zeigt nur Erkenntnisse zu diesem Thema.</p>' : '<p class="hint">Zu dieser Erkenntnis gibt es noch keine Einschätzung je Thema.</p>') + '</section>' +
      (st.naechstes ? '<section><h3>Als Nächstes</h3><p>' + esc(st.naechstes) + '</p></section>' : '');
  }
  box.innerHTML = '<div class="voll-box" role="dialog" aria-modal="true" aria-label="Erkenntnis im Vollbild">' + h + '</div>';
  box.scrollTop = 0;
  var x = box.querySelector('[data-vzu]'); if (x && !box.contains(document.activeElement)) x.focus();
}
function vollAuf(id){ S.voll = { id: id, thema: null, tend: false }; renderVoll(); }
function vollZu(){ var id = S.voll && S.voll.id; S.voll = null; renderVoll(); if (id) { S.sel = id; render(); } }

/* ---------- Zeitleiste ---------- */
function renderZeit(){
  var m = S.meta, start = dn(m.start), end = dn(m.end), days = end - start + 1, L = 'var(--labw)';
  var PX = zPx(), sichtbar = zTage();
  zStart(start, sichtbar);
  function xs(s){ return (dn(s) - start) * PX; }
  function xn(n, plus){ return 'calc(' + L + ' + ' + ((n - start) * PX + (plus || 0)) + 'px)'; }
  var W = days * PX, tagModus = PX >= 14;
  var h = zoomLeiste();
  h += '<div class="card scroller" data-px="' + PX + '" data-von="' + start + '"><div class="tl" style="min-width:calc(' + L + ' + ' + W + 'px)">';
  // Kopf
  h += '<div class="hdr' + (tagModus ? ' tage' : '') + '"><div class="stickyl" style="background:var(--surface-2);color:var(--muted)">Paket / Thema</div>' + achse(start, end, PX, xn) + '</div>';
  // Erkenntnisse: jeder Marker genau an seinem Datum, überdeckende Marker als Gruppe
  h += '<div class="mrow"><div class="stickyl" style="background:var(--amber-soft);color:var(--amber-ink)">Erkenntnisse</div>';
  gruppieren(insSortiert().map(function(e){ return { e: e, pos: xs(e.date) + PX / 2 - 13 }; })).forEach(function(g){
    var an = g.items.length > 1 ? gruppeAn(g.ids) : (S.sel === g.ids[0] && !(S.grp && S.grp.length > 1));
    var e0 = g.items[0];
    h += '<button type="button" class="mark' + (g.items.length > 1 ? ' grp' : '') + '" data-' + (g.items.length > 1 ? 'grp="' + esc(g.ids.join(',')) : 'ins="' + esc(e0._id)) + '" aria-pressed="' + an + '" aria-label="' + (g.items.length > 1 ? 'Erkenntnisse ' + esc(g.text) + ' ab ' + esc(de(e0.date)) : 'Erkenntnis ' + esc(e0.n) + ' vom ' + esc(de(e0.date))) + '" style="left:calc(' + L + ' + ' + g.pos + 'px)' + (g.items.length > 1 ? ';width:' + g.breite + 'px' : '') + '">' + esc(g.text) + '</button>';
  });
  h += '</div>';
  // Zeilen
  var body = '';
  var selIns = S.ins.filter(function(e){ return e._id === S.sel; })[0];
  var rows = sortedRows(), stand = standModus(), r7 = rotLetzte7();
  rows.forEach(function(r){
    if (r.parent && !isOpen(r.parent)) return;
    var kids = rows.filter(function(c){ return c.parent === r._id; });
    var hl = selIns && ((selIns.rows||[]).indexOf(r._id) >= 0 || (r.group && !isOpen(r._id) && kids.some(function(c){ return (selIns.rows||[]).indexOf(c._id) >= 0; })));
    body += '<div class="trow' + (r.group ? ' group' : '') + (hl ? ' hl' : '') + '"><div class="lab">';
    if (r.group) body += '<button type="button" class="name" data-toggle="' + esc(r._id) + '" aria-expanded="' + isOpen(r._id) + '"><svg class="chev" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style="transform:rotate(' + (isOpen(r._id) ? 90 : 0) + 'deg)"><path d="M9 6l6 6-6 6" fill="none" stroke="var(--teal)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></path></svg><span>' + esc(r.label) + '</span></button>';
    else body += '<button type="button" class="name" data-row="' + esc(r._id) + '"' + (S.edit ? '' : ' tabindex="-1"') + '><span>' + esc(r.label) + '</span></button>';
    if (r.beispiel) body += '<button type="button" class="bsp-btn" data-bsp="' + esc(r._id) + '" aria-label="Beispielaufgabe: ' + esc(r.label) + '" title="Beispielaufgabe ansehen"><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" fill="none" stroke="var(--teal)" stroke-width="2"></rect><path d="M8.5 8h7M8.5 12h7M8.5 16h4" stroke="var(--teal)" stroke-width="2" stroke-linecap="round"></path></svg></button>';
    if (r.group && S.edit) body += '<button type="button" class="btn ghost" style="min-height:28px;padding:2px 8px;font-size:12px" data-row="' + esc(r._id) + '">Ändern</button>';
    if (r7[r._id]) body += '<span class="wpunkt" title="Rote Abweichung in den letzten 7 Tagen: ' + esc(r7[r._id].b.wort) + ' (siehe Übungsmenge)" aria-label="Warnung: ' + esc(r7[r._id].b.wort) + '"></span>';
    if (r.etappe && !r.etappe.ab) body += '<span class="lock" title="' + esc(r.etappe.bedingung || 'noch nicht freigeschaltet') + '">gesperrt</span>';
    if (r.quote && r.quote.n) body += '<span class="q ' + qClass(r.quote) + '" title="' + esc(qTitle(r.quote)) + '">' + esc(r.quote.r) + '/' + esc(r.quote.n) + (r.quote.kn != null ? ' · K' + esc(r.quote.kn) : '') + '</span>';
    body += '</div>';
    var ende = -1;
    (r.bars||[]).forEach(function(b){
      var f = Math.max(dn(b.from), start), t = Math.min(dn(b.to), end);
      if (isNaN(f) || isNaN(t) || t < f) return;
      var l = (f - start) * PX, w = Math.max((t - f + 1) * PX, Math.min(14, PX));
      var thin = b.kind === 'app' || b.kind === 'planapp';
      var lab = thin ? '' : (b.lab || '');
      var fits = lab && (lab.length * 6.6 + 10) <= w;
      var tipp = lab && !fits && w < 10; // sehr schmal: Text nur beim Antippen oder Überfahren
      ende = Math.max(ende, l + w + (lab && !fits && !tipp ? lab.length * 6.6 + 14 : 0));
      if (stand) { body += standBalken(r, b, f, t, start, PX, L, lab, fits, tipp); if (lab && !fits && !tipp) body += '<div class="blab" style="left:calc(' + L + ' + ' + (l + w + 4) + 'px)">' + esc(lab) + '</div>'; return; }
      body += '<div class="bar ' + esc(b.kind) + '"' + (tipp ? ' data-tipp="' + esc(lab + ' · ' + de(b.from) + '–' + de(b.to)) + '"' : '') + ' style="left:calc(' + L + ' + ' + l + 'px);width:' + w + 'px" title="' + esc(b.lab || '') + ' ' + de(b.from) + '–' + de(b.to) + '">' + (fits ? esc(lab) : '') + '</div>';
      if (lab && !fits && !tipp) body += '<div class="blab" style="left:calc(' + L + ' + ' + (l + w + 4) + 'px)">' + esc(lab) + '</div>';
    });
    if (stand && ende >= 0 && !r.group) { var le = letzteEinschaetzung(r._id); if (le && TENDENZ[le.t.tendenz]) body += '<div class="tend-end" style="left:calc(' + L + ' + ' + (ende + 4) + 'px)" title="Tendenz: ' + esc(TENDENZ[le.t.tendenz][1]) + ' (Erkenntnis ' + esc(le.e.n) + ')">' + tendenzHtml(le.t.tendenz, true) + '</div>'; }
    body += '</div>';
  });
  if (!rows.length) body = '<div class="empty">Noch keine Zeilen. Claude trägt die Pakete und Themen ein; im Bearbeiten-Modus kannst du selbst Zeilen anlegen.</div>';
  // Linien
  var lines = achseLinien(start, end, PX, xn);
  var t = todayIso();
  if (dn(t) >= start && dn(t) <= end) lines += '<div class="today" style="left:calc(' + L + ' + ' + (xs(t) + PX/2) + 'px)"></div><div class="flag" style="bottom:4px;color:var(--amber-ink);left:calc(' + L + ' + ' + (xs(t) + PX/2 + 4) + 'px)">heute</div>';
  if (m.test && m.test.datum) lines += '<div class="testl" style="left:calc(' + L + ' + ' + (xs(m.test.datum) + PX/2) + 'px)"></div><div class="flag" style="bottom:4px;color:var(--clay);left:calc(' + L + ' + ' + (xs(m.test.datum) + PX/2 + 4) + 'px)">' + esc(m.test.name || 'Schultest') + (m.test.offen ? ' (Datum offen)' : '') + '</div>';
  h += '<div style="position:relative">' + lines + body + '</div></div></div>';
  // Erkenntnis-Karte (unten fest über der Zeitleiste); bei einer Gruppe mit Nummern-Leiste und ‹ ›
  if (selIns) {
    var grp = S.grp && S.grp.length > 1 ? S.grp.map(function(id){ return S.ins.filter(function(e){ return e._id === id; })[0]; }).filter(Boolean) : null;
    var gi = grp ? grp.indexOf(selIns) : -1;
    var leiste = grp ? '<div class="gleiste" role="group" aria-label="Erkenntnisse der Gruppe"><button type="button" class="gpf" data-gschritt="-1" aria-label="Vorherige"' + (gi <= 0 ? ' disabled' : '') + '>‹</button>' + grp.map(function(e){ return '<button type="button" class="gnr" data-gwahl="' + esc(e._id) + '" aria-pressed="' + (e === selIns) + '">' + esc(e.n) + '</button>'; }).join('') + '<button type="button" class="gpf" data-gschritt="1" aria-label="Nächste"' + (gi >= grp.length - 1 ? ' disabled' : '') + '>›</button></div>' : '';
    h += '<section class="ins" aria-live="polite" aria-label="Erkenntnis ' + esc(selIns.n) + '"><div class="num">' + esc(selIns.n) + '</div><div style="min-width:0">' + leiste +
      '<div class="meta"><span class="chip ' + srcClass(selIns.src) + '">' + esc(selIns.src) + '</span><span>' + esc(de(selIns.date)) + '</span><span>· betrifft die hervorgehobenen Zeilen</span>' + (hatVollbild(selIns) ? '<button type="button" class="btn ghost vb-knopf" data-vollbild="' + esc(selIns._id) + '">Vollbild</button>' : '') + (S.edit ? '<button type="button" class="btn ghost" style="min-height:28px;padding:2px 10px;font-size:12px" data-editins="' + esc(selIns._id) + '">Ändern</button>' : '') + '</div>' +
      '<div class="three"><div><div class="k">Gesehen</div>' + esc(selIns.obs) + '</div><div><div class="k ch">Geändert</div>' + esc(selIns.eff) + '</div><div><div class="k wa">Wirkt ab</div>' + esc(selIns.when) + '</div></div></div>' +
      '<button type="button" class="x" data-unsel="1" aria-label="Erkenntnis abwählen" title="Abwählen"><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="var(--fg)" stroke-width="2.4" stroke-linecap="round"></path></svg></button></section>';
  } else if (S.ins.length) {
    h += '<p class="hint">Tippe oben auf eine Erkenntnis, um sie einzublenden. Ein zweiter Tipp blendet sie wieder aus. Die Themen, die sie verändert hat, leuchten dann auf.</p>';
  }
  return h;
}

/* ---------- Übungsmenge (ab 1.5.0): rows.bogen, rows.verlauf (4. Wert Minuten), meta.app_plan, meta.bogen_min, meta.abweichung, rows.ziel ---------- */
function liste0(r, feld){ return Array.isArray(r && r[feld]) ? r[feld] : []; }
function hatMenge(){
  if (!S.meta) return false;
  if (Array.isArray(S.meta.app_plan) && S.meta.app_plan.length) return true;
  return S.rows.some(function(r){ return liste0(r, 'bogen').length || liste0(r, 'verlauf').some(function(v){ return v && v.length > 3; }); });
}
// Tageswerte je Zeile (nur eigene Daten): b[n] = [Teilaufgaben, Minuten], a[n] = [Aufgaben, Minuten]
function mIndex(){
  if (S._mi && S._mi.rows === S.rows && S._mi.meta === S.meta) return S._mi.x;
  var x = {};
  S.rows.forEach(function(r){
    var o = { b: {}, a: {} };
    liste0(r, 'bogen').forEach(function(v){ var n = dn(v && v[0]); if (isNaN(n)) return; var c = o.b[n] || (o.b[n] = [0, 0]); c[0] += +v[1] || 0; c[1] += +v[2] || 0; });
    liste0(r, 'verlauf').forEach(function(v){ var n = dn(v && v[0]); if (isNaN(n)) return; var c = o.a[n] || (o.a[n] = [0, 0]); c[0] += +v[2] || 0; c[1] += +v[3] || 0; });
    x[r._id] = o;
  });
  S._mi = { rows: S.rows, meta: S.meta, x: x };
  return x;
}
function appPlaene(){ return (Array.isArray(S.meta && S.meta.app_plan) ? S.meta.app_plan : []).filter(function(p){ return p && !isNaN(dn(p.ab)) && p.anteile; }).slice().sort(function(a, b){ return dn(a.ab) - dn(b.ab); }); }
function planAm(n){ var l = appPlaene().filter(function(p){ return dn(p.ab) <= n; }); return l.length ? l[l.length - 1] : null; }
function inPlan(id){ return appPlaene().some(function(p){ return p.anteile[id] != null; }); }
function kinderVon(id){ return sortedRows().filter(function(c){ return c.parent === id; }); }
function hatEigen(r, art){ return art === 'b' ? liste0(r, 'bogen').length > 0 : liste0(r, 'verlauf').length > 0; }
// Summe einer Zeile an Tag n; Pakete (zugeklappt oder ohne eigene Daten) zählen ihre Themen mit.
// Hat ein Paket eigene Daten, zählen nur Kinder mit eigenem Plananteil dazu (z. B. Kugel bei Kegel und Pyramide), keine Etappen.
function mSumme(r, n, art){
  var o = (mIndex()[r._id] || {})[art] || {}, e = o[n] || [0, 0], s = [e[0], e[1]], eigen = hatEigen(r, art);
  kinderVon(r._id).forEach(function(c){ if (!eigen || inPlan(c._id)) { var k = mSumme(c, n, art); s[0] += k[0]; s[1] += k[1]; } });
  return s;
}
function mHatDaten(r){ return hatEigen(r, 'b') || hatEigen(r, 'a') || inPlan(r._id) || kinderVon(r._id).some(mHatDaten); }
function mDran(r, n){
  var eigen = (r.bars || []).some(function(b){ return b.kind !== 'pause' && dn(b.from) <= n && n <= dn(b.to); });
  return eigen || (r.group && !isOpen(r._id) && kinderVon(r._id).some(function(c){ return mDran(c, n); }));
}
function topVon(r){ var g = r, i = 0; while (g && g.parent && i++ < 9) { var p = rowById(g.parent); if (!p) break; g = p; } return g; }
function kurzName(r){ var t = String(r.label || r._id).split(' · '); return t.length > 1 && t[0].length <= 3 ? t[0] + ' · ' + t[1] : t[0]; }
function abwGrenzen(){ var a = (S.meta && S.meta.abweichung) || {}; return { gelb: a.gelb || [1.5, 3], rot: a.rot || [2, 5] }; }
// Bewertung nach Übungszeit: gelb/rot nach Faktor und Prozentpunkten; geplant und nie gekommen = rot
function bewerten(plan, ist, gekommen){
  if (!(plan > 0)) return null;
  var g = abwGrenzen(), pp = Math.abs(ist - plan), f = ist / plan;
  if (!gekommen) return { st: 'rot', wort: 'nie gekommen' };
  var wort = ist < plan ? 'zu wenig' : 'zu viel';
  if ((f >= g.rot[0] || f <= 1 / g.rot[0]) && pp >= g.rot[1]) return { st: 'rot', wort: wort };
  if ((f >= g.gelb[0] || f <= 1 / g.gelb[0] + 1e-9) && pp >= g.gelb[1]) return { st: 'gelb', wort: wort };
  return null;
}
// App: Plan gegen Ist von Tag von bis bis (höchstens heute). Plan zeitgewichtet nach dem Anteil, der am Tag galt.
function planIst(von, bis){
  bis = Math.min(bis, dn(todayIso()));
  var th = {}, tm = 0, tn = 0, tage = 0;
  for (var n = von; n <= bis; n++) {
    var p = planAm(n); if (!p) continue;
    var ids = Object.keys(p.anteile).filter(function(id){ return rowById(id); });
    var summe = ids.reduce(function(s, id){ return s + (+p.anteile[id] || 0); }, 0); if (!summe) continue;
    var dm = 0, dnn = 0, per = {};
    ids.forEach(function(id){ var a = (mIndex()[id] || {}).a || {}, v = a[n] || [0, 0]; per[id] = v; dm += v[1]; dnn += v[0]; });
    if (dnn) tage++;
    ids.forEach(function(id){
      var u = th[id] || (th[id] = { id: id, pm: 0, pn: 0, m: 0, n: 0, plan0: 0 });
      var ant = (+p.anteile[id] || 0) / summe;
      u.pm += ant * dm; u.pn += ant * dnn; u.m += per[id][1]; u.n += per[id][0]; u.plan0 = ant * 100;
    });
    tm += dm; tn += dnn;
  }
  function fertig(u, label, paket){
    var plan = tm ? u.pm / tm * 100 : u.plan0, ist = tm ? u.m / tm * 100 : 0, istN = tn ? u.n / tn * 100 : 0;
    return { id: u.id, label: label, paket: paket, plan: plan, ist: ist, istN: istN, m: u.m, n: u.n, b: tn ? bewerten(plan, ist, u.n > 0) : null };
  }
  var themen = Object.keys(th).map(function(id){ var r = rowById(id); return fertig(th[id], r.label, false); });
  var pk = {};
  Object.keys(th).forEach(function(id){ var t = topVon(rowById(id)), u = th[id], q = pk[t._id] || (pk[t._id] = { id: t._id, pm: 0, pn: 0, m: 0, n: 0, plan0: 0 }); q.pm += u.pm; q.pn += u.pn; q.m += u.m; q.n += u.n; q.plan0 += u.plan0; });
  var pakete = Object.keys(pk).map(function(id){ return fertig(pk[id], rowById(id).label, true); });
  return { themen: themen, pakete: pakete, tm: tm, tn: tn, tage: tage };
}
function abwSort(a, b){ var o = { rot: 0, gelb: 1 }; return ((a.b ? o[a.b.st] : 2) - (b.b ? o[b.b.st] : 2)) || (Math.abs(b.ist - b.plan) - Math.abs(a.ist - a.plan)); }
// Warnpunkt in der Zeitleiste: rote Abweichung in den letzten 7 Tagen
function rotLetzte7(){
  if (S._r7 && S._r7.rows === S.rows && S._r7.meta === S.meta && S._r7.tag === todayIso()) return S._r7.x;
  var x = {};
  if (hatMenge()) { var h = dn(todayIso()), pi = planIst(h - 6, h); pi.themen.concat(pi.pakete).forEach(function(t){ if (t.b && t.b.st === 'rot') x[t.id] = t; }); }
  S._r7 = { rows: S.rows, meta: S.meta, tag: todayIso(), x: x };
  return x;
}
function pz(v){ return (Math.round(v * 10) / 10).toLocaleString('de-DE', { maximumFractionDigits: v < 10 ? 1 : 0 }) + ' %'; }
function mz(v){ return Math.round(v).toLocaleString('de-DE'); }
function minuten(r, von, bis, art){ var s = 0; for (var n = von; n <= bis; n++) s += mSumme(r, n, art)[1]; return s; }
function anzahl(r, von, bis, art){ var s = 0; for (var n = von; n <= bis; n++) s += mSumme(r, n, art)[0]; return s; }
function letzteTendenz(id){ var le = letzteEinschaetzung(id); return le ? le.t.tendenz : null; }
// Ziel-Check: Warnungen aus Lernplan, Kenntnisstand und Übungsmenge (bezogen auf heute)
function zielCheck(){
  if (S._zc && S._zc.rows === S.rows && S._zc.meta === S.meta && S._zc.ins === S.ins && S._zc.tag === todayIso()) return S._zc.x;
  var w = [], h = dn(todayIso()), zmps = +(S.meta.ziel_minuten_pro_stufe) || 30;
  var etappeVon = function(r){ var p = r.parent && rowById(r.parent); return !!(p && (hatEigen(p, 'a') || inPlan(p._id)) && !inPlan(r._id)); };
  var themen = sortedRows().filter(function(r){ return !r.group || hatEigen(r, 'b') || hatEigen(r, 'a'); }).filter(function(r){ return (hatEigen(r, 'b') || hatEigen(r, 'a') || inPlan(r._id)) && !etappeVon(r); });
  var pi14 = planIst(h - 13, h), u14 = {}; pi14.themen.forEach(function(t){ u14[t.id] = t; });
  themen.forEach(function(r){
    var name = kurzName(r), niv = niveauAm(r, h), tend = letzteTendenz(r._id);
    var m14 = minuten(r, h - 13, h, 'b') + minuten(r, h - 13, h, 'a');
    // 1. Ziel in Gefahr
    var ziel = liste0(r, 'ziel').filter(function(z){ return dn(z[0]) >= h; }).sort(function(a, b){ return dn(a[0]) - dn(b[0]); })[0];
    if (ziel && niv != null) { var fehlt = (+ziel[1]) - niv; if (fehlt > 0 && m14 < fehlt * zmps) w.push({ st: 'rot', art: 'Ziel in Gefahr', row: r._id, name: name, text: 'Ziel Stufe ' + ziel[1] + ' bis ' + de(ziel[0]) + ', heute Stufe ' + niv + '. In 14 Tagen ' + mz(m14) + ' Min. geübt, nötig etwa ' + mz(fehlt * zmps) + '.' }); }
    else if (ziel && niv == null && m14 < (+ziel[1]) * zmps) w.push({ st: 'rot', art: 'Ziel in Gefahr', row: r._id, name: name, text: 'Ziel Stufe ' + ziel[1] + ' bis ' + de(ziel[0]) + ', noch keine Einschätzung. In 14 Tagen ' + mz(m14) + ' Min. geübt.' });
    // 2. Geplant, aber nicht geübt
    var dran = false; for (var n = h - 6; n <= h; n++) if ((r.bars || []).some(function(b){ return b.kind !== 'pause' && dn(b.from) <= n && n <= dn(b.to); })) dran = true;
    if (dran && anzahl(r, h - 6, h, 'b') + anzahl(r, h - 6, h, 'a') === 0) w.push({ st: 'rot', art: 'Geplant, aber nicht geübt', row: r._id, name: name, text: 'Laut Lernplan dran, aber seit 7 Tagen weder auf dem Bogen noch in der App.' });
    var u = u14[r._id];
    // 3. Viel Zeit für Sicheres
    if (u && pi14.tn && niv != null && niv >= 4 && u.ist > 1.5 * u.plan) w.push({ st: 'gelb', art: 'Viel Zeit für Sicheres', row: r._id, name: name, text: 'Stufe ' + niv + ' (' + NIVEAU[niv] + '), bekommt aber ' + pz(u.ist) + ' der App-Zeit statt ' + pz(u.plan) + '.' });
    // 4. Wenig Zeit für Schwaches
    if (u && pi14.tn && ((niv != null && niv <= 2) || tend === 'ab') && u.plan - u.ist >= 1) w.push({ st: 'gelb', art: 'Wenig Zeit für Schwaches', row: r._id, name: name, text: (tend === 'ab' ? 'Tendenz fällt' : 'Stufe ' + niv + ' (' + NIVEAU[niv] + ')') + ', bekommt nur ' + pz(u.ist) + ' der App-Zeit statt ' + pz(u.plan) + '.' });
    // 5. Nur Papier oder nur App
    var nb = anzahl(r, h - 13, h, 'b'), na = anzahl(r, h - 13, h, 'a');
    if (!noBoegen() && (nb > 0) !== (na > 0)) w.push({ st: 'info', art: nb ? 'Nur auf Bögen' : 'Nur in der App', row: r._id, name: name, text: nb ? 'Seit 14 Tagen nur auf Bögen, nicht in der App.' : 'Seit 14 Tagen nur in der App, nicht auf Bögen.' });
  });
  // 6. Block oder Thema beginnt bald, noch ohne App-Inhalte
  sortedRows().forEach(function(r){
    var bars = (r.bars || []).filter(function(b){ return b.kind !== 'pause' && !isNaN(dn(b.from)); });
    if (!bars.length || hatEigen(r, 'a') || inPlan(r._id) || etappeVon(r)) return;
    var s = Math.min.apply(null, bars.map(function(b){ return dn(b.from); }));
    if (s > h && s <= h + 7 && !r.group) w.push({ st: 'info', art: 'Beginnt bald', row: r._id, name: kurzName(r), text: 'Beginnt am ' + de(iso(s)) + ' Es gibt noch keine App-Inhalte dafür.' });
  });
  var o = { rot: 0, gelb: 1, info: 2 };
  w.sort(function(a, b){ return o[a.st] - o[b.st]; });
  S._zc = { rows: S.rows, meta: S.meta, ins: S.ins, tag: todayIso(), x: w };
  return w;
}
var ZC_ST = { rot: 'Dringend', gelb: 'Warnung', info: 'Info' };
// Beispielaufgaben zu einem Eintrag im Ziel-Check: das Thema selbst und seine Unterthemen (Etappen), höchstens 6
function zcBeispiele(id){
  var out = [], r = rowById(id);
  (function sammeln(x){ if (!x || out.length >= 6) return; if (x.beispiel) out.push(x); kinderVon(x._id).forEach(sammeln); })(r);
  return out;
}
function bspKurz(r, i){
  var b = r.beispiel, h = '<div class="zc-karte"><div class="zc-k-kopf"><b>' + esc(r.label) + '</b>' + (b.quelle ? '<span class="hint">' + esc(b.quelle) + '</span>' : '') + (b.entwurf ? '<span class="draft">Entwurf</span>' : '') + '</div>';
  if (b.geschichte) h += '<div class="story">' + mth(b.geschichte) + '</div>';
  if (b.bild) h += '<div>' + bildSvg(b.bild) + '</div>';
  if (b.rechnung) h += '<div class="rech">' + mth(b.rechnung) + '</div>';
  if (b.rechnungen) h += '<div style="display:flex;flex-wrap:wrap;gap:6px 22px">' + b.rechnungen.map(function(x){ return '<span class="rech" style="font-size:19px">' + mth(x) + '</span>'; }).join('') + '</div>';
  if (b.frage) h += '<div><b>' + mth(b.frage) + '</b></div>';
  if (b.fragen) h += '<ol style="margin:0;padding-left:22px">' + b.fragen.map(function(f){ return '<li>' + mth(f) + '</li>'; }).join('') + '</ol>';
  if ((b.loesung && b.loesung.length) || b.erklaerung) h += '<div id="lp-zcsol-' + i + '" class="sol" hidden>' + (b.loesung || []).map(function(l, j, arr){ return '<div' + (j === arr.length - 1 ? ' class="res"' : '') + '>' + mth(l) + '</div>'; }).join('') + (b.erklaerung ? '<div style="color:var(--muted);font-style:italic">' + mth(b.erklaerung) + '</div>' : '') + '</div>';
  h += '<div class="zc-k-knoepfe">' + ((b.loesung && b.loesung.length) || b.erklaerung ? '<button type="button" class="btn" data-zc-sol="' + i + '" aria-expanded="false">Lösung zeigen</button>' : '') + '<button type="button" class="btn ghost" data-bsp-from="' + esc(r._id) + '">Groß ansehen</button></div></div>';
  return h;
}
function openZiel(i, opener){
  var x = zielCheck()[i]; if (!x) return;
  var l = zcBeispiele(x.row);
  var body = '<div class="zc-warn ' + x.st + '"><span class="m-zc-st">' + ZC_ST[x.st] + '</span>' + esc(x.text) + '</div>' +
    '<h3 style="margin:4px 0 0">' + (l.length === 1 ? 'Beispielaufgabe' : 'Beispielaufgaben') + '</h3>' +
    (l.length ? '<div class="zc-bsp-liste">' + l.map(bspKurz).join('') + '</div>' : '<p class="hint">Zu diesem Thema gibt es im Lernplan noch kein Beispiel.</p>');
  infoSheet(esc(x.name) + ' · ' + esc(x.art), 'Ziel-Check', body, opener);
}
function warnZahl(){ return hatMenge() ? zielCheck().filter(function(w){ return w.st !== 'info'; }).length : 0; }
function abwHtml(t){ return t.b ? '<span class="abw ' + t.b.st + '">' + esc(t.b.wort) + '</span>' : ''; }
function planZeile(t, skala){
  var sk = function(v){ return Math.min(100, v / skala * 100); };
  return '<div class="pz' + (t.b ? ' ' + t.b.st : '') + '"><div class="pz-n">' + esc(t.paket ? t.label : kurzName({ label: t.label })) + '</div>' +
    '<button type="button" class="pz-t" data-mpi="' + esc(t.id) + '" title="Plan ' + esc(pz(t.plan)) + ', Ist ' + esc(pz(t.ist)) + ' der Übungszeit, ' + esc(pz(t.istN)) + ' der Aufgaben" aria-label="' + esc(t.label) + ': Plan ' + esc(pz(t.plan)) + ', Ist ' + esc(pz(t.ist)) + ' der Übungszeit"><span class="pz-n2" style="width:' + sk(t.istN) + '%"></span><span class="pz-z" style="width:' + sk(t.ist) + '%"></span><span class="pz-s" style="left:calc(' + sk(t.plan) + '% - 1.5px)"></span></button>' +
    '<div class="pz-w">Plan <b>' + esc(pz(t.plan)) + '</b> · Ist <b class="iz">' + esc(pz(t.ist)) + '</b> ' + abwHtml(t) + '</div></div>';
}
function renderMenge(){
  var m = S.meta, start = dn(m.start), end = dn(m.end), h = dn(todayIso());
  var sichtbar = zTage(); zStart(start, sichtbar);
  var von = Math.max(start, Math.round(S.z.tag)), bis = Math.min(end, von + Math.round(sichtbar) - 1);
  if (bis - von < 6) von = Math.max(start, bis - 6);
  var wochen = bis - von + 1 > 63;
  var spalten = [];
  if (wochen) { for (var n = von; n <= bis; ) { var mo = n - ((new Date(n * 864e5).getUTCDay() + 6) % 7), e = Math.min(bis, mo + 6); spalten.push({ von: n, bis: e }); n = e + 1; } }
  else for (var d = von; d <= bis; d++) spalten.push({ von: d, bis: d });
  var bisH = Math.min(bis, h), mass = S.mMass === 'n' ? 'n' : 'zeit', k = mass === 'n' ? 0 : 1;
  var rows = sortedRows().filter(function(r){ return !(r.parent && !isOpen(r.parent)) && mHatDaten(r); });
  function wert(r, s, art){ var v = 0, pl = false; for (var n = s.von; n <= s.bis; n++) { var x = mSumme(r, n, art); v += x[k]; if (art === 'b' && x[0] && n > h) pl = true; } return { v: v, pl: pl }; }
  var max = 0, zellen = rows.map(function(r){ return spalten.map(function(s){ var b = wert(r, s, 'b'), a = wert(r, s, 'a'); max = Math.max(max, b.v, a.v); return { b: b, a: a }; }); });
  var hoehe = function(v){ return v > 0 ? Math.max(10, Math.round(100 * Math.sqrt(v / max))) : 0; };
  var pi = planIst(von, bis), r7 = rotLetzte7();
  var o = '';
  // Kopf: Zeitraum und Maß
  o += zoomLeiste();
  o += '<div class="m-zeitraum"><button type="button" class="btn ghost" data-mschieb="-1" aria-label="Früher">‹</button><span><b>' + esc(de(iso(von))) + ' bis ' + esc(de(iso(bis))) + '</b>' + (wochen ? ' · je Woche' : '') + '</span><button type="button" class="btn ghost" data-mschieb="1" aria-label="Später">›</button>' +
    '<div class="seg klein" role="group" aria-label="Maß"><button type="button" data-mmass="zeit" aria-pressed="' + (mass === 'zeit') + '">Übungszeit</button><button type="button" data-mmass="n" aria-pressed="' + (mass === 'n') + '">Aufgaben</button></div></div>';
  // 1. Befunde
  var gleich = function(a, b){ return Math.abs(a.plan - b.plan) < 0.05 && Math.abs(a.ist - b.ist) < 0.05; };
  var bef = pi.pakete.filter(function(t){ return t.b; });
  bef = bef.concat(pi.themen.filter(function(t){ return t.b && !bef.some(function(p){ return gleich(p, t); }); })).sort(abwSort).slice(0, 4);
  if (bef.length) o += '<div class="m-bef">' + bef.map(function(t){
    return '<button type="button" class="m-bk ' + t.b.st + '" data-mpi="' + esc(t.id) + '"><span class="m-bk-k">App · ' + esc(t.paket ? 'Paket ' : '') + esc(kurzName({ label: t.label })) + '</span><b class="m-bk-z">' + esc(pz(t.ist)) + ' statt ' + esc(pz(t.plan)) + '</b><span>der Übungszeit · ' + esc(pz(t.istN)) + ' der Aufgaben</span>' + abwHtml(t) + '</button>';
  }).join('') + '</div>';
  else if (pi.tn) o += '<p class="hint">Im gewählten Zeitraum keine auffällige Abweichung vom App-Plan.</p>';
  // 2. Ziel-Check
  var zc = zielCheck();
  o += '<section class="card m-sec" id="lp-zielcheck"><h2>Ziel-Check</h2><p class="hint">Bezogen auf heute: Lernplan, Kenntnisstand und Übungszeit der letzten 7 bzw. 14 Tage.</p>' +
    (zc.length ? '<ul class="m-zc">' + zc.map(function(x, i){ return '<li class="' + x.st + '"><button type="button" class="m-zc-b" data-zc="' + i + '" title="Beispielaufgaben ansehen"><span class="m-zc-st">' + ZC_ST[x.st] + '</span><b>' + esc(x.name) + '</b> · ' + esc(x.art) + '<div>' + esc(x.text) + '</div>' + (zcBeispiele(x.row).length ? '<span class="m-zc-bsp">' + zcBeispiele(x.row).length + (zcBeispiele(x.row).length === 1 ? ' Beispielaufgabe' : ' Beispielaufgaben') + ' ›</span>' : '') + '</button></li>'; }).join('') + '</ul>' : '<p>Keine Warnungen.</p>') + '</section>';
  // 3. Thema × Tag
  var heute = function(s){ return s.von <= h && h <= s.bis; };
  var kopf = spalten.map(function(s){
    var bt = !wochen && S.tage.filter(function(t){ return dn(t.date) === s.von; })[0];
    var oben = wochen ? (wochenName(s.von) || de(iso(s.von))) : (bt ? (/^W/.test(String(bt.wk)) ? bt.wk : 'W' + bt.wk) + ' ' + (/^T/.test(String(bt.day)) ? bt.day : 'T' + bt.day) : ['So','Mo','Di','Mi','Do','Fr','Sa'][new Date(s.von * 864e5).getUTCDay()]);
    return '<th class="' + (bt ? 'bt' : '') + (heute(s) ? ' heute' : '') + '" title="' + esc(de(iso(s.von)) + (wochen ? ' bis ' + de(iso(s.bis)) : '')) + '">' + esc(oben) + '<br>' + esc(de(iso(s.von))) + '</th>';
  }).join('');
  var body = rows.map(function(r, i){
    var sb = 0, sa = 0;
    var tds = spalten.map(function(s, j){
      var z = zellen[i][j], dran = false; for (var n = s.von; n <= s.bis; n++) if (mDran(r, n)) dran = true;
      if (s.von <= bisH) { sb += wertBis(r, s, 'b'); sa += wertBis(r, s, 'a'); }
      var leer = !z.b.v && !z.a.v;
      return '<td class="mc' + (dran ? ' dran' : '') + (heute(s) ? ' heute' : '') + '">' + (leer ? '' : '<button type="button" class="mcell" data-mz="' + esc(r._id) + '|' + s.von + '|' + s.bis + '" title="' + esc(zellTitel(r, s)) + '"><i class="b' + (z.b.pl ? ' pl' : '') + '" style="height:' + hoehe(z.b.v) + '%"></i><i class="a" style="height:' + hoehe(z.a.v) + '%"></i></button>') + '</td>';
    }).join('');
    var rot = r7[r._id];
    return '<tr class="' + (r.group ? 'grp' : '') + '"><th class="mrl" scope="row">' + (rot ? '<span class="wpunkt" title="Rote Abweichung in den letzten 7 Tagen: ' + esc(rot.b.wort) + '" aria-label="Warnung: ' + esc(rot.b.wort) + '"></span>' : '') + '<span>' + esc(r.label) + '</span></th>' + tds +
      '<td class="msum"><b class="tb">' + mz(sb) + '</b> · <b class="ta">' + mz(sa) + '</b></td></tr>';
  }).join('');
  function wertBis(r, s, art){ var v = 0; for (var n = s.von; n <= Math.min(s.bis, bisH); n++) v += mSumme(r, n, art)[k]; return v; }
  o += '<section class="m-sec"><h2>Thema × Tag</h2><div class="legend"><span><i class="sw b"></i>Bogen</span><span><i class="sw a"></i>App</span><span><i class="sw mdran"></i>laut Lernplan dran</span>' + (noBoegen() ? '' : '<span><i class="sw p"></i>Bogen geplant</span>') + '<span>Höhe nach Wurzel der Menge</span></div>' +
    '<div class="card m-scroll"><table class="mx' + (wochen ? ' wo' : '') + '"><thead><tr><th class="mrl"></th>' + kopf + '<th class="msum">' + (mass === 'n' ? 'Aufgaben' : 'Minuten') + '<br>Bogen · App</th></tr></thead><tbody>' + body + '</tbody></table></div>' +
    '<p class="hint">Summen bis heute. ' + (mass === 'n' ? 'Bogen: Teilaufgaben, App: Aufgaben.' : 'Bogen: Minuten geschätzt, App: Minuten gemessen.') + ' Tippe auf eine Zelle für die Zahlen.</p></section>';
  // 4. App: Plan gegen Ist
  if (pi.pakete.length) {
    var skT = Math.max(10, Math.ceil(Math.max.apply(null, pi.themen.map(function(t){ return Math.max(t.plan, t.ist, t.istN); })) / 10) * 10);
    o += '<section class="m-sec"><h2>App: Plan gegen Ist</h2><p class="hint">' + esc(de(iso(von))) + ' bis ' + esc(de(iso(bisH))) + (pi.tn ? ', ' + pi.tn + ' Aufgaben, ' + mz(pi.tm) + ' Min.' : ', keine App-Aufgaben.') + ' Strich = Plan, kräftiger Balken = Anteil an den Aufgaben, heller Balken = Anteil an der Übungszeit. Bewertet wird die Übungszeit.</p>' +
      '<h3>Pakete</h3><div class="pzl">' + pi.pakete.slice().sort(abwSort).map(function(t){ return planZeile(t, 100); }).join('') + '</div>' +
      '<h3>Themen</h3><div class="pzl">' + pi.themen.slice().sort(abwSort).map(function(t){ return planZeile(t, skT); }).join('') + '</div><p class="hint">Skala Themen: 0 bis ' + skT + ' %.</p></section>';
  }
  // 5. Bogen oder App
  var st = rows.filter(function(r){ return !(r.group && isOpen(r._id) && !hatEigen(r, 'b') && !hatEigen(r, 'a')); }).map(function(r){ return { r: r, b: minuten(r, von, bisH, 'b'), a: minuten(r, von, bisH, 'a') }; }).filter(function(x){ return x.b + x.a > 0; }).sort(function(x, y){ return (y.b + y.a) - (x.b + x.a); });
  var smax = Math.max.apply(null, [1].concat(st.map(function(x){ return x.b + x.a; })));
  if (st.length) o += '<section class="m-sec"><h2>Bogen oder App</h2><p class="hint">Minuten je Thema bis heute, Bogen geschätzt, App gemessen.</p><div class="pzl">' + st.map(function(x){
    return '<div class="pz"><div class="pz-n">' + esc(kurzName(x.r)) + '</div><div class="stk" title="Bogen ' + mz(x.b) + ' Min., App ' + mz(x.a) + ' Min."><span class="tb" style="width:' + (100 * x.b / smax) + '%"></span><span class="ta" style="width:' + (100 * x.a / smax) + '%"></span></div><div class="pz-w"><b class="tb">' + mz(x.b) + '</b> + <b class="ta">' + mz(x.a) + '</b> Min.</div></div>';
  }).join('') + '</div></section>';
  // 6. Wie gerechnet wurde
  var bm = m.bogen_min || {}, ap = appPlaene();
  o += '<div class="m-note"><b>Wie gerechnet wurde</b><span>App: Aufgaben und Minuten je Tag aus der Auswertung der App (Feld <code>verlauf</code>). Plan = Anteil an der Übungszeit aus den App-Einstellungen' + (ap.length ? ' (' + esc(ap.map(function(p){ return 'ab ' + de(p.ab) + (p.quelle ? ': ' + p.quelle : ''); }).join('; ')) + ')' : '') + ', gewichtet nach der App-Zeit an jedem Tag.</span>' +
    (noBoegen() ? '' : '<span>Bogen: Teilaufgaben je Bogentag mal geschätzte Minuten pro Teilaufgabe' + (Object.keys(bm).length ? ': ' + esc(Object.keys(bm).map(function(id){ var r = rowById(id); return (r ? kurzName(r) : id) + ' ' + String(bm[id]).replace('.', ','); }).join(', ')) : '') + '.</span>') +
    '<span>Abweichung nach Übungszeit: gelb ab Faktor ' + String(abwGrenzen().gelb[0]).replace('.', ',') + ' und ' + abwGrenzen().gelb[1] + ' Prozentpunkten, rot ab Faktor ' + abwGrenzen().rot[0] + ' und ' + abwGrenzen().rot[1] + ' Prozentpunkten oder wenn ein geplantes Thema nie kam.</span></div>';
  return o;
}
function zellTitel(r, s){
  var b = [0, 0], a = [0, 0], pl = false, h = dn(todayIso());
  for (var n = s.von; n <= s.bis; n++) { var x = mSumme(r, n, 'b'), y = mSumme(r, n, 'a'); b[0] += x[0]; b[1] += x[1]; a[0] += y[0]; a[1] += y[1]; if (x[0] && n > h) pl = true; }
  return kurzName(r) + ', ' + de(iso(s.von)) + (s.bis > s.von ? '–' + de(iso(s.bis)) : '') + ': ' + (noBoegen() ? '' : 'Bogen ' + b[0] + ' Teilaufgaben, ' + mz(b[1]) + ' Min.' + (pl ? ' (geplant)' : '') + ' · ') + 'App ' + a[0] + ' Aufgaben' + (a[1] ? ', ' + String(Math.round(a[1] * 10) / 10).replace('.', ',') + ' Min.' : '');
}
function openMZelle(key, opener){
  var p = key.split('|'), r = rowById(p[0]); if (!r) return;
  var s = { von: +p[1], bis: +p[2] }, rot = rotLetzte7()[r._id];
  infoSheet(esc(r.label), 'Übungsmenge · ' + esc(de(iso(s.von)) + (s.bis > s.von ? ' bis ' + de(iso(s.bis)) : '')), '<p>' + esc(zellTitel(r, s).split(': ').slice(1).join(': ')) + '</p>' + (mDran(r, s.von) ? '<p class="hint">Laut Lernplan dran.</p>' : ''), opener);
}
function openMPlan(id, opener){
  var m = S.meta, sichtbar = zTage(), von = Math.max(dn(m.start), Math.round(S.z.tag)), bis = Math.min(dn(m.end), von + Math.round(sichtbar) - 1);
  var pi = planIst(von, bis), t = pi.themen.concat(pi.pakete).filter(function(x){ return x.id === id; })[0]; if (!t) return;
  infoSheet(esc(t.label), 'App: Plan gegen Ist · ' + esc(de(iso(von))) + ' bis ' + esc(de(iso(Math.min(bis, dn(todayIso()))))),
    kv('Plan', esc(pz(t.plan)) + ' der Übungszeit') + kv('Ist Zeit', esc(pz(t.ist)) + ' (' + mz(t.m) + ' Min.)') + kv('Ist Aufgaben', esc(pz(t.istN)) + ' (' + t.n + ' Aufgaben)') + kv('Bewertung', t.b ? abwHtml(t) + ' <span class="hint">' + (t.b.st === 'rot' ? 'deutliche' : 'auffällige') + ' Abweichung</span>' : 'im Rahmen'), opener);
}

/* ---------- Bahnen ---------- */
function renderBahnen(){
  var m = S.meta, LW = 130;
  var von = dn(m.start), bis = dn(m.end), days = bis - von + 1;
  var PX = zPx(LW), sichtbar = zTage();
  zStart(von, sichtbar);
  function x(n){ return LW + (n - von) * PX; }
  function xn(n, plus){ return (x(n) + (plus || 0)) + 'px'; }
  var W = LW + days * PX, eng = PX < 30, sehrEng = PX < 14;
  var tw = Math.max(PX - (eng ? 2 : 8), 3), tl = eng ? 1 : 4; // Kachel-Breite und -Abstand
  var h = zoomLeiste();
  h += '<div class="card bahnkarte"><div class="scroller" data-px="' + PX + '" data-von="' + von + '" data-lw="' + LW + '"><div style="position:relative;min-width:' + W + 'px;height:600px">';
  // Tage bzw. Achse
  if (!sehrEng) {
    for (var i = 0; i < days; i++) {
      var dd = new Date((von + i) * 864e5), we = dd.getUTCDay() === 0 || dd.getUTCDay() === 6;
      h += '<div style="position:absolute;top:30px;bottom:0;width:' + PX + 'px;left:' + x(von + i) + 'px;border-left:1px solid var(--line-soft);background:' + (we ? 'var(--surface-2)' : 'transparent') + '"></div>';
      h += '<div style="position:absolute;top:36px;width:' + PX + 'px;left:' + x(von + i) + 'px;text-align:center;font-size:12px;color:var(--muted)">' + dd.getUTCDate() + '.</div>';
    }
    (m.wochen||[]).forEach(function(w){ var n = dn(w.start); if (n >= von && n <= bis) h += '<div style="position:absolute;top:8px;left:' + (x(n) + 6) + 'px;font-size:13px;font-weight:700">' + esc(w.name) + '</div>'; });
  } else {
    h += '<div class="hdr bahn-achse">' + achse(von, bis, PX, xn) + '</div>' + achseLinien(von, bis, PX, function(n){ return x(n) + 'px'; }).replace(/class="vline"/g, 'class="vline" data-ab="30"');
  }
  var tage = noBoegen() ? [] : S.tage.slice().sort(function(a,b){ return dn(a.date) - dn(b.date); });
  if (noBoegen()) h += freiBahn(von, bis, x, PX, tw, tl);
  // Bahn Bögen
  else h += '<div class="lane-lab" style="position:absolute;top:64px;height:124px;background:var(--surface-2)"><div style="font-family:var(--f-display);color:var(--teal);font-size:16px">Bögen</div><div style="font-weight:400;color:var(--muted);margin-top:4px">auf Papier, führt Neues ein</div></div>';
  tage.forEach(function(t){
    var n = dn(t.date); if (n < von || n > bis) return;
    h += '<button type="button" class="tile ' + esc(t.status || 'plan') + (eng ? ' klein' : '') + '" data-tag="' + esc(t._id) + '" title="' + esc('Bogen ' + t.wk + ' ' + t.day + ' · ' + de(t.date)) + '" style="top:76px;height:104px;width:' + tw + 'px;left:' + (x(n) + tl) + 'px" aria-label="Bogen ' + esc(t.wk) + ' ' + esc(t.day) + ', Details">' +
      (eng ? (sehrEng ? '' : '<div class="d">' + esc(t.day) + '</div>') : '<div style="font-weight:700;opacity:.85">' + esc(t.wk) + '</div><div class="d">' + esc(t.day) + '</div><div class="t">' + esc(t.theme) + '</div>') + '</button>';
  });
  if (m.test && m.test.datum) { var tn = dn(m.test.datum); if (tn >= von && tn <= bis) h += '<button type="button" class="tile test' + (eng ? ' klein' : '') + '" data-test="1" title="' + esc(m.test.name || 'Schultest') + '" style="top:76px;height:104px;width:' + tw + 'px;left:' + (x(tn) + tl) + 'px">' + (eng ? (sehrEng ? '' : '<b>!</b>') : '<b>' + esc(m.test.name || 'Schultest') + '</b>' + (m.test.offen ? '<span>Datum offen</span>' : '')) + '</button>'; }
  // Rückmeldung (bei engem Zoom gruppiert wie die Erkenntnis-Marker)
  h += '<div class="lane-lab" style="position:absolute;top:196px;height:84px;background:var(--amber-soft);color:var(--amber-ink)">Rückmeldung<div style="font-weight:400;color:var(--muted);margin-top:3px">' + (noBoegen() ? 'aus App und Feedback in neue Inhalte' : 'aus App und Bogen in den nächsten Bogen') + '</div></div>';
  if (PX >= 40) {
    var feedRow = {};
    S.ins.forEach(function(e){
      if (!e.ab) return; var n = dn(e.ab); if (n < von || n > bis) return;
      var lvl = feedRow[n] || 0; feedRow[n] = lvl + 1; if (lvl > 1) return;
      h += '<button type="button" class="feed" data-feed="' + esc(e._id) + '" style="top:' + (204 + lvl * 36) + 'px;left:' + (x(n) + 3) + 'px;width:' + (2 * PX - 6) + 'px;text-align:left">' + esc(e.n) + ' · ' + esc(e.kurz || e.eff) + '</button>';
    });
  } else {
    var mitAb = S.ins.filter(function(e){ return e.ab && dn(e.ab) >= von && dn(e.ab) <= bis; }).sort(function(a, b){ return (dn(a.ab) - dn(b.ab)) || (a.n - b.n); });
    gruppieren(mitAb.map(function(e){ return { e: e, pos: x(dn(e.ab)) + PX / 2 - 13 }; })).forEach(function(g){
      h += '<button type="button" class="mark feedm' + (g.items.length > 1 ? ' grp' : '') + '" data-feed="' + esc(g.ids.join(',')) + '" aria-label="Rückmeldung ' + esc(g.text) + ' ab ' + esc(de(g.items[0].ab)) + '" style="top:222px;left:' + g.pos + 'px' + (g.items.length > 1 ? ';width:' + g.breite + 'px' : '') + '">' + esc(g.text) + '</button>';
    });
  }
  // Bahnen App
  h += '<div class="lane-lab lane-app" style="position:absolute;top:284px;left:0;padding:0 12px;border:0;background:transparent;font-family:var(--f-display);font-weight:700;color:var(--amber-ink);font-size:13px">App</div>';
  var top = 306;
  groups().forEach(function(g){
    var blocks = (g.bars||[]).filter(function(b){ return b.kind === 'app' || b.kind === 'planapp'; });
    if (!blocks.length) return;
    h += '<div class="lane-lab" style="position:absolute;top:' + (top - 6) + 'px;height:44px;background:var(--surface)">' + esc(g.lane || g.label) + '</div>';
    blocks.forEach(function(b, bi){
      var f = Math.max(dn(b.from), von), t = Math.min(dn(b.to), bis); if (t < f) return;
      var bw = Math.max((t - f + 1) * PX - 2, 3);
      h += '<button type="button" class="blk ' + esc(b.kind) + '" data-blk="' + esc(g._id) + '|' + bi + '" title="' + esc((b.lab || 'App') + ' · ' + de(b.from) + '–' + de(b.to)) + '" style="top:' + top + 'px;left:' + x(f) + 'px;width:' + bw + 'px;text-align:left' + (bw < 24 ? ';padding:0' : '') + '" aria-label="' + esc((g.lane || g.label) + ': ' + (b.lab || 'App')) + ', Details">' + (bw < 24 ? '' : esc(b.lab || '')) + '</button>';
    });
    top += 52;
  });
  // Verbindungen Bogen → App (Etappen)
  tage.forEach(function(t){
    if (!t.etappe) return; var n = dn(t.date) + 1; if (n < von || n > bis) return;
    var g = groups().filter(function(gg){ return gg._id === t.etappe.paket; })[0]; if (!g) return;
    var idx = 0, yy = 306; groups().forEach(function(gg){ var has = (gg.bars||[]).some(function(b){ return b.kind === 'app' || b.kind === 'planapp'; }); if (!has) return; if (gg._id === g._id) yy = 306 + idx * 52; idx++; });
    h += '<div class="link" style="top:182px;height:' + (yy - 182) + 'px;left:' + (x(n) + Math.min(8, PX / 2)) + 'px"></div>' + (PX >= 30 ? '<div class="flag" style="top:' + (yy - 18) + 'px;left:' + (x(n) + 12) + 'px;color:var(--teal)">ab morgen: E' + esc(t.etappe.nr) + '</div>' : '');
  });
  var td = dn(todayIso());
  if (td >= von && td <= bis) h += '<div class="today" style="top:56px;left:' + (x(td) + PX/2) + 'px"></div><div class="flag" style="top:56px;color:var(--amber-ink);left:' + (x(td) + PX/2 + 4) + 'px">heute</div>';
  h += '</div></div><div class="bahn-links" aria-hidden="false"></div></div>';
  // Karten: Erkenntnisse aus dem sichtbaren Zeitraum (und den drei Wochen davor)
  var sv = S.z.tag, sb = sv + sichtbar;
  var near = S.ins.filter(function(e){ var n = dn(e.date); return n >= sv - 21 && n <= sb; }).sort(function(a,b){ return b.n - a.n; }).slice(0, 8);
  h += '<h2 style="margin:6px 0 0;font-family:var(--f-display);font-size:19px">Erkenntnisse und ihre Wirkung</h2>';
  h += near.length ? '<div class="cards">' + near.map(function(e){
    return '<button type="button" class="icard" data-ins="' + esc(e._id) + '"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;width:100%"><span class="chip ' + srcClass(e.src) + '">' + esc(e.n) + ' · ' + esc(e.src) + '</span><span style="color:var(--muted)">' + esc(de(e.date)) + '</span></div><div style="font-size:14px"><b>Gesehen:</b> ' + esc(e.obs) + '</div><div style="font-size:12px;font-weight:700;color:var(--teal)">↓ geändert</div><div style="font-size:14px">' + esc(e.eff) + '</div><div class="when">wirkt ab <b>' + esc(e.when) + '</b></div></button>';
  }).join('') + '</div>' : '<p class="hint">In diesem Zeitraum gibt es noch keine Erkenntnisse.</p>';
  return h;
}

/* ---------- Freischaltungen (Schalter boegen: false) ---------- */
function freiBahn(von, bis, x, PX, tw, tl){
  var eng = PX < 30, sehrEng = PX < 14; tw = tw || PX - 8; tl = tl == null ? 4 : tl;
  var h = '<div class="lane-lab" style="position:absolute;top:64px;height:124px;background:var(--surface-2)"><div style="font-family:var(--f-display);color:var(--teal);font-size:16px">Freischaltungen</div><div style="font-weight:400;color:var(--muted);margin-top:4px">Etappen schalten in der App automatisch frei</div></div>';
  var et = S.rows.filter(function(r){ return r.etappe; }), td = dn(todayIso()), byDay = {};
  et.forEach(function(r){ if (!r.etappe.ab) return; var n = dn(r.etappe.ab); if (n < von || n > bis) return; (byDay[n] = byDay[n] || []).push(r); });
  Object.keys(byDay).forEach(function(k){
    var n = +k, list = byDay[k];
    var inhalt = eng ? (sehrEng ? '' : '<div class="d">' + list.length + '</div>') : '<div class="d">' + new Date(n * 864e5).getUTCDate() + '.</div><div class="t">' + (list.length > 2 ? esc(list.map(function(r){ return 'E' + r.etappe.nr; }).filter(function(v, i, a){ return a.indexOf(v) === i; }).join(', ')) + '\n' + list.length + ' Pakete' : list.map(function(r){ return esc(etName(r)); }).join('\n')) + '</div>';
    h += '<button type="button" class="tile ' + (n <= td ? 'done' : 'next') + (eng ? ' klein' : '') + '" data-frei="' + esc(list.map(function(r){ return r._id; }).join(',')) + '" title="' + esc(de(iso(n)) + ': ' + list.map(etName).join(', ')) + '" style="top:76px;height:104px;width:' + tw + 'px;left:' + (x(n) + tl) + 'px;overflow:hidden" aria-label="Freigeschaltet am ' + esc(de(iso(n))) + ', Details">' + inhalt + '</button>';
  });
  // offene Etappen: je Paket die nächste, ohne Datum, ab morgen der Reihe nach
  var next = {}; et.forEach(function(r){ if (r.etappe.ab) return; var p = r.etappe.paket; if (!next[p] || r.etappe.nr < next[p].etappe.nr) next[p] = r; });
  var pos = Math.max(td + 1, von), used = {};
  Object.keys(byDay).forEach(function(k){ used[k] = 1; });
  sortedRows().filter(function(r){ return next[r.etappe && r.etappe.paket] === r; }).forEach(function(r){
    while (used[pos] || used[pos + 1]) pos++;
    if (pos > bis) return;
    h += '<button type="button" class="tile offen' + (eng ? ' klein' : '') + '" data-frei="' + esc(r._id) + '" title="' + esc(etName(r)) + '" style="top:76px;height:104px;width:' + tw + 'px;left:' + (x(pos) + tl) + 'px;overflow:hidden" aria-label="' + esc(etName(r)) + ', noch gesperrt, Details">' + (sehrEng ? '' : '<div class="d">?</div>' + (eng ? '' : '<div class="t">' + esc(etName(r)) + '</div>')) + '</button>';
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
  // Übungsmenge (ab 1.5.0): nur mit Daten dazu
  var mg = !!(S.bereit && hatMenge());
  if (S.view === 'menge' && !mg && S.bereit && S.meta) S.view = 'zeit';
  $('v-menge').hidden = !mg;
  $('v-menge').setAttribute('aria-pressed', S.view === 'menge');
  var tm = S.bereit ? trendM() : null;
  if (S.view === 'trend' && !tm && S.bereit && S.meta) S.view = 'zeit';
  $('v-trend').hidden = !tm;
  $('v-trend').parentNode.classList.toggle('vier', !!tm);
  $('v-trend').setAttribute('aria-pressed', S.view === 'trend');
  var wz = mg ? warnZahl() : 0;
  $('warnz').hidden = !wz;
  $('warnz').classList.toggle('gelb', !!wz && !zielCheck().some(function(w){ return w.st === 'rot'; }));
  if (wz) { $('warnz').textContent = wz + (wz === 1 ? ' Warnung' : ' Warnungen'); $('warnz').title = 'Ziel-Check in der Übungsmenge'; }
  $('legende').hidden = S.view === 'menge' || S.view === 'trend';
  $('edit').hidden = !S.canEdit;
  $('edit').setAttribute('aria-pressed', S.edit);
  // Farbe der Balken: Art (wie bisher) oder Kenntnisstand, nur wenn es Daten dazu gibt
  $('farbe').hidden = !(S.view === 'zeit' && hatNiveau());
  Array.prototype.forEach.call($('farbe').querySelectorAll('button'), function(b){ b.setAttribute('aria-pressed', b.dataset.farbe === (standModus() ? 'stand' : 'art')); });
  $('lg-stand').hidden = !(S.view === 'zeit' && standModus());
  if (!$('lg-stand').hidden && !$('lg-stand').innerHTML) $('lg-stand').innerHTML = standLegende();
  $('editbar').hidden = !S.edit;
  var v = $('view');
  if (!S.bereit) { v.innerHTML = '<div class="card empty">Der Lernplan wird geladen. Er zeigt Pakete, Themen und Erkenntnisse, sobald die gespeicherten Daten da sind.</div>'; return; }
  if (!S.meta) { v.innerHTML = '<div class="card empty">Noch kein Lernplan gespeichert. Claude legt ihn an und trägt nach jedem Bogen neue Daten ein.</div>'; return; }
  $('stand').textContent = S.meta.stand ? 'Stand ' + de(S.meta.stand) : '';
  if (S.meta.eyebrow) $('eyebrow').textContent = S.meta.eyebrow;
  if (S.meta.titel) $('title').textContent = S.meta.titel;
  if (S.view === 'trend') { if (!TR) TR = Trend.ansicht(v, { speicher: (opt.speicher || 'lp') + '-trend' }); TR.render(tm); }
  else v.innerHTML = S.view === 'zeit' ? renderZeit() : S.view === 'menge' ? renderMenge() : renderBahnen();
  S.breite = v.clientWidth;
  scrollerSetzen();
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
      if (r.niveau) out.niveau = r.niveau;
      if (r.verlauf) out.verlauf = r.verlauf;
      if (r.bogen) out.bogen = r.bogen;
      if (r.ziel) out.ziel = r.ziel;
      ['ergebnisse', 'bogen_erg', 'schritte'].forEach(function(k){ if (r[k]) out[k] = r[k]; }); // Trend (ab 1.9.0)
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
    if (e.stand) out.stand = e.stand;
    var nid = id || ('e' + out.n + '-' + Math.random().toString(36).slice(2,5));
    S.sel = nid;
    return S.db.doc('insights/' + nid).set(out);
  }, id ? function(){ if (S.sel === id) S.sel = null; return S.db.doc('insights/' + id).delete(); } : null);
}
function editTag(id){
  var t = S.tage.filter(function(x){ return x._id === id; })[0] || { wk:'', day:'', date: todayIso(), theme:'', status:'plan', etappe:null };
  var inner = '<div class="row3"><div class="field"><label for="tw">Woche</label><input id="tw" name="wk" value="' + esc(t.wk) + '" placeholder="W6" required></div><div class="field"><label for="td">Tag</label><input id="td" name="day" value="' + esc(t.day) + '" placeholder="T1" required></div><div class="field"><label for="tdt">Datum</label><input id="tdt" name="date" type="date" value="' + esc(t.date) + '" required></div></div>' +
    '<div class="field"><label for="tt">Thema (kurz, Zeilenumbruch erlaubt)</label><textarea id="tt" name="theme">' + esc(t.theme) + '</textarea></div>' +
    '<div class="field"><label for="tbg">Bogen (Ordner in der Eltern-App, z. B. w5t5)</label><input id="tbg" name="bogen" value="' + esc(t.bogen || '') + '" placeholder="w6t1"></div>' +
    '<div class="field"><label for="tsx">Status</label><select id="tsx" name="status">' + [['done','erledigt'],['next','als Nächstes'],['plan','geplant']].map(function(s){ return '<option value="' + s[0] + '"' + (t.status === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select></div>' +
    '<div class="row2"><div class="field"><label for="tep">Führt Etappe ein (Paket)</label><select id="tep" name="ep"><option value="">— keine —</option>' + groups().map(function(g){ return '<option value="' + esc(g._id) + '"' + (t.etappe && t.etappe.paket === g._id ? ' selected' : '') + '>' + esc(g.label) + '</option>'; }).join('') + '</select></div><div class="field"><label for="ten">Etappe Nr.</label><input id="ten" name="en" type="number" min="1" value="' + esc(t.etappe ? t.etappe.nr : '') + '"></div></div>';
  openPanel(id ? 'Bogentag ändern' : 'Neuer Bogentag', inner, function(fd){
    var out = { wk: fd.get('wk'), day: fd.get('day'), date: fd.get('date'), theme: fd.get('theme'), status: fd.get('status'), etappe: fd.get('ep') && fd.get('en') ? { paket: fd.get('ep'), nr: +fd.get('en') } : null };
    // Felder ohne Eingabe bleiben erhalten (row, canvas); bogen aus dem Feld
    if (t.row) out.row = t.row;
    if (t.canvas) out.canvas = t.canvas;
    var bg = String(fd.get('bogen') || '').trim(); if (/^[\w.-]+$/.test(bg)) out.bogen = bg;
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
// Deep Link in die Eltern-App: …/eltern/#bogen/<kind>/<bogen>. kind = Ordner unter daten/ (aus dem Export oder aus dem Namen)
var ELTERN_URL = 'https://nechromus.github.io/LearningTools/eltern/';
function kindOrdner(){
  var k = opt.kind || (S.meta && S.meta.kind) || opt.name || '';
  return String(k).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9_-]+/g, '');
}
function bogenLink(id){ return (opt.elternUrl || ELTERN_URL) + '#bogen/' + encodeURIComponent(kindOrdner()) + '/' + encodeURIComponent(id); }
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
    if (b.dataset.zcSol != null) { var so = $('zcsol-' + b.dataset.zcSol); if (so) { so.hidden = !so.hidden; b.textContent = so.hidden ? 'Lösung zeigen' : 'Lösung verbergen'; b.setAttribute('aria-expanded', !so.hidden); } }
    if (b.dataset.editTag) { editTag(b.dataset.editTag); }
    if (b.dataset.editRow) { editRow(b.dataset.editRow); }
    if (b.dataset.editMeta) { editMeta(); }
  };
  $('inf-close').focus();
}
function kv(k, v){ return '<div style="display:grid;grid-template-columns:130px minmax(0,1fr);gap:10px;align-items:baseline"><span style="font-size:12.5px;font-weight:700;color:var(--muted)">' + esc(k) + '</span><span>' + v + '</span></div>'; }
function openTag(id, opener){
  var t = S.tage.filter(function(x){ return x._id === id; })[0]; if (!t) return;
  // Eltern-App: ein Tipp öffnet immer den hinterlegten Bogen (Auftrag 31)
  if (opt.bogenOeffnen && t.bogen && !S.edit) { opt.bogenOeffnen(String(t.bogen)); return; }
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
  if (t.bogen && !opt.bogenOeffnen) actions = '<a class="btn" href="' + esc(bogenLink(t.bogen)) + '" target="_blank" rel="noopener">Bogen in der Eltern-App ↗</a>' + actions;
  else if (t.canvas && !opt.bogenOeffnen) b += kv('Übungsblatt', '<a href="' + esc(t.canvas) + '" target="_blank" rel="noopener">Bogen öffnen</a>');
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
  // Gruppe aus der Rückmeldungs-Bahn: alle Erkenntnisse der Gruppe
  if (id.indexOf(',') >= 0) {
    var liste = id.split(',').map(function(i){ return S.ins.filter(function(x){ return x._id === i; })[0]; }).filter(Boolean);
    if (!liste.length) return;
    infoSheet('Erkenntnisse ' + esc(nummernText(liste.map(function(e){ return e.n; }))), 'Rückmeldung', liste.map(insMini).join(''), opener, '');
    return;
  }
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
$('v-menge').onclick = function(){ S.view = 'menge'; render(); };
$('v-trend').onclick = function(){ S.view = 'trend'; render(); };
$('warnz').onclick = function(){ S.view = 'menge'; render(); var z = $('zielcheck'); if (z && z.scrollIntoView) z.scrollIntoView({ block: 'start', behavior: 'smooth' }); };
$('edit').onclick = function(){ S.edit = !S.edit; render(); };
$('add-row').onclick = function(){ editRow(null); };
$('add-ins').onclick = function(){ editIns(null); };
$('add-tag').onclick = function(){ editTag(null); };
$('edit-meta').onclick = editMeta;
$('view').addEventListener('click', function(e){
  if (S.view === 'trend') return;
  if (zieh.bewegt) { zieh.bewegt = false; return; }
  var t = e.target.closest('button');
  if (!t) { var tp = e.target.closest('[data-tipp]'); if (tp) toast(tp.dataset.tipp); return; }
  if (t.dataset.zoom) {
    // Stufe wählen: „heute“ bleibt an seiner Stelle, wenn es zu sehen ist, sonst die Mitte
    var st = STUFEN.filter(function(s){ return s[0] === t.dataset.zoom; })[0], alt = zTage(), td = dn(todayIso()) + 0.5, li = S.z.tag;
    if (li != null && td >= li && td <= li + alt) zoomen(st[1] || gesamtTage(), td, (td - li) / alt); else zoomen(st[1] || gesamtTage());
    return;
  }
  if (t.dataset.zoomrel) { zoomen(zTage() / (+t.dataset.zoomrel > 0 ? 1.5 : 1 / 1.5)); return; }
  if (t.dataset.heute) { S.z.tag = dn(todayIso()) - zTage() / 3; render(); return; }
  if (t.dataset.grp) { var ids = t.dataset.grp.split(','); if (S.view === 'zeit' && gruppeAn(ids)) { S.sel = null; S.grp = null; render(); return; } S.grp = ids; S.sel = ids[0]; render(); return; }
  if (t.dataset.gwahl) { S.sel = t.dataset.gwahl; render(); return; }
  if (t.dataset.gschritt) { var gi = (S.grp || []).indexOf(S.sel) + (+t.dataset.gschritt); if (S.grp && S.grp[gi]) { S.sel = S.grp[gi]; render(); } return; }
  if (t.dataset.bsp) { openBeispiel(t.dataset.bsp, t); return; }
  if (t.dataset.toggle) { S.open[t.dataset.toggle] = !isOpen(t.dataset.toggle); saveOpen(); render(); return; }
  if (t.dataset.editins) { editIns(t.dataset.editins); return; }
  if (t.dataset.vollbild) { vollAuf(t.dataset.vollbild); return; }
  if (t.dataset.unsel) { S.sel = null; S.grp = null; render(); return; }
  if (t.dataset.ins) { if (S.view === 'zeit' && S.sel === t.dataset.ins && !S.grp) { S.sel = null; render(); return; } S.grp = null; S.sel = t.dataset.ins; if (S.view === 'bahnen') S.view = 'zeit'; render(); return; }
  if (t.dataset.row && S.edit) { editRow(t.dataset.row); return; }
  if (t.dataset.tag) { openTag(t.dataset.tag, t); return; }
  if (t.dataset.frei) { openFrei(t.dataset.frei, t); return; }
  if (t.dataset.blk) { openBlk(t.dataset.blk, t); return; }
  if (t.dataset.feed) { openInsInfo(t.dataset.feed, t); return; }

  if (t.dataset.test) { openTest(t); return; }
  if (t.dataset.mmass) { S.mMass = t.dataset.mmass; render(); return; }
  if (t.dataset.mschieb) { S.z.tag = (S.z.tag || 0) + (+t.dataset.mschieb) * Math.max(7, Math.round(zTage() / 2)); render(); return; }
  if (t.dataset.mz) { openMZelle(t.dataset.mz, t); return; }
  if (t.dataset.mpi) { openMPlan(t.dataset.mpi, t); return; }
  if (t.dataset.zc != null) { openZiel(+t.dataset.zc, t); return; }
});
/* Zoom mit Strg/⌘ + Mausrad und zwei Fingern, Verschieben durch Ziehen mit der Maus (ab 1.3.0) */
function ankerBei(sc, clientX){
  var r = sc.getBoundingClientRect(), lw = S.view === 'zeit' ? labwPx() : 130;
  var px = +sc.dataset.px, von = +sc.dataset.von, sichtbar = sc.clientWidth - lw;
  var rel = Math.max(0, Math.min(sichtbar, clientX - r.left - lw));
  return { tag: von + (sc.scrollLeft + rel) / px, anteil: rel / Math.max(1, sichtbar) };
}
$('view').addEventListener('wheel', function(e){
  var sc = e.target.closest('.scroller[data-px]'); if (!sc || !(e.ctrlKey || e.metaKey)) return;
  e.preventDefault();
  var a = ankerBei(sc, e.clientX);
  zoomen(zTage() * Math.exp(e.deltaY * 0.004), a.tag, a.anteil);
}, { passive: false });
var zieh = { aktiv: false, bewegt: false };
$('view').addEventListener('pointerdown', function(e){
  var sc = e.target.closest('.scroller[data-px]');
  if (!sc || e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('.lab, .stickyl, .lane-lab')) return;
  zieh = { aktiv: true, bewegt: false, x: e.clientX, links: sc.scrollLeft, sc: sc };
});
window.addEventListener('pointermove', function(e){
  if (!zieh.aktiv) return;
  var dx = e.clientX - zieh.x;
  if (Math.abs(dx) > 4) { zieh.bewegt = true; root.classList.add('lp-zieht'); }
  if (zieh.bewegt) zieh.sc.scrollLeft = zieh.links - dx;
});
window.addEventListener('pointerup', function(){ if (zieh.aktiv) { zieh.aktiv = false; root.classList.remove('lp-zieht'); } });
var pinch = null, pinchRaf = 0;
function abstand(t){ var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY; return Math.sqrt(dx * dx + dy * dy); }
$('view').addEventListener('touchstart', function(e){
  var sc = e.target.closest('.scroller[data-px]'); if (!sc || e.touches.length !== 2) return;
  var a = ankerBei(sc, (e.touches[0].clientX + e.touches[1].clientX) / 2);
  pinch = { d: abstand(e.touches), tage: zTage(), tag: a.tag, anteil: a.anteil };
}, { passive: true });
$('view').addEventListener('touchmove', function(e){
  if (!pinch || e.touches.length !== 2) return;
  e.preventDefault();
  var neu = pinch.tage * pinch.d / Math.max(10, abstand(e.touches));
  cancelAnimationFrame(pinchRaf);
  pinchRaf = requestAnimationFrame(function(){ zoomen(neu, pinch.tag, pinch.anteil); });
}, { passive: false });
$('view').addEventListener('touchend', function(e){ if (e.touches.length < 2) pinch = null; });
$('view').addEventListener('gesturestart', function(e){ if (e.target.closest('.scroller[data-px]')) e.preventDefault(); });
// Breite geändert (Drehen, Seitenleiste, Lernplan erst später sichtbar): neu zeichnen, damit Zoom und Stelle stimmen
if (typeof ResizeObserver === 'function') new ResizeObserver(function(){ var w = $('view').clientWidth; if (w && Math.abs(w - (S.breite || 0)) > 2 && S.meta && S.bereit) render(); }).observe($('view'));
document.addEventListener('keydown', function(e){
  if (e.key !== 'Escape' || !root.isConnected) return;
  if ($('dlg').innerHTML) { closeDlg(); return; }
  if (S.voll) vollZu();
});
$('farbe').addEventListener('click', function(e){
  var b = e.target.closest('button[data-farbe]'); if (!b) return;
  S.farbe = b.dataset.farbe; try { localStorage.setItem(FKEY, S.farbe); } catch(err) {}
  render();
});
$('voll').addEventListener('click', function(e){
  var t = e.target.closest('button'); if (!t) return;
  if (t.dataset.vzu) { vollZu(); return; }
  if (t.dataset.vtend) { S.voll.tend = !S.voll.tend; renderVoll(); return; }
  if (t.dataset.vnav) { var l = vollListe(), i = l.findIndex(function(x){ return x._id === S.voll.id; }) + (+t.dataset.vnav); if (l[i]) { S.voll.id = l[i]._id; renderVoll(); } return; }
  if (t.dataset.vgehe) { S.voll = { id: t.dataset.vgehe, thema: null, tend: false }; renderVoll(); return; }
  if (t.dataset.vthema != null) {
    var th = t.dataset.vthema || null; S.voll.thema = th; S.voll.tend = false;
    if (th) { var le = letzteEinschaetzung(th), l2 = vollListe(); if (!l2.some(function(x){ return x._id === S.voll.id; })) S.voll.id = le ? le.e._id : (l2[l2.length - 1] || {})._id; if (!S.voll.id) S.voll.thema = null; }
    renderVoll(); return;
  }
});
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
/* ---------- Trend je Aufgabenart (ab 1.9.0, Auftrag 39) ----------
   Eine Karte je Lernplan-Zeile aus meta.trend.reihenfolge: Balken = Anzahl je Abschnitt (App-Ergebnisse, Bogen-Teilaufgaben),
   Linie = Wert 0–100 nach meta.trend.wertung. Quelle der Zahlen: rows.<id>.ergebnisse / bogen_erg / schritte (Lernplan-Seite)
   oder von außen gerechnet (Eltern-App, aus Tagesdateien und Bogen-Feedback). */
var Trend = (function(){
var esc = esc0;
var APP = [['erst', '1. Versuch'], ['zweit', '2. Versuch'], ['teil', 'Teil-Lösung'], ['loesung', 'Lösung gezeigt']];
var BOG = [['klappt', 'klappt'], ['hilfe', 'mit Hilfe'], ['nv', 'nicht verstanden'], ['aus', 'ausgelassen']];
var NIV = ['keine Kenntnisse', 'neu eingeführt', 'geht mit Hilfe', 'meist sicher', 'sicher in App und Bogen', 'sicher wie in der Abschlussarbeit'];
var WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
var STD = { quelle: 'zus', aufl: 'tag', zeit: '14', sort: 'plan' };
var SCHRITT_NAME = { V: 'V (Volumen)', A_O: 'A_O (Oberfläche)', A_M: 'A_M (Mantel)', A_G: 'A_G (Grundfläche)', mal: 'mal', geteilt: 'geteilt' };
function dn(s){ if (!s) return NaN; var a = String(s).split('-'); return Date.UTC(+a[0], +a[1]-1, +a[2]) / 864e5; }
function iso(n){ return new Date(n * 864e5).toISOString().slice(0, 10); }
function kurz(n){ var d = new Date(n * 864e5); return d.getUTCDate() + '.' + (d.getUTCMonth() + 1) + '.'; }
function wtag(n){ return WT[new Date(n * 864e5).getUTCDay()]; }
function heute(){ try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date()); } catch(e) { return new Date().toISOString().slice(0, 10); } }
function summe(a){ return a[0] + a[1] + a[2] + a[3]; }

// Schritt-Klasse aus dem Text eines Schritts (versuch.label, sonst die Rechnung der Aufgabe). null = zählt nicht.
function schrittKlasse(thema, label){
  var l = String(label || '').trim();
  if (thema === 'einmaleins') return l.indexOf(':') >= 0 ? 'geteilt' : (/[·×]/.test(l) ? 'mal' : null);
  if (['zylinder', 'kegel', 'pyramide', 'kugel'].indexOf(thema) < 0) return null;
  if (/^Runde/.test(l)) return 'Runden';
  if (l.indexOf('gesucht') >= 0) return 'Was ist gesucht?';
  if (/^Welche/.test(l)) return 'Welche Höhe?';
  if (l.indexOf('A_G') >= 0) return 'A_G';
  if (l.indexOf('A_M') >= 0 || l.indexOf('Mantel') >= 0) return 'A_M';
  if (l.indexOf('A_O') >= 0) return 'A_O';
  if (/^V\b/.test(l)) return 'V';
  return null;
}

// Kenntnisstand heute; Lerneinheit mit Etappen (Gruppe): niedrigste Stufe der Zeilen darin
function niveauVon(r, rows, n, tiefe){
  if (!r || (tiefe || 0) > 6) return null;
  if (r.group) {
    var w = rows.filter(function(c){ return c.parent === r._id; }).map(function(c){ return niveauVon(c, rows, n, (tiefe || 0) + 1); }).filter(function(v){ return v != null; });
    return w.length ? Math.min.apply(null, w) : null;
  }
  var v = null;
  (Array.isArray(r.niveau) ? r.niveau : []).slice().sort(function(a, b){ return dn(a[0]) - dn(b[0]); }).forEach(function(x){ if (x && dn(x[0]) <= n && x[1] >= 0 && x[1] <= 5) v = x[1]; });
  return v;
}

/* Modell aus meta und rows (Liste mit _id). live (Eltern-App): { app, bogen, notizen, schritte } je Zeile, ersetzt die Felder aus rows.
   Ergebnis: { ab, ende, wertung, reihen: [{ id, name, niveau, gruppe, app {tag: [erst, zweit, teil, loesung]}, bogen {tag: [klappt, hilfe, nv, aus]}, notizen {tag: [..]}, schritte {k: {tag: [erst, später, Lösung]}} }] }
   null, wenn es kein meta.trend oder keine Daten gibt. */
function modell(meta, rows, live){
  var t = meta && meta.trend;
  if (!t || !Array.isArray(t.reihenfolge) || !t.reihenfolge.length) return null;
  rows = rows || [];
  var byId = {}; rows.forEach(function(r){ byId[r._id] = r; });
  var w = t.wertung || {}, h = dn(heute()), ende = null, start = null;
  function tag(d){ var n = dn(d); if (isNaN(n) || n > h) return null; if (ende == null || n > ende) ende = n; if (start == null || n < start) start = n; return d; }
  function karte(liste, laenge){ var o = {}; (Array.isArray(liste) ? liste : []).forEach(function(v){ if (!v || !tag(v[0])) return; var a = o[v[0]] || (o[v[0]] = [0, 0, 0, 0].slice(0, laenge)); for (var i = 0; i < laenge; i++) a[i] += +v[i + 1] || 0; }); return o; }
  function karteLive(o, laenge){ var x = {}; Object.keys(o || {}).forEach(function(d){ if (tag(d)) x[d] = o[d].slice(0, laenge); }); return x; }
  var reihen = t.reihenfolge.map(function(id){
    var r = byId[id];
    if (!r && !live) return null;
    var x = { id: id, name: String((r && r.label) || id).split(' · ')[0], niveau: niveauVon(r, rows, h), gruppe: !!(r && r.group), app: {}, bogen: {}, notizen: {}, schritte: {} };
    if (live) {
      x.app = karteLive(live.app && live.app[id], 4); x.bogen = karteLive(live.bogen && live.bogen[id], 4);
      x.notizen = (live.notizen && live.notizen[id]) || {};
      var sl = (live.schritte && live.schritte[id]) || {};
      Object.keys(sl).forEach(function(k){ x.schritte[k] = karteLive(sl[k], 3); });
    } else {
      x.app = karte(r.ergebnisse, 4); x.bogen = karte(r.bogen_erg, 4);
      var s = r.schritte && typeof r.schritte === 'object' ? r.schritte : {};
      Object.keys(s).forEach(function(k){ x.schritte[k] = karte(s[k], 3); });
    }
    return x;
  }).filter(Boolean);
  if (ende == null) return null;
  return {
    ab: !isNaN(dn(t.ab)) ? Math.min(dn(t.ab), start) : start, ende: ende,
    wertung: { app: Object.assign({ erst: 100, zweit: 60, teil: 50, loesung: 0 }, w.app || {}), bogen: Object.assign({ klappt: 100, hilfe: 50, nv: 0 }, w.bogen || {}) },
    reihen: reihen, notizen: !!live
  };
}

/* Ansicht in ein Element zeichnen. opt.speicher: Schlüssel für die Auswahl (je Gerät). Rückgabe { render(modell), springe(id) }. */
function ansicht(el, opt){
  opt = opt || {};
  var KEY = opt.speicher || 'lp-trend';
  var st = Object.assign({}, STD, { ver: 0, erkl: null, offen: {} });
  try { var g = JSON.parse(localStorage.getItem(KEY) || '{}'); ['quelle', 'aufl', 'zeit', 'sort'].forEach(function(k){ if (g[k]) st[k] = g[k]; }); } catch(e) {}
  var M = null, ziel = null, tip = null, breiteAlt = 0;
  function merken(){ try { localStorage.setItem(KEY, JSON.stringify({ quelle: st.quelle, aufl: st.aufl, zeit: st.zeit, sort: st.sort })); } catch(e) {} }

  function fenster(){
    var bis = M.ende, von;
    if (st.zeit === 'alle') { von = M.ab; st.ver = 0; }
    else { var L = +st.zeit || 14; bis = M.ende - st.ver * 7; von = Math.max(M.ab, bis - L + 1); } // nicht vor den ersten Daten
    return { von: von, bis: bis };
  }
  function tageListe(f){ var o = []; for (var n = f.von; n <= f.bis; n++) o.push(n); return o; }
  function abschnitte(t){
    if (st.aufl === 'tag' || st.aufl === 'g7') return t.map(function(n){ return { tage: [n], label: kurz(n), wt: wtag(n) }; });
    var a = [];
    if (st.aufl === '3') { for (var i = t.length; i > 0; i -= 3) { var gg = t.slice(Math.max(0, i - 3), i); a.unshift({ tage: gg, label: kurz(gg[0]) + '–' + kurz(gg[gg.length - 1]) }); } return a; }
    var cur = null;
    t.forEach(function(n){ var wd = (new Date(n * 864e5).getUTCDay() + 6) % 7; if (!cur || wd === 0) { cur = { tage: [] }; a.push(cur); } cur.tage.push(n); });
    a.forEach(function(x){ x.label = kurz(x.tage[0]) + '–' + kurz(x.tage[x.tage.length - 1]); });
    return a;
  }
  function sammle(r, tage){
    var a = [0, 0, 0, 0], b = [0, 0, 0, 0], no = [];
    tage.forEach(function(n){ var d = iso(n), x = r.app[d], y = r.bogen[d], z = r.notizen[d];
      if (x) for (var i = 0; i < 4; i++) a[i] += x[i] || 0;
      if (y) for (var j = 0; j < 4; j++) b[j] += y[j] || 0;
      if (z) no.push.apply(no, z); });
    return { a: a, b: b, no: no };
  }
  function wert(x, q){
    var W = M.wertung, s = 0, n = 0;
    if (q !== 'bogen') APP.forEach(function(k, i){ s += (+W.app[k[0]] || 0) * x.a[i]; n += x.a[i]; });
    if (q !== 'app') ['klappt', 'hilfe', 'nv'].forEach(function(k, i){ s += (+W.bogen[k] || 0) * x.b[i]; n += x.b[i]; });
    return { w: n ? s / n : null, n: n };
  }
  function pfeil(p, q, min){
    if (p.n < min || q.n < min) return null;
    var d = q.w - p.w; return { dir: d >= 8 ? 'auf' : d <= -8 ? 'ab' : 'gleich', d: d };
  }
  function pfeilHtml(p, titel){
    if (!p) return '';
    return '<span class="tr-pfeil ' + p.dir + '"' + (titel ? ' title="' + esc(titel) + '"' : '') + '>' + (p.dir === 'auf' ? '↗' : p.dir === 'ab' ? '↘' : '→') + ' ' + (p.d > 0 ? '+' : p.d < 0 ? '−' : '') + Math.abs(Math.round(p.d)) + '</span>';
  }
  function trend(r, t){
    var hh = Math.floor(t.length / 2);
    var p = wert(sammle(r, t.slice(0, hh)), st.quelle), q = wert(sammle(r, t.slice(hh)), st.quelle);
    return { ges: wert(sammle(r, t), st.quelle), dir: pfeil(p, q, 8) };
  }
  function reihe(r, ab){
    return ab.map(function(g){
      var x = sammle(r, g.tage);
      var l = st.aufl === 'g7' ? sammle(r, [0, 1, 2, 3, 4, 5, 6].map(function(i){ return g.tage[0] - i; })) : x;
      return { g: g, a: x.a, b: x.b, lw: wert(l, st.quelle), la: wert(l, 'app'), lb: wert(l, 'bogen') };
    });
  }

  function chart(r, ab, W){
    var R = reihe(r, ab), H = 150, L = 30, Rr = 34, T = 10, B = 24, ih = H - T - B, iw = W - L - Rr, n = R.length, bw = iw / n;
    var zA = st.quelle !== 'bogen', zB = st.quelle !== 'app';
    var max = 1; R.forEach(function(x){ max = Math.max(max, zA ? summe(x.a) : 0, zB ? summe(x.b) : 0); });
    max = Math.ceil(max / 5) * 5;
    function yC(v){ return T + ih - v / max * ih; } function yW(v){ return T + ih - v / 100 * ih; }
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(r.name) + ': Balken Anzahl, Linie Wert">';
    [0, 50, 100].forEach(function(v){ s += '<line class="tr-gitter" x1="' + L + '" x2="' + (W - Rr) + '" y1="' + yW(v) + '" y2="' + yW(v) + '"' + (v === 50 ? ' stroke-dasharray="3 3"' : '') + '/><text x="' + (W - Rr + 6) + '" y="' + (yW(v) + 4) + '">' + v + '</text>'; });
    s += '<text x="' + (L - 6) + '" y="' + (yC(max) + 4) + '" text-anchor="end">' + max + '</text><text x="' + (L - 6) + '" y="' + (yC(0) + 4) + '" text-anchor="end">0</text>';
    var beide = zA && zB, gap = Math.min(4, bw * .12), slot = (bw - gap * 2) / (beide ? 2 : 1), barW = Math.max(2, Math.min(slot - 2, 26));
    R.forEach(function(x, i){
      var x0 = L + i * bw + gap;
      function stapel(px, teile){ var y = T + ih; teile.forEach(function(p){ if (!p[0]) return; var hh = p[0] / max * ih; y -= hh; s += '<rect class="' + p[1] + '" x="' + px.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + hh.toFixed(1) + '" rx="1.5"/>'; }); }
      var xi = x0 + (slot - barW) / 2;
      if (zA) { stapel(xi, [[x.a[0], 'tr-erst'], [x.a[1], 'tr-zweit'], [x.a[2], 'tr-teil'], [x.a[3], 'tr-loes']]); xi += slot; }
      if (zB) stapel(xi, [[x.b[0], 'tr-klappt'], [x.b[1], 'tr-hilfe'], [x.b[2], 'tr-nv'], [x.b[3], 'tr-aus']]);
      // Beschriftung: so viele wie Platz haben (je Abschnitt der erste Tag)
      var schritt = Math.max(1, Math.ceil(40 / bw)), lab = (n - 1 - i) % schritt === 0 ? x.g.label.split('–')[0] : '';
      if (lab) s += '<text x="' + (L + i * bw + bw / 2).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + lab + '</text>';
    });
    function linie(key, cls, gestr, breit){
      var pts = R.map(function(x, i){ return [L + i * bw + bw / 2, x[key].w, x[key].n]; }).filter(function(p){ return p[1] != null; });
      if (!pts.length) return;
      var d = pts.map(function(p, i){ return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + yW(p[1]).toFixed(1); }).join(' ');
      if (!gestr) s += '<path class="tr-halo" d="' + d + '" stroke-width="' + (breit + 3) + '"/>';
      s += '<path class="' + cls + '" d="' + d + '" stroke-width="' + breit + '"' + (gestr ? ' stroke-dasharray="5 4"' : '') + '/>';
      if (!gestr) pts.forEach(function(p){ var kl = p[2] < 5; s += '<circle class="tr-punkt' + (kl ? ' klein' : '') + '" cx="' + p[0].toFixed(1) + '" cy="' + yW(p[1]).toFixed(1) + '" r="' + (kl ? 2.8 : 4.2) + '"/>'; });
    }
    if (st.quelle === 'zus') { linie('la', 'tr-l-app', true, 1.8); linie('lb', 'tr-l-bogen', true, 1.8); }
    linie('lw', 'tr-l', false, 2.4);
    R.forEach(function(x, i){ s += '<rect class="tr-hit" x="' + (L + i * bw).toFixed(1) + '" y="' + T + '" width="' + bw.toFixed(1) + '" height="' + ih + '" data-r="' + esc(r.id) + '" data-i="' + i + '"/>'; });
    return { svg: s + '</svg>', R: R };
  }
  function tipHtml(x){
    function zeile(c, t, v){ return '<div class="tr-tz"><i class="tr-sw ' + c + '"></i>' + t + '<span>' + v + '</span></div>'; }
    var zA = st.quelle !== 'bogen', zB = st.quelle !== 'app', na = summe(x.a), nb = summe(x.b);
    var t = '<b>' + (x.g.wt ? x.g.wt + ' ' : '') + esc(x.g.label) + '</b>';
    if (zA) { t += '<div class="tr-th">App · ' + na + (na === 1 ? ' Aufgabe' : ' Aufgaben') + '</div>'; if (na) t += zeile('tr-erst', '1. Versuch', x.a[0]) + zeile('tr-zweit', '2. Versuch', x.a[1]) + zeile('tr-teil', 'Teil-Lösung', x.a[2]) + zeile('tr-loes', 'Lösung gezeigt', x.a[3]); }
    if (zB) { t += '<div class="tr-th">Bogen · ' + nb + (nb === 1 ? ' Teilaufgabe' : ' Teilaufgaben') + '</div>'; if (nb) t += zeile('tr-klappt', 'klappt', x.b[0]) + zeile('tr-hilfe', 'mit Hilfe', x.b[1]) + zeile('tr-nv', 'nicht verstanden', x.b[2]) + (x.b[3] ? zeile('tr-aus', 'ausgelassen', x.b[3]) : ''); }
    t += '<div class="tr-th">Linie' + (st.aufl === 'g7' ? ' (letzte 7 Tage)' : '') + '</div>';
    t += x.lw.w == null ? '<div class="tr-tz">kein Wert</div>' : '<div class="tr-tz"><i class="tr-lsw"></i>Wert<span><b>' + Math.round(x.lw.w) + '</b></span></div>';
    if (st.quelle === 'zus') { if (x.la.w != null) t += '<div class="tr-tz"><i class="tr-lsw app"></i>nur App<span>' + Math.round(x.la.w) + '</span></div>'; if (x.lb.w != null) t += '<div class="tr-tz"><i class="tr-lsw bogen"></i>nur Bogen<span>' + Math.round(x.lb.w) + '</span></div>'; }
    return t;
  }
  function legende(){
    function it(c, t){ return '<span><i class="tr-sw ' + c + '"></i>' + t + '</span>'; }
    var h = '<div class="tr-leg">';
    if (st.quelle !== 'bogen') h += '<span class="tr-lt">' + (st.quelle === 'zus' ? 'linker Balken App:' : 'App:') + '</span>' + it('tr-erst', '1. Versuch') + it('tr-zweit', '2. Versuch') + it('tr-teil', 'Teil-Lösung') + it('tr-loes', 'Lösung');
    if (st.quelle === 'zus') h += '<span class="tr-trenn"></span>';
    if (st.quelle !== 'app') h += '<span class="tr-lt">' + (st.quelle === 'zus' ? 'rechter Balken Bogen:' : 'Bogen:') + '</span>' + it('tr-klappt', 'klappt') + it('tr-hilfe', 'mit Hilfe') + it('tr-nv', 'nicht verstanden');
    h += '<span class="tr-trenn"></span><span><i class="tr-lsw"></i>Wert</span>';
    if (st.quelle === 'zus') h += '<span><i class="tr-lsw app"></i>App</span><span><i class="tr-lsw bogen"></i>Bogen</span>';
    return h + '</div>';
  }
  function schritteHtml(r, t){
    var W = M.wertung.app, hh = Math.floor(t.length / 2);
    function sum(o, tage){ var c = [0, 0, 0]; tage.forEach(function(n){ var x = o[iso(n)]; if (x) for (var i = 0; i < 3; i++) c[i] += x[i] || 0; }); var n = c[0] + c[1] + c[2]; return { c: c, n: n, w: n ? (c[0] * (+W.erst || 0) + c[1] * (+W.zweit || 0) + c[2] * (+W.loesung || 0)) / n : null }; }
    var items = Object.keys(r.schritte).map(function(k){ var o = r.schritte[k]; return { k: k, all: sum(o, t), a: sum(o, t.slice(0, hh)), b: sum(o, t.slice(hh)) }; })
      .filter(function(x){ return x.all.n > 0; }).sort(function(x, y){ return x.all.w - y.all.w; });
    if (!items.length) return '';
    return '<div class="tr-mini">Je Schritt (App): 1. Versuch ' + (+W.erst || 0) + ', später richtig ' + (+W.zweit || 0) + ', Lösung bei diesem Schritt ' + (+W.loesung || 0) + '</div><div class="tr-unter">' + items.map(function(x){
      var p = (x.a.n >= 5 && x.b.n >= 5) ? pfeil(x.a, x.b, 5) : null;
      return '<div class="tr-u"><div><b>' + esc(SCHRITT_NAME[x.k] || x.k) + '</b><span><b>' + Math.round(x.all.w) + '</b> ' + pfeilHtml(p) + '</span></div><div class="tr-mini">' + x.all.n + ' Schritte · ' + x.all.c[0] + ' / ' + x.all.c[1] + ' / ' + x.all.c[2] + '</div></div>';
    }).join('') + '</div>';
  }
  function seg(k, werte, label){
    return '<div class="tr-gruppe"><span>' + label + '</span><div class="seg klein" role="group" aria-label="' + label + '">' + werte.map(function(v){ return '<button type="button" data-tr-k="' + k + '" data-tr-v="' + v[0] + '" aria-pressed="' + (st[k] === v[0]) + '">' + v[1] + '</button>'; }).join('') + '</div></div>';
  }

  function render(m){
    if (m !== undefined) M = m;
    verstecke();
    if (!M) { el.innerHTML = '<div class="card empty">Für den Trend gibt es noch keine Daten.</div>'; return; }
    var f = fenster(), t = tageListe(f), ab = abschnitte(t);
    var breite = Math.max(300, Math.round((el.clientWidth || 640) - 30));
    breiteAlt = el.clientWidth;
    var rows = M.reihen.map(function(r){ return { r: r, t: trend(r, t) }; }).filter(function(x){ return x.t.ges.n > 0; });
    if (st.sort === 'schwach') rows.sort(function(a, b){ return a.t.ges.w - b.t.ges.w; });
    if (st.sort === 'ab') rows.sort(function(a, b){ return (a.t.dir ? a.t.dir.d : 99) - (b.t.dir ? b.t.dir.d : 99); });
    var fehlt = M.reihen.filter(function(r){ return !rows.some(function(x){ return x.r === r; }); }).map(function(r){ return r.name; });
    var schmal = (el.clientWidth || 640) < 640;
    var erklAuf = st.erkl == null ? !schmal : st.erkl;
    var h = '<div class="tr">';
    h += '<div class="tr-leiste card">' + seg('quelle', [['app', 'App'], ['bogen', 'Bogen'], ['zus', 'Zusammen']], 'Quelle') +
      seg('aufl', [['tag', 'Tag'], ['3', '3 Tage'], ['woche', 'Woche'], ['g7', 'gleitend 7 Tage']], 'Auflösung') +
      seg('zeit', [['14', '2 Wochen'], ['28', '4 Wochen'], ['alle', 'alles']], 'Zeitraum') +
      seg('sort', [['plan', 'Lernplan'], ['schwach', 'schwächste'], ['ab', 'fallend zuerst']], 'Sortierung') + '</div>';
    h += '<div class="tr-zeitraum">' + (st.zeit === 'alle' ? '' : '<button type="button" class="btn ghost" data-tr-schieb="1" aria-label="Früher"' + (f.von <= M.ab ? ' disabled' : '') + '>‹</button>') +
      '<span><b>' + kurz(f.von) + ' bis ' + kurz(f.bis) + '</b>' + (st.aufl === 'woche' ? ' · je Woche (Mo–So)' : st.aufl === '3' ? ' · je 3 Tage' : st.aufl === 'g7' ? ' · Linie gleitend über 7 Tage' : ' · je Tag') + '</span>' +
      (st.zeit === 'alle' ? '' : '<button type="button" class="btn ghost" data-tr-schieb="-1" aria-label="Später"' + (st.ver <= 0 ? ' disabled' : '') + '>›</button>') + '</div>';
    h += '<p class="tr-kurz"><b>Ø 57</b> = Durchschnitt aller Aufgaben im Zeitraum (100 = alles im 1. Versuch allein) · <b class="auf">↗ +19</b> = 2. Hälfte des Zeitraums gegen die 1. Hälfte</p>';
    var W = M.wertung;
    h += '<details class="tr-erkl card"' + (erklAuf ? ' open' : '') + '><summary>So lesen und so wird gerechnet</summary><div class="tr-spalten">' +
      '<div><h3>Balken App (Anzahl Aufgaben)</h3><ul>' + APP.map(function(k){ return '<li><i class="tr-sw tr-' + (k[0] === 'loesung' ? 'loes' : k[0]) + '"></i>' + (k[0] === 'zweit' ? '2. Versuch, auch „gleiche Aufgabe“' : k[0] === 'teil' ? 'Teil-Lösung (= mit Hilfe)' : k[1]) + '<b>' + (+W.app[k[0]] || 0) + '</b></li>'; }).join('') + '</ul></div>' +
      '<div><h3>Balken Bogen (Anzahl Teilaufgaben)</h3><ul><li><i class="tr-sw tr-klappt"></i>klappt (auch ohne Eintrag)<b>' + (+W.bogen.klappt || 0) + '</b></li><li><i class="tr-sw tr-hilfe"></i>mit Hilfe<b>' + (+W.bogen.hilfe || 0) + '</b></li><li><i class="tr-sw tr-nv"></i>nicht verstanden<b>' + (+W.bogen.nv || 0) + '</b></li><li><i class="tr-sw tr-aus"></i>ausgelassen<b>zählt nicht</b></li></ul></div>' +
      '<div><h3>Linie (Wert 0–100, rechte Achse)</h3><ul><li><i class="tr-lsw"></i>Wert der gewählten Quelle</li><li><i class="tr-lsw app"></i>nur App (bei „Zusammen“)</li><li><i class="tr-lsw bogen"></i>nur Bogen (bei „Zusammen“)</li></ul><p>Kleiner, blasser Punkt: weniger als 5 Aufgaben im Abschnitt.</p></div>' +
      '<div><h3>Rechnung</h3><p><b>Wert</b> = Mittel der Punkte aller Aufgaben im Abschnitt.</p><p><b>Zusammen:</b> Eine Teilaufgabe auf dem Bogen zählt so viel wie eine App-Aufgabe. Eine Bogen-Übung mit zwei Themen zählt bei beiden.</p><p><b>Pfeil:</b> zweite Hälfte des Zeitraums gegen die erste. Ab 8 Punkten Unterschied ↗ oder ↘, nur wenn beide Hälften mindestens 8 Aufgaben haben.</p><p><b>Teil-Lösung</b> wird für alte Tage (ab 17.10.) aus den Daten abgeleitet, wie in der Eltern-App.</p></div>' +
      '</div></details>';
    h += '<div class="tr-liste">';
    var charts = {};
    rows.forEach(function(x){
      var r = x.r, tt = x.t, nv = r.niveau;
      var p = tt.dir ? pfeilHtml(tt.dir, '2. Hälfte gegen 1. Hälfte') : '<span class="tr-mini">zu wenig für Pfeil</span>';
      var stand = nv == null ? '' : '<span class="tr-stand n' + nv + '" title="Kenntnisstand im Lernplan' + (r.gruppe ? ' (niedrigste Etappe)' : '') + '">Stand ' + nv + ' · ' + esc(NIV[nv]) + '</span>';
      var bn = Object.keys(r.bogen).length;
      var s = sammle(r, t), notes = st.quelle !== 'app' ? s.no : [];
      var sh = st.quelle !== 'bogen' ? schritteHtml(r, t) : '';
      var c = chart(r, ab, breite); charts[r.id] = c.R;
      h += '<article class="tr-karte card' + (ziel === r.id ? ' tr-ziel' : '') + '" id="tr-' + esc(r.id) + '"><div class="tr-kopf"><h2>' + esc(r.name) + '</h2>' + stand +
        '<div class="tr-wert" title="Mittel der Punkte im ganzen Zeitraum; Pfeil = 2. Hälfte gegen 1. Hälfte"><span class="tr-mini">' + tt.ges.n + ' ' + (st.quelle === 'bogen' ? 'Teilaufg.' : st.quelle === 'zus' ? 'Aufg. + Teilaufg.' : 'Aufg.') + '</span><strong>Ø ' + (tt.ges.w == null ? '–' : Math.round(tt.ges.w)) + '</strong>' + p + '</div></div>' +
        '<div class="tr-chart">' + c.svg + '</div>' + legende() +
        (st.quelle !== 'app' && !bn ? '<div class="tr-mini">Noch keine Bogen-Rückmeldung zu diesem Thema.</div>' : '') +
        (sh || notes.length ? '<details class="tr-details" data-tr-row="' + esc(r.id) + '"' + (st.offen[r.id] ? ' open' : '') + '><summary>Einzelheiten' + (sh ? ' · je Schritt' : '') + (notes.length ? ' · Bogen-Notizen (' + notes.length + ')' : '') + '</summary>' + sh +
          (notes.length ? '<ul class="tr-notizen">' + notes.map(function(n){ return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>' : '') + '</details>' : '') +
        '</article>';
    });
    if (!rows.length) h += '<div class="card empty">Im gewählten Zeitraum gibt es dazu keine Daten.</div>';
    h += '</div>' + (fehlt.length ? '<p class="tr-leer">Im Zeitraum nicht geübt: ' + esc(fehlt.join(', ')) + '.</p>' : '') + '<div class="tr-tip" hidden></div></div>';
    el.innerHTML = h;
    tip = el.querySelector('.tr-tip');
    // Ereignisse
    Array.prototype.forEach.call(el.querySelectorAll('[data-tr-k]'), function(b){ b.onclick = function(){ st[b.dataset.trK] = b.dataset.trV; if (b.dataset.trK === 'zeit') st.ver = 0; merken(); render(); }; });
    Array.prototype.forEach.call(el.querySelectorAll('[data-tr-schieb]'), function(b){ b.onclick = function(){ st.ver = Math.max(0, st.ver + (+b.dataset.trSchieb)); render(); }; });
    var er = el.querySelector('.tr-erkl'); if (er) er.addEventListener('toggle', function(){ st.erkl = er.open; });
    Array.prototype.forEach.call(el.querySelectorAll('.tr-details'), function(d){ d.addEventListener('toggle', function(){ st.offen[d.dataset.trRow] = d.open; }); });
    Array.prototype.forEach.call(el.querySelectorAll('.tr-hit'), function(hb){
      var x = charts[hb.dataset.r][+hb.dataset.i];
      function zeig(ev){ zeige(ev, tipHtml(x)); }
      hb.addEventListener('pointermove', zeig); hb.addEventListener('pointerdown', zeig); hb.addEventListener('pointerleave', function(ev){ if (ev.pointerType === 'mouse') verstecke(); });
    });
    if (ziel) { var z = el.querySelector('#tr-' + ziel); ziel = null; if (z && z.scrollIntoView) setTimeout(function(){ z.scrollIntoView({ block: 'start' }); }, 0); }
    // Breite erst nach dem Einhängen bekannt (Eltern-App): dann noch einmal zeichnen
    if (!breiteAlt && typeof requestAnimationFrame === 'function') requestAnimationFrame(function(){ if (el.clientWidth && Math.abs(el.clientWidth - 30 - breite) > 8) render(); });
  }
  function zeige(ev, html){
    if (!tip) return;
    tip.innerHTML = html; tip.hidden = false;
    var r = tip.getBoundingClientRect(), x = ev.clientX + 12, y = ev.clientY + 12;
    if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - 12;
    if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - 12;
    tip.style.left = Math.max(8, x) + 'px'; tip.style.top = Math.max(8, y) + 'px';
  }
  function verstecke(){ if (tip) tip.hidden = true; }
  var rt;
  if (typeof addEventListener === 'function') {
    addEventListener('resize', function(){ clearTimeout(rt); rt = setTimeout(function(){ if (M && el.isConnected && el.querySelector('.tr') && Math.abs(el.clientWidth - breiteAlt) > 8) render(); }, 150); });
    addEventListener('scroll', verstecke, { passive: true, capture: true });
    document.addEventListener('pointerdown', function(e){ if (tip && !tip.hidden && !(e.target.closest && e.target.closest('.tr-hit'))) verstecke(); });
  }
  return { render: render, springe: function(id){ ziel = id; }, zustand: st };
}
return { modell: modell, ansicht: ansicht, schrittKlasse: schrittKlasse };
})();
return { VERSION: VERSION, erstellen: erstellen, ausExport: ausExport, nummernText: nummernTextAussen, trend: Trend };
})();

export { Lernplan };
export default Lernplan;
