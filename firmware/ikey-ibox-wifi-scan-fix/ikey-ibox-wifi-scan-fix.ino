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

extern const uint8_t caBundleStart[] asm("_binary_x509_crt_bundle_start");
extern const uint8_t caBundleEnd[] asm("_binary_x509_crt_bundle_end");

const char* DEVICE_ID="Y8R69EXB";
const char* DEVICE_PASSWORD="REPLACE_WITH_DEVICE_PASSWORD";
const char* AP_PASSWORD="REPLACE_WITH_UNIQUE_AP_PASSWORD"; // at least 8 chars
const char* SERVER="https://ikey.onrender.com";
const unsigned long CONNECT_TIMEOUT=15000, RETRY_MS=20000, POLL_MS=2500;
const unsigned long SCAN_TIMEOUT=18000, SCAN_QUIET=3000;
WebServer web(80);
DNSServer dns;
Preferences prefs;
String ssid, pass, token;
bool ap=false, connecting=false, scanActive=false, routes=false;
unsigned long connectAt=0, retryAt=0, pollAt=0, authAt=0, scanAt=0, scanQuietUntil=0, bootAt=0;
bool bootHeld=false;

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
int request(const String& path,const String& method,const String& body,String& response,bool authorized){
 WiFiClientSecure client;client.setCACertBundle(caBundleStart,caBundleEnd-caBundleStart);
 HTTPClient http;http.setTimeout(10000);
 if(!http.begin(client,String(SERVER)+path))return -1;
 http.addHeader("Content-Type","application/json");
 if(authorized && !token.isEmpty())http.addHeader("Authorization","Bearer "+token);
 int code=method=="POST"?http.POST(body):http.GET();
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
 JsonVariant cmd=d["command"].is<JsonObject>()?d["command"]:d.as<JsonVariant>();
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
  if(connecting){connecting=false;token="";Serial.println("[WIFI] CONNECTED");}
  if(ap && !scanActive && !connecting)endAP();
  if(token.isEmpty()){
   if(!authAt||millis()-authAt>=15000){authAt=millis();authenticate();}
  }else if(millis()-pollAt>=POLL_MS){pollAt=millis();poll();}
 }else{
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