const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const QRCode = require('qrcode');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// sqlite database path (override with DB_PATH env var)
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.sqlite3');

// open sqlite database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to open database:', err);
    return;
  }
  console.log('SQLite DB opened at', DB_PATH);
});

// ensure uploads table exists
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS uploads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      originalname TEXT,
      mime TEXT,
      size INTEGER,
      url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Failed to create uploads table:', err);
  });
});

// configure uploads directory; allow override via env and fallback to OS temp dir for serverless
const DEFAULT_UPLOAD_DIR = path.join(os.tmpdir(), 'uploads');
let UPLOAD_DIR = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : DEFAULT_UPLOAD_DIR;
try {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
} catch (err) {
  console.warn(`Could not create uploads dir at ${UPLOAD_DIR}, falling back to OS temp dir:`, err);
  UPLOAD_DIR = os.tmpdir();
  try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch (e) { /* ignore */ }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '';
    cb(null, file.fieldname + '-' + unique + ext);
  }
});

const upload = multer({ storage });

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(req.file.filename)}`;
    const qrDataUrl = await QRCode.toDataURL(fileUrl);

    // insert metadata into sqlite
    const insertSql = `INSERT INTO uploads (filename, originalname, mime, size, url) VALUES (?,?,?,?,?)`;
    db.run(insertSql, [req.file.filename, req.file.originalname, req.file.mimetype, req.file.size, fileUrl], function (err) {
      if (err) {
        console.error('DB insert error:', err);
        // still return result but indicate DB error
        return res.status(500).json({ error: 'Failed to save metadata' });
      }

      res.json({ id: this.lastID, imageUrl: fileUrl, qrDataUrl });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// list recent uploaded images metadata
app.get('/images', (req, res) => {
  const sql = `SELECT id, filename, originalname, mime, size, url, created_at FROM uploads ORDER BY created_at DESC LIMIT 100`;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('DB query error:', err);
      return res.status(500).json({ error: 'Failed to query uploads' });
    }
    res.json(rows);
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});


