import jsPDF from 'jspdf';

/* ============================================================================
 *  Export PDF des grilles de cotation - rendu vectoriel (texte)
 *  ---------------------------------------------------------------------------
 *  Remplace l'ancien rendu html2canvas (une image plein-page par page) :
 *   - plus rien n'est tronque ni ecrase : la pagination se fait ligne par ligne
 *   - le fichier passe de ~15-40 Mo a ~100 Ko => telechargement immediat
 *     (jsPDF revoque l'URL du blob apres 40 s : au-dela, Chrome/Arc n'a pas
 *      fini l'analyse du fichier et le telechargement reste bloque)
 *   - le texte est selectionnable et cherchable dans le PDF
 * ========================================================================== */

// --- Geometrie de la page (mm) ---
const PAGE = { w: 210, h: 297 };
const MARGIN = { left: 12, right: 12 };
const CONTENT_W = PAGE.w - MARGIN.left - MARGIN.right; // 186
const BOTTOM_LIMIT = PAGE.h - 16;                      // rien n'est ecrit en dessous
const ROW_PAD = 2.2;                                   // marge interne d'une ligne du tableau
const MIN_ROW_SPACE = 20;                              // place minimale pour demarrer une ligne

const COL = {
    crit: { x: MARGIN.left, w: 60 },
    note: { x: 74, w: 24 },
    com: { x: 102, w: 96 },
};

// --- Palette (alignee sur l'interface) ---
const C = {
    brandFrom: [98, 151, 241],
    brandTo: [6, 182, 212],
    slate900: [15, 23, 42],
    slate700: [51, 65, 85],
    slate500: [100, 116, 139],
    slate400: [148, 163, 184],
    slate300: [203, 213, 225],
    slate200: [226, 232, 240],
    slate100: [241, 245, 249],
    slate50: [248, 250, 252],
    white: [255, 255, 255],
    codeBg: [232, 247, 251],
    codeText: [14, 116, 144],
    titleBlue: [37, 99, 235],
    red: [220, 38, 38],
    redLight: [255, 107, 107],
    green: [21, 128, 61],
    greenLight: [81, 207, 102],
    orange: [180, 83, 9],
    orangeLight: [255, 212, 59],
    bilanTitle: [147, 197, 253],
    bilanCode: [125, 211, 252],
};

// --- Styles de texte des commentaires ---
const STYLE = {
    text: { font: ['helvetica', 'normal'], size: 8, lh: 3.6, color: C.slate700 },
    title: { font: ['helvetica', 'bold'], size: 8.5, lh: 4.3, color: C.titleBlue },
    code: { font: ['courier', 'normal'], size: 7.5, lh: 4.1, color: C.codeText },
    space: { font: ['helvetica', 'normal'], size: 8, lh: 1.6, color: C.slate700 },
};

// --- Utilitaires de donnees ---
const toNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : null;
};

const formatNumber = (value, fallback = '0') => {
    const n = toNumber(value);
    if (n === null) return fallback;
    return String(Math.round(n * 100) / 100);
};

const formatDate = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('fr-FR');
};

const slugify = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

// --- Analyse du mini-langage des commentaires (#titre, //code, bloc /* */) ---
const parseComment = (text) => {
    if (!text) return [];
    const segments = [];
    const parts = String(text).split(/(\/\*[\s\S]*?\*\/)/g).filter(Boolean);

    parts.forEach((part) => {
        if (part.startsWith('/*') && part.endsWith('*/')) {
            part.substring(2, part.length - 2).split('\n').forEach((line) => {
                if (line.trim() !== '') segments.push({ style: 'code', text: line.trim() });
            });
            return;
        }
        part.split('\n').forEach((line) => {
            const trimmed = line.trim();
            if (trimmed === '') {
                if (segments.length && segments[segments.length - 1].style !== 'space') {
                    segments.push({ style: 'space', text: '' });
                }
                return;
            }
            if (trimmed.startsWith('#')) segments.push({ style: 'title', text: trimmed.substring(1).trim() });
            else if (trimmed.startsWith('//')) segments.push({ style: 'code', text: trimmed });
            else segments.push({ style: 'text', text: trimmed });
        });
    });

    while (segments.length && segments[segments.length - 1].style === 'space') segments.pop();
    return segments;
};

