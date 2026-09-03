// server/src/controllers/JournalPropagationController.js
//
// « Propager » : rejouer une annee de cours sur un nouveau journal.
//
// Le travail effectue dans un ancien journal (25-26) devient le travail prevu
// du nouveau (26-27), cours par cours : la 1re lecon d'informatique de 3eme va
// sur le 1er creneau d'informatique de 3eme de la nouvelle annee, la 2e sur le
// 2e, etc. Les deux calendriers ne coincident jamais — conges differents,
// horaire different, une classe qui passe de 4 a 3 heures — c'est donc le RANG
// de la lecon qui fait le lien, jamais la date.
//
// Les cours annules, les examens et les creneaux laisses vides ne comptent pas
// comme des lecons : la suite est compactee. Sans cela, chaque trou de l'an
// dernier decalerait tout le plan de l'annee suivante.
//
// Deux etapes, comme l'import PDF : /preview ne lit rien d'autre que la base et
// propose l'appariement des classes, /apply ecrit dans une transaction.

const pool = require('../../config/database');

// Ces marqueurs occupent le champ « travail effectue » a la place d'un texte :
// ce sont des statuts, pas de la matiere vue.
const STATUS_ONLY = new Set(['[CANCELLED]', '[EXAM]', '[HOLIDAY]']);
const INTERRO_TAG = '[INTERRO]';

const MAX_YEAR_DAYS = 500;   // garde-fou : une annee scolaire deborde rarement
const INSERT_CHUNK = 400;

const pad = (n) => String(n).padStart(2, '0');

/** Ramene une date (Date mysql2, 'YYYY-MM-DD') a sa cle comparable. */
const toDateKey = (value) => {
    if (!value) return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
        return value.trim();
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const addDays = (dateKey, n) => {
    const [y, m, d] = dateKey.split('-').map(Number);
    return toDateKey(new Date(y, m - 1, d + n));
};

/** 1 = lundi … 7 = dimanche, comme SCHEDULE_SLOTS.day_of_week. */
const isoDayOfWeek = (dateKey) => {
    const [y, m, d] = dateKey.split('-').map(Number);
    const jsDay = new Date(y, m - 1, d).getDay();
    return jsDay === 0 ? 7 : jsDay;
};

/** '08:00-09:00' -> 480. Les ids de SCH_HOURS ne suivent pas l'ordre horaire. */
const startMinutes = (libelle) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(libelle || ''));
    return m ? Number(m[1]) * 60 + Number(m[2]) : 24 * 60;
};

const normalizeName = (s) => String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Ce qui merite d'etre replanifie : ce qui a reellement ete vu, a defaut ce qui
 * avait ete prevu. Renvoie null quand le creneau ne porte aucune matiere.
 */
const lessonTextOf = (entry) => {
    for (const raw of [entry.content_done, entry.content_planned]) {
        const text = String(raw || '').trim();
        if (!text || STATUS_ONLY.has(text)) continue;
        if (text.startsWith(INTERRO_TAG)) {
            // Le tag n'est interprete que dans « travail effectue » ; en travail
            // prevu il s'afficherait tel quel.
            const rest = text.slice(INTERRO_TAG.length).trim();
            return rest ? `Interro : ${rest}` : 'Interro';
        }
        return text;
    }
    return null;
};

const holidayRanges = (raw) => {
    let list = raw;
    if (typeof list === 'string') {
        try { list = JSON.parse(list); } catch { return []; }
    }
    if (!Array.isArray(list)) return [];
    return list
        .map(h => ({ start: toDateKey(h?.start), end: toDateKey(h?.end) }))
        .filter(h => h.start && h.end);
};

const fail = (message, status = 400) => Object.assign(new Error(message), { status });

// --- Lecture du journal source ---------------------------------------------

/**
 * Les lecons de l'ancien journal, groupees par cours (classe + matiere) et
 * remises dans l'ordre chronologique reel.
 */
