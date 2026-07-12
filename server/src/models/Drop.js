const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Drop extends Model {
  toPublicJSON() {
    const json = this.toJSON();
    return {
      ...json,
      isLive: new Date(json.startsAt) <= new Date(),
      isSoldOut: json.availableStock <= 0,
    };
  }
}

Drop.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: { min: 0 },
    },
    totalStock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'total_stock',
      validate: { min: 0 },
    },
    availableStock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'available_stock',
      validate: { min: 0 },
    },
    startsAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'starts_at',
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'Drop',
    tableName: 'drops',
    timestamps: true,
    underscored: true,
  }
);

module.exports = Drop;
