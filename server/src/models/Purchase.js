const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Purchase extends Model {}

Purchase.init(
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
    reservationId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      field: 'reservation_id',
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    purchasedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'purchased_at',
    },
  },
  {
    sequelize,
    modelName: 'Purchase',
    tableName: 'purchases',
    timestamps: true,
    underscored: true,
  }
);

module.exports = Purchase;
