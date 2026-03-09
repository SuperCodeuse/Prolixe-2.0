const pool = require('../../config/database');

class ConseilDeClasseController {
    // --- Méthodes utilitaires conservées ---
    static async withConnection(operation) {
        let connection;
        try {
            connection = await pool.getConnection();
            return await operation(connection);
        } catch (error) { throw error; }
        finally { if (connection) connection.release(); }
    }

    static handleError(res, error, defaultMessage = 'Erreur', statusCode = 500) {
        res.status(statusCode).json({ success: false, message: defaultMessage, error: error.message });
    }

    // ==========================================
    // GESTION DES SESSIONS (Pour le ScheduleManager)
    // ==========================================

    /** Récupère la liste des conseils (Octobre, Noël...) pour un journal */
    static async getSessions(req, res) {
        const { journal_id } = req.params;
        try {
            const sessions = await ConseilDeClasseController.withConnection(async (db) => {
                const [rows] = await db.execute(
                    'SELECT * FROM CONSEIL_SESSIONS WHERE journal_id = ? ORDER BY date_creation ASC',
                    [journal_id]
                );
                return rows;
            });
            res.json({ success: true, data: sessions });
        } catch (error) {
            ConseilDeClasseController.handleError(res, error, 'Erreur lors de la récupération des sessions.');
        }
    }

    /** Ajoute une nouvelle session (ex: "Conseil de Pâques") */
    static async createSession(req, res) {
        const { journal_id, libelle } = req.body;
        if (!libelle) return res.status(400).json({ message: 'Libellé requis' });

        try {
            const result = await ConseilDeClasseController.withConnection(async (db) => {
                const [res] = await db.execute(
                    'INSERT INTO CONSEIL_SESSIONS (journal_id, libelle) VALUES (?, ?)',
                    [journal_id, libelle]
                );
                return res.insertId;
            });
            res.json({ success: true, id: result, message: 'Session créée' });
        } catch (error) {
            ConseilDeClasseController.handleError(res, error, 'Erreur création session');
        }
    }

    /** Supprime une session et toutes les notes associées */
    static async deleteSession(req, res) {
        const { id } = req.params;
        try {
            await ConseilDeClasseController.withConnection(async (db) => {
                await db.execute('DELETE FROM CONSEIL_SESSIONS WHERE id = ?', [id]);
            });
            res.json({ success: true, message: 'Session supprimée' });
        } catch (error) {
            ConseilDeClasseController.handleError(res, error, 'Erreur suppression');
        }
    }

    // ==========================================
    // GESTION DES DONNÉES ÉLÈVES PAR SESSION
    // ==========================================

    /** Récupère les élèves d'une classe pour une SESSION précise */
    static async getConseilDataBySession(req, res) {
        const { session_id, class_id } = req.params;

        try {
            const data = await ConseilDeClasseController.withConnection(async (db) => {
                const [rows] = await db.execute(`
                    SELECT 
                        s.id, s.firstname, s.lastname,
                        cc.notes, cc.decision
                    FROM STUDENTS s
                    LEFT JOIN CONSEIL_CLASS cc ON s.id = cc.student_id AND cc.session_id = ?
                    WHERE s.class_id = ?
                    ORDER BY s.lastname ASC
                `, [session_id, class_id]);
                return rows;
            });
            res.json({ success: true, data });
        } catch (error) {
            ConseilDeClasseController.handleError(res, error, 'Erreur chargement données élèves');
        }
    }

    /** Upsert des notes d'un élève pour une session */
    static async updateStudentConseil(req, res) {
        const { session_id, student_id } = req.params;
        const { notes, decision } = req.body;

        try {
            await ConseilDeClasseController.withConnection(async (db) => {
                await db.execute(`
                    INSERT INTO CONSEIL_CLASS (session_id, student_id, notes, decision)
                    VALUES (?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE notes = VALUES(notes), decision = VALUES(decision)
                `, [session_id, student_id, notes || '', decision || 'AO-A']);
            });
            res.json({ success: true, message: 'Enregistré' });
        } catch (error) {
            ConseilDeClasseController.handleError(res, error, 'Erreur sauvegarde');
        }
    }
}

module.exports = ConseilDeClasseController;