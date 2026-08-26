// server/src/utils/schedulePdfParser.js
//
// Extraction d'un emploi du temps depuis le PDF hebdomadaire exporte par
// Index Education (EDT / Hyperplanning) - celui que l'ecole distribue aux
// professeurs. Le PDF est une grille : une colonne par jour, une ligne par
// periode, et chaque cours est un rectangle colore contenant trois lignes de
// texte (matiere / classe / local).
//
// Comme pour holidaysPdfParser, on lit directement les flux de contenu : zlib
// est natif et aucune dependance n'est ajoutee. Deux differences importantes
// avec le calendrier des conges :
//   1. ces PDF sont *chiffres* (RC4, mot de passe utilisateur vide) - il faut
//      donc dechiffrer chaque flux avant de le decompresser ;
//   2. le texte n'est pas positionne par des `Tm` successifs mais glyphe par
//      glyphe avec des `Td` relatifs, sous une matrice `cm` d'echelle - il faut
//      un vrai interpreteur d'etat graphique et textuel.

const zlib = require('zlib');
const crypto = require('crypto');

const WEEKDAYS = {
    LUNDI: 1, MARDI: 2, MERCREDI: 3, JEUDI: 4, VENDREDI: 5, SAMEDI: 6, DIMANCHE: 7
};

const stripAccents = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

// ---------------------------------------------------------------------------
// 1. Dechiffrement (gestionnaire de securite standard, mot de passe vide)
// ---------------------------------------------------------------------------

const PAD = Buffer.from([
    0x28, 0xBF, 0x4E, 0x5E, 0x4E, 0x75, 0x8A, 0x41, 0x64, 0x00, 0x4E, 0x56,
    0xFF, 0xFA, 0x01, 0x08, 0x2E, 0x2E, 0x00, 0xB6, 0xD0, 0x68, 0x3E, 0x80,
    0x2F, 0x0C, 0xA9, 0xFE, 0x64, 0x53, 0x69, 0x7A
]);

function rc4(key, data) {
    const S = new Uint8Array(256);
    for (let i = 0; i < 256; i++) S[i] = i;
    for (let i = 0, j = 0; i < 256; i++) {
        j = (j + S[i] + key[i % key.length]) & 255;
        const t = S[i]; S[i] = S[j]; S[j] = t;
    }
    const out = Buffer.allocUnsafe(data.length);
    for (let c = 0, i = 0, j = 0; c < data.length; c++) {
        i = (i + 1) & 255;
        j = (j + S[i]) & 255;
        const t = S[i]; S[i] = S[j]; S[j] = t;
        out[c] = data[c] ^ S[(S[i] + S[j]) & 255];
    }
    return out;
}

// Renvoie null si le document n'est pas chiffre, sinon une fonction
// (data, objNum, objGen) -> data en clair.
function buildDecryptor(raw) {
    const trailer = raw.slice(Math.max(0, raw.length - 4096));
    if (!/\/Encrypt/.test(trailer) && !/\/Encrypt/.test(raw)) return null;

    const num = (re) => { const m = re.exec(raw); return m ? parseInt(m[1], 10) : null; };
    const V = num(/\/V\s+(\d+)/) || 0;
    const R = num(/\/R\s+(\d+)/) || 0;
    const P = (() => { const m = /\/P\s+(-?\d+)/.exec(raw); return m ? parseInt(m[1], 10) : 0; })();
    const length = num(/\/Length\s+(\d+)\s*(?:\/|>)/) || 40;
    const oMatch = /\/O\s*<([0-9a-fA-F]+)>/.exec(raw) || /\/O\s*\(((?:\\.|[^\\)])*)\)/.exec(raw);
    const idMatch = /\/ID\s*\[\s*<([0-9a-fA-F]+)>/.exec(raw);

    if (!oMatch || !idMatch) throw new Error('PDF chiffre illisible (entree /Encrypt incomplete).');
    if (V > 4 || R > 4) {
        throw new Error('PDF protege par un chiffrement AES-256 non supporte. Exportez-le sans mot de passe.');
    }

    const O = oMatch[1].length && /^[0-9a-fA-F]+$/.test(oMatch[1])
        ? Buffer.from(oMatch[1], 'hex')
        : Buffer.from(oMatch[1], 'latin1');
    const ID = Buffer.from(idMatch[1], 'hex');
    const isAes = /\/AESV2/.test(raw);
    const n = V === 1 ? 5 : Math.max(5, Math.min(16, length / 8));

    const pb = Buffer.alloc(4);
    pb.writeInt32LE(P, 0);
    const parts = [PAD, O, pb, ID];
    if (R >= 4 && /\/EncryptMetadata\s+false/.test(raw)) parts.push(Buffer.from([255, 255, 255, 255]));

    let key = crypto.createHash('md5').update(Buffer.concat(parts)).digest();
    if (R >= 3) {
        for (let i = 0; i < 50; i++) key = crypto.createHash('md5').update(key.subarray(0, n)).digest();
    }
    key = key.subarray(0, n);

    return (data, objNum, objGen) => {
        const ext = Buffer.alloc(5);
        ext.writeUIntLE(objNum, 0, 3);
        ext.writeUIntLE(objGen, 3, 2);
        const salt = isAes ? Buffer.from([0x73, 0x41, 0x6C, 0x54]) : Buffer.alloc(0);
        const objKey = crypto.createHash('md5')
            .update(Buffer.concat([key, ext, salt]))
            .digest()
            .subarray(0, Math.min(n + 5, 16));
        if (!isAes) return rc4(objKey, data);
        const iv = data.subarray(0, 16);
        const decipher = crypto.createDecipheriv('aes-128-cbc', objKey, iv);
        decipher.setAutoPadding(true);
        return Buffer.concat([decipher.update(data.subarray(16)), decipher.final()]);
    };
}

