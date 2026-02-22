# CampusRent 🎓
**Campus Rental Platform — Node.js + JSON File Storage (No MongoDB)**

---

## 🚀 Quick Start

### 1. Install Node.js
Download from https://nodejs.org (v16 or higher)

### 2. Install Dependencies
```bash
cd campusrent
npm install
```

### 3. Start the Server
```bash
npm start
```

### 4. Open in Browser
```
http://localhost:3000
```

---

## 📁 Project Structure
```
campusrent/
├── server.js              ← Main server entry point
├── package.json           ← Dependencies
├── data/                  ← All data stored as JSON files
│   ├── users.json         ← User accounts
│   ├── items.json         ← Listed items
│   ├── requests.json      ← Rental requests
│   ├── messages.json      ← Chat conversations
│   ├── notifications.json ← In-app notifications
│   └── reminders.json     ← Scheduled email reminders
├── routes/
│   ├── auth.js            ← Login / Register / Logout
│   ├── items.js           ← List / Browse / Delete items
│   ├── requests.js        ← Send / Accept / Reject / Return
│   ├── messages.js        ← Text + Voice messaging
│   ├── notifications.js   ← User notifications
│   ├── email.js           ← Email service + reminder scheduler
│   └── db.js              ← JSON file database helpers
└── public/
    ├── index.html         ← Login / Register page
    ├── dashboard.html     ← Main dashboard
    ├── js/app.js          ← Frontend JavaScript
    └── uploads/           ← Uploaded images & voice messages
```

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔐 Auth | Register/Login with hashed passwords, session-based auth |
| 📦 List Items | Upload photo, set price/day, fine/day |
| 🔍 Browse & Search | Filter by category, search by name |
| 📋 Rental Requests | Send request with date range, auto cost calculation |
| ✅ Accept/Reject | Owner approves or rejects requests |
| 💬 Real-time Chat | Text messaging between owner and renter after approval |
| 🎤 Voice Messages | Record and send WhatsApp-style voice messages |
| ⚠️ Late Fine | Auto-calculated when item is returned after due date |
| ⏰ Email Reminder | Email sent 16 hours before return deadline |
| 🔔 Notifications | In-app notifications for all events |
| 🕐 Live Clock | Real-time clock on dashboard |

---

## 📧 Enable Real Gmail Reminders

By default emails are **simulated** (printed to console). To enable real Gmail:

### Step 1: Enable Gmail 2-Factor Authentication
Go to https://myaccount.google.com/security

### Step 2: Generate App Password
Go to Google Account → Security → **App Passwords**
Select "Mail" and generate a password

### Step 3: Set Environment Variables
**On Mac/Linux:**
```bash
EMAIL_ENABLED=true EMAIL_USER=your@gmail.com EMAIL_PASS=yourapppassword npm start
```

**On Windows:**
```cmd
set EMAIL_ENABLED=true
set EMAIL_USER=your@gmail.com
set EMAIL_PASS=yourapppassword
npm start
```

**Or create a `.env` file** (install `dotenv` first: `npm install dotenv`):
```
EMAIL_ENABLED=true
EMAIL_USER=your@gmail.com
EMAIL_PASS=your_16_char_app_password
```

---

## 🔧 Tech Stack

- **Backend**: Node.js + Express.js
- **Storage**: JSON files (no database needed!)
- **Auth**: express-session + SHA-256 password hashing
- **File Upload**: Multer (images + voice messages)
- **Email**: Nodemailer (Gmail)
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Fonts**: Google Fonts (Syne + DM Sans)
- **Voice**: Browser MediaRecorder API

---

## 🗂️ API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login |
| POST | /api/auth/logout | Logout |
| GET | /api/auth/me | Get current user |
| GET | /api/items | Browse items (others) |
| GET | /api/items?mine=1 | My listed items |
| POST | /api/items | List new item (multipart) |
| DELETE | /api/items/:id | Delete item |
| GET | /api/requests | Get all requests |
| POST | /api/requests | Send rent request |
| PUT | /api/requests/:id/respond | Accept/reject request |
| PUT | /api/requests/:id/return | Mark item as returned |
| GET | /api/messages | Get conversations list |
| GET | /api/messages/:key | Get messages in conversation |
| POST | /api/messages/:key/send | Send text message |
| POST | /api/messages/:key/voice | Send voice message |
| GET | /api/notifications | Get notifications |
| PUT | /api/notifications/read | Mark all as read |

---

## 💡 How It Works

1. **Register/Login** → Session stored server-side
2. **List Item** → Saved to `data/items.json`, photo saved to `public/uploads/`
3. **Send Request** → Saved to `data/requests.json`, email sent to owner
4. **Owner Accepts** → Status updated, chat conversation created, reminder scheduled
5. **Chat** → Messages saved to `data/messages.json`, voice files in `public/uploads/voice/`
6. **16hr Reminder** → Checked every minute, email sent when time arrives
7. **Return** → Late days calculated, fine computed, notifications sent
