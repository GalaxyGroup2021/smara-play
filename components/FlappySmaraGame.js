'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Trophy,
  Coffee,
  Play,
  RotateCcw,
  Sparkles,
  Lock,
  Check,
  Send,
  Loader2,
  Crown,
  Gift,
  UserCheck,
  Gauge,
  LogOut,
  Gamepad2,
  RefreshCw,
} from 'lucide-react';

const ACCESSORIES = [
  { id: 'none', name: 'Polos', minScore: 0, badge: 'Default' },
  { id: 'shades', name: 'Kacamata Kece', minScore: 15, badge: '15 Poin' },
  { id: 'barista_cap', name: 'Topi Barista', minScore: 30, badge: '30 Poin' },
  { id: 'crown', name: 'Mahkota Sultan', minScore: 50, badge: '50 Poin' },
  { id: 'aura', name: 'Aura Api Biru', minScore: 80, badge: '80 Poin' },
];

function cleanWaDigits(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('0')) {
    digits = '62' + digits.slice(1);
  } else if (digits.startsWith('8')) {
    digits = '62' + digits;
  }
  return digits;
}

function getSpeedByScore(currentScore) {
  const tier = Math.floor(Math.max(0, currentScore) / 50);
  const cappedTier = Math.min(8, tier);
  return 2.25 + cappedTier * 0.42;
}

