'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  Flame,
  MessageCircleQuestion,
  Coffee,
  Shuffle,
  Users,
  Plus,
  X,
  RotateCcw,
  Sparkles,
  Dices,
  UserCheck,
} from 'lucide-react';
import { TDS_CARDS } from '@/data/tdsCards';
import SmaraLogo from '@/components/SmaraLogo';

const CATEGORY_META = {
  truth: {
    label: 'TRUTH',
    subtitle: 'Jawab Jujur',
    badge: 'bg-sky-400/20 text-sky-200 border-sky-300/40',
    icon: MessageCircleQuestion,
  },
  dare: {
    label: 'DARE',
    subtitle: 'Tantangan Berani',
    badge: 'bg-amber-400/20 text-amber-200 border-amber-300/40',
    icon: Flame,
  },
  sip: {
    label: 'SIP',
    subtitle: 'Seruput Kopi',
    badge: 'bg-emerald-400/20 text-emerald-200 border-emerald-300/40',
    icon: Coffee,
  },
};

export default function TdsGame({ onBack }) {
  const [players, setPlayers] = useState([]);
  const [playerInput, setPlayerInput] = useState('');
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [activeCard, setActiveCard] = useState(null);
  const [usedIndices, setUsedIndices] = useState({ truth: [], dare: [], sip: [] });
  const [roundCount, setRoundCount] = useState(0);

  // State Overlay Dadu & Pengocokan Giliran
  const [showDiceOverlay, setShowDiceOverlay] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [rollingName, setRollingName] = useState('');

  const hasEnoughPlayers = players.length >= 2;
  const canDrawCard = hasEnoughPlayers && Boolean(currentPlayer) && !isRolling;

  const addPlayer = (e) => {
    e.preventDefault();
    const name = playerInput.trim();
    if (!name || players.some((p) => p.toLowerCase() === name.toLowerCase())) return;
    setPlayers([...players, name]);
    setPlayerInput('');
  };

  const removePlayer = (name) => {
    const updated = players.filter((p) => p !== name);
    setPlayers(updated);
    if (currentPlayer === name) setCurrentPlayer(null);
    if (updated.length < 2) setActiveCard(null);
  };

  const handleRollTurn = () => {
    if (!hasEnoughPlayers || isRolling) return;

    setShowDiceOverlay(true);
    setIsRolling(true);
    setActiveCard(null);

    let ticks = 0;
    const totalTicks = 16;
    const interval = setInterval(() => {
      const rand = players[Math.floor(Math.random() * players.length)];
      setRollingName(rand);
      ticks++;

      if (ticks >= totalTicks) {
        clearInterval(interval);
        const candidates =
          players.length > 2 && currentPlayer
            ? players.filter((p) => p !== currentPlayer)
            : players;
        const chosen = candidates[Math.floor(Math.random() * candidates.length)];

        setRollingName(chosen);
        setCurrentPlayer(chosen);
        setIsRolling(false);
      }
    }, 75);
  };

  const closeDiceOverlay = () => {
    if (isRolling) return;
    setShowDiceOverlay(false);
  };

  const drawCard = (type) => {
    if (!canDrawCard) return;

    const selectedType =
      type === 'random'
        ? ['truth', 'dare', 'sip'][Math.floor(Math.random() * 3)]
        : type;

    const pool = TDS_CARDS[selectedType];
    let used = usedIndices[selectedType];
    if (used.length >= pool.length) {
      used = [];
    }

    const available = pool
      .map((text, idx) => ({ text, idx }))
      .filter((item) => !used.includes(item.idx));

    const picked = available[Math.floor(Math.random() * available.length)];

    setUsedIndices((prev) => ({
      ...prev,
      [selectedType]: [...used, picked.idx],
    }));
    setActiveCard({ type: selectedType, text: picked.text });
    setRoundCount((c) => c + 1);
  };

  const resetSession = () => {
    setActiveCard(null);
    setCurrentPlayer(null);
    setUsedIndices({ truth: [], dare: [], sip: [] });
    setRoundCount(0);
  };

  const meta = activeCard ? CATEGORY_META[activeCard.type] : null;
  const ActiveIcon = meta?.icon;

  return (
    <div className="space-y-5 smara-animate relative">
      {/* OVERLAY BURAM: ANIMASI DADU & PEMENANG GILIRAN */}
      {showDiceOverlay && (
        <div
          onClick={closeDiceOverlay}
          className="fixed inset-0 z-50 bg-[#041226]/82 backdrop-blur-md flex items-center justify-center p-5 smara-overlay cursor-pointer select-none"
        >
          <div className="smara-glass rounded-3xl p-8 max-w-sm w-full text-center space-y-5 border-sky-300/45 shadow-2xl smara-animate">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-sky-400/20 border border-sky-300/35 text-[11px] font-bold uppercase tracking-widest text-sky-200">
              {isRolling ? 'Mengocok Giliran...' : 'Giliran Terpilih!'}
            </span>

            <div className="flex justify-center py-2">
              <div
                className={`w-24 h-24 rounded-3xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-[0_0_35px_rgba(56,189,248,0.5)] transition-transform duration-500 ${
                  isRolling ? 'animate-spin scale-110' : 'scale-100 rotate-12'
                }`}
              >
                <Dices className="w-12 h-12 text-[#041226]" />
              </div>
            </div>

            <div className="smara-glass-soft p-5 rounded-2xl border-sky-300/35 space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-sky-200/75">
                {isRolling ? 'Siapa yang kena?' : 'Sekarang Giliran:'}
              </p>
              <h3
                className={`text-3xl sm:text-4xl font-extrabold tracking-tight transition-all duration-200 ${
                  isRolling ? 'text-sky-200/80 blur-[0.5px]' : 'text-white scale-105'
                }`}
              >
                {rollingName || '...'}
              </h3>
            </div>

            {!isRolling ? (
              <p className="text-xs font-semibold text-sky-300 animate-pulse pt-1">
                Tap di mana saja untuk tutup &amp; pilih kartu TDS
              </p>
            ) : (
              <p className="text-xs text-sky-200/60 pt-1">Tunggu dadu berhenti...</p>
            )}
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs sm:text-sm font-semibold text-sky-100 transition-all duration-300 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Hub
        </button>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-sky-200">
            Ronde #{roundCount}
          </span>
          {roundCount > 0 && (
            <button
              onClick={resetSession}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-sky-200 transition cursor-pointer"
              title="Reset Sesi"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Judul Game */}
      <div className="smara-glass rounded-3xl p-5 sm:p-6 text-center space-y-1.5">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-400/20 border border-sky-300/35 text-[11px] font-bold tracking-wider text-sky-200 uppercase">
          <Sparkles className="w-3.5 h-3.5" /> Pass &amp; Play • Minimal 2 Peserta
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Truth, Dare, or <span className="text-sky-300">Sip (TDS)</span>
        </h2>
        <p className="text-xs sm:text-sm text-sky-200/80">
          Masukkan nama semua teman di meja, kocok dadu giliran, lalu pilih kartunya!
        </p>
      </div>

      {/* Daftar Pemain & Tombol Besar Acak Giliran */}
      <div className="smara-glass rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-sky-300" /> Peserta di Meja ({players.length})
          </h3>
          {hasEnoughPlayers ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
              <UserCheck className="w-3.5 h-3.5" /> Siap dikocok
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-amber-300">
              Minimal 2 peserta
            </span>
          )}
        </div>

        <form onSubmit={addPlayer} className="flex gap-2">
          <input
            type="text"
            placeholder="Tulis nama peserta..."
            value={playerInput}
            onChange={(e) => setPlayerInput(e.target.value)}
            className="flex-1 px-4 py-3 rounded-xl smara-input text-sm font-semibold"
          />
          <button
            type="submit"
            disabled={!playerInput.trim()}
            className="px-4 py-3 rounded-xl bg-white/15 hover:bg-white/25 disabled:opacity-45 border border-white/20 text-white text-sm font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Tambah
          </button>
        </form>

        {players.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {players.map((p) => {
              const isSelected = currentPlayer === p;
              return (
                <span
                  key={p}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all duration-300 ${
                    isSelected
                      ? 'bg-sky-400/30 border-sky-300 text-white shadow-md shadow-sky-500/20 scale-105'
                      : 'bg-white/10 border-white/15 text-sky-100'
                  }`}
                >
                  {p}
                  <button
                    type="button"
                    onClick={() => removePlayer(p)}
                    className="text-sky-200/70 hover:text-rose-300 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* TOMBOL BESAR ACAK GILIRAN (HANYA LOGO DADU SAAT BELUM CUKUP PESERTA) */}
        <button
          type="button"
          onClick={handleRollTurn}
          disabled={!hasEnoughPlayers || isRolling}
          aria-label="Acak Giliran"
          className="w-full py-4 sm:py-5 px-6 rounded-2xl bg-gradient-to-r from-sky-400 via-blue-400 to-indigo-400 hover:from-sky-300 hover:to-indigo-300 active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none text-[#041226] font-extrabold text-base sm:text-lg shadow-lg shadow-sky-900/40 flex items-center justify-center gap-3 transition-all duration-300 cursor-pointer"
        >
          <Dices className="w-7 h-7" />
          {hasEnoughPlayers && <span>ACAK GILIRAN SEKARANG</span>}
        </button>

        {currentPlayer && (
          <div className="smara-glass-soft rounded-2xl p-3.5 text-center border-sky-300/35 smara-animate">
            <p className="text-[11px] uppercase tracking-wider text-sky-200/80">Giliran Aktif</p>
            <p className="text-xl font-extrabold text-sky-300 mt-0.5">{currentPlayer}</p>
          </div>
        )}
      </div>

      {/* Area Kartu Aktif (Logo SMARA KOPI bersih sebelum kartu dibuka) */}
      <div className="smara-glass rounded-3xl p-6 sm:p-8 min-h-[210px] flex flex-col items-center justify-center text-center relative overflow-hidden">
        {!activeCard ? (
          <div className="opacity-75">
            <SmaraLogo size="lg" />
          </div>
        ) : (
          <div key={roundCount} className="space-y-4 w-full smara-animate">
            <div className="flex justify-center">
              <span
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-extrabold tracking-widest border ${meta.badge}`}
              >
                <ActiveIcon className="w-4 h-4" />
                {meta.label} — {meta.subtitle}
              </span>
            </div>

            <p className="text-lg sm:text-2xl font-bold text-white leading-relaxed px-2">
              &ldquo;{activeCard.text}&rdquo;
            </p>

            {activeCard.type !== 'sip' && (
              <p className="text-xs text-sky-200/75 pt-2">
                Nggak berani jawab / lakuin? <strong>Wajib seruput minuman 2x!</strong>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Tombol Pilih Kategori Kartu */}
      <div
        className={`grid grid-cols-2 sm:grid-cols-4 gap-3 transition-all duration-300 ${
          !canDrawCard ? 'opacity-45 pointer-events-none select-none' : 'opacity-100'
        }`}
      >
        <button
          onClick={() => drawCard('truth')}
          disabled={!canDrawCard}
          className="smara-glass hover:border-sky-300/60 active:scale-[0.98] p-4 rounded-2xl flex flex-col items-center gap-1.5 transition cursor-pointer"
        >
          <MessageCircleQuestion className="w-6 h-6 text-sky-300" />
          <span className="font-extrabold text-sm text-white">TRUTH</span>
          <span className="text-[11px] text-sky-200/80">Jawab Jujur</span>
        </button>

        <button
          onClick={() => drawCard('dare')}
          disabled={!canDrawCard}
          className="smara-glass hover:border-amber-300/60 active:scale-[0.98] p-4 rounded-2xl flex flex-col items-center gap-1.5 transition cursor-pointer"
        >
          <Flame className="w-6 h-6 text-amber-300" />
          <span className="font-extrabold text-sm text-white">DARE</span>
          <span className="text-[11px] text-sky-200/80">Tantangan</span>
        </button>

        <button
          onClick={() => drawCard('sip')}
          disabled={!canDrawCard}
          className="smara-glass hover:border-emerald-300/60 active:scale-[0.98] p-4 rounded-2xl flex flex-col items-center gap-1.5 transition cursor-pointer"
        >
          <Coffee className="w-6 h-6 text-emerald-300" />
          <span className="font-extrabold text-sm text-white">SIP</span>
          <span className="text-[11px] text-sky-200/80">Seruput Kopi</span>
        </button>

        <button
          onClick={() => drawCard('random')}
          disabled={!canDrawCard}
          className="bg-gradient-to-br from-sky-400 to-blue-500 hover:from-sky-300 hover:to-blue-400 active:scale-[0.98] p-4 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-[#041226] shadow-lg shadow-sky-900/40 transition cursor-pointer"
        >
          <Shuffle className="w-6 h-6" />
          <span className="font-extrabold text-sm">ACAK</span>
          <span className="text-[11px] font-semibold opacity-80">Kartu Random</span>
        </button>
      </div>
    </div>
  );
}
