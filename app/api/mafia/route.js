import { NextResponse } from 'next/server';
import pool, { ensureMafiaTables } from '@/lib/db';
import { MAFIA_WORD_PAIRS } from '@/data/mafiaWords';

// ===== PENGATURAN DURASI FASE (detik) =====
const COUNTDOWN_SEC = 3.5;
const TRANSITION_SEC = 4.5;
const CLUE_SEC = 10; // waktu tiap pemain menjelaskan kata kunci
const VOTE_SEC = 30;
const REVOTE_SEC = 20; // voting ulang khusus kandidat yang seri

const PLAYER_COLUMNS = 'id, name, role, is_alive, voted_for, has_left';

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

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function parseJsonArray(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * ATURAN MENANG:
 * - Semua Mafia tersingkir            -> WARGA menang
 * - Pemain aktif tinggal 2 (atau Warga habis) -> MAFIA menang (Mafia berhasil bertahan)
 * - Selain itu permainan lanjut ke ronde berikutnya
 */
function getWinner(alivePlayers) {
  const mafiaAlive = alivePlayers.filter((p) => p.role === 'MAFIA').length;
  const civilianAlive = alivePlayers.length - mafiaAlive;
  if (mafiaAlive === 0) return 'CIVILIAN';
  if (alivePlayers.length <= 2 || civilianAlive === 0) return 'MAFIA';
  return null;
}

function roleLabel(role) {
  return role === 'MAFIA' ? 'MAFIA' : 'WARGA';
}

/**
 * Evaluasi hasil voting di dalam TRANSAKSI + row lock, supaya walaupun banyak HP
 * melakukan polling bersamaan, hasil voting hanya diproses SATU KALI.
 */
async function resolveVotingOnce(code, expectedPhaseStartedAt) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rooms] = await conn.query('SELECT * FROM mafia_rooms WHERE code = ? FOR UPDATE', [code]);
    const room = rooms[0];
    if (
      !room ||
      room.status !== 'VOTING' ||
      Number(room.phase_started_at) !== Number(expectedPhaseStartedAt)
    ) {
      await conn.rollback();
      return;
    }

    const [players] = await conn.query(
      `SELECT ${PLAYER_COLUMNS} FROM mafia_players WHERE room_code = ? ORDER BY joined_at ASC`,
      [code]
    );
    const alive = players.filter((p) => Boolean(p.is_alive));
    const aliveIds = new Set(alive.map((p) => p.id));
    const candidates = parseJsonArray(room.vote_candidates).filter((id) => aliveIds.has(id));
    const isRevote = candidates.length >= 2;
    const validTargets = new Set(isRevote ? candidates : [...aliveIds]);

    // Hitung suara (hanya dari pemain aktif ke target yang sah)
    const counts = {};
    alive.forEach((p) => {
      if (p.voted_for && validTargets.has(p.voted_for) && p.voted_for !== p.id) {
        counts[p.voted_for] = (counts[p.voted_for] || 0) + 1;
      }
    });
    const maxVotes = Math.max(0, ...Object.values(counts));
    const topIds = maxVotes > 0 ? Object.keys(counts).filter((id) => counts[id] === maxVotes) : [];

    const nextRound = Number(room.round_number || 1) + 1;
    const now = Date.now();
    let targetId = null;
    let prefix = '';

    if (topIds.length === 1) {
      targetId = topIds[0];
    } else if (!isRevote) {
      // SERI / TIDAK ADA SUARA (pertama kali) -> voting ulang khusus kandidat
      const revoteIds = topIds.length >= 2 ? topIds : [...aliveIds];
      const names = revoteIds
        .map((id) => players.find((p) => p.id === id)?.name)
        .filter(Boolean)
        .join(', ');
      const msg =
        topIds.length >= 2
          ? `Hasil seri antara ${names}! Voting ulang ${REVOTE_SEC} detik khusus mereka.`
          : `Belum ada yang vote! Voting ulang ${REVOTE_SEC} detik, kali ini wajib pilih.`;

      await conn.query('UPDATE mafia_players SET voted_for = NULL WHERE room_code = ?', [code]);
      await conn.query(
        'UPDATE mafia_rooms SET status = ?, vote_candidates = ?, phase_started_at = ?, transition_msg = ? WHERE code = ?',
        ['TRANSITION', JSON.stringify(revoteIds), now, msg, code]
      );
      await conn.commit();
      return;
    } else {
      // Sudah voting ulang tapi masih seri / kosong -> diundi acak supaya game tidak looping
      const pool2 = topIds.length >= 2 ? topIds : candidates;
      targetId = pool2[Math.floor(Math.random() * pool2.length)];
      prefix = 'Masih seri, diundi acak! ';
    }

    const target = players.find((p) => p.id === targetId);
    if (!target) {
      await conn.rollback();
      return;
    }

    const aliveAfter = alive.filter((p) => p.id !== targetId);
    const winner = getWinner(aliveAfter);

    await conn.query('UPDATE mafia_players SET voted_for = NULL WHERE room_code = ?', [code]);
    await conn.query('UPDATE mafia_players SET is_alive = FALSE WHERE id = ?', [targetId]);

    if (winner) {
      const msg =
        winner === 'CIVILIAN'
          ? `${prefix}${target.name} tersingkir dan dia adalah MAFIA terakhir. Warga menang!`
          : `${prefix}${target.name} tersingkir (ternyata ${roleLabel(target.role)}). Tinggal ${aliveAfter.length} pemain, Mafia berhasil bertahan!`;
      await conn.query(
        'UPDATE mafia_rooms SET status = ?, winner = ?, vote_candidates = NULL, phase_started_at = ?, transition_msg = ? WHERE code = ?',
        ['FINISHED', winner, now, msg, code]
      );
    } else {
      const mafiaLeft = aliveAfter.filter((p) => p.role === 'MAFIA').length;
      const msg = `${prefix}${target.name} tersingkir, ternyata ${roleLabel(target.role)}! Sisa ${aliveAfter.length} pemain (${mafiaLeft} Mafia masih bersembunyi). Ronde ${nextRound} dimulai!`;
      await conn.query(
        'UPDATE mafia_rooms SET status = ?, round_number = ?, turn_order = ?, vote_candidates = NULL, phase_started_at = ?, transition_msg = ? WHERE code = ?',
        ['TRANSITION', nextRound, JSON.stringify(shuffle(aliveAfter.map((p) => p.id))), now, msg, code]
      );
    }

    await conn.commit();
  } catch {
    try {
      await conn.rollback();
    } catch {}
  } finally {
    conn.release();
  }
}

