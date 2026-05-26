// ===== POKER DIARY — APP LOGIC =====
// Depends on data.js being loaded first

(function () {
    'use strict';

    // ==================== NAVIGATION ====================
    const navLinks = document.querySelectorAll('.nav-link');
    const pages = document.querySelectorAll('.page');
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menu-toggle');

    function navigateTo(pageId) {
        pages.forEach(p => p.classList.remove('active'));
        navLinks.forEach(l => l.classList.remove('active'));
        const target = document.getElementById('page-' + pageId);
        if (target) target.classList.add('active');
        const link = document.querySelector(`.nav-link[data-page="${pageId}"]`);
        if (link) link.classList.add('active');
        sidebar.classList.remove('open');
        // Refresh page data
        if (pageId === 'dashboard') refreshDashboard();
        else if (pageId === 'sessions') refreshSessionsList();
        else if (pageId === 'weekly') refreshWeekly();
        else if (pageId === 'bankroll') refreshBankroll();
        else if (pageId === 'settings') loadSettings();
    }

    navLinks.forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            navigateTo(link.dataset.page);
        });
    });

    // Handle inline links with data-page
    document.addEventListener('click', e => {
        const link = e.target.closest('[data-page]');
        if (link && !link.classList.contains('nav-link')) {
            e.preventDefault();
            navigateTo(link.dataset.page);
        }
    });

    if (menuToggle) {
        menuToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    }

    // Close sidebar on outside click (mobile)
    document.addEventListener('click', e => {
        if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
            if (!sidebar.contains(e.target) && e.target !== menuToggle) {
                sidebar.classList.remove('open');
            }
        }
    });

    // ==================== BANKROLL DISPLAY ====================
    function updateBankrollDisplays() {
        const br = getBankroll();
        const formatted = formatMoneyPlain(br);
        const sidebarBr = document.getElementById('sidebar-bankroll');
        const mobileBr = document.getElementById('mobile-bankroll');
        if (sidebarBr) sidebarBr.textContent = formatted;
        if (mobileBr) mobileBr.textContent = formatted;
        // Color based on positive/negative
        const color = br >= 0 ? 'var(--green)' : 'var(--red)';
        if (sidebarBr) sidebarBr.style.color = color;
        if (mobileBr) mobileBr.style.color = color;
    }

    // ==================== DASHBOARD ====================
    let bankrollChart = null;

    function refreshDashboard() {
        const sessions = getSessions();
        const totalProfit = sessions.reduce((sum, s) => sum + (s.result || 0), 0);
        const totalMinutes = sessions.reduce((sum, s) => sum + (s.time || 0), 0);
        const totalHours = totalMinutes / 60;
        const winRate = totalHours > 0 ? totalProfit / totalHours : 0;

        document.getElementById('stat-profit').textContent = formatMoney(totalProfit);
        document.getElementById('stat-profit').style.color = totalProfit >= 0 ? 'var(--green)' : 'var(--red)';
        document.getElementById('stat-sessions').textContent = sessions.length;
        document.getElementById('stat-hours').textContent = totalHours.toFixed(1) + 'h';
        document.getElementById('stat-winrate').textContent = '$' + winRate.toFixed(2) + '/h';

        // Recent sessions
        renderRecentSessions(sessions.slice(0, 5));
        // Discipline
        renderDisciplineStats(sessions.slice(0, 10));
        // Tilt
        renderTiltStats(sessions.slice(0, 10));
        // Chart
        renderBankrollChart(sessions);
        updateBankrollDisplays();
    }

    function renderRecentSessions(recent) {
        const container = document.getElementById('recent-sessions');
        if (!recent.length) {
            container.innerHTML = '<p class="empty-state">Nenhuma sessão registrada ainda.</p>';
            return;
        }
        container.innerHTML = recent.map(s => {
            const cls = (s.result || 0) >= 0 ? 'positive' : 'negative';
            return `<div class="recent-item" data-session-id="${s.id}">
                <div><span class="recent-date">${formatDate(s.date)}</span><span class="recent-limit">${s.limit || ''}</span></div>
                <span class="recent-result ${cls}">${formatMoney(s.result || 0)}</span>
            </div>`;
        }).join('');
        container.querySelectorAll('.recent-item').forEach(item => {
            item.addEventListener('click', () => openSessionModal(item.dataset.sessionId));
        });
    }

    function renderDisciplineStats(sessions) {
        if (!sessions.length) return;
        const metrics = [
            { id: 'limp', key: 'gavelimp', bad: true },
            { id: 'raise', key: 'paidraise', bad: true },
            { id: 'position', key: 'respectedposition', bad: false },
            { id: 'hero', key: 'herocall', bad: true },
            { id: 'stoploss', key: 'stoploss', bad: false }
        ];
        metrics.forEach(m => {
            const count = sessions.filter(s => s.discipline && s.discipline[m.key]).length;
            const pct = Math.round((count / sessions.length) * 100);
            const fill = document.getElementById('disc-' + m.id);
            const pctEl = document.getElementById('disc-' + m.id + '-pct');
            if (fill) fill.style.width = pct + '%';
            if (pctEl) pctEl.textContent = pct + '%';
        });
    }

    function renderTiltStats(sessions) {
        if (!sessions.length) return;
        const tiltCount = sessions.filter(s => s.tilt).length;
        const pct = Math.round((tiltCount / sessions.length) * 100);
        const circle = document.getElementById('tilt-circle');
        const pctEl = document.getElementById('tilt-pct');
        if (pctEl) pctEl.textContent = pct + '%';
        if (circle) {
            const circumference = 2 * Math.PI * 42; // r=42
            const offset = circumference - (pct / 100) * circumference;
            circle.style.strokeDasharray = circumference;
            circle.style.strokeDashoffset = offset;
        }
    }

    function renderBankrollChart(sessions) {
        const canvas = document.getElementById('bankroll-chart');
        if (!canvas) return;

        // Build cumulative data from oldest to newest
        const sorted = [...sessions].reverse();
        const labels = ['Início'];
        const data = [getBankroll() - sorted.reduce((sum, s) => sum + (s.result || 0), 0)];

        sorted.forEach(s => {
            labels.push(formatDate(s.date));
            data.push(data[data.length - 1] + (s.result || 0));
        });

        // Simple canvas chart (no external lib needed)
        renderCanvasChart(canvas, labels, data);
    }

    function renderCanvasChart(canvas, labels, data) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.parentElement.getBoundingClientRect();
        const w = rect.width;
        const h = 220;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, w, h);

        if (data.length < 2) {
            ctx.fillStyle = '#64748b';
            ctx.font = '14px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Adicione sessões para ver o gráfico', w / 2, h / 2);
            return;
        }

        const pad = { top: 20, right: 20, bottom: 40, left: 60 };
        const plotW = w - pad.left - pad.right;
        const plotH = h - pad.top - pad.bottom;
        const minVal = Math.min(...data);
        const maxVal = Math.max(...data);
        const range = maxVal - minVal || 1;

        function x(i) { return pad.left + (i / (data.length - 1)) * plotW; }
        function y(v) { return pad.top + plotH - ((v - minVal) / range) * plotH; }

        // Grid lines
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        const gridLines = 5;
        for (let i = 0; i <= gridLines; i++) {
            const gy = pad.top + (plotH / gridLines) * i;
            ctx.beginPath();
            ctx.moveTo(pad.left, gy);
            ctx.lineTo(w - pad.right, gy);
            ctx.stroke();
            // Label
            const val = maxVal - (range / gridLines) * i;
            ctx.fillStyle = '#64748b';
            ctx.font = '11px JetBrains Mono, monospace';
            ctx.textAlign = 'right';
            ctx.fillText('$' + val.toFixed(0), pad.left - 8, gy + 4);
        }

        // Zero line
        if (minVal < 0 && maxVal > 0) {
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(pad.left, y(0));
            ctx.lineTo(w - pad.right, y(0));
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Gradient fill
        const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
        const lastVal = data[data.length - 1];
        const startVal = data[0];
        if (lastVal >= startVal) {
            gradient.addColorStop(0, 'rgba(16,185,129,0.25)');
            gradient.addColorStop(1, 'rgba(16,185,129,0.0)');
        } else {
            gradient.addColorStop(0, 'rgba(239,68,68,0.25)');
            gradient.addColorStop(1, 'rgba(239,68,68,0.0)');
        }

        ctx.beginPath();
        ctx.moveTo(x(0), y(data[0]));
        for (let i = 1; i < data.length; i++) {
            ctx.lineTo(x(i), y(data[i]));
        }
        ctx.lineTo(x(data.length - 1), pad.top + plotH);
        ctx.lineTo(x(0), pad.top + plotH);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Line
        ctx.beginPath();
        ctx.moveTo(x(0), y(data[0]));
        for (let i = 1; i < data.length; i++) {
            ctx.lineTo(x(i), y(data[i]));
        }
        ctx.strokeStyle = lastVal >= startVal ? '#10b981' : '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Dots
        data.forEach((v, i) => {
            ctx.beginPath();
            ctx.arc(x(i), y(v), 3.5, 0, Math.PI * 2);
            ctx.fillStyle = v >= startVal ? '#10b981' : '#ef4444';
            ctx.fill();
            ctx.strokeStyle = '#0a0e17';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        });

        // X-axis labels (show some, not all)
        ctx.fillStyle = '#64748b';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        const step = Math.max(1, Math.floor(labels.length / 8));
        for (let i = 0; i < labels.length; i += step) {
            ctx.fillText(labels[i], x(i), h - 8);
        }
        // Always show last label
        if ((labels.length - 1) % step !== 0) {
            ctx.fillText(labels[labels.length - 1], x(labels.length - 1), h - 8);
        }
    }

    // ==================== NEW SESSION FORM ====================
    const sessionForm = document.getElementById('session-form');
    const dateInput = document.getElementById('session-date');
    const buyinInitial = document.getElementById('session-buyin-initial');
    const buyinFinal = document.getElementById('session-buyin-final');
    const resultValue = document.getElementById('result-value');
    const resultBuyins = document.getElementById('result-buyins');
    const resultPreview = document.getElementById('result-preview');
    const tiltCheckbox = document.getElementById('session-tilt');
    const tiltTypeGroup = document.getElementById('tilt-type-group');
    const tiltLabel = document.getElementById('tilt-label');
    const energySlider = document.getElementById('session-energy');
    const focusSlider = document.getElementById('session-focus');
    const moodSlider = document.getElementById('session-mood');

    // Set default date
    if (dateInput) dateInput.valueAsDate = new Date();

    // Real-time result preview
    function updateResultPreview() {
        const initial = parseFloat(buyinInitial.value) || 0;
        const final_ = parseFloat(buyinFinal.value) || 0;
        const result = final_ - initial;
        const limit = document.getElementById('session-limit').value;
        const biAmount = getBuyInAmount(limit);
        const buyinsCount = biAmount > 0 ? (result / biAmount).toFixed(1) : 0;

        resultValue.textContent = formatMoney(result);
        resultValue.style.color = result >= 0 ? 'var(--green)' : 'var(--red)';
        resultBuyins.textContent = `(${buyinsCount} buy-ins)`;
    }
    if (buyinInitial) buyinInitial.addEventListener('input', updateResultPreview);
    if (buyinFinal) buyinFinal.addEventListener('input', updateResultPreview);
    document.getElementById('session-limit')?.addEventListener('change', updateResultPreview);

    // Sliders
    [
        { slider: energySlider, valId: 'energy-val' },
        { slider: focusSlider, valId: 'focus-val' },
        { slider: moodSlider, valId: 'mood-val' }
    ].forEach(({ slider, valId }) => {
        if (slider) {
            slider.addEventListener('input', () => {
                document.getElementById(valId).textContent = slider.value;
            });
        }
    });

    // Tilt toggle
    if (tiltCheckbox) {
        tiltCheckbox.addEventListener('change', () => {
            tiltTypeGroup.style.display = tiltCheckbox.checked ? 'flex' : 'none';
            tiltLabel.textContent = tiltCheckbox.checked ? 'Sim 😤' : 'Não';
        });
    }

    // ==================== MARKED HANDS ====================
    let handCount = 0;
    const handsContainer = document.getElementById('hands-container');
    const addHandBtn = document.getElementById('add-hand-btn');

    function addHandCard() {
        handCount++;
        const card = document.createElement('div');
        card.className = 'hand-card';
        card.dataset.handIdx = handCount;
        card.innerHTML = `
            <div class="hand-card-header">
                <span class="hand-card-title">Mão #${handCount}</span>
                <button type="button" class="hand-remove" data-idx="${handCount}">✕</button>
            </div>
            <div class="form-grid">
                <div class="form-group">
                    <label>Posição</label>
                    <select class="hand-position">
                        <option value="UTG">UTG</option>
                        <option value="MP">MP</option>
                        <option value="CO">CO</option>
                        <option value="BTN">BTN</option>
                        <option value="SB">SB</option>
                        <option value="BB">BB</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Cartas</label>
                    <input type="text" class="hand-cards" placeholder="Ex: AKs, QJo" maxlength="10">
                </div>
                <div class="form-group">
                    <label>Ação</label>
                    <select class="hand-action">
                        <option value="Raise">Raise</option>
                        <option value="Call">Call</option>
                        <option value="3-Bet">3-Bet</option>
                        <option value="Fold">Fold</option>
                        <option value="All-in">All-in</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Resultado</label>
                    <select class="hand-result">
                        <option value="Ganhou">Ganhou</option>
                        <option value="Perdeu">Perdeu</option>
                        <option value="Split">Split</option>
                    </select>
                </div>
            </div>
            <div class="form-group" style="margin-top:10px">
                <label>Notas</label>
                <textarea class="hand-notes" rows="2" placeholder="O que aconteceu nessa mão..."></textarea>
            </div>
        `;
        handsContainer.appendChild(card);
        card.querySelector('.hand-remove').addEventListener('click', () => card.remove());
    }

    if (addHandBtn) addHandBtn.addEventListener('click', addHandCard);

    // Collect hands data
    function collectHands() {
        const cards = handsContainer.querySelectorAll('.hand-card');
        return Array.from(cards).map(c => ({
            position: c.querySelector('.hand-position').value,
            cards: c.querySelector('.hand-cards').value,
            action: c.querySelector('.hand-action').value,
            result: c.querySelector('.hand-result').value,
            notes: c.querySelector('.hand-notes').value
        }));
    }

    // ==================== SAVE SESSION ====================
    if (sessionForm) {
        sessionForm.addEventListener('submit', e => {
            e.preventDefault();
            const initial = parseFloat(buyinInitial.value) || 0;
            const final_ = parseFloat(buyinFinal.value) || 0;
            const result = final_ - initial;

            const session = {
                date: dateInput.value,
                limit: document.getElementById('session-limit').value,
                format: document.getElementById('session-format').value,
                time: parseInt(document.getElementById('session-time').value) || 0,
                tables: parseInt(document.getElementById('session-tables').value) || 1,
                buyinInitial: initial,
                buyinFinal: final_,
                result: result,
                energy: parseInt(energySlider.value),
                focus: parseInt(focusSlider.value),
                mood: parseInt(moodSlider.value),
                stateAfter: document.getElementById('session-state-after').value,
                tilt: tiltCheckbox.checked,
                tiltType: tiltCheckbox.checked ? document.getElementById('session-tilt-type').value : null,
                discipline: {
                    gavelimp: document.getElementById('disc-gave-limp').checked,
                    paidraise: document.getElementById('disc-paid-raise').checked,
                    respectedposition: document.getElementById('disc-respected-position').checked,
                    herocall: document.getElementById('disc-hero-call').checked,
                    stoploss: document.getElementById('disc-stop-loss').checked
                },
                hands: collectHands(),
                review: {
                    best: document.getElementById('review-best').value,
                    worst: document.getElementById('review-worst').value,
                    error: document.getElementById('review-error').value,
                    lesson: document.getElementById('review-lesson').value,
                    rule: document.getElementById('review-rule').value
                }
            };

            saveSession(session);
            toast('Sessão salva com sucesso! 🎯');
            sessionForm.reset();
            dateInput.valueAsDate = new Date();
            handsContainer.innerHTML = '';
            handCount = 0;
            tiltTypeGroup.style.display = 'none';
            tiltLabel.textContent = 'Não';
            updateResultPreview();
            updateBankrollDisplays();
            // Reset slider displays
            document.getElementById('energy-val').textContent = '5';
            document.getElementById('focus-val').textContent = '5';
            document.getElementById('mood-val').textContent = '5';
            // Re-check default checkboxes
            document.getElementById('disc-respected-position').checked = true;
            document.getElementById('disc-stop-loss').checked = true;
        });
    }

    // ==================== SESSIONS LIST ====================
    function refreshSessionsList() {
        const sessions = getSessions();
        const searchVal = (document.getElementById('session-search')?.value || '').toLowerCase();
        const filterLimit = document.getElementById('session-filter-limit')?.value || '';
        const filterResult = document.getElementById('session-filter-result')?.value || '';

        let filtered = sessions;
        if (searchVal) {
            filtered = filtered.filter(s =>
                (s.date || '').includes(searchVal) ||
                (s.limit || '').toLowerCase().includes(searchVal) ||
                (s.format || '').toLowerCase().includes(searchVal) ||
                (s.review?.lesson || '').toLowerCase().includes(searchVal) ||
                (s.review?.error || '').toLowerCase().includes(searchVal)
            );
        }
        if (filterLimit) {
            filtered = filtered.filter(s => s.limit === filterLimit);
        }
        if (filterResult === 'positive') {
            filtered = filtered.filter(s => (s.result || 0) >= 0);
        } else if (filterResult === 'negative') {
            filtered = filtered.filter(s => (s.result || 0) < 0);
        }

        const container = document.getElementById('sessions-list');
        if (!filtered.length) {
            container.innerHTML = '<p class="empty-state">Nenhuma sessão encontrada. <a href="#" data-page="new-session">Registre sua primeira sessão!</a></p>';
            return;
        }

        container.innerHTML = filtered.map(s => {
            const cls = (s.result || 0) >= 0 ? 'positive' : 'negative';
            const time = s.time ? `${s.time}min` : '';
            const tables = s.tables ? `${s.tables} mesa${s.tables > 1 ? 's' : ''}` : '';
            const meta = [time, tables, s.format].filter(Boolean).join(' · ');
            return `<div class="session-card" data-session-id="${s.id}">
                <span class="session-card-date">${formatDate(s.date)}</span>
                <div class="session-card-info">
                    <span class="session-card-limit">${s.limit || '—'}</span>
                    <span class="session-card-meta">${meta}</span>
                </div>
                <span class="session-card-result ${cls}">${formatMoney(s.result || 0)}</span>
                <button class="session-card-delete" data-delete-id="${s.id}" title="Excluir sessão">🗑</button>
            </div>`;
        }).join('');

        // Click to open detail
        container.querySelectorAll('.session-card').forEach(card => {
            card.addEventListener('click', e => {
                if (e.target.closest('.session-card-delete')) return;
                openSessionModal(card.dataset.sessionId);
            });
        });

        // Delete buttons
        container.querySelectorAll('.session-card-delete').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                if (confirm('Tem certeza que deseja excluir esta sessão?')) {
                    deleteSession(btn.dataset.deleteId);
                    refreshSessionsList();
                    updateBankrollDisplays();
                    toast('Sessão excluída', 'info');
                }
            });
        });
    }

    // Filters
    document.getElementById('session-search')?.addEventListener('input', refreshSessionsList);
    document.getElementById('session-filter-limit')?.addEventListener('change', refreshSessionsList);
    document.getElementById('session-filter-result')?.addEventListener('change', refreshSessionsList);

    // ==================== SESSION MODAL ====================
    const modalOverlay = document.getElementById('modal-overlay');
    const modalContent = document.getElementById('modal-content');
    const modalClose = document.getElementById('modal-close');

    function openSessionModal(id) {
        const s = getSessionById(id);
        if (!s) return;

        const cls = (s.result || 0) >= 0 ? 'positive' : 'negative';
        const emoji = (s.result || 0) >= 0 ? '🟢' : '🔴';
        const biAmount = getBuyInAmount(s.limit);
        const buyins = biAmount > 0 ? ((s.result || 0) / biAmount).toFixed(1) : '0';
        const time = s.time ? `${s.time} min` : '—';

        let handsHtml = '';
        if (s.hands && s.hands.length) {
            handsHtml = `<h4 style="margin: 20px 0 10px; color: var(--accent);">🃏 Mãos Marcadas</h4>` +
                s.hands.map((h, i) => `
                    <div style="padding: 12px; background: rgba(255,255,255,0.03); border-radius: 8px; margin-bottom: 8px;">
                        <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:6px;">
                            <span style="color:var(--accent); font-weight:600;">Mão #${i + 1}</span>
                            <span style="color:var(--text-muted);">${h.position || ''}</span>
                            <span style="font-family:var(--mono); color:var(--text-primary);">${h.cards || ''}</span>
                            <span style="color:var(--text-secondary);">${h.action || ''}</span>
                            <span style="color:${h.result === 'Ganhou' ? 'var(--green)' : h.result === 'Perdeu' ? 'var(--red)' : 'var(--yellow)'}; font-weight:600;">${h.result || ''}</span>
                        </div>
                        ${h.notes ? `<p style="color:var(--text-muted); font-size:0.85rem;">${h.notes}</p>` : ''}
                    </div>
                `).join('');
        }

        let reviewHtml = '';
        if (s.review) {
            const fields = [
                { label: '✅ Melhor decisão', val: s.review.best },
                { label: '❌ Pior decisão', val: s.review.worst },
                { label: '⚠️ Erro principal', val: s.review.error },
                { label: '💡 Lição do dia', val: s.review.lesson },
                { label: '📌 Regra p/ próxima', val: s.review.rule }
            ].filter(f => f.val);
            if (fields.length) {
                reviewHtml = `<h4 style="margin: 20px 0 10px; color: var(--accent);">📝 Revisão</h4>` +
                    fields.map(f => `
                        <div style="margin-bottom: 10px;">
                            <span style="font-size:0.82rem; color:var(--text-muted);">${f.label}</span>
                            <p style="margin-top: 4px; color: var(--text-secondary); font-size: 0.9rem;">${f.val}</p>
                        </div>
                    `).join('');
            }
        }

        modalContent.innerHTML = `
            <div style="text-align:center; margin-bottom: 24px;">
                <span style="font-size:0.85rem; color:var(--text-muted);">${formatDate(s.date)}</span>
                <h2 style="font-size:2rem; font-family:var(--mono); font-weight:800; color:${(s.result || 0) >= 0 ? 'var(--green)' : 'var(--red)'}; margin: 8px 0;">
                    ${emoji} ${formatMoney(s.result || 0)}
                </h2>
                <span style="font-size:0.85rem; color:var(--text-muted);">${buyins} buy-ins</span>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:20px;">
                <div style="text-align:center; padding:12px; background:rgba(255,255,255,0.03); border-radius:8px;">
                    <div style="font-size:0.75rem; color:var(--text-muted);">Limite</div>
                    <div style="font-weight:600; margin-top:4px;">${s.limit || '—'}</div>
                </div>
                <div style="text-align:center; padding:12px; background:rgba(255,255,255,0.03); border-radius:8px;">
                    <div style="font-size:0.75rem; color:var(--text-muted);">Tempo</div>
                    <div style="font-weight:600; margin-top:4px;">${time}</div>
                </div>
                <div style="text-align:center; padding:12px; background:rgba(255,255,255,0.03); border-radius:8px;">
                    <div style="font-size:0.75rem; color:var(--text-muted);">Formato</div>
                    <div style="font-weight:600; margin-top:4px;">${s.format || '—'}</div>
                </div>
            </div>

            <h4 style="margin: 20px 0 10px; color: var(--accent);">🧠 Estado Emocional</h4>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:12px;">
                <div style="text-align:center;">
                    <div style="font-size:0.75rem; color:var(--text-muted);">Energia</div>
                    <div style="font-family:var(--mono); font-size:1.2rem; font-weight:700; color:var(--accent);">${s.energy ?? '—'}/10</div>
                </div>
                <div style="text-align:center;">
                    <div style="font-size:0.75rem; color:var(--text-muted);">Foco</div>
                    <div style="font-family:var(--mono); font-size:1.2rem; font-weight:700; color:var(--accent);">${s.focus ?? '—'}/10</div>
                </div>
                <div style="text-align:center;">
                    <div style="font-size:0.75rem; color:var(--text-muted);">Humor</div>
                    <div style="font-family:var(--mono); font-size:1.2rem; font-weight:700; color:var(--accent);">${s.mood ?? '—'}/10</div>
                </div>
            </div>
            <div style="display:flex; gap:16px; flex-wrap:wrap; margin-bottom:8px;">
                <span style="font-size:0.85rem; color:var(--text-secondary);">Estado depois: <strong>${s.stateAfter || '—'}</strong></span>
                <span style="font-size:0.85rem; color:${s.tilt ? 'var(--red)' : 'var(--green)'}; font-weight:600;">${s.tilt ? '😤 Tilt: ' + (s.tiltType || 'Sim') : '✅ Sem tilt'}</span>
            </div>

            <h4 style="margin: 20px 0 10px; color: var(--accent);">📏 Disciplina</h4>
            <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
                ${renderDisciplineTag('Limp', s.discipline?.gavelimp, true)}
                ${renderDisciplineTag('Raise s/ plano', s.discipline?.paidraise, true)}
                ${renderDisciplineTag('Posição', s.discipline?.respectedposition, false)}
                ${renderDisciplineTag('Hero call', s.discipline?.herocall, true)}
                ${renderDisciplineTag('Stop loss', s.discipline?.stoploss, false)}
            </div>

            ${handsHtml}
            ${reviewHtml}
        `;

        modalOverlay.classList.add('active');
    }

    function renderDisciplineTag(label, checked, isBad) {
        if (!checked) return '';
        const color = isBad ? 'var(--red)' : 'var(--green)';
        const bg = isBad ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)';
        const icon = isBad ? '✗' : '✓';
        return `<span style="padding:4px 12px; border-radius:6px; font-size:0.82rem; font-weight:500; background:${bg}; color:${color};">${icon} ${label}</span>`;
    }

    if (modalClose) modalClose.addEventListener('click', () => modalOverlay.classList.remove('active'));
    if (modalOverlay) {
        modalOverlay.addEventListener('click', e => {
            if (e.target === modalOverlay) modalOverlay.classList.remove('active');
        });
    }
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') modalOverlay?.classList.remove('active');
    });

    // ==================== WEEKLY REVIEW ====================
    let currentWeekOffset = 0;

    function getCurrentWeekKey() {
        const now = new Date();
        now.setDate(now.getDate() + currentWeekOffset * 7);
        return getWeekKey(now.toISOString().slice(0, 10));
    }

    function refreshWeekly() {
        const weekKey = getCurrentWeekKey();
        const { start, end } = getWeekRange(weekKey);
        document.getElementById('week-label').textContent =
            `${formatDate(start.toISOString().slice(0, 10))} — ${formatDate(end.toISOString().slice(0, 10))}`;

        const sessions = getSessionsForWeek(weekKey);
        const totalResult = sessions.reduce((s, x) => s + (x.result || 0), 0);
        const totalMinutes = sessions.reduce((s, x) => s + (x.time || 0), 0);

        document.getElementById('ws-sessions').textContent = sessions.length;
        document.getElementById('ws-hours').textContent = (totalMinutes / 60).toFixed(1) + 'h';
        document.getElementById('ws-result').textContent = formatMoney(totalResult);
        document.getElementById('ws-result').style.color = totalResult >= 0 ? 'var(--green)' : 'var(--red)';

        // Buy-ins
        const totalBuyins = sessions.reduce((s, x) => {
            const bi = getBuyInAmount(x.limit);
            return s + (bi > 0 ? (x.result || 0) / bi : 0);
        }, 0);
        document.getElementById('ws-buyins').textContent = totalBuyins.toFixed(1);

        // Errors
        const limps = sessions.filter(s => s.discipline?.gavelimp).length;
        const calls = sessions.filter(s => s.discipline?.paidraise).length;
        const hero = sessions.filter(s => s.discipline?.herocall).length;
        const slBroken = sessions.filter(s => s.discipline && !s.discipline.stoploss).length;
        document.getElementById('ws-limps').textContent = limps;
        document.getElementById('ws-calls').textContent = calls;
        document.getElementById('ws-hero').textContent = hero;
        document.getElementById('ws-stoploss').textContent = slBroken;

        // Tilt
        const tiltSessions = sessions.filter(s => s.tilt);
        document.getElementById('ws-tilt').textContent = tiltSessions.length;
        // Most common trigger
        const triggers = tiltSessions.map(s => s.tiltType).filter(Boolean);
        const triggerCounts = {};
        triggers.forEach(t => triggerCounts[t] = (triggerCounts[t] || 0) + 1);
        const topTrigger = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1])[0];
        document.getElementById('ws-trigger').textContent = topTrigger ? topTrigger[0] : '—';

        // Load weekly notes
        const notes = getWeeklyNotes();
        const weekNotes = notes[weekKey] || {};
        document.getElementById('weekly-leak').value = weekNotes.leak || '';
        document.getElementById('weekly-rule').value = weekNotes.rule || '';
        document.getElementById('weekly-study').value = weekNotes.study || '';
    }

    document.getElementById('prev-week')?.addEventListener('click', () => { currentWeekOffset--; refreshWeekly(); });
    document.getElementById('next-week')?.addEventListener('click', () => { currentWeekOffset++; refreshWeekly(); });

    // Save weekly notes
    document.getElementById('weekly-notes-form')?.addEventListener('submit', e => {
        e.preventDefault();
        const weekKey = getCurrentWeekKey();
        saveWeeklyNote(weekKey, {
            leak: document.getElementById('weekly-leak').value,
            rule: document.getElementById('weekly-rule').value,
            study: document.getElementById('weekly-study').value
        });
        toast('Notas semanais salvas! 📝');
    });

    // ==================== BANKROLL PAGE ====================
    function refreshBankroll() {
        const br = getBankroll();
        document.getElementById('bankroll-current-value').textContent = formatMoneyPlain(br);
        document.getElementById('bankroll-current-value').style.color = br >= 0 ? 'var(--green)' : 'var(--red)';

        // Buy-ins available (NL2)
        document.getElementById('bm-buyins').textContent = Math.floor(br / 2);

        // Risk assessment
        const buyins = br / 2;
        let risk = '—';
        if (buyins >= 40) risk = '🟢 Baixo';
        else if (buyins >= 20) risk = '🟡 Moderado';
        else if (buyins > 0) risk = '🔴 Alto';
        document.getElementById('bm-risk').textContent = risk;

        // Next limit suggestion
        let nextLimit = '—';
        if (br >= 5000) nextLimit = 'NL100 (50+ BI)';
        else if (br >= 2500) nextLimit = 'NL50 (50+ BI)';
        else if (br >= 1250) nextLimit = 'NL25 (50+ BI)';
        else if (br >= 500) nextLimit = 'NL10 (50+ BI)';
        else if (br >= 250) nextLimit = 'NL5 (50+ BI)';
        else nextLimit = 'NL2';
        document.getElementById('bm-next-limit').textContent = nextLimit;

        // Transactions history
        renderTransactionsHistory();
        updateBankrollDisplays();
    }

    function renderTransactionsHistory() {
        const txs = getTransactions();
        const container = document.getElementById('bankroll-history');
        if (!txs.length) {
            container.innerHTML = '<p class="empty-state">Nenhuma transação registrada.</p>';
            return;
        }
        container.innerHTML = txs.map(t => {
            const cls = t.type === 'deposit' ? 'deposit' : 'withdraw';
            const sign = t.type === 'deposit' ? '+' : '-';
            const label = t.type === 'deposit' ? 'Depósito' : 'Saque';
            return `<div class="br-item">
                <div>
                    <span class="br-item-type ${cls}">${label}</span>
                    ${t.note ? `<span style="color:var(--text-muted); margin-left:8px; font-size:0.8rem;">${t.note}</span>` : ''}
                </div>
                <div style="display:flex; flex-direction:column; align-items:flex-end;">
                    <span style="font-family:var(--mono); font-weight:600; color:${t.type === 'deposit' ? 'var(--green)' : 'var(--red)'};">${sign}$${t.amount.toFixed(2)}</span>
                    <span style="font-size:0.75rem; color:var(--text-muted);">${formatDate(t.date?.slice(0, 10))}</span>
                </div>
            </div>`;
        }).join('');
    }

    // Bankroll form
    document.getElementById('bankroll-form')?.addEventListener('submit', e => {
        e.preventDefault();
        const type = document.getElementById('br-type').value;
        const amount = parseFloat(document.getElementById('br-amount').value);
        const note = document.getElementById('br-note').value;

        if (!amount || amount <= 0) {
            toast('Insira um valor válido', 'error');
            return;
        }

        addTransaction({ type, amount, note });
        toast(type === 'deposit' ? 'Depósito registrado! 💰' : 'Saque registrado! 💸');
        document.getElementById('bankroll-form').reset();
        refreshBankroll();
    });

    // ==================== SETTINGS ====================
    function loadSettings() {
        const settings = getSettings();
        document.getElementById('stop-loss-amount').value = settings.stopLoss || 3;
    }

    document.getElementById('save-settings')?.addEventListener('click', () => {
        saveSettings({ stopLoss: parseInt(document.getElementById('stop-loss-amount').value) || 3 });
        toast('Configurações salvas! ⚙️');
    });

    // Export
    document.getElementById('export-data')?.addEventListener('click', exportAllData);

    // Import
    document.getElementById('import-data')?.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            if (importData(ev.target.result)) {
                toast('Dados importados com sucesso! 📦');
                refreshDashboard();
                updateBankrollDisplays();
            } else {
                toast('Erro ao importar dados', 'error');
            }
        };
        reader.readAsText(file);
    });

    // Clear data
    document.getElementById('clear-data')?.addEventListener('click', () => {
        if (confirm('⚠️ Tem certeza? Todos os dados serão perdidos permanentemente!')) {
            clearAllData();
            toast('Todos os dados foram removidos', 'info');
            refreshDashboard();
            updateBankrollDisplays();
        }
    });

    // ==================== UTILS ====================
    function formatDate(dateStr) {
        if (!dateStr) return '—';
        try {
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                return `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
            return dateStr;
        } catch {
            return dateStr;
        }
    }

    // ==================== WINDOW RESIZE FOR CHART ====================
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const activePage = document.querySelector('.page.active');
            if (activePage?.id === 'page-dashboard') {
                renderBankrollChart(getSessions());
            }
        }, 250);
    });

    // ==================== INIT ====================
    refreshDashboard();
    updateBankrollDisplays();

})();