async function loadSourceCourses(db, journalId) {
    const [rows] = await db.execute(`
        SELECT je.entry_date, je.content_planned, je.content_done,
               ss.class_id, ss.subject_id, h.libelle,
               c.name AS class_name, c.level AS class_level,
               sbj.name AS subject_name
        FROM JOURNAL_ENTRIES je
                 JOIN SCHEDULE_SLOTS ss ON ss.id = je.schedule_slot_id
                 JOIN SCH_HOURS h ON h.id = ss.time_slot_id
                 LEFT JOIN CLASSES c ON c.id = ss.class_id
                 LEFT JOIN SUBJECTS sbj ON sbj.id = ss.subject_id
        WHERE je.journal_id = ?
    `, [journalId]);

    // Tri en JS : les ids de SCH_HOURS ne reflètent pas l'heure du cours.
    const ordered = rows
        .map(r => ({ ...r, dateKey: toDateKey(r.entry_date) }))
        .filter(r => r.dateKey)
        .sort((a, b) => (a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1
            : startMinutes(a.libelle) - startMinutes(b.libelle)));

    const courses = new Map();
    let orphanEntries = 0;

    for (const row of ordered) {
        if (!row.class_id || !row.subject_id) {
            // Creneau sans classe ou sans matiere : impossible de savoir de quel
            // cours il s'agit, donc impossible de le rejouer.
            orphanEntries++;
            continue;
        }
        const key = `${row.class_id}|${row.subject_id}`;
        let course = courses.get(key);
        if (!course) {
            course = {
                key,
                source_class_id: row.class_id,
                source_class_name: row.class_name || `Classe #${row.class_id}`,
                source_class_level: row.class_level || null,
                subject_id: row.subject_id,
                subject_name: row.subject_name || `Matière #${row.subject_id}`,
                lessons: [],
                ignored: 0
            };
            courses.set(key, course);
        }
        const text = lessonTextOf(row);
        if (text) course.lessons.push(text);
        else course.ignored++;
    }

    return { courses, orphanEntries };
}

// --- Calendrier du journal cible -------------------------------------------

/** Bornes de l'annee : celles de l'annee scolaire, sinon celles des horaires. */
function periodBounds(journal, sets) {
    let start = toDateKey(journal.start_date);
    let end = toDateKey(journal.end_date);

    if (!start || !end) {
        const starts = sets.map(s => s.start).sort();
        const ends = sets.map(s => s.end).sort();
        start = start || starts[0] || null;
        end = end || ends[ends.length - 1] || null;
    }
    return (start && end && start <= end) ? { start, end } : null;
}

/** Le dernier horaire entre en vigueur qui couvre ce jour (cf. getScheduleByDate). */
function setCovering(orderedSets, dayKey) {
    let winner = null;
    for (const set of orderedSets) {
        if (dayKey >= set.start && dayKey <= set.end) winner = set;
    }
    return winner;
}

/**
 * Deroule l'annee du journal cible et liste, pour chaque cours, ses creneaux
 * dans l'ordre : c'est la suite de rangs sur laquelle les lecons se posent.
 */
async function loadTargetOccurrences(db, journal, userId) {
    const [setRows] = await db.execute(
        'SELECT id, start_time, end_time FROM SCHEDULE_SETS WHERE journal_id = ? AND user_id = ?',
        [journal.id, userId]
    );
    const [slotRows] = await db.execute(`
        SELECT ss.id, ss.schedule_set_id, ss.day_of_week, ss.class_id, ss.subject_id, h.libelle
        FROM SCHEDULE_SLOTS ss
                 JOIN SCHEDULE_SETS sets ON sets.id = ss.schedule_set_id
                 JOIN SCH_HOURS h ON h.id = ss.time_slot_id
        WHERE sets.journal_id = ? AND sets.user_id = ?
    `, [journal.id, userId]);

    const sets = setRows
        .map(s => ({ id: s.id, start: toDateKey(s.start_time), end: toDateKey(s.end_time) }))
        .filter(s => s.start && s.end)
        .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.id - b.id));

    const slotsBySet = new Map();
    for (const slot of slotRows) {
        if (!slot.class_id || !slot.subject_id) continue;
        const list = slotsBySet.get(slot.schedule_set_id) || [];
        list.push(slot);
        slotsBySet.set(slot.schedule_set_id, list);
    }
    for (const list of slotsBySet.values()) {
        list.sort((a, b) => startMinutes(a.libelle) - startMinutes(b.libelle) || a.id - b.id);
    }

    const bounds = periodBounds(journal, sets);
    const byCourse = new Map();
    if (!bounds || sets.length === 0) {
        return { occurrences: byCourse, bounds, setCount: sets.length };
    }

    const holidays = holidayRanges(journal.holidays);
    let day = bounds.start;
    for (let i = 0; day && day <= bounds.end && i < MAX_YEAR_DAYS; i++, day = addDays(day, 1)) {
        if (holidays.some(h => day >= h.start && day <= h.end)) continue;
        const set = setCovering(sets, day);
        if (!set) continue;

        const dow = isoDayOfWeek(day);
        for (const slot of (slotsBySet.get(set.id) || [])) {
            if (Number(slot.day_of_week) !== dow) continue;
            const key = `${slot.class_id}|${slot.subject_id}`;
            const list = byCourse.get(key) || [];
            list.push({ date: day, slotId: slot.id });
            byCourse.set(key, list);
        }
    }

    return { occurrences: byCourse, bounds, setCount: sets.length };
}