// Coupe les mots plus larges que la colonne (URLs, code sans espace)
const breakLongWords = (pdf, text, width) => String(text).split(/\s+/).map((word) => {
    if (!word || pdf.getTextWidth(word) <= width) return word;
    let out = '';
    let current = '';
    for (const char of word) {
        if (current && pdf.getTextWidth(current + char) > width) {
            out += `${current} `;
            current = char;
        } else {
            current += char;
        }
    }
    return out + current;
}).join(' ');

// Transforme des segments en lignes pretes a dessiner (largeur fixe)
const layoutSegments = (pdf, segments, width) => {
    const lines = [];
    segments.forEach((segment) => {
        const style = STYLE[segment.style];
        if (segment.style === 'space') {
            lines.push({ style: 'space', text: '' });
            return;
        }
        pdf.setFont(...style.font);
        pdf.setFontSize(style.size);
        pdf.splitTextToSize(breakLongWords(pdf, segment.text, width), width)
            .forEach((line) => lines.push({ style: segment.style, text: line }));
    });
    return lines;
};

const linesHeight = (lines) => lines.reduce((sum, line) => sum + STYLE[line.style].lh, 0);

// Dessine des lignes deja mises en page, retourne le y final
const drawLines = (pdf, lines, x, y, width) => {
    let cursor = y;
    lines.forEach((line) => {
        const style = STYLE[line.style];
        if (line.style !== 'space' && line.text) {
            pdf.setFont(...style.font);
            pdf.setFontSize(style.size);
            if (line.style === 'code') {
                const boxWidth = Math.min(width, pdf.getTextWidth(line.text) + 2);
                pdf.setFillColor(...C.codeBg);
                pdf.roundedRect(x - 0.8, cursor + 0.2, boxWidth + 1.6, style.lh - 0.5, 0.6, 0.6, 'F');
            }
            pdf.setTextColor(...style.color);
            pdf.text(line.text, x, cursor + style.lh - 1.1);
        }
        cursor += style.lh;
    });
    return cursor;
};

// --- Elements graphiques ---
const drawGradient = (pdf, x, y, w, h, from, to, steps = 60) => {
    const stepWidth = w / steps;
    for (let i = 0; i < steps; i += 1) {
        const t = steps === 1 ? 0 : i / (steps - 1);
        pdf.setFillColor(
            Math.round(from[0] + (to[0] - from[0]) * t),
            Math.round(from[1] + (to[1] - from[1]) * t),
            Math.round(from[2] + (to[2] - from[2]) * t),
        );
        pdf.rect(x + i * stepWidth, y, stepWidth + 0.2, h, 'F');
    }
};

const drawHeader = (pdf, { title, className, date, studentName, compact }) => {
    const height = compact ? 16 : 26;
    drawGradient(pdf, 0, 0, PAGE.w, height, C.brandFrom, C.brandTo);
    pdf.setTextColor(...C.white);

    if (compact) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.text('Grille de cotation', MARGIN.left, 7.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.5);
        pdf.text(title, MARGIN.left, 12.5);
        pdf.text(`${studentName} (suite)`, PAGE.w - MARGIN.right, 12.5, { align: 'right' });
        return height + 6;
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(17);
    pdf.text('Grille de cotation', MARGIN.left, 11);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.text(title, MARGIN.left, 17.5);

    pdf.setDrawColor(255, 255, 255);
    pdf.setLineWidth(0.2);
    pdf.line(MARGIN.left, 19.5, PAGE.w - MARGIN.right, 19.5);

    pdf.setFontSize(8.5);
    pdf.text(`Classe : ${className || '-'}`, MARGIN.left, 23.5);
    pdf.text(`Date : ${formatDate(date)}`, PAGE.w - MARGIN.right, 23.5, { align: 'right' });
    return height + 7;
};

