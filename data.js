// ===== DATA LAYER =====
const KEYS = { sessions: 'pk_sessions', bankroll: 'pk_bankroll', transactions: 'pk_transactions', weeklyNotes: 'pk_weekly', settings: 'pk_settings' };

const Store = {
    get(key, fallback = []) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } },
    set(key, val) { localStorage.setItem(key, JSON.stringify(val)); },
    remove(key) { localStorage.removeItem(key); }
};

// Sessions
function getSessions() { return Store.get(KEYS.sessions, []); }
function saveSession(s) {
    const sessions = getSessions();
    s.id = s.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    s.createdAt = s.createdAt || new Date().toISOString();
    sessions.unshift(s);
    Store.set(KEYS.sessions, sessions);
    // Auto-update bankroll from session result
    const br = getBankroll();
    Store.set(KEYS.bankroll, br + (s.result || 0));
    return s;
}
function deleteSession(id) {
    let sessions = getSessions();
    const s = sessions.find(x => x.id === id);
    if (s) {
        const br = getBankroll();
        Store.set(KEYS.bankroll, br - (s.result || 0));
    }
    sessions = sessions.filter(x => x.id !== id);
    Store.set(KEYS.sessions, sessions);
}
function getSessionById(id) { return getSessions().find(x => x.id === id); }

// Bankroll
function getBankroll() { return Store.get(KEYS.bankroll, 0); }
function setBankroll(v) { Store.set(KEYS.bankroll, v); }

// Transactions
function getTransactions() { return Store.get(KEYS.transactions, []); }
function addTransaction(t) {
    const txs = getTransactions();
    t.id = Date.now().toString(36);
    t.date = new Date().toISOString();
    txs.unshift(t);
    Store.set(KEYS.transactions, txs);
    const br = getBankroll();
    Store.set(KEYS.bankroll, t.type === 'deposit' ? br + t.amount : br - t.amount);
}

// Weekly Notes
function getWeeklyNotes() { return Store.get(KEYS.weeklyNotes, {}); }
function saveWeeklyNote(weekKey, data) {
    const notes = getWeeklyNotes();
    notes[weekKey] = data;
    Store.set(KEYS.weeklyNotes, notes);
}

// Settings
function getSettings() { return Store.get(KEYS.settings, { stopLoss: 3 }); }
function saveSettings(s) { Store.set(KEYS.settings, s); }

// Utils
function formatMoney(v) { return (v >= 0 ? '+$' : '-$') + Math.abs(v).toFixed(2); }
function formatMoneyPlain(v) { return '$' + v.toFixed(2); }

function getWeekKey(date) {
    const d = new Date(date);
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const days = Math.floor((d - jan1) / 86400000);
    const week = Math.ceil((days + jan1.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function getWeekRange(weekKey) {
    const [year, wStr] = weekKey.split('-W');
    const w = parseInt(wStr);
    const jan1 = new Date(parseInt(year), 0, 1);
    const dayOffset = (jan1.getDay() + 6) % 7;
    const start = new Date(jan1);
    start.setDate(jan1.getDate() - dayOffset + (w - 1) * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
}

function getSessionsForWeek(weekKey) {
    const { start, end } = getWeekRange(weekKey);
    return getSessions().filter(s => {
        const d = new Date(s.date + 'T12:00:00');
        return d >= start && d <= end;
    });
}

function getBuyInAmount(limit) {
    const map = { NL2: 2, NL5: 5, NL10: 10, NL25: 25, NL50: 50, NL100: 100 };
    return map[limit] || 2;
}

function toast(msg, type = 'success') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

function exportAllData() {
    const data = { sessions: getSessions(), bankroll: getBankroll(), transactions: getTransactions(), weeklyNotes: getWeeklyNotes(), settings: getSettings(), exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `poker-diary-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
}

function importData(json) {
    try {
        const data = JSON.parse(json);
        if (data.sessions) Store.set(KEYS.sessions, data.sessions);
        if (data.bankroll !== undefined) Store.set(KEYS.bankroll, data.bankroll);
        if (data.transactions) Store.set(KEYS.transactions, data.transactions);
        if (data.weeklyNotes) Store.set(KEYS.weeklyNotes, data.weeklyNotes);
        if (data.settings) Store.set(KEYS.settings, data.settings);
        return true;
    } catch { return false; }
}

function clearAllData() {
    Object.values(KEYS).forEach(k => Store.remove(k));
}
