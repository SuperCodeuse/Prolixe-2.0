// backend/controllers/ScheduleHoursController.js
const pool = require('../../config/database');

class ScheduleHoursController {
    // --- Utilitaires privés ---
    static #sendError(res, message, status = 500, error = null) {
        return res.status(status).json({
            success: false,
            message,
            ...(error && { error: error.message })
        });
    }

    static #validateLibelle(libelle) {
        const timeSlotRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]-([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!libelle || typeof libelle !== 'string' || !timeSlotRegex.test(libelle)) {
            return { valid: false, message: 'Format invalide (attendu: HH:MM-HH:MM)' };
        }
        const [start, end] = libelle.split('-');
        if (start >= end) {
            return { valid: false, message: 'L’heure de fin doit être après l’heure de début' };
        }
        return { valid: true };
    }

    // --- Méthodes publiques ---

    static async getAllHours(req, res) {
        try {
            const [rows] = await pool.execute('SELECT * FROM SCH_HOURS ORDER BY libelle ASC');
            res.status(200).json({ success: true, data: rows });
        } catch (error) {
            ScheduleHoursController.#sendError(res, 'Erreur de récupération', 500, error);
        }
    }

    static async getHourById(req, res) {
        const { id } = req.params;
        if (isNaN(id)) return ScheduleHoursController.#sendError(res, 'ID invalide', 400);

        try {
            const [rows] = await pool.execute('SELECT * FROM SCH_HOURS WHERE id = ?', [id]);
            if (rows.length === 0) return ScheduleHoursController.#sendError(res, 'Créneau non trouvé', 404);

            res.status(200).json({ success: true, data: rows[0] });
        } catch (error) {
            ScheduleHoursController.#sendError(res, 'Erreur serveur', 500, error);
        }
    }

    static async createHour(req, res) {
        const { libelle } = req.body;

        // Validation format
        const check = ScheduleHoursController.#validateLibelle(libelle);
        if (!check.valid) return ScheduleHoursController.#sendError(res, check.message, 400);

        try {
            // Unicité et Insertion en une transaction ou vérification simple
            const [existing] = await pool.execute('SELECT id FROM SCH_HOURS WHERE libelle = ?', [libelle]);
            if (existing.length > 0) return ScheduleHoursController.#sendError(res, 'Ce créneau existe déjà', 409);

            const [result] = await pool.execute('INSERT INTO SCH_HOURS (libelle) VALUES (?)', [libelle]);

            res.status(201).json({
                success: true,
                data: { id: result.insertId, libelle },
                message: 'Créneau créé'
            });
        } catch (error) {
            ScheduleHoursController.#sendError(res, 'Erreur de création', 500, error);
        }
    }

    static async updateHour(req, res) {
        const { id } = req.params;
        const { libelle } = req.body;

        const check = ScheduleHoursController.#validateLibelle(libelle);
        if (!check.valid || isNaN(id)) return ScheduleHoursController.#sendError(res, check.message || 'ID invalide', 400);

        try {
            // Vérifier si le libellé est pris par UN AUTRE record
            const [conflict] = await pool.execute(
                'SELECT id FROM SCH_HOURS WHERE libelle = ? AND id != ?',
                [libelle, id]
            );
            if (conflict.length > 0) return ScheduleHoursController.#sendError(res, 'Ce libellé est déjà utilisé', 409);
            const [result] = await pool.execute('UPDATE SCH_HOURS SET libelle = ? WHERE id = ?', [libelle, id]);
            if (result.affectedRows === 0) return ScheduleHoursController.#sendError(res, 'Créneau non trouvé', 404);
            res.status(200).json({ success: true, data: { id: parseInt(id), libelle } });
        } catch (error) {
            ScheduleHoursController.#sendError(res, 'Erreur de mise à jour', 500, error);
        }
    }

    static async deleteHour(req, res) {
        const { id } = req.params;
        if (isNaN(id)) return ScheduleHoursController.#sendError(res, 'ID invalide', 400);

        try {
            const [result] = await pool.execute('DELETE FROM SCH_HOURS WHERE id = ?', [id]);
            if (result.affectedRows === 0) return ScheduleHoursController.#sendError(res, 'Créneau non trouvé', 404);

            res.status(200).json({ success: true, message: 'Supprimé avec succès' });
        } catch (error) {
            ScheduleHoursController.#sendError(res, 'Erreur de suppression', 500, error);
        }
    }
}

module.exports = ScheduleHoursController;