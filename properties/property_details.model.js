const { DataTypes } = require("sequelize");

module.exports = model;

function model(sequelize) {
	const attributes = {
		name: { type: DataTypes.STRING, allowNull: true },
		description: { type: DataTypes.STRING, allowNull: true },
		floor: { type: DataTypes.STRING, allowNull: true },
		walls: { type: DataTypes.STRING, allowNull: true },
		ceiling: { type: DataTypes.STRING, allowNull: true },
		windows: { type: DataTypes.STRING, allowNull: true },
		doors: { type: DataTypes.STRING, allowNull: true },
		created: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
		updated: { type: DataTypes.DATE },
	};

	const options = {
		// disable default timestamp fields (createdAt and updatedAt)
		timestamps: false,
	};

	return sequelize.define("property_details", attributes, options);
}