// ---------------------------------------------------------------------------
// 2. Flux de contenu
// ---------------------------------------------------------------------------

function extractContentStreams(buffer) {
    const raw = buffer.toString('latin1');
    const decrypt = buildDecryptor(raw);
    const streams = [];

    const objRe = /(\d+)\s+(\d+)\s+obj\b/g;
    let m;
    while ((m = objRe.exec(raw))) {
        const after = objRe.lastIndex;
        const streamKw = raw.indexOf('stream', after);
        const endObj = raw.indexOf('endobj', after);
        if (streamKw < 0) break;
        if (endObj >= 0 && streamKw > endObj) continue;

        const dict = raw.slice(after, streamKw);
        let p = streamKw + 'stream'.length;
        if (buffer[p] === 0x0d) p++;
        if (buffer[p] === 0x0a) p++;
        const end = raw.indexOf('endstream', p);
        if (end < 0) break;

        let data = buffer.subarray(p, end);
        objRe.lastIndex = end;

        try {
            if (decrypt) data = decrypt(data, parseInt(m[1], 10), parseInt(m[2], 10));
            if (/FlateDecode/.test(dict)) data = zlib.inflateSync(data);
            else if (/\/Filter/.test(dict)) continue; // image, police, ... : hors sujet
        } catch (err) {
            continue;
        }

        const txt = data.toString('latin1');
        if (/\bT[jJ]\b/.test(txt)) streams.push(txt);
    }

    if (streams.length === 0) {
        throw new Error("Aucun contenu texte lisible dans ce PDF (il est peut-etre scanne ou protege).");
    }
    return streams;
}

// ---------------------------------------------------------------------------
// 3. Interpretation d'un flux : rectangles pleins, segments, glyphes
// ---------------------------------------------------------------------------

const WS = ' \t\r\n\f\0';
const DELIM = '()<>[]{}/%';

