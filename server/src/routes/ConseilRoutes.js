const express = require('express');
const router = express.Router();
const ConseilController = require('../controllers/ConseilController');

// ==========================================
// 1. GESTION DES SESSIONS (Liste des conseils)
// ==========================================

/**
 * GET /api/conseil-de-classe/sessions/:journal_id
 * Récupère la liste des sessions (ex: "Bilan Octobre") pour un journal précis.
 */
router.get('/sessions/:journal_id', ConseilController.getSessions);

/**
 * POST /api/conseil-de-classe/sessions
 * Crée une nouvelle session de conseil (corps : { journal_id, libelle }).
 */
router.post('/sessions', ConseilController.createSession);

/**
 * DELETE /api/conseil-de-classe/sessions/:id
 * Supprime une session et toutes les notes associées en cascade.
 */
router.delete('/sessions/:id', ConseilController.deleteSession);


// ==========================================
// 2. GESTION DES DONNÉES ÉLÈVES
// ==========================================

/**
 * GET /api/conseil-de-classe/data/:session_id/:class_id
 * Récupère les élèves d'une classe et leurs notes pour UNE session spécifique.
 */
router.get('/data/:session_id/:class_id', ConseilController.getConseilDataBySession);

/**
 * PUT /api/conseil-de-classe/student/:session_id/:student_id
 * Met à jour ou crée la note/décision d'un élève pour une session donnée.
 */
router.put('/student/:session_id/:student_id', ConseilController.updateStudentConseil);

module.exports = router;