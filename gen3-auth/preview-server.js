"use strict";
// Isolated Gen3 preview: no credentials, database writes, or unfinished auth APIs.
const http=require("node:http");
const fs=require("node:fs");
const path=require("node:path");
const port=Number(process.env.PORT)||3000;
const html=fs.readFileSync(path.join(__dirname,"register.html"),"utf8")
 .replace('<form id="register">','<form id="register" aria-describedby="preview-notice">')
 .replace('<form id="register" aria-describedby="preview-notice">','<p id="preview-notice" role="status" style="padding:12px;border:1px solid #e0a857;border-radius:8px">第三代介面預覽版：尚未開放註冊與登入，不會儲存資料。</p><form id="register" aria-describedby="preview-notice">')
 .replace('<button id="submit" type="submit">建立帳號</button>','<button id="submit" type="submit" disabled>註冊尚未開放</button>');
http.createServer((req,res)=>{
 res.setHeader("Cache-Control","no-store");
 res.setHeader("X-Content-Type-Options","nosniff");
 res.setHeader("Content-Security-Policy","default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
 if(req.method==="GET"&&(req.url==="/"||req.url==="/register")){
   res.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});return res.end(html);
 }
 if(req.method==="GET"&&req.url==="/health"){
   res.writeHead(200,{"Content-Type":"application/json"});return res.end('{"ok":true,"mode":"preview"}');
 }
 res.writeHead(404,{"Content-Type":"text/plain; charset=utf-8"});res.end("Not found");
}).listen(port,()=>console.log("iKey Gen3 isolated UI preview listening on "+port));
