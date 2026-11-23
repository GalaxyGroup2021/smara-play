'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, Crown, Trophy, Camera, Download, Sparkles, Check } from 'lucide-react';
import SmaraLogo from '@/components/SmaraLogo';
import { ACHIEVEMENTS, drawOwnerOnBird, parseAccessories } from '@/lib/flappyCharacter';

export default function FlappyShareModal({
  open,
  onClose,
  playerName,
  sessionMode,
  displayScore,
  bestScore,
  weeklyRank,
  totalPlayers,
  weekKey,
  equippedAccessories,
}) {
  const charCanvasRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const isRank = sessionMode === 'rank';
  const activeAccessories = isRank ? parseAccessories(equippedAccessories) : [];
  const activeNames = activeAccessories
    .map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.name)
    .filter(Boolean);

  const shownName = isRank && playerName ? playerName.trim() : 'Tamu SMARA';
  const shownScore = Math.max(0, Number(displayScore ?? bestScore ?? 0));
  const shownBest = Math.max(shownScore, Number(bestScore ?? 0));

  useEffect(() => {
    if (!open) return;
    const canvas = charCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const dpr = Math.min(3, window.devicePixelRatio || 2);
    const W = 280;
    const H = 175;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let animId;
    let frame = 0;

    const render = () => {
      frame += 1;
      ctx.clearRect(0, 0, W, H);

      // Spotlight lembut di belakang karakter
      const spot = ctx.createRadialGradient(W / 2, H / 2 + 8, 10, W / 2, H / 2 + 4, 125);
      spot.addColorStop(
        0,
        weeklyRank === 1 ? 'rgba(251, 191, 36, 0.32)' : 'rgba(56, 189, 248, 0.30)'
      );
      spot.addColorStop(0.65, 'rgba(14, 116, 144, 0.14)');
      spot.addColorStop(1, 'rgba(4, 18, 38, 0)');
      ctx.fillStyle = spot;
      ctx.fillRect(0, 0, W, H);

      // Bintang kecil berkilau
      for (let i = 0; i < 14; i++) {
        const sx = 18 + ((i * 61) % (W - 36));
        const sy = 14 + ((i * 37) % (H - 36));
        ctx.fillStyle =
          i % 3 === 0 ? 'rgba(253, 224, 71, 0.65)' : 'rgba(186, 230, 253, 0.55)';
        ctx.beginPath();
        ctx.arc(sx, sy, i % 4 === 0 ? 1.8 : 1.1, 0, Math.PI * 2);
        ctx.fill();
      }

      // Bayangan bawah
      const bob = Math.sin(frame * 0.06) * 4;
      ctx.fillStyle = 'rgba(2, 10, 24, 0.45)';
      ctx.beginPath();
      ctx.ellipse(W / 2, H - 18, 38 - bob * 0.4, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();

      drawOwnerOnBird(
        ctx,
        W / 2,
        H / 2 + 16 + bob,
        -0.4,
        frame * 0.18,
        activeAccessories,
        frame,
        2.15
      );

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [open, weeklyRank, activeAccessories.join(',')]);

  // Ekspor kartu skor sebagai file PNG tajam (1080x1440) tanpa API eksternal
  const handleDownloadPng = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const W = 1080;
      const H = 1440;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');

      // Background gradien khas SMARA KOPI
      const bg = ctx.createLinearGradient(0, 0, W * 0.6, H);
      bg.addColorStop(0, '#041226');
      bg.addColorStop(0.48, '#092447');
      bg.addColorStop(0.82, '#0c315e');
      bg.addColorStop(1, '#061830');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Cahaya ambient
      const glow1 = ctx.createRadialGradient(220, 260, 20, 220, 260, 480);
      glow1.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
      glow1.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = glow1;
      ctx.fillRect(0, 0, W, H);

      const glow2 = ctx.createRadialGradient(860, 1120, 20, 860, 1120, 500);
      glow2.addColorStop(0, 'rgba(251, 191, 36, 0.16)');
      glow2.addColorStop(1, 'rgba(251, 191, 36, 0)');
      ctx.fillStyle = glow2;
      ctx.fillRect(0, 0, W, H);

      // Bingkai kartu elegan
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.35)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(56, 56, W - 112, H - 112, 48);
      ctx.stroke();

      // Muat & gambar Logo SMARA KOPI di atas tengah
      const loadImg = (src) =>
        new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = src;
        });

      const logoImg = await loadImg('/logo-smara-sm.png');
      if (logoImg) {
        const targetH = 190;
        const targetW = (logoImg.width / logoImg.height) * targetH;
        ctx.drawImage(logoImg, (W - targetW) / 2, 105, targetW, targetH);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 54px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SMARA KOPI', W / 2, 210);
      }

      // Pill FLAPPY SMARA
      ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(W / 2 - 190, 326, 380, 52, 26);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#bae6fd';
      ctx.font = '800 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('FLAPPY SMARA • KARTU SKOR', W / 2, 360);

      // Spotlight panggung karakter
      const charCenterY = 605;
      const stageGlow = ctx.createRadialGradient(W / 2, charCenterY, 20, W / 2, charCenterY, 270);
      stageGlow.addColorStop(
        0,
        weeklyRank === 1 ? 'rgba(251, 191, 36, 0.34)' : 'rgba(56, 189, 248, 0.32)'
      );
      stageGlow.addColorStop(1, 'rgba(4, 18, 38, 0)');
      ctx.fillStyle = stageGlow;
      ctx.beginPath();
      ctx.arc(W / 2, charCenterY, 270, 0, Math.PI * 2);
      ctx.fill();

      // Bintang panggung
      for (let i = 0; i < 20; i++) {
        const sx = 140 + ((i * 197) % (W - 280));
        const sy = 415 + ((i * 113) % 360);
        ctx.fillStyle = i % 3 === 0 ? 'rgba(253, 224, 71, 0.7)' : 'rgba(186, 230, 253, 0.55)';
        ctx.beginPath();
        ctx.arc(sx, sy, i % 4 === 0 ? 4 : 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Bayangan bawah karakter
      ctx.fillStyle = 'rgba(2, 10, 24, 0.45)';
      ctx.beginPath();
      ctx.ellipse(W / 2, 745, 118, 18, 0, 0, Math.PI * 2);
      ctx.fill();

      // Karakter lengkap dengan semua aksesoris
      drawOwnerOnBird(ctx, W / 2, charCenterY + 38, -0.35, 0.65, activeAccessories, 18, 5.6);

      // Nama pemain
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 54px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(shownName, W / 2, 835);

      // Subteks aksesoris aktif
      ctx.fillStyle = '#7dd3fc';
      ctx.font = '600 24px sans-serif';
      const accSummary =
        activeNames.length > 0 ? activeNames.join(' • ') : 'Owner SMARA Polos';
      ctx.fillText(
        accSummary.length > 52 ? accSummary.slice(0, 50) + '…' : accSummary,
        W / 2,
        878
      );

      // Kotak Skor & Peringkat Mingguan
      const boxY = 935;
      const boxH = 265;
      ctx.fillStyle = 'rgba(4, 18, 38, 0.68)';
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.28)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(110, boxY, W - 220, boxH, 36);
      ctx.fill();
      ctx.stroke();

      // Garis pembatas tengah
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(W / 2, boxY + 42);
      ctx.lineTo(W / 2, boxY + boxH - 42);
      ctx.stroke();

      // Kolom kiri: SKOR
      ctx.fillStyle = '#bae6fd';
      ctx.font = '700 24px sans-serif';
      ctx.fillText('SKOR', W * 0.31, boxY + 68);
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 96px sans-serif';
      ctx.fillText(String(shownScore), W * 0.31, boxY + 172);
      ctx.fillStyle = '#7dd3fc';
      ctx.font = '600 22px sans-serif';
      ctx.fillText(
        isRank ? `Rekor: ${shownBest} pts` : 'Mode Classic',
        W * 0.31,
        boxY + 220
      );

      // Kolom kanan: PERINGKAT MINGGUAN
      ctx.fillStyle = '#fde68a';
      ctx.font = '700 24px sans-serif';
      ctx.fillText('PERINGKAT MINGGUAN', W * 0.69, boxY + 68);
      ctx.fillStyle = weeklyRank === 1 ? '#fbbf24' : '#38bdf8';
      ctx.font = '800 92px sans-serif';
      ctx.fillText(
        isRank && weeklyRank ? `#${weeklyRank}` : '-',
        W * 0.69,
        boxY + 172
      );
      ctx.fillStyle = '#bae6fd';
      ctx.font = '600 22px sans-serif';
      ctx.fillText(
        isRank
          ? `${weekKey || 'Minggu Ini'}${totalPlayers ? ` • ${totalPlayers} pemain` : ''}`
          : 'Main Rank untuk klasemen',
        W * 0.69,
        boxY + 220
      );

      // Footer
      ctx.fillStyle = 'rgba(186, 230, 253, 0.78)';
      ctx.font = '700 26px sans-serif';
      ctx.fillText('SMARA PLAY • Main langsung di SMARA KOPI!', W / 2, 1295);
      ctx.fillStyle = 'rgba(253, 224, 71, 0.9)';
      ctx.font = '700 22px sans-serif';
      ctx.fillText('Juara #1 Mingguan Gratis 1 Menu Pilihan', W / 2, 1340);

      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `flappy-smara-${shownName.toLowerCase().replace(/\s+/g, '-')}-${shownScore}pts.png`;
      link.href = url;
      link.click();

      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2500);
    } catch {
      // Fallback: user tetap bisa langsung screenshot kartu di layar
    } finally {
      setDownloading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[#020a18]/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto smara-overlay"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[360px] space-y-3 my-auto smara-animate"
      >
        {/* Baris atas di luar kartu screenshot */}
        <div className="flex items-center justify-between px-1">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-200">
            <Camera className="w-4 h-4 text-sky-300" /> Siap di-Screenshot!
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-sky-100 transition cursor-pointer"
            aria-label="Tutup Kartu Share"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ===== KARTU SHARE (BERSIH, SIAP SCREENSHOT) ===== */}
        <div className="relative rounded-[28px] overflow-hidden border border-sky-300/45 shadow-[0_20px_60px_rgba(2,12,27,0.85)] bg-gradient-to-b from-[#041226] via-[#092447] to-[#061830] p-5 text-center space-y-4">
          {/* Dekorasi cahaya sudut */}
          <div className="pointer-events-none absolute -top-16 -left-16 w-48 h-48 rounded-full bg-sky-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -right-16 w-48 h-48 rounded-full bg-amber-400/15 blur-3xl" />

          {/* 1. LOGO SMARA KOPI */}
          <div className="relative z-10 flex flex-col items-center gap-2 pt-1">
            <SmaraLogo size="md" />
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-400/15 border border-sky-300/35 text-[10px] font-extrabold tracking-[0.18em] text-sky-200 uppercase">
              <Sparkles className="w-3 h-3 text-amber-300" /> Flappy SMARA
            </span>
          </div>

          {/* 2. KARAKTER LENGKAP DENGAN AKSESORIS */}
          <div className="relative z-10 flex flex-col items-center">
            <canvas
              ref={charCanvasRef}
              className="w-[260px] h-[162px] max-w-full"
            />
            <h3 className="text-xl font-extrabold text-white tracking-tight mt-0.5">
              {shownName}
            </h3>
            {activeNames.length > 0 ? (
              <div className="flex flex-wrap items-center justify-center gap-1 mt-1.5 max-w-[290px]">
                {activeNames.map((label) => (
                  <span
                    key={label}
                    className="px-2 py-0.5 rounded-full bg-sky-400/20 border border-sky-300/30 text-[10px] font-bold text-sky-100"
                  >
                    {label}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-sky-200/70 mt-0.5">Owner SMARA Polos</p>
            )}
          </div>

          {/* 3. SKOR & PERINGKAT MINGGUAN */}
          <div className="relative z-10 grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-[#041226]/75 border border-sky-300/25 p-3.5 flex flex-col items-center justify-center">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-200/80 flex items-center gap-1">
                <Trophy className="w-3 h-3 text-sky-300" /> Skor
              </span>
              <span className="text-3xl font-black font-mono text-white leading-none mt-1.5">
                {shownScore}
              </span>
              <span className="text-[10px] text-sky-200/70 mt-1">
                {isRank ? `Rekor: ${shownBest} pts` : 'Mode Classic'}
              </span>
            </div>

            <div
              className={`rounded-2xl p-3.5 flex flex-col items-center justify-center border ${
                isRank && weeklyRank === 1
                  ? 'bg-amber-400/15 border-amber-300/50'
                  : 'bg-[#041226]/75 border-sky-300/25'
              }`}
            >
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-200/90 flex items-center gap-1">
                <Crown className="w-3 h-3 text-amber-300" /> Peringkat
              </span>
              <span
                className={`text-3xl font-black font-mono leading-none mt-1.5 ${
                  isRank && weeklyRank === 1
                    ? 'text-amber-300'
                    : isRank && weeklyRank
                    ? 'text-sky-300'
                    : 'text-sky-200/50'
                }`}
              >
                {isRank && weeklyRank ? `#${weeklyRank}` : '-'}
              </span>
              <span className="text-[10px] text-sky-200/75 mt-1 truncate max-w-full">
                {isRank
                  ? weekKey
                    ? `Minggu ${weekKey}`
                    : 'Mingguan'
                  : 'Khusus Mode Rank'}
              </span>
            </div>
          </div>

          {/* 4. FOOTER BRANDING */}
          <div className="relative z-10 pt-1 border-t border-white/10 space-y-0.5">
            {isRank && weeklyRank === 1 && (
              <p className="text-[11px] font-extrabold text-amber-300">
                👑 Posisi #1 Mingguan — Calon Gratis 1 Menu!
              </p>
            )}
            <p className="text-[11px] font-semibold text-sky-200/80">
              SMARA PLAY • Main langsung di <strong className="text-white">SMARA KOPI</strong>
            </p>
          </div>
        </div>

        {/* Tombol di bawah kartu (di luar area screenshot kartu) */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={downloading}
            className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-300 hover:to-blue-400 disabled:opacity-60 text-[#041226] font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
          >
            {downloaded ? (
              <>
                <Check className="w-4 h-4" /> Gambar Tersimpan!
              </>
            ) : (
              <>
                <Download className="w-4 h-4" /> {downloading ? 'Menyimpan...' : 'Simpan Gambar (PNG)'}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
        <p className="text-[11px] text-center text-sky-200/70">
          Bisa langsung screenshot kartu di atas atau tekan Simpan Gambar untuk dibagikan ke Story / WA.
        </p>
      </div>
    </div>
  );
}
