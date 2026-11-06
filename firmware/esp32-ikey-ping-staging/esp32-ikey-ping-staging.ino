/*
 * iKey 3.1 — ESP32 HTTPS ping-only staging client.
 * Board: ESP32 Dev Module / ESP32-32S, Arduino-ESP32 core 3.x.
 * Libraries: ArduinoJson 7, built-in WiFi/HTTPClient/WiFiClientSecure.
 * No GPIO, lock, relay or physical actuation. Never commit credentials.
 * Server must have IKEY_BRIDGE_DEMO_ENABLED=true; OFF by default.
 */
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>

namespace Config {
const char* WIFI_SSID = "REPLACE_WIFI_SSID";
const char* WIFI_PASSWORD = "REPLACE_WIFI_PASSWORD";
const char* DEVICE_ID = "REPLACE_DEVICE_ID";
const char* DEVICE_PASSWORD = "REPLACE_DEVICE_PASSWORD";
const char* BASE_URL = "https://ikey.onrender.com";
constexpr uint32_t POLL_MS = 30000;
constexpr uint32_t HTTP_TIMEOUT_MS = 12000;
}
// Install the current verified root CA PEM for the HTTPS endpoint.
// Never disable TLS certificate validation.
static const char ROOT_CA[] PROGMEM = R"PEM(
-----BEGIN CERTIFICATE-----
REPLACE_WITH_VERIFIED_ROOT_CA_CERTIFICATE_PEM
-----END CERTIFICATE-----
)PEM";
String token;
uint32_t tokenValidUntil=0, lastPoll=0;
bool firstPoll=true;

bool wifiReady(){
 if(WiFi.status()==WL_CONNECTED)return true;
 WiFi.mode(WIFI_STA);
 WiFi.begin(Config::WIFI_SSID,Config::WIFI_PASSWORD);
 Serial.println("[iKey] connecting WiFi");
 for(int i=0;i<20&&WiFi.status()!=WL_CONNECTED;i++)delay(500);
 return WiFi.status()==WL_CONNECTED;
}
bool clockReady(){
 if(time(nullptr)>1700000000)return true;
 configTime(0,0,"pool.ntp.org","time.google.com");
 for(int i=0;i<20;i++){
  if(time(nullptr)>1700000000)return true;
  delay(500);
 }
 return false;
}
bool request(const char* method,const char* route,const String& body,JsonDocument& out,bool authorized){
 WiFiClientSecure client;
 client.setCACert(ROOT_CA);
 HTTPClient http;
 const String url=String(Config::BASE_URL)+route;
 if(!http.begin(client,url)){Serial.println("[iKey] HTTPS init failed");return false;}
 http.setTimeout(Config::HTTP_TIMEOUT_MS);
 http.addHeader("Accept","application/json");
 if(authorized)http.addHeader("Authorization",String("Bearer ")+token);
 if(strcmp(method,"POST")==0)http.addHeader("Content-Type","application/json");
 int code=strcmp(method,"POST")==0?http.POST(body):http.GET();
 if(code==401){token="";tokenValidUntil=0;}
 if(code<200||code>=300){
  Serial.printf("[iKey] HTTP status %d\n",code);
  http.end();return false;
 }
 const String response=http.getString();
 http.end();
 const DeserializationError err=deserializeJson(out,response);
 if(err){Serial.println("[iKey] JSON parse error");return false;}
 return out["success"].as<bool>();
}
bool login(){
 JsonDocument input,output;
 input["device_id"]=Config::DEVICE_ID;
 input["password"]=Config::DEVICE_PASSWORD;
 String body;serializeJson(input,body);
 if(!request("POST","/api/bridge-demo/device/login",body,output,false))return false;
 const String received=output["access_token"].as<String>();
 const uint32_t expires=output["expires_in"]|0;
 if(received.length()!=64||expires<60)return false;
 token=received;
 tokenValidUntil=millis()+min(expires-30,(uint32_t)840)*1000UL;
 Serial.println("[iKey] authenticated (token hidden)");
 return true;
}
void pollOnce(){
 if(!wifiReady()){Serial.println("[iKey] WiFi unavailable");return;}
 if(!clockReady()){Serial.println("[iKey] NTP unavailable");return;}
 if(token.isEmpty()||(int32_t)(millis()-tokenValidUntil)>=0){
  if(!login())return;
 }
 JsonDocument output;
 if(!request("GET","/api/bridge-demo/device/commands","",output,true))return;
 JsonVariant command=output["command"];
 if(command.isNull()){Serial.println("[iKey] no pending ping");return;}
 const String id=command["command_id"].as<String>();
 const String device=command["device_id"].as<String>();
 const String action=command["action"].as<String>();
 if(id.length()!=36||device!=Config::DEVICE_ID||action!="ping"||!command["payload"].isNull()){
  Serial.println("[iKey] rejected unexpected command");return;
 }
 // Only ping is accepted. Do not actuate hardware.
 JsonDocument report,ack;
 report["command_id"]=id;
 report["result"]="completed";
 String body;serializeJson(report,body);
 if(request("POST","/api/bridge-demo/device/report",body,ack,true))
  Serial.println("[iKey] ping acknowledged");
}
void setup(){
 Serial.begin(115200);
 delay(300);
 Serial.println("[iKey] staging ping-only client");
 if(String(Config::WIFI_SSID).startsWith("REPLACE_")||
    String(Config::DEVICE_ID).startsWith("REPLACE_")||
    String(ROOT_CA).indexOf("REPLACE_WITH_")>=0){
  Serial.println("[iKey] CONFIG INCOMPLETE — refusing network requests");
  while(true)delay(1000);
 }
}
void loop(){
 const uint32_t now=millis();
 if(firstPoll||now-lastPoll>=Config::POLL_MS){
  firstPoll=false;lastPoll=now;pollOnce();
 }
 delay(100);
}
