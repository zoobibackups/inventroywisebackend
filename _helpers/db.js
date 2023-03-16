const config = require("../config.json");
const mysql = require("mysql2/promise");
const { Sequelize } = require("sequelize");

module.exports = db = {};

initialize();

async function initialize() {
	// create db if it doesn't already exist
	const { host, port, user, password, database } = config.database;
	const connection = await mysql.createConnection({ host, port, user, password });
	await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\`;`);

	// connect to db
	const sequelize = new Sequelize(database, user, password, { dialect: "mysql", logging: false });

	// init models and add them to the exported db object
	db.Account = require("../accounts/account.model")(sequelize);
	db.RefreshToken = require("../accounts/refresh-token.model")(sequelize);
	db.Property = require("../properties/property.model")(sequelize);
	db.Property_details = require("../properties/property_details.model")(sequelize);
	db.Property_images = require("../properties/property_images.model")(sequelize);

	// define relationships
	db.Account.hasMany(db.RefreshToken, { onDelete: "CASCADE" });
	db.RefreshToken.belongsTo(db.Account);

	db.Account.hasMany(db.Property);
	db.Property.belongsTo(db.Account);

	db.Property.hasMany(db.Property_details);
	db.Property_details.belongsTo(db.Property);

	db.Property_details.hasMany(db.Property_images);
	db.Property_images.belongsTo(db.Property_details);

	// sync all models with database
	await sequelize.sync();
}
