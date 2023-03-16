const express = require("express");
const router = express.Router();
router.get("/", getAll);

module.exports = router;
function getAll(req, res, next) {
	res.json({
		status: true,
		message: "All done here",
	});
}