export default function FlappySmaraGame({ onBack }) {
  const canvasRef = useRef(null);

  const [sessionMode, setSessionMode] = useState(null);
  const [rankStepForm, setRankStepForm] = useState(false);

  const [playerName, setPlayerName] = useState('');
  const [playerWa, setPlayerWa] = useState('');
  const [identityError, setIdentityError] = useState('');

  const [gamePhase, setGamePhase] = useState('READY');
  const [score, setScore] = useState(0);
  const [bestLocalScore, setBestLocalScore] = useState(0);
  const [selectedAccessory, setSelectedAccessory] = useState('none');
  const [floatingBonus, setFloatingBonus] = useState(null);
  const [speedMilestoneToast, setSpeedMilestoneToast] = useState('');

  const [weekKey, setWeekKey] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingBoard, setLoadingBoard] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');
  const [submitError, setSubmitError] = useState('');

  const waDigits = cleanWaDigits(playerWa);
  const hasValidRankIdentity =
    playerName.trim().length >= 2 && waDigits.length >= 10 && waDigits.length <= 15;
  const speedTier = Math.floor(score / 50) + 1;
  const activeAccessory = sessionMode === 'rank' ? selectedAccessory : 'none';

  const gameRef = useRef({
    birdY: 210,
    birdVy: 0,
    pipes: [],
    coffeeItems: [],
    frame: 0,
    playSecondsAccumulator: 0,
    lastSpeedTier: 0,
    score: 0,
    wingAngle: 0,
    running: false,
  });

  useEffect(() => {
    const savedBest = Number(localStorage.getItem('smara_flappy_best') || 0);
    const savedAcc = localStorage.getItem('smara_flappy_acc') || 'none';
    const savedName = localStorage.getItem('smara_flappy_name') || '';
    const savedWa = localStorage.getItem('smara_flappy_wa') || '';
    setBestLocalScore(savedBest);
    setSelectedAccessory(savedAcc);
    if (savedName) setPlayerName(savedName);
    if (savedWa) setPlayerWa(savedWa);
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    setLoadingBoard(true);
    try {
      const res = await fetch('/api/flappy', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setWeekKey(data.weekKey || '');
        setLeaderboard((data.leaderboard || []).slice(0, 10));
      }
    } catch {} finally {
      setLoadingBoard(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const handleSelectAccessory = (acc) => {
    if (sessionMode !== 'rank') return;
    if (bestLocalScore < acc.minScore) return;
    setSelectedAccessory(acc.id);
    localStorage.setItem('smara_flappy_acc', acc.id);
  };

  const handleChooseClassic = () => {
    gameRef.current.running = false;
    setGamePhase('READY');
    setScore(0);
    setRankStepForm(false);
    setIdentityError('');
    setSessionMode('classic');
  };

  const handleOpenRankForm = () => {
    setIdentityError('');
    setRankStepForm(true);
  };

  const handleConfirmRankSession = (e) => {
    e.preventDefault();
    if (!hasValidRankIdentity) {
      setIdentityError('Isi Nama Panggilan (min. 2 huruf) dan Nomor WA valid (min. 10 digit).');
      return;
    }
    setIdentityError('');
    localStorage.setItem('smara_flappy_name', playerName.trim());
    localStorage.setItem('smara_flappy_wa', playerWa.trim());
    gameRef.current.running = false;
    setGamePhase('READY');
    setScore(0);
    setRankStepForm(false);
    setSessionMode('rank');
  };

  const handleLogoutSession = () => {
    gameRef.current.running = false;
    setGamePhase('READY');
    setScore(0);
    setSubmitMsg('');
    setSubmitError('');
    setRankStepForm(false);
    setSessionMode(null);
  };

  const drawOwnerOnBird = useCallback((ctx, x, y, vy, wingAngle, accId) => {
    ctx.save();
    ctx.translate(x, y);
    const tilt = Math.max(-0.42, Math.min(0.55, vy * 0.055));
    ctx.rotate(tilt);

    if (accId === 'aura') {
      const grad = ctx.createRadialGradient(0, 0, 8, 0, 0, 34);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.65)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, 34, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.ellipse(0, 8, 20, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#bae6fd';
    ctx.beginPath();
    ctx.ellipse(2, 11, 13, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(18, 5);
    ctx.lineTo(28, 8);
    ctx.lineTo(18, 12);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#041226';
    ctx.beginPath();
    ctx.arc(13, 4, 2.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(-3, 8);
    ctx.rotate(Math.sin(wingAngle) * 0.55);
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.ellipse(-2, 3, 9, 5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#0f294a';
    ctx.beginPath();
    ctx.roundRect(-7, -11, 13, 13, 4);
    ctx.fill();
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.strokeStyle = '#fed7aa';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(2, -6);
    ctx.lineTo(10, -1);
    ctx.stroke();

    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.arc(0, -18, 7.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(0, -20, 7.5, Math.PI, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(3.5, -18, 1.4, 0, Math.PI * 2);
    ctx.fill();

    if (accId === 'shades') {
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, -20.5, 7.5, 3.5);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(0, -20.5, 7.5, 3.5);
    } else if (accId === 'barista_cap') {
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(0, -22, 7.5, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(-1, -23, 12, 2.5);
    } else if (accId === 'crown') {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(-6, -24);
      ctx.lineTo(-4, -31);
      ctx.lineTo(0, -26);
      ctx.lineTo(4, -31);
      ctx.lineTo(6, -24);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }, []);

  const drawCoffeeBonus = useCallback((ctx, x, y, frame) => {
    const bob = Math.sin(frame * 0.09) * 3;
    ctx.save();
    ctx.translate(x, y + bob);

    ctx.fillStyle = 'rgba(251, 191, 36, 0.24)';
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(-8, -7);
    ctx.lineTo(8, -7);
    ctx.lineTo(6, 10);
    ctx.lineTo(-6, 10);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0284c7';
    ctx.fillRect(-7, -2, 14, 6);

    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-9, -10, 18, 3);

    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('+10', 0, -14);

    ctx.restore();
  }, []);

  const submitScoreToDb = useCallback(
    async (finalScore, nameVal, waVal, accVal) => {
      if (finalScore <= 0) return;
      const cleanName = String(nameVal || '').trim();
      const cleanWa = cleanWaDigits(waVal);
      if (cleanName.length < 2 || cleanWa.length < 10) {
        setSubmitError('Nama atau nomor WA belum lengkap.');
        return;
      }

      setSubmitting(true);
      setSubmitError('');
      try {
        const res = await fetch('/api/flappy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: cleanName,
            wa: cleanWa,
            score: finalScore,
            accessory: accVal,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setLeaderboard((data.leaderboard || []).slice(0, 10));
          setSubmitMsg('Skor tersimpan di 10 Besar Mingguan SMARA KOPI!');
        } else {
          setSubmitError(data.error || 'Gagal menyimpan skor');
        }
      } catch (err) {
        setSubmitError(err.message);
      } finally {
        setSubmitting(false);
      }
    },
    []
  );

  const startGame = useCallback(() => {
    if (!sessionMode) return;

    gameRef.current = {
      birdY: 200,
      birdVy: -5.6,
      pipes: [],
      coffeeItems: [],
      frame: 0,
      playSecondsAccumulator: 0,
      lastSpeedTier: 0,
      score: 0,
      wingAngle: 0,
      running: true,
    };
    setScore(0);
    setSpeedMilestoneToast('');
    setSubmitMsg('');
    setSubmitError('');
    setGamePhase('PLAYING');
  }, [sessionMode]);

  const handleCanvasTap = useCallback(() => {
    if (!sessionMode) return;
    if (gamePhase === 'READY') {
      startGame();
      return;
    }
    if (gamePhase === 'PLAYING' && gameRef.current.running) {
      gameRef.current.birdVy = -6.0;
      gameRef.current.wingAngle += 1.4;
    }
  }, [sessionMode, gamePhase, startGame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let lastTime = performance.now();

    const W = 360;
    const H = 440;
    const birdX = 85;
    const gravity = 0.31;
    const pipeWidth = 52;
    const pipeGap = 136;

    const triggerGameOver = (finalScore) => {
      if (!gameRef.current.running) return;
      gameRef.current.running = false;
      setGamePhase('GAMEOVER');
      if (sessionMode === 'rank') {
        setBestLocalScore((prev) => {
          const nextBest = Math.max(prev, finalScore);
          localStorage.setItem('smara_flappy_best', String(nextBest));
          return nextBest;
        });
        submitScoreToDb(finalScore, playerName, playerWa, selectedAccessory);
      }
    };

    const syncScoreAndMilestone = (nextScore) => {
      gameRef.current.score = nextScore;
      setScore(nextScore);
      const currentTier = Math.floor(nextScore / 50);
      if (currentTier > gameRef.current.lastSpeedTier && currentTier >= 1) {
        gameRef.current.lastSpeedTier = currentTier;
        setSpeedMilestoneToast(`Kecepatan naik! (${currentTier * 50} Poin)`);
        setTimeout(() => setSpeedMilestoneToast(''), 1800);
      }
    };

    const renderLoop = (now) => {
      const dtSec = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const state = gameRef.current;

      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, '#041226');
      bgGrad.addColorStop(0.65, '#0b2d56');
      bgGrad.addColorStop(1, '#103c70');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = 'rgba(186, 230, 253, 0.22)';
      for (let i = 0; i < 14; i++) {
        const sx = (i * 67 + state.frame * 0.25) % W;
        const sy = (i * 39) % (H - 60);
        ctx.fillRect(W - sx, sy, 2, 2);
      }

      if (state.running) {
        state.frame += 1;
        state.wingAngle += 0.28;

        const currentSpeed = getSpeedByScore(state.score);

        state.playSecondsAccumulator += dtSec;
        if (state.playSecondsAccumulator >= 1) {
          const wholeSeconds = Math.floor(state.playSecondsAccumulator);
          state.playSecondsAccumulator -= wholeSeconds;
          syncScoreAndMilestone(state.score + wholeSeconds);
        }

        state.birdVy += gravity;
        state.birdY += state.birdVy;

        if (state.frame % 112 === 1) {
          const minTop = 75;
          const maxTop = H - pipeGap - 95;
          const topHeight = Math.floor(Math.random() * (maxTop - minTop + 1)) + minTop;
          const pipeX = W + 25;

          state.pipes.push({
            x: pipeX,
            topHeight,
          });

          if (Math.random() < 0.30) {
            const placeAfterPipe = Math.random() < 0.5;
            const coffeeX = placeAfterPipe
              ? pipeX + pipeWidth + 46 + Math.random() * 28
              : pipeX - 46 - Math.random() * 24;

            const openSpaceCandidates = [];
            if (topHeight > 52) {
              openSpaceCandidates.push(28 + Math.random() * Math.max(10, topHeight - 62));
            }
            const bottomStartY = topHeight + pipeGap;
            if (H - 28 - bottomStartY > 36) {
              openSpaceCandidates.push(
                bottomStartY + 20 + Math.random() * Math.max(10, H - 56 - bottomStartY)
              );
            }

            if (openSpaceCandidates.length > 0) {
              const coffeeY =
                openSpaceCandidates[Math.floor(Math.random() * openSpaceCandidates.length)];
              state.coffeeItems.push({
                x: coffeeX,
                y: coffeeY,
                collected: false,
              });
            }
          }
        }

        for (let i = state.pipes.length - 1; i >= 0; i--) {
          const p = state.pipes[i];
          p.x -= currentSpeed;

          const birdHitRadius = 13;
          const inPipeX = birdX + birdHitRadius > p.x && birdX - birdHitRadius < p.x + pipeWidth;
          const hitTop = state.birdY - birdHitRadius < p.topHeight;
          const hitBottom = state.birdY + birdHitRadius > p.topHeight + pipeGap;

          if (inPipeX && (hitTop || hitBottom)) {
            triggerGameOver(state.score);
          }

          if (p.x + pipeWidth < -40) {
            state.pipes.splice(i, 1);
          }
        }

        for (let i = state.coffeeItems.length - 1; i >= 0; i--) {
          const c = state.coffeeItems[i];
          c.x -= currentSpeed;

          if (!c.collected) {
            const dist = Math.hypot(birdX - c.x, state.birdY - c.y);
            if (dist < 28) {
              c.collected = true;
              syncScoreAndMilestone(state.score + 10);
              setFloatingBonus(Date.now());
            }
          }

          if (c.x < -35 || c.collected) {
            state.coffeeItems.splice(i, 1);
          }
        }

        if (state.birdY > H - 28 || state.birdY < 14) {
          triggerGameOver(state.score);
        }
      } else if (gamePhase === 'READY') {
        state.frame += 1;
        state.wingAngle += 0.18;
        state.birdY = 200 + Math.sin(state.frame * 0.07) * 8;
      }

      state.pipes.forEach((p) => {
        ctx.fillStyle = '#0ea5e9';
        ctx.fillRect(p.x, 0, pipeWidth, p.topHeight);
        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(p.x, 0, pipeWidth, p.topHeight);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(p.x - 3, p.topHeight - 14, pipeWidth + 6, 14);

        const bottomY = p.topHeight + pipeGap;
        const bottomH = H - bottomY - 20;
        ctx.fillStyle = '#0ea5e9';
        ctx.fillRect(p.x, bottomY, pipeWidth, bottomH);
        ctx.strokeRect(p.x, bottomY, pipeWidth, bottomH);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(p.x - 3, bottomY, pipeWidth + 6, 14);
      });

      state.coffeeItems.forEach((c) => {
        if (!c.collected) {
          drawCoffeeBonus(ctx, c.x, c.y, state.frame);
        }
      });

      ctx.fillStyle = '#041226';
      ctx.fillRect(0, H - 20, W, 20);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(0, H - 20, W, 3);

      drawOwnerOnBird(ctx, birdX, state.birdY, state.birdVy, state.wingAngle, activeAccessory);

      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [
    gamePhase,
    sessionMode,
    activeAccessory,
    selectedAccessory,
    drawOwnerOnBird,
    drawCoffeeBonus,
    submitScoreToDb,
    playerName,
    playerWa,
  ]);

  const handleManualRetrySubmit = async (e) => {
    e.preventDefault();
    await submitScoreToDb(score, playerName, playerWa, selectedAccessory);
  };

  const topTenSlots = Array.from({ length: 10 }, (_, idx) => leaderboard[idx] || null);

  return (
    <div className="space-y-5 smara-animate relative">
      {!sessionMode && (
        <div className="fixed inset-0 z-50 bg-[#041226]/82 backdrop-blur-md flex items-center justify-center p-4 smara-overlay">
          {!rankStepForm ? (
            <div className="w-full max-w-sm smara-glass rounded-3xl p-6 space-y-5 border-sky-300/45 shadow-2xl smara-animate">
              <div className="text-center space-y-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-400/20 border border-sky-300/35 text-[11px] font-bold uppercase tracking-wider text-sky-200">
                  <UserCheck className="w-3.5 h-3.5" /> Pilih Mode Sesi
                </span>
                <h3 className="text-xl font-extrabold text-white pt-1">
                  Main Classic atau Rank?
                </h3>
                <p className="text-xs text-sky-200/80">
                  Pilih <strong>Classic</strong> untuk langsung main tanpa data, atau <strong>Rank</strong> untuk ikut klasemen mingguan &amp; buka aksesoris.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleChooseClassic}
                  className="w-full p-4 rounded-2xl smara-glass-soft hover:border-sky-300/60 text-left flex items-start gap-3.5 transition cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-xl bg-sky-400/20 border border-sky-300/35 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                    <Gamepad2 className="w-5 h-5 text-sky-300" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-white">CLASSIC</p>
                    <p className="text-xs text-sky-200/80 mt-0.5">
                      Langsung main tanpa perlu Nama &amp; WA (karakter polos, tanpa rank).
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleOpenRankForm}
                  className="w-full p-4 rounded-2xl bg-gradient-to-r from-sky-400/25 to-blue-500/25 hover:from-sky-400/35 hover:to-blue-500/35 border border-sky-300/50 text-left flex items-start gap-3.5 transition cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-300/40 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                    <Crown className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-white">RANK (Klasemen Mingguan)</p>
                    <p className="text-xs text-sky-200/80 mt-0.5">
                      Input Nama &amp; WA. Bisa pakai aksesoris &amp; rebut Juara 1 gratis 1 menu.
                    </p>
                  </div>
                </button>
              </div>

              <button
                type="button"
                onClick={onBack}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-sky-200 transition cursor-pointer"
              >
                Kembali ke Hub
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleConfirmRankSession}
              className="w-full max-w-sm smara-glass rounded-3xl p-6 space-y-4 border-sky-300/45 shadow-2xl smara-animate"
            >
              <div className="text-center space-y-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/35 text-[11px] font-bold uppercase tracking-wider text-amber-200">
                  <Crown className="w-3.5 h-3.5" /> Mode Rank Mingguan
                </span>
                <h3 className="text-xl font-extrabold text-white pt-1">
                  Masukkan Nama &amp; No. WA
                </h3>
                <p className="text-xs text-sky-200/80">
                  Untuk pencatatan <strong>10 Besar Mingguan</strong> (Juara 1 Gratis 1 Menu) &amp; info promo SMARA KOPI.
                </p>
              </div>

              {identityError && (
                <p className="text-xs font-semibold text-rose-300 bg-rose-500/15 border border-rose-300/30 px-3 py-2 rounded-xl text-center">
                  {identityError}
                </p>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-sky-200 mb-1">
                    Nama Panggilan
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Contoh: Rizky"
                    value={playerName}
                    onChange={(e) => {
                      setPlayerName(e.target.value);
                      if (identityError) setIdentityError('');
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl smara-input text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-sky-200 mb-1">
                    Nomor WhatsApp
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="081234567890"
                    value={playerWa}
                    onChange={(e) => {
                      setPlayerWa(e.target.value);
                      if (identityError) setIdentityError('');
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl smara-input text-sm font-semibold"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setRankStepForm(false)}
                  className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-xs font-bold text-sky-200 transition cursor-pointer"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  disabled={!hasValidRankIdentity}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-300 hover:to-blue-400 disabled:opacity-45 text-[#041226] font-extrabold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Masuk Mode Rank
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs sm:text-sm font-semibold text-sky-100 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Hub
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          {sessionMode && (
            <span className="px-3 py-1.5 rounded-xl smara-glass-soft text-xs font-bold text-sky-200 uppercase">
              {sessionMode === 'rank' ? `RANK • ${playerName}` : 'CLASSIC'}
            </span>
          )}
          {sessionMode === 'rank' && (
            <span className="px-3 py-1.5 rounded-xl smara-glass-soft text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" /> Rekor: {bestLocalScore}
            </span>
          )}
          {sessionMode && (
            <button
              type="button"
              onClick={handleLogoutSession}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-300/30 text-rose-100 text-xs font-bold transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Log Out
            </button>
          )}
        </div>
      </div>

      {sessionMode === 'rank' && (
        <div className="smara-glass rounded-3xl p-4 sm:p-5 space-y-3 smara-animate">
          <div className="flex items-center justify-between">
            <p className="text-xs font-extrabold uppercase tracking-wider text-sky-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-300" /> Aksesoris Karakter Owner (Mode Rank)
            </p>
            <span className="text-[11px] text-sky-200/75">Terbuka sesuai rekor poin</span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {ACCESSORIES.map((acc) => {
              const unlocked = bestLocalScore >= acc.minScore;
              const active = selectedAccessory === acc.id;
              return (
                <button
                  key={acc.id}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => handleSelectAccessory(acc)}
                  className={`px-3.5 py-2 rounded-2xl border text-left shrink-0 transition cursor-pointer ${
                    active
                      ? 'bg-sky-400/25 border-sky-300 text-white'
                      : unlocked
                      ? 'smara-glass-soft hover:border-sky-300/40 text-sky-100'
                      : 'bg-white/5 border-white/10 opacity-45 cursor-not-allowed text-sky-200/60'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    {!unlocked ? (
                      <Lock className="w-3 h-3 text-amber-300" />
                    ) : active ? (
                      <Check className="w-3 h-3 text-emerald-300" />
                    ) : null}
                    <span>{acc.name}</span>
                  </div>
                  <p className="text-[10px] text-sky-200/75 mt-0.5">{acc.badge}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="smara-glass rounded-3xl p-4 flex flex-col items-center relative overflow-hidden">
        <div className="w-full max-w-[360px] flex items-center justify-between px-2 pb-3 gap-2">
          <span className="text-[11px] font-bold text-sky-200 flex items-center gap-1.5">
            <Coffee className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>+1/dtk • Kopi +10</span>
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-bold text-sky-200 flex items-center gap-1">
              <Gauge className="w-3 h-3 text-sky-300" /> Lv.{speedTier}
            </span>
            {floatingBonus && Date.now() - floatingBonus < 900 && (
              <span className="text-xs font-extrabold text-amber-300 animate-bounce">+10!</span>
            )}
            <span className="px-3.5 py-1 rounded-full bg-sky-400/20 border border-sky-300/40 font-mono text-lg font-extrabold text-white">
              {score}
            </span>
          </div>
        </div>

        <div className="relative rounded-2xl overflow-hidden border border-sky-300/30 shadow-xl select-none touch-manipulation">
          <canvas
            ref={canvasRef}
            width={360}
            height={440}
            onPointerDown={handleCanvasTap}
            className="block max-w-full h-auto cursor-pointer"
          />

          {speedMilestoneToast && gamePhase === 'PLAYING' && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-amber-400/90 text-[#041226] text-[11px] font-extrabold shadow-lg pointer-events-none whitespace-nowrap smara-animate">
              {speedMilestoneToast}
            </div>
          )}

          {gamePhase === 'READY' && sessionMode && (
            <div
              onClick={handleCanvasTap}
              className="absolute inset-0 bg-[#041226]/55 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center cursor-pointer space-y-3"
            >
              <div className="w-14 h-14 rounded-2xl bg-sky-400 text-[#041226] flex items-center justify-center shadow-lg animate-bounce">
                <Play className="w-7 h-7 fill-current" />
              </div>
              <h3 className="text-xl font-extrabold text-white">Tap Layar untuk Terbang!</h3>
              <p className="text-xs text-sky-100/85 max-w-[240px]">
                Poin naik +1 tiap detik, kecepatan naik tiap 50 poin, dan sambar kopi <strong>+10</strong>!
              </p>
            </div>
          )}

          {gamePhase === 'GAMEOVER' && sessionMode && (
            <div className="absolute inset-0 bg-[#041226]/85 backdrop-blur-md flex flex-col items-center justify-center p-5 text-center space-y-3.5 smara-animate overflow-y-auto">
              <span className="px-3 py-1 rounded-full bg-rose-500/25 border border-rose-300/40 text-[11px] font-extrabold text-rose-200 uppercase">
                Yah, Nabrak!
              </span>
              <div>
                <p className="text-xs text-sky-200/80">
                  Skor Akhir {sessionMode === 'rank' && playerName ? playerName : 'Kamu'}
                </p>
                <p className="text-4xl font-extrabold text-white">{score}</p>
              </div>

              {sessionMode === 'classic' && (
                <p className="text-[11px] text-sky-200/80 bg-white/5 border border-white/15 px-3 py-2 rounded-xl">
                  Mode <strong>Classic</strong>: skor tidak masuk klasemen mingguan. Tekan <strong>Log Out</strong> untuk masuk mode <strong>Rank</strong>.
                </p>
              )}

              {sessionMode === 'rank' && submitting && (
                <p className="text-xs text-sky-200 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Menyimpan ke ranking mingguan...
                </p>
              )}

              {sessionMode === 'rank' && submitMsg && (
                <p className="text-xs font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-300/30 px-3 py-2 rounded-xl">
                  {submitMsg}
                </p>
              )}

              {sessionMode === 'rank' && score > 0 && !submitMsg && !submitting && (
                <form onSubmit={handleManualRetrySubmit} className="w-full space-y-2">
                  {submitError && <p className="text-xs text-rose-300 font-semibold">{submitError}</p>}
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#041226] font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" /> Simpan Skor ({score} pts) ke Rank
                  </button>
                </form>
              )}

              <button
                type="button"
                onClick={startGame}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-300 hover:to-blue-400 text-[#041226] font-extrabold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" /> Main Lagi
              </button>
            </div>
          )}
        </div>
      </div>

      {/* LIST 10 PEMENANG / PERINGKAT MINGGUAN TERATAS (#1 - #10) */}
      <div className="smara-glass rounded-3xl p-5 space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-300" /> 10 Besar Mingguan ({weekKey || '...'})
            </h3>
            <p className="text-[11px] text-sky-200/80 flex items-center gap-1 mt-0.5">
              <Gift className="w-3 h-3 text-amber-300" /> Juara #1 tiap minggu bebas pilih <strong>1 Menu Gratis</strong> di SMARA KOPI!
            </p>
          </div>
          <button
            type="button"
            onClick={fetchLeaderboard}
            disabled={loadingBoard}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-sky-200 transition cursor-pointer"
            title="Refresh Klasemen"
          >
            <RefreshCw className={`w-4 h-4 ${loadingBoard ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="space-y-1.5">
          {topTenSlots.map((row, idx) => {
            const rankNum = idx + 1;
            if (!row) {
              return (
                <div
                  key={`slot-${rankNum}`}
                  className="px-3.5 py-2 rounded-2xl flex items-center justify-between text-xs bg-white/5 border border-white/10 text-sky-200/45"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center font-bold text-[11px]">
                      #{rankNum}
                    </span>
                    <span>Slot kosong</span>
                  </div>
                  <span className="font-mono text-[11px]">-</span>
                </div>
              );
            }

            const accObj = ACCESSORIES.find((a) => a.id === row.accessory);
            return (
              <div
                key={row.id}
                className={`px-3.5 py-2.5 rounded-2xl flex items-center justify-between text-xs border ${
                  rankNum === 1
                    ? 'bg-amber-400/15 border-amber-300/45 text-white'
                    : rankNum <= 3
                    ? 'bg-sky-400/10 border-sky-300/30 text-white'
                    : 'smara-glass-soft text-sky-100'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-extrabold text-[11px] shrink-0 ${
                      rankNum === 1
                        ? 'bg-amber-400 text-[#041226]'
                        : rankNum <= 3
                        ? 'bg-sky-400 text-[#041226]'
                        : 'bg-white/10 text-sky-200'
                    }`}
                  >
                    #{rankNum}
                  </span>
                  <div className="truncate">
                    <p className="font-bold truncate">{row.player_name}</p>
                    {accObj && accObj.id !== 'none' && (
                      <p className="text-[10px] text-sky-300">{accObj.name}</p>
                    )}
                  </div>
                </div>
                <span className="font-mono font-extrabold text-sm text-amber-300 shrink-0">
                  {row.best_score} pts
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