function tokenize(txt) {
    const toks = [];
    let i = 0;
    const n = txt.length;
    while (i < n) {
        const c = txt[i];
        if (WS.includes(c)) { i++; continue; }
        if (c === '%') { while (i < n && txt[i] !== '\n' && txt[i] !== '\r') i++; continue; }

        if (c === '(') {
            let depth = 1, j = i + 1, s = '';
            while (j < n && depth > 0) {
                const ch = txt[j];
                if (ch === '\\') {
                    const e = txt[j + 1];
                    if (e >= '0' && e <= '7') {
                        let oct = '';
                        let k = j + 1;
                        while (k < n && oct.length < 3 && txt[k] >= '0' && txt[k] <= '7') oct += txt[k++];
                        s += String.fromCharCode(parseInt(oct, 8) & 255);
                        j = k;
                        continue;
                    }
                    const map = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' };
                    if (e === '\n' || e === '\r') { j += (e === '\r' && txt[j + 2] === '\n') ? 3 : 2; continue; }
                    s += map[e] !== undefined ? map[e] : e;
                    j += 2;
                    continue;
                }
                if (ch === '(') depth++;
                else if (ch === ')') { depth--; if (depth === 0) { j++; break; } }
                s += ch;
                j++;
            }
            toks.push({ t: 'str', v: s });
            i = j;
            continue;
        }

        if (c === '<' && txt[i + 1] !== '<') {
            const j = txt.indexOf('>', i);
            const hex = txt.slice(i + 1, j < 0 ? n : j).replace(/[^0-9a-fA-F]/g, '');
            let s = '';
            for (let k = 0; k + 1 < hex.length + 1; k += 2) {
                const pair = (hex.substr(k, 2) + '0').slice(0, 2);
                if (!pair.trim()) break;
                s += String.fromCharCode(parseInt(pair, 16));
            }
            toks.push({ t: 'str', v: s });
            i = (j < 0 ? n : j + 1);
            continue;
        }

        if (c === '<' || c === '>') { toks.push({ t: 'op', v: txt.substr(i, 2) }); i += 2; continue; }
        if (c === '[' || c === ']' || c === '{' || c === '}') { toks.push({ t: c }); i++; continue; }

        if (c === '/') {
            let j = i + 1;
            while (j < n && !WS.includes(txt[j]) && !DELIM.includes(txt[j])) j++;
            toks.push({ t: 'name', v: txt.slice(i + 1, j) });
            i = j;
            continue;
        }

        let j = i;
        while (j < n && !WS.includes(txt[j]) && !DELIM.includes(txt[j])) j++;
        const word = txt.slice(i, j);
        i = j === i ? i + 1 : j;
        if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word)) toks.push({ t: 'num', v: parseFloat(word) });
        else toks.push({ t: 'op', v: word });
    }
    return toks;
}

const mul = (m1, m2) => [
    m1[0] * m2[0] + m1[1] * m2[2],
    m1[0] * m2[1] + m1[1] * m2[3],
    m1[2] * m2[0] + m1[3] * m2[2],
    m1[2] * m2[1] + m1[3] * m2[3],
    m1[4] * m2[0] + m1[5] * m2[2] + m2[4],
    m1[4] * m2[1] + m1[5] * m2[3] + m2[5]
];
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const scaleOf = (m) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;

