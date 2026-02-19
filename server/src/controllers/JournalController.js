// backend/controllers/journalController.js
const pool = require('../../config/database');

const parseFrenchDate = (dateStr) => {
    const months = { 'janv.': 0, 'févr.': 1, 'mars': 2, 'avr.': 3, 'mai': 4, 'juin': 5, 'juil.': 6, 'août': 7, 'sept.': 8, 'oct.': 9, 'nov.': 10, 'déc.': 11 };
    const parts = dateStr.toLowerCase().split(' ');
    if (parts.length < 4) return null;
    const day = parseInt(parts[1], 10);
    const month = months[parts[2]];
    const year = parseInt(parts[3], 10);
    return new Date(year, month, day);
};

const getDayKeyFromDate = (date) =>
    ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];

class JournalController {
    static async withConnection(operation) {
        let connection;
        try {
            connection = await pool.getConnection();
            return await operation(connection);
        } catch (error) {
            console.error('Erreur SQL (JournalController):', error.message);
            throw error;
        } finally {
            if (connection) connection.release();
        }
    }

    static handleError(res, error, defaultMessage = 'Erreur serveur', statusCode = 500) {
        console.error(`❌ ${defaultMessage}:`, error);
        res.status(statusCode).json({
            success: false,
            message: defaultMessage,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }

    // --- LECTURE ---
    // backend/controllers/journalController.js
    static async getAllJournals(req, res) {
        try {
            const userId = req.user.id;
            const journals = await JournalController.withConnection(async (connection) => {
                const [rows] = await connection.execute(`
                    SELECT
                        j.*,
                        sy.label as year_label,
                        (SELECT COUNT(*) FROM JOURNAL_ENTRIES je WHERE je.journal_id = j.id) as entries_count
                    FROM JOURNALS j
                             JOIN SCHOOL_YEARS sy ON j.school_year_id = sy.id
                    WHERE j.user_id = ?
                    ORDER BY sy.start_date DESC
                `, [userId]);
                return rows;
            });
            res.json({ success: true, data: journals });
        } catch (error) {
            JournalController.handleError(res, error, 'Erreur lors de la récupération des journaux.');
        }
    }

    static async getCurrentJournal(req, res) {
        try {
            const [journal] = await JournalController.withConnection(async (db) => {
                const [rows] = await db.execute('SELECT * FROM JOURNALS WHERE user_id = ? AND is_current = 1 LIMIT 1', [req.user.id]);
                return rows;
            });
            res.json({ success: true, data: journal || null });
        } catch (error) {
            JournalController.handleError(res, error, 'Erreur journal courant.');
        }
    }

    // --- ACTIONS SUR JOURNAL ---
    static async createJournal(req, res) {
        const { name, school_year_id } = req.body;
        const userId = req.user.id;

        if (!name || !school_year_id) return JournalController.handleError(res, new Error('Missing fields'), "Nom et Année requis.", 400);

        let connection;
        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            const [existing] = await connection.execute('SELECT id FROM JOURNALS WHERE school_year_id = ? AND user_id = ?', [school_year_id, userId]);
            if (existing.length > 0) throw new Error('Un journal existe déjà pour cette année.');
            await connection.execute('UPDATE JOURNALS SET is_current = 0 WHERE user_id = ?', [userId]);
            const [result] = await connection.execute(
                'INSERT INTO JOURNALS (name, school_year_id, user_id, is_current, is_archived, created_at) VALUES (?, ?, ?, 1, 0, NOW())',
                [name, school_year_id, userId]
            );

            await connection.commit();
            res.status(201).json({ success: true, id: result.insertId });
        } catch (error) {
            if (connection) await connection.rollback();
            JournalController.handleError(res, error, error.message);
        } finally {
            if (connection) connection.release();
        }
    }

    static async deleteJournal(req, res) {
        const { id } = req.params;
        const userId = req.user.id;

        try {
            await JournalController.withConnection(async (db) => {
                const [result] = await db.execute('DELETE FROM JOURNALS WHERE id = ? AND user_id = ?', [id, userId]);
                if (result.affectedRows === 0) throw new Error('Journal non trouvé.');
            });
            res.json({ success: true, message: 'Journal supprimé.' });
        } catch (error) {
            JournalController.handleError(res, error, 'Erreur suppression.');
        }
    }


    static async archiveJournal(req, res) {
        const { id } = req.params;
        const userId = req.user.id;

        try {
            await JournalController.withConnection(async (db) => {
                const [result] = await db.execute(
                    `UPDATE JOURNALS 
                     SET is_archived = 1, is_current = 0 
                     WHERE id = ? AND user_id = ?`,
                    [id, userId]
                );

                if (result.affectedRows === 0) {
                    throw new Error('Journal non trouvé ou non autorisé.');
                }
            });

            res.json({
                success: true,
                message: 'Journal archivé avec succès.'
            });
        } catch (error) {
            JournalController.handleError(res, error, "Erreur lors de l'archivage du journal.");
        }
    }

    //ENTRIES

    static async clearJournal(req, res) {
        const { journal_id } = req.params;
        const userId = req.user.id;

        try {
            await JournalController.withConnection(async (db) => {
                const [journal] = await db.execute(
                    'SELECT is_archived FROM JOURNALS WHERE id = ? AND user_id = ?',
                    [journal_id, userId]
                );

                if (journal.length === 0) {
                    throw new Error('Journal non trouvé.');
                }

                if (journal[0].is_archived) {
                    throw new Error('Impossible de vider un journal archivé.');
                }

                const [result] = await db.execute(
                    'DELETE FROM JOURNAL_ENTRIES WHERE journal_id = ?',
                    [journal_id]
                );

                return result;
            });

            res.json({
                success: true,
                message: 'Le contenu du journal a été vidé avec succès.'
            });
        } catch (error) {
            JournalController.handleError(res, error, "Erreur lors du vidage du journal.");
        }
    }

    static async getJournalEntries(req, res) {
        const { journal_id, startDate, endDate } = req.query;
        try {
            const entries = await JournalController.withConnection(async (db) => {
                const [rows] = await db.execute(`
                    SELECT je.*, s.day_of_week, s.start_time, s.end_time, sub.name as subject_name, c.name as class_name
                    FROM JOURNAL_ENTRIES je
                    JOIN SCHEDULES s ON je.schedule_id = s.id
                    JOIN SUBJECTS sub ON s.subject_id = sub.id
                    JOIN CLASSES c ON s.class_id = c.id
                    WHERE je.journal_id = ? AND je.entry_date BETWEEN ? AND ?
                `, [journal_id, startDate, endDate]);
                return rows;
            });
            res.json({ success: true, data: entries });
        } catch (error) {
            JournalController.handleError(res, error, 'Erreur récupération entrées.');
        }
    }

    static async upsertJournalEntry(req, res) {
        const { id, journal_id, schedule_id, entry_date, content_planned, content_done, homework } = req.body;
        try {
            const result = await JournalController.withConnection(async (db) => {
                if (id) {
                    await db.execute(
                        'UPDATE JOURNAL_ENTRIES SET content_planned = ?, content_done = ?, homework = ?, entry_date = ? WHERE id = ?',
                        [content_planned, content_done, homework, entry_date, id]
                    );
                    return id;
                } else {
                    const [ins] = await db.execute(
                        'INSERT INTO JOURNAL_ENTRIES (journal_id, schedule_id, entry_date, content_planned, content_done, homework) VALUES (?, ?, ?, ?, ?, ?)',
                        [journal_id, schedule_id, entry_date, content_planned, content_done, homework]
                    );
                    return ins.insertId;
                }
            });
            res.json({ success: true, data: { id: result } });
        } catch (error) {
            JournalController.handleError(res, error, 'Erreur sauvegarde entrée.');
        }
    }

    // --- IMPORTATION ---
    static async importJournal(req, res) {
        if (!req.file) return res.status(400).json({ message: "Fichier requis" });
        const { journal_id } = req.body;
        const userId = req.user.id;

        let connection;
        try {
            const data = JSON.parse(req.file.buffer.toString('utf8'));
            connection = await pool.getConnection();
            await connection.beginTransaction();

            // 1. Récupérer l'emploi du temps lié au journal
            const [schedule] = await connection.execute(
                'SELECT id, day_of_week, start_time FROM SCHEDULES WHERE class_id IN (SELECT id FROM CLASSES WHERE journal_id = ?)',
                [journal_id]
            );

            let imported = 0;
            for (const session of data) {
                const date = parseFrenchDate(session.date);
                if (!date) continue;

                const dayOfWeek = getDayKeyFromDate(date);

                for (const act of session.activites) {
                    // Matcher l'heure de l'import (ex: 08h00) avec start_time (ex: 08:00:00)
                    const startTime = act.heure.replace('h', ':') + ':00';
                    const slot = schedule.find(s => s.day_of_week.toLowerCase() === dayOfWeek && s.start_time.startsWith(startTime.substring(0,5)));

                    if (slot) {
                        await connection.execute(`
                            INSERT INTO JOURNAL_ENTRIES (journal_id, schedule_id, entry_date, content_done)
                            VALUES (?, ?, ?, ?)
                            ON DUPLICATE KEY UPDATE content_done = VALUES(content_done)
                        `, [journal_id, slot.id, date, act.description]);
                        imported++;
                    }
                }
            }

            await connection.commit();
            res.json({ success: true, message: `${imported} sessions importées.` });
        } catch (error) {
            if (connection) await connection.rollback();
            JournalController.handleError(res, error, "Erreur import");
        } finally {
            if (connection) connection.release();
        }
    }
}

module.exports = JournalController;