'use client';

import React, { useState, useEffect } from 'react';
import {
  Lock,
  ShieldAlert,
  Flame,
  LogOut,
  Loader2,
  Sparkles,
  AlertCircle,
  Calendar,
  Trophy,
} from 'lucide-react';
import SmaraLogo from '@/components/SmaraLogo';
import MafiaSmaraGame from '@/components/MafiaSmaraGame';
import TdsGame from '@/components/TdsGame';
import FlappySmaraGame from '@/components/FlappySmaraGame';
import HowToPlayModal from '@/components/HowToPlayModal';

export default function SmaraPlayHub() {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [activeDate, setActiveDate] = useState('');
  const [activeGame, setActiveGame] = useState(null); // null | 'mafia' | 'tds' | 'flappy'
  const [pendingGame, setPendingGame] = useState(null);

  const [passwordInput, setPasswordInput] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth');
        if (res.ok) {
          const data = await res.json();
          setAuthenticated(Boolean(data.authenticated));
          setActiveDate(data.date || '');
        }
      } catch {} finally {
        setChecking(false);
      }
    };
    checkSession();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kode harian salah!');
      setAuthenticated(true);
      setActiveDate(data.date || '');
      setPasswordInput('');
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'LOGOUT' }),
    });
    setAuthenticated(false);
    setActiveGame(null);
    setPendingGame(null);
  };

  if (checking) {
    return (
      <div className="min-h-screen smara-bg flex items-center justify-center p-4">
        <div className="smara-glass px-6 py-4 rounded-2xl flex items-center gap-3 text-sm text-sky-100">
          <Loader2 className="w-5 h-5 animate-spin text-sky-300" />
          Memuat SMARA PLAY...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen smara-bg text-slate-100 font-sans relative pb-12">
      {/* OVERLAY HOW TO PLAY SEBELUM MASUK GAME */}
      <HowToPlayModal
        game={pendingGame}
        onClose={() => setPendingGame(null)}
        onConfirm={() => {
          setActiveGame(pendingGame);
          setPendingGame(null);
        }}
      />

      {/* TAMPILAN 1: GERBANG DAILY PASSWORD */}
      {!authenticated ? (
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md smara-glass rounded-3xl overflow-hidden smara-animate">
            <div className="p-8 pb-6 text-center border-b border-white/15 bg-white/5 space-y-2">
              <SmaraLogo size="lg" />
              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-400/20 border border-sky-300/35 text-[11px] font-bold tracking-widest text-sky-200 uppercase">
                  <Sparkles className="w-3.5 h-3.5" /> SMARA PLAY
                </span>
              </div>
              <p className="text-xs text-sky-200/80 pt-1">
                Masukkan <strong>Daily Password</strong> yang kamu dapat saat jajan di SMARA KOPI!
              </p>
            </div>

            <form onSubmit={handleLogin} className="p-7 space-y-5">
              {loginError && (
                <div className="p-3.5 rounded-xl bg-rose-500/20 border border-rose-300/40 text-rose-100 text-xs font-semibold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-300 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-sky-200 mb-2">
                  Kode Akses Hari Ini
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="SMARA-123456"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3.5 rounded-xl smara-input text-center font-mono text-lg font-bold tracking-widest uppercase"
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading || !passwordInput.trim()}
                className="w-full bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-300 hover:to-blue-400 active:scale-[0.99] disabled:opacity-60 text-[#041226] font-extrabold py-3.5 rounded-xl shadow-lg shadow-sky-900/40 transition flex items-center justify-center gap-2 text-sm cursor-pointer"
              >
                {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                {loginLoading ? 'Memverifikasi...' : 'Masuk ke SMARA PLAY'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* TAMPILAN 2: HUB PEMILIH GAME / GAME AKTIF */
        <div className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
          <header className="smara-glass rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <SmaraLogo size="md" />
              <div>
                <h1 className="font-extrabold text-sm sm:text-base tracking-wider text-white">
                  SMARA <span className="text-sky-300">PLAY</span>
                </h1>
                <p className="text-[11px] text-sky-200/75 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Akses Aktif: {activeDate}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-300/30 text-rose-100 text-xs font-semibold transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </header>

          {activeGame === null && (
            <div className="space-y-4 smara-animate">
              <div className="text-center space-y-1 py-2">
                <h2 className="text-2xl font-extrabold text-white">Pilih Game Tongkrongan</h2>
                <p className="text-xs sm:text-sm text-sky-200/80">
                  Main bareng teman satu meja atau kejar skor mingguan berhadiah menu gratis!
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => setPendingGame('mafia')}
                  className="smara-glass hover:border-rose-300/50 hover:-translate-y-1 active:scale-[0.99] p-6 rounded-3xl text-left flex flex-col justify-between gap-5 transition-all cursor-pointer group"
                >
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-300/35 flex items-center justify-center group-hover:scale-110 transition">
                      <ShieldAlert className="w-6 h-6 text-rose-300" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-rose-300">
                        Online Room • 3–8 HP
                      </span>
                      <h3 className="text-xl font-extrabold text-white mt-0.5">MAFIA SMARA</h3>
                      <p className="text-xs text-sky-200/80 mt-1.5 leading-relaxed">
                        Tebak siapa penyusup di tongkronganmu! Setiap HP dapat kata rahasia berbeda, diskusi, lalu voting.
                      </p>
                    </div>
                  </div>
                  <div className="w-full py-2.5 rounded-xl bg-white/10 group-hover:bg-rose-500/25 border border-white/15 text-center text-xs font-bold text-white transition">
                    Mainkan Sekarang →
                  </div>
                </button>

                <button
                  onClick={() => setPendingGame('tds')}
                  className="smara-glass hover:border-amber-300/50 hover:-translate-y-1 active:scale-[0.99] p-6 rounded-3xl text-left flex flex-col justify-between gap-5 transition-all cursor-pointer group"
                >
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-300/35 flex items-center justify-center group-hover:scale-110 transition">
                      <Flame className="w-6 h-6 text-amber-300" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300">
                        Pass &amp; Play • 1 HP Satu Meja
                      </span>
                      <h3 className="text-xl font-extrabold text-white mt-0.5">Truth, Dare, or Sip</h3>
                      <p className="text-xs text-sky-200/80 mt-1.5 leading-relaxed">
                        Taruh HP di tengah meja, acak giliran, dan buka kartu jujur, tantangan seru, atau hukuman seruput kopi!
                      </p>
                    </div>
                  </div>
                  <div className="w-full py-2.5 rounded-xl bg-white/10 group-hover:bg-amber-500/25 border border-white/15 text-center text-xs font-bold text-white transition">
                    Mainkan Sekarang →
                  </div>
                </button>

                {/* KARTU GAME KE-3: FLAPPY SMARA */}
                <button
                  onClick={() => setPendingGame('flappy')}
                  className="smara-glass sm:col-span-2 hover:border-sky-300/60 hover:-translate-y-1 active:scale-[0.99] p-6 rounded-3xl text-left flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 transition-all cursor-pointer group"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-sky-400/20 border border-sky-300/40 flex items-center justify-center shrink-0 group-hover:scale-110 transition">
                      <Trophy className="w-6 h-6 text-sky-300" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-sky-300">
                        Arcade Solo • Ranking Mingguan Berhadiah Menu!
                      </span>
                      <h3 className="text-xl font-extrabold text-white mt-0.5">FLAPPY SMARA</h3>
                      <p className="text-xs text-sky-200/80 mt-1 leading-relaxed">
                        Terbangkan Owner SMARA KOPI, kumpulkan gelas kopi <strong>+10 poin</strong>, buka aksesoris keren, dan rebut <strong>Juara 1 Mingguan</strong> untuk gratis 1 menu!
                      </p>
                    </div>
                  </div>
                  <div className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-sky-400/20 group-hover:bg-sky-400 group-hover:text-[#041226] border border-sky-300/35 text-center text-xs font-extrabold text-white transition shrink-0">
                    Mainkan Sekarang →
                  </div>
                </button>
              </div>
            </div>
          )}

          {activeGame === 'mafia' && <MafiaSmaraGame onBack={() => setActiveGame(null)} />}
          {activeGame === 'tds' && <TdsGame onBack={() => setActiveGame(null)} />}
          {activeGame === 'flappy' && <FlappySmaraGame onBack={() => setActiveGame(null)} />}
        </div>
      )}
    </div>
  );
}