const toHex = (rgb) => '#' + rgb
    .map(v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0'))
    .join('');

function runContentStream(txt) {
    const toks = tokenize(txt);
    const rects = [];     // rectangles pleins
    const segs = [];      // segments traces
    const glyphs = [];    // { x, y, size, font, ch }

    let ctm = [1, 0, 0, 1, 0, 0];
    let fill = [0, 0, 0];
    const gsStack = [];

    let tm = [1, 0, 0, 1, 0, 0];
    let tlm = [1, 0, 0, 1, 0, 0];
    let leading = 0;
    let fontSize = 0;
    let fontName = '';

    let pathRects = [];
    let pathPts = [];
    let cur = null;
    let start = null;

    const stack = [];
    const nums = (k) => stack.slice(-k).map(o => (o && o.t === 'num' ? o.v : NaN));

    const showText = (s) => {
        const [x, y] = apply(mul(tm, ctm), 0, 0);
        const size = fontSize * scaleOf(mul(tm, ctm));
        for (const ch of s) glyphs.push({ x, y, size, font: fontName, ch });
    };

    for (const tk of toks) {
        if (tk.t !== 'op') { stack.push(tk); if (stack.length > 64) stack.shift(); continue; }
        const op = tk.v;
        switch (op) {
            case 'q': gsStack.push({ ctm, fill }); break;
            case 'Q': { const g = gsStack.pop(); if (g) { ctm = g.ctm; fill = g.fill; } break; }
            case 'cm': { const [a, b, c, d, e, f] = nums(6); if ([a, b, c, d, e, f].every(Number.isFinite)) ctm = mul([a, b, c, d, e, f], ctm); break; }
            case 'g': { const [v] = nums(1); if (Number.isFinite(v)) fill = [v, v, v]; break; }
            case 'rg': { const [r, gg, b] = nums(3); if ([r, gg, b].every(Number.isFinite)) fill = [r, gg, b]; break; }
            case 'k': { const [c, mm, yy, kk] = nums(4); if ([c, mm, yy, kk].every(Number.isFinite)) fill = [(1 - c) * (1 - kk), (1 - mm) * (1 - kk), (1 - yy) * (1 - kk)]; break; }
            case 'sc': case 'scn': {
                const vals = stack.filter(o => o.t === 'num').slice(-4).map(o => o.v);
                if (vals.length >= 3) fill = vals.slice(-3);
                else if (vals.length === 1) fill = [vals[0], vals[0], vals[0]];
                break;
            }
            case 're': {
                const [x, y, w, h] = nums(4);
                if ([x, y, w, h].every(Number.isFinite)) {
                    const p = [apply(ctm, x, y), apply(ctm, x + w, y), apply(ctm, x + w, y + h), apply(ctm, x, y + h)];
                    const xs = p.map(q => q[0]), ys = p.map(q => q[1]);
                    pathRects.push({ x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) });
                }
                cur = null;
                break;
            }
            case 'm': { const [x, y] = nums(2); if ([x, y].every(Number.isFinite)) { cur = apply(ctm, x, y); start = cur; } break; }
            case 'l': { const [x, y] = nums(2); if ([x, y].every(Number.isFinite)) { const p = apply(ctm, x, y); if (cur) pathPts.push([cur, p]); cur = p; } break; }
            case 'h': if (cur && start) { pathPts.push([cur, start]); cur = start; } break;
            case 'f': case 'F': case 'f*': case 'b': case 'b*': case 'B': case 'B*':
                for (const r of pathRects) rects.push({ ...r, color: fill.slice() });
                if (op[0] === 'b' || op[0] === 'B') segs.push(...pathPts);
                pathRects = []; pathPts = []; cur = null;
                break;
            case 'S': case 's':
                segs.push(...pathPts);
                for (const r of pathRects) {
                    segs.push([[r.x0, r.y0], [r.x1, r.y0]], [[r.x1, r.y0], [r.x1, r.y1]],
                        [[r.x1, r.y1], [r.x0, r.y1]], [[r.x0, r.y1], [r.x0, r.y0]]);
                }
                pathRects = []; pathPts = []; cur = null;
                break;
            case 'n': case 'W': case 'W*':
                if (op === 'n') { pathRects = []; pathPts = []; cur = null; }
                break;
            case 'BT': tm = [1, 0, 0, 1, 0, 0]; tlm = tm; break;
            case 'ET': break;
            case 'Tf': { const [sz] = nums(1); const nm = stack.filter(o => o.t === 'name').pop(); if (Number.isFinite(sz)) fontSize = sz; if (nm) fontName = nm.v; break; }
            case 'TL': { const [v] = nums(1); if (Number.isFinite(v)) leading = v; break; }
            case 'Tm': { const [a, b, c, d, e, f] = nums(6); if ([a, b, c, d, e, f].every(Number.isFinite)) { tlm = [a, b, c, d, e, f]; tm = tlm; } break; }
            case 'Td': { const [tx, ty] = nums(2); if ([tx, ty].every(Number.isFinite)) { tlm = mul([1, 0, 0, 1, tx, ty], tlm); tm = tlm; } break; }
            case 'TD': { const [tx, ty] = nums(2); if ([tx, ty].every(Number.isFinite)) { leading = -ty; tlm = mul([1, 0, 0, 1, tx, ty], tlm); tm = tlm; } break; }
            case 'T*': tlm = mul([1, 0, 0, 1, 0, -leading], tlm); tm = tlm; break;
            case 'Tj': { const s = stack.filter(o => o.t === 'str').pop(); if (s) showText(s.v); break; }
            case "'": case '"': { const s = stack.filter(o => o.t === 'str').pop(); tlm = mul([1, 0, 0, 1, 0, -leading], tlm); tm = tlm; if (s) showText(s.v); break; }
            case 'TJ': {
                // Tableau [ (txt) -kern (txt) ... ] : on ne connait pas les largeurs
                // de glyphes, on se contente de convertir les grands ecarts en espace.
                const openIdx = (() => { for (let k = stack.length - 1; k >= 0; k--) if (stack[k].t === '[') return k; return -1; })();
                if (openIdx >= 0) {
                    let s = '';
                    for (const o of stack.slice(openIdx + 1)) {
                        if (o.t === 'str') s += o.v;
                        else if (o.t === 'num' && o.v < -180) s += ' ';
                    }
                    if (s) showText(s);
                }
                break;
            }
            default: break;
        }
        if (tk.t === 'op') stack.length = 0;
    }

    return { rects, segs, glyphs };
}

