const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function read(name) {
  const file = path.join(DATA_DIR, name + '.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return {};
  }
}

function write(name, data) {
  const file = path.join(DATA_DIR, name + '.json');
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// Users
function getUsers() { return read('users').users || []; }
function saveUsers(users) { write('users', { users }); }
function findUserById(id) { return getUsers().find(u => u.id === id); }
function findUserByEmail(email) { return getUsers().find(u => u.email === email); }

// Items
function getItems() { return read('items').items || []; }
function saveItems(items) { write('items', { items }); }
function findItemById(id) { return getItems().find(i => i.id === id); }

// Requests
function getRequests() { return read('requests').requests || []; }
function saveRequests(requests) { write('requests', { requests }); }
function findRequestById(id) { return getRequests().find(r => r.id === id); }

// Messages
function getConversations() { return read('messages').conversations || {}; }
function saveConversations(conversations) { write('messages', { conversations }); }
function getConversation(key) { return getConversations()[key] || null; }
function saveConversation(key, convo) {
  const convs = getConversations();
  convs[key] = convo;
  saveConversations(convs);
}

// Notifications
function getNotifications() { return read('notifications').notifications || []; }
function saveNotifications(notifs) { write('notifications', { notifications: notifs }); }
function addNotification(userId, msg, icon = '🔔') {
  const notifs = getNotifications();
  notifs.unshift({ id: Date.now().toString(), userId, msg, icon, time: new Date().toISOString(), read: false });
  saveNotifications(notifs);
}
function getUserNotifications(userId) { return getNotifications().filter(n => n.userId === userId); }

// Reminders
function getReminders() { return read('reminders').reminders || []; }
function saveReminders(r) { write('reminders', { reminders: r }); }

module.exports = {
  getUsers, saveUsers, findUserById, findUserByEmail,
  getItems, saveItems, findItemById,
  getRequests, saveRequests, findRequestById,
  getConversations, saveConversations, getConversation, saveConversation,
  getNotifications, saveNotifications, addNotification, getUserNotifications,
  getReminders, saveReminders
};
