import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { parseAccessories, serializeAccessories } from '@/lib/flappyCharacter';

let flappyTableReady = false;

async function ensureFlappyTable() {
  if (flappyTableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS flappy_weekly_scores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      week_key VARCHAR(16) NOT NULL,
      player_name VARCHAR(40) NOT NULL,
      wa_number VARCHAR(25) NOT NULL,
      best_score INT NOT NULL DEFAULT 0,
      accessory VARCHAR(255) DEFAULT '',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_week_wa (week_key, wa_number),
      INDEX idx_week_score (week_key, best_score)
    )
  `);

  // Perlebar kolom accessory pada tabel lama agar muat menyimpan banyak aksesoris sekaligus
  try {
    await pool.query(
      "ALTER TABLE flappy_weekly_scores MODIFY COLUMN accessory VARCHAR(255) DEFAULT ''"
    );
  } catch {}

  flappyTableReady = true;
}

function getCurrentWibWeekKey() {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const d = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function normalizeWaNumber(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('0')) {
    digits = '62' + digits.slice(1);
  } else if (digits.startsWith('8')) {
    digits = '62' + digits;
  }
  return digits;
}

async function fetchLeaderboardState(weekKey, waNormalized = '') {
  const [rows] = await pool.query(
    `SELECT id, player_name, wa_number, best_score, accessory
     FROM flappy_weekly_scores
     WHERE week_key = ?
     ORDER BY best_score DESC, updated_at ASC, id ASC
     LIMIT 10`,
    [weekKey]
  );

  const [countRows] = await pool.query(
    'SELECT COUNT(*) AS total FROM flappy_weekly_scores WHERE week_key = ?',
    [weekKey]
  );
  const totalPlayers = Number(countRows[0]?.total || 0);

  const leaderboard = rows.map((row) => ({
    id: row.id,
    player_name: row.player_name,
    best_score: Number(row.best_score || 0),
    accessory: serializeAccessories(row.accessory),
    accessories: parseAccessories(row.accessory),
    is_me: Boolean(waNormalized && row.wa_number === waNormalized),
  }));

  let me = null;
  if (waNormalized && waNormalized.length >= 10) {
    const [myRows] = await pool.query(
      `SELECT id, player_name, best_score, accessory, updated_at
       FROM flappy_weekly_scores
       WHERE week_key = ? AND wa_number = ?
       LIMIT 1`,
      [weekKey, waNormalized]
    );

    const [allTimeRows] = await pool.query(
      'SELECT COALESCE(MAX(best_score), 0) AS all_time_best FROM flappy_weekly_scores WHERE wa_number = ?',
      [waNormalized]
    );
    const allTimeBest = Number(allTimeRows[0]?.all_time_best || 0);

    if (myRows.length > 0) {
      const myRow = myRows[0];
      const [rankRows] = await pool.query(
        `SELECT COUNT(*) + 1 AS rank_pos
         FROM flappy_weekly_scores
         WHERE week_key = ?
           AND (
             best_score > ?
             OR (best_score = ? AND updated_at < ?)
             OR (best_score = ? AND updated_at = ? AND id < ?)
           )`,
        [
          weekKey,
          myRow.best_score,
          myRow.best_score,
          myRow.updated_at,
          myRow.best_score,
          myRow.updated_at,
          myRow.id,
        ]
      );
      me = {
        id: myRow.id,
        player_name: myRow.player_name,
        best_score: Number(myRow.best_score || 0),
        all_time_best: Math.max(allTimeBest, Number(myRow.best_score || 0)),
        accessories: parseAccessories(myRow.accessory),
        rank: Number(rankRows[0]?.rank_pos || 1),
      };
    } else if (allTimeBest > 0) {
      me = {
        id: null,
        player_name: '',
        best_score: 0,
        all_time_best: allTimeBest,
        accessories: [],
        rank: null,
      };
    }
  }

  return { weekKey, leaderboard, totalPlayers, me };
}

export async function GET(request) {
  try {
    await ensureFlappyTable();
    const { searchParams } = new URL(request.url);
    const waNormalized = normalizeWaNumber(searchParams.get('wa') || '');
    const weekKey = getCurrentWibWeekKey();

    const state = await fetchLeaderboardState(weekKey, waNormalized);
    return NextResponse.json(state);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureFlappyTable();
    const body = await request.json();

    const action = String(body.action || 'SAVE_SCORE').toUpperCase();
    const name = String(body.name || '').trim().slice(0, 30);
    const waNormalized = normalizeWaNumber(body.wa);
    const score = Math.max(0, Math.min(99999, Math.floor(Number(body.score || 0))));
    const rawAcc = body.accessories !== undefined ? body.accessories : body.accessory;
    const serializedAcc = serializeAccessories(rawAcc);

    if (name.length < 2) {
      return NextResponse.json({ error: 'Nama panggilan minimal 2 huruf!' }, { status: 400 });
    }
    if (waNormalized.length < 10 || waNormalized.length > 15) {
      return NextResponse.json(
        { error: 'Nomor WhatsApp tidak valid! Contoh: 081234567890' },
        { status: 400 }
      );
    }

    const weekKey = getCurrentWibWeekKey();

    if (action === 'UPDATE_ACCESSORIES') {
      // Pastikan pemain sudah ada di tabel minggu ini, lalu perbarui aksesorisnya tanpa mengubah urutan skor
      await pool.query(
        `INSERT INTO flappy_weekly_scores (week_key, player_name, wa_number, best_score, accessory)
         VALUES (?, ?, ?, 0, ?)
         ON DUPLICATE KEY UPDATE
           player_name = VALUES(player_name),
           accessory = VALUES(accessory),
           updated_at = updated_at`,
        [weekKey, name, waNormalized, serializedAcc]
      );
    } else if (action === 'REGISTER') {
      // Saat login mode Rank: langsung terdaftar di database & klasemen minggu ini (berapapun skor awalnya, termasuk 0)
      await pool.query(
        `INSERT INTO flappy_weekly_scores (week_key, player_name, wa_number, best_score, accessory)
         VALUES (?, ?, ?, 0, ?)
         ON DUPLICATE KEY UPDATE
           player_name = VALUES(player_name),
           accessory = IF(VALUES(accessory) != '', VALUES(accessory), accessory),
           updated_at = updated_at`,
        [weekKey, name, waNormalized, serializedAcc]
      );
    } else {
      // SAVE_SCORE: berapapun skor akhirnya (termasuk 0), langsung masuk database & klasemen mingguan
      await pool.query(
        `INSERT INTO flappy_weekly_scores (week_key, player_name, wa_number, best_score, accessory)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           player_name = VALUES(player_name),
           accessory = VALUES(accessory),
           updated_at = IF(VALUES(best_score) > best_score, CURRENT_TIMESTAMP, updated_at),
           best_score = GREATEST(best_score, VALUES(best_score))`,
        [weekKey, name, waNormalized, score, serializedAcc]
      );
    }

    const state = await fetchLeaderboardState(weekKey, waNormalized);

    return NextResponse.json({
      success: true,
      ...state,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