/** Les entrees deja presentes dans la cible, pour ne rien ecraser sans le dire. */
async function loadTargetEntries(db, journalId) {
    const [rows] = await db.execute(
        'SELECT id, schedule_slot_id, entry_date, content_planned FROM JOURNAL_ENTRIES WHERE journal_id = ?',
        [journalId]
    );
    const map = new Map();
    for (const row of rows) {
        const key = `${row.schedule_slot_id}|${toDateKey(row.entry_date)}`;
        map.set(key, row);
    }
    return map;
}

// --- Contexte commun aux deux etapes ---------------------------------------

async function loadContext(db, userId, sourceId, targetId) {
    if (!sourceId || !targetId) throw fail('Journal source et journal cible requis.');
    if (Number(sourceId) === Number(targetId)) {
        throw fail('Le journal source et le journal cible doivent être différents.');
    }

    const [rows] = await db.execute(`
        SELECT j.id, j.name, sy.start_date, sy.end_date, sy.holidays
        FROM JOURNALS j
                 LEFT JOIN SCHOOL_YEARS sy ON sy.id = j.school_year_id
        WHERE j.user_id = ? AND j.id IN (?, ?)
    `, [userId, sourceId, targetId]);

    const source = rows.find(r => Number(r.id) === Number(sourceId));
    const target = rows.find(r => Number(r.id) === Number(targetId));
    if (!source || !target) throw fail('Journal introuvable ou accès refusé.', 404);

    return { source, target };
}

class JournalPropagationController {

    // --- Etape 1 : ce qui serait propage, sans rien ecrire ------------------
    static async preview(req, res) {
        const userId = req.user.id;
        const sourceId = parseInt(req.query.source_journal_id, 10);
        const targetId = parseInt(req.query.target_journal_id, 10);

        try {
            const { source, target } = await loadContext(pool, userId, sourceId, targetId);
            const [{ courses, orphanEntries }, targetData, [targetClasses]] = await Promise.all([
                loadSourceCourses(pool, sourceId),
                loadTargetOccurrences(pool, target, userId),
                pool.execute('SELECT id, name, level FROM CLASSES WHERE journal_id = ?', [targetId])
            ]);

            // Appariement propose : meme nom de classe d'une annee a l'autre
            // (3TIN -> 3TIN), les eleves changent mais le cours se rejoue.
            const byNormalizedName = new Map(
                targetClasses.map(c => [normalizeName(c.name), c.id])
            );

            const payload = [...courses.values()]
                .filter(course => course.lessons.length > 0)
                .map(course => {
                    // Combien de creneaux chaque classe cible offre-t-elle pour
                    // cette matiere ? L'utilisateur voit tout de suite si l'annee
                    // suivante a de quoi accueillir toutes les lecons.
                    const occurrencesByClass = {};
                    for (const candidate of targetClasses) {
                        const list = targetData.occurrences.get(`${candidate.id}|${course.subject_id}`);
                        if (list && list.length) occurrencesByClass[candidate.id] = list.length;
                    }
                    const suggested = byNormalizedName.get(normalizeName(course.source_class_name));
                    return {
                        key: course.key,
                        source_class_id: course.source_class_id,
                        source_class_name: course.source_class_name,
                        source_class_level: course.source_class_level,
                        subject_id: course.subject_id,
                        subject_name: course.subject_name,
                        lessons: course.lessons.length,
                        ignored: course.ignored,
                        first_lesson: course.lessons[0],
                        last_lesson: course.lessons[course.lessons.length - 1],
                        occurrences_by_class: occurrencesByClass,
                        suggested_class_id: occurrencesByClass[suggested] ? suggested : null
                    };
                })
                .sort((a, b) => a.source_class_name.localeCompare(b.source_class_name)
                    || a.subject_name.localeCompare(b.subject_name));

            res.json({
                success: true,
                data: {
                    source: { id: source.id, name: source.name },
                    target: {
                        id: target.id,
                        name: target.name,
                        period: targetData.bounds,
                        schedule_count: targetData.setCount
                    },
                    target_classes: targetClasses,
                    courses: payload,
                    orphan_entries: orphanEntries
                }
            });
        } catch (error) {
            res.status(error.status || 500).json({ success: false, message: error.message });
        }
    }

