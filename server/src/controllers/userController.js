const { User } = require('../models');
const { ValidationError } = require('../utils/errors');

// Lightweight "identify yourself" flow: no passwords/auth are in scope for
// this assessment. The frontend prompts once for a username, persists it in
// localStorage, and the backend finds-or-creates a matching User row so that
// reservations/purchases can be attributed to somebody.
async function identify(req, res) {
  const { username } = req.body;

  if (!username || typeof username !== 'string' || username.trim().length < 2) {
    throw new ValidationError('username must be at least 2 characters');
  }

  const clean = username.trim().slice(0, 32);

  const [user] = await User.findOrCreate({
    where: { username: clean },
    defaults: { username: clean },
  });

  res.json({ user: { id: user.id, username: user.username } });
}

module.exports = { identify };
