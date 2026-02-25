// server/src/controllers/EvaluationController.js
const db = require('../../config/database');

exports.getEvaluations = async (req, res) => {
    const { journalId } = req.query;
    let user_id = req.user.id;

    if (!journalId) {
        return res.status(400).json({ message: "L'ID du journal est requis." });
    }

    try {
        const [evaluations] = await db.query(`
            SELECT e.id, e.name, e.evaluation_date, e.journal_id, c.name as class_name, c.id as class_id, e.folder
            FROM EVALUATIONS e
                     JOIN CLASS c ON e.class_id = c.id
            WHERE e.journal_id = ? AND e.user_id = ?
            ORDER BY c.name, e.folder, e.evaluation_date DESC
        `, [journalId, user_id]);
        res.json({ success: true, data: evaluations });
    } catch (error) {
        console.error("Erreur dans getEvaluations:", error);
        res.status(500).json({ message: "Erreur serveur", error: error.message });
    }
};

exports.getEvaluationById = async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id;

    try {
        const [evaluationResult] = await db.query('SELECT * FROM EVALUATIONS WHERE id = ? AND user_id = ?', [id, user_id]);
        const evaluation = evaluationResult[0];

        if (!evaluation) {
            return res.status(404).json({ success: false, message: "Évaluation non trouvée ou accès refusé." });
        }

        const [criteria] = await db.query('SELECT id, label, max_score FROM EVALUATION_CRITERIA WHERE evaluation_id = ? ORDER BY id', [id]);

        res.json({ success: true, data: { ...evaluation, criteria } });
    } catch (error) {
        console.error("Erreur dans getEvaluationById:", error);
        res.status(500).json({ success: false, message: "Erreur serveur", error: error.message });
    }
};

exports.createEvaluation = async (req, res) => {
    const { name, class_id, journal_id, date, criteria, folder } = req.body;
    const user_id = req.user.id;

    if (!name || !class_id || !date || !journal_id || !Array.isArray(criteria) || criteria.length === 0) {
        return res.status(400).json({ success: false, message: "Les champs nom, classe, journal, date et au moins un critère sont requis." });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Vérification de l'appartenance du journal et de la classe à l'utilisateur
        const [journalCheck] = await connection.query('SELECT user_id FROM JOURNAL WHERE id = ? AND user_id = ?', [journal_id, user_id]);
        if (journalCheck.length === 0) {
            await connection.rollback();
            return res.status(403).json({ success: false, message: "Accès refusé. Journal non trouvé ou n'appartient pas à l'utilisateur." });
        }
        const [classCheck] = await connection.query('SELECT user_id FROM CLASSES WHERE id = ? AND user_id = ?', [class_id, user_id]);
        if (classCheck.length === 0) {
            await connection.rollback();
            return res.status(403).json({ success: false, message: "Accès refusé. Classe non trouvée ou n'appartient pas à l'utilisateur." });
        }


        const [evalResult] = await connection.query(
            'INSERT INTO EVALUATIONS (name, class_id, journal_id, evaluation_date, user_id, folder) VALUES (?, ?, ?, ?, ?, ?)',
            [name, class_id, journal_id, date, user_id, folder]
        );
        const evaluationId = evalResult.insertId;

        for (const criterion of criteria) {
            if (!criterion.label || criterion.max_score == null) {
                throw new Error("Chaque critère doit avoir un label et un score maximum.");
            }
            await connection.query(
                'INSERT INTO EVALUATION_CRITERIA (evaluation_id, label, max_score) VALUES (?, ?, ?)',
                [evaluationId, criterion.label, criterion.max_score]
            );
        }

        await connection.commit();

        const [newEvaluation] = await connection.query(
            'SELECT e.id, e.name, e.evaluation_date, c.name as class_name, e.folder FROM EVALUATIONS e JOIN CLASS c ON e.class_id = c.id WHERE e.id = ? AND e.user_id = ?',
            [evaluationId, user_id]
        );

        res.status(201).json({ success: true, message: "Évaluation créée avec succès.", data: newEvaluation[0] });
    } catch (error) {
        await connection.rollback();
        console.error("Erreur dans createEvaluation:", error);
        res.status(500).json({ success: false, message: "Erreur serveur", error: error.message });
    } finally {
        connection.release();
    }
};

