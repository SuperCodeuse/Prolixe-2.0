// backend/controllers/ScheduleController.js
const pool = require('../../config/database');

class ScheduleController {

    static async createScheduleSet(req, res) {
        const { name } = req.body;
        const userId = req.user.id;

        if (!name) {
            return res.status(400).json({ success: false, message: "Le nom de l'emploi du temps est requis." });
        }

        try {
            const [result] = await pool.execute(
                'INSERT INTO SCHEDULE_SETS (user_id, name) VALUES (?, ?)',
                [userId, name]
            );
            res.status(201).json({ success: true, id: result.insertId, name });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message || 'Erreur lors de la création de l\'emploi du temps' });
        }
    }

    /**
     * Récupère la liste de tous les emplois du temps créés par l'utilisateur
     */
    static async getUserSchedules(req, res) {
        const userId = req.user.id;
        try {
            const [rows] = await pool.execute(
                'SELECT * FROM SCHEDULE_SETS WHERE user_id = ? ORDER BY created_at DESC',
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

            await connection.execute(
                'DELETE FROM SCHEDULE_SLOTS WHERE schedule_set_id = ?',
                [schedule_set_id]
            );

            if (slots && slots.length > 0) {
                const values = slots.map(s => [
                    schedule_set_id,
                    s.day_of_week,
                    s.time_slot_id,
                    s.attribution_id,
                    s.room || null
                ]);

                await connection.query(
                    'INSERT INTO SCHEDULE_SLOTS (schedule_set_id, day_of_week, time_slot_id, attribution_id, room) VALUES ?',
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
            const [sets] = await pool.execute(
                'SELECT id FROM SCHEDULE_SETS WHERE id = ? AND user_id = ?',
                [id, userId]
            );

            if (sets.length === 0) {
                return res.status(404).json({ success: false, message: "Emploi du temps non trouvé." });
            }

            const [rows] = await pool.execute(`
                SELECT 
                    ss.id as slot_id,
                    ss.day_of_week,
                    ss.time_slot_id,
                    ss.room,
                    sh.libelle as time_label,
                    a.subject,
                    a.class,
                    a.color
                FROM SCHEDULE_SLOTS ss
                JOIN SCHEDULE_HOURS sh ON ss.time_slot_id = sh.id
                JOIN ATTRIBUTIONS a ON ss.attribution_id = a.id
                WHERE ss.schedule_set_id = ?
            `, [id]);

            res.json({ success: true, data: rows });
        } catch (error) {
            res.status(500).json({ success: false, message: "Erreur lors de la récupération du détail de l'horaire", error: error.message });
        }
    }
}

module.exports = ScheduleController;