// server/src/controllers/HolidayController.js
const fs = require('fs/promises');
const path = require('path');
const pool = require('../../config/database');
const { parseHolidaysPdf } = require('../utils/holidaysPdfParser');

// Les deux formats acceptés aboutissent au même tableau [{name, start, end}].
function parseHolidaysJson(buffer) {
    const parsed = JSON.parse(buffer.toString('utf8'));
    if (!Array.isArray(parsed)) {
        throw new Error('le JSON doit contenir un tableau de congés.');
    }
    return parsed;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeHolidays(list) {
    const holidays = list
        .filter(h => h && h.start && h.end)
        .map(h => ({
            name: String(h.name || 'Congé').trim(),
            start: String(h.start).slice(0, 10),
            end: String(h.end).slice(0, 10)
        }))
        .filter(h => ISO_DATE.test(h.start) && ISO_DATE.test(h.end))
        .sort((a, b) => a.start.localeCompare(b.start));

    if (holidays.length === 0) {
        throw new Error('aucun congé exploitable (dates manquantes ou invalides).');
    }
    return holidays;
}

class HolidayController {
    // L'admin dépose un calendrier (JSON ou PDF) et on le range dans la
    // SchoolYear correspondante.
    static async uploadHolidays(req, res) {
        if (req.user.role !== 'ADMIN') {
            return res.status(403).json({ success: false, message: 'Accès interdit.' });
        }

        const { schoolYearId } = req.body; // L'ID de l'année scolaire concernée

        if (!req.file || !schoolYearId) {
            return res.status(400).json({ success: false, message: 'Fichier ou ID de l\'année scolaire manquant.' });
        }

        try {
            const data = await fs.readFile(req.file.path);
            const isPdf = data.slice(0, 5).toString('latin1') === '%PDF-'
                || path.extname(req.file.originalname || '').toLowerCase() === '.pdf';

            let holidaysArray;
            try {
                holidaysArray = normalizeHolidays(
                    isPdf ? parseHolidaysPdf(data) : parseHolidaysJson(data)
                );
            } catch (parseError) {
                return res.status(400).json({
                    success: false,
                    message: `${isPdf ? 'PDF' : 'JSON'} illisible : ${parseError.message}`
                });
            }

            // Mise à jour de la colonne JSON dans la table SCHOOL_YEARS
            await pool.execute(
                'UPDATE SCHOOL_YEARS SET holidays = ? WHERE id = ?',
                [JSON.stringify(holidaysArray), schoolYearId]
            );

            res.status(200).json({
                success: true,
                count: holidaysArray.length,
                data: holidaysArray,
                message: `${holidaysArray.length} périodes de congés enregistrées pour l'année sélectionnée.`
            });
        } catch (error) {
            console.error('Erreur import holidays:', error);
            res.status(500).json({ success: false, message: 'Erreur lors de l\'enregistrement en base.' });
        } finally {
            // Le fichier temporaire part quoi qu'il arrive, y compris en erreur.
            await fs.unlink(req.file.path).catch(() => {});
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
