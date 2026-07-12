const express = require('express');
const dropController = require('../controllers/dropController');
const reservationController = require('../controllers/reservationController');

const router = express.Router();

router.get('/', dropController.list);
router.post('/', dropController.create);
router.post('/:dropId/reservations', reservationController.reserve);

module.exports = router;
