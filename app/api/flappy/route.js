import { NextResponse } from 'next/server';
import pool from '@/lib/db';

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
      accessory VARCHAR(32) DEFAULT 'none',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_week_wa (week_key, wa_number),
      INDEX idx_week_score (week_key, best_score)
    )
  `);
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

export async function GET() {
  try {
    await ensureFlappyTable();
    const weekKey = getCurrentWibWeekKey();

    const [rows] = await pool.query(
      'SELECT id, player_name, best_score, accessory FROM flappy_weekly_scores WHERE week_key = ? ORDER BY best_score DESC, updated_at ASC LIMIT 10',
      [weekKey]
    );

    return NextResponse.json({
      weekKey,
      leaderboard: rows,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureFlappyTable();
    const body = await request.json();

    const name = String(body.name || '').trim().slice(0, 30);
    const waNormalized = normalizeWaNumber(body.wa);
    const score = Math.max(0, Math.min(9999, Math.floor(Number(body.score || 0))));
    const accessory = String(body.accessory || 'none').slice(0, 30);

    if (!name) {
      return NextResponse.json({ error: 'Nama panggilan wajib diisi!' }, { status: 400 });
    }
    if (waNormalized.length < 10 || waNormalized.length > 15) {
      return NextResponse.json({ error: 'Nomor WhatsApp tidak valid! Contoh: 081234567890' }, { status: 400 });
    }
    if (score <= 0) {
      return NextResponse.json({ error: 'Skor minimal 1 untuk masuk ranking mingguan!' }, { status: 400 });
    }

    const weekKey = getCurrentWibWeekKey();

    // Nama di klasemen tetap stay pada entri awal minggu ini; skor diperbarui jika melampaui rekor lama
    await pool.query(
      `INSERT INTO flappy_weekly_scores (week_key, player_name, wa_number, best_score, accessory)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         accessory = IF(VALUES(best_score) > best_score, VALUES(accessory), accessory),
         best_score = GREATEST(best_score, VALUES(best_score))`,
      [weekKey, name, waNormalized, score, accessory]
    );

    const [rows] = await pool.query(
      'SELECT id, player_name, best_score, accessory FROM flappy_weekly_scores WHERE week_key = ? ORDER BY best_score DESC, updated_at ASC LIMIT 10',
      [weekKey]
    );

    return NextResponse.json({
      success: true,
      weekKey,
      leaderboard: rows,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
