// server/src/utils/holidaysPdfParser.js
//
// Extraction des conges scolaires depuis le PDF "CALENDRIER AAAA-AAAA" de
// l'ecole. Le PDF est une grille : une colonne par mois (6 par page, 2 pages),
// une ligne par jour du mois (1 a 31). Les jours non prestes (week-ends,
// conges, vacances) sont grises, les jours d'ecole sont blancs.
//
// On lit directement les flux de contenu du PDF (zlib est natif) : aucune
// dependance supplementaire. Pour chaque cellule on releve la couleur de fond
// et le texte, puis on regroupe les jours grises consecutifs en intervalles
// {name, start, end} - le meme format que le JSON importe jusqu'ici.

const zlib = require('zlib');

const MONTHS = {
    JANVIER: 1, FEVRIER: 2, MARS: 3, AVRIL: 4, MAI: 5, JUIN: 6,
    JUILLET: 7, AOUT: 8, SEPTEMBRE: 9, OCTOBRE: 10, NOVEMBRE: 11, DECEMBRE: 12
};

// Niveaux de gris releves sur le calendrier de reference (0 = noir, 1 = blanc) :
// 0.651 = bandeau d'en-tete, 0.749 = week-end, 0.851 = conge, 1 = jour d'ecole.
const SHADED_MIN = 0.60; // en dessous : bandeau d'en-tete, on ignore
const SHADED_MAX = 0.93; // au dessus : cellule blanche = jour preste

const stripAccents = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

// --- 1. Flux de contenu -----------------------------------------------------

function extractContentStreams(buffer) {
    const streams = [];
    let i = 0;
    while (true) {
        const s = buffer.indexOf('stream', i);
        if (s < 0) break;
        const dictStart = buffer.lastIndexOf('<<', s);
        const dict = dictStart >= 0 ? buffer.slice(dictStart, s).toString('latin1') : '';
        let p = s + 6;
        if (buffer[p] === 13) p++;
        if (buffer[p] === 10) p++;
        const e = buffer.indexOf('endstream', p);
        if (e < 0) break;
        let data = buffer.slice(p, e);
        if (/FlateDecode/.test(dict)) {
            try { data = zlib.inflateSync(data); } catch (err) { data = null; }
        } else if (/Decode/.test(dict)) {
            data = null; // filtre non gere (image, police, ...)
        }
        if (data) {
            const txt = data.toString('latin1');
            if (/\bTJ\b|\bTj\b/.test(txt)) streams.push(txt);
        }
        i = e + 9;
    }
    return streams;
}

// --- 2. Contenu d'une page --------------------------------------------------

function parsePage(txt) {
    // Blocs de texte : "1 0 0 1 x y Tm ... TJ/Tj ... ET".
    const items = [];
    const blockRe = /1 0 0 1 ([\d.-]+) ([\d.-]+) Tm([\s\S]*?)ET/g;
    let m;
    while ((m = blockRe.exec(txt))) {
        let s = '';
        const showRe = /\[([\s\S]*?)\]\s*TJ|\((.*?)\)\s*Tj/g;
        let t;
        while ((t = showRe.exec(m[3]))) {
            if (t[1] !== undefined) {
                const strRe = /\(((?:\\.|[^\\()])*)\)/g;
                let q;
                while ((q = strRe.exec(t[1]))) s += q[1];
            } else {
                s += t[2];
            }
        }
        s = s.replace(/\\([()\\])/g, '$1');
        if (s !== '') items.push({ x: parseFloat(m[1]), y: parseFloat(m[2]), s });
    }

    // Rectangles pleins. Le suivi de l'etat graphique (q/Q) est indispensable :
    // sans lui la couleur du texte "fuit" sur les cellules dessinees ensuite.
    const toks = txt.split(/\s+/);
    const rects = [];
    const stack = [];
    let gray = 1;
    for (let k = 0; k < toks.length; k++) {
        const t = toks[k];
        if (t === 'q') {
            stack.push(gray);
        } else if (t === 'Q') {
            if (stack.length) gray = stack.pop();
        } else if (t === 'g' && k >= 1) {
            gray = parseFloat(toks[k - 1]);
        } else if (t === 'rg' && k >= 3) {
            const [r, g, b] = toks.slice(k - 3, k).map(Number);
            gray = (r + g + b) / 3;
        } else if (t === 're' && k >= 4 && /^f/.test(toks[k + 1] || '')) {
            const [x, y, w, h] = toks.slice(k - 4, k).map(Number);
            if ([x, y, w, h].every(Number.isFinite) && Number.isFinite(gray)) {
                rects.push({ x, y, w, h, gray });
            }
        }
    }
    return { items, rects };
}

// Gris du dernier rectangle "epais" recouvrant le point : les filets de bordure
// font 0.5 pt et ne doivent pas masquer le fond de la cellule.
function grayAt(rects, x, y) {
    let gray = null;
    for (const r of rects) {
        if (r.h < 6 || r.w < 6) continue;
        const x0 = Math.min(r.x, r.x + r.w), x1 = Math.max(r.x, r.x + r.w);
        const y0 = Math.min(r.y, r.y + r.h), y1 = Math.max(r.y, r.y + r.h);
        if (x >= x0 && x <= x1 && y >= y0 && y <= y1) gray = r.gray;
    }
    return gray;
}

