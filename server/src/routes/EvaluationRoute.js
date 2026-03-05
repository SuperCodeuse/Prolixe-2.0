// server/src/routes/EvaluationRoute.js
const express = require('express');
const router = express.Router();
const evaluationController = require('../controllers/EvaluationController');

// --- Lecture ---

// Récupère les modèles ou anciennes évaluations pour duplication
router.get('/templates', evaluationController.getEvaluationTemplates);

// Récupère les données complètes pour l'interface de saisie des notes (élèves + critères + notes existantes)
router.get('/:id/grading', evaluationController.getEvaluationForGrading);

// Récupère les détails d'une évaluation spécifique (avec ses critères)
router.get('/:id', evaluationController.getEvaluationById);

// Liste toutes les évaluations d'un journal (via journalId dans la query string)
router.get('/', evaluationController.getEvaluations);


// --- Écriture ---

// Crée une nouvelle évaluation et ses critères associés
router.post('/', evaluationController.createEvaluation);

// Sauvegarde massive des notes (Globales + Détails par critère)
// Note : J'ai mis à jour le nom de la fonction pour correspondre au nouveau contrôleur
router.post('/:evaluationId/grades', evaluationController.saveDetailedGrades);


// --- Modification / Suppression ---

// Met à jour les infos d'une évaluation et/ou ses critères
router.put('/:id', evaluationController.updateEvaluation);

// Supprime une évaluation (les critères et notes sont supprimés en cascade via la BD)
router.delete('/:id', evaluationController.deleteEvaluation);

module.exports = router;