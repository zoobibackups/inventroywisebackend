const express = require("express");
const router = express.Router();
const accountService = require("./properties.service");
const multer = require("multer");

var storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, "./uploads");
	},
	filename: function (req, file, cb) {
		cb(null, file.originalname);
	},
});
var upload = multer({ storage: storage });

// routes
router.get("/", getAll);
router.get("/:id", getById);
router.post("/", create);
router.post("/upload_image", upload.single("file"), uploadImage);
router.put("/:id", update);
router.delete("/:id", _delete);

module.exports = router;

function getAll(req, res, next) {
	accountService
		.getAll()
		.then((accounts) => res.json(accounts))
		.catch(next);
}

function uploadImage(req, res, next) {
	console.log(JSON.stringify(req.file));
	return res.send(req.file);
}

function getById(req, res, next) {
	accountService
		.getById(req.params.id)
		.then((account) => (account ? res.json(account) : res.sendStatus(404)))
		.catch(next);
}

function create(req, res, next) {
	accountService
		.create(req.body)
		.then((account) => res.json(account))
		.catch(next);
}

function update(req, res, next) {
	accountService
		.update(req.params.id, req.body)
		.then((account) => res.json(account))
		.catch(next);
}

function _delete(req, res, next) {
	accountService
		.delete(req.params.id)
		.then(() => res.json({ message: "Property deleted successfully" }))
		.catch(next);
}

// helper functions
