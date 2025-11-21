const { Login, ChangePassword, RefreshToken } = require("../Controller/AuthLogic");
const { verifyToken } = require("../utils/config jwt");
const express = require("express");
const router = express.Router();

// Authentication routes
router.route("/login").post(Login);
router.route("/refresh-token").post(RefreshToken);
router.route("/change-password").post(verifyToken, ChangePassword);

// Token verification endpoint
router.get("/verify-token", verifyToken, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Token is valid",
    user: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role,
    },
  });
});

module.exports = router;
