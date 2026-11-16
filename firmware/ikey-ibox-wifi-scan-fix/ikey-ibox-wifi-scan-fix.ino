// iKey 3.1 iBOX ESP32 - Wi-Fi fallback provisioning + serial-only test
// Arduino-ESP32 core 3.x; ArduinoJson 7.x. No lock GPIO output.
// Set DEVICE_PASSWORD locally before flashing; never commit actual credentials.
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <time.h>
#include <sys/time.h>
#include <esp_system.h>
#include <mbedtls/pk.h>
#include <mbedtls/base64.h>
#include <mbedtls/sha256.h>

extern const uint8_t caBundleStart[] asm("_binary_x509_crt_bundle_start");
extern const uint8_t caBundleEnd[] asm("_binary_x509_crt_bundle_end");

const char* DEVICE_ID="Y8R69EXB";
const char* DEVICE_PASSWORD="REPLACE_WITH_DEVICE_PASSWORD";
const char* AP_PASSWORD="REPLACE_WITH_UNIQUE_AP_PASSWORD"; // at least 8 chars
const char* SERVER="https://ikey.onrender.com";
// Provision with the matching Render signing key public PEM before flashing.
// Do not embed private keys or device credentials in the repository.
const char* TIME_PUBLIC_KEY_PEM=R"PEM(-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEZ3RiBpRjxUJ6zjMrfqGFpDAcAWAR
gDZP2/UYbm/2mad8LdGndFpbcX5GzXi2AT3k6smnfsYC+tebf/ZFwhhKRA==
-----END PUBLIC KEY-----)PEM";
const unsigned long CONNECT_TIMEOUT=15000, RETRY_MS=20000, POLL_MS=2500;
const unsigned long SCAN_TIMEOUT=18000, SCAN_QUIET=3000;
WebServer web(80);
DNSServer dns;
Preferences prefs;
String ssid, pass, token;
bool ap=false, connecting=false, scanActive=false, routes=false;
unsigned long connectAt=0, retryAt=0, pollAt=0, authAt=0, scanAt=0, scanQuietUntil=0, bootAt=0;
bool bootHeld=false;
bool ntpStarted=false, timeReady=false;
unsigned long ntpAt=0, ntpLogAt=0, ntpRetryAt=0, signedTimeAt=0;
const unsigned long SIGNED_TIME_RETRY_MS=30000, NTP_FALLBACK_AFTER_MS=15000;
const unsigned long NTP_RETRY_MS=60000;
const char* NTP_HOSTS[]={"pool.ntp.org","time.google.com","time.cloudflare.com"};
const time_t MIN_VALID_EPOCH=1700000000; // 2023-11-14 UTC; TLS certificate validation requires a valid clock

