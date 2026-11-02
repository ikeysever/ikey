/*
 * iKey 3.1 ESP32 web-controlled unlock firmware — STAGING ONLY
 *
 * Confirmed hardware:
 *   GPIO 23: relay control; HIGH energizes relay
 *   GPIO 25: lock-open feedback; HIGH means OPEN
 *
 * Safety:
 *   - Relay is forced inactive on boot and every terminal/error path.
 *   - Physical actuation disabled by default; max one 500ms pulse if separately approved.
 *   - Success is reported only when GPIO 25 confirms OPEN.
 *   - HTTPS certificate validation is mandatory; no setInsecure().
 *   - Configure Wi-Fi, device credentials, staging URL and CA certificate below.
 *
 * Arduino IDE library dependency: ArduinoJson (6.x or compatible 7.x).
 * IMPORTANT: Uses the project-scoped GAS command API, not the in-memory simulator.
 * No production deployment or hardware actuation is authorized by this firmware.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>

// ----------------------- USER CONFIGURATION -----------------------
// Fill these in locally. Do not commit real Wi-Fi or device passwords.
static const char WIFI_SSID[] = "YOUR_WIFI_OR_PHONE_HOTSPOT";
static const char WIFI_PASSWORD[] = "YOUR_WIFI_PASSWORD";
static const char DEVICE_ID[] = "YOUR_8_CHAR_DEVICE_ID";
static const char DEVICE_PASSWORD[] = "YOUR_DEVICE_PRE_REGISTRATION_PASSWORD";
// Verified project UUID assigned by the server. Never accept this from a command body.
static const char PROJECT_ID[] = "YOUR_VERIFIED_PROJECT_UUID";

// Configure the existing approved Render host only after server-side gates are verified.
// No additional Render service is required. Never enable physical actuation for this test.
static const char API_BASE_URL[] = "https://REPLACE-WITH-STAGING-HOST";

// Paste the trusted root/intermediate CA PEM for the staging host here.
// Do NOT use setInsecure(). Leave empty until you have the correct certificate;
// with an empty certificate, HTTPS requests are deliberately blocked.
static const char ROOT_CA[] = R"PEM(
)PEM";
// ------------------------------------------------------------------

#if !defined(ARDUINO_ARCH_ESP32)
#error "Select an ESP32 board in Arduino IDE."
#endif

#define IKEY_RELAY_ACTIVE_HIGH
// #define IKEY_RELAY_ACTIVE_LOW
#if defined(IKEY_RELAY_ACTIVE_HIGH) && defined(IKEY_RELAY_ACTIVE_LOW)
#error "Select only one relay active polarity."
#elif !defined(IKEY_RELAY_ACTIVE_HIGH) && !defined(IKEY_RELAY_ACTIVE_LOW)
#error "Select the verified relay active polarity."
#endif

static constexpr uint8_t RELAY_PIN = 23;
static constexpr uint8_t FEEDBACK_PIN = 25;
static constexpr uint8_t FEEDBACK_OPEN_LEVEL = HIGH;
static constexpr uint8_t RELAY_ACTIVE_LEVEL =
#if defined(IKEY_RELAY_ACTIVE_HIGH)
  HIGH;
#else
  LOW;
#endif
static constexpr uint8_t RELAY_INACTIVE_LEVEL =
  (RELAY_ACTIVE_LEVEL == HIGH) ? LOW : HIGH;

static constexpr uint32_t RELAY_ON_MS = 500;
static constexpr uint32_t RELAY_OFF_MS = 200;
// Fail closed until electrical safety and feedback wiring are physically verified.
static constexpr bool PHYSICAL_UNLOCK_APPROVED = false;
static constexpr uint8_t MAX_ATTEMPTS = 1;
static constexpr uint32_t WIFI_CONNECT_TIMEOUT_MS = 15000;
static constexpr uint32_t API_POLL_INTERVAL_MS = 2000;
static constexpr uint32_t HTTP_TIMEOUT_MS = 5000;
static constexpr uint32_t TOKEN_REFRESH_MS = 12UL * 60UL * 1000UL;
static constexpr uint32_t LOCAL_COMMAND_LIMIT_MS = 13000;

static WiFiClientSecure tlsClient;
static Preferences preferences;
static String accessToken;
static String activeProjectId;
// Keep a bounded persistent replay ledger. Hardware remains disabled by default.
static constexpr uint8_t RECENT_COMMAND_COUNT = 8;

static uint32_t lastAuthAt = 0;
static uint32_t lastPollAt = 0;
static bool configured = false;
static bool commandRunning = false;

static void relayOff() {
  digitalWrite(RELAY_PIN, RELAY_INACTIVE_LEVEL);
}

static bool feedbackSaysOpen() {
  return digitalRead(FEEDBACK_PIN) == FEEDBACK_OPEN_LEVEL;
}

static bool validUuid(const String& id) {
  if (id.length() != 36) return false;
  for (size_t i = 0; i < 36; ++i) {
    const char c = id[i];
    if (i == 8 || i == 13 || i == 18 || i == 23) { if (c != '-') return false; }
    else if (!isxdigit(static_cast<unsigned char>(c))) return false;
  }
  return true;
}

static bool previouslyExecuted(const String& id) {
  for (uint8_t i = 0; i < RECENT_COMMAND_COUNT; ++i) {
    if (preferences.getString(("cmd" + String(i)).c_str(), "") == id) return true;
  }
  return false;
}

static bool persistExecuted(const String& id) {
  const uint8_t slot = preferences.getUChar("cmd_slot", 0) % RECENT_COMMAND_COUNT;
  const String key = "cmd" + String(slot);
  if (preferences.putString(key.c_str(), id) != id.length()) return false;
  preferences.putUChar("cmd_slot", (slot + 1) % RECENT_COMMAND_COUNT);
  return true;
}

static bool validClaimProof(const String& proof) {
  if (proof.length() != 64) return false;
  for (size_t i = 0; i < proof.length(); ++i)
    if (!isxdigit(static_cast<unsigned char>(proof[i]))) return false;
  return true;
}

static bool configLooksReady() {
  const String url = API_BASE_URL;
  const String ca = ROOT_CA;
  return strlen(WIFI_SSID) > 0 &&
         String(WIFI_SSID) != "YOUR_WIFI_OR_PHONE_HOTSPOT" &&
         strlen(WIFI_PASSWORD) > 0 &&
         String(DEVICE_ID) != "YOUR_8_CHAR_DEVICE_ID" &&
         strlen(DEVICE_ID) == 8 &&
         validUuid(String(PROJECT_ID)) &&
         String(DEVICE_PASSWORD) != "YOUR_DEVICE_PRE_REGISTRATION_PASSWORD" &&
         url.startsWith("https://") &&
         !url.endsWith("REPLACE-WITH-STAGING-HOST") &&
         ca.indexOf("-----BEGIN CERTIFICATE-----") >= 0 &&
         ca.indexOf("-----END CERTIFICATE-----") >= 0;
}

static bool ensureWiFi() {
  if (WiFi.status() == WL_CONNECTED) return true;
  relayOff();
  Serial.println("[NET] Connecting to configured Wi-Fi...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  const uint32_t started = millis();
  while (WiFi.status() != WL_CONNECTED &&
         static_cast<uint32_t>(millis() - started) < WIFI_CONNECT_TIMEOUT_MS) {
    delay(250);
  }
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[NET] Wi-Fi unavailable; relay remains OFF.");
    return false;
  }
  Serial.print("[NET] Wi-Fi connected; IP=");
  Serial.println(WiFi.localIP());
  return true;
}

static bool httpsRequest(const char* method, const String& path,
                         const String& body, String& response,
                         int& statusCode) {
  response = "";
  statusCode = -1;
  if (!ensureWiFi()) return false;

  HTTPClient http;
  const String url = String(API_BASE_URL) + path;
  tlsClient.setCACert(ROOT_CA);
  tlsClient.setTimeout(HTTP_TIMEOUT_MS);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.setReuse(false);

  if (!http.begin(tlsClient, url)) {
    Serial.println("[API] HTTPS begin failed; relay remains OFF.");
    return false;
  }
  http.addHeader("Accept", "application/json");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Cache-Control", "no-store");
  if (accessToken.length() > 0) {
    http.addHeader("Authorization", "Bearer " + accessToken);
  }

  if (strcmp(method, "POST") == 0) {
    statusCode = http.POST(body);
  } else {
    statusCode = http.GET();
  }

  if (statusCode > 0) response = http.getString();
  http.end();
  if (statusCode < 200 || statusCode >= 300) {
    Serial.printf("[API] %s %s returned HTTP %d\n", method, path.c_str(), statusCode);
    return false;
  }
  return true;
}

static bool authenticateDevice(bool force = false) {
  if (!force && accessToken.length() > 0 &&
      static_cast<uint32_t>(millis() - lastAuthAt) < TOKEN_REFRESH_MS) {
    return true;
  }
  if (!ensureWiFi()) return false;

  StaticJsonDocument<256> requestDoc;
  requestDoc["device_id"] = DEVICE_ID;
  requestDoc["password"] = DEVICE_PASSWORD;
  String body;
  serializeJson(requestDoc, body);

  // Auth endpoint does not require an existing bearer token.
  accessToken = "";
  String response;
  int status = -1;
  if (!httpsRequest("POST", "/api/device/auth", body, response, status)) {
    return false;
  }

  StaticJsonDocument<1024> doc;
  const DeserializationError err = deserializeJson(doc, response);
  const char* token = doc["access_token"] | "";
  const bool success = !err && doc["success"] == true &&
                       doc["device_id"] == DEVICE_ID && strlen(token) > 20;
  if (!success) {
    accessToken = "";
    Serial.println("[AUTH] Device authentication failed; no command will run.");
    return false;
  }
  accessToken = token;
  lastAuthAt = millis();
  Serial.println("[AUTH] Device authenticated to staging API.");
  return true;
}

static bool postCommandResult(const String& commandId, const char* result,
                              const char* detail) {
  if (!authenticateDevice()) return false;

  StaticJsonDocument<384> doc;
  doc["status"] = result;
  doc["feedback_observed"] = strcmp(result, "succeeded") == 0;
  doc["claim_token"] = preferences.getString("claim_token", "");
  String body;
  serializeJson(doc, body);

  String response;
  int status = -1;
  const String path = "/api/device/projects/" + activeProjectId + "/commands/" + commandId + "/report";
  const bool ok = httpsRequest("POST", path, body, response, status);
  if (ok) {
    // Only a valid positive acknowledgement may clear the durable outbox.
    StaticJsonDocument<512> ack;
    if (deserializeJson(ack, response) || ack["success"] != true) {
      Serial.println("[REPORT] Invalid acknowledgement; keeping outbox.");
      return false;
    }
    preferences.remove("pending_report");
    preferences.remove("claim_token");
    Serial.printf("[REPORT] command=%s status=%s accepted by API\n",
                  commandId.c_str(), result);
  } else {
    Serial.printf("[REPORT] command=%s status=%s NOT CONFIRMED by API\n",
                  commandId.c_str(), result);
  }
  return ok;
}

static bool waitForFeedbackOrTime(uint32_t durationMs, uint32_t commandStarted,
                                  bool& opened) {
  const uint32_t started = millis();
  while (static_cast<uint32_t>(millis() - started) < durationMs) {
    if (feedbackSaysOpen()) {
      opened = true;
      return true;
    }
    if (static_cast<uint32_t>(millis() - commandStarted) >= LOCAL_COMMAND_LIMIT_MS) {
      return false;
    }
    delay(5);
  }
  opened = feedbackSaysOpen();
  return true;
}

static bool executeUnlock(const String& commandId, const uint32_t commandStarted,
                          uint8_t& attempts, String& detail) {
  attempts = 0;
  if (!PHYSICAL_UNLOCK_APPROVED) {
    relayOff();
    detail = "physical_unlock_not_approved";
    return false;
  }
  bool opened = feedbackSaysOpen();
  if (opened) {
    detail = "open_feedback_already_active";
    relayOff();
    return true;
  }

  for (uint8_t attempt = 1; attempt <= MAX_ATTEMPTS; ++attempt) {
    if (static_cast<uint32_t>(millis() - commandStarted) >= LOCAL_COMMAND_LIMIT_MS) {
      relayOff();
      detail = "local_command_deadline";
      return false;
    }

    attempts = attempt;
    digitalWrite(RELAY_PIN, RELAY_ACTIVE_LEVEL);
    const bool onWaitOk = waitForFeedbackOrTime(RELAY_ON_MS, commandStarted, opened);
    relayOff(); // Always de-energize immediately after each pulse.
    if (opened) {
      detail = "open_feedback_confirmed";
      return true;
    }
    if (!onWaitOk) {
      detail = "local_command_deadline";
      return false;
    }

    const bool pauseOk = waitForFeedbackOrTime(RELAY_OFF_MS, commandStarted, opened);
    relayOff();
    if (opened) {
      detail = "open_feedback_confirmed";
      return true;
    }
    if (!pauseOk) {
      detail = "local_command_deadline";
      return false;
    }
  }

  relayOff();
  detail = "max_attempts_reached";
  return false;
}

static void processCommand(JsonVariantConst command) {
  if (command.isNull()) return;
  const char* commandIdValue = command["command_id"] | "";
  const char* commandName = command["action"] | "";
  const char* commandDeviceId = command["device_id"] | "";
  const String commandId(commandIdValue);

  if (!validUuid(commandId) ||
      strcmp(commandName, "unlock") != 0 ||
      strcmp(commandDeviceId, DEVICE_ID) != 0) {
    Serial.println("[CMD] Invalid command payload; ignored with relay OFF.");
    relayOff();
    return;
  }
  if (commandRunning) {
    Serial.println("[CMD] Busy; duplicate command ignored.");
    return;
  }
  if (previouslyExecuted(commandId)) {
    Serial.println("[CMD] Duplicate command ID persisted in NVS; will not execute again.");
    relayOff();
    return;
  }

  // Save the claim and a failure outbox BEFORE any actuation. If reset occurs,
  // the command cannot be silently replayed and failure can still be reported.
  const char* claimToken = command["claim_token"] | "";
  const char* projectId = command["project_id"] | "";
  if (!validClaimProof(String(claimToken)) || !validUuid(String(projectId)) ||
      preferences.getString("pending_report", "").length() > 0) {
    relayOff();
    Serial.println("[CMD] Invalid claim or pending report; no actuation.");
    return;
  }
  if (String(projectId) != String(PROJECT_ID)) {
    relayOff();
    Serial.println("[CMD] Project mismatch; no actuation.");
    return;
  }
  const uint64_t deadline = command["deadline_at"] | 0ULL;
  // The device does not execute commands without a verified synchronized wall clock.
  const time_t epoch = time(nullptr);
  const uint64_t nowMs = epoch > 1700000000 ? static_cast<uint64_t>(epoch) * 1000ULL : 0;
  if (!nowMs || deadline <= nowMs || deadline > nowMs + 60000ULL) {
    relayOff();
    Serial.println("[CMD] Unsynchronized clock or expired claim; blocked.");
    return;
  }
  activeProjectId = PROJECT_ID;
  const String initialReport = commandId + "|failed";
  if (preferences.putString("claim_token", claimToken) != strlen(claimToken) ||
      preferences.putString("pending_report", initialReport) != initialReport.length() ||
      !persistExecuted(commandId)) {
    relayOff();
    Serial.println("[CMD] Durable storage failure; no actuation.");
    return;
  }
  commandRunning = true;
  relayOff();

  const uint32_t started = millis();
  uint8_t attempts = 0;
  String detail;
  const bool opened = executeUnlock(commandId, started, attempts, detail);
  relayOff();
  commandRunning = false;

  Serial.printf("[UNLOCK] command=%s attempts=%u result=%s detail=%s\n",
                commandId.c_str(), attempts, opened ? "succeeded" : "failed",
                detail.c_str());

  // Only GPIO 25 feedback can authorize a successful result.
  const char* result = (opened && feedbackSaysOpen()) ? "succeeded" : "failed";
  const String finalReport = commandId + "|" + result;
  if (preferences.putString("pending_report", finalReport) != finalReport.length()) {
    relayOff();
    Serial.println("[CMD] Result persistence failed; retained safe failure outbox.");
    return;
  }
  postCommandResult(commandId, result, detail.c_str());
}

static void retryPendingReport() {
  const String record = preferences.getString("pending_report", "");
  if (record.isEmpty()) return;
  const int separator = record.indexOf('|');
  if (separator < 16) { relayOff(); return; }
  activeProjectId = PROJECT_ID;
  if (!validUuid(activeProjectId)) { relayOff(); return; }
  const String id = record.substring(0, separator);
  const String status = record.substring(separator + 1);
  if (!validUuid(id) || !validClaimProof(preferences.getString("claim_token", ""))) {
    relayOff();
    Serial.println("[REPORT] Corrupt outbox; refusing new claims.");
    return;
  }
  if (status != "failed" && status != "succeeded") { relayOff(); return; }
  postCommandResult(id, status.c_str(), "recovered_pending_report");
}

static void pollCommands() {
  if (!authenticateDevice()) return;
  // Never claim a new command while a previous result is unacknowledged.
  if (!preferences.getString("pending_report", "").isEmpty()) {
    retryPendingReport();
    return;
  }
  activeProjectId = PROJECT_ID;
  if (!validUuid(activeProjectId)) {
    Serial.println("[CMD] Verified project binding not configured; claim blocked.");
    return;
  }
  String response;
  int status = -1;
  if (!httpsRequest("POST", "/api/device/projects/" + activeProjectId + "/commands/claim",
                    "{}", response, status)) {
    if (status == 401) { accessToken = ""; authenticateDevice(true); }
    return;
  }
  StaticJsonDocument<2048> doc;
  if (deserializeJson(doc, response) || doc["success"] != true) {
    Serial.println("[API] Invalid claim response.");
    return;
  }
  JsonVariantConst command = doc["command"];
  if (!command.isNull()) processCommand(command);
}

void setup() {
  // Establish the inactive output level before enabling the output driver.
  digitalWrite(RELAY_PIN, RELAY_INACTIVE_LEVEL);
  pinMode(RELAY_PIN, OUTPUT);
  relayOff();
  pinMode(FEEDBACK_PIN, INPUT);

  Serial.begin(115200);
  delay(300);
  if (!preferences.begin("ikey-unlock", false)) {
    Serial.println("[FATAL] NVS unavailable; network commands disabled.");
    while (true) { relayOff(); delay(1000); }
  }
  activeProjectId = PROJECT_ID;

  Serial.println();
  Serial.println("iKey 3.1 ESP32 web unlock firmware (staging only)");
  Serial.println("GPIO23 relay: HIGH=energized; GPIO25 HIGH=lock open");
  Serial.println("Safety: physical unlock disabled by default; max 1 attempt when approved.");
  Serial.println("Serial actuation commands are disabled.");

  configured = configLooksReady();
  if (!configured) {
    Serial.println("[CONFIG] Wi-Fi/device/staging URL/CA not configured.");
    Serial.println("[CONFIG] Web API disabled; relay will not run from network.");
  } else {
    tlsClient.setCACert(ROOT_CA);
    configTime(0, 0, "pool.ntp.org", "time.google.com");
    ensureWiFi();
    authenticateDevice(true);
  }
  Serial.printf("[BOOT] feedback=%s; relay forced OFF\n",
                feedbackSaysOpen() ? "OPEN/HIGH" : "not-open/LOW");
}

void loop() {
  // Serial input must never actuate a lock in deployable firmware.
  while (Serial.available() > 0) { Serial.read(); }

  if (configured && static_cast<uint32_t>(millis() - lastPollAt) >= API_POLL_INTERVAL_MS) {
    lastPollAt = millis();
    pollCommands();
  }
  if (!commandRunning) relayOff();
  delay(2);
}
