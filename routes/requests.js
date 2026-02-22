const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const { sendEmail, scheduleReminder } = require('./email');

function auth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  const user = db.findUserById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'User not found' });
  req.user = user;
  next();
}

function daysBetween(start, end) {
  const s = new Date(start), e = new Date(end);
  return Math.max(1, Math.ceil((e - s) / (1000 * 60 * 60 * 24)));
}

// GET all requests for current user (incoming + outgoing)
router.get('/', auth, (req, res) => {
  const all = db.getRequests();
  const incoming = all.filter(r => r.ownerId === req.user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const outgoing = all.filter(r => r.renterId === req.user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ incoming, outgoing });
});

// POST send a rent request
router.post('/', auth, (req, res) => {
  const { itemId, startDate, endDate, message } = req.body;
  if (!itemId || !startDate || !endDate)
    return res.status(400).json({ error: 'itemId, startDate, endDate required' });

  const item = db.findItemById(itemId);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  if (item.ownerId === req.user.id)
    return res.status(400).json({ error: 'You cannot rent your own item' });

  const s = new Date(startDate), e = new Date(endDate);
  if (e <= s) return res.status(400).json({ error: 'End date must be after start date' });

  const days = daysBetween(startDate, endDate);
  const requests = db.getRequests();

  // Check for conflicting approved requests
  const conflict = requests.find(r =>
    r.itemId === itemId &&
    r.status === 'approved' &&
    !(new Date(endDate) <= new Date(r.startDate) || new Date(startDate) >= new Date(r.endDate))
  );
  if (conflict) return res.status(400).json({ error: 'Item is already rented for those dates' });

  const request = {
    id: uuidv4(),
    itemId,
    itemName: item.name,
    ownerId: item.ownerId,
    ownerName: item.ownerName,
    ownerEmail: item.ownerEmail,
    renterId: req.user.id,
    renterName: req.user.name,
    renterEmail: req.user.email,
    startDate,
    endDate,
    days,
    pricePerDay: item.price,
    totalCost: days * item.price,
    finePerDay: item.fine,
    message: message || '',
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  requests.push(request);
  db.saveRequests(requests);

  // Notify owner
  db.addNotification(item.ownerId, `${req.user.name} wants to rent "${item.name}" from ${startDate} to ${endDate}`, '📩');
  sendEmail(item.ownerEmail, `New Rental Request for "${item.name}"`, `
    <h2>New Rental Request 📩</h2>
    <p><strong>${req.user.name}</strong> (${req.user.email}) wants to rent your item <strong>"${item.name}"</strong>.</p>
    <p><b>Dates:</b> ${startDate} → ${endDate} (${days} day${days>1?'s':''})</p>
    <p><b>Total:</b> ₹${request.totalCost}</p>
    ${message ? `<p><b>Message:</b> "${message}"</p>` : ''}
    <p>Login to CampusRent to accept or reject this request.</p>
  `);

  res.json({ ok: true, request });
});

// PUT accept/reject request
router.put('/:id/respond', auth, (req, res) => {
  const { action } = req.body; // 'approved' or 'rejected'
  if (!['approved', 'rejected'].includes(action))
    return res.status(400).json({ error: 'Action must be approved or rejected' });

  const requests = db.getRequests();
  const request = requests.find(r => r.id === req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.ownerId !== req.user.id) return res.status(403).json({ error: 'Not your item' });
  if (request.status !== 'pending') return res.status(400).json({ error: 'Request already processed' });

  request.status = action;
  request.respondedAt = new Date().toISOString();
  db.saveRequests(requests);

  if (action === 'approved') {
    // Open chat between the two users
    const chatKey = [request.ownerId, request.renterId].sort().join('__');
    let convo = db.getConversation(chatKey);
    if (!convo) {
      convo = {
        participants: [
          { id: request.ownerId, name: request.ownerName },
          { id: request.renterId, name: request.renterName }
        ],
        requestId: request.id,
        itemName: request.itemName,
        messages: []
      };
    }
    // System message
    convo.messages.push({
      id: uuidv4(),
      type: 'system',
      text: `✅ Rental approved! ${request.renterName} will rent "${request.itemName}" from ${request.startDate} to ${request.endDate}. Total: ₹${request.totalCost}`,
      time: new Date().toISOString()
    });
    db.saveConversation(chatKey, convo);

    // Schedule 16-hour return reminder email for renter
    scheduleReminder(request);

    // Notifications
    db.addNotification(request.renterId, `✅ Your request for "${request.itemName}" was approved! Return by ${request.endDate}.`, '✅');
    sendEmail(request.renterEmail, `Rental Approved: "${request.itemName}"`, `
      <h2>Your Rental is Approved! ✅</h2>
      <p>Great news! <strong>${request.ownerName}</strong> approved your request to rent <strong>"${request.itemName}"</strong>.</p>
      <p><b>Rental period:</b> ${request.startDate} → ${request.endDate}</p>
      <p><b>Total cost:</b> ₹${request.totalCost}</p>
      <p><b>Late fine:</b> ₹${request.finePerDay}/day if returned late</p>
      <p>You can now chat with the owner in CampusRent. Please return on time!</p>
    `);
  } else {
    db.addNotification(request.renterId, `❌ Your request for "${request.itemName}" was rejected.`, '❌');
    sendEmail(request.renterEmail, `Rental Request Rejected: "${request.itemName}"`, `
      <h2>Rental Request Rejected</h2>
      <p>Unfortunately, <strong>${request.ownerName}</strong> rejected your request to rent <strong>"${request.itemName}"</strong>.</p>
      <p>Browse other items on CampusRent!</p>
    `);
  }

  res.json({ ok: true, request });
});

// PUT mark item as returned
router.put('/:id/return', auth, (req, res) => {
  const requests = db.getRequests();
  const request = requests.find(r => r.id === req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.renterId !== req.user.id) return res.status(403).json({ error: 'Not your rental' });
  if (request.status !== 'approved') return res.status(400).json({ error: 'Cannot return this request' });

  const returnDate = new Date();
  const dueDate = new Date(request.endDate + 'T23:59:59');
  let lateDays = 0;
  let fine = 0;

  if (returnDate > dueDate) {
    lateDays = Math.ceil((returnDate - dueDate) / (1000 * 60 * 60 * 24));
    fine = lateDays * request.finePerDay;
  }

  request.status = 'returned';
  request.returnedAt = returnDate.toISOString();
  request.lateDays = lateDays;
  request.fineCharged = fine;
  db.saveRequests(requests);

  const msg = lateDays > 0
    ? `⚠️ "${request.itemName}" returned ${lateDays} day(s) late. Fine: ₹${fine}`
    : `✅ "${request.itemName}" returned on time!`;

  db.addNotification(req.user.id, msg, lateDays > 0 ? '⚠️' : '✅');
  db.addNotification(request.ownerId, `${request.renterName} returned "${request.itemName}"${lateDays > 0 ? ` (${lateDays} day(s) late, fine: ₹${fine})` : ' on time'}`, lateDays > 0 ? '⚠️' : '✅');

  if (lateDays > 0) {
    sendEmail(request.renterEmail, `Late Return Fine: ₹${fine} for "${request.itemName}"`, `
      <h2>Late Return Fine ⚠️</h2>
      <p>You returned <strong>"${request.itemName}"</strong> <strong>${lateDays} day(s) late</strong>.</p>
      <p><b>Fine charged: ₹${fine}</b> (₹${request.finePerDay}/day × ${lateDays} days)</p>
      <p>Please pay the fine to the owner: ${request.ownerName}.</p>
    `);
  }

  res.json({ ok: true, lateDays, fine, request });
});

module.exports = router;
