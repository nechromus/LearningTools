// Ablauf des Kassenbuchs mit dem Daten-Repo (Auftrag 59): eigene Buchungen hochladen, andere Quellen und Auszahlungen
// lesen, reservieren, „geteilt“ melden. Für die Lese-App gebaut; die Mathe-App hat denselben Ablauf noch in app.js
// (seit 2.51.0, wird beim nächsten Umbau hierher umgezogen).
//
// opt: { app, kasse () → Kassenbuch, cfg () → { repo, token }, ordner () → Name des Kinder-Ordners, geraet () → Geräte-Id,
//        heute () → { tag, sek } (heute mit dieser App verdient), protokoll (typ, daten), sichern () }
import * as U from './sync.js';
import * as K from './kasse.js';
import { neuerCode } from './bildschirm.js';

export function kasseAblauf(opt) {
  let hochLaeuft = null, resLaeuft = false, zuletztGelesen = 0;
  const status = { fehler: null };
  const ok = () => { const c = opt.cfg(); return !!(opt.kasse() && c && c.repo && c.token); };
  const pfadA = () => K.auszahlungsPfad(opt.ordner());

  async function hochladenJetzt() {
    const k = opt.kasse(), u = opt.cfg();
    if (!ok()) return false;
    if (k.n <= k.hochN) return true;
    const pfad = K.quellPfad(opt.ordner(), k.quelle);
    const server = await U.dateiLesen(u, pfad);
    if (!K.darfSchreiben(k, server)) {
      opt.protokoll('kasse_server_mehr', { server_n: server.n, lokal_n: k.n });
      Object.assign(k, { n: server.n, kum: Math.max(k.kum, server.kum || 0), kumA: Math.max(k.kumA, server.kumA || 0), kumMs: Math.max(k.kumMs, server.kumMs || 0) });
    }
    const nVorher = k.n;
    await U.dateiSchreiben(u, pfad, JSON.stringify(K.quellDatei(k, opt.geraet(), opt.heute())), `Konto ${k.quelle} ${k.n}`);
    k.hochN = Math.max(k.hochN, nVorher);
    opt.sichern();
    return k.n > k.hochN ? hochladenJetzt() : true;
  }
  function hochladen() {
    if (!hochLaeuft) hochLaeuft = hochladenJetzt().finally(() => { hochLaeuft = null; });
    return hochLaeuft;
  }
  // Auszahlungen und die anderen Quellen lesen; gibt { inhalt, sha } der Auszahlungen zurück
  async function lesen() {
    const k = opt.kasse(), u = opt.cfg();
    const a = await U.dateiMitSha(u, pfadA());
    const liste = await U.ordnerLesen(u, `daten/${opt.ordner()}/${K.ORDNER}`);
    const fremd = [];
    for (const f of liste) {
      if (f.type !== 'file' || !f.name.endsWith('.json') || f.name === 'auszahlungen.json' || f.name === `${k.quelle}.json`) continue;
      try { fremd.push(await U.dateiLesen(u, f.path)); } catch (e) { /* diese Quelle später */ }
    }
    K.serverStand(k, a.inhalt, fremd);
    zuletztGelesen = Date.now();
    return a;
  }
  async function reservieren() {
    if (!ok() || resLaeuft) return false;
    const k = opt.kasse(), u = opt.cfg();
    resLaeuft = true; status.fehler = null;
    try {
      await hochladen();
      for (let versuch = 0; versuch < 4; versuch++) {
        const a = await lesen();
        const code = (k.res && k.res.code) || neuerCode();
        const r = K.reservieren(a.inhalt, K.quellenStand(k, k.fremd), { res: k.res, code, app: opt.app, geraet: opt.geraet() });
        if (r.schonGeteilt) { k.res = null; continue; }
        if (!r.datei) break;
        if (await U.dateiSchreibenWenn(u, pfadA(), JSON.stringify(r.datei, null, 1), a.sha, `Bildschirmzeit ${r.eintrag.code}`)) {
          k.res = r.eintrag; k.bez = r.datei.bezahlt;
          opt.protokoll('kasse_reserviert', { code: r.eintrag.code, sekunden: r.eintrag.sek, mathe: r.eintrag.mathe, lesen: r.eintrag.lesen });
          break;
        }
      }
      return true;
    } catch (e) {
      status.fehler = e && e.status === 0 ? 'offline' : 'fehler';
      status.status = e && e.status;
      return false;
    } finally {
      resLaeuft = false;
      opt.sichern();
    }
  }
  async function melden() {
    const k = opt.kasse(), u = opt.cfg();
    if (!ok() || !k.melden.length) return;
    for (let versuch = 0; versuch < 4 && k.melden.length; versuch++) {
      const a = await U.dateiMitSha(u, pfadA());
      let d = a.inhalt;
      for (const c of k.melden) { const neu = K.alsGeteilt(d, c); if (neu) d = neu; }
      if (d === a.inhalt || await U.dateiSchreibenWenn(u, pfadA(), JSON.stringify(d, null, 1), a.sha, `Bildschirmzeit geteilt ${k.melden.join(', ')}`)) { k.melden = []; break; }
    }
    opt.sichern();
  }
  // Regelmäßig: hochladen, melden, andere Quellen höchstens alle 5 Min. (erzwingen: sofort) neu lesen
  async function sync(erzwingen = false) {
    if (!ok()) return;
    await hochladen();
    await melden();
    if (erzwingen || Date.now() - zuletztGelesen > 5 * 60 * 1000) { await lesen(); opt.sichern(); }
  }
  // Nach dem Teilen: Reservierung erledigt, Code merken und melden
  function geteilt() {
    const k = opt.kasse();
    const res = k && k.res;
    if (!res) return null;
    k.melden = [...k.melden, res.code];
    k.res = null;
    opt.sichern();
    melden().catch(() => {});
    return res;
  }
  return { hochladen, lesen, reservieren, melden, sync, geteilt, status, laeuft: () => resLaeuft };
}
