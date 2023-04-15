const express = require("express");
const router = express.Router();
const Joi = require("joi");
const validateRequest = require("../_middleware/validate-request");
const authorize = require("../_middleware/authorize");
const Role = require("../_helpers/role");
const accountService = require("./account.service");
const { json } = require("body-parser");

// routes
router.post("/authenticate", authenticateSchema, authenticate);
router.post("/refresh-token", refreshToken);
router.post("/revoke-token", revokeTokenSchema, revokeToken);
router.post("/register", registerSchema, register);
router.get("/verify-email/:token", verifyEmail);
router.get("/forgot-password", forgotPassword);
router.post("/validate-reset-token", validateResetTokenSchema, validateResetToken);
router.post("/reset-password", resetPasswordSchema, resetPassword);
router.get("/reject/:id", rejectUser);
router.get("/approve/:id", approveUser);
router.get("/", getAll);
router.get("/:id", getById);
router.post("/", createSchema, create);
router.put("/:id", updateSchema, update);
router.delete("/:id", _delete);
module.exports = router;

function authenticateSchema(req, res, next) {
	const schema = Joi.object({
		email: Joi.string().required(),
		password: Joi.string().required(),
	});
	validateRequest(req, next, schema);
}

function authenticate(req, res, next) {
	const { email, password } = req.body;
	const ipAddress = "192.168.18.11";
	accountService
		.authenticate({ email, password, ipAddress })
		.then(({ refreshToken, ...account }) => {
			res.json(account);
		})
		.catch((err) => res.json(err));
}

function refreshToken(req, res, next) {
	const token = req.cookies.refreshToken;
	const ipAddress = req.ip;
	accountService
		.refreshToken({ token, ipAddress })
		.then(({ refreshToken, ...account }) => {
			setTokenCookie(res, refreshToken);
			res.json(account);
		})
		.catch(next);
}

function revokeTokenSchema(req, res, next) {
	const schema = Joi.object({
		token: Joi.string().empty(""),
	});
	validateRequest(req, next, schema);
}

function revokeToken(req, res, next) {
	const token = req.body.token || req.cookies.refreshToken;
	const ipAddress = req.ip;
	if (!token) return res.status(400).json({ message: "Token is required" });
	if (!req.user.ownsToken(token) && req.user.role !== Role.Admin) {
		return res.status(401).json({ message: "Unauthorized" });
	}
	accountService
		.revokeToken({ token, ipAddress })
		.then(() => res.json({ message: "Token revoked" }))
		.catch(next);
}

function registerSchema(req, res, next) {
	const schema = Joi.object({
		title: Joi.string().required(),
		firstName: Joi.string().required(),
		lastName: Joi.string().required(),
		email: Joi.string().required(),
		password: Joi.string().min(4).required(),
		confirmPassword: Joi.string().valid(Joi.ref("password")).required(),
		acceptTerms: Joi.boolean().valid(true).required(),
		company_name: Joi.string().required(),
		company_address: Joi.string().required(),
		mobile_number: Joi.string().required(),
		company_email: Joi.string().required(),
		company_logo: Joi.string().required(),
	});
	validateRequest(req, next, schema);
}

function register(req, res, next) {
	accountService
		.register(req.body, req.headers.host)
		.then((data) => res.json(data))
		.catch((err) => {
			res.json({
				status: false,
				message: "There is some issue with the server. Please Try again later",
			});
		});
}

function verifyEmail(req, res, next) {
	//res.json({ message: "Verification successful, you can now login", token: req.params.token });
	accountService
		.verifyEmail(req.params.token)
		.then((data) => res.json(data))
		.catch((err) => {
			res.json(err);
		});
}

function forgotPassword(req, res, next) {
	accountService
		.forgotPassword(req.query.email, req.get("origin"))
		.then((data) => res.json(data))
		.catch((err) => res.json(err));
}

function validateResetTokenSchema(req, res, next) {
	const schema = Joi.object({
		token: Joi.string().required(),
	});
	validateRequest(req, next, schema);
}

