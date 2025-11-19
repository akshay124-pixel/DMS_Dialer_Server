const User = require("../Schema/Model");
const bcrypt = require("bcrypt");
const { generateToken } = require("../utils/config jwt");
const jwt = require("jsonwebtoken");
const secretkey = require("../utils/config cypt");
// Signup Controller
const Signup = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingEmailUser = await User.findOne({ email });
    if (existingEmailUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      role,
    });

    await newUser.save();

    const token = generateToken(newUser);

    res.status(201).json({
      message: "Your account has been created successfully!",

      user: {
        id: newUser._id.toString(),
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
      },
      token,
    });
  } catch (error) {
    console.error("Signup Error:", error);
    return res.status(500).json({
      message:
        "Something went wrong while creating your account. Please try again later.",
    });
  }
};

// Login Controller
const Login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).lean();
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const payload = {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
    };
    console.log("Login: Generating token for user:", payload); // Debug log
    const token = jwt.sign(payload, secretkey, {
      expiresIn: "1h",
    });

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        isAdmin: user.role === "Admin",
        isSuperadmin: user.role === "Superadmin",
      },
    });
  } catch (error) {
    console.error("Login Error:", error.message);
    return res.status(500).json({
      message:
        "Oops! Something went wrong while logging you in. Please try again later.",
    });
  }
};
const getUserRole = async (req, res) => {
  try {
    console.log("getUserRole: userId:", req.user.id, "role:", req.user.role); // Debug log
    return res.status(200).json({
      id: req.user.id,
      role: req.user.role,
      isAdmin: req.user.role === "Admin",
      isSuperadmin: req.user.role === "Superadmin",
    });
  } catch (error) {
    console.error("getUserRole Error:", error.message);
    return res.status(500).json({
      message:
        "Sorry, we couldn’t fetch your user role right now. Please try again later.",
    });
  }
};

const ChangePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, email } = req.body;
    const userId = req.user.id; // From JWT middleware

    console.log("ChangePassword: Request received", { userId, email });

    if (!currentPassword || !newPassword || !email) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password",
      });
    }

    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          "New password must be at least 8 characters long and include uppercase, lowercase, number, and special character",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      console.log("ChangePassword: User not found", { userId });
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (user.email !== email) {
      console.log("ChangePassword: Email mismatch", {
        providedEmail: email,
        userEmail: user.email,
      });
      return res.status(403).json({
        success: false,
        message: "Email does not match authenticated user",
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      console.log("ChangePassword: Current password incorrect for user", {
        userId,
      });
      return res
        .status(401)
        .json({ success: false, message: "Current password is incorrect" });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedNewPassword;
    user.lastPasswordChange = new Date();
    await user.save();

    console.log("ChangePassword: Password changed successfully for user", {
      userId,
    });

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change Password Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "An error occurred while changing password",
    });
  }
};

module.exports = { Signup, Login, getUserRole, ChangePassword };
