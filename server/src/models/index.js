const sequelize = require('../config/database');
const User = require('./User');
const Drop = require('./Drop');
const Reservation = require('./Reservation');
const Purchase = require('./Purchase');

// Associations
Drop.hasMany(Reservation, { foreignKey: 'dropId', as: 'reservations' });
Reservation.belongsTo(Drop, { foreignKey: 'dropId', as: 'drop' });

User.hasMany(Reservation, { foreignKey: 'userId', as: 'reservations' });
Reservation.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Drop.hasMany(Purchase, { foreignKey: 'dropId', as: 'purchases' });
Purchase.belongsTo(Drop, { foreignKey: 'dropId', as: 'drop' });

User.hasMany(Purchase, { foreignKey: 'userId', as: 'purchases' });
Purchase.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Reservation.hasOne(Purchase, { foreignKey: 'reservationId', as: 'purchase' });
Purchase.belongsTo(Reservation, { foreignKey: 'reservationId', as: 'reservation' });

module.exports = {
  sequelize,
  User,
  Drop,
  Reservation,
  Purchase,
};
