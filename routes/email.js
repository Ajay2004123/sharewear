const { v4: uuidv4 } = require('uuid');
const db = require('./db');

// ─── EMAIL CONFIG ─────────────────────────────────────────────────────────────
// To enable real Gmail sending:
// 1. Enable 2FA on your Google account
// 2. Go to Google Account > Security > App Passwords
// 3. Generate an App Password for "Mail"
// 4. Set EMAIL_ENABLED=true and fill in your details below
const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true' || false;
const EMAIL_USER = process.env.EMAIL_USER || 'your_gmail@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || 'your_app_password';
// ─────────────────────────────────────────────────────────────────────────────

let transporter = null;

function getTransporter() {
  if (!transporter && EMAIL_ENABLED) {
    try {
      const nodemailer = require('nodemailer');
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: EMAIL_USER, pass: EMAIL_PASS }
      });
    } catch (e) {
      console.log('nodemailer not available, emails will be simulated');
    }
  }
  return transporter;
}

function sendEmail(to, subject, html) {
  const t = getTransporter();
  if (t && EMAIL_ENABLED) {
    t.sendMail({ from: `CampusRent <${EMAIL_USER}>`, to, subject, html }, (err) => {
      if (err) console.error('Email error:', err.message);
      else console.log(`📧 Email sent to ${to}: ${subject}`);
    });
  } else {
    // Simulate — log to console
    console.log(`\n📧 ─── SIMULATED EMAIL ────────────────────────`);
    console.log(`   To:      ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Body:    ${html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 200)}`);
    console.log(`────────────────────────────────────────────\n`);
  }
}

// ─── REMINDER SCHEDULER ──────────────────────────────────────────────────────
function scheduleReminder(request) {
  const returnDate = new Date(request.endDate + 'T23:59:00');
  const remindAt = new Date(returnDate.getTime() - 16 * 60 * 60 * 1000); // 16 hrs before

  const reminders = db.getReminders();
  reminders.push({
    id: uuidv4(),
    userId: request.renterId,
    email: request.renterEmail,
    sendAt: remindAt.toISOString(),
    sent: false,
    requestId: request.id,
    subject: `⏰ Return Reminder: "${request.itemName}" due in 16 hours!`,
    html: `
      <h2>Return Reminder ⏰</h2>
      <p>Hi <strong>${request.renterName}</strong>,</p>
      <p>This is your reminder to return <strong>"${request.itemName}"</strong> to <strong>${request.ownerName}</strong>.</p>
      <p>📅 <b>Return deadline: ${request.endDate}</b> (in ~16 hours)</p>
      <p>⚠️ Late fine: ₹${request.finePerDay}/day if returned after the deadline.</p>
      <p>Please return the item on time to avoid fines.</p>
      <br><p>— CampusRent Team 🎓</p>
    `,
    inAppMsg: `⏰ Reminder: Return "${request.itemName}" to ${request.ownerName} — due in 16 hours! (${request.endDate})`
  });
  db.saveReminders(reminders);
  console.log(`⏰ Reminder scheduled for ${request.renterEmail} at ${remindAt.toISOString()}`);
}

// Check reminders every minute
function startReminderChecker() {
  setInterval(() => {
    const reminders = db.getReminders();
    const now = new Date();
    let changed = false;

    reminders.forEach(r => {
      if (!r.sent && new Date(r.sendAt) <= now) {
        // Send email
        sendEmail(r.email, r.subject, r.html);
        // Add in-app notification
        db.addNotification(r.userId, r.inAppMsg, '⏰');
        r.sent = true;
        r.sentAt = now.toISOString();
        changed = true;
        console.log(`⏰ Reminder fired for user ${r.userId}`);
      }
    });

    if (changed) db.saveReminders(reminders);
  }, 60 * 1000); // every 60 seconds

  console.log('⏰ Reminder checker started (checks every 60 seconds)');
}

module.exports = { sendEmail, scheduleReminder, startReminderChecker };
