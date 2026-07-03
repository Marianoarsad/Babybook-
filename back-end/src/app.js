const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const { notFound, errorHandler } = require("./middleware/error");

const authRoutes = require("./routes/auth.routes");
const childrenRoutes = require("./routes/children.routes");
const recordRoutes = require("./routes/records.routes");
const memoriesRoutes = require("./routes/memories.routes");
const attachmentsRoutes = require("./routes/attachments.routes");
const shareRoutes = require("./routes/share.routes");
const consultRoutes = require("./routes/consult.routes");

const app = express();

// --- global middleware ---
const origins = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));

// Serve uploaded photos statically.
const uploadDir = process.env.UPLOAD_DIR || "uploads";
app.use("/uploads", express.static(path.resolve(process.cwd(), uploadDir)));

// --- health check ---
app.get("/api/health", (req, res) => res.json({ ok: true, service: "babybook-api" }));

// --- routes ---
app.use("/api/auth", authRoutes);
app.use("/api/children", childrenRoutes);
// Child-scoped record collections (vaccinations, checkups, growth, etc.)
app.use("/api/children", recordRoutes);
app.use("/api/children", memoriesRoutes);
app.use("/api/children", attachmentsRoutes);
app.use("/api/children", shareRoutes);
// Public, no-auth endpoint used by the healthcare-professional QR flow.
app.use("/api/consult", consultRoutes);

// --- errors ---
app.use(notFound);
app.use(errorHandler);

module.exports = app;