function validateResetToken(req, res, next) {
	accountService
		.validateResetToken(req.body)
		.then(() => res.json({ message: "Token is valid" }))
		.catch(next);
}

function resetPasswordSchema(req, res, next) {
	const schema = Joi.object({
		token: Joi.string().required(),
		password: Joi.string().min(6).required(),
		confirmPassword: Joi.string().valid(Joi.ref("password")).required(),
	});
	validateRequest(req, next, schema);
}

function resetPassword(req, res, next) {
	accountService
		.resetPassword(req.body)
		.then(() => res.json({ message: "Password reset successful, you can now login" }))
		.catch(next);
}

function getAll(req, res, next) {
	accountService
		.getAll()
		.then((accounts) => res.json(accounts))
		.catch(next);
}

function getById(req, res, next) {
	// users can get their own account and admins can get any account
	if (Number(req.params.id) !== req.user.id && req.user.role !== Role.Admin) {
		return res.status(401).json({ message: "Unauthorized" });
	}

	accountService
		.getById(req.params.id)
		.then((account) => (account ? res.json(account) : res.sendStatus(404)))
		.catch(next);
}

function createSchema(req, res, next) {
	const schema = Joi.object({
		title: Joi.string().required(),
		firstName: Joi.string().required(),
		lastName: Joi.string().required(),
		email: Joi.string().email().required(),
		password: Joi.string().min(6).required(),
		confirmPassword: Joi.string().valid(Joi.ref("password")).required(),
		role: Joi.string().valid(Role.Admin, Role.User).required(),
	});
	validateRequest(req, next, schema);
}

function create(req, res, next) {
	accountService
		.create(req.body)
		.then((account) => res.json(account))
		.catch(next);
}

function updateSchema(req, res, next) {
	const schemaRules = {
		title: Joi.string().empty(""),
		firstName: Joi.string().empty(""),
		lastName: Joi.string().empty(""),
		email: Joi.string().email().empty(""),
		company_name: Joi.string().required(),
		company_address: Joi.string().required(),
		mobile_number: Joi.string().required(),
		company_email: Joi.string().required(),
		company_logo: Joi.string().required(),
		id: Joi.string().required(),
		role: Joi.string().required(),
	};
	if (req.body.role === Role.Admin) {
		schemaRules.role = Joi.string().valid(Role.Admin, Role.User).empty("");
	}

	const schema = Joi.object(schemaRules).with("password", "confirmPassword");
	validateRequest(req, next, schema);
}

function update(req, res, next) {
	if (req.params.id != req.body.id) {
		return res.status(401).json({
			status: false,
			p: req.params.id,
			id: req.body,
			message: "Your are not authorised do this  request",
		});
	}

	accountService
		.update(req.params.id, req.body)
		.then((account) => res.json(account))
		.catch((err) => res.json(err));
}

function rejectUser(req, res, next) {
	if (Number(req.params.id) !== req.user.id && req.user.role !== Role.Admin) {
		return res.status(401).json({ message: "Unauthorized" });
	}

	accountService
		.rejectUser(req.params.id)
		.then((account) => res.json(account))
		.catch(next);
}

function approveUser(req, res, next) {
	if (Number(req.params.id) !== req.user.id && req.user.role !== Role.Admin) {
		return res.status(401).json({ message: "Unauthorized" });
	}

	accountService
		.approveUser(req.params.id)
		.then((account) => res.json(account))
		.catch(next);
}

function _delete(req, res, next) {
	// users can delete their own account and admins can delete any account
	if (Number(req.params.id) !== req.user.id && req.user.role !== Role.Admin) {
		return res.status(401).json({ message: "Unauthorized" });
	}

	accountService
		.delete(req.params.id)
		.then(() => res.json({ message: "Account deleted successfully" }))
		.catch(next);
}

// helper functions

function setTokenCookie(res, token) {
	// create cookie with refresh token that expires in 7 days
	const cookieOptions = {
		httpOnly: true,
		expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
	};
	res.cookie("refreshToken", token, cookieOptions);
}
