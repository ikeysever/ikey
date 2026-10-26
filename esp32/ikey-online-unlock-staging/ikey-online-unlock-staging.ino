#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// iKey ESP32 online unlock prototype — staging only.
// Requires a backend implementing authenticated command polling and ACK.
// Do not connect the lock until GPIO polarity, supply and driver are confirmed.
const char* WIFI_SSID = "YOUR_HOTSPOT_NAME";
const char* WIFI_PASSWORD = "YOUR_HOTSPOT_PASSWORD";
const char* DEVICE_ID = "YOUR_FACTORY_DEVICE_ID";
const char* DEVICE_TOKEN = "YOUR_DEVICE_ONLY_SECRET";
const char* API_BASE = "https://YOUR-RENDER-HOST";
const char* ROOT_CA = R"EOF(
-----BEGIN CERTIFICATE-----
PASTE_TRUSTED_ROOT_CA_HERE
-----END CERTIFICATE-----
)EOF";

// GPIO must drive a MOSFET/relay INPUT, never the solenoid directly.
// Set after confirming your tested driver and polarity.
constexpr int LOCK_DRIVER_GPIO = 22;
constexpr int LOCK_INACTIVE_LEVEL = LOW;
constexpr int LOCK_ACTIVE_LEVEL = HIGH;
constexpr uint32_t UNLOCK_PULSE_MS = 1000;
constexpr uint32_t POLL_INTERVAL_MS = 2500;
constexpr uint32_t MAX_COMMAND_AGE_MS = 10000;
constexpr uint32_t MIN_RETRIGGER_MS = 3000;

WiFiClientSecure tls;
uint32_t lastPoll = 0, lastUnlock = 0;
String lastCommandId;

void lockIdle() { digitalWrite(LOCK_DRIVER_GPIO, LOCK_INACTIVE_LEVEL); }

bool sendAck(const String& id, const char* state) {
  HTTPClient http;
  String url = String(API_BASE) + "/api/device/" + DEVICE_ID + "/commands/" + id + "/ack";
  if (!http.begin(tls, url)) return false;
  http.addHeader("Authorization", String("Bearer ") + DEVICE_TOKEN);
  http.addHeader("Content-Type", "application/json");
  StaticJsonDocument<160> body;
  body["state"] = state;
  String payload;
  serializeJson(body, payload);
  int code = http.POST(payload);
  http.end();
  return code >= 200 && code < 300;
}

void pollCommand() {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  String url = String(API_BASE) + "/api/device/" + DEVICE_ID + "/commands/next";
  if (!http.begin(tls, url)) return;
  http.addHeader("Authorization", String("Bearer ") + DEVICE_TOKEN);
  int code = http.GET();
  if (code != 200) { http.end(); return; }
  StaticJsonDocument<512> doc;
  DeserializationError err = deserializeJson(doc, http.getStream());
  http.end();
  if (err || doc["command_id"].isNull()) return;
  String id = doc["command_id"].as<String>();
  String action = doc["action"] | "";
  uint32_t age = doc["age_ms"] | UINT32_MAX;
  if (id.length() < 8 || id == lastCommandId || action != "unlock" || age > MAX_COMMAND_AGE_MS) return;
  lastCommandId = id;
  if (lastUnlock && millis() - lastUnlock < MIN_RETRIGGER_MS) {
    sendAck(id, "rejected_cooldown");
    return;
  }
  // Acknowledge receipt before energizing the driver.
  if (!sendAck(id, "accepted")) return;
  lastUnlock = millis();
  digitalWrite(LOCK_DRIVER_GPIO, LOCK_ACTIVE_LEVEL);
  delay(UNLOCK_PULSE_MS);
  lockIdle();
  sendAck(id, "completed");
}

void setup() {
  Serial.begin(115200);
  pinMode(LOCK_DRIVER_GPIO, OUTPUT);
  lockIdle();
  tls.setCACert(ROOT_CA); // Never use setInsecure() for unlock control.
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.println("iKey staging: connecting to Wi-Fi; lock output stays idle.");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    lockIdle();
    static uint32_t retryAt = 0;
    if (millis() - retryAt > 10000) {
      retryAt = millis();
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
    delay(100);
    return;
  }
  if (millis() - lastPoll >= POLL_INTERVAL_MS) {
    lastPoll = millis();
    pollCommand();
  }
  delay(20);
}