// ---------------------------------------------------------------------------
// 4. Regroupement des glyphes en zones de texte
// ---------------------------------------------------------------------------

function buildTextItems(glyphs) {
    // Certains libelles sont traces deux fois (avant puis apres le fond
    // blanc) : sans ce filtre on obtiendrait "MMmmee DDEEGG...".
    const drawn = new Set();
    const unique = glyphs.filter(g => {
        const key = `${g.x.toFixed(2)}|${g.y.toFixed(2)}|${g.ch}`;
        if (drawn.has(key)) return false;
        drawn.add(key);
        return true;
    });

    const lines = [];
    for (const g of unique.sort((a, b) => b.y - a.y || a.x - b.x)) {
        const line = lines.find(l => Math.abs(l.y - g.y) <= Math.max(0.6, g.size * 0.25));
        if (line) line.g.push(g);
        else lines.push({ y: g.y, g: [g] });
    }

    const items = [];
    for (const line of lines) {
        line.g.sort((a, b) => a.x - b.x);
        let curItem = null;
        let prev = null;
        for (const g of line.g) {
            const gap = prev ? g.x - prev.x : 0;
            const em = g.size || 1;
            if (!curItem || gap > em * 3) {
                curItem = { x0: g.x, x1: g.x, y: line.y, size: g.size, font: g.font, s: '' };
                items.push(curItem);
            } else if (gap > em * 1.2 && !curItem.s.endsWith(' ')) {
                curItem.s += ' ';
            }
            curItem.s += g.ch;
            curItem.x1 = g.x + em * 0.6;
            prev = g;
        }
    }

    return items
        .map(it => ({ ...it, s: it.s.replace(/\s+/g, ' ').trim() }))
        .filter(it => it.s.length > 0);
}

