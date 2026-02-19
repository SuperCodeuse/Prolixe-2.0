// backend/routes/ScheduleHours.js
const express = require('express');
const router = express.Router();
const ScheduleHoursController = require('../controllers/ScheduleHoursController');
const verifyToken = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/rolesMiddleware');

router.get('/', ScheduleHoursController.getAllHours);
router.get('/:id', ScheduleHoursController.getHourById);

router.post('/', verifyToken, isAdmin, ScheduleHoursController.createHour);
router.put('/:id', verifyToken, isAdmin, ScheduleHoursController.updateHour);
router.delete('/:id', verifyToken, isAdmin, ScheduleHoursController.deleteHour);

module.exports = router;