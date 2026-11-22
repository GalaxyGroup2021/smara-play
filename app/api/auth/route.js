import { NextResponse } from 'next/server';
import crypto from 'crypto';

const SECRET = process.env.GAME_SECRET || 'SMARA_KOPI_PLAY_SECRET_2026';

// Ambil tanggal hari ini dalam zona waktu WIB (UTC+7)
function getWibDateString(offsetDays = 0) {
  const now = new Date();
  const wibTime = new Date(now.getTime() + 7 * 60 * 60 * 1000 + offsetDays * 86400000);
  return wibTime.toISOString().slice(0, 10); // YYYY-MM-DD
}

// Generate Daily Password otomatis 6 digit angka: contoh SMARA-482910
export function generateDailyPassword(dateStr) {
  const hash = crypto
    .createHmac('sha256', SECRET)
    .update(`SMARA-DAILY-6D-${dateStr}`)
    .digest('hex');

  // Ambil 6 digit angka deterministik dari hash
  const num = parseInt(hash.slice(0, 8), 16) % 1000000;
  const sixDigits = String(num).padStart(6, '0');
  return `SMARA-${sixDigits}`;
}

function createSessionToken(dateStr) {
  const sig = crypto.createHmac('sha256', SECRET).update(`SESSION-${dateStr}`).digest('hex');
  return `${dateStr}.${sig}`;
}

export function verifyPlaySession(token) {
  if (!token) return false;
  const [dateStr, sig] = token.split('.');
  if (!dateStr || !sig) return false;
  const today = getWibDateString(0);
  if (dateStr !== today) return false;
  const expected = crypto.createHmac('sha256', SECRET).update(`SESSION-${dateStr}`).digest('hex');
  return sig === expected;
}

export async function GET(request) {
  const token = request.cookies.get('smara_play_session')?.value;
  const valid = verifyPlaySession(token);
  const today = getWibDateString(0);
  return NextResponse.json({ authenticated: valid, date: today });
}

export async function POST(request) {
  try {
    const body = await request.json();

    if (body.action === 'LOGOUT') {
      const res = NextResponse.json({ success: true });
      res.cookies.set('smara_play_session', '', { maxAge: 0, path: '/' });
      return res;
    }

    // Login Pengunjung menggunakan Daily Password (SMARA-XXXXXX atau XXXXXX)
    const inputCode = String(body.password || '').trim().toUpperCase();
    const today = getWibDateString(0);
    const expectedCode = generateDailyPassword(today);
    const shortExpected = expectedCode.replace('SMARA-', '');

    if (inputCode !== expectedCode && inputCode !== shortExpected) {
      return NextResponse.json(
        { error: 'Kode harian salah atau sudah kedaluwarsa. Dapatkan kode terbaru saat jajan di SMARA KOPI!' },
        { status: 401 }
      );
    }

    const token = createSessionToken(today);
    const res = NextResponse.json({ success: true, date: today });
    res.cookies.set('smara_play_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24,
    });
    return res;
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
