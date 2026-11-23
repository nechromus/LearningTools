// „Alles neu laden“ (23.11., Wunsch Vater): Speicher der App leeren und neu starten.
// Löscht alle Offline-Speicher (Programmdateien, zwischengespeicherte Daten) und die übergebenen localStorage-Schlüssel.
// Fortschritt, Einrichtung und Schlüssel bleiben erhalten.
export async function allesNeuLaden(schluessel = []) {
  for (const k of schluessel) { try { localStorage.removeItem(k); } catch (e) { /* egal */ } }
  try { const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k))); } catch (e) { /* ohne Speicher */ }
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.update().catch(() => null)));
    }
  } catch (e) { /* egal */ }
  try { sessionStorage.removeItem('update-versuch'); } catch (e) { /* egal */ }
  location.reload();
}
