import { NextResponse } from 'next/server';
import pool, { ensureMafiaTables } from '@/lib/db';
import { MAFIA_WORD_PAIRS } from '@/data/mafiaWords';

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generatePlayerId() {
  return 'P-' + Math.random().toString(36).substring(2, 10).toUpperCase();
}

// Evaluasi hasil voting saat waktu 30 detik habis atau semua peserta sudah vote
async function evaluateVoting(room, players) {
  const alivePlayers = players.filter((p) => Boolean(p.is_alive));
  const counts = {};
  alivePlayers.forEach((p) => {
    if (p.voted_for && p.voted_for !== 'ABSTAIN') {
      counts[p.voted_for] = (counts[p.voted_for] || 0) + 1;
    }
  });

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const nextRound = Number(room.round_number || 1) + 1;
  const now = Date.now();

  // Reset pilihan vote semua pemain
  await pool.query('UPDATE mafia_players SET voted_for = NULL WHERE room_code = ?', [room.code]);

  // Jika tidak ada suara masuk atau suara tertinggi seri
  if (entries.length === 0 || (entries.length >= 2 && entries[0][1] === entries[1][1])) {
    const aliveIds = alivePlayers.map((p) => p.id).sort(() => Math.random() - 0.5);
    const msg =
      entries.length === 0
        ? `Voting ditutup! Tidak ada yang memilih. Ronde ${nextRound} dimulai!`
        : `Voting ditutup! Hasil suara seri. Ronde ${nextRound} dimulai!`;

    await pool.query(
      'UPDATE mafia_rooms SET status = ?, round_number = ?, turn_order = ?, phase_started_at = ?, transition_msg = ? WHERE code = ?',
      ['TRANSITION', nextRound, JSON.stringify(aliveIds), now, msg, room.code]
    );
    return;
  }

  const targetId = entries[0][0];
  const targetPlayer = alivePlayers.find((p) => p.id === targetId);

  if (!targetPlayer) return;

  // Eliminasi pemain terpilih
  await pool.query('UPDATE mafia_players SET is_alive = FALSE WHERE id = ?', [targetId]);

  // ATURAN: Jika yang di-vote adalah WARGA (bukan Mafia), MAFIA LANGSUNG MENANG!
  if (targetPlayer.role !== 'MAFIA') {
    await pool.query(
      'UPDATE mafia_rooms SET status = ?, winner = ?, phase_started_at = ?, transition_msg = ? WHERE code = ?',
      [
        'FINISHED',
        'MAFIA',
        now,
        `Salah tebak! ${targetPlayer.name} adalah WARGA. Mafia langsung menang!`,
        room.code,
      ]
    );
    return;
  }

  // Jika yang di-vote tepat MAFIA:
  const remainingMafia = alivePlayers.filter((p) => p.id !== targetId && p.role === 'MAFIA');
  if (remainingMafia.length === 0) {
    // Semua Mafia tertangkap -> WARGA MENANG!
    await pool.query(
      'UPDATE mafia_rooms SET status = ?, winner = ?, phase_started_at = ?, transition_msg = ? WHERE code = ?',
      [
        'FINISHED',
        'CIVILIAN',
        now,
        `Tepat sasaran! ${targetPlayer.name} adalah MAFIA. Warga menang!`,
        room.code,
      ]
    );
  } else {
    // Masih ada Mafia tersisa (misal main 6+ orang) -> Lanjut ronde berikutnya
    const remainingIds = alivePlayers
      .filter((p) => p.id !== targetId)
      .map((p) => p.id)
      .sort(() => Math.random() - 0.5);
    const msg = `Voting ditutup! ${targetPlayer.name} adalah MAFIA (${remainingMafia.length} Mafia tersisa). Ronde ${nextRound} dimulai!`;

    await pool.query(
      'UPDATE mafia_rooms SET status = ?, round_number = ?, turn_order = ?, phase_started_at = ?, transition_msg = ? WHERE code = ?',
      ['TRANSITION', nextRound, JSON.stringify(remainingIds), now, msg, room.code]
    );
  }
}