exports.getEvaluationForGrading = async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id;

    try {
        const [evaluationResult] = await db.query('SELECT e.*, c.name as class_name FROM EVALUATIONS e JOIN CLASS c ON e.class_id = c.id WHERE e.id = ? AND e.user_id = ?', [id, user_id]);
        const evaluation = evaluationResult[0];

        if (!evaluation) {
            return res.status(404).json({ message: "Évaluation non trouvée ou accès refusé." });
        }

        const [criteria] = await db.query('SELECT * FROM EVALUATION_CRITERIA WHERE evaluation_id = ? ORDER BY id', [id]);
        const [students] = await db.query('SELECT * FROM STUDENTS WHERE class_id = ? ORDER BY lastname, firstname', [evaluation.class_id]);


        const [grades] = await db.query(
            `SELECT sg.student_id, sg.criterion_id, sg.score, sg.comment, sg.is_absent
             FROM STUDENT_GRADES sg
             JOIN EVALUATION_CRITERIA ec ON sg.criterion_id = ec.id
             WHERE ec.evaluation_id = ?`,
            [id]
        );

        res.json({ success: true, data: { evaluation, criteria, students, grades } });
    } catch (error) {
        console.error("Erreur dans getEvaluationForGrading:", error);
        res.status(500).json({ success: false, message: "Erreur serveur", error: error.message });
    }
};

// Sauvegarder/Mettre à jour les notes
exports.saveGrades = async (req, res) => {
    const { evaluationId } = req.params;
    const { grades } = req.body;
    const user_id = req.user.id;


    if (!grades || !Array.isArray(grades)) {
        return res.status(400).json({ message: "Le format des notes est incorrect." });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Vérification de l'appartenance de l'évaluation à l'utilisateur
        const [evaluationCheck] = await connection.query('SELECT user_id FROM EVALUATIONS WHERE id = ? AND user_id = ?', [evaluationId, user_id]);
        if (evaluationCheck.length === 0) {
            await connection.rollback();
            return res.status(403).json({ success: false, message: "Accès refusé. Évaluation non trouvée ou n'appartient pas à l'utilisateur." });
        }

        for (const grade of grades) {
            await connection.query(
                `INSERT INTO STUDENT_GRADES (student_id, criterion_id, score, comment, is_absent)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE score = VALUES(score), comment = VALUES(comment), is_absent = VALUES(is_absent)`,
                [grade.student_id, grade.criterion_id, grade.score, grade.comment || null, grade.is_absent]
            );
        }

        await connection.commit();
        res.status(200).json({ message: "Notes sauvegardées avec succès." });
    } catch (error) {
        await connection.rollback();
        console.error("Erreur dans saveGrades:", error);
        res.status(500).json({ message: "Erreur lors de la sauvegarde", error: error.message });
    } finally {
        connection.release();
    }
};

