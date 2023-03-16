require("rootpath")();
const express = require("express");
const CronJob = require("cron").CronJob;
const db = require("./_helpers/db");
const { Op } = require("sequelize");

const app = express();
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const errorHandler = require("./_middleware/error-handler");

app.use(express.static(__dirname + "/public"));
app.use("/uploads", express.static("uploads"));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());

// allow cors requests from any origin and with credentials
app.use(cors({ origin: (origin, callback) => callback(null, true), credentials: true }));

// api routes
app.use("/accounts", require("./accounts/accounts.controller"));
app.use("/", require("./properties/index.controller"));

app.use("/properties", require("./properties/properties.controller"));

// swagger docs route
app.use("/api-docs", require("_helpers/swagger"));

// global error handler
app.use(errorHandler);

async function _delete(id) {
	const property = await getProperty(id);
	const { property_details } = property;
	if (property && property.property_details.length > 0) {
		property_details.map(async (propertyDetail) => {
			const { property_images } = propertyDetail;
			if (propertyDetail && property_images.length > 0) {
				await db.Property_images.destroy({ where: { propertyDetailId: propertyDetail.id } });
			}
		});
	}
	await db.Property_details.destroy({ where: { propertyId: property.id } });
	await property.destroy();
}

// helper functions

async function getProperty(id) {
	const property = await db.Property.findOne({
		where: { id: id },
		include: [
			{
				model: db.Property_details,
				as: "property_details",
				include: [
					{
						model: db.Property_images,
						as: "property_images",
					},
				],
			},
		],
	});
	if (!property) throw "Property not found";
	return property;
}

const job = new CronJob("00 00 */15 * *", async () => {
	const startedDate = new Date();
	const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
	await db.Property.findAll({
		where: { created: { [Op.between]: [fifteenDaysAgo, startedDate] } },
		include: [
			{
				model: db.Property_details,
				as: "property_details",
				include: [
					{
						model: db.Property_images,
						as: "property_images",
					},
				],
			},
		],
	})
		.then((result) => {
			result.map(async (row) => {
				await _delete(row.id);
			});
		})
		.catch((error) => res.status(404).json({ errorInfo: error }));
});

job.start();

// start server
const port = process.env.NODE_ENV === "production" ? process.env.PORT || 80 : 4000;
app.listen(port, () => console.log("Server listening on port " + port));
