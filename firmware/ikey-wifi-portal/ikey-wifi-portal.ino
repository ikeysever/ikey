// iKey iBOX Wi-Fi portal + serial-only unlock test (ESP32 Arduino core 3.x).
// BOOT (GPIO0) held 5 seconds AFTER startup opens the local Wi-Fi portal.
// IMPORTANT: BOOT held DURING reset can put ESP32 into firmware download mode.
// No relay or lock GPIO is ever driven.
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <time.h>

// Public ISRG Root X1 trust anchor. If Render changes its issuing CA,
// connections intentionally fail closed until the trust store is updated.
static const char ROOT_CA[] PROGMEM = R"CERT(-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu
ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY
MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc
h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+
0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U
A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW
T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH
B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC
B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv
KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn
OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn
jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw
qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI
rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV
HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq
hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL
ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ
3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK
NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5
ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur
TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC
jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc
oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq
4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA
mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d
emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=
-----END CERTIFICATE-----)CERT";

const char* DEVICE_ID = "YOUR8ID";
const char* DEVICE_PASSWORD = "YOUR_DEVICE_PASSWORD";
const char* SERVER = "https://ikey.onrender.com";
const char* SETUP_AP_PASSWORD = "CHANGE_TO_UNIQUE_12_CHAR_SECRET"; // Set a DIFFERENT 12+ character secret per device before flashing.
// Never publish a real provisioning password in a public repository.
constexpr int BOOT_BUTTON_PIN = 0;
constexpr uint32_t BOOT_HOLD_MS = 5000;
constexpr uint32_t AP_IDLE_TIMEOUT_MS = 5UL * 60UL * 1000UL;
constexpr uint32_t AP_MAX_REQUESTS = 30;
uint32_t apRequestCount=0;
uint8_t failedProvisionAttempts=0;
constexpr uint32_t POLL_MS = 2500;
WebServer portal(80);
DNSServer dns;
Preferences prefs;
String wifiSsid, wifiPass, token, apName, portalNotice;
uint32_t tokenAt=0,lastPoll=0,lastAuthAttempt=0,lastReconnect=0,holdStart=0,apStarted=0;
bool setupMode=false,portalRoutesReady=false,buttonLatched=false,hasSavedWiFi=false;

