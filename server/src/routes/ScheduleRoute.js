// server/src/routes/ScheduleRoute.js
const express = require('express');
const router = express.Router();
const ScheduleController = require('../controllers/ScheduleController');
const verifyToken = require('../middleware/authMiddleware');

router.use(verifyToken);

router.get('/sets', ScheduleController.getUserSchedules);
router.post('/sets', ScheduleController.createScheduleSet);

router.get('/:id', ScheduleController.getFullSchedule);
router.post('/slots/save', ScheduleController.saveSlots);

router.post('/sets/:id/duplicate', ScheduleController.duplicateScheduleSet);
router.delete('/sets/:id', ScheduleController.deleteScheduleSet);

module.exports = router;