// backend/routes/journalRoutes.js
const express = require('express');
const router = express.Router();
const JournalController = require('../controllers/JournalController');
const JournalPropagationController = require('../controllers/JournalPropagationController');
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
// journalRoutes.js
router.get('/',                              JournalController.getAllJournals);
router.post('/',                             JournalController.createJournal);
router.get('/current',                       JournalController.getCurrentJournal);
router.post('/import', upload.single('journalFile'), JournalController.importJournal);

// Propagation : rejouer une annee de cours sur un autre journal.
router.get('/propagation/preview',           JournalPropagationController.preview);
router.post('/propagation/apply',            JournalPropagationController.apply);


router.get('/:id/export', JournalController.exportJournal); // Nouvelle route d'export
router.post('/:id/archive',                  JournalController.archiveJournal);
router.delete('/:id',                        JournalController.deleteJournal);

// Entrées
router.get('/entries',                       JournalController.getJournalEntries);
router.put('/entries',                       JournalController.upsertJournalEntry);
router.delete('/:journal_id/entries',        JournalController.clearJournal);

// Assignations
router.get('/assignments',                   JournalController.getAssignments);
router.put('/assignments',                   JournalController.upsertAssignment);
router.delete('/assignments/:id',            JournalController.deleteAssignment);

module.exports = router;
