const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();


// Ensure uploads dir exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const voiceDir = path.join(uploadsDir, 'voice');
if (!fs.existsSync(voiceDir)) fs.mkdirSync(voiceDir, { recursive: true });

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'campusrent_secret_2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 days
}));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/items', require('./routes/items'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/notifications', require('./routes/notifications'));

// ─── Page routes ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
  if (!req.session.userId) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ─── Start reminder checker ───────────────────────────────────────────────────
const { startReminderChecker } = require('./routes/email');
startReminderChecker();

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║         CampusRent Server Running        ║
  ║                                          ║
  ║   🌐 Running on port: ${PORT}            ║
  ║   📁 Storage: JSON files in /data/       ║
  ║   ⏰ Reminder checker: ACTIVE            ║
  ╚══════════════════════════════════════════╝
  `);
});
