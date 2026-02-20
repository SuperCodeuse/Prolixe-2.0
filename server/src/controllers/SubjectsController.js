// backend/controllers/ResourceController.js
const pool = require('../../config/database');

class SubjectsController {
    // Matières
    static async getSubjects(req, res) {
        const [rows] = await pool.execute('SELECT * FROM SUBJECTS WHERE user_id = ?', [req.user.id]);
        res.json({ success: true, data: rows });
    }

    static async createSubject(req, res) {
        const { name, color } = req.body;
        const [result] = await pool.execute('INSERT INTO SUBJECTS (user_id, name, color_code) VALUES (?, ?, ?)', [req.user.id, name, color]);
        res.json({ success: true, id: result.insertId });
    }

    // Classes
    static async getClasses(req, res) {
        const [rows] = await pool.execute('SELECT * FROM CLASSES WHERE user_id = ?', [req.user.id]);
        res.json({ success: true, data: rows });
    }

    static async createClass(req, res) {
        const { name } = req.body;
        const [result] = await pool.execute('INSERT INTO CLASSES (user_id, name) VALUES (?, ?)', [req.user.id, name]);
        res.json({ success: true, id: result.insertId });
    }
}