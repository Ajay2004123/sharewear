const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'campusrent_2024_salt').digest('hex');
}

// Register
router.post('/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'All fields are required' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const users = db.getUsers();
  if (users.find(u => u.email === email))
    return res.status(400).json({ error: 'Email already registered' });

  const user = {
    id: uuidv4(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password: hashPassword(password),
    createdAt: new Date().toISOString()
  };
  users.push(user);
  db.saveUsers(users);

  req.session.userId = user.id;
  res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email } });
});

// Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });

  const users = db.getUsers();
  const user = users.find(u => u.email === email.toLowerCase() && u.password === hashPassword(password));
  if (!user)
    return res.status(401).json({ error: 'Invalid email or password' });

  req.session.userId = user.id;
  res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email } });
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

// Get current user
router.get('/me', (req, res) => {
  if (!req.session.userId)
    return res.status(401).json({ error: 'Not authenticated' });
  const user = db.findUserById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'User not found' });
  res.json({ user: { id: user.id, name: user.name, email: user.email } });
});

module.exports = router;
