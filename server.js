const express = require("express");
const path = require("path");

const loginRoutes = require("./routes/login");
const healthRoutes = require("./routes/health");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// API Routes
app.use("/api/login", loginRoutes);
app.use("/api/health", healthRoutes);

// Frontend
app.use(express.static(path.join(__dirname, "public")));

// 啟動 Server
app.listen(PORT, () => {
  console.log(`iKey Server running on http://localhost:${PORT}`);
});