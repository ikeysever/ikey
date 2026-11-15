// iKey 3.1 SERIAL ONLY test. NO GPIO outputs.
// Install ArduinoJson v7 via Arduino IDE Library Manager.
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>

extern const uint8_t caBundleStart[] asm("_binary_x509_crt_bundle_start");
extern const uint8_t caBundleEnd[] asm("_binary_x509_crt_bundle_end");
const char* WIFI_SSID="YOUR_WIFI";
const char* WIFI_PASSWORD="YOUR_WIFI_PASSWORD";
const char* DEVICE_ID="YOUR8ID";
const char* DEVICE_PASSWORD="YOUR_DEVICE_PASSWORD";
const char* SERVER="https://ikey.onrender.com";
String token;
unsigned long tokenAt=0,lastPoll=0,lastAuthAttempt=0;
bool request(const String& path,const char* method,const String& body,String& response,int& code){
 WiFiClientSecure client;
 client.setCACertBundle(caBundleStart, caBundleEnd - caBundleStart);
 HTTPClient http;
 if(!http.begin(client,String(SERVER)+path))return false;
 http.setTimeout(12000);
 http.addHeader("Content-Type","application/json");
 if(token.length()&&path!="/api/device/auth")http.addHeader("Authorization","Bearer "+token);
 code=String(method)=="POST"?http.POST(body):http.GET();
 response=code>0?http.getString():"";
 http.end();
 return code>0;
}
bool authenticate(){
 JsonDocument req;req["device_id"]=DEVICE_ID;req["password"]=DEVICE_PASSWORD;
 String body,response;serializeJson(req,body);int code=0;
 if(!request("/api/device/auth","POST",body,response,code))return false;
 JsonDocument doc;
 if(code!=200||deserializeJson(doc,response)||doc["success"]!=true||!doc["access_token"].is<String>()){
  Serial.printf("[AUTH ERROR] HTTP %d\n",code);return false;
 }
 token=doc["access_token"].as<String>();tokenAt=millis();
 Serial.println("[OK] DEVICE_AUTH_SUCCESS");
 return true;
}
void poll(){
 String response;int code=0;
 if(!request("/api/device/serial-test/next","GET","",response,code)){Serial.println("[ERROR] Poll network");return;}
 if(code==401){token="";return;}
 if(code==503){Serial.println("[WAIT] Serial-test API not deployed/enabled");return;}
 if(code!=200){Serial.printf("[ERROR] Poll HTTP %d\n",code);return;}
 JsonDocument doc;
 if(deserializeJson(doc,response)||doc["success"]!=true){Serial.println("[ERROR] Poll JSON");return;}
 if(doc["command"].isNull())return;
 String id=doc["command"]["command_id"]|"";
 String action=doc["command"]["action"]|"";
 if(id.length()!=36||action!="SERIAL_TEST_UNLOCK")return;
 Serial.println("TEST_UNLOCK_SUCCESS");
 Serial.print("[COMMAND] ");Serial.println(id);
 JsonDocument ack;ack["command_id"]=id;ack["result"]="SERIAL_PRINTED";
 String body;serializeJson(ack,body);
 if(request("/api/device/serial-test/report","POST",body,response,code)&&code==200)
  Serial.println("[OK] COMMAND_REPORTED");
 else Serial.printf("[ERROR] Report HTTP %d\n",code);
}
void setup(){
 Serial.begin(115200);delay(1000);
 Serial.println("iKey SERIAL-ONLY TEST; GPIO DISABLED");
 configTime(0, 0, "pool.ntp.org", "time.google.com");
 WiFi.mode(WIFI_STA);WiFi.begin(WIFI_SSID,WIFI_PASSWORD);
}
void loop(){
 if(WiFi.status()!=WL_CONNECTED){
  if(millis()-lastAuthAttempt>20000){lastAuthAttempt=millis();WiFi.disconnect();WiFi.begin(WIFI_SSID,WIFI_PASSWORD);}
  delay(100);return;
 }
 if(time(nullptr)<1704067200){delay(250);return;}
 if(token.isEmpty()||millis()-tokenAt>12UL*60UL*1000UL){
  if(millis()-lastAuthAttempt>15000){lastAuthAttempt=millis();authenticate();}
  delay(100);return;
 }
 if(millis()-lastPoll>2500){lastPoll=millis();poll();}
 delay(50);
}
