const { DataTypes } = require("sequelize");

module.exports = model;

function model(sequelize) {
	const attributes = {
		property_address: { type: DataTypes.STRING, allowNull: true },
		tenant_name: { type: DataTypes.STRING, allowNull: true },
		inspector_name: { type: DataTypes.STRING, allowNull: true },
		inspection_date: { type: DataTypes.DATE, allowNull: true },
		ecp_exp_date: { type: DataTypes.DATE, allowNull: true },
		ecir_exp_date: { type: DataTypes.DATE, allowNull: true },
		gas_safety_certificate_exp_date: { type: DataTypes.DATE, allowNull: true },
		electricity_meter: { type: DataTypes.STRING, allowNull: true },
		gas_meter: { type: DataTypes.STRING, allowNull: true },
		water_meter: { type: DataTypes.STRING, allowNull: true },
		smoke_alarm: { type: DataTypes.STRING, allowNull: true },
		co_alarm: { type: DataTypes.STRING, allowNull: true },
		heating_system: { type: DataTypes.STRING, allowNull: true },
		signature_inspector: { type: DataTypes.BLOB("long"), allowNull: true },
		advised_tenant_to: { type: DataTypes.STRING, allowNull: true },
		asked_landlord_to: { type: DataTypes.STRING, allowNull: true },
		contractor_instructed: { type: DataTypes.STRING, allowNull: true },
		gas_meter_reading: { type: DataTypes.STRING, allowNull: true },
		electricity_meter_reading: { type: DataTypes.STRING, allowNull: true },
		types: { type: DataTypes.STRING, allowNull: true },
		signature_tenant: { type: DataTypes.BLOB("long"), allowNull: true },
		final_remarks: { type: DataTypes.STRING, allowNull: true },
		main_img: { type: DataTypes.STRING, allowNull: true },
		water_meter_reading: { type: DataTypes.STRING, allowNull: true },
		electricity_meter_img: { type: DataTypes.STRING, allowNull: true },
		gas_meter_img: { type: DataTypes.STRING, allowNull: true },
		water_meter_img: { type: DataTypes.STRING, allowNull: true },
		smoke_alarm_front_img: { type: DataTypes.STRING, allowNull: true },
		smoke_alarm_back_img: { type: DataTypes.STRING, allowNull: true },
		co_alarm_front_img: { type: DataTypes.STRING, allowNull: true },
		co_alarm_back_img: { type: DataTypes.STRING, allowNull: true },
		heating_system_img: { type: DataTypes.STRING, allowNull: true },
		created: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
		updated: { type: DataTypes.DATE },
	};

	const options = {
		// disable default timestamp fields (createdAt and updatedAt)
		timestamps: false,
	};

	return sequelize.define("property", attributes, options);
}