String htmlEscape(String s) {
 s.replace("&","&amp;"); s.replace("<","&lt;"); s.replace(">","&gt;");
 s.replace("\"","&quot;"); s.replace("'","&#39;"); return s;
}
void noCache() {
 portal.sendHeader("Cache-Control","no-store");
 portal.sendHeader("X-Content-Type-Options","nosniff");
 portal.sendHeader("Content-Security-Policy","default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'");
}
bool backendRequest(const String& path, const char* method, const String& body, String& response, int& code) {
 WiFiClientSecure client;
 // TLS certificate chain + hostname verification (no insecure fallback).
 // Valid wall clock is required to verify certificate validity.
 time_t now=time(nullptr);
 if(now<1735689600){Serial.println("[TLS] Time not synchronized");return false;}
 client.setCACert(ROOT_CA);
 HTTPClient http;
 if (!http.begin(client, String(SERVER)+path)) return false;
 http.setTimeout(8000);
 http.addHeader("Content-Type","application/json");
 if (token.length() && path!="/api/device/auth")
  http.addHeader("Authorization","Bearer "+token);
 code = String(method)=="POST" ? http.POST(body) : http.GET();
 response = code>0 ? http.getString() : "";
 http.end();
 return code>0;
}
bool authenticate() {
 JsonDocument req; req["device_id"]=DEVICE_ID; req["password"]=DEVICE_PASSWORD;
 String body,response; serializeJson(req,body); int code=0;
 if (!backendRequest("/api/device/auth","POST",body,response,code)) return false;
 JsonDocument doc;
 if (code!=200 || deserializeJson(doc,response) || doc["success"]!=true || !doc["access_token"].is<String>()) {
  Serial.printf("[AUTH ERROR] HTTP %d\n",code); return false;
 }
 token=doc["access_token"].as<String>(); tokenAt=millis();
 Serial.println("[OK] DEVICE_AUTH_SUCCESS");
 return true;
}
void pollCommand() {
 String response; int code=0;
 if (!backendRequest("/api/device/serial-test/next","GET","",response,code)) {
  Serial.println("[ERROR] Poll network"); return;
 }
 if (code==401) { token=""; return; }
 if (code!=200) { Serial.printf("[ERROR] Poll HTTP %d\n",code); return; }
 JsonDocument doc;
 if (deserializeJson(doc,response) || doc["success"]!=true || doc["command"].isNull()) return;
 String id=doc["command"]["command_id"]|"";
 String action=doc["command"]["action"]|"";
 if (id.length()!=36 || action!="SERIAL_TEST_UNLOCK") return;
 Serial.println("TEST_UNLOCK_SUCCESS");
 Serial.print("[COMMAND] "); Serial.println(id);
 JsonDocument ack; ack["command_id"]=id; ack["result"]="SERIAL_PRINTED";
 String body; serializeJson(ack,body);
 if (backendRequest("/api/device/serial-test/report","POST",body,response,code) && code==200)
  Serial.println("[OK] COMMAND_REPORTED");
 else Serial.printf("[ERROR] Report HTTP %d\n",code);
}
String portalPage() {
 String options="<option value=''>-- 請選擇 Wi-Fi --</option>";
 int n=WiFi.scanNetworks(false,true);
 for (int i=0;i<n && i<40;i++) {
  String ssid=WiFi.SSID(i);
  if (!ssid.length()) continue;
  options+="<option value=\""+htmlEscape(ssid)+"\">"+htmlEscape(ssid)+" ("+String(WiFi.RSSI(i))+" dBm)</option>";
 }
 WiFi.scanDelete();
 String page=R"HTML(<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>iKey iBOX Wi-Fi 設定</title><style>body{font-family:system-ui;background:#0b1220;color:#f8fafc;padding:24px;max-width:560px;margin:auto}section{background:#1b3150;border:1px solid #45617a;border-radius:18px;padding:24px}h1{color:#63d8e8}label{display:block;margin:18px 0 6px}select,input,button{width:100%;box-sizing:border-box;padding:14px;border-radius:10px;font:inherit}input,select{background:#0b1220;color:white;border:1px solid #8195ab}button{margin-top:22px;background:#63d8e8;color:#07101b;border:0;font-weight:700}small{color:#a6b2c5}p{line-height:1.6}</style></head><body><section><h1>iKey · iBOX</h1><h2>Wi-Fi 網路設定</h2><p>僅支援 2.4 GHz Wi-Fi。設定期間不接收開鎖指令。</p>)HTML";
 if (portalNotice.length()) page+="<p role='status'>"+htmlEscape(portalNotice)+"</p>";
 page+="<form action='/save' method='POST'><label for='ssid'>選擇 Wi-Fi</label><select id='ssid' name='ssid' required>"+options+"</select>";
 page+="<label for='password'>Wi-Fi 密碼</label><input id='password' name='password' type='password' maxlength='63' autocomplete='off'>";
 page+="<button type='submit'>測試連線並儲存</button></form><p><small>若清單沒有你的網路，重新整理此頁。連線成功後 iBOX 會自動返回正常模式。</small></p></section></body></html>";
 return page;
}
void leaveSetup() {
 dns.stop(); portal.stop();
 WiFi.softAPdisconnect(true); WiFi.mode(WIFI_STA);
 setupMode=false; token=""; lastAuthAttempt=millis()-15001;
 Serial.println("[WIFI] Setup portal closed; normal mode");
}
void saveWiFi() {
 if (!setupMode) {portal.send(403,"text/plain","Not in setup mode");return;}
 if (++apRequestCount>AP_MAX_REQUESTS || failedProvisionAttempts>=5) {
  noCache();portal.send(429,"text/plain","Too many attempts");return;
 }
 String origin=portal.header("Origin");
 if (origin.length() && origin!="http://192.168.4.1") {
  noCache();portal.send(403,"text/plain","Invalid origin");return;
 }
 String ssid=portal.arg("ssid"),password=portal.arg("password");
 if (!ssid.length() || ssid.length()>32 || password.length()>63) {
  noCache();portal.send(400,"text/plain; charset=utf-8","Wi-Fi 資料格式不正確");return;
 }
 // Keep SoftAP active while testing the new station connection.
 portalNotice="正在連線測試，請稍候…";
 WiFi.begin(ssid.c_str(),password.c_str());
 uint32_t start=millis();
 while (WiFi.status()!=WL_CONNECTED && millis()-start<15000) delay(100);
 bool connected=WiFi.status()==WL_CONNECTED;
 bool serverOK=false;
 if (connected) {
  configTime(0,0,"pool.ntp.org","time.google.com");
  uint32_t t0=millis();
  while(time(nullptr)<1735689600 && millis()-t0<10000) delay(100);
  String response; int code=0;
  // The protected endpoint must return 401 without a token; this proves HTTPS reached the iKey backend.
  token="";
  serverOK=backendRequest("/api/device/me","GET","",response,code) && code==401;
 }
 if (!connected || !serverOK) {
  failedProvisionAttempts++;
  portalNotice=connected?"已連上 Wi-Fi，但無法確認 iKey 伺服器。未儲存。":"Wi-Fi 連線失敗，請檢查密碼與 2.4 GHz 網路。未儲存。";
  noCache();portal.send(200,"text/html; charset=utf-8",portalPage());
  return;
 }
 prefs.begin("ikey-wifi",false);
 prefs.putString("ssid",ssid); prefs.putString("pass",password);
 prefs.end();
 wifiSsid=ssid;wifiPass=password;hasSavedWiFi=true;
 noCache();
 portal.send(200,"text/html; charset=utf-8","<!doctype html><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><body style='font-family:system-ui;background:#0b1220;color:#63d8e8;padding:32px'><h1>Wi-Fi 設定成功</h1><p>已儲存設定，iBOX 即將恢復正常模式。</p></body>");
 Serial.println("[WIFI] Credentials saved; Render reachable");
 delay(1000);
 leaveSetup();
}
void enterSetup() {
 if (setupMode) return;
 setupMode=true; token=""; // Stop polling immediately: no remote unlock while provisioning.
 apStarted=millis();portalNotice="";apRequestCount=0;failedProvisionAttempts=0;
 if (strlen(SETUP_AP_PASSWORD)<12 || String(SETUP_AP_PASSWORD)=="CHANGE_TO_UNIQUE_12_CHAR_SECRET") {
  Serial.println("[SECURITY] Configure a unique 12+ char AP password before flashing");
  setupMode=false;return;
 }
 WiFi.mode(WIFI_AP_STA);
 uint64_t mac=ESP.getEfuseMac();
 char suffix[5];snprintf(suffix,sizeof(suffix),"%04X",(unsigned)(mac&0xFFFF));
 apName="iKey-Setup-"+String(suffix);
 if (!WiFi.softAP(apName.c_str(),SETUP_AP_PASSWORD,1,false,1)) {
  Serial.println("[ERROR] SoftAP failed");setupMode=false;return;
 }
 dns.start(53,"*",WiFi.softAPIP());
 if (!portalRoutesReady) {
  const char* trackedHeaders[]={"Origin"};
  portal.collectHeaders(trackedHeaders,1);
  portal.on("/",HTTP_GET,[](){noCache();portal.send(200,"text/html; charset=utf-8",portalPage());});
  portal.on("/save",HTTP_POST,saveWiFi);
  portal.onNotFound([](){portal.sendHeader("Location","http://192.168.4.1/",true);portal.send(302,"text/plain","");});
  portalRoutesReady=true;
 }
 portal.begin();
 Serial.println("[WIFI] Provisioning mode, remote commands disabled");
 Serial.println("[WIFI] AP: "+apName);
 Serial.println("[WIFI] URL: http://192.168.4.1");
}
void checkBootButton() {
 bool pressed=digitalRead(BOOT_BUTTON_PIN)==LOW;
 if (!pressed) {holdStart=0;buttonLatched=false;return;}
 if (!holdStart) holdStart=millis();
 if (!buttonLatched && millis()-holdStart>=BOOT_HOLD_MS) {
  buttonLatched=true;
  if (!setupMode) enterSetup();
 }
}
void setup() {
 Serial.begin(115200);delay(800);
 Serial.println("iKey 3.1 iBOX WIFI PORTAL + SERIAL TEST; NO LOCK GPIO");
 pinMode(BOOT_BUTTON_PIN,INPUT_PULLUP);
 prefs.begin("ikey-wifi",true);
 wifiSsid=prefs.getString("ssid","");
 wifiPass=prefs.getString("pass","");
 prefs.end();
 hasSavedWiFi=wifiSsid.length()>0;
 if (!hasSavedWiFi) {enterSetup();return;}
 WiFi.mode(WIFI_STA);WiFi.begin(wifiSsid.c_str(),wifiPass.c_str());
 configTime(0,0,"pool.ntp.org","time.google.com");
}
void loop() {
 checkBootButton();
 if (setupMode) {
  dns.processNextRequest();portal.handleClient();
  if (millis()-apStarted>AP_IDLE_TIMEOUT_MS) {
   Serial.println("[WIFI] Setup timed out");
   leaveSetup();
   if (hasSavedWiFi) WiFi.begin(wifiSsid.c_str(),wifiPass.c_str());
   else { Serial.println("[WIFI] No saved network; hold BOOT 5s to reopen setup"); }
  }
  delay(10);return;
 }
 if (!hasSavedWiFi) {delay(50);return;}
 if (WiFi.status()!=WL_CONNECTED) {
  if (millis()-lastReconnect>20000) {
   lastReconnect=millis();WiFi.disconnect();WiFi.begin(wifiSsid.c_str(),wifiPass.c_str());
   Serial.println("[WIFI] Reconnecting");
  }
  delay(20);return;
 }
 if (time(nullptr)<1735689600) {
  configTime(0,0,"pool.ntp.org","time.google.com");
  delay(50);return;
 }
 if (token.isEmpty() || millis()-tokenAt>12UL*60UL*1000UL) {
  if (millis()-lastAuthAttempt>15000) {lastAuthAttempt=millis();authenticate();}
  delay(20);return;
 }
 if (millis()-lastPoll>POLL_MS) {lastPoll=millis();pollCommand();}
 delay(20);
}
