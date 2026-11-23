// Definisi Achievement & renderer karakter Owner SMARA KOPI untuk Flappy SMARA.
// Dipakai bersama oleh Canvas Game, Panel Achievement (preview), Share Card, dan API.

export const ACHIEVEMENTS = [
  {
    id: 'scarf',
    name: 'Syal Barista',
    title: 'Pemanasan Ngopi',
    description: 'Capai skor 10 poin untuk membuka Syal Barista berkibar.',
    minScore: 10,
    slot: 'Leher',
    accent: '#38bdf8',
  },
  {
    id: 'shades',
    name: 'Kacamata Kece',
    title: 'Anak Tongkrongan',
    description: 'Capai skor 25 poin untuk membuka Kacamata Hitam Kece.',
    minScore: 25,
    slot: 'Mata',
    accent: '#60a5fa',
  },
  {
    id: 'apron',
    name: 'Celemek Kopi',
    title: 'Barista Magang',
    description: 'Capai skor 45 poin untuk membuka Celemek Barista SMARA.',
    minScore: 45,
    slot: 'Badan',
    accent: '#c084fc',
  },
  {
    id: 'barista_cap',
    name: 'Topi Barista',
    title: 'Jagoan Seduh',
    description: 'Capai skor 70 poin untuk membuka Topi Barista eksklusif.',
    minScore: 70,
    slot: 'Kepala',
    accent: '#2dd4bf',
  },
  {
    id: 'crown',
    name: 'Mahkota Sultan',
    title: 'Sultan SMARA',
    description: 'Capai skor 100 poin untuk membuka Mahkota Sultan emas.',
    minScore: 100,
    slot: 'Atas Kepala',
    accent: '#fbbf24',
  },
  {
    id: 'wings_gold',
    name: 'Sayap Emas',
    title: 'Terbang Tinggi',
    description: 'Capai skor 150 poin untuk mengubah sayap burung jadi emas.',
    minScore: 150,
    slot: 'Sayap',
    accent: '#f59e0b',
  },
  {
    id: 'aura',
    name: 'Aura Api Biru',
    title: 'Legenda SMARA KOPI',
    description: 'Capai skor 200 poin untuk menyalakan Aura Api Biru menyala.',
    minScore: 200,
    slot: 'Aura',
    accent: '#7dd3fc',
  },
];

export const VALID_ACCESSORY_IDS = new Set(ACHIEVEMENTS.map((a) => a.id));

/**
 * Normalisasi daftar aksesoris dari array, string koma ("shades,crown"),
 * atau format lama ("none" / "crown") menjadi array ID unik yang valid.
 */
