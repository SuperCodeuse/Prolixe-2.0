// server/src/routes/ScheduleRoute.js
const express = require('express');
const router = express.Router();
const ScheduleController = require('../controllers/ScheduleController');
const verifyToken = require('../middleware/authMiddleware');

router.use(verifyToken);

// Gestion des ensembles d'horaires
router.get('/sets', ScheduleController.getUserSchedules);
router.post('/sets', ScheduleController.createScheduleSet);

// Gestion des créneaux (Slots)
router.get('/:id', ScheduleController.getFullSchedule);
router.post('/slots/save', ScheduleController.saveSlots);

module.exports = router;