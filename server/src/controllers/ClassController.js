const pool = require('../../config/database');

class ClassController {
    /**
     * Méthode utilitaire pour acquérir et libérer une connexion de pool.
     */
    static async withConnection(operation) {
        let connection;
        try {
            connection = await pool.getConnection();
            return await operation(connection);
        } catch (error) {
            console.error('Erreur SQL dans withConnection:', error.message);
            throw error;
        } finally {
            if (connection) connection.release();
        }
    }

    /**
     * Gère et standardise les réponses d'erreur HTTP.
     */
    static handleError(res, error, defaultMessage = 'Erreur serveur', statusCode = 500, customErrors = {}) {
        const errorMessage = process.env.NODE_ENV === 'development' ? error.message : defaultMessage;
        console.error(`❌ Erreur dans ClassController: ${defaultMessage}`, error);

        res.status(statusCode).json({
            success: false,
            message: defaultMessage,
            error: errorMessage,
            errors: customErrors
        });
    }

    /**
     * Valide les données d'entrée selon le diagramme (id, journal_id, name, level).
     */
    static validateClassData(data, isUpdate = false) {
        const errors = {};

        if (!isUpdate || data.name !== undefined) {
            if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
                errors.name = 'Le nom de la classe est requis.';
            } else if (data.name.trim().length > 100) {
                errors.name = 'Le nom ne peut pas dépasser 100 caractères.';
            }
        }

        if (!isUpdate || data.journal_id !== undefined) {
            if (!data.journal_id || isNaN(parseInt(data.journal_id))) {
                errors.journal_id = "Le journal associé est requis.";
            }
        }

        if (!isUpdate || data.level !== undefined) {
            if (!data.level || !data.level.trim()) {
                errors.level = "Le niveau (ex: 3ème, Terminale) est requis.";
            }
        }

