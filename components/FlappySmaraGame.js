'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Trophy,
  Coffee,
  Play,
  RotateCcw,
  Sparkles,
  Send,
  Loader2,
  Crown,
  Gift,
  UserCheck,
  Gauge,
  LogOut,
  Gamepad2,
  RefreshCw,
  Award,
  Share2,
} from 'lucide-react';
import SmaraLogo from '@/components/SmaraLogo';
import FlappyAchievementPanel from '@/components/FlappyAchievementPanel';
import FlappyShareModal from '@/components/FlappyShareModal';
import {
  ACHIEVEMENTS,
  drawOwnerOnBird,
  drawCoffeeBonus,
  parseAccessories,
} from '@/lib/flappyCharacter';

const CANVAS_W = 360;
const CANVAS_H = 440;
const GROUND_H = 22;
const BIRD_X = 88;
const PIPE_WIDTH = 52;
const GRAVITY = 0.30;
const FLAP_VY = -5.7;
const MAX_FALL_VY = 8.2;
const SPEED_STEP_SECONDS = 15; // kecepatan naik berkala tiap 15 detik

function cleanWaDigits(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('0')) {
    digits = '62' + digits.slice(1);
  } else if (digits.startsWith('8')) {
    digits = '62' + digits;
  }
  return digits;
}

function getSpeedBySeconds(survivalSeconds) {
  const sec = Math.max(0, survivalSeconds);
  // Mulai dari 2.25 px/frame (60fps), naik berkala halus hingga maksimal 4.65
  return Math.min(4.65, 2.25 + (sec / SPEED_STEP_SECONDS) * 0.28);
}

function getSpeedTierBySeconds(survivalSeconds) {
  return Math.min(10, Math.floor(Math.max(0, survivalSeconds) / SPEED_STEP_SECONDS) + 1);
}

/**
 * Verifikasi ketat posisi gelas kopi (+10):
 * Dijamin TIDAK PERNAH menempel/menyatu dengan tiang, langit-langit, tanah,
 * ataupun gelas kopi lainnya.
 */
function isSafeCoffeePosition(cx, cy, pipes, existingCoffees) {
  const coffeeRadiusWithBuffer = 21;
  const pipeCapExtra = 5;

  if (cy < 48 || cy > CANVAS_H - GROUND_H - 48) return false;

  for (const other of existingCoffees) {
    if (!other.collected && Math.hypot(cx - other.x, cy - other.y) < 72) {
      return false;
    }
  }

  for (const p of pipes) {
    const leftBound = p.x - pipeCapExtra - coffeeRadiusWithBuffer;
    const rightBound = p.x + PIPE_WIDTH + pipeCapExtra + coffeeRadiusWithBuffer;
    if (cx >= leftBound && cx <= rightBound) {
      // Jika sejajar horizontal dengan tiang, HARUS berada di tengah celah aman
      const safeTop = p.topHeight + 36;
      const safeBottom = p.topHeight + p.gap - 36;
      if (safeTop >= safeBottom || cy < safeTop || cy > safeBottom) {
        return false;
      }
    }
  }

  return true;
}

