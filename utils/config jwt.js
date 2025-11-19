const jwt = require("jsonwebtoken");
const secretKey = require("./config cypt");

function generateToken(user) {
  const payload = {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    role: user.role,
  };

  console.log("generateToken: Generating token for user:", {
    id: payload.id,
    email: payload.email,
    role: payload.role,
  });

  return jwt.sign(payload, secretKey, { expiresIn: "30d" });
}

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("verifyToken: No token provided or invalid format");
    return res.status(401).json({
      success: false,
      message: "No token provided or invalid format",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, secretKey);
    console.log("verifyToken: Token verified", {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    });
    req.user = decoded;
    next();
  } catch (error) {
    console.error("verifyToken Error:", error.message);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

module.exports = { generateToken, verifyToken };