        return errors;
    }

    /**
     * Récupère toutes les classes pour un journal donné.
     * Vérifie que le journal appartient à l'utilisateur via la table JOURNALS.
     */
    static async getAllClasses(req, res) {
        const { journal_id } = req.query;
        const userId = req.user.id;

        if (!journal_id) {
            return ClassController.handleError(res, new Error('ID journal manquant'), 'Un ID de journal est requis.', 400);
        }

        try {
            const data = await ClassController.withConnection(async (connection) => {
                // On joint JOURNALS pour vérifier la propriété du journal
                const [rows] = await connection.execute(`
                    SELECT c.id, c.name, c.level, c.journal_id,
                    (SELECT COUNT(*) FROM STUDENTS s WHERE s.class_id = c.id) as student_count
                    FROM CLASSES c
                    INNER JOIN JOURNALS j ON c.journal_id = j.id
                    WHERE c.journal_id = ? AND j.user_id = ?
                    ORDER BY c.name ASC
                `, [journal_id, userId]);
                return rows;
            });

            res.json({
                success: true,
                data: data,
                count: data.length
            });
        } catch (error) {
            ClassController.handleError(res, error, 'Erreur lors de la récupération des classes.');
        }
    }

    /**
     * Récupère une classe par son ID (avec vérification de propriété via Journal).
     */
    static async getClassById(req, res) {
        const { id } = req.params;
        const userId = req.user.id;

        try {
            const classData = await ClassController.withConnection(async (connection) => {
                const [rows] = await connection.execute(`
                    SELECT c.* FROM CLASSES c
                    INNER JOIN JOURNALS j ON c.journal_id = j.id
                    WHERE c.id = ? AND j.user_id = ?
                `, [parseInt(id), userId]);
                return rows[0] || null;
            });

            if (!classData) {
                return ClassController.handleError(res, new Error('Non trouvé'), 'Classe non trouvée.', 404);
            }

            res.json({ success: true, data: classData });
        } catch (error) {
            ClassController.handleError(res, error, 'Erreur lors de la récupération de la classe.');
        }
    }

    /**
     * Crée une nouvelle classe.
     */
    static async createClass(req, res) {
        const { name, level, journal_id } = req.body;
        const userId = req.user.id;

        const validationErrors = ClassController.validateClassData({ name, level, journal_id });
        if (Object.keys(validationErrors).length > 0) {
            return ClassController.handleError(res, new Error('Validation'), 'Données invalides.', 400, validationErrors);
        }

        try {
            const newClass = await ClassController.withConnection(async (connection) => {
                // 1. Vérifier si le journal appartient bien à l'utilisateur
                const [journal] = await connection.execute(
                    'SELECT id FROM JOURNALS WHERE id = ? AND user_id = ?',
                    [journal_id, userId]
                );

                if (journal.length === 0) {
                    throw new Error('Journal non trouvé ou accès refusé.');
                }

                // 2. Vérifier l'unicité du nom dans ce journal
                const [existing] = await connection.execute(
                    'SELECT id FROM CLASSES WHERE LOWER(name) = LOWER(?) AND journal_id = ?',
                    [name.trim(), journal_id]
                );

                if (existing.length > 0) {
                    const err = new Error('Une classe avec ce nom existe déjà dans ce journal.');
                    err.name = 'DUPLICATE';
                    throw err;
                }

                // 3. Insertion (champs conformes au diagramme : journal_id, name, level)
                const [result] = await connection.execute(
                    'INSERT INTO CLASSES (journal_id, name, level) VALUES (?, ?, ?)',
                    [parseInt(journal_id), name.trim(), level.trim()]
                );

                return { id: result.insertId, name, level, journal_id };
            });

            res.status(201).json({ success: true, data: newClass, message: 'Classe créée.' });
        } catch (error) {
            const status = error.name === 'DUPLICATE' ? 409 : 500;
            ClassController.handleError(res, error, error.message, status);
        }
    }

    /**
     * Met à jour une classe (nom et niveau uniquement).
     */
    static async updateClass(req, res) {
        const { id } = req.params;
        const { name, level } = req.body;
        const userId = req.user.id;

        try {
            const updated = await ClassController.withConnection(async (connection) => {
                // Vérifier propriété via Journal
                const [current] = await connection.execute(
                    'SELECT c.id, c.journal_id FROM CLASSES c INNER JOIN JOURNALS j ON c.journal_id = j.id WHERE c.id = ? AND j.user_id = ?',
                    [id, userId]
                );

                if (current.length === 0) throw new Error('Classe non trouvée.');

                const fields = [];
                const params = [];

                if (name) {
                    fields.push('name = ?');
                    params.push(name.trim());
                }
                if (level) {
                    fields.push('level = ?');
                    params.push(level.trim());
                }

                if (fields.length === 0) throw new Error('Rien à modifier.');

                params.push(id);
                await connection.execute(`UPDATE CLASSES SET ${fields.join(', ')} WHERE id = ?`, params);

                return { id, name, level };
            });

            res.json({ success: true, data: updated });
        } catch (error) {
            ClassController.handleError(res, error, 'Erreur de mise à jour.');
        }
    }

    /**
     * Supprime une classe.
     */
    static async deleteClass(req, res) {
        const { id } = req.params;
        const userId = req.user.id;

        try {
            await ClassController.withConnection(async (connection) => {
                // Vérifier propriété
                const [check] = await connection.execute(
                    'SELECT c.id FROM CLASSES c INNER JOIN JOURNALS j ON c.journal_id = j.id WHERE c.id = ? AND j.user_id = ?',
                    [id, userId]
                );

                if (check.length === 0) throw new Error('Classe non trouvée.');

                // Note : Les relations (STUDENTS, EVALUATIONS, SCHEDULES) devraient être en CASCADE dans la BD
                await connection.execute('DELETE FROM CLASSES WHERE id = ?', [id]);
            });

            res.json({ success: true, message: 'Classe supprimée.' });
        } catch (error) {
            ClassController.handleError(res, error, 'Erreur de suppression.');
        }
    }
}

module.exports = ClassController;