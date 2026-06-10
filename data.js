// ===== DATA LAYER =====
const KEYS = {
    sessions: 'pk_sessions',
    transactions: 'pk_transactions',
    weeklyNotes: 'pk_weekly',
    settings: 'pk_settings'
};

const Store = {
    get(key, fallback = []) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } },
    set(key, val) { localStorage.setItem(key, JSON.stringify(val)); },
    remove(key) { localStorage.removeItem(key); }
};

// ===== SESSIONS =====
function getSessions() { return Store.get(KEYS.sessions, []); }

function saveSession(s) {
    const sessions = getSessions();
    if (s.id) {
        // Update existing session
        const idx = sessions.findIndex(x => x.id === s.id);
        if (idx !== -1) {
            s.updatedAt = new Date().toISOString();
            sessions[idx] = s;
        } else {
            s.createdAt = s.createdAt || new Date().toISOString();
            sessions.unshift(s);
        }
    } else {
        s.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        s.createdAt = new Date().toISOString();
        sessions.unshift(s);
    }
    Store.set(KEYS.sessions, sessions);
    return s;
}

function deleteSession(id) {
    const sessions = getSessions().filter(x => x.id !== id);
    Store.set(KEYS.sessions, sessions);
}

function getSessionById(id) { return getSessions().find(x => x.id === id); }

// ===== BANKROLL — COMPUTED =====
// Bankroll is derived from transactions + session results.
// This eliminates desync bugs (old approach stored separately).
function getBankroll() {
    const txBalance = getTransactions().reduce((sum, t) =>
        sum + (t.type === 'deposit' ? t.amount : -t.amount), 0);
    const sessionBalance = getSessions().reduce((sum, s) =>
        sum + (s.result || 0), 0);
    return txBalance + sessionBalance;
}

// ===== TRANSACTIONS =====
function getTransactions() { return Store.get(KEYS.transactions, []); }

function addTransaction(t) {
    // Validate withdrawals
    if (t.type === 'withdraw' && t.amount > getBankroll()) {
        toast('Saldo insuficiente para saque', 'error');
        return false;
    }
    const txs = getTransactions();
    t.id = Date.now().toString(36);
    t.date = new Date().toISOString();
    txs.unshift(t);
    Store.set(KEYS.transactions, txs);
    return true;
}

// ===== WEEKLY NOTES =====
function getWeeklyNotes() { return Store.get(KEYS.weeklyNotes, {}); }
function saveWeeklyNote(weekKey, data) {
    const notes = getWeeklyNotes();
    notes[weekKey] = data;
    Store.set(KEYS.weeklyNotes, notes);
}

// ===== SETTINGS =====
function getSettings() { return Store.get(KEYS.settings, { stopLoss: 3 }); }
function saveSettings(s) { Store.set(KEYS.settings, s); }

// ===== FORMATTING =====
function formatMoney(v) {
    const sign = v >= 0 ? '+' : '-';
    return `${sign}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatMoneyPlain(v) {
    return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ===== WEEK UTILS (ISO 8601) =====
function getWeekKey(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    // ISO: week starts Monday, week 1 contains Jan 4
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const yearStart = new Date(d.getFullYear(), 0, 4);
    const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function getWeekRange(weekKey) {
    const [year, wStr] = weekKey.split('-W');
    const w = parseInt(wStr);
    const jan4 = new Date(parseInt(year), 0, 4);
    const dayOfWeek = (jan4.getDay() + 6) % 7; // 0=Monday
    const start = new Date(jan4);
    start.setDate(jan4.getDate() - dayOfWeek + (w - 1) * 7);
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

// ===== BUY-IN MAP =====
function getBuyInAmount(limit) {
    const map = { NL2: 2, NL5: 5, NL10: 10, NL25: 25, NL50: 50, NL100: 100 };
    return map[limit] || 2;
}

// ===== DUPLICATE DETECTION FOR IMPORTS =====
function getImportedSessionKeys() {
    return new Set(getSessions()
        .filter(s => s.source === 'import')
        .map(s => `${s.date}_${s.limit}_${s.result}`));
}

// ===== TOAST NOTIFICATIONS =====
function toast(msg, type = 'success') {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => {
        t.classList.add('toast-exit');
        t.addEventListener('animationend', () => t.remove());
    }, 2700);
}

// ===== EXPORT / IMPORT =====
function exportAllData() {
    const data = {
        sessions: getSessions(),
        transactions: getTransactions(),
        weeklyNotes: getWeeklyNotes(),
        settings: getSettings(),
        exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `poker-diary-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
}

function importData(json) {
    try {
        const data = JSON.parse(json);
        if (data.sessions) Store.set(KEYS.sessions, data.sessions);
        if (data.transactions) Store.set(KEYS.transactions, data.transactions);
        if (data.weeklyNotes) Store.set(KEYS.weeklyNotes, data.weeklyNotes);
        if (data.settings) Store.set(KEYS.settings, data.settings);
        // bankroll is computed — no need to import it
        return true;
    } catch { return false; }
}

function clearAllData() {
    Object.values(KEYS).forEach(k => Store.remove(k));
    // Clean up legacy bankroll key if it exists
    localStorage.removeItem('pk_bankroll');
}
