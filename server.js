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

// Third-generation authentication is isolated and fail-closed.
const gen3Ready=Boolean(
  process.env.GEN3_AUTH_ENABLED==="true" &&
  process.env.GEN3_APPS_SCRIPT_URL &&
  process.env.GEN3_APPS_SCRIPT_KEY &&
  process.env.RESEND_API_KEY &&
  process.env.GEN3_MAIL_FROM &&
  process.env.GOOGLE_OAUTH_CLIENT_ID &&
  process.env.GOOGLE_OAUTH_CLIENT_SECRET
);
if(gen3Ready){
  const {createSheetsStore}=require("./gen3-auth/sheets-store");
  const {createRouter}=require("./gen3-auth/routes");
  app.use("/api/auth",createRouter(createSheetsStore()));
  app.use("/gen3",express.static(path.join(__dirname,"gen3-auth"),{
    index:false,fallthrough:false,setHeaders(res){res.setHeader("Cache-Control","no-store");res.setHeader("X-Content-Type-Options","nosniff");}
  }));
}

app.listen(
  PORT,
  () => {

    console.log(
      `iKey Server running on port ${PORT}`
    );

  }
);