export async function GET(request) {
  try {
    await ensureMafiaTables();
    const { searchParams } = new URL(request.url);
    const code = (searchParams.get('code') || '').trim().toUpperCase();
    const playerId = (searchParams.get('playerId') || '').trim();

    if (!code) return NextResponse.json({ error: 'Kode room wajib diisi' }, { status: 400 });

    let [rooms] = await pool.query('SELECT * FROM mafia_rooms WHERE code = ?', [code]);
    if (rooms.length === 0) {
      return NextResponse.json({ error: 'Room tidak ditemukan atau sudah berakhir' }, { status: 404 });
    }

    let room = rooms[0];
    let [players] = await pool.query(
      'SELECT id, name, role, is_alive, voted_for FROM mafia_players WHERE room_code = ? ORDER BY joined_at ASC',
      [code]
    );

    const now = Date.now();
    const startedAt = Number(room.phase_started_at || now);
    const elapsedSec = (now - startedAt) / 1000;
    const turnOrder = room.turn_order ? JSON.parse(room.turn_order) : [];

    // AUTO-TRANSISI FASE BERDASARKAN TIMER SERVER
    if (room.status === 'COUNTDOWN' && elapsedSec >= 3.5) {
      await pool.query('UPDATE mafia_rooms SET status = ?, phase_started_at = ? WHERE code = ?', [
        'CLUE_TURN',
        now,
        code,
      ]);
      room.status = 'CLUE_TURN';
      room.phase_started_at = now;
    } else if (room.status === 'TRANSITION' && elapsedSec >= 4.0) {
      await pool.query('UPDATE mafia_rooms SET status = ?, phase_started_at = ? WHERE code = ?', [
        'CLUE_TURN',
        now,
        code,
      ]);
      room.status = 'CLUE_TURN';
      room.phase_started_at = now;
    } else if (room.status === 'CLUE_TURN') {
      const totalClueDuration = Math.max(1, turnOrder.length) * 5;
      if (elapsedSec >= totalClueDuration) {
        await pool.query('UPDATE mafia_rooms SET status = ?, phase_started_at = ? WHERE code = ?', [
          'VOTING',
          now,
          code,
        ]);
        room.status = 'VOTING';
        room.phase_started_at = now;
      }
    } else if (room.status === 'VOTING') {
      const alivePlayers = players.filter((p) => Boolean(p.is_alive));
      const allVoted = alivePlayers.length > 0 && alivePlayers.every((p) => Boolean(p.voted_for));
      if (elapsedSec >= 30 || allVoted) {
        await evaluateVoting(room, players);
        // Ambil ulang state terbaru setelah evaluasi
        [rooms] = await pool.query('SELECT * FROM mafia_rooms WHERE code = ?', [code]);
        room = rooms[0];
        [players] = await pool.query(
          'SELECT id, name, role, is_alive, voted_for FROM mafia_players WHERE room_code = ? ORDER BY joined_at ASC',
          [code]
        );
      }
    }

    // Hitung sisa waktu fase aktif untuk dikirim ke klien
    const currentElapsed = (Date.now() - Number(room.phase_started_at || Date.now())) / 1000;
    let timeLeft = 0;
    let currentSpeaker = null;

    if (room.status === 'COUNTDOWN') {
      timeLeft = Math.max(0, Math.ceil(3.5 - currentElapsed));
    } else if (room.status === 'TRANSITION') {
      timeLeft = Math.max(0, Math.ceil(4 - currentElapsed));
    } else if (room.status === 'CLUE_TURN') {
      const turnIdx = Math.min(turnOrder.length - 1, Math.floor(currentElapsed / 5));
      const speakerId = turnOrder[turnIdx];
      const speakerObj = players.find((p) => p.id === speakerId);
      currentSpeaker = speakerObj
        ? { id: speakerObj.id, name: speakerObj.name, index: turnIdx + 1, total: turnOrder.length }
        : null;
      timeLeft = Math.max(0, Math.ceil(5 - (currentElapsed % 5)));
    } else if (room.status === 'VOTING') {
      timeLeft = Math.max(0, Math.ceil(30 - currentElapsed));
    }

    const me = players.find((p) => p.id === playerId) || null;
    const isFinished = room.status === 'FINISHED';

    const voteCounts = {};
    players.forEach((p) => {
      if (p.is_alive && p.voted_for && p.voted_for !== 'ABSTAIN') {
        voteCounts[p.voted_for] = (voteCounts[p.voted_for] || 0) + 1;
      }
    });

    const safePlayers = players.map((p) => ({
      id: p.id,
      name: p.name,
      is_alive: Boolean(p.is_alive),
      has_voted: Boolean(p.voted_for),
      votes_received: voteCounts[p.id] || 0,
      role: isFinished ? p.role : null,
    }));

    let myWord = null;
    if (me && room.status !== 'LOBBY') {
      myWord = me.role === 'MAFIA' ? room.mafia_word : room.civilian_word;
    }

    return NextResponse.json({
      room: {
        code: room.code,
        host_id: room.host_id,
        status: room.status,
        round_number: room.round_number,
        winner: room.winner,
        transition_msg: room.transition_msg,
        time_left: timeLeft,
        current_speaker: currentSpeaker,
        civilian_word: isFinished ? room.civilian_word : null,
        mafia_word: isFinished ? room.mafia_word : null,
      },
      players: safePlayers,
      me: me
        ? {
            id: me.id,
            name: me.name,
            is_alive: Boolean(me.is_alive),
            voted_for: me.voted_for,
            word: myWord,
            role: isFinished ? me.role : null,
          }
        : null,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureMafiaTables();
    const body = await request.json();
    const { action } = body;

    // 1. BUAT ROOM BARU
    if (action === 'CREATE_ROOM') {
      const name = String(body.name || '').trim().slice(0, 25);
      if (!name) return NextResponse.json({ error: 'Nama panggilan wajib diisi' }, { status: 400 });

      const code = generateRoomCode();
      const playerId = generatePlayerId();

      await pool.query('INSERT INTO mafia_rooms (code, host_id, status) VALUES (?, ?, ?)', [
        code,
        playerId,
        'LOBBY',
      ]);
      await pool.query(
        'INSERT INTO mafia_players (id, room_code, name, role, is_alive) VALUES (?, ?, ?, ?, TRUE)',
        [playerId, code, name, 'CIVILIAN']
      );

      return NextResponse.json({ success: true, code, playerId });
    }

    // 2. GABUNG ROOM
    if (action === 'JOIN_ROOM') {
      const code = String(body.code || '').trim().toUpperCase();
      const name = String(body.name || '').trim().slice(0, 25);
      if (!code || !name) {
        return NextResponse.json({ error: 'Kode room & nama wajib diisi' }, { status: 400 });
      }

      const [rooms] = await pool.query('SELECT * FROM mafia_rooms WHERE code = ?', [code]);
      if (rooms.length === 0) {
        return NextResponse.json({ error: 'Kode room tidak ditemukan!' }, { status: 404 });
      }
      if (rooms[0].status !== 'LOBBY') {
        return NextResponse.json({ error: 'Permainan sudah dimulai. Tunggu ronde berikutnya!' }, { status: 400 });
      }

      const playerId = generatePlayerId();
      await pool.query(
        'INSERT INTO mafia_players (id, room_code, name, role, is_alive) VALUES (?, ?, ?, ?, TRUE)',
        [playerId, code, name, 'CIVILIAN']
      );

      return NextResponse.json({ success: true, code, playerId });
    }

    // 3. MULAI PERMAINAN (Rasio 2 Warga : 1 Mafia, mulai dari COUNTDOWN 3-2-1)
    if (action === 'START_GAME') {
      const code = String(body.code || '').trim().toUpperCase();
      const playerId = String(body.playerId || '').trim();

      const [rooms] = await pool.query('SELECT * FROM mafia_rooms WHERE code = ?', [code]);
      if (rooms.length === 0) return NextResponse.json({ error: 'Room tidak ditemukan' }, { status: 404 });
      if (rooms[0].host_id !== playerId) {
        return NextResponse.json({ error: 'Hanya Host yang bisa memulai game' }, { status: 403 });
      }

      const [players] = await pool.query('SELECT id FROM mafia_players WHERE room_code = ?', [code]);
      if (players.length < 3) {
        return NextResponse.json({ error: 'Minimal 3 pemain untuk memulai MAFIA SMARA!' }, { status: 400 });
      }

      const pair = MAFIA_WORD_PAIRS[Math.floor(Math.random() * MAFIA_WORD_PAIRS.length)];
      // Rasio 2 Warga : 1 Mafia (setiap kelipatan 3 pemain = 1 Mafia, misal 3->1, 6->2, 9->3)
      const mafiaCount = Math.max(1, Math.floor(players.length / 3));

      const shuffledForRole = [...players].sort(() => Math.random() - 0.5);
      const mafiaIds = new Set(shuffledForRole.slice(0, mafiaCount).map((p) => p.id));

      for (const p of players) {
        const role = mafiaIds.has(p.id) ? 'MAFIA' : 'CIVILIAN';
        await pool.query(
          'UPDATE mafia_players SET role = ?, is_alive = TRUE, voted_for = NULL WHERE id = ?',
          [role, p.id]
        );
      }

      // Acak urutan giliran bicara 5 detik
      const turnOrder = [...players].map((p) => p.id).sort(() => Math.random() - 0.5);
      const now = Date.now();

      await pool.query(
        'UPDATE mafia_rooms SET status = ?, civilian_word = ?, mafia_word = ?, round_number = 1, winner = NULL, turn_order = ?, phase_started_at = ?, transition_msg = NULL WHERE code = ?',
        ['COUNTDOWN', pair.civilian, pair.mafia, JSON.stringify(turnOrder), now, code]
      );

      return NextResponse.json({ success: true });
    }

    // 4. VOTING PEMAIN
    if (action === 'VOTE') {
      const { code, playerId, targetId } = body;
      if (!code || !playerId || !targetId) {
        return NextResponse.json({ error: 'Data voting tidak lengkap' }, { status: 400 });
      }
      if (playerId === targetId) {
        return NextResponse.json({ error: 'Tidak bisa memilih diri sendiri!' }, { status: 400 });
      }

      await pool.query(
        'UPDATE mafia_players SET voted_for = ? WHERE id = ? AND room_code = ? AND is_alive = TRUE',
        [targetId, playerId, code.toUpperCase()]
      );

      return NextResponse.json({ success: true });
    }

    // 5. MAIN LAGI / RESET KE LOBI (KHUSUS HOST)
    if (action === 'RESET_ROOM') {
      const code = String(body.code || '').trim().toUpperCase();
      const playerId = String(body.playerId || '').trim();

      const [rooms] = await pool.query('SELECT * FROM mafia_rooms WHERE code = ?', [code]);
      if (rooms.length === 0) return NextResponse.json({ error: 'Room tidak ditemukan' }, { status: 404 });
      if (rooms[0].host_id !== playerId) {
        return NextResponse.json({ error: 'Hanya Host yang bisa mereset room' }, { status: 403 });
      }

      await pool.query(
        'UPDATE mafia_players SET role = ?, is_alive = TRUE, voted_for = NULL WHERE room_code = ?',
        ['CIVILIAN', code]
      );
      await pool.query(
        'UPDATE mafia_rooms SET status = ?, civilian_word = NULL, mafia_word = NULL, round_number = 1, winner = NULL, turn_order = NULL, phase_started_at = NULL, transition_msg = NULL WHERE code = ?',
        ['LOBBY', code]
      );

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Aksi tidak dikenali' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