const char PAGE[] PROGMEM=R"HTML(
<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>iKey Wi-Fi 設定</title>
<style>body{background:#0b1220;color:#f8fafc;font:16px sans-serif;padding:20px}
main{max-width:440px;margin:auto;background:#1b3150;padding:24px;border-radius:16px}
h1{color:#63d8e8}input,select,button{box-sizing:border-box;width:100%;padding:12px;margin:8px 0 15px;border-radius:8px;font-size:16px}
input,select{background:#0b1220;color:white;border:1px solid #6c829e}
button{background:#63d8e8;border:0;color:#0b1220;font-weight:bold}
#msg{white-space:pre-wrap;line-height:1.6}</style></head><body><main>
<h1>iKey iBOX</h1><p>請使用 2.4 GHz Wi-Fi；掃描失敗時可手動輸入 SSID。</p>
<button onclick="scan()">重新掃描 Wi-Fi</button>
<label>附近網路</label><select id="net" onchange="if(this.value)document.getElementById('ssid').value=this.value">
<option value="">請選擇 Wi-Fi</option></select>
<label>Wi-Fi 名稱（SSID）</label><input id="ssid" autocomplete="off">
<label>Wi-Fi 密碼</label><input id="pass" type="password">
<button onclick="save()">儲存並連線</button><p id="msg"></p>
<script>
const el=id=>document.getElementById(id);
const msg=s=>el('msg').textContent=s;
async function scan(){
 msg('正在掃描...');el('net').innerHTML='<option value="">掃描中...</option>';
 try{
  let r=await fetch('/scan/start',{cache:'no-store'}),a=await r.json();
  if(!r.ok)throw Error(a.error||'掃描啟動失敗');
  for(let i=0;i<40;i++){
   await new Promise(resolve=>setTimeout(resolve,500));
   let j=await (await fetch('/scan/result',{cache:'no-store'})).json();
   if(j.scanning)continue;
   if(j.error)throw Error(j.error);
   el('net').innerHTML='<option value="">請選擇 Wi-Fi</option>';
   for(const n of (j.networks||[])){
    let o=document.createElement('option');o.value=n.ssid;o.textContent=n.ssid+' ('+n.rssi+' dBm)';el('net').appendChild(o);
   }
   msg('找到 '+(j.networks||[]).length+' 個網路。也可手動輸入 SSID。');return;
  }
  throw Error('掃描逾時');
 }catch(e){msg('掃描未完成：'+e.message+'。請手動輸入 SSID 或稍後重試。');}
}
async function save(){
 let s=el('ssid').value,p=el('pass').value;
 if(!s){msg('請輸入 SSID');return}
 let r=await fetch('/save',{method:'POST',body:new URLSearchParams({ssid:s,password:p})});
 msg(await r.text());
}
scan();
</script></main></body></html>
)HTML";

void beginAP();
void startSTA();

void registerRoutes(){
 if(routes)return;routes=true;
 web.on("/",HTTP_GET,[](){web.send_P(200,"text/html; charset=utf-8",PAGE);});
 web.on("/scan/start",HTTP_GET,[](){
  if(scanActive){web.send(200,"application/json","{\"scanning\":true}");return;}
  if(connecting){WiFi.disconnect(false,false);connecting=false;Serial.println("[SCAN] STA attempt paused");}
  WiFi.mode(WIFI_AP_STA);
  WiFi.scanDelete();
  int n=WiFi.scanNetworks(true,true);
  scanAt=millis();scanQuietUntil=millis()+SCAN_QUIET;
  scanActive=(n==WIFI_SCAN_RUNNING);
  Serial.printf("[SCAN] start=%d (-2 means running)\n",n);
  if(n==WIFI_SCAN_FAILED){web.send(503,"application/json","{\"error\":\"scan start failed\"}");return;}
  web.send(200,"application/json","{\"started\":true}");
 });
 web.on("/scan/result",HTTP_GET,[](){
  int n=WiFi.scanComplete();
  if(n==WIFI_SCAN_RUNNING && millis()-scanAt<SCAN_TIMEOUT){
   web.send(200,"application/json","{\"scanning\":true}");return;
  }
  JsonDocument d;d["scanning"]=false;
  JsonArray a=d["networks"].to<JsonArray>();
  if(n>=0){
   Serial.printf("[SCAN] found=%d\n",n);
   for(int i=0;i<n;i++){
    String name=WiFi.SSID(i);if(name.isEmpty())continue;
    JsonObject o=a.add<JsonObject>();o["ssid"]=name;o["rssi"]=WiFi.RSSI(i);
   }
  }else{d["error"]=(n==WIFI_SCAN_RUNNING?"timeout":"scan failed");Serial.printf("[SCAN] result=%d\n",n);}
  scanActive=false;scanQuietUntil=millis()+SCAN_QUIET;
  String out;serializeJson(d,out);web.send(200,"application/json",out);
  WiFi.scanDelete();
 });
 web.on("/save",HTTP_POST,[](){
  String s=web.arg("ssid"),p=web.arg("password");
  if(s.isEmpty()){web.send(400,"text/plain","SSID required");return;}
  prefs.putString("ssid",s);prefs.putString("password",p);
  ssid=s;pass=p;token="";
  scanActive=false;WiFi.scanDelete();scanQuietUntil=millis()+1500;
  retryAt=0;connecting=false;
  web.send(200,"text/plain; charset=utf-8","已儲存設定，正在連線；請觀察序列監控。");
  Serial.printf("[WIFI] saved SSID=%s\n",ssid.c_str());
 });
 web.onNotFound([](){web.sendHeader("Location","http://192.168.4.1/",true);web.send(302,"text/plain","");});
}

void beginAP(){
 if(ap)return;
 WiFi.mode(WIFI_AP_STA);WiFi.setSleep(false);
 String name="iKey-Setup-"+String(DEVICE_ID);
 if(!WiFi.softAP(name.c_str(),AP_PASSWORD)){Serial.println("[PORTAL] AP FAILED");return;}
 registerRoutes();web.begin();dns.start(53,"*",WiFi.softAPIP());ap=true;
 Serial.printf("[PORTAL] AP %s READY\n",name.c_str());
 Serial.printf("[PORTAL] Open http://%s\n",WiFi.softAPIP().toString().c_str());
}
void endAP(){
 if(!ap)return;
 dns.stop();web.stop();WiFi.softAPdisconnect(true);ap=false;
 WiFi.mode(WIFI_STA);Serial.println("[PORTAL] Closed (external Wi-Fi connected)");
}
void startSTA(){
 if(ssid.isEmpty()){beginAP();return;}
 if(scanActive || (scanQuietUntil && (int32_t)(millis()-scanQuietUntil)<0))return;
 WiFi.mode(ap?WIFI_AP_STA:WIFI_STA);WiFi.setSleep(false);
 WiFi.begin(ssid.c_str(),pass.c_str());
 connecting=true;connectAt=millis();retryAt=millis();
 Serial.printf("[WIFI] Connecting to %s\n",ssid.c_str());
}
bool verifySignedTime(const String& nonce,int64_t unix,const String& signature){
 if(strstr(TIME_PUBLIC_KEY_PEM,"REPLACE_WITH_"))return false;
 if(unix<1700000000LL || unix>4102444800LL || signature.length()>256)return false;
 char timestamp[24];snprintf(timestamp,sizeof(timestamp),"%lld",(long long)unix);
 String msg=String("ikey-time-v1\n")+nonce+"\n"+timestamp;
 unsigned char decoded[128];size_t len=0;
 if(mbedtls_base64_decode(decoded,sizeof(decoded),&len,
  (const unsigned char*)signature.c_str(),signature.length())!=0)return false;
 mbedtls_pk_context pk;mbedtls_pk_init(&pk);
 int rc=mbedtls_pk_parse_public_key(&pk,(const unsigned char*)TIME_PUBLIC_KEY_PEM,
  strlen(TIME_PUBLIC_KEY_PEM)+1);
 if(rc==0){
  unsigned char digest[32];
  mbedtls_sha256((const unsigned char*)msg.c_str(),msg.length(),digest,0);
  rc=mbedtls_pk_verify(&pk,MBEDTLS_MD_SHA256,digest,sizeof(digest),decoded,len);
 }
 mbedtls_pk_free(&pk);return rc==0;
}
void trySignedTime(){
 if(strstr(TIME_PUBLIC_KEY_PEM,"REPLACE_WITH_")){
  Serial.println("[TIME] Signed fallback not configured: public key missing");
  return;
 }
 unsigned char randomBytes[16];esp_fill_random(randomBytes,sizeof(randomBytes));
 char nonce[33];for(int i=0;i<16;i++)sprintf(nonce+i*2,"%02x",randomBytes[i]);
 WiFiClientSecure client;
 // Only the public, signed clock bootstrap uses unauthenticated TLS transport.
 // Its nonce-bound ECDSA signature is mandatory before setting the clock.
 // All device authentication and command requests retain full TLS validation.
 client.setInsecure();HTTPClient http;http.setTimeout(8000);
 String url=String("https://ikey.onrender.com/api/device/signed-time?nonce=")+nonce;
 // Unauthenticated bootstrap TLS is transport only; ECDSA authenticates the time response.
 if(!http.begin(client,url)){Serial.println("[TIME] Fallback transport init failed");return;}
 int code=http.GET();String response=code==200?http.getString():"";http.end();
 if(code!=200){Serial.printf("[TIME] Signed fallback HTTP %d\\n",code);return;}
 JsonDocument doc;if(deserializeJson(doc,response)!=DeserializationError::Ok)return;
 String gotNonce=doc["nonce"]|"";String signature=doc["signature"]|"";
 int64_t unix=doc["unix"].as<int64_t>();
 if(gotNonce!=nonce || (doc["version"]|0)!=1 ||
  (doc["algorithm"]|String(""))!="ES256-DER" ||
  !verifySignedTime(gotNonce,unix,signature)){
  Serial.println("[TIME] Signed fallback rejected: signature/nonce invalid");return;
 }
 struct timeval tv={(time_t)unix,0};
 if(settimeofday(&tv,nullptr)==0){
  timeReady=true;
  Serial.println("[TIME] Signed UTC fallback verified; HTTPS enabled");
 }
}
void updateClock(){
 if(WiFi.status()!=WL_CONNECTED)return;
 if(!ntpStarted){
  configTime(0,0,NTP_HOSTS[0],NTP_HOSTS[1],NTP_HOSTS[2]);
  ntpStarted=true;ntpAt=millis();ntpLogAt=millis();ntpRetryAt=millis();
  Serial.println("[TIME] NTP started; waiting for valid UTC clock");
 }
 time_t now=time(nullptr);
 if(now>=MIN_VALID_EPOCH){
  if(!timeReady){
   timeReady=true;
   struct tm utc;gmtime_r(&now,&utc);
   Serial.printf("[TIME] NTP synchronized (UTC %04d-%02d-%02d %02d:%02d:%02d)\n",
    utc.tm_year+1900,utc.tm_mon+1,utc.tm_mday,utc.tm_hour,utc.tm_min,utc.tm_sec);
  }
 }else if(millis()-ntpLogAt>=10000){
  ntpLogAt=millis();
  Serial.printf("[TIME] Waiting for NTP (%lu ms); IP=%s RSSI=%d dBm gateway=%s DNS=%s\n",
    (unsigned long)(millis()-ntpAt),WiFi.localIP().toString().c_str(),
    WiFi.RSSI(),WiFi.gatewayIP().toString().c_str(),WiFi.dnsIP().toString().c_str());
  Serial.println("[TIME] Skipping synchronous DNS probes to avoid lwIP UDP core-lock assertion.");
  Serial.println("[TIME] HTTPS auth paused; UDP/123 may be restricted.");
 }
 if(!timeReady && millis()-ntpAt>=NTP_FALLBACK_AFTER_MS &&
    (!signedTimeAt || millis()-signedTimeAt>=SIGNED_TIME_RETRY_MS)){
  signedTimeAt=millis();trySignedTime();
 }
 if(!timeReady && millis()-ntpRetryAt>=NTP_RETRY_MS){
  ntpRetryAt=millis();
  Serial.println("[TIME] Retrying NTP; TLS verification remains enabled");
  configTime(0,0,NTP_HOSTS[0],NTP_HOSTS[1],NTP_HOSTS[2]);
 }
}
int request(const String& path,const String& method,const String& body,String& response,bool authorized){
 WiFiClientSecure client;client.setCACertBundle(caBundleStart,caBundleEnd-caBundleStart);
 HTTPClient http;http.setTimeout(10000);
 if(!http.begin(client,String(SERVER)+path)){
  Serial.printf("[HTTPS] http.begin failed path=%s\n",path.c_str());
  return -1;
 }
 http.addHeader("Content-Type","application/json");
 if(authorized && !token.isEmpty())http.addHeader("Authorization","Bearer "+token);
 int code=method=="POST"?http.POST(body):http.GET();
 if(code<0){
  Serial.printf("[HTTPS] %s %s failed: %d (%s)\n",
   method.c_str(),path.c_str(),code,http.errorToString(code).c_str());
  Serial.println("[HTTPS] DNS probe omitted; investigate TLS/network with the error above.");
 }
 response=code>0?http.getString():"";http.end();return code;
}
void authenticate(){
 JsonDocument d;d["device_id"]=DEVICE_ID;d["password"]=DEVICE_PASSWORD;
 String body,response;serializeJson(d,body);
 int code=request("/api/device/auth","POST",body,response,false);
 Serial.printf("[AUTH] HTTP %d\n",code);
 JsonDocument r;
 if(code==200 && deserializeJson(r,response)==DeserializationError::Ok &&
    r["success"]==true && r["access_token"].is<String>()){
  token=r["access_token"].as<String>();Serial.println("[AUTH] SUCCESS");
 }
}
void poll(){
 String response;int code=request("/api/device/serial-test/next","GET","",response,true);
 if(code==204)return;
 if(code==401||code==403){token="";Serial.printf("[POLL] HTTP %d\n",code);return;}
 if(code!=200){Serial.printf("[POLL] HTTP %d\n",code);return;}
 JsonDocument d;if(deserializeJson(d,response)!=DeserializationError::Ok)return;
 JsonVariant cmd = d.as<JsonVariant>();
 if(d["command"].is<JsonObject>()) {
  cmd = d["command"].as<JsonVariant>();
 }
 String id=cmd["command_id"]|"";String action=cmd["action"]|"";
 if(id.isEmpty()||action!="SERIAL_TEST_UNLOCK")return;
 Serial.println("===== iKey SERIAL ONLY COMMAND =====");
 Serial.println("Command: "+id);Serial.println("Action: "+action);
 Serial.println("NO LOCK GPIO CONTROL");
 JsonDocument report;report["command_id"]=id;report["result"]="SERIAL_PRINTED";
 String body,out;serializeJson(report,body);
 int result=request("/api/device/serial-test/report","POST",body,out,true);
 Serial.printf("[REPORT] HTTP %d\n",result);
}
void setup(){
 Serial.begin(115200);delay(800);
 Serial.println("iKey 3.1 iBOX fallback Wi-Fi + serial-only command receiver");
 pinMode(0,INPUT_PULLUP);
 prefs.begin("ikeywifi",false);
 ssid=prefs.getString("ssid","");pass=prefs.getString("password","");
 WiFi.persistent(false);WiFi.setSleep(false);
 if(ssid.isEmpty())beginAP();else startSTA();
}
void loop(){
 if(ap){dns.processNextRequest();web.handleClient();}
 if(digitalRead(0)==LOW){
  if(!bootAt)bootAt=millis();
  if(!bootHeld && millis()-bootAt>=5000){bootHeld=true;beginAP();}
 }else{bootAt=0;bootHeld=false;}
 if(WiFi.status()==WL_CONNECTED){
  if(connecting){
   connecting=false;token="";ntpStarted=false;timeReady=false;
   Serial.printf("[WIFI] CONNECTED, IP=%s, RSSI=%d dBm\n",
    WiFi.localIP().toString().c_str(),WiFi.RSSI());
  }
  updateClock();
  if(ap && !scanActive && !connecting)endAP();
  if(!timeReady){
   // Never bypass TLS certificate verification when the clock is invalid.
  }else if(token.isEmpty()){
   if(!authAt||millis()-authAt>=15000){authAt=millis();authenticate();}
  }else if(millis()-pollAt>=POLL_MS){pollAt=millis();poll();}
 }else{
  ntpStarted=false;timeReady=false;
  if(connecting && millis()-connectAt>=CONNECT_TIMEOUT){
   connecting=false;Serial.printf("[WIFI] Timeout, status=%d\n",(int)WiFi.status());beginAP();
  }
  if(!ap && !connecting)beginAP();
  if(!ssid.isEmpty() && !connecting && !scanActive &&
     (!retryAt||millis()-retryAt>=RETRY_MS))startSTA();
  if(ap && WiFi.softAPIP()==IPAddress(0,0,0,0)){ap=false;beginAP();}
 }
 delay(5);
}