    // --- Etape 2 : ecriture du travail prevu --------------------------------
    static async apply(req, res) {
        const userId = req.user.id;
        const sourceId = parseInt(req.body.source_journal_id, 10);
        const targetId = parseInt(req.body.target_journal_id, 10);
        const overwrite = req.body.overwrite === true;
        const pairs = Array.isArray(req.body.pairs) ? req.body.pairs : [];

        if (pairs.length === 0) {
            return res.status(400).json({ success: false, message: 'Aucun cours à propager.' });
        }

        let connection;
        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            const { target } = await loadContext(connection, userId, sourceId, targetId);
            const { courses } = await loadSourceCourses(connection, sourceId);
            const targetData = await loadTargetOccurrences(connection, target, userId);
            const existing = await loadTargetEntries(connection, targetId);

            const inserts = [];
            const updates = [];
            const report = [];

            for (const pair of pairs) {
                const subjectId = parseInt(pair.subject_id, 10);
                const sourceClassId = parseInt(pair.source_class_id, 10);
                const targetClassId = parseInt(pair.target_class_id, 10);
                if (!subjectId || !sourceClassId || !targetClassId) continue;

                const course = courses.get(`${sourceClassId}|${subjectId}`);
                if (!course || course.lessons.length === 0) continue;

                const occurrences = targetData.occurrences.get(`${targetClassId}|${subjectId}`) || [];

                let cursor = 0;
                let planned = 0;
                let preserved = 0;

                for (const occurrence of occurrences) {
                    if (cursor >= course.lessons.length) break;

                    const row = existing.get(`${occurrence.slotId}|${occurrence.date}`);
                    const already = String(row?.content_planned || '').trim();

                    // Un creneau deja prevu consomme quand meme sa lecon : sinon
                    // toute la suite se decalerait par rapport au calendrier.
                    if (already && !overwrite) {
                        cursor++;
                        preserved++;
                        continue;
                    }

                    const text = course.lessons[cursor];
                    if (row) updates.push([text, row.id]);
                    else inserts.push([targetId, occurrence.slotId, occurrence.date, text]);

                    cursor++;
                    planned++;
                }

                report.push({
                    class_name: course.source_class_name,
                    subject_name: course.subject_name,
                    lessons: course.lessons.length,
                    occurrences: occurrences.length,
                    planned,
                    preserved,
                    // Plus de lecons que de creneaux : l'annee cible est plus
                    // courte, la fin du programme ne rentre pas.
                    leftover: Math.max(0, course.lessons.length - cursor)
                });
            }

            // « travail effectue » n'est jamais touche : seul le prevu est ecrit.
            for (let i = 0; i < inserts.length; i += INSERT_CHUNK) {
                await connection.query(
                    `INSERT INTO JOURNAL_ENTRIES (journal_id, schedule_slot_id, entry_date, content_planned)
                     VALUES ?`,
                    [inserts.slice(i, i + INSERT_CHUNK)]
                );
            }
            for (const [text, id] of updates) {
                await connection.execute(
                    'UPDATE JOURNAL_ENTRIES SET content_planned = ? WHERE id = ?',
                    [text, id]
                );
            }

            await connection.commit();

            const total = inserts.length + updates.length;
            res.json({
                success: true,
                message: `${total} cours planifié(s) dans « ${target.name} ».`,
                data: { planned: total, courses: report }
            });
        } catch (error) {
            if (connection) await connection.rollback();
            console.error('Erreur propagation journal:', error);
            res.status(error.status || 500).json({ success: false, message: error.message });
        } finally {
            if (connection) connection.release();
        }
    }
}

module.exports = JournalPropagationController;
