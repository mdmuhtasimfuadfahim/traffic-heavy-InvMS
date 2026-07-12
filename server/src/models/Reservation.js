const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

const STATUSES = ['active', 'completed', 'expired', 'cancelled'];

class Reservation extends Model {}

Reservation.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    dropId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'drop_id',
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
    },
    status: {
      type: DataTypes.ENUM(...STATUSES),
      allowNull: false,
      defaultValue: 'active',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at',
    },
  },
  {
    sequelize,
    modelName: 'Reservation',
    tableName: 'reservations',
    timestamps: true,
    underscored: true,
  }
);

Reservation.STATUSES = STATUSES;

module.exports = Reservation;
