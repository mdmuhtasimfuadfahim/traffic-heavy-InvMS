const express = require('express');
const reservationController = require('../controllers/reservationController');

const router = express.Router();

router.post('/:id/purchase', reservationController.purchase);
router.post('/:id/cancel', reservationController.cancel);

module.exports = router;
