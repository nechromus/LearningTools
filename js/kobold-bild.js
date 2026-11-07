// Der alte Kobold (Runengruft freischalten): Zeichnung auf einem Canvas. Fußpunkt bei (0, 0).
// Der alte Kobold: gebeugt, langer Bart, große Ohren mit Ring, Brille, Flickenumhang, Stab mit Jade-Laterne, Beutel
export function koboldMalen(c, t, groesse = 1, voll = false, ruhig = false) {
  const atem = ruhig ? 0 : Math.sin(t / 900) * 2;
  const blinzeln = !ruhig && (t % 4200) < 140;
  c.save(); c.scale(groesse, groesse);
  // Schatten
  c.fillStyle = 'rgba(0,0,0,0.5)'; c.beginPath(); c.ellipse(0, 0, 70, 12, 0, 0, 7); c.fill();
  // Stab
  c.strokeStyle = '#3a2a1a'; c.lineWidth = 7; c.lineCap = 'round';
  c.beginPath(); c.moveTo(58, 0); c.quadraticCurveTo(64, -90, 54, -176); c.stroke();
  c.strokeStyle = '#5a4128'; c.lineWidth = 2; c.beginPath(); c.moveTo(56, -10); c.quadraticCurveTo(62, -90, 52, -170); c.stroke();
  // Laterne: Käfig mit Kristall
  const fl = ruhig ? 1 : 1 + Math.sin(t / 110) * 0.08 + Math.sin(t / 47) * 0.05;
  c.save(); c.translate(54, -196);
  const halo = c.createRadialGradient(0, 0, 2, 0, 0, 90 * fl); halo.addColorStop(0, 'rgba(150,255,210,0.55)'); halo.addColorStop(1, 'rgba(0,0,0,0)');
  c.globalCompositeOperation = 'lighter'; c.fillStyle = halo; c.fillRect(-100, -100, 200, 200); c.globalCompositeOperation = 'source-over';
  c.strokeStyle = '#2c2a22'; c.lineWidth = 3; c.beginPath(); c.moveTo(-2, 22); c.lineTo(-2, 30); c.stroke();
  c.fillStyle = '#7ff2c6'; c.shadowColor = '#5FE8B4'; c.shadowBlur = 20 * fl;
  c.beginPath(); c.moveTo(0, -16); c.lineTo(8, -2); c.lineTo(4, 14); c.lineTo(-4, 14); c.lineTo(-8, -2); c.closePath(); c.fill(); c.shadowBlur = 0;
  c.strokeStyle = '#4e4a3a'; c.lineWidth = 2.5;
  for (const x of [-12, 0, 12]) { c.beginPath(); c.moveTo(x * 0.6, -22); c.quadraticCurveTo(x * 1.2, 0, x * 0.7, 20); c.stroke(); }
  c.beginPath(); c.ellipse(0, -22, 9, 3, 0, 0, 7); c.ellipse(0, 20, 11, 4, 0, 0, 7); c.stroke();
  c.restore();
  // Umhang (Flicken), gebeugter Körper
  c.save(); c.translate(0, atem * 0.3);
  const um = c.createLinearGradient(-60, -150, 50, 0); um.addColorStop(0, '#5a4636'); um.addColorStop(1, '#241b15');
  c.fillStyle = um;
  c.beginPath(); c.moveTo(-58, -2); c.quadraticCurveTo(-70, -80, -40, -128); c.quadraticCurveTo(-10, -150, 22, -132); c.quadraticCurveTo(46, -90, 46, -2);
  for (let i = 0; i < 7; i++) c.lineTo(46 - i * 15.5, i % 2 ? -10 : 0);
  c.closePath(); c.fill();
  c.fillStyle = '#5a4a32'; c.fillRect(-36, -70, 18, 16); c.fillStyle = '#3a4554'; c.fillRect(10, -46, 16, 14);
  c.strokeStyle = 'rgba(220,200,150,0.3)'; c.setLineDash([3, 3]); c.lineWidth = 1.5; c.strokeRect(-36, -70, 18, 16); c.strokeRect(10, -46, 16, 14); c.setLineDash([]);
  // Beutel mit Splittern
  c.save(); c.translate(-46, -40);
  c.fillStyle = '#6b5333'; c.beginPath(); c.ellipse(0, 0, 24, 28, -0.2, 0, 7); c.fill();
  c.strokeStyle = '#3a2a18'; c.lineWidth = 3; c.beginPath(); c.moveTo(-14, -22); c.quadraticCurveTo(0, -14, 14, -24); c.stroke();
  if (voll) { c.fillStyle = '#7ff2c6'; c.shadowColor = '#5FE8B4'; c.shadowBlur = 12; for (const [x, y] of [[-6, -26], [4, -30], [10, -24]]) { c.beginPath(); c.moveTo(x, y - 8); c.lineTo(x + 4, y); c.lineTo(x, y + 3); c.lineTo(x - 4, y); c.fill(); } c.shadowBlur = 0; }
  c.restore();
  // Arm zum Stab
  c.strokeStyle = '#3e3026'; c.lineWidth = 16; c.beginPath(); c.moveTo(14, -112); c.quadraticCurveTo(44, -112, 52, -132); c.stroke();
  c.fillStyle = '#a89580'; c.beginPath(); c.ellipse(54, -134, 9, 8, 0, 0, 7); c.fill();
  // Kopf
  c.save(); c.translate(-6, -150 + atem);
  // Ohren
  for (const s of [-1, 1]) {
    c.save(); c.scale(s, 1);
    c.fillStyle = '#a89580'; c.beginPath(); c.moveTo(20, -4); c.quadraticCurveTo(34, -30, 40, -52); c.quadraticCurveTo(42, -20, 26, 8); c.closePath(); c.fill();
    c.fillStyle = '#7d6a58'; c.beginPath(); c.moveTo(24, -4); c.quadraticCurveTo(33, -24, 37, -40); c.quadraticCurveTo(36, -16, 26, 4); c.fill();
    c.restore();
  }
  c.strokeStyle = '#D8B05A'; c.lineWidth = 2.5; c.beginPath(); c.arc(31, -16, 4, 0, 7); c.stroke();
  // Kapuze hinten
  c.fillStyle = '#4a2c22'; c.beginPath(); c.arc(0, -4, 34, Math.PI * 0.95, Math.PI * 2.05); c.fill();
  // Gesicht
  const hg = c.createRadialGradient(-6, -10, 4, 0, 0, 30); hg.addColorStop(0, '#c2ae96'); hg.addColorStop(1, '#7e6a58');
  c.fillStyle = hg; c.beginPath(); c.ellipse(0, 2, 26, 28, 0, 0, 7); c.fill();
  // Kapuze vorn
  const mz = c.createLinearGradient(-30, -90, 30, -20); mz.addColorStop(0, '#8a3f2c'); mz.addColorStop(1, '#4a2018');
  c.fillStyle = mz; c.beginPath(); c.moveTo(-30, -16); c.quadraticCurveTo(-26, -60, 8, -78); c.quadraticCurveTo(40, -96, 58, -70); c.quadraticCurveTo(36, -82, 22, -56); c.quadraticCurveTo(30, -36, 30, -16); c.quadraticCurveTo(0, -26, -30, -16); c.fill();
  c.fillStyle = '#c9a85a'; c.beginPath(); c.arc(58, -70, 5, 0, 7); c.fill();
  c.fillStyle = '#6a5a40'; c.beginPath(); c.moveTo(-32, -12); c.quadraticCurveTo(0, -26, 32, -12); c.lineTo(30, -20); c.quadraticCurveTo(0, -32, -30, -20); c.closePath(); c.fill();
  // Augenbrauen
  c.strokeStyle = '#e8e4d8'; c.lineWidth = 4; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-20, -10); c.quadraticCurveTo(-10, -18, -2, -12); c.moveTo(20, -10); c.quadraticCurveTo(10, -18, 2, -12); c.stroke();
  // Brille und Augen
  c.strokeStyle = '#c9a85a'; c.lineWidth = 2; c.beginPath(); c.arc(-10, -2, 8, 0, 7); c.arc(10, -2, 8, 0, 7); c.moveTo(-2, -2); c.lineTo(2, -2); c.stroke();
  if (blinzeln) { c.strokeStyle = '#1a1a12'; c.lineWidth = 2; c.beginPath(); c.moveTo(-14, -1); c.lineTo(-6, -1); c.moveTo(6, -1); c.lineTo(14, -1); c.stroke(); }
  else { c.fillStyle = '#f5f0c8'; c.beginPath(); c.arc(-10, -1, 3.4, 0, 7); c.arc(10, -1, 3.4, 0, 7); c.fill(); c.fillStyle = '#1a1a12'; c.beginPath(); c.arc(-9, -0.5, 1.8, 0, 7); c.arc(11, -0.5, 1.8, 0, 7); c.fill(); }
  c.fillStyle = 'rgba(160,255,220,0.35)'; c.beginPath(); c.arc(-7, -5, 2.5, 0, 7); c.arc(13, -5, 2.5, 0, 7); c.fill();
  // Nase
  c.fillStyle = '#a3866e'; c.beginPath(); c.moveTo(-3, 2); c.quadraticCurveTo(4, 8, 2, 20); c.quadraticCurveTo(-6, 22, -8, 16); c.quadraticCurveTo(-8, 8, -3, 2); c.fill();
  // Bart
  const wind = ruhig ? 0 : Math.sin(t / 700) * 3;
  const bg = c.createLinearGradient(0, 10, 0, 90); bg.addColorStop(0, '#ece8dc'); bg.addColorStop(1, '#a9a597');
  c.fillStyle = bg; c.beginPath(); c.moveTo(-20, 12); c.quadraticCurveTo(-24, 50, -4 + wind, 88); c.quadraticCurveTo(2 + wind, 76, 6 + wind * 0.6, 92); c.quadraticCurveTo(22, 50, 20, 12); c.quadraticCurveTo(0, 26, -20, 12); c.fill();
  c.strokeStyle = 'rgba(80,76,66,0.4)'; c.lineWidth = 1.5;
  for (const x of [-10, -3, 4, 11]) { c.beginPath(); c.moveTo(x, 20); c.quadraticCurveTo(x * 0.6 + wind * 0.5, 50, x * 0.3 + wind, 80); c.stroke(); }
  c.restore();
  c.restore();
  c.restore();
}
