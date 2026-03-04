// server/src/routes/AuthRoute.js
const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const verifyToken = require('../middleware/authMiddleware');

// --- ROUTES PUBLIQUES (Pas de token requis) ---
router.post('/login', AuthController.login);

// Ajout de la route mot de passe oublié (SANS verifyToken)
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);

module.exports = router;