export function parseAccessories(raw) {
  if (!raw) return [];
  let list = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === 'none') return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) list = parsed;
      } catch {
        list = trimmed.split(',');
      }
    } else {
      list = trimmed.split(',');
    }
  }

  const seen = new Set();
  const result = [];
  for (const item of list) {
    const id = String(item || '').trim();
    if (VALID_ACCESSORY_IDS.has(id) && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}

export function serializeAccessories(raw) {
  return parseAccessories(raw).join(',');
}

export function getUnlockedAchievements(bestScore) {
  const scoreNum = Number(bestScore || 0);
  return ACHIEVEMENTS.filter((a) => scoreNum >= a.minScore);
}

/**
 * Gambar karakter Owner SMARA KOPI menunggangi burung lengkap dengan
 * SEMUA aksesoris yang sedang dipakai (mendukung tumpuk / stackable).
 */
export function drawOwnerOnBird(ctx, x, y, vy, wingAngle, equippedRaw, frame = 0, scale = 1) {
  const equipped = new Set(parseAccessories(equippedRaw));
  const hasAura = equipped.has('aura');
  const hasGoldWings = equipped.has('wings_gold');
  const hasScarf = equipped.has('scarf');
  const hasApron = equipped.has('apron');
  const hasShades = equipped.has('shades');
  const hasCap = equipped.has('barista_cap');
  const hasCrown = equipped.has('crown');

  ctx.save();
  ctx.translate(x, y);
  if (scale !== 1) ctx.scale(scale, scale);

  const tilt = Math.max(-0.42, Math.min(0.55, vy * 0.052));
  ctx.rotate(tilt);

  // ===== LAYER 1: AURA API BIRU (di belakang karakter) =====
  if (hasAura) {
    const pulse = 1 + Math.sin(frame * 0.16) * 0.08;
    const outerR = 38 * pulse;
    const grad = ctx.createRadialGradient(0, -3, 6, 0, -3, outerR);
    grad.addColorStop(0, 'rgba(125, 211, 252, 0.72)');
    grad.addColorStop(0.5, 'rgba(14, 165, 233, 0.38)');
    grad.addColorStop(1, 'rgba(14, 165, 233, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, -3, outerR, 0, Math.PI * 2);
    ctx.fill();

    // Lidah api kecil berputar di sekitar aura
    for (let i = 0; i < 6; i++) {
      const ang = frame * 0.08 + (i * Math.PI * 2) / 6;
      const fx = Math.cos(ang) * (27 + Math.sin(frame * 0.2 + i) * 3);
      const fy = -3 + Math.sin(ang) * (25 + Math.cos(frame * 0.2 + i) * 3);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(186, 230, 253, 0.9)' : 'rgba(56, 189, 248, 0.85)';
      ctx.beginPath();
      ctx.arc(fx, fy, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ===== LAYER 2: EKOR & BADAN BURUNG =====
  // Ekor burung
  ctx.fillStyle = hasGoldWings ? '#f59e0b' : '#0284c7';
  ctx.beginPath();
  ctx.moveTo(-17, 7);
  ctx.lineTo(-27, 2);
  ctx.lineTo(-24, 9);
  ctx.lineTo(-27, 14);
  ctx.lineTo(-16, 12);
  ctx.closePath();
  ctx.fill();

  // Badan burung
  const bodyGrad = ctx.createLinearGradient(0, -4, 0, 22);
  bodyGrad.addColorStop(0, '#38bdf8');
  bodyGrad.addColorStop(1, '#0284c7');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0, 9, 20, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e0f2fe';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Perut burung
  ctx.fillStyle = '#bae6fd';
  ctx.beginPath();
  ctx.ellipse(3, 12.5, 12, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Paruh burung
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.moveTo(18, 5);
  ctx.lineTo(29, 8.5);
  ctx.lineTo(18, 12.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Mata burung
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(13, 4.5, 3.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#041226';
  ctx.beginPath();
  ctx.arc(13.8, 4.5, 1.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(14.4, 3.8, 0.7, 0, Math.PI * 2);
  ctx.fill();

  // ===== LAYER 3: SAYAP BURUNG (Normal / Emas) =====
  ctx.save();
  ctx.translate(-3, 9);
  ctx.rotate(Math.sin(wingAngle) * 0.58);
  if (hasGoldWings) {
    const wingGrad = ctx.createLinearGradient(-12, -4, 8, 10);
    wingGrad.addColorStop(0, '#fef08a');
    wingGrad.addColorStop(0.5, '#fbbf24');
    wingGrad.addColorStop(1, '#d97706');
    ctx.fillStyle = wingGrad;
    ctx.beginPath();
    ctx.ellipse(-3, 3, 12.5, 6.5, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fef9c3';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // Detail bulu emas
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-10, 4);
    ctx.lineTo(-2, 2);
    ctx.moveTo(-8, 7);
    ctx.lineTo(1, 5);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#0369a1';
    ctx.beginPath();
    ctx.ellipse(-2, 3, 9.5, 5.2, -0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#bae6fd';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();

  // ===== LAYER 4: SYAL BARISTA (ekor berkibar di belakang) =====
  if (hasScarf) {
    const wave = Math.sin(frame * 0.25) * 2.5;
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.moveTo(-5, -10);
    ctx.quadraticCurveTo(-15, -12 + wave, -23, -7 - wave);
    ctx.lineTo(-21, -2 - wave);
    ctx.quadraticCurveTo(-13, -6 + wave, -5, -6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // ===== LAYER 5: BADAN OWNER SMARA KOPI =====
  ctx.fillStyle = '#0f294a';
  ctx.beginPath();
  ctx.roundRect(-7.5, -11, 14, 13.5, 4);
  ctx.fill();
  ctx.strokeStyle = '#7dd3fc';
  ctx.lineWidth = 1.1;
  ctx.stroke();

  // ===== LAYER 6: CELEMEK BARISTA (menimpa baju) =====
  if (hasApron) {
    // Tali celemek di bahu
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-3.5, -11);
    ctx.lineTo(-3.5, -7);
    ctx.moveTo(3, -11);
    ctx.lineTo(3, -7);
    ctx.stroke();
    // Badan celemek
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.roundRect(-5.5, -8, 10.5, 10, 2);
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 0.9;
    ctx.stroke();
    // Saku & biji kopi mini di dada celemek
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(0, -3.5, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Kerah syal di leher (di atas baju & celemek)
  if (hasScarf) {
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.roundRect(-6.5, -12.2, 12.5, 3.4, 1.6);
    ctx.fill();
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // Tangan owner memegang leher burung
  ctx.strokeStyle = '#fed7aa';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(2, -6);
  ctx.lineTo(10, -1);
  ctx.stroke();

  // ===== LAYER 7: KEPALA OWNER =====
  ctx.fillStyle = '#fed7aa';
  ctx.beginPath();
  ctx.arc(0, -18.5, 7.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fdba74';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Rambut
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(-0.5, -20.2, 7.8, Math.PI * 0.95, Math.PI * 2.05);
  ctx.fill();

  // Senyum ramah owner
  ctx.strokeStyle = '#9a3412';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(3.5, -16.2, 2.2, 0.15, Math.PI * 0.72);
  ctx.stroke();

  // Mata owner
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(3.6, -18.8, 1.35, 0, Math.PI * 2);
  ctx.fill();

  // ===== LAYER 8: KACAMATA KECE (bisa ditimpa bareng topi & mahkota) =====
  if (hasShades) {
    // Gagang kacamata
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-6, -19.2);
    ctx.lineTo(0.2, -19.2);
    ctx.stroke();
    // Lensa gelap
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.roundRect(0, -21, 8.2, 4, 1.2);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 0.9;
    ctx.stroke();
    // Kilau lensa
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.85)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(1.8, -20.2);
    ctx.lineTo(3.4, -17.8);
    ctx.stroke();
  }

  // ===== LAYER 9: TOPI BARISTA =====
  if (hasCap) {
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(0, -22.2, 8, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#bae6fd';
    ctx.lineWidth = 0.9;
    ctx.stroke();
    // Lidah topi (visor)
    ctx.fillStyle = '#0369a1';
    ctx.beginPath();
    ctx.roundRect(-1.5, -23.6, 13, 2.8, 1.4);
    ctx.fill();
    // Badge bulan sabit kecil di topi
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.arc(3.2, -25.2, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // ===== LAYER 10: MAHKOTA SULTAN (kalau pakai topi juga, nangkring manis di atas topi!) =====
  if (hasCrown) {
    const crownOffsetY = hasCap ? -6.2 : 0;
    ctx.save();
    ctx.translate(0, crownOffsetY);

    const crownGrad = ctx.createLinearGradient(-7, -33, 7, -24);
    crownGrad.addColorStop(0, '#fef08a');
    crownGrad.addColorStop(0.5, '#fbbf24');
    crownGrad.addColorStop(1, '#d97706');
    ctx.fillStyle = crownGrad;
    ctx.beginPath();
    ctx.moveTo(-6.5, -24.5);
    ctx.lineTo(-7.2, -31.5);
    ctx.lineTo(-3, -27.5);
    ctx.lineTo(0, -33.2);
    ctx.lineTo(3, -27.5);
    ctx.lineTo(7.2, -31.5);
    ctx.lineTo(6.5, -24.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fef9c3';
    ctx.lineWidth = 0.9;
    ctx.stroke();

    // Permata mahkota
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(0, -26.8, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(-3.6, -26.4, 1, 0, Math.PI * 2);
    ctx.arc(3.6, -26.4, 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  ctx.restore();
}

/**
 * Gambar ikon bonus gelas kopi (+10 poin) di canvas.
 */
export function drawCoffeeBonus(ctx, x, y, frame) {
  const bob = Math.sin(frame * 0.09) * 3;
  ctx.save();
  ctx.translate(x, y + bob);

  // Halo kuning-biru lembut
  const halo = ctx.createRadialGradient(0, 0, 4, 0, 0, 21);
  halo.addColorStop(0, 'rgba(251, 191, 36, 0.42)');
  halo.addColorStop(1, 'rgba(251, 191, 36, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, 21, 0, Math.PI * 2);
  ctx.fill();

  // Gelas kopi takeaway SMARA
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(-8, -7);
  ctx.lineTo(8, -7);
  ctx.lineTo(6, 10);
  ctx.lineTo(-6, 10);
  ctx.closePath();
  ctx.fill();

  // Sleeve biru SMARA
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(-7, -2, 14, 6.5);

  // Tutup gelas
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.roundRect(-9.5, -10.5, 19, 3.8, 1.5);
  ctx.fill();

  // Label +10
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('+10', 0, -14);

  ctx.restore();
}
