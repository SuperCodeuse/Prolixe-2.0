// server/src/routes/HolidayRoute.js
const express = require('express');
const path = require('path');
const router = express.Router();
const HolidayController = require('../controllers/HolidayController');
const authMiddleware = require('../middleware/authMiddleware');
const multer = require('multer');

const ACCEPTED_EXTENSIONS = ['.json', '.pdf'];

// On utilise le dossier temporaire par défaut ou la mémoire
const upload = multer({
    dest: 'uploads/temp/',
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        if (!ACCEPTED_EXTENSIONS.includes(ext)) {
            return cb(new Error('Seuls les fichiers .json et .pdf sont acceptés.'));
        }
        cb(null, true);
    }
});

// Upload lié à une année : calendrier JSON ou PDF de l'école
router.post('/upload', authMiddleware, (req, res, next) => {
    upload.single('holidaysFile')(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        next();
    });
}, HolidayController.uploadHolidays);

// Récupération par année scolaire
router.get('/:schoolYearId', authMiddleware, HolidayController.getHolidaysByYear);

module.exports = router;
