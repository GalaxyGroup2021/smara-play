'use client';

import React from 'react';
import {
  X,
  Play,
  Users,
  Crown,
  Eye,
  Mic,
  Timer,
  Vote,
  ShieldAlert,
  Dices,
  MessageCircleQuestion,
  Flame,
  Coffee,
  Shuffle,
  BookOpen,
} from 'lucide-react';

export default function HowToPlayModal({ game, onClose, onConfirm }) {
  if (!game) return null;

  const isMafia = game === 'mafia';

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[#041226]/82 backdrop-blur-md flex items-center justify-center p-4 smara-overlay"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[85vh] smara-glass rounded-3xl flex flex-col overflow-hidden border-sky-300/40 shadow-2xl smara-animate"
      >
        {/* Header Tetap di Atas */}
        <div className="p-5 pb-4 border-b border-white/15 bg-white/5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
                isMafia
                  ? 'bg-rose-500/20 border-rose-300/40 text-rose-300'
                  : 'bg-amber-500/20 border-amber-300/40 text-amber-300'
              }`}
            >
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-sky-300">
                How To Play
              </p>
              <h3 className="text-lg font-extrabold text-white leading-tight">
                {isMafia ? 'MAFIA SMARA' : 'Truth, Dare, or Sip'}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-sky-100 transition cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Konten Scrollable */}
        <div className="p-5 space-y-3.5 overflow-y-auto flex-1 text-left">
          {isMafia ? (
            <>
              <div className="smara-glass-soft p-3.5 rounded-2xl flex items-start gap-3">
                <div className="p-2 rounded-xl bg-sky-400/20 text-sky-300 shrink-0 mt-0.5">
                  <Crown className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-white">1. Buat / Gabung Room (Min. 3 Orang)</p>
                  <p className="text-xs text-sky-200/80 leading-relaxed">
                    Tulis nama panggilanmu, lalu buat Room atau masukkan kode 4 huruf dari Host. Komposisi otomatis <strong>2 Warga : 1 Mafia</strong>.
                  </p>
                </div>
              </div>

              <div className="smara-glass-soft p-3.5 rounded-2xl flex items-start gap-3">
                <div className="p-2 rounded-xl bg-indigo-400/20 text-indigo-300 shrink-0 mt-0.5">
                  <Eye className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-white">2. Intip Kata Rahasia (3, 2, 1)</p>
                  <p className="text-xs text-sky-200/80 leading-relaxed">
                    Semua Warga dapat kata yang sama, sedangkan Mafia dapat kata yang mirip. Gunakan tombol{' '}
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 text-sky-200 font-semibold">
                      <Eye className="w-3 h-3" /> Intip Kata
                    </span>{' '}
                    dan jangan sampai terlihat teman sebelah!
                  </p>
                </div>
              </div>

              <div className="smara-glass-soft p-3.5 rounded-2xl flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-400/20 text-amber-300 shrink-0 mt-0.5">
                  <Mic className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-white">3. Sebutkan 1 Kata Clue (5 Detik)</p>
                  <p className="text-xs text-sky-200/80 leading-relaxed">
                    Setiap peserta diberi waktu{' '}
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-200 font-semibold">
                      <Timer className="w-3 h-3" /> 5 detik
                    </span>{' '}
                    bergantian untuk menyebutkan <strong>1 kata sifat/rasa</strong> (contoh: <em>&ldquo;Manis&rdquo;</em> atau <em>&ldquo;Dingin&rdquo;</em>).
                  </p>
                </div>
              </div>

              <div className="smara-glass-soft p-3.5 rounded-2xl flex items-start gap-3">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-300 shrink-0 mt-0.5">
                  <Vote className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-white">4. Voting Penyusup (30 Detik)</p>
                  <p className="text-xs text-sky-200/80 leading-relaxed">
                    Pilih 1 orang paling mencurigakan dalam 30 detik. Jika tepat memilih <strong>Mafia</strong>, Warga menang! Tapi jika salah vote <strong>Warga</strong>, Mafia langsung menang!
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="smara-glass-soft p-3.5 rounded-2xl flex items-start gap-3">
                <div className="p-2 rounded-xl bg-sky-400/20 text-sky-300 shrink-0 mt-0.5">
                  <Users className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-white">1. Tambah Peserta (Min. 2 Orang)</p>
                  <p className="text-xs text-sky-200/80 leading-relaxed">
                    Main cukup pakai 1 HP di tengah meja. Masukkan nama semua teman yang ikut bermain.
                  </p>
                </div>
              </div>

              <div className="smara-glass-soft p-3.5 rounded-2xl flex items-start gap-3">
                <div className="p-2 rounded-xl bg-indigo-400/20 text-indigo-300 shrink-0 mt-0.5">
                  <Dices className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-white">2. Kocok Dadu Acak Giliran</p>
                  <p className="text-xs text-sky-200/80 leading-relaxed">
                    Tekan tombol gambar dadu{' '}
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-400/25 text-sky-200 font-semibold">
                      <Dices className="w-3.5 h-3.5" /> Acak Giliran
                    </span>{' '}
                    untuk mengocok nama peserta. Tap di mana saja untuk menutup layar hasil kocokan.
                  </p>
                </div>
              </div>

              <div className="smara-glass-soft p-3.5 rounded-2xl flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-400/20 text-amber-300 shrink-0 mt-0.5">
                  <Flame className="w-4 h-4" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-white">3. Pilih Kartu Tantangan</p>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px] text-sky-100">
                    <span className="inline-flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-lg">
                      <MessageCircleQuestion className="w-3.5 h-3.5 text-sky-300 shrink-0" /> <strong>TRUTH:</strong> Jujur
                    </span>
                    <span className="inline-flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-lg">
                      <Flame className="w-3.5 h-3.5 text-amber-300 shrink-0" /> <strong>DARE:</strong> Tantangan
                    </span>
                    <span className="inline-flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-lg">
                      <Coffee className="w-3.5 h-3.5 text-emerald-300 shrink-0" /> <strong>SIP:</strong> Seruput
                    </span>
                    <span className="inline-flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-lg">
                      <Shuffle className="w-3.5 h-3.5 text-sky-300 shrink-0" /> <strong>ACAK:</strong> Random
                    </span>
                  </div>
                </div>
              </div>

              <div className="smara-glass-soft p-3.5 rounded-2xl flex items-start gap-3 border-emerald-300/25">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 shrink-0 mt-0.5">
                  <Coffee className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-white">4. Aturan Hukuman</p>
                  <p className="text-xs text-sky-200/80 leading-relaxed">
                    Tidak berani menjawab Truth atau melakukan Dare? Wajib seruput minuman SMARA KOPI-mu <strong>2 kali</strong>!
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Tombol Tetap di Bawah */}
        <div className="p-4 border-t border-white/15 bg-white/5 shrink-0">
          <button
            type="button"
            onClick={onConfirm}
            className="w-full bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-300 hover:to-blue-400 active:scale-[0.98] text-[#041226] font-extrabold py-3.5 rounded-2xl text-sm shadow-lg shadow-sky-900/40 flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            Lanjutkan ke Permainan
          </button>
        </div>
      </div>
    </div>
  );
}