// --- 3. Reconstruction de la grille ----------------------------------------

function rowsByY(items, tolerance) {
    const rows = [];
    for (const it of items) {
        const row = rows.find(r => Math.abs(r.y - it.y) <= tolerance);
        if (row) row.items.push(it);
        else rows.push({ y: it.y, items: [it] });
    }
    return rows;
}

// Le PDF ecrit les libelles glyphe par glyphe, avec un crenage variable : les
// espaces ne sont pas fiables. On expose la ligne caractere par caractere avec
// l'abscisse de chacun, ce qui permet de resituer un motif trouve par regex.
function flattenRow(items) {
    const chars = [];
    for (const it of items.slice().sort((u, v) => u.x - v.x)) {
        for (const ch of it.s) chars.push({ ch, x: it.x });
    }
    return chars;
}

// Recolle les fragments d'une cellule en inserant un espace des que l'ecart
// horizontal trahit une separation.
function joinItems(items) {
    let out = '';
    let prevX = null;
    for (const it of items.slice().sort((u, v) => u.x - v.x)) {
        if (prevX !== null && it.x - prevX > 5) out += ' ';
        out += it.s;
        prevX = it.x;
    }
    return out.replace(/\s+/g, ' ').trim();
}

// Colonnes de la grille, deduites des cellules repetees sur toute la hauteur.
function findColumns(rects) {
    const clusters = [];
    for (const r of rects) {
        if (r.w <= 60 || r.w >= 200 || r.h < 8 || r.h >= 40) continue;
        const c = clusters.find(c2 => Math.abs(c2.x - r.x) < 3 && Math.abs(c2.w - r.w) < 3);
        if (c) c.n++;
        else clusters.push({ x: r.x, w: r.w, n: 1 });
    }
    return clusters.filter(c => c.n >= 10).sort((u, v) => u.x - v.x);
}

const MONTH_RE = new RegExp('(' + Object.keys(MONTHS).join('|') + ')(\\d{2,4})', 'g');

// En-tetes de mois : on cherche "NOMDUMOIS ANNEE" dans chaque ligne, puis on
// rattache l'en-tete a la colonne de cellules qui le contient.
function findMonthColumns(items, columns) {
    const found = [];
    for (const row of rowsByY(items, 2)) {
        const chars = flattenRow(row.items);
        let compact = '';
        const xs = [];
        for (const c of chars) {
            const up = stripAccents(c.ch).toUpperCase();
            if (!/^[A-Z0-9]$/.test(up)) continue;
            compact += up;
            xs.push(c.x);
        }
        MONTH_RE.lastIndex = 0;
        let m;
        while ((m = MONTH_RE.exec(compact))) {
            const column = columns.find(c => xs[m.index] >= c.x - 2 && xs[m.index] <= c.x + c.w + 2);
            if (!column || found.some(f => f.x === column.x)) continue;
            let year = parseInt(m[2], 10);
            if (year < 100) year += 2000;
            found.push({ x: column.x, w: column.w, month: MONTHS[m[1]], year });
        }
    }
    return found.sort((u, v) => u.x - v.x);
}

// Lignes : la colonne des numeros de jour, a gauche de la premiere colonne.
function findDayRows(items, maxX) {
    const digits = items.filter(it => it.x < maxX && /^\d{1,2}$/.test(it.s.trim()));
    const rows = [];
    for (const row of rowsByY(digits, 3)) {
        const day = parseInt(flattenRow(row.items).map(c => c.ch).join(''), 10);
        if (day >= 1 && day <= 31) rows.push({ day, y: row.y });
    }
    return rows.sort((u, v) => v.y - u.y);
}

