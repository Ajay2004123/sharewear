const express = require('express');
const router = express.Router();
const db = require('./db');

function auth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  const user = db.findUserById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'User not found' });
  req.user = user;
  next();
}

// GET notifications for current user
router.get('/', auth, (req, res) => {
  const notifs = db.getUserNotifications(req.user.id);
  res.json({ notifications: notifs });
});

// PUT mark all as read
router.put('/read', auth, (req, res) => {
  const all = db.getNotifications();
  all.forEach(n => { if (n.userId === req.user.id) n.read = true; });
  db.saveNotifications(all);
  res.json({ ok: true });
});

module.exports = router;
