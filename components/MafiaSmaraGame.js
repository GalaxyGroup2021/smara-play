'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Users,
  Crown,
  Eye,
  EyeOff,
  Copy,
  Check,
  Skull,
  ShieldAlert,
  Play,
  RotateCcw,
  Loader2,
  Vote,
  LogOut,
  Sparkles,
  Mic,
  Timer,
  UserCheck,
} from 'lucide-react';

export default function MafiaSmaraGame({ onBack }) {
  const [nameInput, setNameInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [playerId, setPlayerId] = useState('');

  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showWord, setShowWord] = useState(true);
  const [copied, setCopied] = useState(false);

  const hasValidName = nameInput.trim().length > 0;

  useEffect(() => {
    const savedCode = sessionStorage.getItem('mafia_room_code');
    const savedId = sessionStorage.getItem('mafia_player_id');
    if (savedCode && savedId) {
      setRoomCode(savedCode);
      setPlayerId(savedId);
    }
  }, []);

  const fetchRoomState = useCallback(async () => {
    if (!roomCode || !playerId) return;
    try {
      const res = await fetch(`/api/mafia?code=${roomCode}&playerId=${playerId}`);
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 404) {
          sessionStorage.removeItem('mafia_room_code');
          sessionStorage.removeItem('mafia_player_id');
          setRoomCode('');
          setPlayerId('');
          setGameState(null);
        }
        return;
      }
      setGameState(data);
    } catch {}
  }, [roomCode, playerId]);

  useEffect(() => {
    if (!roomCode || !playerId) return;
    fetchRoomState();
    const interval = setInterval(fetchRoomState, 1000);
    return () => clearInterval(interval);
  }, [roomCode, playerId, fetchRoomState]);

  const callApi = async (payload) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/mafia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!hasValidName) {
      setError('Tulis nama panggilan kamu terlebih dahulu sebelum membuat room!');
      return;
    }
    const res = await callApi({ action: 'CREATE_ROOM', name: nameInput.trim() });
    if (res?.success) {
      setRoomCode(res.code);
      setPlayerId(res.playerId);
      sessionStorage.setItem('mafia_room_code', res.code);
      sessionStorage.setItem('mafia_player_id', res.playerId);
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!hasValidName) {
      setError('Tulis nama panggilan kamu terlebih dahulu sebelum bergabung!');
      return;
    }
    if (codeInput.trim().length < 4) {
      setError('Masukkan 4 huruf kode room!');
      return;
    }
    const res = await callApi({
      action: 'JOIN_ROOM',
      code: codeInput.trim(),
      name: nameInput.trim(),
    });
    if (res?.success) {
      setRoomCode(res.code);
      setPlayerId(res.playerId);
      sessionStorage.setItem('mafia_room_code', res.code);
      sessionStorage.setItem('mafia_player_id', res.playerId);
    }
  };

  const handleLeaveRoom = () => {
    sessionStorage.removeItem('mafia_room_code');
    sessionStorage.removeItem('mafia_player_id');
    setRoomCode('');
    setPlayerId('');
    setGameState(null);
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const room = gameState?.room;
  const players = gameState?.players || [];
  const me = gameState?.me;
  const isHost = room?.host_id === playerId;
  const aliveCount = players.filter((p) => p.is_alive).length;
  const votedCount = players.filter((p) => p.is_alive && p.has_voted).length;
  const expectedMafiaCount = Math.max(1, Math.floor(players.length / 3));
  const mafiaNames = players
    .filter((p) => p.role === 'MAFIA')
    .map((m) => m.name)
    .join(', ');

  // TAMPILAN 1: BUAT / GABUNG ROOM
  if (!roomCode) {
    return (
      <div className="space-y-5 smara-animate">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs sm:text-sm font-semibold text-sky-100 transition-all duration-300 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Hub
        </button>

        <div className="smara-glass rounded-3xl p-6 text-center space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-400/20 border border-rose-300/35 text-[11px] font-bold tracking-wider text-rose-200 uppercase">
            <ShieldAlert className="w-3.5 h-3.5" /> Rasio 2 Warga : 1 Mafia • 5 Detik Clue
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            MAFIA <span className="text-sky-300">SMARA</span>
          </h2>
          <p className="text-xs sm:text-sm text-sky-200/80 max-w-md mx-auto">
            Tiap peserta punya <strong>5 detik</strong> bergantian menyebut <strong>1 kata sifat/rasa</strong> untuk mendeskripsikan kata rahasianya. Salah vote warga = Mafia langsung menang!
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/20 border border-rose-300/40 text-rose-100 text-xs font-semibold text-center smara-animate">
            {error}
          </div>
        )}

        <div className="smara-glass rounded-3xl p-6 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-sky-200">
                1. Nama Panggilan Kamu <span className="text-rose-300">*</span>
              </label>
              {hasValidName ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 transition-opacity duration-300">
                  <UserCheck className="w-3.5 h-3.5" /> Siap main
                </span>
              ) : (
                <span className="text-[11px] text-amber-300/90 font-medium">
                  Wajib diisi dulu
                </span>
              )}
            </div>
            <input
              type="text"
              required
              placeholder="Tulis nama panggilanmu di sini..."
              value={nameInput}
              onChange={(e) => {
                setNameInput(e.target.value);
                if (error) setError('');
              }}
              className={`w-full px-4 py-3.5 rounded-xl smara-input text-sm font-semibold ${
                !hasValidName ? 'border-amber-300/45' : 'border-emerald-300/45'
              }`}
            />
          </div>

          <div
            className={`grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 transition-all duration-500 ${
              !hasValidName ? 'opacity-50 pointer-events-none select-none' : 'opacity-100'
            }`}
          >
            <form onSubmit={handleCreateRoom} className="smara-glass-soft p-5 rounded-2xl space-y-3 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-300" /> Buat Room Baru
                </h3>
                <p className="text-xs text-sky-200/75 mt-1">
                  Jadi Host dan bagikan kode 4 huruf ke teman satu mejamu.
                </p>
              </div>
              <button
                type="submit"
                disabled={loading || !hasValidName}
                className="w-full bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-300 hover:to-blue-400 disabled:opacity-50 text-[#041226] font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Buat Room
              </button>
            </form>

            <form onSubmit={handleJoinRoom} className="smara-glass-soft p-5 rounded-2xl space-y-3 flex flex-col justify-between">
              <div className="space-y-2.5">
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-300" /> Gabung Room
                </h3>
                <input
                  type="text"
                  maxLength={4}
                  disabled={!hasValidName}
                  placeholder="Kode 4 Huruf (misal: K7P2)"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 rounded-xl smara-input text-sm font-mono font-bold uppercase tracking-widest text-center"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !hasValidName || codeInput.trim().length < 4}
                className="w-full bg-white/15 hover:bg-white/25 disabled:opacity-50 border border-white/20 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Gabung Room
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // TAMPILAN 2: DI DALAM ROOM
  return (
    <div className="space-y-5 smara-animate relative">
      {/* OVERLAY BURAM: HITUNG MUNDUR 3, 2, 1 */}
      {room?.status === 'COUNTDOWN' && (
        <div className="fixed inset-0 z-50 bg-[#041226]/80 backdrop-blur-md flex items-center justify-center p-4 smara-overlay">
          <div className="smara-glass rounded-3xl p-8 max-w-sm w-full text-center space-y-4 smara-animate border-sky-300/40">
            <p className="text-xs font-bold uppercase tracking-widest text-sky-300">
              Permainan Dimulai Dalam
            </p>
            <div
              key={room.time_left}
              className="text-7xl font-extrabold text-white drop-shadow-[0_0_24px_rgba(125,211,252,0.7)] smara-animate"
            >
              {room.time_left > 0 ? room.time_left : 1}
            </div>
            <div className="smara-glass-soft p-4 rounded-2xl">
              <p className="text-[11px] uppercase text-sky-200/80">Kata Rahasia Kamu:</p>
              <p className="text-xl font-extrabold text-sky-300 mt-1">{me?.word || '...'}</p>
            </div>
            <p className="text-xs text-sky-200/80">
              Siapkan <strong>1 kata sifat / rasa</strong> untuk mendeskripsikan katamu!
            </p>
          </div>
        </div>
      )}

      {/* OVERLAY BURAM: VOTING DITUTUP / TRANSISI RONDE */}
      {room?.status === 'TRANSITION' && (
        <div className="fixed inset-0 z-50 bg-[#041226]/80 backdrop-blur-md flex items-center justify-center p-4 smara-overlay">
          <div className="smara-glass rounded-3xl p-8 max-w-sm w-full text-center space-y-4 smara-animate border-amber-300/45">
            <span className="inline-block px-3.5 py-1 rounded-full bg-amber-400/20 border border-amber-300/40 text-xs font-extrabold uppercase tracking-wider text-amber-200">
              Voting Ditutup
            </span>
            <h3 className="text-xl font-extrabold text-white leading-snug">
              {room.transition_msg || `Ronde ${room.round_number} Dimulai!`}
            </h3>
            <p className="text-xs text-sky-200/80">
              Lanjut ke giliran deskripsi dalam <strong>{room.time_left} detik</strong>...
            </p>
          </div>
        </div>
      )}

      {/* Top Bar Room */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="px-3.5 py-2 rounded-xl smara-glass-soft font-mono font-extrabold text-sky-300 tracking-widest text-sm">
            ROOM: {roomCode}
          </span>
          <button
            onClick={copyRoomCode}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-sky-100 transition-all duration-300 cursor-pointer"
            title="Salin Kode Room"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <button
          onClick={handleLeaveRoom}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-300/30 text-rose-100 text-xs font-semibold transition-all duration-300 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" /> Keluar Room
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-500/20 border border-rose-300/40 text-rose-100 text-xs font-semibold text-center smara-animate">
          {error}
        </div>
      )}

      {/* STATUS: LOBBY */}
      {room?.status === 'LOBBY' && (
        <div key="phase-lobby" className="smara-glass rounded-3xl p-6 space-y-5 smara-animate">
          <div className="text-center space-y-1">
            <h3 className="text-xl font-extrabold text-white">Menunggu Pemain...</h3>
            <p className="text-xs text-sky-200/80">
              Bagikan kode <strong className="text-sky-300 font-mono">{roomCode}</strong> ke temanmu (minimal 3 orang).
            </p>
            {players.length >= 3 && (
              <p className="text-[11px] text-emerald-300 font-semibold pt-1">
                Komposisi saat ini ({players.length} pemain): {players.length - expectedMafiaCount} Warga vs {expectedMafiaCount} Mafia
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {players.map((p) => (
              <div
                key={p.id}
                className="smara-glass-soft p-3 rounded-2xl flex items-center justify-between gap-2 smara-animate"
              >
                <span className="font-bold text-sm text-white truncate">{p.name}</span>
                {p.id === room.host_id && <Crown className="w-4 h-4 text-amber-300 shrink-0" />}
              </div>
            ))}
          </div>

          {isHost ? (
            <button
              onClick={async () => {
                await callApi({ action: 'START_GAME', code: roomCode, playerId });
                setShowWord(true);
                fetchRoomState();
              }}
              disabled={loading || players.length < 3}
              className="w-full bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-300 hover:to-blue-400 disabled:opacity-50 text-[#041226] font-extrabold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {players.length < 3 ? `Butuh ${3 - players.length} Pemain Lagi` : 'Mulai MAFIA SMARA!'}
            </button>
          ) : (
            <p className="text-center text-xs text-sky-200/80 animate-pulse">
              Menunggu Host menekan tombol Mulai...
            </p>
          )}
        </div>
      )}

      {/* STATUS: CLUE_TURN ATAU VOTING */}
      {(room?.status === 'CLUE_TURN' || room?.status === 'VOTING') && (
        <div key={`phase-${room.status}-${room.round_number}`} className="space-y-5 smara-animate">
          {/* Kartu Kata Rahasia */}
          <div className="smara-glass rounded-3xl p-5 text-center space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="px-3 py-1 rounded-full bg-sky-400/20 border border-sky-300/35 font-bold text-sky-200 uppercase">
                Ronde {room.round_number}
              </span>
              <button
                type="button"
                onClick={() => setShowWord(!showWord)}
                className="inline-flex items-center gap-1.5 text-sky-200 hover:text-white transition-colors duration-200 cursor-pointer"
              >
                {showWord ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showWord ? 'Sembunyikan' : 'Intip Kata'}
              </button>
            </div>

            <div
              onClick={() => setShowWord(!showWord)}
              className="smara-glass-soft p-4 rounded-2xl cursor-pointer transition-all duration-300 hover:border-sky-300/40"
            >
              <p className="text-[11px] uppercase tracking-wider text-sky-200/75">Kata Rahasia Kamu</p>
              <p className="text-2xl font-extrabold text-sky-300 mt-1 transition-all duration-300">
                {showWord ? me?.word || '...' : '••••••••••'}
              </p>
            </div>
          </div>

          {/* FASE 1: GILIRAN SEBUTKAN 1 KATA (5 DETIK / ORANG) */}
          {room.status === 'CLUE_TURN' && room.current_speaker && (
            <div
              key={`speaker-${room.current_speaker.id}`}
              className="smara-glass rounded-3xl p-6 text-center space-y-4 border-sky-300/50 smara-animate"
            >
              <div className="flex items-center justify-between text-xs text-sky-200">
                <span className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wider text-sky-300">
                  <Mic className="w-4 h-4 animate-bounce" /> Giliran Clue ({room.current_speaker.index}/{room.current_speaker.total})
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-200 font-mono font-extrabold">
                  <Timer className="w-3.5 h-3.5" /> {room.time_left}d
                </span>
              </div>

              <div className="py-3">
                <p className="text-xs text-sky-200/80">Sekarang giliran:</p>
                <h3 className="text-3xl font-extrabold text-white mt-1">
                  {room.current_speaker.name}
                  {room.current_speaker.id === playerId && (
                    <span className="block text-sm text-emerald-300 mt-1">(Giliran Kamu! Sebutkan 1 Kata!)</span>
                  )}
                </h3>
              </div>

              <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-300 to-amber-300 transition-all duration-1000 ease-linear"
                  style={{ width: `${Math.min(100, (room.time_left / 5) * 100)}%` }}
                />
              </div>

              <p className="text-xs text-sky-200/85">
                Ucapkan <strong>1 kata sifat atau rasa</strong> saja (contoh: <em>&ldquo;Manis&rdquo;</em>, <em>&ldquo;Dingin&rdquo;</em>, <em>&ldquo;Pahit&rdquo;</em>) untuk mendeskripsikan katamu!
              </p>
            </div>
          )}

          {/* FASE 2: VOTING PENYUSUP (30 DETIK) */}
          {room.status === 'VOTING' && (
            <div className="smara-glass rounded-3xl p-5 space-y-4 border-rose-300/40 smara-animate">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Vote className="w-4 h-4 text-rose-300" /> Voting Penyusup ({votedCount}/{aliveCount})
                </h3>
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full font-mono text-xs font-extrabold border transition-all duration-300 ${
                    room.time_left <= 10
                      ? 'bg-rose-500/30 border-rose-300 text-rose-100 animate-pulse'
                      : 'bg-amber-400/20 border-amber-300/40 text-amber-200'
                  }`}
                >
                  <Timer className="w-3.5 h-3.5" /> {room.time_left} detik
                </span>
              </div>

              <p className="text-xs text-sky-200/80">
                Pilih 1 orang yang paling mencurigakan! Jika 30 detik habis tanpa memilih, suaramu otomatis tidak dinilai.
              </p>

              <div className="space-y-2.5">
                {players.map((p) => {
                  const isMe = p.id === playerId;
                  const isMyVote = me?.voted_for === p.id;
                  return (
                    <div
                      key={p.id}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all duration-300 ${
                        !p.is_alive
                          ? 'bg-rose-950/30 border-rose-500/20 opacity-50'
                          : isMyVote
                          ? 'bg-sky-500/25 border-sky-300/60 scale-[1.01]'
                          : 'smara-glass-soft'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {!p.is_alive ? (
                          <Skull className="w-4 h-4 text-rose-400 shrink-0" />
                        ) : (
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                        )}
                        <div className="truncate">
                          <p className="font-bold text-sm text-white truncate">
                            {p.name} {isMe && <span className="text-sky-300 text-xs">(Kamu)</span>}
                          </p>
                          <p className="text-[11px] text-sky-200/75">
                            {!p.is_alive
                              ? 'Tereliminasi'
                              : p.has_voted
                              ? 'Sudah voting'
                              : 'Belum voting'}
                            {p.votes_received > 0 && ` • ${p.votes_received} suara`}
                          </p>
                        </div>
                      </div>

                      {p.is_alive && me?.is_alive && !isMe && (
                        <button
                          disabled={loading}
                          onClick={async () => {
                            await callApi({ action: 'VOTE', code: roomCode, playerId, targetId: p.id });
                            fetchRoomState();
                          }}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
                            isMyVote
                              ? 'bg-sky-400 text-[#041226]'
                              : 'bg-white/10 hover:bg-white/20 text-white border border-white/15'
                          }`}
                        >
                          {isMyVote ? 'Dipilih ✓' : 'Vote'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* STATUS: FINISHED (TAMPILKAN MAFIA : ... & PEMENANG) */}
      {room?.status === 'FINISHED' && (
        <div key="phase-finished" className="smara-glass rounded-3xl p-6 text-center space-y-5 smara-animate">
          <div className="space-y-2">
            <span
              className={`inline-block px-4 py-1.5 rounded-full text-xs font-extrabold tracking-widest border ${
                room.winner === 'CIVILIAN'
                  ? 'bg-emerald-500/20 text-emerald-200 border-emerald-300/40'
                  : 'bg-rose-500/20 text-rose-200 border-rose-300/40'
              }`}
            >
              PERMAINAN SELESAI
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
              {room.winner === 'CIVILIAN' ? 'WARGA MENANG! 🎉' : 'MAFIA MENANG! 🕵️‍♂️'}
            </h3>
            {room.transition_msg && (
              <p className="text-xs sm:text-sm text-sky-200/90 font-medium">{room.transition_msg}</p>
            )}
          </div>

          {/* Sorotan Nama Mafia */}
          <div className="smara-glass-soft p-4 rounded-2xl border-rose-300/40">
            <p className="text-base sm:text-lg font-extrabold text-rose-300 tracking-wide">
              MAFIA : <span className="text-white">{mafiaNames || '-'}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="smara-glass-soft p-4 rounded-2xl">
              <p className="text-[11px] uppercase text-sky-200/80">Kata Warga</p>
              <p className="text-base font-extrabold text-emerald-300 mt-1">{room.civilian_word}</p>
            </div>
            <div className="smara-glass-soft p-4 rounded-2xl">
              <p className="text-[11px] uppercase text-sky-200/80">Kata Mafia</p>
              <p className="text-base font-extrabold text-rose-300 mt-1">{room.mafia_word}</p>
            </div>
          </div>

          <div className="space-y-2 text-left">
            <p className="text-xs font-bold uppercase tracking-wider text-sky-200">Semua Peserta:</p>
            {players.map((p) => (
              <div
                key={p.id}
                className="smara-glass-soft px-4 py-2.5 rounded-xl flex items-center justify-between text-sm"
              >
                <span className="font-bold text-white">{p.name}</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                    p.role === 'MAFIA'
                      ? 'bg-rose-500/25 text-rose-200 border border-rose-300/35'
                      : 'bg-emerald-500/20 text-emerald-200 border border-emerald-300/35'
                  }`}
                >
                  {p.role === 'MAFIA' ? 'MAFIA' : 'WARGA'}
                </span>
              </div>
            ))}
          </div>

          {isHost && (
            <button
              onClick={async () => {
                await callApi({ action: 'RESET_ROOM', code: roomCode, playerId });
                fetchRoomState();
              }}
              disabled={loading}
              className="w-full bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-300 hover:to-blue-400 text-[#041226] font-extrabold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" /> Main Lagi (Kembali ke Lobi)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
