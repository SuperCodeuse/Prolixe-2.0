const express = require('express');
const router = express.Router();
const AttributionController = require('../controllers/AttributionController');
const verifyToken = require('../middleware/authMiddleware');

router.use(verifyToken); // Protège toutes les routes d'attribution

router.get('/', AttributionController.getAttributions);
router.post('/', AttributionController.createAttribution);
router.delete('/:id', AttributionController.deleteAttribution);

module.exports = router;