// Le titre est parfois dessine deux fois (avant puis apres le fond blanc).
function dedupe(items) {
    const seen = new Set();
    return items.filter(it => {
        const key = `${it.s}|${it.x0.toFixed(1)}|${it.y.toFixed(1)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

// ---------------------------------------------------------------------------
// 5. Lecture de la grille
// ---------------------------------------------------------------------------

const EPS = 1.2;
const near = (a, b, eps = EPS) => Math.abs(a - b) <= eps;

function cluster(values, eps = EPS) {
    const out = [];
    for (const v of values.slice().sort((a, b) => a - b)) {
        const last = out[out.length - 1];
        if (last && Math.abs(last.sum / last.n - v) <= eps) { last.sum += v; last.n++; }
        else out.push({ sum: v, n: 1 });
    }
    return out.map(c => c.sum / c.n);
}

const parseTime = (s) => {
    const m = /^(\d{1,2})\s*[h:.]\s*(\d{2})$/i.exec(s.trim());
    if (!m) return null;
    const h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    if (h > 23 || min > 59) return null;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

function parsePage(streamTxt) {
    const { rects, segs, glyphs } = runContentStream(streamTxt);
    const items = dedupe(buildTextItems(glyphs));

    // --- Colonnes : les traits verticaux les plus longs de la page. -------
    const verticals = segs
        .filter(([a, b]) => near(a[0], b[0], 0.6) && Math.abs(a[1] - b[1]) > 1)
        .map(([a, b]) => ({ x: (a[0] + b[0]) / 2, len: Math.abs(a[1] - b[1]), y0: Math.min(a[1], b[1]), y1: Math.max(a[1], b[1]) }));
    if (!verticals.length) throw new Error("Grille introuvable : ce PDF n'a pas la forme d'un emploi du temps.");

    const maxLen = Math.max(...verticals.map(v => v.len));
    const frame = verticals.filter(v => v.len > maxLen * 0.8);
    const colBounds = cluster(frame.map(v => v.x));
    if (colBounds.length < 3) throw new Error("Grille introuvable : moins de deux colonnes de jours detectees.");

    const gridTop = Math.max(...frame.map(v => v.y1));
    const gridBottom = Math.min(...frame.map(v => v.y0));
    const gridLeft = colBounds[0];
    const gridRight = colBounds[colBounds.length - 1];

    // --- Lignes : tous les traits horizontaux a l'interieur du cadre. -----
    const horizontals = segs
        .filter(([a, b]) => near(a[1], b[1], 0.6) && Math.abs(a[0] - b[0]) > 1)
        .map(([a, b]) => (a[1] + b[1]) / 2)
        .filter(y => y >= gridBottom - EPS && y <= gridTop + EPS);
    const rowBounds = cluster(horizontals).sort((a, b) => b - a); // du haut vers le bas
    if (rowBounds.length < 2) throw new Error("Grille introuvable : aucune ligne horaire detectee.");

    const rows = [];
    for (let i = 0; i < rowBounds.length - 1; i++) rows.push({ top: rowBounds[i], bottom: rowBounds[i + 1] });

    // --- Jours : les intitules places au-dessus de la grille. -------------
    const days = colBounds.slice(0, -1).map((left, i) => ({
        left, right: colBounds[i + 1], index: null, label: null
    }));
    for (const it of items) {
        if (it.y < gridTop) continue;
        const key = stripAccents(it.s).toUpperCase().replace(/[^A-Z]/g, '');
        if (!WEEKDAYS[key]) continue;
        const cx = (it.x0 + it.x1) / 2;
        const col = days.find(d => cx >= d.left - EPS && cx <= d.right + EPS);
        if (col && col.index === null) { col.index = WEEKDAYS[key]; col.label = it.s; }
    }
    // Repli : colonnes non nommees = jours consecutifs a partir de lundi.
    days.forEach((d, i) => {
        if (d.index === null) { d.index = i + 1; d.label = Object.keys(WEEKDAYS)[i] || `Jour ${i + 1}`; }
    });

    // --- Heures : les libelles a gauche de la grille. ---------------------
    const rowHeight = rows.length ? (gridTop - gridBottom) / rows.length : 1;
    const starts = new Array(rows.length).fill(null);
    const ends = new Array(rows.length).fill(null);
    for (const it of items) {
        if (it.x1 > gridLeft + EPS) continue;
        const time = parseTime(it.s);
        if (!time) continue;
        let best = -1, bestD = Infinity;
        rowBounds.forEach((y, i) => { const d = Math.abs(y - it.y); if (d < bestD) { bestD = d; best = i; } });
        if (best < 0 || bestD > rowHeight * 0.5) continue;
        if (it.y < rowBounds[best]) { if (best < rows.length) starts[best] = time; }
        else if (best > 0) ends[best - 1] = time;
    }

    const periods = rows.map((r, i) => {
        const start = starts[i];
        const end = ends[i] || starts[i + 1] || null;
        return { start, end, top: r.top, bottom: r.bottom };
    });

    // --- Cours : rectangles pleins alignes sur la grille. -----------------
    const colWidth = (gridRight - gridLeft) / (colBounds.length - 1);
    const courses = [];
    for (const r of rects) {
        const w = r.x1 - r.x0;
        const h = r.y1 - r.y0;
        if (w > colWidth * 1.5 || w < colWidth * 0.5) continue;
        if (h < rowHeight * 0.5) continue;
        if (r.y1 > gridTop + EPS || r.y0 < gridBottom - EPS) continue;

        const day = days.find(d => near(d.left, r.x0, colWidth * 0.25) && near(d.right, r.x1, colWidth * 0.25));
        if (!day) continue;

        const covered = periods
            .map((p, i) => ({ p, i }))
            .filter(({ p }) => Math.min(p.top, r.y1) - Math.max(p.bottom, r.y0) > rowHeight * 0.5);
        if (!covered.length) continue;

        const inside = items
            .filter(it => it.y > r.y0 && it.y < r.y1 && (it.x0 + it.x1) / 2 > r.x0 - EPS && (it.x0 + it.x1) / 2 < r.x1 + EPS)
            .sort((a, b) => b.y - a.y || a.x0 - b.x0);
        if (!inside.length) continue;

        // Une ligne de texte par role : matiere, classe, local.
        const linesTxt = [];
        for (const it of inside) {
            const last = linesTxt[linesTxt.length - 1];
            if (last && near(last.y, it.y, 1)) last.s += ' ' + it.s;
            else linesTxt.push({ y: it.y, s: it.s });
        }

        courses.push({
            day: day.index,
            dayLabel: day.label,
            periodIndexes: covered.map(c => c.i),
            subject: (linesTxt[0] && linesTxt[0].s) || '',
            className: (linesTxt[1] && linesTxt[1].s) || '',
            room: (linesTxt[2] && linesTxt[2].s) || '',
            color: toHex(r.color)
        });
    }

    // --- Entete : professeur, ecole, date d'edition. ----------------------
    // Au-dessus de la grille : une ligne "ecole ... date d'edition" tout en
    // haut, puis le nom du professeur juste au-dessus des jours.
    const dayKeys = new Set(days.map(d => d.label && stripAccents(d.label).toUpperCase()));
    const headerLines = [];
    for (const it of items) {
        if (it.y <= gridTop + 1) continue;
        if (dayKeys.has(stripAccents(it.s).toUpperCase())) continue;
        const line = headerLines.find(l => near(l.y, it.y, 1));
        if (line) line.parts.push(it);
        else headerLines.push({ y: it.y, parts: [it] });
    }
    headerLines.sort((a, b) => b.y - a.y);

    let teacher = null, school = null, generatedAt = null;
    headerLines.forEach((line, i) => {
        const text = line.parts.sort((a, b) => a.x0 - b.x0).map(p => p.s).join(' ');
        const dm = /(\d{2})[-/](\d{2})[-/](\d{4})/.exec(text);
        if (dm && !generatedAt) generatedAt = `${dm[3]}-${dm[2]}-${dm[1]}`;
        const clean = (dm ? text.slice(0, dm.index) : text).replace(/[-\s]+$/, '').trim();
        if (!clean) return;
        if (i === 0 && headerLines.length > 1) school = clean;
        else if (!teacher) teacher = clean;
    });

    return { teacher, school, generatedAt, days, periods, courses };
}

// ---------------------------------------------------------------------------
// 6. Point d'entree
// ---------------------------------------------------------------------------

function parseSchedulePdf(buffer) {
    const streams = extractContentStreams(buffer);
    const warnings = [];
    const pages = [];
    for (const txt of streams) {
        try { pages.push(parsePage(txt)); }
        catch (err) { warnings.push(err.message); }
    }
    if (!pages.length) {
        throw new Error(warnings[0] || "Aucune grille d'emploi du temps trouvee dans ce PDF.");
    }

    const base = pages[0];

    // Creneaux horaires : union de toutes les pages, du plus tot au plus tard.
    const periodKey = new Map();
    for (const page of pages) {
        for (const p of page.periods) {
            if (!p.start || !p.end) continue;
            periodKey.set(`${p.start}-${p.end}`, { start: p.start, end: p.end });
        }
    }
    const periods = [...periodKey.values()].sort((a, b) => a.start.localeCompare(b.start));
    if (!periods.length) throw new Error("Aucun creneau horaire lisible dans ce PDF.");

    const slots = [];
    const taken = new Set();
    for (const page of pages) {
        for (const c of page.courses) {
            for (const i of c.periodIndexes) {
                const p = page.periods[i];
                if (!p || !p.start || !p.end) continue;
                const libelle = `${p.start}-${p.end}`;
                const key = `${c.day}|${libelle}`;
                if (taken.has(key)) {
                    warnings.push(`Deux cours occupent ${c.dayLabel} ${libelle} : "${c.subject} ${c.className}" a ete ignore.`);
                    continue;
                }
                taken.add(key);
                slots.push({
                    day: c.day,
                    dayLabel: c.dayLabel,
                    libelle,
                    subject: c.subject,
                    className: c.className,
                    room: c.room,
                    color: c.color
                });
            }
        }
    }

    if (!slots.length) throw new Error("Aucun cours n'a pu etre lu dans cet emploi du temps.");

    slots.sort((a, b) => a.day - b.day || a.libelle.localeCompare(b.libelle));

    const days = [];
    for (const page of pages) {
        for (const d of page.days) {
            if (!days.some(x => x.index === d.index)) days.push({ index: d.index, label: d.label });
        }
    }
    days.sort((a, b) => a.index - b.index);

    for (const p of base.periods) {
        if (!p.start || !p.end) warnings.push('Un creneau horaire de la grille est illisible et a ete ignore.');
    }

    return {
        teacher: base.teacher,
        school: base.school,
        generatedAt: base.generatedAt,
        pageCount: pages.length,
        days,
        periods: periods.map(p => ({ libelle: `${p.start}-${p.end}`, start: p.start, end: p.end })),
        slots,
        warnings
    };
}

module.exports = { parseSchedulePdf };
