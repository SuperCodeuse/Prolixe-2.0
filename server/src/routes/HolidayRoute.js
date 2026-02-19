// server/src/routes/HolidayRoute.js
const express = require('express');
const router = express.Router();
const HolidayController = require('../controllers/HolidayController');
const authMiddleware = require('../middleware/authMiddleware');
const multer = require('multer');

// On utilise le dossier temporaire par défaut ou la mémoire
const upload = multer({ dest: 'uploads/temp/' });

// Upload lié à une année
router.post('/upload', authMiddleware, upload.single('holidaysFile'), HolidayController.uploadHolidays);

// Récupération par année scolaire
router.get('/:schoolYearId', authMiddleware, HolidayController.getHolidaysByYear);

module.exports = router;