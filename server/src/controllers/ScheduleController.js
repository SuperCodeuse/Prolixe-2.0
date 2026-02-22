// backend/controllers/ScheduleController.js
const pool = require('../../config/database');

class ScheduleController {

    static async createScheduleSet(req, res) {
        const { name, journal_id } = req.body;
        const userId = req.user.id;

        if (!name || !journal_id) {
            return res.status(400).json({
                success: false,
                message: "Le nom et l'ID du journal sont requis."
            });
        }

        try {
            const [result] = await pool.execute(
                'INSERT INTO SCHEDULE_SETS (user_id, journal_id, name) VALUES (?, ?, ?)',
                [userId, journal_id, name]
            );
            res.status(201).json({ success: true, id: result.insertId, name, journal_id });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message || 'Erreur lors de la création'
            });
        }
    }

    /**
     * Récupère la liste de tous les emplois du temps créés par l'utilisateur
     */
    static async getUserSchedules(req, res) {
        const userId = req.user.id;
        try {
            const [rows] = await pool.execute(
                'SELECT * FROM SCHEDULE_SETS WHERE user_id = ?',
                [userId]
            );
            res.json({ success: true, data: rows });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message || 'Erreur lors de la récupération des emplois du temps' });
        }
    }

    static async saveSlots(req, res) {
        const { schedule_set_id, slots } = req.body;
        let connection;

        if (!schedule_set_id) {
            return res.status(400).json({ success: false, message: "ID de l'ensemble d'horaires manquant." });
        }

        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            // Suppression des anciens créneaux pour ce set
            await connection.execute(
                'DELETE FROM SCHEDULE_SLOTS WHERE schedule_set_id = ?',
                [schedule_set_id]
            );

            if (slots && slots.length > 0) {
                // Préparation des données avec les nouvelles FK
                const values = slots.map(s => [
                    schedule_set_id,
                    s.day_of_week,
                    s.time_slot_id,
                    s.class_id || null,   // Nouvelle colonne
                    s.subject_id || null, // Nouvelle colonne
                    s.room || null
                ]);

                // Insertion en masse
                await connection.query(
                    'INSERT INTO SCHEDULE_SLOTS (schedule_set_id, day_of_week, time_slot_id, class_id, subject_id, room) VALUES ?',
                    [values]
                );
            }

            await connection.commit();
            res.json({ success: true, message: "Emploi du temps sauvegardé avec succès." });

        } catch (error) {
            if (connection) await connection.rollback();
            console.error("Erreur saveSlots:", error);
            res.status(500).json({ success: false, message: "Erreur lors de la sauvegarde des créneaux", error: error.message });
        } finally {
            if (connection) connection.release();
        }
    }

    /**
     * Récupère un emploi du temps complet avec les détails des attributions (Matière, Classe, etc.)
     */
    static async getFullSchedule(req, res) {
        const { id } = req.params; // ID du SCHEDULE_SET
        const userId = req.user.id;

        try {
            // Vérification de la propriété du set
            const [sets] = await pool.execute(
                'SELECT id FROM SCHEDULE_SETS WHERE id = ? AND user_id = ?',
                [id, userId]
            );

            if (sets.length === 0) {
                return res.status(404).json({ success: false, message: "Emploi du temps non trouvé." });
            }

            // Récupération des slots avec les infos des classes et matières
            const [rows] = await pool.execute(`
                SELECT
                    ss.id as slot_id,
                    ss.day_of_week,
                    ss.time_slot_id,
                    ss.room,
                    ss.class_id,
                    ss.subject_id,
                    sh.libelle as time_label,
                    c.name as class_name,
                    c.level as class_level,
                    sbj.name as subject_name,
                    sbj.color_code as subject_color
                FROM SCHEDULE_SLOTS ss
                         JOIN SCH_HOURS sh ON ss.time_slot_id = sh.id
                         LEFT JOIN CLASSES c ON ss.class_id = c.id
                         LEFT JOIN SUBJECTS sbj ON ss.subject_id = sbj.id
                WHERE ss.schedule_set_id = ?
                ORDER BY ss.day_of_week
            `, [id]);

            res.json({ success: true, data: rows });
        } catch (error) {
            console.error("Erreur getFullSchedule:", error);
            res.status(500).json({ success: false, message: "Erreur lors de la récupération", error: error.message });
        }
    }

    // server/src/controllers/ScheduleController.js

    static async duplicateScheduleSet(req, res) {
        const { id } = req.params; // ID de l'horaire à copier
        const { newName } = req.body;
        const userId = req.user.id;
        let connection;

        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            // 1. Récupérer l'ancien set pour avoir le journal_id
            const [oldSets] = await connection.execute(
                'SELECT journal_id FROM SCHEDULE_SETS WHERE id = ? AND user_id = ?',
                [id, userId]
            );

            if (oldSets.length === 0) {
                await connection.rollback();
                return res.status(404).json({ success: false, message: "Horaire original non trouvé." });
            }

            const journalId = oldSets[0].journal_id;

            // 2. Créer le nouveau set
            const [result] = await connection.execute(
                'INSERT INTO SCHEDULE_SETS (user_id, journal_id, name) VALUES (?, ?, ?)',
                [userId, journalId, newName || `Copie de ${id}`]
            );
            const newSetId = result.insertId;

            // 3. Copier les créneaux (slots)
            await connection.execute(`
            INSERT INTO SCHEDULE_SLOTS (schedule_set_id, day_of_week, time_slot_id, class_id, subject_id, room)
            SELECT ?, day_of_week, time_slot_id, class_id, subject_id, room
            FROM SCHEDULE_SLOTS
            WHERE schedule_set_id = ?
        `, [newSetId, id]);

            await connection.commit();
            res.status(201).json({ success: true, id: newSetId, name: newName });

        } catch (error) {
            if (connection) await connection.rollback();
            res.status(500).json({ success: false, message: error.message });
        } finally {
            if (connection) connection.release();
        }
    }

    // server/src/controllers/ScheduleController.js

    static async deleteScheduleSet(req, res) {
        const { id } = req.params;
        const userId = req.user.id;
        let connection;

        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            // 1. Vérifier que l'horaire appartient bien à l'utilisateur
            const [sets] = await connection.execute(
                'SELECT id FROM SCHEDULE_SETS WHERE id = ? AND user_id = ?',
                [id, userId]
            );

            if (sets.length === 0) {
                await connection.rollback();
                return res.status(404).json({ success: false, message: "Horaire non trouvé ou accès refusé." });
            }

            // 2. Supprimer les créneaux (slots) associés
            await connection.execute(
                'DELETE FROM SCHEDULE_SLOTS WHERE schedule_set_id = ?',
                [id]
            );

            // 3. Supprimer le set lui-même
            await connection.execute(
                'DELETE FROM SCHEDULE_SETS WHERE id = ?',
                [id]
            );

            await connection.commit();
            res.json({ success: true, message: "Emploi du temps supprimé avec succès." });

        } catch (error) {
            if (connection) await connection.rollback();
            res.status(500).json({ success: false, message: error.message });
        } finally {
            if (connection) connection.release();
        }
    }

}

module.exports = ScheduleController;