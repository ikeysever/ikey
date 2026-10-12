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
  process.env.GEN3_APPS_SCRIPT_KEY
);
// Expose only the Gen3 HTML entry pages. Never serve server-side auth source,
 // Apps Script code, tests, or deployment notes as static files.
const gen3Pages=new Set(["login.html","register.html","forgot-password.html","verify-email.html","reset-password.html"]);
app.get("/gen3/:page",(req,res)=>{
  if(!gen3Pages.has(req.params.page))return res.status(404).send("Not Found");
  res.set("Cache-Control","no-store");
  res.set("X-Content-Type-Options","nosniff");
  res.sendFile(path.join(__dirname,"gen3-auth",req.params.page));
});
const googleReady=Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID&&process.env.GOOGLE_OAUTH_CLIENT_SECRET);
const gen3Store=gen3Ready?require("./gen3-auth/sheets-store").createSheetsStore():null;
let readiness={until:0,storage:false,mail:false},pendingProbe=null;
async function checkGen3(){
  if(!gen3Store)return {storage:false,mail:false};
  if(Date.now()<readiness.until)return readiness;
  if(pendingProbe)return pendingProbe;
  pendingProbe=(async()=>{
    try{
      const r=await gen3Store.health();
      const storage=r?.version==="gen3-mailapp-v2"&&r.storage===true;
      readiness={until:Date.now()+30000,storage,mail:storage&&r.mail_ready===true};
    }catch{readiness={until:Date.now()+15000,storage:false,mail:false}}
    return readiness;
  })();
  try{return await pendingProbe}finally{pendingProbe=null}
}
app.get("/api/auth/status",async(req,res)=>{
  res.set("Cache-Control","no-store");
  const r=await checkGen3();
  res.json({enabled:r.storage,mail:r.mail,google:r.storage&&googleReady});
});
if(gen3Store){
  const {createRouter}=require("./gen3-auth/routes");
  app.use("/api/auth",async(req,res,next)=>{
    const r=await checkGen3();
    if(!r.storage)return res.status(503).json({success:false,code:"GEN3_NOT_READY",message:"第三代帳號服務尚未完成連線驗證"});
    if(!r.mail&&req.method==="POST"&&["/register","/resend-verification","/forgot-password"].includes(req.path))
      return res.status(503).json({success:false,code:"GEN3_MAIL_NOT_READY",message:"電子郵件驗證服務尚未完成設定"});
    next();
  },createRouter(gen3Store));
}else{
  app.use("/api/auth",(req,res)=>res.status(503).json({success:false,code:"GEN3_NOT_CONFIGURED",message:"第三代帳號服務尚未完成設定"}));
}

app.listen(
  PORT,
  () => {

    console.log(
      `iKey Server running on port ${PORT}`
    );

  }
);
