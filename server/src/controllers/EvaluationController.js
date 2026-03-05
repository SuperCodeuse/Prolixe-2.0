// server/src/controllers/EvaluationController.js
const db = require('../../config/database');

/**
 * Récupère toutes les évaluations d'un journal spécifique.
 */
exports.getEvaluations = async (req, res) => {
    const { journalId } = req.query;
    const user_id = req.user.id;

    if (!journalId) {
        return res.status(400).json({ message: "L'ID du journal est requis." });
    }

    try {
        const [evaluations] = await db.query(`
            SELECT e.*, c.name as class_name, s.name as subject_name 
            FROM EVALUATIONS e
            JOIN CLASSES c ON e.class_id = c.id
            JOIN JOURNALS j ON e.journal_id = j.id
            LEFT JOIN SUBJECTS s ON e.subject_id = s.id
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
 * Récupère une évaluation avec ses critères et ses notes.
 */
exports.getEvaluationById = async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id;

    try {
        // 1. Récupérer l'entête de l'évaluation
        const [evaluationResult] = await db.query(`
            SELECT e.*, c.name as class_name 
            FROM EVALUATIONS e
            JOIN JOURNALS j ON e.journal_id = j.id
            JOIN CLASSES c ON e.class_id = c.id
            WHERE e.id = ? AND j.user_id = ?
        `, [id, user_id]);

        if (evaluationResult.length === 0) {
            return res.status(404).json({ success: false, message: "Évaluation non trouvée." });
        }

        const evaluation = evaluationResult[0];

        // 2. Récupérer les critères (ordonnés)
        const [criteria] = await db.query(`
            SELECT * FROM EVALUATION_CRITERIA 
            WHERE evaluation_id = ? 
            ORDER BY display_order ASC
        `, [id]);

        res.json({ success: true, data: { ...evaluation, criteria } });
    } catch (error) {
        console.error("Erreur dans getEvaluationById:", error);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
};

/**
 * Crée une évaluation ET ses critères associés (Transaction).
 */
exports.createEvaluation = async (req, res) => {
    const {
        title, class_id, journal_id, subject_id, journal_entry_id,
        evaluation_date, max_score, global_comment, criteria, folder
    } = req.body;
    const user_id = req.user.id;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Vérification de sécurité sur le journal
        const [journal] = await connection.query('SELECT id FROM JOURNALS WHERE id = ? AND user_id = ?', [journal_id, user_id]);
        if (journal.length === 0) throw new Error("Accès refusé au journal.");

        // 1. Insertion de l'évaluation
        const [result] = await connection.query(
            `INSERT INTO EVALUATIONS
             (title, class_id, journal_id, subject_id, journal_entry_id, evaluation_date, max_score, global_comment, is_completed, is_corrected, folder)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, class_id, journal_id, subject_id, journal_entry_id, evaluation_date, max_score || 20, global_comment, false, false, folder || null]
        );

        const evaluationId = result.insertId;

        // 2. Insertion des critères
        if (criteria && Array.isArray(criteria)) {
            for (let i = 0; i < criteria.length; i++) {
                const c = criteria[i];
                await connection.query(
                    `INSERT INTO EVALUATION_CRITERIA (evaluation_id, name, description, max_points, display_order) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [evaluationId, c.name, c.description || null, c.max_points, c.display_order || i]
                );
            }
        }

        await connection.commit();
        res.status(201).json({ success: true, message: "Évaluation et critères créés.", id: evaluationId });
    } catch (error) {
        await connection.rollback();
        console.error("Erreur dans createEvaluation:", error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        connection.release();
    }
};

/**
 * Récupère tout le nécessaire pour l'encodage des points (élèves + critères + notes existantes).
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

        if (evals.length === 0) return res.status(404).json({ message: "Évaluation introuvable." });

        const evaluation = evals[0];

        // Élèves de la classe
        const [students] = await db.query('SELECT id, firstname, lastname FROM STUDENTS WHERE class_id = ? ORDER BY lastname, firstname', [evaluation.class_id]);

        // Structure des critères
        const [criteria] = await db.query('SELECT * FROM EVALUATION_CRITERIA WHERE evaluation_id = ? ORDER BY display_order', [id]);

        // Notes globales (absences, score total)
        const [grades] = await db.query('SELECT * FROM STUDENT_GRADES WHERE evaluation_id = ?', [id]);

        // Détails par critère
        const [criteriaGrades] = await db.query(`
            SELECT scg.* FROM STUDENT_CRITERIA_GRADES scg
            JOIN EVALUATION_CRITERIA ec ON scg.criterion_id = ec.id
            WHERE ec.evaluation_id = ?
        `, [id]);

        res.json({
            success: true,
            data: { evaluation, students, criteria, grades, criteriaGrades }
        });
    } catch (error) {
        console.error("Erreur dans getEvaluationForGrading:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Sauvegarde massive des notes (Global + Par Critère).
 */
exports.saveDetailedGrades = async (req, res) => {
    const { evaluationId } = req.params;
    const { studentGrades, is_corrected, is_completed } = req.body;
    const user_id = req.user.id;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Sécurité
        const [check] = await connection.query(`
            SELECT e.id FROM EVALUATIONS e JOIN JOURNALS j ON e.journal_id = j.id 
            WHERE e.id = ? AND j.user_id = ?
        `, [evaluationId, user_id]);
        if (check.length === 0) throw new Error("Accès refusé.");

        for (const sg of studentGrades) {
            // 1. Table STUDENT_GRADES (Note globale et absence)
            await connection.query(`
                INSERT INTO STUDENT_GRADES (evaluation_id, student_id, score, is_absent)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE score = VALUES(score), is_absent = VALUES(is_absent)
            `, [evaluationId, sg.student_id, sg.total_score, sg.is_absent || false]);

            // 2. Table STUDENT_CRITERIA_GRADES (Détail par critère)
            if (sg.criteria_scores && Array.isArray(sg.criteria_scores)) {
                for (const cs of sg.criteria_scores) {
                    await connection.query(`
                        INSERT INTO STUDENT_CRITERIA_GRADES (student_id, criterion_id, score_obtained, comment)
                        VALUES (?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE score_obtained = VALUES(score_obtained), comment = VALUES(comment)
                    `, [sg.student_id, cs.criterion_id, cs.score, cs.comment || null]);
                }
            }
        }

        // 3. Mise à jour du statut de l'évaluation
        await connection.query(
            `UPDATE EVALUATIONS SET is_completed = ?, is_corrected = ? WHERE id = ?`,
            [is_completed ?? true, is_corrected ?? true, evaluationId]
        );

        await connection.commit();
        res.json({ success: true, message: "Notes détaillées enregistrées." });
    } catch (error) {
        await connection.rollback();
        console.error("Erreur dans saveDetailedGrades:", error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        connection.release();
    }
};

/**
 * Mise à jour des infos et/ou des critères.
 */
exports.updateEvaluation = async (req, res) => {
    const { id } = req.params;
    const { title, evaluation_date, max_score, global_comment, is_completed, is_corrected, criteria, folder } = req.body;
    const user_id = req.user.id;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [result] = await connection.query(`
            UPDATE EVALUATIONS e
                JOIN JOURNALS j ON e.journal_id = j.id
                SET e.title = ?, e.evaluation_date = ?, e.max_score = ?, e.global_comment = ?, e.is_completed = ?, e.is_corrected = ?, e.folder = ?
            WHERE e.id = ? AND j.user_id = ?
        `, [title, evaluation_date, max_score, global_comment, is_completed, is_corrected, folder, id, user_id]);

        if (result.affectedRows === 0) throw new Error("Évaluation non trouvée.");

        // Si des critères sont fournis, on peut soit les mettre à jour, soit les remplacer
        // Ici, une approche simple : on met à jour si l'ID existe, sinon on ignore ou on gère selon tes besoins.
        if (criteria && Array.isArray(criteria)) {
            for (const c of criteria) {
                if (c.id) {
                    await connection.query(
                        `UPDATE EVALUATION_CRITERIA SET name = ?, description = ?, max_points = ?, display_order = ? WHERE id = ? AND evaluation_id = ?`,
                        [c.name, c.description, c.max_points, c.display_order, c.id, id]
                    );
                }
            }
        }

        await connection.commit();
        res.json({ success: true, message: "Mise à jour réussie." });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ success: false, error: error.message });
    } finally {
        connection.release();
    }
};

/**
 * Suppression.
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

        if (result.affectedRows === 0) return res.status(404).json({ message: "Évaluation non trouvée." });
        res.json({ success: true, message: "Suppression réussie." });
    } catch (error) {
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
            SELECT 
                e.id, 
                e.title, 
                e.max_score,
                j.name as journal_name,
                (SELECT COUNT(*) FROM EVALUATION_CRITERIA ec WHERE ec.evaluation_id = e.id) as criteria_count
            FROM EVALUATIONS e
            JOIN JOURNALS j ON e.journal_id = j.id
            WHERE j.user_id = ?
        `;
        const [templates] = await db.query(query, [user_id]);
        res.json({ success: true, data: templates });
    } catch (error) {
        console.error("Erreur dans getEvaluationTemplates:", error);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
};