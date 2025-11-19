const express = require("express");
const SmartfloDialerController = require("../Controller/SmartfloDialerController");
const { verifyToken } = require("../utils/config jwt");

const router = express.Router();

/**
 * Smartflo Dialer Routes
 * All routes require authentication
 */

// Click-to-call
router.post("/click-to-call", verifyToken, SmartfloDialerController.clickToCall);

// Schedule callback
router.post("/schedule-callback", verifyToken, SmartfloDialerController.scheduleCallback);

// Get call logs with filters
router.get("/call-logs", verifyToken, SmartfloDialerController.getCallLogs);

// Get call history for specific lead
router.get("/call-logs/:leadId", verifyToken, SmartfloDialerController.getLeadCallHistory);

// Manually log a call
router.post("/manual-log", verifyToken, SmartfloDialerController.manualCallLog);

module.exports = router;
