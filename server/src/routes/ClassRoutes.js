const express = require('express');
const router = express.Router();
const ClassController = require('../controllers/ClassController');

// GET /api/classes - Récupérer toutes les classes d'un journal
router.get('/', ClassController.getAllClasses);

// GET /api/classes/:id - Récupérer une classe spécifique
router.get('/:id', ClassController.getClassById);

// POST /api/classes - Créer une nouvelle classe
router.post('/', ClassController.createClass);

// PUT /api/classes/:id - Mettre à jour (nom/niveau)
router.put('/:id', ClassController.updateClass);

// DELETE /api/classes/:id - Supprimer
router.delete('/:id', ClassController.deleteClass);

module.exports = router;