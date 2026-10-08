const express = require("express");
const path = require("path");

const loginRoutes = require("./routes/login");
const adminAuthRoutes = require("./lib/ibox/admin-auth-routes");
const healthRoutes = require("./routes/health");
const deviceRoutes = require("./routes/device");
const databaseRoutes = require("./routes/database");
const lineRoutes = require("./routes/line");

const app = express();

const PORT =
  process.env.PORT || 3000;


/*
 * =========================================
 * Middleware
 * =========================================
 */

// LINE webhook needs the exact raw request body for x-line-signature verification.
app.use(
  "/api/line/webhook",
  express.raw({ type: "application/json" })
);

app.use(express.json());


/*
 * =========================================
 * API Routes
 * =========================================
 */

app.use("/api/login", adminAuthRoutes);
app.use(
  "/api/login",
  loginRoutes
);

app.use(
  "/api/health",
  healthRoutes
);

app.use(
  "/api/device",
  deviceRoutes
);

app.use(
  "/api/database",
  databaseRoutes
);

app.use(
  "/api/line",
  lineRoutes
);


/*
 * =========================================
 * Frontend
 * =========================================
 */

app.use(
  express.static(
    path.join(
      __dirname,
      "public"
    )
  )
);


/*
 * =========================================
 * Start Server
 * =========================================
 */

app.listen(
  PORT,
  () => {

    console.log(
      `iKey Server running on port ${PORT}`
    );

  }
);
