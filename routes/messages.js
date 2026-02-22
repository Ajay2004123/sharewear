const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

function auth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  const user = db.findUserById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'User not found' });
  req.user = user;
  next();
}

// Multer for voice messages
const voiceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'public', 'uploads', 'voice');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, uuidv4() + '.webm')
});
const voiceUpload = multer({ storage: voiceStorage, limits: { fileSize: 20 * 1024 * 1024 } });

// GET all conversations for current user
router.get('/', auth, (req, res) => {
  const all = db.getConversations();
  const mine = Object.entries(all)
    .filter(([, convo]) => convo.participants.some(p => p.id === req.user.id))
    .map(([key, convo]) => {
      const other = convo.participants.find(p => p.id !== req.user.id);
      const lastMsg = convo.messages[convo.messages.length - 1];
      return {
        key,
        other,
        itemName: convo.itemName,
        lastMessage: lastMsg ? (lastMsg.type === 'voice' ? '🎤 Voice message' : lastMsg.text) : 'No messages yet',
        lastTime: lastMsg ? lastMsg.time : convo.createdAt,
        unread: convo.messages.filter(m => m.senderId !== req.user.id && !m.read).length
      };
    })
    .sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));
  res.json({ conversations: mine });
});

// GET messages in a conversation
router.get('/:key', auth, (req, res) => {
  const convo = db.getConversation(req.params.key);
  if (!convo) return res.status(404).json({ error: 'Conversation not found' });
  if (!convo.participants.some(p => p.id === req.user.id))
    return res.status(403).json({ error: 'Not your conversation' });

  // Mark messages as read
  convo.messages.forEach(m => { if (m.senderId !== req.user.id) m.read = true; });
  db.saveConversation(req.params.key, convo);

  res.json({ convo, currentUserId: req.user.id });
});

// POST send text message
router.post('/:key/send', auth, (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Message text required' });

  let convo = db.getConversation(req.params.key);
  if (!convo) return res.status(404).json({ error: 'Conversation not found' });
  if (!convo.participants.some(p => p.id === req.user.id))
    return res.status(403).json({ error: 'Not your conversation' });

  const message = {
    id: uuidv4(),
    type: 'text',
    senderId: req.user.id,
    senderName: req.user.name,
    text: text.trim(),
    time: new Date().toISOString(),
    read: false
  };

  convo.messages.push(message);
  db.saveConversation(req.params.key, convo);

  // Notify the other participant
  const other = convo.participants.find(p => p.id !== req.user.id);
  if (other) {
    db.addNotification(other.id, `💬 New message from ${req.user.name}: "${text.trim().substring(0, 50)}"`, '💬');
  }

  res.json({ ok: true, message });
});

// POST send voice message
router.post('/:key/voice', auth, voiceUpload.single('audio'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file' });

  let convo = db.getConversation(req.params.key);
  if (!convo) return res.status(404).json({ error: 'Conversation not found' });
  if (!convo.participants.some(p => p.id === req.user.id))
    return res.status(403).json({ error: 'Not your conversation' });

  const message = {
    id: uuidv4(),
    type: 'voice',
    senderId: req.user.id,
    senderName: req.user.name,
    audioUrl: '/uploads/voice/' + req.file.filename,
    duration: req.body.duration || '0:05',
    time: new Date().toISOString(),
    read: false
  };

  convo.messages.push(message);
  db.saveConversation(req.params.key, convo);

  const other = convo.participants.find(p => p.id !== req.user.id);
  if (other) {
    db.addNotification(other.id, `🎤 Voice message from ${req.user.name}`, '🎤');
  }

  res.json({ ok: true, message });
});

module.exports = router;
