import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 4000,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'kopi-jawa-db',
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true,
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

let tablesInitialized = false;

export async function ensureMafiaTables() {
  if (tablesInitialized) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mafia_rooms (
      code VARCHAR(8) PRIMARY KEY,
      host_id VARCHAR(32) NOT NULL,
      status VARCHAR(25) NOT NULL DEFAULT 'LOBBY',
      civilian_word VARCHAR(100) DEFAULT NULL,
      mafia_word VARCHAR(100) DEFAULT NULL,
      round_number INT DEFAULT 1,
      winner VARCHAR(20) DEFAULT NULL,
      turn_order TEXT DEFAULT NULL,
      phase_started_at BIGINT DEFAULT NULL,
      transition_msg VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Pastikan kolom baru ada jika tabel lama sudah sempat terbuat
  const extraCols = [
    'ALTER TABLE mafia_rooms ADD COLUMN turn_order TEXT DEFAULT NULL',
    'ALTER TABLE mafia_rooms ADD COLUMN phase_started_at BIGINT DEFAULT NULL',
    'ALTER TABLE mafia_rooms ADD COLUMN transition_msg VARCHAR(255) DEFAULT NULL',
    // Kandidat voting ulang (JSON array id) saat hasil voting seri
    'ALTER TABLE mafia_rooms ADD COLUMN vote_candidates TEXT DEFAULT NULL',
  ];
  for (const sql of extraCols) {
    try {
      await pool.query(sql);
    } catch {}
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS mafia_players (
      id VARCHAR(32) PRIMARY KEY,
      room_code VARCHAR(8) NOT NULL,
      name VARCHAR(50) NOT NULL,
      role VARCHAR(20) DEFAULT 'CIVILIAN',
      is_alive BOOLEAN DEFAULT TRUE,
      voted_for VARCHAR(32) DEFAULT NULL,
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_room_code (room_code)
    )
  `);

  // Penanda pemain yang keluar room saat game berjalan (beda dengan tereliminasi)
  try {
    await pool.query('ALTER TABLE mafia_players ADD COLUMN has_left BOOLEAN DEFAULT FALSE');
  } catch {}

  tablesInitialized = true;
}

export default pool;
