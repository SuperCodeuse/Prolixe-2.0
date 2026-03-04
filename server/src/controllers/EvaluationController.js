// server/src/controllers/EvaluationController.js
const db = require('../../config/database');

/**
 * Récupère toutes les évaluations d'un journal spécifique.
 * La sécurité est assurée par la jointure avec JOURNALS (user_id).
 */
exports.getEvaluations = async (req, res) => {
    const { journalId } = req.query;
    const user_id = req.user.id;

    if (!journalId) {
        return res.status(400).json({ message: "L'ID du journal est requis." });
    }

    try {
        const [evaluations] = await db.query(`
            SELECT e.*, c.name as class_name 
            FROM EVALUATIONS e
            JOIN CLASSES c ON e.class_id = c.id
            JOIN JOURNALS j ON e.journal_id = j.id
            WHERE e.journal_id = ? AND j.user_id = ?
            ORDER BY e.evaluation_date DESC
        `, [journalId, user_id]);

        res.json({ success: true, data: evaluations });
    } catch (error) {
        console.error("Erreur dans getEvaluations:", error);
        res.status(500).json({ message: "Erreur serveur", error: error.message });
    }
};

/**
 * Récupère une évaluation précise par son ID.
 */
exports.getEvaluationById = async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id;

    try {
        const [evaluationResult] = await db.query(`
            SELECT e.*, c.name as class_name 
            FROM EVALUATIONS e
            JOIN JOURNALS j ON e.journal_id = j.id
            JOIN CLASSES c ON e.class_id = c.id
            WHERE e.id = ? AND j.user_id = ?
        `, [id, user_id]);

        if (evaluationResult.length === 0) {
            return res.status(404).json({ success: false, message: "Évaluation non trouvée ou accès refusé." });
        }

        res.json({ success: true, data: evaluationResult[0] });
    } catch (error) {
        console.error("Erreur dans getEvaluationById:", error);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
};

/**
 * Crée une nouvelle évaluation.
 */
exports.createEvaluation = async (req, res) => {
    const { title, class_id, journal_id, evaluation_date, max_score, criteria_order } = req.body;
    const user_id = req.user.id;

    if (!title || !class_id || !journal_id || !evaluation_date) {
        return res.status(400).json({ success: false, message: "Champs obligatoires manquants." });
    }

    try {
        // Vérification de sécurité : le journal doit appartenir à l'utilisateur
        const [journal] = await db.query('SELECT id FROM JOURNALS WHERE id = ? AND user_id = ?', [journal_id, user_id]);
        if (journal.length === 0) {
            return res.status(403).json({ success: false, message: "Journal invalide ou accès refusé." });
        }

        const [result] = await db.query(
            `INSERT INTO EVALUATIONS (title, class_id, journal_id, evaluation_date, max_score, criteria_order, is_completed) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [title, class_id, journal_id, evaluation_date, max_score || 20, criteria_order || null, false]
        );

        res.status(201).json({ success: true, message: "Évaluation créée.", id: result.insertId });
    } catch (error) {
        console.error("Erreur dans createEvaluation:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Récupère les données nécessaires pour saisir les notes (élèves + notes existantes).
 */
exports.getEvaluationForGrading = async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id;

    try {
        const [evals] = await db.query(`
            SELECT e.*, c.name as class_name 
            FROM EVALUATIONS e 
            JOIN JOURNALS j ON e.journal_id = j.id
            JOIN CLASSES c ON e.class_id = c.id
            WHERE e.id = ? AND j.user_id = ?
        `, [id, user_id]);

        if (evals.length === 0) {
            return res.status(404).json({ message: "Évaluation introuvable." });
        }

        const evaluation = evals[0];
        // Récupération des élèves de la classe
        const [students] = await db.query('SELECT id, firstname, lastname FROM STUDENTS WHERE class_id = ? ORDER BY lastname, firstname', [evaluation.class_id]);
        // Récupération des notes déjà saisies
        const [grades] = await db.query('SELECT * FROM STUDENT_GRADES WHERE evaluation_id = ?', [id]);

        res.json({ success: true, data: { evaluation, students, grades } });
    } catch (error) {
        console.error("Erreur dans getEvaluationForGrading:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Sauvegarde les notes des élèves (bulk insert/update).
 */
exports.saveGrades = async (req, res) => {
    const { evaluationId } = req.params;
    const { grades } = req.body;
    const user_id = req.user.id;

    if (!Array.isArray(grades)) {
        return res.status(400).json({ message: "Le format des notes est incorrect." });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Sécurité : Vérifier si l'évaluation appartient bien au user via le journal
        const [check] = await connection.query(`
            SELECT e.id FROM EVALUATIONS e JOIN JOURNALS j ON e.journal_id = j.id 
            WHERE e.id = ? AND j.user_id = ?
        `, [evaluationId, user_id]);

        if (check.length === 0) throw new Error("Accès refusé.");

        for (const g of grades) {
            await connection.query(`
                INSERT INTO STUDENT_GRADES (evaluation_id, student_id, score, is_absent, comment)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE score = VALUES(score), is_absent = VALUES(is_absent), comment = VALUES(comment)
            `, [evaluationId, g.student_id, g.score, g.is_absent || false, g.comment || null]);
        }

        await connection.commit();
        res.json({ success: true, message: "Notes enregistrées avec succès." });
    } catch (error) {
        await connection.rollback();
        console.error("Erreur dans saveGrades:", error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        connection.release();
    }
};

/**
 * Met à jour les informations d'une évaluation.
 */
exports.updateEvaluation = async (req, res) => {
    const { id } = req.params;
    const { title, evaluation_date, max_score, criteria_order, is_completed } = req.body;
    const user_id = req.user.id;

    try {
        const [result] = await db.query(`
            UPDATE EVALUATIONS e
            JOIN JOURNALS j ON e.journal_id = j.id
            SET e.title = ?, e.evaluation_date = ?, e.max_score = ?, e.criteria_order = ?, e.is_completed = ?
            WHERE e.id = ? AND j.user_id = ?
        `, [title, evaluation_date, max_score, criteria_order, is_completed, id, user_id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Évaluation non trouvée ou accès refusé." });
        }
        res.json({ success: true, message: "Mise à jour réussie." });
    } catch (error) {
        console.error("Erreur dans updateEvaluation:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Supprime une évaluation (les STUDENT_GRADES devraient être supprimés par ON DELETE CASCADE).
 */
exports.deleteEvaluation = async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id;

    try {
        const [result] = await db.query(`
            DELETE e FROM EVALUATIONS e
            JOIN JOURNALS j ON e.journal_id = j.id
            WHERE e.id = ? AND j.user_id = ?
        `, [id, user_id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Évaluation non trouvée." });
        }
        res.json({ success: true, message: "Suppression réussie." });
    } catch (error) {
        console.error("Erreur dans deleteEvaluation:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Liste les modèles ou anciennes évaluations pour duplication.
 */
exports.getEvaluationTemplates = async (req, res) => {
    const user_id = req.user.id;

    try {
        const query = `
            SELECT e.id, e.title, j.name as journal_name
            FROM EVALUATIONS e
            JOIN JOURNALS j ON e.journal_id = j.id
            WHERE j.user_id = ?
            ORDER BY j.name ASC, e.title ASC
        `;
        const [templates] = await db.query(query, [user_id]);
        res.json({ success: true, data: templates });
    } catch (error) {
        console.error("Erreur dans getEvaluationTemplates:", error);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
};