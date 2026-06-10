// ===== HAND HISTORY PARSER =====
const HandHistoryParser = (() => {
    const STAKES = {
        '0.01/0.02': 'NL2', '0.02/0.05': 'NL5', '0.05/0.10': 'NL10',
        '0.10/0.25': 'NL25', '0.25/0.50': 'NL50', '0.50/1.00': 'NL100'
    };
    const POS_6MAX = ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'];
    const POS_9MAX = ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'MP', 'HJ', 'CO'];

    // --- Utility ---
    const num = s => parseFloat((s || '0').replace(/[^0-9.\-]/g, '')) || 0;
    const clean = s => (s || '').trim();

    function detectSite(text) {
        const h = text.slice(0, 500);
        if (/PokerStars\s+(Zoom\s+)?Hand\s+#/i.test(h)) return 'PokerStars';
        if (/Poker\s+Hand\s+#/i.test(h) && /GG(Poker|.*Network)/i.test(h)) return 'GGPoker';
        if (/PokerStars/i.test(h)) return 'PokerStars';
        if (/GG/i.test(h)) return 'GGPoker';
        return null;
    }

    function splitHands(text) {
        // Split on blank-line-separated hand blocks starting with known headers
        return text
            .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
            .split(/\n{2,}(?=(?:PokerStars|Poker)\s+(?:Zoom\s+)?Hand\s+#)/i)
            .map(clean)
            .filter(b => b.length > 30);
    }

    // --- Resolve stakes string to limit label ---
    function resolveLimit(sb, bb) {
        const key = `${parseFloat(sb).toFixed(2)}/${parseFloat(bb).toFixed(2)}`;
        return STAKES[key] || `NL${Math.round(parseFloat(bb) * 100)}`;
    }

    // --- Position from seat# relative to button ---
    function resolvePosition(seatNum, btnSeat, seatNums, maxSeats) {
        const sorted = [...seatNums].sort((a, b) => a - b);
        const btnIdx = sorted.indexOf(btnSeat);
        if (btnIdx === -1) return 'Unknown';
        const n = sorted.length;
        const heroIdx = sorted.indexOf(seatNum);
        if (heroIdx === -1) return 'Unknown';
        const offset = (heroIdx - btnIdx + n) % n;
        const positions = maxSeats <= 6 ? POS_6MAX : POS_9MAX;
        return positions[offset] || `Seat${offset}`;
    }

    // --- Parse a single hand block ---
    function parseHand(block, site) {
        const lines = block.split('\n').map(clean).filter(Boolean);
        if (lines.length < 3) return null;

        const hand = {
            id: null, date: null, limit: null, tableType: '6-max', maxSeats: 6,
            heroSeat: null, heroCards: [], heroPosition: null,
            actions: { preflop: [], flop: [], turn: [], river: [] },
            board: [], result: 0, potTotal: 0, rake: 0, site
        };

        try { parseHeader(lines[0], hand, site); } catch { return null; }
        if (!hand.id) return null;

        let btnSeat = null, seatNums = [], heroName = null, street = 'preflop';

        for (let i = 1; i < lines.length; i++) {
            const ln = lines[i];

            // Table line — button seat + max seats
            const tblMatch = ln.match(/Table\s+'[^']*'\s+(\d+)-max\s+Seat\s+#(\d+)/i);
            if (tblMatch) {
                hand.maxSeats = parseInt(tblMatch[1]);
                hand.tableType = `${tblMatch[1]}-max`;
                btnSeat = parseInt(tblMatch[2]);
                continue;
            }

            // Seat line
            const seatMatch = ln.match(/^Seat\s+(\d+):\s+(\S+)\s+\(\$?([\d.]+)/i);
            if (seatMatch) {
                seatNums.push(parseInt(seatMatch[1]));
                continue;
            }

            // Dealt to Hero
            const dealtMatch = ln.match(/Dealt\s+to\s+(\S+)\s+\[([^\]]+)\]/i);
            if (dealtMatch) {
                heroName = dealtMatch[1];
                hand.heroCards = dealtMatch[2].split(/\s+/);
                // Find hero seat
                for (let j = 0; j < i; j++) {
                    const sm = lines[j].match(new RegExp(`^Seat\\s+(\\d+):\\s+${escRx(heroName)}\\b`, 'i'));
                    if (sm) { hand.heroSeat = parseInt(sm[1]); break; }
                }
                continue;
            }

            // Street markers
            if (/^\*\*\*\s+FLOP\s+\*\*\*/.test(ln)) {
                street = 'flop';
                const bm = ln.match(/\[([^\]]+)\]/);
                if (bm) hand.board.push(...bm[1].split(/\s+/));
                continue;
            }
            if (/^\*\*\*\s+TURN\s+\*\*\*/.test(ln)) {
                street = 'turn';
                const cards = [...ln.matchAll(/\[([^\]]+)\]/g)];
                if (cards.length >= 2) hand.board.push(...cards[1][1].split(/\s+/));
                else if (cards.length === 1) hand.board.push(...cards[0][1].split(/\s+/).slice(-1));
                continue;
            }
            if (/^\*\*\*\s+RIVER\s+\*\*\*/.test(ln)) {
                street = 'river';
                const cards = [...ln.matchAll(/\[([^\]]+)\]/g)];
                if (cards.length >= 2) hand.board.push(...cards[1][1].split(/\s+/));
                else if (cards.length === 1) hand.board.push(...cards[0][1].split(/\s+/).slice(-1));
                continue;
            }
            if (/^\*\*\*\s+(SHOW\s*DOWN|SUMMARY)\s+\*\*\*/.test(ln)) {
                street = 'summary';
                continue;
            }
            if (/^\*\*\*\s+HOLE\s+CARDS\s+\*\*\*/.test(ln)) { street = 'preflop'; continue; }

            // Actions (player: action)
            if (street !== 'summary' && heroName) {
                const actMatch = ln.match(/^(\S+):\s+(.+)$/);
                if (actMatch) {
                    const [, player, action] = actMatch;
                    if (hand.actions[street]) {
                        hand.actions[street].push({ player, action: action.trim(), isHero: player === heroName });
                    }
                    continue;
                }
            }

            // Collected / won
            if (heroName && ln.match(new RegExp(`${escRx(heroName)}\\s+collected\\s+\\$?([\\d.]+)`, 'i'))) {
                hand.result = num(ln.match(/\$?([\d.]+)/)?.[0]);
            }
            if (heroName && ln.match(new RegExp(`${escRx(heroName)}\\s+won\\s+\\$?([\\d.]+)`, 'i'))) {
                hand.result = num(ln.match(/won\s+\$?([\d.]+)/i)?.[1]);
            }

            // Total pot + rake
            const potMatch = ln.match(/Total\s+pot\s+\$?([\d.]+).*?Rake\s+\$?([\d.]+)/i);
            if (potMatch) {
                hand.potTotal = num(potMatch[1]);
                hand.rake = num(potMatch[2]);
            }
        }

        // Compute hero invested (amount put in preflop + post-flop)
        if (heroName) {
            let invested = 0;
            for (const st of ['preflop', 'flop', 'turn', 'river']) {
                for (const a of hand.actions[st]) {
                    if (!a.isHero) continue;
                    const amt = num(a.action.match(/\$?([\d.]+)/)?.[0]);
                    if (/calls|bets|raises|all-in/i.test(a.action)) invested += amt;
                    if (/posts\s+(small|big)\s+blind/i.test(a.action)) invested += amt;
                }
            }
            // If hero won, result = collected - invested. If hero lost, result = -invested
            if (hand.result > 0) {
                hand.result = +(hand.result - invested).toFixed(2);
            } else {
                hand.result = +(-invested).toFixed(2);
            }
        }

        // Position
        if (hand.heroSeat !== null && btnSeat !== null && seatNums.length) {
            hand.heroPosition = resolvePosition(hand.heroSeat, btnSeat, seatNums, hand.maxSeats);
        }

        // Deduplicate board cards
        hand.board = [...new Set(hand.board)];

        return hand;
    }

    function parseHeader(line, hand, site) {
        // Hand ID
        const idMatch = line.match(/#(\S+?):/);
        if (idMatch) hand.id = idMatch[1];

        // Stakes
        const stakeMatch = line.match(/\$?([\d.]+)\/\$?([\d.]+)/);
        if (stakeMatch) hand.limit = resolveLimit(stakeMatch[1], stakeMatch[2]);

        // Date/time — formats: 2024/01/15 20:30:00 or 2024-01-15 20:30:00
        const dateMatch = line.match(/(\d{4}[\/-]\d{2}[\/-]\d{2})\s+(\d{2}:\d{2}:\d{2})/);
        if (dateMatch) {
            const ds = dateMatch[1].replace(/\//g, '-');
            hand.date = `${ds}T${dateMatch[2]}`;
        }
    }

    function escRx(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    // --- Group hands into sessions by date ---
    function groupByDate(hands) {
        const map = {};
        for (const h of hands) {
            const d = h.date ? h.date.slice(0, 10) : 'unknown';
            (map[d] = map[d] || []).push(h);
        }
        return map;
    }

    function handsToSession(hands, date) {
        if (!hands.length) return null;
        const limit = hands[0].limit || 'NL2';
        const bb = getBuyInAmount(limit) / 100; // big blind in dollars
        const totalResult = hands.reduce((s, h) => s + (h.result || 0), 0);
        const notableHands = hands.filter(h => h.result > bb * 10).map(h => ({
            id: h.id,
            cards: h.heroCards.join(' '),
            board: h.board.join(' '),
            result: h.result,
            position: h.heroPosition
        }));

        // Estimate duration: ~60 hands/hour per table
        const durationHours = Math.max(0.25, +(hands.length / 60).toFixed(2));
        const durationMin = Math.round(durationHours * 60);

        return {
            date: date || hands[0].date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
            limit,
            result: +totalResult.toFixed(2),
            hands: hands.length,
            duration: durationMin,
            site: hands[0].site || 'Unknown',
            tableType: hands[0].tableType || '6-max',
            notableHands,
            source: 'import'
        };
    }

    // --- Main parse ---
    function parse(text) {
        if (!text || typeof text !== 'string') return { site: null, hands: [], sessions: [] };

        const site = detectSite(text);
        if (!site) {
            toast('Unrecognized hand history format', 'error');
            return { site: null, hands: [], sessions: [] };
        }

        const blocks = splitHands(text);
        const hands = blocks.map(b => parseHand(b, site)).filter(Boolean);

        if (!hands.length) {
            toast('No valid hands found in file', 'error');
            return { site, hands: [], sessions: [] };
        }

        // Group into sessions by date
        const dateMap = groupByDate(hands);
        const sessions = Object.entries(dateMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, hds]) => handsToSession(hds, date));

        return { site, hands, sessions };
    }

    return { parse, handsToSession, detectSite };
})();
