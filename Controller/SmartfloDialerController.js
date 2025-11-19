const CallLog = require("../Schema/CallLogModel");
const Entry = require("../Schema/DataModel");
const User = require("../Schema/Model");
const smartfloClient = require("../services/smartfloClient");

/**
 * Smartflo Dialer Controller
 * Handles click-to-call, call logging, and callback scheduling
 */

/**
 * Initiate click-to-call
 * POST /api/dialer/click-to-call
 */
exports.clickToCall = async (req, res) => {
  try {
    const { leadId } = req.body;
    const userId = req.user.id;

    // 1) Lead validate
    const lead = await Entry.findById(leadId);
    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    if (!lead.mobileNumber) {
      return res.status(400).json({
        success: false,
        message: "Lead does not have a phone number",
      });
    }

    // 2) User validate
    const user = await User.findById(userId);
    if (!user || !user.smartfloEnabled || !user.smartfloAgentNumber) {
      return res.status(400).json({
        success: false,
        message: "User is not mapped to Smartflo agent. Please contact administrator.",
      });
    }

    if (!process.env.SMARTFLO_DEFAULT_CALLER_ID) {
      return res.status(500).json({
        success: false,
        message: "SMARTFLO_DEFAULT_CALLER_ID is not configured on server",
      });
    }

    const customIdentifier = `CRM_${leadId}_${Date.now()}`;

    // 3) Smartflo API call
    const payload = {
      agentNumber: user.smartfloAgentNumber,
      destinationNumber: lead.mobileNumber,
      callerId: process.env.SMARTFLO_DEFAULT_CALLER_ID,
      customIdentifier,
    };

    console.log("ClickToCall payload", {
      agentNumber: payload.agentNumber,
      destinationNumber: payload.destinationNumber,
      callerId: payload.callerId,
      customIdentifier,
    });
    const callResponse = await smartfloClient.clickToCall(payload);
    console.log("ClickToCall response", callResponse);

    // 4) Call log save
    const callLog = new CallLog({
      leadId: lead._id,
      userId: user._id,
      agentNumber: user.smartfloAgentNumber,
      destinationNumber: lead.mobileNumber,
      callerId: process.env.SMARTFLO_DEFAULT_CALLER_ID,
      providerCallId: callResponse.call_id || callResponse.id,
      customIdentifier,
      callStatus: "initiated",
      callDirection: "outbound",
    });

    await callLog.save();

    lead.totalCallsMade = (lead.totalCallsMade || 0) + 1;
    lead.lastCallDate = new Date();
    lead.lastCallStatus = "initiated";
    await lead.save();

    return res.status(200).json({
      success: true,
      message: "Call initiated successfully",
      callLogId: callLog._id,
      providerCallId: callLog.providerCallId,
      customIdentifier,
    });
  } catch (error) {
    console.error(
      "Click-to-call error:",
      error.response?.data || error.message || error
    );

    return res.status(error.response?.status || 500).json({
      success: false,
      message: "Failed to initiate call",
      providerError: error.response?.data || null,
      error: error.message,
      code: error.code || null,
    });
  }
};


/**
 * Schedule callback
 * POST /api/dialer/schedule-callback
 */
exports.scheduleCallback = async (req, res) => {
  try {
    const { leadId, callbackTime, reason } = req.body;
    const userId = req.user.id;

    // Validate inputs
    if (!leadId || !callbackTime) {
      return res.status(400).json({ message: "Lead ID and callback time are required" });
    }

    // Validate lead exists
    const lead = await Entry.findById(leadId);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    // Get user with Smartflo mapping
    const user = await User.findById(userId);
    if (!user || !user.smartfloEnabled || !user.smartfloAgentNumber) {
      return res.status(400).json({
        message: "User is not mapped to Smartflo agent",
      });
    }

    // Schedule callback via Smartflo
    const callbackResponse = await smartfloClient.scheduleCallback({
      agentNumber: user.smartfloAgentNumber,
      destinationNumber: lead.mobileNumber,
      callbackTime: new Date(callbackTime).toISOString(),
      remarks: reason || "",
    });

    // Update lead with callback info
    lead.callbackScheduled = new Date(callbackTime);
    lead.callbackReason = reason || "";
    await lead.save();

    res.status(200).json({
      success: true,
      message: "Callback scheduled successfully",
      callbackId: callbackResponse.id,
      scheduledTime: callbackTime,
    });
  } catch (error) {
    console.error("Schedule callback error:", error);
    res.status(500).json({
      message: "Failed to schedule callback",
      error: error.message,
    });
  }
};

/**
 * Get call logs with filters
 * GET /api/dialer/call-logs
 */
exports.getCallLogs = async (req, res) => {
  try {
    const { leadId, userId, status, startDate, endDate, page = 1, limit = 50 } = req.query;

    // Build filter
    const filter = {};
    if (leadId) filter.leadId = leadId;
    if (userId) filter.userId = userId;
    if (status) filter.callStatus = status;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch call logs
    const callLogs = await CallLog.find(filter)
      .populate("leadId", "customerName contactName mobileNumber email")
      .populate("userId", "username email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await CallLog.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: callLogs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get call logs error:", error);
    res.status(500).json({
      message: "Failed to fetch call logs",
      error: error.message,
    });
  }
};

/**
 * Get call history for specific lead
 * GET /api/dialer/call-logs/:leadId
 */
exports.getLeadCallHistory = async (req, res) => {
  try {
    const { leadId } = req.params;

    const callLogs = await CallLog.find({ leadId })
      .populate("userId", "username email")
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({
      success: true,
      data: callLogs,
      total: callLogs.length,
    });
  } catch (error) {
    console.error("Get lead call history error:", error);
    res.status(500).json({
      message: "Failed to fetch call history",
      error: error.message,
    });
  }
};

/**
 * Manually log a call (for offline calls)
 * POST /api/dialer/manual-log
 */
exports.manualCallLog = async (req, res) => {
  try {
    const { leadId, duration, disposition, remarks, callStatus } = req.body;
    const userId = req.user.id;

    // Validate lead exists
    const lead = await Entry.findById(leadId);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    // Get user
    const user = await User.findById(userId);

    // Create manual call log
    const callLog = new CallLog({
      leadId: lead._id,
      userId: user._id,
      agentNumber: user.smartfloAgentNumber || "manual",
      destinationNumber: lead.mobileNumber,
      callStatus: callStatus || "completed",
      callDirection: "outbound",
      duration: duration || 0,
      disposition,
      remarks,
      startTime: new Date(),
      endTime: new Date(),
    });

    await callLog.save();

    // Update lead statistics
    lead.totalCallsMade = (lead.totalCallsMade || 0) + 1;
    lead.lastCallDate = new Date();
    lead.lastCallStatus = callStatus || "completed";
    await lead.save();

    res.status(200).json({
      success: true,
      message: "Call logged successfully",
      callLogId: callLog._id,
    });
  } catch (error) {
    console.error("Manual call log error:", error);
    res.status(500).json({
      message: "Failed to log call",
      error: error.message,
    });
  }
};
