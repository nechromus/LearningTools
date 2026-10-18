// Steinschieber: Tipp im Hintergrund suchen, damit die Anzeige nicht hängt
import { wiederherstellen, loesen } from './steinschieber.js';

self.onmessage = (e) => {
  const { level, zuege } = e.data;
  const s = wiederherstellen(level, { zuege });
  self.postMessage(loesen(s, 400000));
};
