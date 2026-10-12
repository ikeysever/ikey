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

// Gen3 remains fail-closed. Only log configuration PRESENCE, never values.
const gen3Enabled=process.env.GEN3_AUTH_ENABLED==="true";
const gen3UrlValid=/^https:\/\/script\.google\.com\//.test(process.env.GEN3_APPS_SCRIPT_URL||"");
const gen3KeyValid=(process.env.GEN3_APPS_SCRIPT_KEY||"").length>=32;
const gen3Ready=gen3Enabled&&gen3UrlValid&&gen3KeyValid;
const googleReady=Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID&&process.env.GOOGLE_OAUTH_CLIENT_SECRET);
console.info("Gen3 startup configuration",JSON.stringify({
  enabled:gen3Enabled,
  appsScriptUrlConfigured:gen3UrlValid,
  appsScriptKeyConfigured:gen3KeyValid,
  googleOAuthConfigured:googleReady
}));
// Expose only Gen3 HTML entry pages; never serve server-side auth source.
const gen3Pages=new Set(["login.html","register.html","forgot-password.html","verify-email.html","reset-password.html","account.html"]);
app.get("/gen3/:page",(req,res)=>{
  if(!gen3Pages.has(req.params.page))return res.status(404).send("Not Found");
  res.set("Cache-Control","no-store");
  res.set("X-Content-Type-Options","nosniff");
  res.sendFile(path.join(__dirname,"gen3-auth",req.params.page));
});
const gen3Store=gen3Ready?require("./gen3-auth/sheets-store").createSheetsStore():null;
let readiness={until:0,storage:false,mail:false,reason:"CONFIG_MISSING"},pendingProbe=null;
function gen3FailureCategory(err){
  const msg=String(err?.message||"");
  if(msg==="GEN3_STORAGE_UNAUTHORIZED")return "APPS_SCRIPT_AUTH_FAILED";
  if(msg==="GEN3_STORAGE_DATABASE_NOT_CONFIGURED")return "APPS_SCRIPT_SHEET_NOT_SET";
  if(msg.startsWith("GEN3_STORAGE_MISSING_SHEET_")||msg.startsWith("GEN3_STORAGE_SCHEMA_MISMATCH_"))
    return "APPS_SCRIPT_SCHEMA_MISMATCH";
  if(msg==="GEN3_STORAGE_HTTP_ERROR")return "APPS_SCRIPT_HTTP_ERROR";
  if(msg==="GEN3_STORAGE_UNKNOWN_ACTION")return "APPS_SCRIPT_OUTDATED_ACTION";
  // GAS can return a descriptive exception message instead of a symbolic
  // error code. Categorize it without ever echoing its raw text (which can
  // contain a private spreadsheet identifier or Google account details).
  if(msg.startsWith("GEN3_STORAGE_")){
    const detail=msg.slice("GEN3_STORAGE_".length);
    if(/MailApp|mail quota|remainingdailyquota|email service|daily limit/i.test(detail))
      return "APPS_SCRIPT_MAILAPP_ACCESS_FAILED";
    if(/permission|authorization|authorized|access denied|insufficient|OAuth|consent|scope/i.test(detail))
      return "APPS_SCRIPT_PERMISSION_DENIED";
    if(/SpreadsheetApp|openById|spreadsheet|document|file not found|No item with the given ID|not accessible/i.test(detail))
      return "APPS_SCRIPT_SPREADSHEET_ACCESS_FAILED";
    if(/Exception:|Error:|Service invoked|Internal error|Script function/i.test(detail))
      return "APPS_SCRIPT_EXECUTION_ERROR";
  }
  // Apps Script returns short symbolic error codes. Never log raw upstream
  // responses, credentials, URLs, stack traces, or unvalidated error text.
  if(/^GEN3_STORAGE_[A-Z0-9_]{1,64}$/.test(msg))return "APPS_SCRIPT_"+msg.slice("GEN3_STORAGE_".length);
  if(err?.name==="AbortError")return "APPS_SCRIPT_TIMEOUT";
  if(err?.name==="SyntaxError")return "APPS_SCRIPT_NON_JSON_RESPONSE";
  const networkCode=String(err?.cause?.code||"");
  if(["ENOTFOUND","EAI_AGAIN"].includes(networkCode))return "APPS_SCRIPT_DNS_FAILURE";
  if(["ECONNRESET","ECONNREFUSED","ETIMEDOUT"].includes(networkCode))return "APPS_SCRIPT_NETWORK_FAILURE";
  if(err?.name==="TypeError"&&msg==="fetch failed")return "APPS_SCRIPT_FETCH_FAILED";
  return "APPS_SCRIPT_CONNECTION_FAILED";
}
async function checkGen3(){
  if(!gen3Store)return {storage:false,mail:false,reason:"CONFIG_MISSING"};
  if(Date.now()<readiness.until)return readiness;
  if(pendingProbe)return pendingProbe;
  pendingProbe=(async()=>{
    try{
      const r=await gen3Store.health();
      const storage=r?.version==="gen3-mailapp-v2"&&r.storage===true;
      const mail=storage&&r.mail_ready===true;
      const reason=!storage?"APPS_SCRIPT_VERSION_MISMATCH":!mail?"MAILAPP_NOT_READY":null;
      readiness={until:Date.now()+30000,storage,mail,reason};
      if(reason)console.warn("Gen3 health check",reason);
    }catch(err){
      const reason=gen3FailureCategory(err);
      console.warn("Gen3 health check",reason);
      readiness={until:Date.now()+15000,storage:false,mail:false,reason};
    }
    return readiness;
  })();
  try{return await pendingProbe}finally{pendingProbe=null}
}
app.get("/api/auth/status",async(req,res)=>{
  res.set("Cache-Control","no-store");
  const r=await checkGen3();
  res.json({enabled:r.storage,mail:r.mail,google:r.storage&&googleReady,reason:r.reason});
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
