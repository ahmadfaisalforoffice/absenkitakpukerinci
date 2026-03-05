import express from "express";
import { createServer as createViteServer } from "vite";
import pkg from 'pg';
const { Pool } = pkg;
import path from "path";
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Initialize database
const initDb = async () => {
  const client = await pool.connect();
  try {
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
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        photo TEXT,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        is_late INTEGER DEFAULT 0,
        late_minutes INTEGER DEFAULT 0,
        scheduled_out_time TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );
    `);

    const userCount = await client.query("SELECT COUNT(*) as count FROM users");
    if (parseInt(userCount.rows[0].count) === 0) {
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

      for (const u of users) {
        await client.query("INSERT INTO users (username, password, role, display_name) VALUES ($1, $2, $3, $4)", u);
      }
    }
  } catch (err) {
    console.error("Database initialization error:", err);
  } finally {
    client.release();
  }
};

async function createServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Auth
  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const result = await pool.query("SELECT * FROM users WHERE username = $1 AND password = $2", [username, password]);
      const user = result.rows[0];
      if (user) {
        if (!user.is_active) return res.status(403).json({ error: "Akun sedang dinonaktifkan (Cuti)" });
        res.json(user);
      } else {
        res.status(401).json({ error: "Username atau password salah" });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Attendance
  app.get("/api/attendance/today", async (req, res) => {
    try {
      const userId = req.query.userId;
      const today = new Date().toISOString().split('T')[0];
      const result = await pool.query("SELECT * FROM attendance WHERE user_id = $1 AND date(timestamp) = $2", [userId, today]);
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.post("/api/attendance", async (req, res) => {
    try {
      const { userId, type, photo, latitude, longitude, isLate, lateMinutes, scheduledOutTime } = req.body;
      
      const result = await pool.query(`
        INSERT INTO attendance (user_id, type, photo, latitude, longitude, is_late, late_minutes, scheduled_out_time)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [userId, type, photo, latitude, longitude, isLate ? 1 : 0, lateMinutes, scheduledOutTime]);
      
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
        query += ` AND date(timestamp) >= $${params.length}`;
      }
      if (endDate) {
        params.push(endDate);
        query += ` AND date(timestamp) <= $${params.length}`;
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
      const today = new Date().toISOString().split('T')[0];
      const result = await pool.query(`
        SELECT a.*, u.display_name 
        FROM attendance a 
        JOIN users u ON a.user_id = u.id 
        WHERE date(a.timestamp) = $1 
        ORDER BY a.timestamp DESC
      `, [today]);
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
        SELECT u.display_name, date(a.timestamp) as date, to_char(a.timestamp, 'HH24:MI:SS') as time, a.type, a.is_late, a.late_minutes
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (startDate) {
        params.push(startDate);
        query += ` AND date(a.timestamp) >= $${params.length}`;
      }
      if (endDate) {
        params.push(endDate);
        query += ` AND date(a.timestamp) <= $${params.length}`;
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  return app;
}

// Start server if not in Vercel
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  createServer().then(app => {
    initDb().then(() => {
      app.listen(3000, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:3000`);
      });
    });
  });
}

export default createServer;
