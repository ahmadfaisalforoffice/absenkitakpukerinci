import express from "express";
import pkg from 'pg';
const { Pool, types } = pkg;

// Force TIMESTAMP (1114) to be returned as string to avoid timezone shifting
types.setTypeParser(1114, (val) => val);
import path from "path";
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

// Set session timezone for all connections in the pool
pool.on('connect', (client) => {
  client.query("SET TIMEZONE='Asia/Jakarta'");
});

// Helper to check pool
const checkPool = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined in environment variables");
  }
};

// Initialize database
let isDbInitialized = false;
const initDb = async () => {
  if (isDbInitialized) return;
  
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined in environment variables. Please set it in Vercel.");
  }

  const client = await pool.connect();
  try {
    console.log("Checking database tables...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        display_name TEXT NOT NULL,
        is_active INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        photo TEXT,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        is_late INTEGER DEFAULT 0,
        late_minutes INTEGER DEFAULT 0,
        scheduled_out_time TIMESTAMPTZ,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      -- Ensure column type is correct if table already exists
      DO $$ 
      BEGIN 
        ALTER TABLE attendance ALTER COLUMN timestamp TYPE TIMESTAMPTZ;
        ALTER TABLE attendance ALTER COLUMN scheduled_out_time TYPE TIMESTAMPTZ;
      EXCEPTION 
        WHEN undefined_column THEN 
          NULL;
      END $$;

      -- One-time fix for records today that were stored in UTC (7 hours behind)
      UPDATE attendance 
      SET timestamp = timestamp + interval '7 hours',
          scheduled_out_time = scheduled_out_time + interval '7 hours'
      WHERE timestamp < (CURRENT_TIMESTAMP - interval '10 minutes')
      AND EXTRACT(HOUR FROM (timestamp AT TIME ZONE 'Asia/Jakarta')) < 12
      AND timestamp::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date;

      CREATE INDEX IF NOT EXISTS idx_attendance_timestamp ON attendance (timestamp);
      CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance (user_id);
    `);
    console.log("Tables created or already exist.");

    const userCountResult = await client.query("SELECT COUNT(*) as count FROM users");
    const count = parseInt(userCountResult.rows[0].count);
    if (count === 0) {
      console.log("Initializing users table with default data...");
      const users = [
        ['adminkpukerinci','adminadminan','admin','Admin'],
        ['antonpudyk@kpukerinci','sekretaris','sekretaris','Anton Pudy K'],
        ['dedisusanto@kpukerinci','kasubbagrendatin','kepala sub bagian rendatin','Dedi Susanto'],
        ['afriyanto@kpukerinci','kasubbagtekhum','kepala sub bagian tekhum','Afriyanto'],
        ['alhafizhamzah@kpukerinci','kasubbagsdmparmas','kepala sub bagian sdm dan parmas','Alhafiz Hamzah'],
        ['lusivideskairawan@kpukerinci','kasubbagkul','kepala sub bagian kul','Lusi Videska Irawan'],
        ['alannuari@kpukerinci','alanrendatin','staff','Alan Nuari'],
        ['ekasaputri@kpukerinci','ekarendatin','staff','Eka Saputri'],
        ['herrykurniawan@kpukerinci','herryrendatin','staff','Herry Kurniawan'],
        ['pandipradana@kpukerinci','pandirendatin','staff','Pandi Pradana'],
        ['ahmadfaisal@kpukerinci','mamatrendatin','staff','Ahmad Faisal'],
        ['arifmaulanahidayat@kpukerinci','arifrendatin','staff','Arif Maulana'],
        ['mahmud@kpukerinci','mahmudtekhum','staff','Mahmud'],
        ['anwarfirmansyah@kpukerinci','firmantekhum','staff','Anwar Firmansyah'],
        ['tomijaya@kpukerinci','tomitekhum','staff','Tomi Jaya'],
        ['gufranamir@kpukerinci','gufrantekhum','staff','Gufran Amir'],
        ['anitarahayu@kpukerinci','anitatekhum','staff','Anita Rahayu'],
        ['wahyutioramadhan@kpukerinci','tiosdmparmas','staff','Wahyu Tio Ramadhan'],
        ['rendraalmurtadho@kpukerinci','rendrasdmparmas','staff','Rendra Al Murtadho'],
        ['jothascorda@kpukerinci','jothasdmparmas','staff','Jotha Scorda'],
        ['sartono@kpukerinci','sartonokul','staff','Sartono'],
        ['dherius@kpukerinci','dheriuskul','staff','Dherius'],
        ['paskobrutus@kpukerinci','paskokul','staff','Pasko Brutus Damanik'],
        ['finalafriola@kpukerinci','finalkul','staff','Final Afriola'],
        ['veradelmayanti@kpukerinci','verakul','staff','Vera Delmayanti'],
        ['anitakristina@kpukerinci','anitakul','staff','Anita Kristina'],
        ['cindyjuwitatamara@kpukerinci','cindykul','staff','Cindy Juwita Tamara LT'],
        ['domihardi@kpukerinci','domikul','staff','Domi Hardi'],
        ['jeminopanra@kpukerinci','jemikul','staff','Jemi Nopanra']
      ];

      const values = users.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(',');
      const flatUsers = users.flat();
      await client.query(`INSERT INTO users (username, password, role, display_name) VALUES ${values}`, flatUsers);
      console.log("Users table initialized successfully.");
    }
    isDbInitialized = true;
  } catch (err) {
    console.error("Database initialization error:", err);
    throw err;
  } finally {
    client.release();
  }
};

const app = express();
app.use(express.json({ limit: '10mb' }));

// Middleware to ensure DB is initialized
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    try {
      await initDb();
    } catch (err: any) {
      console.error("Middleware DB Init Error:", err);
      return res.status(500).json({ error: err.message.includes('ECONNREFUSED') ? "Gagal terhubung ke database. Pastikan DATABASE_URL sudah benar." : err.message });
    }
  }
  next();
});

// Health check
app.get("/api/health", async (req, res) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ status: "error", message: "DATABASE_URL is missing" });
    }
    const result = await pool.query("SELECT NOW()");
    res.json({ status: "ok", time: result.rows[0].now, env: process.env.NODE_ENV });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Auth
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const result = await pool.query("SELECT * FROM users WHERE username = $1 AND password = $2", [username, password]);
    const user = result.rows[0];
    
    if (user) {
      if (user.is_active === 0) return res.status(403).json({ error: "Akun sedang dinonaktifkan (Cuti)" });
      res.json(user);
    } else {
      res.status(401).json({ error: "Username atau password salah" });
    }
  } catch (err: any) {
    console.error("Login error:", err);
    res.status(500).json({ error: err.message.includes('ECONNREFUSED') ? "Gagal terhubung ke database. Pastikan DATABASE_URL sudah benar." : "Database error: " + err.message });
  }
});

// Attendance
app.get("/api/attendance/today", async (req, res) => {
  try {
    const userId = req.query.userId;
    const result = await pool.query(
      "SELECT * FROM attendance WHERE user_id = $1 AND timestamp >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date AND timestamp < ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date + interval '1 day')", 
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/attendance", async (req, res) => {
  try {
    const { userId, type, photo, latitude, longitude, isLate, lateMinutes, scheduledOutTime, timestamp } = req.body;
    
    const result = await pool.query(`
      INSERT INTO attendance (user_id, type, photo, latitude, longitude, is_late, late_minutes, scheduled_out_time, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, CURRENT_TIMESTAMP))
      RETURNING id
    `, [userId, type, photo, latitude, longitude, isLate ? 1 : 0, lateMinutes, scheduledOutTime, timestamp]);
    
    res.json({ id: result.rows[0].id, status: "success" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/attendance/history", async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.query;
    let query = "SELECT * FROM attendance WHERE user_id = $1";
    const params: any[] = [userId];

    if (startDate) {
      params.push(startDate);
      query += ` AND date(timestamp AT TIME ZONE 'Asia/Jakarta') >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      query += ` AND date(timestamp AT TIME ZONE 'Asia/Jakarta') <= $${params.length}`;
    }

    query += " ORDER BY timestamp DESC LIMIT 100";
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/change-password", async (req, res) => {
  try {
    const { userId, oldPassword, newPassword } = req.body;
    const result = await pool.query("SELECT * FROM users WHERE id = $1 AND password = $2", [userId, oldPassword]);
    if (result.rows.length === 0) return res.status(401).json({ error: "Password lama salah" });

    await pool.query("UPDATE users SET password = $1 WHERE id = $2", [newPassword, userId]);
    res.json({ status: "success" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Admin Routes
app.get("/api/admin/today-activity", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.id, a.user_id, a.type, a.timestamp, a.latitude, a.longitude, a.is_late, a.late_minutes, a.scheduled_out_time, u.display_name 
      FROM attendance a 
      JOIN users u ON a.user_id = u.id 
      WHERE a.timestamp >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date 
        AND a.timestamp < ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date + interval '1 day')
      ORDER BY a.timestamp DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/admin/users", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, username, role, display_name, is_active FROM users WHERE role != 'admin'");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.patch("/api/admin/users/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    await pool.query("UPDATE users SET is_active = $1 WHERE id = $2", [is_active ? 1 : 0, id]);
    res.json({ status: "success" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/admin/users/:id/reset-password", async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    await pool.query("UPDATE users SET password = $1 WHERE id = $2", [newPassword, id]);
    res.json({ status: "success" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/admin/export", async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.query;
    let query = `
      SELECT u.display_name, a.timestamp, a.type, a.is_late, a.late_minutes
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (startDate) {
      params.push(startDate);
      query += ` AND date(a.timestamp AT TIME ZONE 'Asia/Jakarta') >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      query += ` AND date(a.timestamp AT TIME ZONE 'Asia/Jakarta') <= $${params.length}`;
    }
    if (userId) {
      params.push(userId);
      query += ` AND a.user_id = $${params.length}`;
    }

    query += " ORDER BY u.display_name, a.timestamp";
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    // Only serve static files via Express if NOT on Vercel
    // Vercel handles static files automatically via vercel.json
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }
}

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  setupServer().then(() => {
    initDb().then(() => {
      app.listen(3000, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:3000`);
      });
    }).catch(err => console.error("Failed to init DB:", err));
  });
} else {
  // In Vercel, we rely on the middleware for DB initialization
  setupServer();
}

export default app;
