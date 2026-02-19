// server/src/controllers/ScheduleModelController.js
const pool = require('../../config/database');

class ScheduleModelController {
    /**
     * Crée un nouvel emploi du temps.
     * @param {object} req - L'objet de requête Express.
     * @param {object} res - L'objet de réponse Express.
     */
    static async createSchedule(req, res) {
        // Le frontend envoie maintenant name, startDate, et endDate
        const { name, startDate, endDate, typeBody } = req.body;
        const userId = req.user.id; // L'ID de l'utilisateur est extrait du token JWT
        // Ajout : Définir le type par défaut à 'COMMON' pour la création via le formulaire settings

        const type = typeBody || 'COMMON';
        console.log("type : ", type);


        if (!name || !startDate || !endDate) {
            // Cette erreur sera interceptée par la vérification createResponse.ok du frontend
            return res.status(400).json({
                success: false,
                message: "Le nom, la date de début et la date de fin sont requis."
            });
        }

        let connection;
        try {
            connection = await pool.getConnection();

            // Modification: Ajout de 'type' à la requête SQL
            // Création de l'emploi du temps dans la table SCHEDULE_SETS
            const [result] = await connection.execute(
                'INSERT INTO SCHEDULE_SETS (name, start_date, end_date, user_id, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
                [name, startDate, endDate, userId, type] // Ajout de la variable type
            );

            // La réponse est ici, renvoyant scheduleId (correctement géré par le frontend corrigé)
            res.status(201).json({
                success: true,
                message: "Emploi du temps créé avec succès.",
                scheduleId: result.insertId
            });
        } catch (error) {
            console.error('Erreur lors de la création de l\'emploi du temps:', error);
            res.status(500).json({
                success: false,
                message: "Erreur lors de la création de l'emploi du temps."
            });
        } finally {
            if (connection) connection.release();
        }
    }

    /**
     * Récupère tous les emplois du temps créés par l'utilisateur.
     * Applique la logique de filtrage: seulement les COMMON ou les PERSONNAL de l'utilisateur.
     * @param {object} req - L'objet de requête Express.
     * @param {object} res - L'objet de réponse Express.
     */

    static async getSchedules(req, res) {
        /*
        const userId = req.user.id; // L'ID de l'utilisateur est extrait du token JWT
        const { journalId } = req.query;

        //const journalId = req.journal.id; // L'ID du journal est extrait du token JWT
        let connection;
        try {
            connection = await pool.getConnection();

            // Modification: Sélectionne aussi le champ 'type'.
            // La clause WHERE filtre pour n'inclure que les plannings 'COMMON' ou les plannings 'PERSONNAL' appartenant à l'utilisateur actuel (user_id = ?)
            const [rows] = await connection.execute(
                `SELECT id, name, start_date, end_date, type 
                 FROM SCHEDULE_SETS
                 WHERE (type = 'COMMON' OR (type = 'PERSONNAL' AND user_id = ?)) AND journal_id = ?`,
                [userId, journalId]
            );

            res.status(200).json({
                success: true,
                message: "test",
                schedules: rows
            });
        } catch (error) {
            console.error('Erreur lors de la récupération des emplois du temps:', error);
            res.status(500).json({
                success: false,
                message: "Erreur lors de la récupération des emplois du temps."
            });
        } finally {
            if (connection) connection.release();
        }*/
    }
}

module.exports = ScheduleModelController;