const jwt = require("jsonwebtoken");
const secretKey = process.env.JWT_SECRET || require("./config cypt");
const refreshSecretKey = process.env.JWT_REFRESH_SECRET || `${secretKey}_refresh`;

/**
 * JWT Configuration - Production Ready
 * Implements best practices for token management
 */

// Token expiration times
const ACCESS_TOKEN_EXPIRY = process.env.JWT_EXPIRY || "1h"; // Short-lived access token
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRY || "7d"; // Long-lived refresh token

/**
 * Generate Access Token
 * Short-lived token for API access
 */
function generateToken(user) {
  const payload = {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    role: user.role,
    type: "access", // Token type identifier
    iat: Math.floor(Date.now() / 1000), // Issued at
  };

  console.log("generateToken: Generating access token for user:", {
    id: payload.id,
    email: payload.email,
    role: payload.role,
  });

  return jwt.sign(payload, secretKey, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    issuer: "DMS-API", // Token issuer
    audience: "DMS-Client", // Token audience
  });
}

/**
 * Generate Refresh Token
 * Long-lived token for getting new access tokens
 */
function generateRefreshToken(user) {
  const payload = {
    id: user._id.toString(),
    type: "refresh", // Token type identifier
    iat: Math.floor(Date.now() / 1000),
  };

  console.log("generateRefreshToken: Generating refresh token for user:", {
    id: payload.id,
  });

  return jwt.sign(payload, refreshSecretKey, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
    issuer: "DMS-API",
    audience: "DMS-Client",
  });
}

/**
 * Generate Both Tokens
 * Returns both access and refresh tokens
 */
function generateTokenPair(user) {
  return {
    accessToken: generateToken(user),
    refreshToken: generateRefreshToken(user),
    expiresIn: ACCESS_TOKEN_EXPIRY,
  };
}

/**
 * Verify Access Token Middleware
 * Validates JWT token from Authorization header
 */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Check if Authorization header exists
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("verifyToken: No token provided or invalid format");
    return res.status(401).json({
      success: false,
      message: "Authentication required. Please provide a valid token.",
      code: "NO_TOKEN",
    });
  }

  const token = authHeader.split(" ")[1];

  // Check if token is blacklisted (optional - implement if needed)
  // if (isTokenBlacklisted(token)) {
  //   return res.status(401).json({
  //     success: false,
  //     message: "Token has been revoked",
  //     code: "TOKEN_REVOKED",
  //   });
  // }

  try {
    // Verify token
    const decoded = jwt.verify(token, secretKey, {
      issuer: "DMS-API",
      audience: "DMS-Client",
    });

    // Check token type
    if (decoded.type !== "access") {
      console.log("verifyToken: Invalid token type");
      return res.status(401).json({
        success: false,
        message: "Invalid token type",
        code: "INVALID_TOKEN_TYPE",
      });
    }

    // Check token expiration (additional check)
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) {
      console.log("verifyToken: Token expired");
      return res.status(401).json({
        success: false,
        message: "Token has expired. Please login again.",
        code: "TOKEN_EXPIRED",
      });
    }

    console.log("verifyToken: Token verified successfully", {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    });

    // Attach user info to request
    req.user = {
      id: decoded.id,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    console.error("verifyToken Error:", error.message);

    // Handle specific JWT errors
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired. Please login again.",
        code: "TOKEN_EXPIRED",
        expiredAt: error.expiredAt,
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token. Please login again.",
        code: "INVALID_TOKEN",
      });
    }

    if (error.name === "NotBeforeError") {
      return res.status(401).json({
        success: false,
        message: "Token not yet valid",
        code: "TOKEN_NOT_ACTIVE",
      });
    }

    // Generic error
    return res.status(401).json({
      success: false,
      message: "Authentication failed. Please login again.",
      code: "AUTH_FAILED",
    });
  }
};

/**
 * Verify Refresh Token
 * Validates refresh token for getting new access token
 */
const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, refreshSecretKey, {
      issuer: "DMS-API",
      audience: "DMS-Client",
    });

    // Check token type
    if (decoded.type !== "refresh") {
      throw new Error("Invalid token type");
    }

    return {
      valid: true,
      userId: decoded.id,
    };
  } catch (error) {
    console.error("verifyRefreshToken Error:", error.message);
    return {
      valid: false,
      error: error.message,
    };
  }
};

/**
 * Optional: Role-based middleware
 * Checks if user has required role
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        code: "NO_AUTH",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      console.log(`requireRole: User ${req.user.email} lacks required role. Has: ${req.user.role}, Needs: ${allowedRoles.join(" or ")}`);
      return res.status(403).json({
        success: false,
        message: "You don't have permission to access this resource",
        code: "INSUFFICIENT_PERMISSIONS",
        requiredRole: allowedRoles,
        userRole: req.user.role,
      });
    }

    next();
  };
};

/**
 * Optional: Admin-only middleware
 * Shorthand for requiring Admin or Superadmin role
 */
const requireAdmin = requireRole("Admin", "Superadmin");

/**
 * Decode token without verification (for debugging)
 * WARNING: Do not use for authentication!
 */
const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    console.error("decodeToken Error:", error.message);
    return null;
  }
};

module.exports = {
  generateToken,
  generateRefreshToken,
  generateTokenPair,
  verifyToken,
  verifyRefreshToken,
  requireRole,
  requireAdmin,
  decodeToken,
  // Export constants for use in other files
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
};
