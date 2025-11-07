const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

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

    res.json({ imageUrl: fileUrl, qrDataUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});


