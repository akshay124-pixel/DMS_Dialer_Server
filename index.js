if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
const express = require("express");
const dbconnect = require("./utils/db.connect");
const cors = require("cors");
const LoginRoute = require("./Router/LoginRoute");
const SignupRoute = require("./Router/SignupRoute");
const DataRoute = require("./Router/DataRouter");
const SmartfloDialerRouter = require("./Router/SmartfloDialerRouter");
const SmartfloAdminRouter = require("./Router/SmartfloAdminRouter");
const SmartfloWebhookRouter = require("./Router/SmartfloWebhookRouter");
const SmartfloAnalyticsRouter = require("./Router/SmartfloAnalyticsRouter");
const app = express();
const port = process.env.PORT || 4000;

// CORS options
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.APP_URL || "").split(",").map((o) => o.trim()).filter((o) => o.length > 0);
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0) return callback(null, true);
    const ok = allowedOrigins.some((o) => origin === o || (o.startsWith("*") && origin.endsWith(o.slice(1))));
    callback(ok ? null : new Error("Not allowed by CORS"), ok);
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// API Routes Middleware
app.use("/auth", LoginRoute);
app.use("/user", SignupRoute);
app.use("/api", DataRoute);

// Smartflo Integration Routes
app.use("/api/dialer", SmartfloDialerRouter);
app.use("/api/smartflo", SmartfloAdminRouter);
app.use("/api/webhooks/smartflo", SmartfloWebhookRouter);
app.use("/api/analytics", SmartfloAnalyticsRouter);

dbconnect()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("Database connection failed", error);
    process.exit(1);
  });