const drawStudentCard = (pdf, student, y) => {
    const innerX = MARGIN.left + 6;
    const innerW = CONTENT_W - 12;

    const bilanLines = student.globalComment && !student.isAbsent
        ? layoutSegments(pdf, parseComment(student.globalComment), innerW)
        : [];

    let height = 15;
    if (student.isAbsent) height += 5;
    if (bilanLines.length) height += 7 + linesHeight(bilanLines);
    height += 4;

    pdf.setFillColor(...C.slate900);
    pdf.roundedRect(MARGIN.left, y, CONTENT_W, height, 2.5, 2.5, 'F');

    pdf.setTextColor(...C.white);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13.5);
    pdf.text(`${student.lastname || ''} ${student.firstname || ''}`.trim(), innerX, y + 10);

    pdf.setFontSize(15);
    if (student.isAbsent) {
        pdf.setTextColor(...C.slate400);
        pdf.text('- / -', PAGE.w - MARGIN.right - 6, y + 10, { align: 'right' });
    } else {
        const ratio = student.totalMaxScore > 0 ? student.totalScore / student.totalMaxScore : null;
        if (ratio === null) pdf.setTextColor(...C.white);
        else if (ratio < 0.5) pdf.setTextColor(...C.redLight);
        else if (ratio < 0.7) pdf.setTextColor(...C.orangeLight);
        else pdf.setTextColor(...C.greenLight);
        pdf.text(
            `${formatNumber(student.totalScore)} / ${formatNumber(student.totalMaxScore, '-')}`,
            PAGE.w - MARGIN.right - 6, y + 10, { align: 'right' },
        );
    }

    let cursor = y + 14;
    if (student.isAbsent) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(...C.redLight);
        pdf.text('ÉLÈVE ABSENT', innerX, cursor + 2.5);
        cursor += 5;
    }

    if (bilanLines.length) {
        pdf.setDrawColor(70, 85, 105);
        pdf.setLineWidth(0.2);
        pdf.line(innerX, cursor + 1, PAGE.w - MARGIN.right - 6, cursor + 1);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(...C.white);
        pdf.text('Bilan général', innerX, cursor + 5.5);
        cursor += 7;

        // Sur fond sombre, on force des couleurs claires
        const darkColors = {
            text: C.white, title: C.bilanTitle, code: C.bilanCode, space: C.white,
        };
        bilanLines.forEach((line) => {
            const style = STYLE[line.style];
            if (line.style !== 'space' && line.text) {
                pdf.setFont(...style.font);
                pdf.setFontSize(style.size);
                pdf.setTextColor(...darkColors[line.style]);
                pdf.text(line.text, innerX, cursor + style.lh - 1.1);
            }
            cursor += style.lh;
        });
    }

    return y + height + 5;
};

const drawTableHead = (pdf, y) => {
    pdf.setFillColor(...C.slate50);
    pdf.rect(MARGIN.left, y, CONTENT_W, 7.5, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(...C.slate500);
    pdf.text('CRITÈRE', COL.crit.x + 2, y + 5);
    pdf.text('NOTE', COL.note.x, y + 5);
    pdf.text('COMMENTAIRES', COL.com.x, y + 5);
    pdf.setDrawColor(...C.slate200);
    pdf.setLineWidth(0.4);
    pdf.line(MARGIN.left, y + 7.5, PAGE.w - MARGIN.right, y + 7.5);
    return y + 7.5 + 2;
};

/**
 * Telechargement maison : jsPDF revoque l'URL du blob au bout de 40 s, ce qui
 * bloque definitivement un telechargement encore en cours d'analyse
 * (symptome observe sur Arc : "verification" qui ne se termine jamais).
 */
const downloadBlob = (blob, fileName) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Laisse largement le temps au navigateur de lire le blob avant de le liberer
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
};