exports.updateEvaluation = async (req, res) => {
    const { id } = req.params;
    // Les critères reçus doivent inclure l'ID si le critère existe déjà
    const { name, date, criteria, folder } = req.body;
    const user_id = req.user.id;

    if (!name || !date || !Array.isArray(criteria)) {
        return res.status(400).json({ success: false, message: "Les champs nom, date et critères sont requis." });
    }

    // Assurez-vous que 'db' est correctement importé ou défini dans votre module
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Vérification de l'appartenance de l'évaluation à l'utilisateur
        const [evaluationCheck] = await connection.query('SELECT user_id FROM EVALUATIONS WHERE id = ? AND user_id = ?', [id, user_id]);
        if (evaluationCheck.length === 0) {
            await connection.rollback();
            return res.status(403).json({ success: false, message: "Accès refusé. Évaluation non trouvée ou n'appartient pas à l'utilisateur." });
        }

        // 2. Mise à jour de l'évaluation (nom, date, dossier)
        await connection.query(
            'UPDATE EVALUATIONS SET name = ?, evaluation_date = ?, folder = ? WHERE id = ? AND user_id = ?',
            [name, date, folder, id, user_id]
        );

        // 3. Récupération des critères existants
        const [existingCriteria] = await connection.query(
            'SELECT id, label, max_score FROM EVALUATION_CRITERIA WHERE evaluation_id = ?',
            [id]
        );

        // Map des critères existants pour un lookup rapide
        const existingCriteriaMap = new Map();
        existingCriteria.forEach(c => {
            existingCriteriaMap.set(c.id.toString(), c);
        });

        const idsOfCriteriaToKeep = new Set();
        const criteriaToInsert = [];

        // 4. Parcours des critères reçus: Update ou Insert
        for (const criterion of criteria) {
            // Validation
            if (!criterion.label || criterion.max_score == null) {
                throw new Error("Chaque critère doit avoir un label et un score maximum.");
            }

            const criterionId = criterion.id ? criterion.id.toString() : null;
            const existingCriterion = criterionId ? existingCriteriaMap.get(criterionId) : null;
            const newMaxScore = parseFloat(criterion.max_score); // Assurer que le score est un nombre

            if (existingCriterion) {
                // Critère existant: Vérifier si une mise à jour est nécessaire
                const existingMaxScore = parseFloat(existingCriterion.max_score);

                // Vérifier si le label ou le score maximum a changé
                if (existingCriterion.label !== criterion.label || existingMaxScore !== newMaxScore) {
                    await connection.query(
                        'UPDATE EVALUATION_CRITERIA SET label = ?, max_score = ? WHERE id = ?',
                        [criterion.label, newMaxScore, criterionId]
                    );
                }

                // Marquer l'ID comme conservé pour éviter la suppression
                idsOfCriteriaToKeep.add(criterionId);
            } else {
                // Nouveau critère: l'ajouter à la liste d'insertion
                criteriaToInsert.push([id, criterion.label, newMaxScore]);
            }
        }

        // Insertion des nouveaux critères (bulk insert pour l'efficacité)
        if (criteriaToInsert.length > 0) {
            const placeholders = criteriaToInsert.map(() => '(?, ?, ?)').join(', ');
            const flatValues = criteriaToInsert.flat();

            await connection.query(
                `INSERT INTO EVALUATION_CRITERIA (evaluation_id, label, max_score) VALUES ${placeholders}`,
                flatValues
            );
        }

        // 5. Suppression des anciens critères qui ont été retirés
        const idsToDelete = existingCriteria
            .filter(c => !idsOfCriteriaToKeep.has(c.id.toString()))
            .map(c => c.id);

        if (idsToDelete.length > 0) {
            // Suppression en masse pour les critères non présents dans la nouvelle liste
            await connection.query(
                'DELETE FROM EVALUATION_CRITERIA WHERE id IN (?)',
                [idsToDelete]
            );
        }

        await connection.commit();

        // 6. Récupérer et retourner l'évaluation mise à jour
        const [updatedEvaluation] = await connection.query(
            'SELECT e.id, e.name, e.evaluation_date, e.journal_id, c.name as class_name, e.folder FROM EVALUATIONS e JOIN CLASS c ON e.class_id = c.id WHERE e.id = ? AND e.user_id = ?',
            [id, user_id]
        );

        res.status(200).json({ success: true, message: "Évaluation mise à jour.", data: updatedEvaluation[0] });

    } catch (error) {
        await connection.rollback();
        console.error("Erreur dans updateEvaluation:", error);
        res.status(500).json({ success: false, message: "Erreur serveur", error: error.message });
    } finally {
        connection.release();
    }
};
exports.deleteEvaluation = async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id;

    try {
        const [result] = await db.query('DELETE FROM EVALUATIONS WHERE id = ? AND user_id = ?', [id, user_id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Évaluation non trouvée ou accès refusé." });
        }
        res.status(200).json({ success: true, message: 'Évaluation supprimée avec succès.' });
    } catch (error) {
        console.error("Erreur dans deleteEvaluation:", error);
        res.status(500).json({ success: false, message: "Erreur lors de la suppression de l'évaluation.", error: error.message });
    }
};

exports.getEvaluationTemplates = async (req, res) => {
    const user_id = req.user.id;

    try {
        const query = `
            SELECT e.id, e.name, j.name as journal_name
            FROM EVALUATIONS e
                     JOIN JOURNAL j ON e.journal_id = j.id
            WHERE e.user_id = ?
            ORDER BY j.name ASC, e.name ASC;
        `;
        const [templates] = await db.query(query, [user_id]);
        res.json({ success: true, data: templates });
    } catch (error) {
        console.error("Erreur dans getEvaluationTemplates:", error);
        res.status(500).json({ success: false, message: "Erreur serveur", error: error.message });
    }
};