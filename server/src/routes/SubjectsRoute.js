// server/src/routes/SubjectsRoute.js
const express = require('express');
const router = express.Router();
const SubjectsController = require('../controllers/SubjectsController');

router.get('/journal/:journal_id', SubjectsController.getSubjects);
router.post('/', SubjectsController.createSubject);
router.put('/:id', SubjectsController.updateSubject);
router.delete('/:id', SubjectsController.deleteSubject);

module.exports = router;