// --- Generation principale ---
export const generateEvaluationPDF = async (evaluation, students, criteria, grades) => {
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });

    const safeEvaluation = evaluation || {};
    const title = safeEvaluation.title || safeEvaluation.name || 'Évaluation';
    const className = safeEvaluation.class_name || '';
    const evaluationDate = safeEvaluation.evaluation_date;
    const criteriaList = Array.isArray(criteria) ? criteria : [];
    const studentList = Array.isArray(students) ? students : [];
    const gradeMap = grades || {};

    // Bareme global : celui de l'evaluation, sinon la somme des criteres
    const criteriaTotal = criteriaList.reduce((sum, c) => sum + (toNumber(c.max_points) || 0), 0);
    const maxScore = toNumber(safeEvaluation.max_score) ?? criteriaTotal;

    pdf.setProperties({
        title: `Grille de cotation - ${title}`,
        subject: className ? `Classe ${className}` : 'Grille de cotation',
        creator: 'Prolixe',
    });

    // 1. Preparation des donnees (meme mapping que CorrectionView)
    let missingGrades = 0;
    const studentGrades = studentList.map((student) => {
        const globalEntry = gradeMap[`global-${student.id}`] || {};
        const isAbsent = !!globalEntry.is_absent;

        const scores = criteriaList.map((criterion) => {
            const entry = gradeMap[`${student.id}-${criterion.id}`];
            const score = toNumber(entry ? entry.score : undefined);
            if (!isAbsent && score === null) missingGrades += 1;
            return {
                label: criterion.name || criterion.label || 'Critère',
                section: criterion.section_name || 'Général',
                maxPoints: toNumber(criterion.max_points) ?? 0,
                score,
                hasScore: score !== null,
                comment: (entry && entry.comment) || '',
            };
        });

        return {
            ...student,
            scores,
            isAbsent,
            globalComment: globalEntry.comment || '',
            totalScore: isAbsent ? 0 : scores.reduce((sum, s) => sum + (s.score || 0), 0),
            totalMaxScore: maxScore,
        };
    });

    if (missingGrades > 0) {
        // Aide au diagnostic : un critere sans note en base sort en "-" dans le PDF
        console.warn(`[ExportPDF] ${missingGrades} note(s) de critère absente(s) en base pour "${title}".`);
    }

    // 2. Rendu
    const footers = [];
    let pageStarted = false;
    let cursorY = 0;
    let currentStudent = null;

    const startPage = (student, isFirstOfStudent) => {
        if (pageStarted) pdf.addPage();
        pageStarted = true;
        currentStudent = student;
        const studentName = `${student.lastname || ''} ${student.firstname || ''}`.trim();
        footers.push({ studentName, className });

        cursorY = drawHeader(pdf, {
            title, className, date: evaluationDate, studentName, compact: !isFirstOfStudent,
        });
        if (isFirstOfStudent) cursorY = drawStudentCard(pdf, student, cursorY);
        cursorY = drawTableHead(pdf, cursorY);
    };

    const drawNoteCell = (row, isAbsent, y) => {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        if (isAbsent) {
            pdf.setTextColor(...C.slate400);
            pdf.text('-', COL.note.x, y);
            return;
        }
        if (!row.hasScore) {
            pdf.setTextColor(...C.slate400);
            pdf.text(`- / ${formatNumber(row.maxPoints)}`, COL.note.x, y);
            return;
        }
        if (row.maxPoints === 0) {
            // Critère bonus / malus
            pdf.setTextColor(...(row.score < 0 ? C.red : C.green));
            pdf.text(`${row.score > 0 ? '+' : ''}${formatNumber(row.score)} pts`, COL.note.x, y);
            return;
        }
        const ratio = row.score / row.maxPoints;
        if (ratio < 0.5) pdf.setTextColor(...C.red);
        else if (ratio < 0.7) pdf.setTextColor(...C.orange);
        else pdf.setTextColor(...C.green);
        pdf.text(`${formatNumber(row.score)} / ${formatNumber(row.maxPoints)}`, COL.note.x, y);
    };

    studentGrades.forEach((student) => {
        startPage(student, true);

        if (student.scores.length === 0) {
            pdf.setFont('helvetica', 'italic');
            pdf.setFontSize(9);
            pdf.setTextColor(...C.slate400);
            pdf.text('Aucun critère défini pour cette évaluation.', MARGIN.left + 2, cursorY + 6);
            return;
        }

        student.scores.forEach((row) => {
            // Mise en page de la ligne
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(8.5);
            const labelLines = pdf.splitTextToSize(
                breakLongWords(pdf, row.label, COL.crit.w - 2), COL.crit.w - 2,
            );
            const leftHeight = 3.4 + labelLines.length * 3.7;

            const commentLines = student.isAbsent || !row.comment
                ? []
                : layoutSegments(pdf, parseComment(row.comment), COL.com.w);

            let index = 0;
            let isFirstFragment = true;

            do {
                if (BOTTOM_LIMIT - cursorY < MIN_ROW_SPACE) startPage(currentStudent, false);

                const available = BOTTOM_LIMIT - cursorY - ROW_PAD * 2;
                const remaining = commentLines.slice(index);
                const neededLeft = isFirstFragment ? leftHeight : 0;
                const neededAll = Math.max(neededLeft, linesHeight(remaining));

                let fragment = remaining;
                let complete = true;

                if (neededAll > available) {
                    fragment = [];
                    let used = 0;
                    for (let i = index; i < commentLines.length; i += 1) {
                        const lh = STYLE[commentLines[i].style].lh;
                        if (used + lh > available) break;
                        used += lh;
                        fragment.push(commentLines[i]);
                    }
                    complete = false;
                    if (fragment.length === 0) {
                        // Rien ne tient sur cette page : on passe a la suivante
                        startPage(currentStudent, false);
                        continue;
                    }
                }

                const top = cursorY + ROW_PAD;

                if (isFirstFragment) {
                    pdf.setFont('helvetica', 'normal');
                    pdf.setFontSize(6.5);
                    pdf.setTextColor(...C.slate400);
                    pdf.text(String(row.section).toUpperCase(), COL.crit.x + 2, top + 2.4);

                    pdf.setFont('helvetica', 'bold');
                    pdf.setFontSize(8.5);
                    pdf.setTextColor(...C.slate900);
                    labelLines.forEach((line, i) => {
                        pdf.text(line, COL.crit.x + 2, top + 6 + i * 3.7);
                    });

                    drawNoteCell(row, student.isAbsent, top + 4.5);
                } else {
                    pdf.setFont('helvetica', 'italic');
                    pdf.setFontSize(7.5);
                    pdf.setTextColor(...C.slate400);
                    pdf.text('(suite)', COL.crit.x + 2, top + 4);
                }

                let bottom = top + (isFirstFragment ? leftHeight : 0);
                if (fragment.length) {
                    bottom = Math.max(bottom, drawLines(pdf, fragment, COL.com.x, top, COL.com.w));
                } else if (isFirstFragment && !student.isAbsent && !row.comment) {
                    pdf.setFont('helvetica', 'normal');
                    pdf.setFontSize(8);
                    pdf.setTextColor(...C.slate300);
                    pdf.text('-', COL.com.x, top + 4);
                }

                index += fragment.length;
                cursorY = bottom + ROW_PAD;

                pdf.setDrawColor(...C.slate100);
                pdf.setLineWidth(0.3);
                pdf.line(MARGIN.left, cursorY, PAGE.w - MARGIN.right, cursorY);

                isFirstFragment = false;
                if (!complete && index < commentLines.length) startPage(currentStudent, false);
            } while (index < commentLines.length);
        });
    });

    // 3. Pieds de page (numerotation une fois le total connu)
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i += 1) {
        pdf.setPage(i);
        const footer = footers[i - 1] || { studentName: '', className };
        pdf.setDrawColor(...C.slate200);
        pdf.setLineWidth(0.2);
        pdf.line(MARGIN.left, PAGE.h - 12, PAGE.w - MARGIN.right, PAGE.h - 12);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        pdf.setTextColor(...C.slate400);
        pdf.text(
            [footer.studentName, footer.className, title].filter(Boolean).join('  -  '),
            MARGIN.left, PAGE.h - 8,
        );
        pdf.text(`Page ${i} / ${pageCount}`, PAGE.w - MARGIN.right, PAGE.h - 8, { align: 'right' });
    }

    // 4. Telechargement
    const datePart = evaluationDate
        ? String(evaluationDate).slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    const fileName = `${['Grille', slugify(title) || 'evaluation', slugify(className), datePart]
        .filter(Boolean).join('_')}.pdf`;

    downloadBlob(pdf.output('blob'), fileName);
    return fileName;
};