/** Pindah fase secara aman: hanya berhasil jika fase belum dipindah oleh HP lain */
async function advancePhase(code, fromStatus, fromStartedAt, toStatus) {
  await pool.query(
    'UPDATE mafia_rooms SET status = ?, phase_started_at = ? WHERE code = ? AND status = ? AND phase_started_at = ?',
    [toStatus, Date.now(), code, fromStatus, fromStartedAt]
  );
}

async function loadRoom(code) {
  const [rooms] = await pool.query('SELECT * FROM mafia_rooms WHERE code = ?', [code]);
  if (rooms.length === 0) return { room: null, players: [] };
  const [players] = await pool.query(
    `SELECT ${PLAYER_COLUMNS} FROM mafia_players WHERE room_code = ? ORDER BY joined_at ASC`,
    [code]
  );
  return { room: rooms[0], players };
}

async function cleanupOldRooms() {
  try {
    await pool.query(
      'DELETE FROM mafia_players WHERE room_code IN (SELECT code FROM mafia_rooms WHERE updated_at < NOW() - INTERVAL 1 DAY)'
    );
    await pool.query('DELETE FROM mafia_rooms WHERE updated_at < NOW() - INTERVAL 1 DAY');
  } catch {}
}

export async function GET(request) {
  try {
    await ensureMafiaTables();
    const { searchParams } = new URL(request.url);
    const code = (searchParams.get('code') || '').trim().toUpperCase();
    const playerId = (searchParams.get('playerId') || '').trim();

    if (!code) return NextResponse.json({ error: 'Kode room wajib diisi' }, { status: 400 });

    let { room, players } = await loadRoom(code);
    if (!room) {
      return NextResponse.json({ error: 'Room tidak ditemukan atau sudah berakhir' }, { status: 404 });
    }

    const now = Date.now();
    const startedAt = Number(room.phase_started_at || now);
    const elapsedSec = (now - startedAt) / 1000;
    const turnOrder = parseJsonArray(room.turn_order);
    const pendingRevote = parseJsonArray(room.vote_candidates).length >= 2;

    // AUTO-TRANSISI FASE BERDASARKAN TIMER SERVER
    let changed = false;
    if (room.status === 'COUNTDOWN' && elapsedSec >= COUNTDOWN_SEC) {
      await advancePhase(code, 'COUNTDOWN', room.phase_started_at, 'CLUE_TURN');
      changed = true;
    } else if (room.status === 'TRANSITION' && elapsedSec >= TRANSITION_SEC) {
      // Setelah hasil seri -> langsung voting ulang; selain itu -> giliran clue ronde baru
      await advancePhase(code, 'TRANSITION', room.phase_started_at, pendingRevote ? 'VOTING' : 'CLUE_TURN');
      changed = true;
    } else if (room.status === 'CLUE_TURN' && elapsedSec >= Math.max(1, turnOrder.length) * CLUE_SEC) {
      await advancePhase(code, 'CLUE_TURN', room.phase_started_at, 'VOTING');
      changed = true;
    } else if (room.status === 'VOTING') {
      const alive = players.filter((p) => Boolean(p.is_alive));
      const allVoted = alive.length > 0 && alive.every((p) => Boolean(p.voted_for));
      const limit = pendingRevote ? REVOTE_SEC : VOTE_SEC;
      if (elapsedSec >= limit || allVoted) {
        await resolveVotingOnce(code, room.phase_started_at);
        changed = true;
      }
    }

    if (changed) {
      ({ room, players } = await loadRoom(code));
      if (!room) {
        return NextResponse.json({ error: 'Room tidak ditemukan atau sudah berakhir' }, { status: 404 });
      }
    }

    // Hitung sisa waktu fase aktif untuk dikirim ke klien
    const currentTurnOrder = parseJsonArray(room.turn_order);
    const voteCandidates = parseJsonArray(room.vote_candidates);
    const isRevote = voteCandidates.length >= 2;
    const currentElapsed = (Date.now() - Number(room.phase_started_at || Date.now())) / 1000;
    let timeLeft = 0;
    let phaseDuration = 0;
    let currentSpeaker = null;

    if (room.status === 'COUNTDOWN') {
      phaseDuration = COUNTDOWN_SEC;
      timeLeft = Math.max(0, Math.ceil(COUNTDOWN_SEC - currentElapsed));
    } else if (room.status === 'TRANSITION') {
      phaseDuration = TRANSITION_SEC;
      timeLeft = Math.max(0, Math.ceil(TRANSITION_SEC - currentElapsed));
    } else if (room.status === 'CLUE_TURN') {
      phaseDuration = CLUE_SEC;
      const turnIdx = Math.max(
        0,
        Math.min(currentTurnOrder.length - 1, Math.floor(currentElapsed / CLUE_SEC))
      );
      const speakerObj = players.find((p) => p.id === currentTurnOrder[turnIdx]);
      currentSpeaker = speakerObj
        ? {
            id: speakerObj.id,
            name: speakerObj.name,
            has_left: Boolean(speakerObj.has_left),
            index: turnIdx + 1,
            total: currentTurnOrder.length,
          }
        : null;
      timeLeft = Math.max(0, Math.ceil(CLUE_SEC - (currentElapsed % CLUE_SEC)));
    } else if (room.status === 'VOTING') {
      phaseDuration = isRevote ? REVOTE_SEC : VOTE_SEC;
      timeLeft = Math.max(0, Math.ceil(phaseDuration - currentElapsed));
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
      has_left: Boolean(p.has_left),
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
        phase_duration: phaseDuration,
        clue_seconds: CLUE_SEC,
        is_revote: isRevote,
        vote_candidates: isRevote ? voteCandidates : [],
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

      await cleanupOldRooms();

      // Pastikan kode room unik (hindari bentrok dengan room yang masih aktif)
      let code = '';
      for (let attempt = 0; attempt < 8; attempt++) {
        const candidate = generateRoomCode();
        const [exists] = await pool.query('SELECT code FROM mafia_rooms WHERE code = ?', [candidate]);
        if (exists.length === 0) {
          code = candidate;
          break;
        }
      }
      if (!code) {
        return NextResponse.json({ error: 'Gagal membuat room, coba lagi.' }, { status: 500 });
      }

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
      if (rooms[0].status !== 'LOBBY') {
        return NextResponse.json({ error: 'Permainan sudah berjalan' }, { status: 400 });
      }

      await pool.query('DELETE FROM mafia_players WHERE room_code = ? AND has_left = TRUE', [code]);
      const [players] = await pool.query('SELECT id FROM mafia_players WHERE room_code = ?', [code]);
      if (players.length < 3) {
        return NextResponse.json({ error: 'Minimal 3 pemain untuk memulai MAFIA SMARA!' }, { status: 400 });
      }

      const pair = MAFIA_WORD_PAIRS[Math.floor(Math.random() * MAFIA_WORD_PAIRS.length)];
      // Acak juga sisi kata, supaya Mafia tidak selalu dapat kata yang sama untuk pasangan ini
      const swap = Math.random() < 0.5;
      const civilianWord = swap ? pair.mafia : pair.civilian;
      const mafiaWord = swap ? pair.civilian : pair.mafia;

      // Rasio 2 Warga : 1 Mafia (3-5 pemain -> 1 Mafia, 6-8 -> 2 Mafia, dst)
      const mafiaCount = Math.max(1, Math.floor(players.length / 3));
      const mafiaIds = new Set(shuffle(players).slice(0, mafiaCount).map((p) => p.id));

      for (const p of players) {
        const role = mafiaIds.has(p.id) ? 'MAFIA' : 'CIVILIAN';
        await pool.query(
          'UPDATE mafia_players SET role = ?, is_alive = TRUE, voted_for = NULL, has_left = FALSE WHERE id = ?',
          [role, p.id]
        );
      }

      const turnOrder = shuffle(players.map((p) => p.id));
      const now = Date.now();

      await pool.query(
        'UPDATE mafia_rooms SET status = ?, civilian_word = ?, mafia_word = ?, round_number = 1, winner = NULL, turn_order = ?, vote_candidates = NULL, phase_started_at = ?, transition_msg = NULL WHERE code = ?',
        ['COUNTDOWN', civilianWord, mafiaWord, JSON.stringify(turnOrder), now, code]
      );

      return NextResponse.json({ success: true });
    }

    // 4. VOTING PEMAIN
    if (action === 'VOTE') {
      const code = String(body.code || '').trim().toUpperCase();
      const playerId = String(body.playerId || '').trim();
      const targetId = String(body.targetId || '').trim();
      if (!code || !playerId || !targetId) {
        return NextResponse.json({ error: 'Data voting tidak lengkap' }, { status: 400 });
      }
      if (playerId === targetId) {
        return NextResponse.json({ error: 'Tidak bisa memilih diri sendiri!' }, { status: 400 });
      }

      const { room, players } = await loadRoom(code);
      if (!room) return NextResponse.json({ error: 'Room tidak ditemukan' }, { status: 404 });
      if (room.status !== 'VOTING') {
        return NextResponse.json({ error: 'Waktu voting sudah ditutup' }, { status: 400 });
      }
      const voter = players.find((p) => p.id === playerId);
      const target = players.find((p) => p.id === targetId);
      if (!voter || !voter.is_alive) {
        return NextResponse.json({ error: 'Kamu sudah tersingkir, tidak bisa voting' }, { status: 400 });
      }
      if (!target || !target.is_alive) {
        return NextResponse.json({ error: 'Pemain ini sudah tersingkir' }, { status: 400 });
      }
      const candidates = parseJsonArray(room.vote_candidates);
      if (candidates.length >= 2 && !candidates.includes(targetId)) {
        return NextResponse.json({ error: 'Voting ulang hanya untuk kandidat yang seri' }, { status: 400 });
      }

      await pool.query(
        'UPDATE mafia_players SET voted_for = ? WHERE id = ? AND room_code = ? AND is_alive = TRUE',
        [targetId, playerId, code]
      );

      return NextResponse.json({ success: true });
    }

    // 5. KELUAR ROOM
    if (action === 'LEAVE_ROOM') {
      const code = String(body.code || '').trim().toUpperCase();
      const playerId = String(body.playerId || '').trim();
      const { room, players } = await loadRoom(code);
      const leaver = players.find((p) => p.id === playerId);
      if (!room || !leaver) return NextResponse.json({ success: true });

      const inGame = room.status !== 'LOBBY' && room.status !== 'FINISHED';

      if (inGame) {
        // Saat game berjalan: pemain dianggap tersingkir supaya game tetap bisa selesai
        await pool.query(
          'UPDATE mafia_players SET is_alive = FALSE, has_left = TRUE, voted_for = NULL WHERE id = ?',
          [playerId]
        );
        await pool.query('UPDATE mafia_players SET voted_for = NULL WHERE room_code = ? AND voted_for = ?', [
          code,
          playerId,
        ]);

        const aliveAfter = players.filter((p) => p.is_alive && p.id !== playerId);
        const winner = getWinner(aliveAfter);
        if (winner) {
          const msg =
            winner === 'CIVILIAN'
              ? `${leaver.name} keluar dari room, dan dia adalah MAFIA terakhir. Warga menang!`
              : `${leaver.name} keluar dari room. Tinggal ${aliveAfter.length} pemain, Mafia berhasil bertahan!`;
          await pool.query(
            'UPDATE mafia_rooms SET status = ?, winner = ?, vote_candidates = NULL, phase_started_at = ?, transition_msg = ? WHERE code = ?',
            ['FINISHED', winner, Date.now(), msg, code]
          );
        } else {
          const candidates = parseJsonArray(room.vote_candidates).filter((id) => id !== playerId);
          await pool.query('UPDATE mafia_rooms SET vote_candidates = ? WHERE code = ?', [
            candidates.length >= 2 ? JSON.stringify(candidates) : null,
            code,
          ]);
        }
      } else {
        await pool.query('DELETE FROM mafia_players WHERE id = ?', [playerId]);
      }

      // Pindahkan Host ke pemain lain jika Host keluar
      if (room.host_id === playerId) {
        const remaining = players.filter((p) => p.id !== playerId && !p.has_left);
        if (remaining.length === 0) {
          await pool.query('DELETE FROM mafia_players WHERE room_code = ?', [code]);
          await pool.query('DELETE FROM mafia_rooms WHERE code = ?', [code]);
        } else {
          const nextHost = remaining.find((p) => p.is_alive) || remaining[0];
          await pool.query('UPDATE mafia_rooms SET host_id = ? WHERE code = ?', [nextHost.id, code]);
        }
      }

      return NextResponse.json({ success: true });
    }

    // 6. MAIN LAGI / RESET KE LOBI (KHUSUS HOST)
    if (action === 'RESET_ROOM') {
      const code = String(body.code || '').trim().toUpperCase();
      const playerId = String(body.playerId || '').trim();

      const [rooms] = await pool.query('SELECT * FROM mafia_rooms WHERE code = ?', [code]);
      if (rooms.length === 0) return NextResponse.json({ error: 'Room tidak ditemukan' }, { status: 404 });
      if (rooms[0].host_id !== playerId) {
        return NextResponse.json({ error: 'Hanya Host yang bisa mereset room' }, { status: 403 });
      }

      await pool.query('DELETE FROM mafia_players WHERE room_code = ? AND has_left = TRUE', [code]);
      await pool.query(
        'UPDATE mafia_players SET role = ?, is_alive = TRUE, voted_for = NULL WHERE room_code = ?',
        ['CIVILIAN', code]
      );
      await pool.query(
        'UPDATE mafia_rooms SET status = ?, civilian_word = NULL, mafia_word = NULL, round_number = 1, winner = NULL, turn_order = NULL, vote_candidates = NULL, phase_started_at = NULL, transition_msg = NULL WHERE code = ?',
        ['LOBBY', code]
      );

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Aksi tidak dikenali' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
