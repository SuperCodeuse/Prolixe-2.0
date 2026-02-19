// server/src/controllers/HolidayController.js
const pool = require('../../config/database');

class HolidayController {
    // L'admin upload le JSON et on le sauvegarde dans la SchoolYear correspondante
    static async uploadHolidays(req, res) {
        if (req.user.role !== 'ADMIN') {
            return res.status(403).json({ success: false, message: 'Accès interdit.' });
        }

        console.log("Body reçu :", req.body);
        console.log("Fichier reçu :", req.file);

        const { schoolYearId } = req.body; // L'ID de l'année scolaire concernée

        if (!req.file || !schoolYearId) {
            return res.status(400).json({ success: false, message: 'Fichier ou ID de l\'année scolaire manquant.' });
        }

        try {
            // Lecture du contenu du fichier uploadé par Multer (en mémoire ou disque)
            const fs = require('fs/promises');
            const data = await fs.readFile(req.file.path, 'utf8');
            const holidaysArray = JSON.parse(data);

            // Mise à jour de la colonne JSON dans la table SCHOOL_YEARS
            await pool.execute(
                'UPDATE SCHOOL_YEARS SET holidays = ? WHERE id = ?',
                [JSON.stringify(holidaysArray), schoolYearId]
            );

            // Optionnel : supprimer le fichier temporaire après import
            await fs.unlink(req.file.path);

            res.status(200).json({
                success: true,
                message: 'Congés enregistrés en base de données pour l\'année sélectionnée.'
            });
        } catch (error) {
            console.error('Erreur import holidays:', error);
            res.status(500).json({ success: false, message: 'Erreur lors de l\'enregistrement en base.' });
        }
    }

    // Récupérer les congés liés à une année spécifique
    static async getHolidaysByYear(req, res) {
        const { schoolYearId } = req.params;
        try {
            const [rows] = await pool.execute(
                'SELECT holidays FROM SCHOOL_YEARS WHERE id = ?',
                [schoolYearId]
            );

            if (rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Année scolaire non trouvée.' });
            }

            res.status(200).json({
                success: true,
                data: rows[0].holidays || []
            });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erreur serveur.' });
        }
    }
}

module.exports = HolidayController;