export default function FlappySmaraGame({ onBack }) {
  const canvasRef = useRef(null);

  const [sessionMode, setSessionMode] = useState(null); // null | 'classic' | 'rank'
  const [rankStepForm, setRankStepForm] = useState(false);
  const [activeTab, setActiveTab] = useState('play'); // 'play' | 'achievement'

  const [playerName, setPlayerName] = useState('');
  const [playerWa, setPlayerWa] = useState('');
  const [identityError, setIdentityError] = useState('');
  const [registeringRank, setRegisteringRank] = useState(false);

  const [gamePhase, setGamePhase] = useState('READY'); // 'READY' | 'PLAYING' | 'GAMEOVER'
  const [score, setScore] = useState(0);
  const [speedTier, setSpeedTier] = useState(1);
  const [bestScore, setBestScore] = useState(0);
  const [weeklyBestScore, setWeeklyBestScore] = useState(0);
  const [weeklyRank, setWeeklyRank] = useState(null);
  const [totalPlayers, setTotalPlayers] = useState(0);

  const [equippedAccessories, setEquippedAccessories] = useState([]);
  const [newlyUnlockedIds, setNewlyUnlockedIds] = useState([]);
  const [hasUnseenUnlock, setHasUnseenUnlock] = useState(false);

  const [speedMilestoneToast, setSpeedMilestoneToast] = useState('');
  const [weekKey, setWeekKey] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingBoard, setLoadingBoard] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');
  const [submitError, setSubmitError] = useState('');

  // Share Card Modal
  const [shareOpen, setShareOpen] = useState(false);
  const [shareScoreValue, setShareScoreValue] = useState(0);

  const waDigits = cleanWaDigits(playerWa);
  const hasValidRankIdentity =
    playerName.trim().length >= 2 && waDigits.length >= 10 && waDigits.length <= 15;

  // Ref untuk diakses game loop tanpa me-restart requestAnimationFrame
  const activeAccessoriesRef = useRef([]);
  activeAccessoriesRef.current = sessionMode === 'rank' ? equippedAccessories : [];

  const sessionInfoRef = useRef({
    sessionMode: null,
    playerName: '',
    playerWa: '',
    bestScore: 0,
    equippedAccessories: [],
  });
  sessionInfoRef.current = {
    sessionMode,
    playerName,
    playerWa,
    bestScore,
    equippedAccessories,
  };

  const gamePhaseRef = useRef('READY');
  gamePhaseRef.current = gamePhase;

  const gameRef = useRef({
    birdY: 205,
    birdVy: 0,
    pipes: [],
    coffeeItems: [],
    popups: [], // teks melayang "+10" di canvas
    particles: [], // percikan efek ambil kopi
    frame: 0,
    scrollX: 0,
    survivalSeconds: 0,
    playSecondsAccumulator: 0,
    lastSpeedTier: 1,
    pipesSinceCoffee: 0,
    score: 0,
    wingAngle: 0,
    running: false,
  });

  // Muat nama & WA terakhir dari localStorage
  useEffect(() => {
    const savedName = localStorage.getItem('smara_flappy_name') || '';
    const savedWa = localStorage.getItem('smara_flappy_wa') || '';
    if (savedName) setPlayerName(savedName);
    if (savedWa) setPlayerWa(savedWa);
  }, []);

  const applyServerState = useCallback((data, waKey = '') => {
    if (!data) return;
    if (data.weekKey) setWeekKey(data.weekKey);
    if (Array.isArray(data.leaderboard)) {
      setLeaderboard(data.leaderboard.slice(0, 10));
    }
    if (typeof data.totalPlayers === 'number') {
      setTotalPlayers(data.totalPlayers);
    }
    if (data.me) {
      if (typeof data.me.rank === 'number') setWeeklyRank(data.me.rank);
      if (typeof data.me.best_score === 'number') setWeeklyBestScore(data.me.best_score);

      const serverBest = Math.max(
        Number(data.me.all_time_best || 0),
        Number(data.me.best_score || 0)
      );
      setBestScore((prev) => {
        const merged = Math.max(prev, serverBest);
        if (waKey) localStorage.setItem(`smara_flappy_best_${waKey}`, String(merged));
        return merged;
      });
    }
  }, []);

  const fetchLeaderboard = useCallback(
    async (waOverride) => {
      setLoadingBoard(true);
      try {
        const targetWa = cleanWaDigits(waOverride !== undefined ? waOverride : playerWa);
        const qs = targetWa.length >= 10 ? `?wa=${encodeURIComponent(targetWa)}` : '';
        const res = await fetch(`/api/flappy${qs}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          applyServerState(data, targetWa);
        }
      } catch {
      } finally {
        setLoadingBoard(false);
      }
    },
    [playerWa, applyServerState]
  );

  useEffect(() => {
    fetchLeaderboard('');
  }, [fetchLeaderboard]);

  const syncAccessoriesToDb = useCallback(
    async (nextAccList) => {
      const info = sessionInfoRef.current;
      if (info.sessionMode !== 'rank') return;
      const cleanWa = cleanWaDigits(info.playerWa);
      const cleanName = info.playerName.trim();
      if (cleanName.length < 2 || cleanWa.length < 10) return;

      localStorage.setItem(`smara_flappy_acc_${cleanWa}`, JSON.stringify(nextAccList));

      try {
        const res = await fetch('/api/flappy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'UPDATE_ACCESSORIES',
            name: cleanName,
            wa: cleanWa,
            accessories: nextAccList,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          applyServerState(data, cleanWa);
        }
      } catch {}
    },
    [applyServerState]
  );

  const handleToggleAccessory = useCallback(
    (accId) => {
      if (sessionMode !== 'rank') return;
      const ach = ACHIEVEMENTS.find((a) => a.id === accId);
      if (!ach || bestScore < ach.minScore) return;

      setEquippedAccessories((prev) => {
        const exists = prev.includes(accId);
        const next = exists ? prev.filter((id) => id !== accId) : [...prev, accId];
        syncAccessoriesToDb(next);
        return next;
      });
    },
    [sessionMode, bestScore, syncAccessoriesToDb]
  );

  const handleEquipAllUnlocked = useCallback(() => {
    if (sessionMode !== 'rank') return;
    const allUnlocked = ACHIEVEMENTS.filter((a) => bestScore >= a.minScore).map((a) => a.id);
    setEquippedAccessories(allUnlocked);
    syncAccessoriesToDb(allUnlocked);
  }, [sessionMode, bestScore, syncAccessoriesToDb]);

  const handleClearAllAccessories = useCallback(() => {
    if (sessionMode !== 'rank') return;
    setEquippedAccessories([]);
    syncAccessoriesToDb([]);
  }, [sessionMode, syncAccessoriesToDb]);

  const submitScoreToDb = useCallback(
    async (finalScore, nameVal, waVal, accList) => {
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
            action: 'SAVE_SCORE',
            name: cleanName,
            wa: cleanWa,
            score: Math.max(0, Math.floor(Number(finalScore || 0))),
            accessories: parseAccessories(accList),
          }),
        });
        const data = await res.json();
        if (res.ok) {
          applyServerState(data, cleanWa);
          const rankText = data.me?.rank ? `Peringkat kamu sekarang #${data.me.rank} minggu ini!` : '';
          setSubmitMsg(`Skor masuk klasemen mingguan! ${rankText}`.trim());
        } else {
          setSubmitError(data.error || 'Gagal menyimpan skor');
        }
      } catch (err) {
        setSubmitError(err.message);
      } finally {
        setSubmitting(false);
      }
    },
    [applyServerState]
  );

  const handleChooseClassic = () => {
    gameRef.current.running = false;
    setGamePhase('READY');
    setActiveTab('play');
    setScore(0);
    setSpeedTier(1);
    setRankStepForm(false);
    setIdentityError('');
    setNewlyUnlockedIds([]);
    setHasUnseenUnlock(false);
    setSessionMode('classic');
  };

  const handleOpenRankForm = () => {
    setIdentityError('');
    setRankStepForm(true);
  };

  const handleConfirmRankSession = async (e) => {
    e.preventDefault();
    if (!hasValidRankIdentity) {
      setIdentityError('Isi Nama Panggilan (min. 2 huruf) dan Nomor WA valid (min. 10 digit).');
      return;
    }

    const cleanName = playerName.trim();
    const cleanWa = cleanWaDigits(playerWa);
    setIdentityError('');
    setRegisteringRank(true);

    localStorage.setItem('smara_flappy_name', cleanName);
    localStorage.setItem('smara_flappy_wa', playerWa.trim());

    // Muat rekor & aksesoris lokal khusus WA ini (dengan fallback legacy storage)
    const localBestWa = Number(
      localStorage.getItem(`smara_flappy_best_${cleanWa}`) ||
        localStorage.getItem('smara_flappy_best') ||
        0
    );
    const localAccRaw =
      localStorage.getItem(`smara_flappy_acc_${cleanWa}`) ||
      localStorage.getItem('smara_flappy_acc') ||
      '';
    const initialAcc = parseAccessories(localAccRaw);

    try {
      // Langsung daftarkan pemain ke database & klasemen mingguan saat login mode Rank!
      const res = await fetch('/api/flappy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REGISTER',
          name: cleanName,
          wa: cleanWa,
          score: 0,
          accessories: initialAcc,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mendaftarkan sesi Rank');
      }

      const serverBest = Math.max(
        Number(data.me?.all_time_best || 0),
        Number(data.me?.best_score || 0),
        localBestWa
      );
      setBestScore(serverBest);
      localStorage.setItem(`smara_flappy_best_${cleanWa}`, String(serverBest));

      // Gabungkan aksesoris yang tersimpan (utamakan server jika ada) & filter hanya yang sudah terbuka
      const rawChosen =
        data.me?.accessories?.length > 0 ? data.me.accessories : initialAcc;
      const validUnlocked = parseAccessories(rawChosen).filter((id) => {
        const ach = ACHIEVEMENTS.find((a) => a.id === id);
        return ach && serverBest >= ach.minScore;
      });
      setEquippedAccessories(validUnlocked);
      localStorage.setItem(`smara_flappy_acc_${cleanWa}`, JSON.stringify(validUnlocked));

      applyServerState(data, cleanWa);

      gameRef.current.running = false;
      setGamePhase('READY');
      setActiveTab('play');
      setScore(0);
      setSpeedTier(1);
      setNewlyUnlockedIds([]);
      setHasUnseenUnlock(false);
      setRankStepForm(false);
      setSessionMode('rank');
    } catch (err) {
      setIdentityError(err.message || 'Gagal terhubung ke server.');
    } finally {
      setRegisteringRank(false);
    }
  };

  const handleLogoutSession = () => {
    gameRef.current.running = false;
    setGamePhase('READY');
    setActiveTab('play');
    setScore(0);
    setSpeedTier(1);
    setSubmitMsg('');
    setSubmitError('');
    setNewlyUnlockedIds([]);
    setHasUnseenUnlock(false);
    setRankStepForm(false);
    setSessionMode(null);
  };

  const handleSwitchTab = (tab) => {
    if (tab === 'achievement') {
      gameRef.current.running = false;
      if (gamePhase === 'PLAYING') {
        setGamePhase('READY');
      }
      setHasUnseenUnlock(false);
    }
    setActiveTab(tab);
  };

  const startGame = useCallback(() => {
    if (!sessionInfoRef.current.sessionMode) return;

    gameRef.current = {
      birdY: 205,
      birdVy: FLAP_VY,
      pipes: [],
      coffeeItems: [],
      popups: [],
      particles: [],
      frame: 0,
      scrollX: 0,
      survivalSeconds: 0,
      playSecondsAccumulator: 0,
      lastSpeedTier: 1,
      pipesSinceCoffee: 0,
      score: 0,
      wingAngle: 1.2,
      running: true,
    };
    setScore(0);
    setSpeedTier(1);
    setSpeedMilestoneToast('');
    setSubmitMsg('');
    setSubmitError('');
    setNewlyUnlockedIds([]);
    setGamePhase('PLAYING');
  }, []);

  const handleCanvasTap = useCallback(
    (e) => {
      if (e) e.preventDefault();
      if (!sessionInfoRef.current.sessionMode) return;
      if (gamePhaseRef.current === 'READY') {
        startGame();
        return;
      }
      if (gamePhaseRef.current === 'PLAYING' && gameRef.current.running) {
        gameRef.current.birdVy = FLAP_VY;
        gameRef.current.wingAngle += 1.5;
      }
    },
    [startGame]
  );

  // Kontrol keyboard (Spasi / Panah Atas) saat di tab Main
  useEffect(() => {
    const onKeyDown = (e) => {
      if (activeTab !== 'play' || !sessionMode || shareOpen) return;
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        if (gamePhaseRef.current === 'READY' || gamePhaseRef.current === 'PLAYING') {
          e.preventDefault();
          handleCanvasTap();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab, sessionMode, shareOpen, handleCanvasTap]);

  // ===== GAME LOOP UTAMA (Delta-Time Normalized 60fps) =====
  useEffect(() => {
    if (activeTab !== 'play') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let animId;
    let lastTime = performance.now();

    const triggerGameOver = (finalScore) => {
      if (!gameRef.current.running) return;
      gameRef.current.running = false;
      setGamePhase('GAMEOVER');

      const info = sessionInfoRef.current;
      if (info.sessionMode === 'rank') {
        const cleanWa = cleanWaDigits(info.playerWa);
        const prevBest = info.bestScore;
        const nextBest = Math.max(prevBest, finalScore);

        if (nextBest > prevBest) {
          setBestScore(nextBest);
          if (cleanWa) localStorage.setItem(`smara_flappy_best_${cleanWa}`, String(nextBest));

          const unlockedNow = ACHIEVEMENTS.filter(
            (a) => prevBest < a.minScore && nextBest >= a.minScore
          ).map((a) => a.id);

          if (unlockedNow.length > 0) {
            setNewlyUnlockedIds(unlockedNow);
            setHasUnseenUnlock(true);
          }
        }

        // Berapapun hasil skornya (termasuk 0), langsung kirim ke DB & perbarui Top 10!
        submitScoreToDb(finalScore, info.playerName, info.playerWa, info.equippedAccessories);
      }
    };

    const spawnPipeAndCoffee = (state, currentSpeed, tier) => {
      const pipeGap = Math.max(126, Math.round(142 - (tier - 1) * 2));
      const minTop = 62;
      const maxTop = CANVAS_H - GROUND_H - pipeGap - 62;
      const prevPipe = state.pipes[state.pipes.length - 1] || null;

      let low = minTop;
      let high = maxTop;
      if (prevPipe) {
        // Batasi lonjakan vertikal antar tiang agar jalur selalu adil & bisa dilewati
        low = Math.max(minTop, prevPipe.topHeight - 115);
        high = Math.min(maxTop, prevPipe.topHeight + 115);
      }

      const topHeight = Math.floor(Math.random() * (high - low + 1)) + low;
      const pipeX = CANVAS_W + 32;
      const newPipe = { x: pipeX, topHeight, gap: pipeGap };
      state.pipes.push(newPipe);

      // Putuskan spawn gelas kopi (+10): minimal muncul rutin tanpa terlalu padat
      state.pipesSinceCoffee += 1;
      const shouldSpawnCoffee =
        state.pipesSinceCoffee >= 3 ||
        (state.pipesSinceCoffee >= 2 && Math.random() < 0.65) ||
        (state.pipesSinceCoffee === 1 && Math.random() < 0.25);

      if (shouldSpawnCoffee) {
        const candidates = [];

        // Opsi 1: Di ruang terbuka tepat di TENGAH antara tiang sebelumnya & tiang baru
        if (prevPipe) {
          const gapBetweenPipes = newPipe.x - (prevPipe.x + PIPE_WIDTH);
          if (gapBetweenPipes >= 115) {
            const midX = prevPipe.x + PIPE_WIDTH + gapBetweenPipes / 2;
            const prevGapCenter = prevPipe.topHeight + prevPipe.gap / 2;
            const newGapCenter = newPipe.topHeight + newPipe.gap / 2;
            const midY = Math.max(
              54,
              Math.min(
                CANVAS_H - GROUND_H - 54,
                (prevGapCenter + newGapCenter) / 2 + (Math.random() - 0.5) * 60
              )
            );
            candidates.push({ x: midX, y: midY });
          }
        }

        // Opsi 2: Tepat di tengah CELAH AMAN tiang baru (jauh dari bibir atas & bawah tiang)
        const safeMinY = newPipe.topHeight + 38;
        const safeMaxY = newPipe.topHeight + newPipe.gap - 38;
        if (safeMaxY > safeMinY) {
          const gapX = newPipe.x + PIPE_WIDTH / 2;
          const gapY = safeMinY + Math.random() * (safeMaxY - safeMinY);
          candidates.push({ x: gapX, y: gapY });
        }

        // Acak urutan pilihan, lalu validasi ketat dengan isSafeCoffeePosition
        if (candidates.length === 2 && Math.random() < 0.45) {
          candidates.reverse();
        }

        for (const pos of candidates) {
          if (isSafeCoffeePosition(pos.x, pos.y, state.pipes, state.coffeeItems)) {
            state.coffeeItems.push({
              x: pos.x,
              y: pos.y,
              collected: false,
            });
            state.pipesSinceCoffee = 0;
            break;
          }
        }
      }
    };

    const renderLoop = (now) => {
      const dtSec = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;
      const step = dtSec * 60;

      const state = gameRef.current;

      // ===== 1. BACKGROUND LANGIT MALAM SMARA =====
      const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      bgGrad.addColorStop(0, '#041226');
      bgGrad.addColorStop(0.62, '#0a2950');
      bgGrad.addColorStop(1, '#103c70');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Bintang parallax lembut
      ctx.fillStyle = 'rgba(186, 230, 253, 0.28)';
      for (let i = 0; i < 16; i++) {
        const sx = (i * 67 + state.scrollX * 0.14) % CANVAS_W;
        const sy = 16 + ((i * 39) % (CANVAS_H - 90));
        ctx.fillRect(CANVAS_W - sx, sy, i % 3 === 0 ? 2.2 : 1.5, i % 3 === 0 ? 2.2 : 1.5);
      }

      // Siluet awan/kota malam halus di latar belakang
      ctx.fillStyle = 'rgba(4, 18, 38, 0.28)';
      for (let i = 0; i < 6; i++) {
        const cx = ((i * 95 - (state.scrollX * 0.25) % 570) + 570) % 570 - 80;
        const ch = 26 + (i % 3) * 14;
        ctx.fillRect(cx, CANVAS_H - GROUND_H - ch, 68, ch);
      }

      // ===== 2. UPDATE LOGIKA GAME =====
      if (state.running) {
        state.frame += step;
        state.wingAngle += 0.27 * step;
        state.survivalSeconds += dtSec;

        const currentSpeed = getSpeedBySeconds(state.survivalSeconds);
        const currentTier = getSpeedTierBySeconds(state.survivalSeconds);
        state.scrollX += currentSpeed * step;

        if (currentTier > state.lastSpeedTier) {
          state.lastSpeedTier = currentTier;
          setSpeedTier(currentTier);
          setSpeedMilestoneToast(`⚡ Kecepatan Naik! Lv.${currentTier}`);
          setTimeout(() => setSpeedMilestoneToast(''), 1800);
        }

        // +1 poin setiap detik bertahan
        state.playSecondsAccumulator += dtSec;
        if (state.playSecondsAccumulator >= 1) {
          const wholeSec = Math.floor(state.playSecondsAccumulator);
          state.playSecondsAccumulator -= wholeSec;
          state.score += wholeSec;
          setScore(state.score);
        }

        // Fisika burung (terkalibrasi delta-time)
        state.birdVy = Math.min(MAX_FALL_VY, state.birdVy + GRAVITY * step);
        state.birdY += state.birdVy * step;

        // Spawn tiang berbasis JARAK horizontal (bukan frame)
        const pipeSpacing = Math.round(220 + (currentSpeed - 2.25) * 28);
        const lastPipe = state.pipes[state.pipes.length - 1];
        if (!lastPipe || CANVAS_W + 32 - lastPipe.x >= pipeSpacing) {
          spawnPipeAndCoffee(state, currentSpeed, currentTier);
        }

        // Gerakkan & cek tabrakan tiang
        const birdHitR = 11.5;
        for (let i = state.pipes.length - 1; i >= 0; i--) {
          const p = state.pipes[i];
          p.x -= currentSpeed * step;

          const inPipeX = BIRD_X + birdHitR > p.x && BIRD_X - birdHitR < p.x + PIPE_WIDTH;
          const hitTop = state.birdY - birdHitR < p.topHeight;
          const hitBottom = state.birdY + birdHitR > p.topHeight + p.gap;

          if (inPipeX && (hitTop || hitBottom)) {
            triggerGameOver(state.score);
          }

          if (p.x + PIPE_WIDTH < -48) {
            state.pipes.splice(i, 1);
          }
        }

        // Gerakkan & cek sentuhan gelas kopi (+10 poin)
        for (let i = state.coffeeItems.length - 1; i >= 0; i--) {
          const c = state.coffeeItems[i];
          c.x -= currentSpeed * step;

          if (!c.collected) {
            const dist = Math.hypot(BIRD_X - c.x, state.birdY - c.y);
            if (dist < 29) {
              c.collected = true;
              state.score += 10;
              setScore(state.score);

              // Efek popup "+10" dan percikan di posisi kopi
              state.popups.push({ x: c.x, y: c.y - 8, alpha: 1, text: '+10' });
              for (let k = 0; k < 8; k++) {
                const ang = (k * Math.PI * 2) / 8 + Math.random() * 0.4;
                state.particles.push({
                  x: c.x,
                  y: c.y,
                  vx: Math.cos(ang) * (1.8 + Math.random() * 1.6),
                  vy: Math.sin(ang) * (1.8 + Math.random() * 1.6),
                  alpha: 1,
                  color: k % 2 === 0 ? '#fde047' : '#7dd3fc',
                });
              }
            }
          }

          if (c.x < -40 || c.collected) {
            state.coffeeItems.splice(i, 1);
          }
        }

        // Cek batas lantai & langit-langit
        if (state.birdY > CANVAS_H - GROUND_H - 12 || state.birdY < 16) {
          triggerGameOver(state.score);
        }
      } else if (gamePhaseRef.current === 'READY') {
        state.frame += step;
        state.scrollX += 0.7 * step;
        state.wingAngle += 0.18 * step;
        state.birdY = 205 + Math.sin(state.frame * 0.07) * 8;
        state.birdVy = 0;
      }

      // ===== 3. RENDER TIANG =====
      state.pipes.forEach((p) => {
        const pipeGrad = ctx.createLinearGradient(p.x, 0, p.x + PIPE_WIDTH, 0);
        pipeGrad.addColorStop(0, '#0284c7');
        pipeGrad.addColorStop(0.35, '#38bdf8');
        pipeGrad.addColorStop(1, '#0369a1');

        // Tiang atas
        ctx.fillStyle = pipeGrad;
        ctx.fillRect(p.x, 0, PIPE_WIDTH, p.topHeight);
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.75)';
        ctx.lineWidth = 1.4;
        ctx.strokeRect(p.x, 0, PIPE_WIDTH, p.topHeight);
        // Bibir tiang atas
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.roundRect(p.x - 3, p.topHeight - 14, PIPE_WIDTH + 6, 14, 3);
        ctx.fill();
        ctx.stroke();

        // Tiang bawah
        const bottomY = p.topHeight + p.gap;
        const bottomH = CANVAS_H - bottomY - GROUND_H;
        ctx.fillStyle = pipeGrad;
        ctx.fillRect(p.x, bottomY, PIPE_WIDTH, bottomH);
        ctx.strokeRect(p.x, bottomY, PIPE_WIDTH, bottomH);
        // Bibir tiang bawah
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.roundRect(p.x - 3, bottomY, PIPE_WIDTH + 6, 14, 3);
        ctx.fill();
        ctx.stroke();
      });

      // ===== 4. RENDER GELAS KOPI (+10) =====
      state.coffeeItems.forEach((c) => {
        if (!c.collected) {
          drawCoffeeBonus(ctx, c.x, c.y, state.frame);
        }
      });

      // ===== 5. RENDER PERCIKAN & POPUP +10 =====
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const pt = state.particles[i];
        pt.x += pt.vx * step;
        pt.y += pt.vy * step;
        pt.alpha -= 0.04 * step;
        if (pt.alpha <= 0) {
          state.particles.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = pt.alpha;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      for (let i = state.popups.length - 1; i >= 0; i--) {
        const pop = state.popups[i];
        pop.y -= 1.15 * step;
        pop.alpha -= 0.025 * step;
        if (pop.alpha <= 0) {
          state.popups.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = pop.alpha;
        ctx.font = '800 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#041226';
        ctx.lineWidth = 3.5;
        ctx.strokeText(pop.text, pop.x, pop.y);
        ctx.fillStyle = '#fde047';
        ctx.fillText(pop.text, pop.x, pop.y);
        ctx.restore();
      }

      // ===== 6. LANTAI BERGERAK =====
      ctx.fillStyle = '#041226';
      ctx.fillRect(0, CANVAS_H - GROUND_H, CANVAS_W, GROUND_H);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(0, CANVAS_H - GROUND_H, CANVAS_W, 3);
      // Garis strip gerak halus di lantai
      ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
      const stripeOffset = state.scrollX % 24;
      for (let gx = -stripeOffset; gx < CANVAS_W + 24; gx += 24) {
        ctx.fillRect(gx, CANVAS_H - GROUND_H + 7, 10, 4);
      }

      // ===== 7. KARAKTER OWNER + AKSESORIS BERTUMPUK =====
      drawOwnerOnBird(
        ctx,
        BIRD_X,
        state.birdY,
        state.birdVy,
        state.wingAngle,
        activeAccessoriesRef.current,
        state.frame,
        1
      );

      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [activeTab, submitScoreToDb]);

  const handleManualRetrySubmit = async (e) => {
    e.preventDefault();
    await submitScoreToDb(score, playerName, playerWa, equippedAccessories);
  };

  const openShareModal = (overrideScore) => {
    setShareScoreValue(
      overrideScore !== undefined ? overrideScore : Math.max(score, weeklyBestScore, bestScore)
    );
    setShareOpen(true);
  };

  const unlockedCount =
    sessionMode === 'rank'
      ? ACHIEVEMENTS.filter((a) => bestScore >= a.minScore).length
      : 0;
  const topTenSlots = Array.from({ length: 10 }, (_, idx) => leaderboard[idx] || null);

  return (
    <div className="space-y-4 smara-animate relative">
      {/* ===== MODAL SHARE KARTU SKOR (SCREENSHOT-ABLE) ===== */}
      <FlappyShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        playerName={playerName}
        sessionMode={sessionMode}
        displayScore={shareScoreValue}
        bestScore={bestScore}
        weeklyRank={weeklyRank}
        totalPlayers={totalPlayers}
        weekKey={weekKey}
        equippedAccessories={equippedAccessories}
      />

      {/* ===== MODAL PILIH MODE CLASSIC / RANK ===== */}
      {!sessionMode && (
        <div className="fixed inset-0 z-50 bg-[#041226]/82 backdrop-blur-md flex items-center justify-center p-4 smara-overlay">
          {!rankStepForm ? (
            <div className="w-full max-w-sm smara-glass rounded-3xl p-6 space-y-5 border-sky-300/45 shadow-2xl smara-animate">
              <div className="text-center space-y-2">
                <SmaraLogo size="sm" />
                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-400/20 border border-sky-300/35 text-[11px] font-bold uppercase tracking-wider text-sky-200">
                    <UserCheck className="w-3.5 h-3.5" /> Pilih Mode Sesi
                  </span>
                </div>
                <h3 className="text-xl font-extrabold text-white">
                  Main Classic atau Rank?
                </h3>
                <p className="text-xs text-sky-200/80">
                  Pilih <strong>Classic</strong> untuk langsung main santai, atau <strong>Rank</strong> untuk masuk klasemen mingguan &amp; buka Achievement aksesoris!
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
                      Input Nama &amp; WA. Langsung masuk klasemen, buka Achievement aksesoris, &amp; rebut Juara 1 gratis 1 menu!
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
              <div className="text-center space-y-1.5">
                <SmaraLogo size="sm" />
                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/35 text-[11px] font-bold uppercase tracking-wider text-amber-200">
                    <Crown className="w-3.5 h-3.5" /> Mode Rank Mingguan
                  </span>
                </div>
                <h3 className="text-xl font-extrabold text-white">
                  Masukkan Nama &amp; No. WA
                </h3>
                <p className="text-xs text-sky-200/80">
                  Berapapun skornya langsung tercatat di <strong>10 Besar Mingguan</strong> (Juara 1 Gratis 1 Menu SMARA KOPI!).
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
                  disabled={registeringRank}
                  onClick={() => setRankStepForm(false)}
                  className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-xs font-bold text-sky-200 transition cursor-pointer"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  disabled={!hasValidRankIdentity || registeringRank}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-300 hover:to-blue-400 disabled:opacity-45 text-[#041226] font-extrabold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  {registeringRank ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 fill-current" />
                  )}
                  {registeringRank ? 'Mendaftarkan...' : 'Masuk Mode Rank'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ===== BARIS ATAS NAVIGASI ===== */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs sm:text-sm font-semibold text-sky-100 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Hub
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          {sessionMode && (
            <span className="px-3 py-1.5 rounded-xl smara-glass-soft text-xs font-bold text-sky-200 uppercase">
              {sessionMode === 'rank'
                ? `RANK • ${playerName}${weeklyRank ? ` (#${weeklyRank})` : ''}`
                : 'CLASSIC'}
            </span>
          )}
          {sessionMode === 'rank' && (
            <span className="px-3 py-1.5 rounded-xl smara-glass-soft text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" /> {bestScore}
            </span>
          )}
          {sessionMode && (
            <button
              type="button"
              onClick={handleLogoutSession}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-300/30 text-rose-100 text-xs font-bold transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Ganti Mode
            </button>
          )}
        </div>
      </div>

      {/* ===== LOGO SMARA KOPI DI TENGAH ATAS LAYOUT GAME ===== */}
      <div className="flex flex-col items-center justify-center pt-1 pb-0.5 space-y-1">
        <SmaraLogo size="md" />
        <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-sky-300/90">
          FLAPPY SMARA
        </span>
      </div>

      {/* ===== NAVIGASI BAGIAN TERPISAH DALAM GAME: MAIN vs ACHIEVEMENT ===== */}
      {sessionMode && (
        <div className="smara-glass p-1.5 rounded-2xl grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => handleSwitchTab('play')}
            className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'play'
                ? 'bg-gradient-to-r from-sky-400 to-blue-500 text-[#041226] shadow-md'
                : 'text-sky-200 hover:bg-white/10'
            }`}
          >
            <Gamepad2 className="w-4 h-4" /> Main Game
          </button>
          <button
            type="button"
            onClick={() => handleSwitchTab('achievement')}
            className={`relative py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'achievement'
                ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-[#041226] shadow-md'
                : 'text-sky-200 hover:bg-white/10'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Achievement</span>
            {sessionMode === 'rank' && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold ${
                  activeTab === 'achievement'
                    ? 'bg-[#041226]/20 text-[#041226]'
                    : 'bg-amber-400/20 text-amber-200'
                }`}
              >
                {unlockedCount}/{ACHIEVEMENTS.length}
              </span>
            )}
            {hasUnseenUnlock && (
              <span className="absolute top-1.5 right-2.5 w-2.5 h-2.5 rounded-full bg-rose-400 animate-ping" />
            )}
          </button>
        </div>
      )}

      {/* ===== TAB 2: ACHIEVEMENT (TERPISAH DARI LAYOUT CANVAS, MASIH DI DALAM GAME) ===== */}
      {activeTab === 'achievement' && sessionMode && (
        <FlappyAchievementPanel
          sessionMode={sessionMode}
          bestScore={bestScore}
          equippedAccessories={equippedAccessories}
          onToggleAccessory={handleToggleAccessory}
          onEquipAllUnlocked={handleEquipAllUnlocked}
          onClearAllAccessories={handleClearAllAccessories}
          onSwitchToRank={() => {
            handleLogoutSession();
            setRankStepForm(true);
          }}
          onOpenShare={() => openShareModal(Math.max(weeklyBestScore, bestScore, score))}
          onBackToPlay={() => handleSwitchTab('play')}
        />
      )}

      {/* ===== TAB 1: CANVAS GAME + TOP 10 MINGGUAN ===== */}
      {activeTab === 'play' && (
        <>
          <div className="smara-glass rounded-3xl p-4 flex flex-col items-center relative overflow-hidden">
            {/* HUD Atas Canvas */}
            <div className="w-full max-w-[360px] flex items-center justify-between px-1 pb-3 gap-2">
              <span className="text-[11px] font-bold text-sky-200 flex items-center gap-1.5">
                <Coffee className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>+1/dtk • Kopi +10</span>
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-bold text-sky-200 flex items-center gap-1">
                  <Gauge className="w-3 h-3 text-sky-300" /> Lv.{speedTier}
                </span>
                {sessionMode && (
                  <button
                    type="button"
                    onClick={() => openShareModal(Math.max(score, weeklyBestScore, bestScore))}
                    className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-sky-200 transition cursor-pointer"
                    title="Share Kartu Skor"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <span className="px-3.5 py-1 rounded-full bg-sky-400/20 border border-sky-300/40 font-mono text-lg font-extrabold text-white">
                  {score}
                </span>
              </div>
            </div>

            {/* Area Canvas */}
            <div
              onPointerDown={
                gamePhase === 'READY' || gamePhase === 'PLAYING' ? handleCanvasTap : undefined
              }
              className="relative rounded-2xl overflow-hidden border border-sky-300/30 shadow-xl select-none touch-manipulation"
            >
              <canvas
                ref={canvasRef}
                style={{ width: CANVAS_W, height: CANVAS_H }}
                className="block max-w-full h-auto cursor-pointer"
              />

              {/* Toast Speed Up Berkala */}
              {speedMilestoneToast && gamePhase === 'PLAYING' && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-amber-400/95 text-[#041226] text-[11px] font-extrabold shadow-lg pointer-events-none whitespace-nowrap smara-animate">
                  {speedMilestoneToast}
                </div>
              )}

              {/* Overlay READY (pointer-events-none agar tidak double-tap dengan container) */}
              {gamePhase === 'READY' && sessionMode && (
                <div className="absolute inset-0 bg-[#041226]/55 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center pointer-events-none space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-sky-400 text-[#041226] flex items-center justify-center shadow-lg animate-bounce">
                    <Play className="w-7 h-7 fill-current" />
                  </div>
                  <h3 className="text-xl font-extrabold text-white">Tap Layar untuk Terbang!</h3>
                  <p className="text-xs text-sky-100/85 max-w-[245px]">
                    Bertahan tiap detik dapat <strong>+1 poin</strong>, sambar gelas kopi <strong>+10 poin</strong>, dan kecepatan naik berkala!
                  </p>
                </div>
              )}

              {/* Overlay GAME OVER */}
              {gamePhase === 'GAMEOVER' && sessionMode && (
                <div className="absolute inset-0 bg-[#041226]/88 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center space-y-3 smara-animate overflow-y-auto">
                  <span className="px-3 py-1 rounded-full bg-rose-500/25 border border-rose-300/40 text-[11px] font-extrabold text-rose-200 uppercase">
                    Yah, Nabrak!
                  </span>

                  <div>
                    <p className="text-xs text-sky-200/80">
                      Skor Akhir {sessionMode === 'rank' && playerName ? playerName : 'Kamu'}
                    </p>
                    <p className="text-4xl font-extrabold text-white font-mono">{score}</p>
                    {sessionMode === 'rank' && weeklyRank && (
                      <p className="text-[11px] font-bold text-amber-300 mt-0.5">
                        Peringkat Mingguan: #{weeklyRank} • Rekor: {bestScore} pts
                      </p>
                    )}
                  </div>

                  {/* Notifikasi Achievement baru terbuka */}
                  {newlyUnlockedIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleSwitchTab('achievement')}
                      className="w-full p-2.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/50 text-amber-100 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                      <span>
                        Achievement Baru:{' '}
                        {newlyUnlockedIds
                          .map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.name)
                          .filter(Boolean)
                          .join(', ')}
                        ! Tap untuk pakai →
                      </span>
                    </button>
                  )}

                  {sessionMode === 'classic' && (
                    <p className="text-[11px] text-sky-200/80 bg-white/5 border border-white/15 px-3 py-2 rounded-xl">
                      Mode <strong>Classic</strong>: skor tidak masuk klasemen mingguan. Tekan <strong>Ganti Mode</strong> untuk masuk Mode <strong>Rank</strong>.
                    </p>
                  )}

                  {sessionMode === 'rank' && submitting && (
                    <p className="text-xs text-sky-200 flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Menyimpan ke ranking mingguan...
                    </p>
                  )}

                  {sessionMode === 'rank' && submitMsg && (
                    <p className="text-[11px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-300/30 px-3 py-1.5 rounded-xl">
                      {submitMsg}
                    </p>
                  )}

                  {sessionMode === 'rank' && !submitMsg && !submitting && submitError && (
                    <form onSubmit={handleManualRetrySubmit} className="w-full space-y-1.5">
                      <p className="text-xs text-rose-300 font-semibold">{submitError}</p>
                      <button
                        type="submit"
                        className="w-full py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#041226] font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" /> Coba Simpan Lagi ({score} pts)
                      </button>
                    </form>
                  )}

                  {/* Tombol Aksi Game Over */}
                  <div className="w-full space-y-2 pt-0.5">
                    <button
                      type="button"
                      onClick={startGame}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-300 hover:to-blue-400 text-[#041226] font-extrabold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" /> Main Lagi
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => openShareModal(score)}
                        className="py-2.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/45 text-amber-100 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" /> Share Skor
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSwitchTab('achievement')}
                        className="py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Award className="w-3.5 h-3.5 text-sky-300" /> Achievement
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ===== LIST 10 BESAR MINGGUAN (#1 - #10) ===== */}
          <div className="smara-glass rounded-3xl p-5 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-300" /> 10 Besar Mingguan ({weekKey || '...'})
                </h3>
                <p className="text-[11px] text-sky-200/80 flex items-center gap-1 mt-0.5">
                  <Gift className="w-3 h-3 text-amber-300 shrink-0" /> Juara #1 tiap minggu bebas pilih <strong>1 Menu Gratis</strong> di SMARA KOPI!
                </p>
              </div>
              <button
                type="button"
                onClick={() => fetchLeaderboard()}
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

                const accNames = parseAccessories(row.accessories || row.accessory)
                  .map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.name)
                  .filter(Boolean);

                return (
                  <div
                    key={row.id}
                    className={`px-3.5 py-2.5 rounded-2xl flex items-center justify-between text-xs border ${
                      row.is_me
                        ? 'bg-emerald-400/15 border-emerald-300/50 text-white'
                        : rankNum === 1
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
                      <div className="min-w-0">
                        <p className="font-bold truncate flex items-center gap-1.5">
                          <span className="truncate">{row.player_name}</span>
                          {row.is_me && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-400/25 text-emerald-200 text-[9px] font-extrabold uppercase shrink-0">
                              Kamu
                            </span>
                          )}
                        </p>
                        {accNames.length > 0 && (
                          <p className="text-[10px] text-sky-300/90 truncate">
                            {accNames.join(' • ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="font-mono font-extrabold text-sm text-amber-300 shrink-0 pl-2">
                      {row.best_score} pts
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Jika pemain Mode Rank berada di luar Top 10, tetap tampilkan posisinya */}
            {sessionMode === 'rank' && weeklyRank && weeklyRank > 10 && (
              <div className="pt-2 border-t border-white/10">
                <div className="px-3.5 py-2.5 rounded-2xl bg-emerald-400/15 border border-emerald-300/45 flex items-center justify-between text-xs text-white">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="px-2 h-6 rounded-full bg-emerald-400 text-[#041226] flex items-center justify-center font-extrabold text-[11px] shrink-0">
                      #{weeklyRank}
                    </span>
                    <span className="font-bold truncate">{playerName} (Peringkat Kamu)</span>
                  </div>
                  <span className="font-mono font-extrabold text-sm text-amber-300 shrink-0">
                    {weeklyBestScore} pts
                  </span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
