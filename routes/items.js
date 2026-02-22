const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

// Auth middleware
function auth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  const user = db.findUserById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'User not found' });
  req.user = user;
  next();
}

// Multer config — store to public/uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'public', 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// GET all items (browse - excludes own items)
router.get('/', auth, (req, res) => {
  let items = db.getItems();
  const { mine, category, q } = req.query;

  if (mine === '1') {
    items = items.filter(i => i.ownerId === req.user.id);
  } else {
    items = items.filter(i => i.ownerId !== req.user.id);
  }

  if (category && category !== 'all') {
    items = items.filter(i => i.category === category);
  }
  if (q) {
    const query = q.toLowerCase();
    items = items.filter(i =>
      i.name.toLowerCase().includes(query) ||
      (i.description || '').toLowerCase().includes(query) ||
      i.category.toLowerCase().includes(query)
    );
  }

  // Sort newest first
  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ items });
});

// POST list new item
router.post('/', auth, upload.single('photo'), (req, res) => {
  const { name, category, description, price, fine } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'Name and price are required' });

  const items = db.getItems();
  const item = {
    id: uuidv4(),
    name: name.trim(),
    category: category || 'Other',
    description: description || '',
    price: parseFloat(price),
    fine: parseFloat(fine) || 0,
    ownerId: req.user.id,
    ownerName: req.user.name,
    ownerEmail: req.user.email,
    photo: req.file ? '/uploads/' + req.file.filename : null,
    available: true,
    createdAt: new Date().toISOString()
  };
  items.push(item);
  db.saveItems(items);
  db.addNotification(req.user.id, `Your item "${item.name}" is now listed!`, '📦');
  res.json({ ok: true, item });
});

// DELETE item
router.delete('/:id', auth, (req, res) => {
  let items = db.getItems();
  const item = items.find(i => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  if (item.ownerId !== req.user.id) return res.status(403).json({ error: 'Not your item' });

  // Delete photo file
  if (item.photo) {
    const filePath = path.join(__dirname, '..', 'public', item.photo);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  items = items.filter(i => i.id !== req.params.id);
  db.saveItems(items);
  res.json({ ok: true });
});

module.exports = router;
