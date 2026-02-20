// backend/controllers/ResourceController.js
const pool = require('../../config/database');

class SubjectsController {
    // Matières
    static async getSubjects(req, res) {
        const [rows] = await pool.execute('SELECT * FROM SUBJECTS WHERE user_id = ?', [req.user.id]);
        res.json({ success: true, data: rows });
    }

    static async createSubject(req, res) {
        const { name, color_code } = req.body;
        const [result] = await pool.execute('INSERT INTO SUBJECTS (user_id, name, color_code) VALUES (?, ?, ?)', [req.user.id, name, color_code]);
        res.json({ success: true, id: result.insertId });
    }

    static async deleteSubject(req, res) {
        try {
            const { id } = req.params; // L'ID de la matière vient de l'URL (ex: /subjects/12)

            const [result] = await pool.execute(
                'DELETE FROM SUBJECTS WHERE id = ? AND user_id = ?',
                [id, req.user.id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Matière non trouvée ou vous n'avez pas l'autorisation."
                });
            }

            res.json({ success: true, message: "Matière supprimée avec succès" });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    static async updateSubject(req, res) {
        try {
            const { id } = req.params;
            const { name, color_code } = req.body;

            const [result] = await pool.execute(
                'UPDATE SUBJECTS SET name = ?, color_code = ? WHERE id = ? AND user_id = ?',
                [name, color_code, id, req.user.id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Matière non trouvée ou modification non autorisée."
                });
            }

            res.json({ success: true, message: "Matière mise à jour avec succès" });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }


}

module.exports = SubjectsController;