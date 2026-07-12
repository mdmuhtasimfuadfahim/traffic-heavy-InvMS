const express = require('express');
const drops = require('./drops');
const reservations = require('./reservations');
const users = require('./users');

const router = express.Router();

router.get('/health', (req, res) => res.json({ ok: true }));
router.use('/drops', drops);
router.use('/reservations', reservations);
router.use('/users', users);

module.exports = router;