const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// Ne garde que le libelle d'une cellule : on retire la lettre du jour et les
// codes de classe (6AS, 5M/G, 4P, 3TT...).
function cellLabel(raw) {
    let s = raw.replace(/^\s*[LMJVSD]\b/, ' ');
    s = s.replace(/\b\d[A-Za-zÀ-ÿ]{1,4}(\/[A-Za-zÀ-ÿ]+)?\b/g, ' ');
    s = s.replace(/[+*•]/g, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    s = s.replace(/^[-\s]+|[-\s]+$/g, '');
    return s.length < 3 ? '' : s;
}

function collectDays(buffer) {
    const days = [];
    for (const stream of extractContentStreams(buffer)) {
        const { items, rects } = parsePage(stream);
        const columns = findColumns(rects);
        const cols = findMonthColumns(items, columns);
        if (cols.length === 0) continue;
        const rows = findDayRows(items, cols[0].x - 2);
        if (rows.length === 0) continue;

        for (const col of cols) {
            const daysInMonth = new Date(col.year, col.month, 0).getDate();
            for (const row of rows) {
                if (row.day > daysInMonth) continue;
                const gray = grayAt(rects, col.x + col.w * 0.5, row.y + 4);
                if (gray === null) continue;
                const text = joinItems(items.filter(it =>
                    it.y >= row.y - 3 && it.y <= row.y + 12 &&
                    it.x >= col.x - 2 && it.x < col.x + col.w - 2));
                days.push({
                    date: iso(col.year, col.month, row.day),
                    off: gray > SHADED_MIN && gray < SHADED_MAX,
                    label: cellLabel(text)
                });
            }
        }
    }
    const seen = new Set();
    return days
        .filter(d => (seen.has(d.date) ? false : seen.add(d.date)))
        .sort((u, v) => u.date.localeCompare(v.date));
}

// --- 4. Regroupement en intervalles ----------------------------------------

function isWeekend(isoDate) {
    const d = new Date(`${isoDate}T12:00:00Z`).getUTCDay();
    return d === 0 || d === 6;
}

function nextDay(isoDate) {
    const d = new Date(`${isoDate}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
}

// --- 5. Normalisation des intitules ----------------------------------------
//
// Le PDF ecrit ce qui tient dans la cellule ("Conge", "Vacances", "Conge" +
// "de detente" sur deux lignes...). On rend le vocabulaire officiel de la
// Federation Wallonie-Bruxelles, deja utilise dans les JSON des annees
// precedentes.

const LONG_BREAK_MIN_DAYS = 5;

// Repere par mot-cle, pour les jours feries et les congés nommes dans le PDF.
const CANONICAL_LABELS = [
    [/detente|carnaval/, 'Congé de détente'],
    [/printemps/, 'Vacances de printemps'],
    [/automne|toussaint/, "Congé d'automne"],
    [/hiver|noel/, "Vacances d'hiver"],
    [/\bete\b|grandes? vacances/, "Vacances d'été"],
    [/mardi gras/, 'Mardi gras'],
    [/armistice/, 'Armistice'],
    [/ascension/, 'Ascension'],
    [/pentecote/, 'Lundi de Pentecôte'],
    [/paques/, 'Lundi de Pâques'],
    [/morts/, 'Fête des morts'],
    [/communaute/, 'Fête de la Communauté Française'],
    [/travail|1er mai/, 'Fête du Travail']
];

// Repere par periode, pour les quatre congés legaux : leur cellule ne porte
// souvent qu'un "Conge" ou "Vacances" sans qualificatif.
function longBreakName(dates) {
    const has = (mmdd) => dates.some(d => d.slice(5) === mmdd);
    if (has('12-25') || has('01-01')) return "Vacances d'hiver";
    if (has('11-01') || has('10-31')) return "Congé d'automne";
    const middle = dates[Math.floor(dates.length / 2)];
    const month = parseInt(middle.slice(5, 7), 10);
    if (month === 2 || month === 3) return 'Congé de détente';
    if (month === 4 || month === 5) return 'Vacances de printemps';
    if (month === 7 || month === 8) return "Vacances d'été";
    return null;
}

function nameFor(group) {
    const dates = group.map(d => d.date);

    // Un bloc de deux semaines est forcement l'un des congés legaux : la
    // periode est un indice plus fiable que le texte de la cellule.
    if (group.length >= LONG_BREAK_MIN_DAYS) {
        const byPeriod = longBreakName(dates);
        if (byPeriod) return byPeriod;
    }

    const labels = [];
    for (const d of group) {
        if (d.label && !labels.includes(d.label)) labels.push(d.label);
    }
    const raw = stripAccents(labels.join(' ')).toLowerCase();
    for (const [pattern, name] of CANONICAL_LABELS) {
        if (pattern.test(raw)) return name;
    }

    // Intitule inconnu : on garde le texte du PDF plutot que de le perdre. Un
    // fragment qui commence en minuscule est la suite du precedent, le PDF
    // ecrivant "Conge" / "de detente" sur deux lignes d'une cellule fusionnee.
    if (!labels.length) return 'Congé';
    return labels.reduce((acc, label, i) =>
        i === 0 ? label : acc + (/^[a-zà-ÿ]/.test(label) ? ' ' : ' - ') + label, '');
}

function buildHolidays(days) {
    const holidays = [];
    let group = [];
    const flush = () => {
        // Un groupe uniquement compose d'un week-end n'est pas un conge.
        if (group.length && !group.every(d => isWeekend(d.date))) {
            holidays.push({
                name: nameFor(group),
                start: group[0].date,
                end: group[group.length - 1].date
            });
        }
        group = [];
    };
    for (const d of days) {
        if (!d.off) { flush(); continue; }
        if (group.length && nextDay(group[group.length - 1].date) !== d.date) flush();
        group.push(d);
    }
    flush();
    return holidays;
}

/**
 * @param {Buffer} buffer contenu du PDF du calendrier scolaire
 * @returns {Array<{name: string, start: string, end: string}>}
 */
function parseHolidaysPdf(buffer) {
    const days = collectDays(buffer);
    if (days.length < 200) {
        throw new Error('Calendrier illisible : la grille des mois n’a pas ete trouvee dans le PDF.');
    }
    const holidays = buildHolidays(days);
    if (holidays.length === 0) {
        throw new Error('Aucun conge detecte dans le PDF.');
    }
    return holidays;
}

module.exports = { parseHolidaysPdf, collectDays };
