const pool = require('../../config/database');

class AttributionController {
    static async getAttributions(req, res) {
        const userId = req.user.id;
        try {
            const [rows] = await pool.execute(`
                SELECT a.*, sy.start_date, sy.end_date
                FROM ATTRIBUTIONS a
                JOIN SCHOOL_YEARS sy ON a.school_year_id = sy.id
                WHERE a.user_id = ?
            `, [userId]);
            res.json({ success: true, data: rows });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    static async createAttribution(req, res) {
        const userId = req.user.id;
        const { school_year_id, school_name, className, subject, esi_hours, ess_hours, color } = req.body;
        try {
            const [result] = await pool.execute(
                `INSERT INTO ATTRIBUTIONS (school_year_id, user_id, school_name, class, subject, esi_hours, ess_hours, color) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [school_year_id, userId, school_name, className, subject, esi_hours || 0, ess_hours || 0, color || '#3498db']
            );
            res.status(201).json({ success: true, id: result.insertId });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    static async deleteAttribution(req, res) {
        const { id } = req.params;
        const userId = req.user.id;
        try {
            const [result] = await pool.execute(
                'DELETE FROM ATTRIBUTIONS WHERE id = ? AND user_id = ?',
                [id, userId]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, message: "Attribution non trouvée ou non autorisée." });
            }

            res.json({ success: true, message: "Attribution supprimée avec succès." });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}
module.exports = AttributionController;