'use client';

import React, { useEffect, useRef } from 'react';
import {
  Award,
  Lock,
  Check,
  Sparkles,
  Layers,
  RotateCcw,
  Crown,
  Share2,
  Play,
} from 'lucide-react';
import { ACHIEVEMENTS, drawOwnerOnBird } from '@/lib/flappyCharacter';

export default function FlappyAchievementPanel({
  sessionMode,
  bestScore,
  equippedAccessories,
  onToggleAccessory,
  onEquipAllUnlocked,
  onClearAllAccessories,
  onSwitchToRank,
  onOpenShare,
  onBackToPlay,
}) {
  const previewCanvasRef = useRef(null);
  const equippedRef = useRef(equippedAccessories);
  equippedRef.current = equippedAccessories;

  const isRank = sessionMode === 'rank';
  const unlockedCount = isRank
    ? ACHIEVEMENTS.filter((a) => bestScore >= a.minScore).length
    : 0;

  // Live animated preview of Owner-on-Bird wearing ALL stacked accessories
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let frame = 0;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = 280;
    const H = 165;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const loop = () => {
      frame += 1;
      ctx.clearRect(0, 0, W, H);

      // Latar panggung malam kafe
      const grad = ctx.createRadialGradient(W / 2, H / 2 + 8, 12, W / 2, H / 2, 130);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.24)');
      grad.addColorStop(0.6, 'rgba(9, 36, 71, 0.45)');
      grad.addColorStop(1, 'rgba(4, 18, 38, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Bintang halus
      ctx.fillStyle = 'rgba(186, 230, 253, 0.45)';
      for (let i = 0; i < 12; i++) {
        const sx = (i * 53 + frame * 0.2) % W;
        const sy = 16 + ((i * 29) % (H - 34));
        const alpha = 0.25 + 0.55 * Math.abs(Math.sin(frame * 0.04 + i));
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(W - sx, sy, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Bayangan lembut di bawah karakter
      const bob = Math.sin(frame * 0.07) * 5;
      ctx.fillStyle = 'rgba(2, 12, 27, 0.42)';
      ctx.beginPath();
      ctx.ellipse(W / 2, H - 22, 34 - bob * 0.5, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Gambar karakter besar & tajam lengkap dengan aksesoris bertumpuk
      const activeList = isRank ? equippedRef.current : [];
      drawOwnerOnBird(
        ctx,
        W / 2,
        H / 2 + 12 + bob,
        Math.cos(frame * 0.07) * 1.1,
        frame * 0.2,
        activeList,
        frame,
        1.85
      );

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isRank]);

  return (
    <div className="space-y-4 smara-animate">
      {/* PANGGUNG PREVIEW KARAKTER */}
      <div className="smara-glass rounded-3xl p-5 space-y-4 border-sky-300/35">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-sky-300 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-300" /> Achievement &amp; Karakter
            </p>
            <h3 className="text-lg font-extrabold text-white mt-0.5">
              Preview Owner SMARA
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/35 text-xs font-extrabold text-amber-200">
              {unlockedCount} / {ACHIEVEMENTS.length} Terbuka
            </span>
          </div>
        </div>

        {/* Canvas Preview */}
        <div className="relative rounded-2xl bg-[#041226]/75 border border-sky-300/25 flex flex-col items-center justify-center py-2 overflow-hidden">
          <canvas
            ref={previewCanvasRef}
            className="w-[280px] h-[165px] max-w-full"
          />

          {/* Tag aksesoris yang sedang dipakai barengan */}
          <div className="px-3 pb-2.5 flex flex-wrap items-center justify-center gap-1.5">
            {isRank && equippedAccessories.length > 0 ? (
              equippedAccessories.map((id) => {
                const item = ACHIEVEMENTS.find((a) => a.id === id);
                if (!item) return null;
                return (
                  <span
                    key={id}
                    className="px-2.5 py-0.5 rounded-full bg-sky-400/20 border border-sky-300/35 text-[10px] font-bold text-sky-100"
                  >
                    {item.name}
                  </span>
                );
              })
            ) : (
              <span className="text-[11px] text-sky-200/65">
                {isRank
                  ? 'Karakter Polos • Pilih aksesoris di bawah (bisa dipakai barengan!)'
                  : 'Mode Classic • Karakter Polos'}
              </span>
            )}
          </div>
        </div>

        {/* Info Stackable & Tombol Aksi Cepat */}
        {isRank ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] text-sky-200/85 bg-white/5 border border-white/10 px-3.5 py-2 rounded-xl">
              <span className="inline-flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                Semua aksesoris yang terbuka <strong>bisa ditumpuk / dipakai barengan</strong>!
              </span>
              <span className="font-mono font-bold text-amber-300 shrink-0">
                Rekor: {bestScore} pts
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                disabled={unlockedCount === 0}
                onClick={onEquipAllUnlocked}
                className="py-2.5 px-3 rounded-xl bg-sky-400/20 hover:bg-sky-400/30 disabled:opacity-40 border border-sky-300/35 text-xs font-bold text-sky-100 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-sky-300" /> Pakai Semua
              </button>
              <button
                type="button"
                disabled={equippedAccessories.length === 0}
                onClick={onClearAllAccessories}
                className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-40 border border-white/15 text-xs font-bold text-sky-100 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Lepas Semua
              </button>
              <button
                type="button"
                onClick={onOpenShare}
                className="col-span-2 sm:col-span-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-[#041226] text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" /> Share Kartu
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-amber-400/15 border border-amber-300/35 text-center space-y-2.5">
            <p className="text-xs text-amber-100 leading-relaxed">
              Kamu sedang di <strong>Mode Classic</strong>. Masuk <strong>Mode Rank</strong> (isi Nama &amp; WA) untuk membuka Achievement, mengoleksi aksesoris bertumpuk, dan masuk 10 Besar Mingguan!
            </p>
            <button
              type="button"
              onClick={onSwitchToRank}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#041226] text-xs font-extrabold transition cursor-pointer"
            >
              <Crown className="w-3.5 h-3.5" /> Masuk Mode Rank Sekarang
            </button>
          </div>
        )}
      </div>

      {/* DAFTAR ACHIEVEMENT */}
      <div className="smara-glass rounded-3xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-300" /> Daftar Achievement
          </h4>
          <button
            type="button"
            onClick={onBackToPlay}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-400/20 hover:bg-sky-400/30 border border-sky-300/35 text-sky-100 text-xs font-bold transition cursor-pointer"
          >
            <Play className="w-3 h-3 fill-current" /> Kembali Main
          </button>
        </div>

        <div className="space-y-2.5">
          {ACHIEVEMENTS.map((ach) => {
            const unlocked = isRank && bestScore >= ach.minScore;
            const equipped = unlocked && equippedAccessories.includes(ach.id);
            const progressPct = isRank
              ? Math.min(100, Math.round((bestScore / ach.minScore) * 100))
              : 0;

            return (
              <div
                key={ach.id}
                className={`p-3.5 rounded-2xl border transition-all duration-300 ${
                  equipped
                    ? 'bg-sky-400/20 border-sky-300/60 shadow-[0_0_20px_rgba(56,189,248,0.16)]'
                    : unlocked
                    ? 'smara-glass-soft hover:border-sky-300/40'
                    : 'bg-white/[0.04] border-white/10 opacity-75'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                        equipped
                          ? 'bg-sky-400/30 border-sky-300 text-white'
                          : unlocked
                          ? 'bg-emerald-400/20 border-emerald-300/40 text-emerald-300'
                          : 'bg-white/5 border-white/15 text-amber-300/80'
                      }`}
                    >
                      {unlocked ? (
                        equipped ? (
                          <Check className="w-5 h-5" />
                        ) : (
                          <Award className="w-5 h-5" />
                        )
                      ) : (
                        <Lock className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-sm text-white">
                          {ach.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-bold text-sky-200">
                          {ach.slot}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-300/30 text-[10px] font-extrabold text-amber-200">
                          {ach.minScore} Poin
                        </span>
                      </div>
                      <p className="text-[11px] text-sky-200/80 mt-0.5">
                        <strong className="text-sky-100">{ach.title}</strong> — {ach.description}
                      </p>
                    </div>
                  </div>

                  {unlocked ? (
                    <button
                      type="button"
                      onClick={() => onToggleAccessory(ach.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-extrabold shrink-0 transition cursor-pointer ${
                        equipped
                          ? 'bg-sky-400 text-[#041226] hover:bg-sky-300'
                          : 'bg-white/15 hover:bg-white/25 text-white border border-white/20'
                      }`}
                    >
                      {equipped ? 'Dipakai ✓' : 'Pakai'}
                    </button>
                  ) : (
                    <span className="px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[11px] font-mono font-bold text-sky-200/70 shrink-0">
                      {isRank ? `${Math.min(bestScore, ach.minScore)}/${ach.minScore}` : 'Terkunci'}
                    </span>
                  )}
                </div>

                {!unlocked && isRank && (
                  <div className="mt-2.5 w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-400 to-amber-300 transition-all duration-500"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
