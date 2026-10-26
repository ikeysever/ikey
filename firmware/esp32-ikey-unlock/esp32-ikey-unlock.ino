/*
 * iKey 3.1 ESP32 bounded unlock controller
 * Staging firmware work-in-progress: hardware pulse engine only.
 *
 * GPIO 23: relay control output
 * GPIO 25: lock-open feedback input; HIGH (about 3.3 V) means OPEN.
 *
 * Confirmed relay polarity: HIGH (about 3.3 V) energizes the relay.
 * The compile-time guard prevents conflicting polarity selections.
 * Do not connect GPIO 25 to 5 V. ESP32 GPIO is 3.3 V logic.
 *
 * Serial test command: send lowercase 'u' to request one bounded unlock test.
 * This is a local hardware test only; web/API command polling is not yet connected.
 */

#include <Arduino.h>

// Hardware polarity confirmed by user: HIGH energizes the relay. Keep exactly one:
#define IKEY_RELAY_ACTIVE_HIGH
// #define IKEY_RELAY_ACTIVE_LOW
#if defined(IKEY_RELAY_ACTIVE_HIGH) && defined(IKEY_RELAY_ACTIVE_LOW)
  #error "Select only one relay active polarity."
#elif !defined(IKEY_RELAY_ACTIVE_HIGH) && !defined(IKEY_RELAY_ACTIVE_LOW)
  #error "Before compiling, verify relay polarity and uncomment exactly one IKEY_RELAY_ACTIVE_* define."
#endif

static constexpr uint8_t RELAY_PIN = 23;
static constexpr uint8_t FEEDBACK_PIN = 25;
static constexpr uint8_t FEEDBACK_OPEN_LEVEL = HIGH;
static constexpr uint32_t RELAY_ON_MS = 500;
static constexpr uint32_t RELAY_OFF_MS = 200;
static constexpr uint8_t MAX_ATTEMPTS = 10;

#if defined(IKEY_RELAY_ACTIVE_HIGH)
static constexpr uint8_t RELAY_ACTIVE_LEVEL = HIGH;
#else
static constexpr uint8_t RELAY_ACTIVE_LEVEL = LOW;
#endif
static constexpr uint8_t RELAY_INACTIVE_LEVEL =
    (RELAY_ACTIVE_LEVEL == HIGH) ? LOW : HIGH;

enum class UnlockState : uint8_t {
  IDLE,
  RELAY_ON,
  RELAY_PAUSE,
  SUCCEEDED,
  FAILED
};

static UnlockState state = UnlockState::IDLE;
static uint32_t stateStartedAt = 0;
static uint8_t attempts = 0;
static bool resultReported = false;

static bool feedbackSaysOpen() {
  return digitalRead(FEEDBACK_PIN) == FEEDBACK_OPEN_LEVEL;
}

static void relayOff() {
  digitalWrite(RELAY_PIN, RELAY_INACTIVE_LEVEL);
}

static void finish(UnlockState terminalState, const char* message) {
  relayOff();
  state = terminalState;
  stateStartedAt = millis();
  if (!resultReported) {
    Serial.print("[UNLOCK] attempts=");
    Serial.print(attempts);
    Serial.print(" result=");
    Serial.println(message);
    resultReported = true;
  }
}

static bool isRunning() {
  return state == UnlockState::RELAY_ON ||
         state == UnlockState::RELAY_PAUSE;
}

static void startUnlockTest() {
  if (isRunning()) {
    Serial.println("[UNLOCK] Busy; duplicate request ignored.");
    return;
  }

  // Do not pulse if feedback already reports open.
  if (feedbackSaysOpen()) {
    attempts = 0;
    resultReported = false;
    finish(UnlockState::SUCCEEDED, "open_feedback_already_active");
    return;
  }

  attempts = 0;
  resultReported = false;
  state = UnlockState::RELAY_ON;
  stateStartedAt = millis();
  digitalWrite(RELAY_PIN, RELAY_ACTIVE_LEVEL);
  attempts = 1;
  Serial.println("[UNLOCK] Started bounded test; attempt 1/10.");
}

static void serviceUnlockStateMachine() {
  const uint32_t now = millis();

  if (!isRunning()) return;

  // Check feedback continuously while running; stop immediately on success.
  if (feedbackSaysOpen()) {
    finish(UnlockState::SUCCEEDED, "open_feedback_confirmed");
    return;
  }

  if (state == UnlockState::RELAY_ON &&
      static_cast<uint32_t>(now - stateStartedAt) >= RELAY_ON_MS) {
    relayOff();
    state = UnlockState::RELAY_PAUSE;
    stateStartedAt = now;
    Serial.print("[UNLOCK] Attempt ");
    Serial.print(attempts);
    Serial.println(" pulse complete; relay off.");
    return;
  }

  if (state == UnlockState::RELAY_PAUSE &&
      static_cast<uint32_t>(now - stateStartedAt) >= RELAY_OFF_MS) {
    if (feedbackSaysOpen()) {
      finish(UnlockState::SUCCEEDED, "open_feedback_confirmed");
      return;
    }
    if (attempts >= MAX_ATTEMPTS) {
      finish(UnlockState::FAILED, "max_attempts_reached");
      return;
    }
    ++attempts;
    digitalWrite(RELAY_PIN, RELAY_ACTIVE_LEVEL);
    state = UnlockState::RELAY_ON;
    stateStartedAt = now;
    Serial.print("[UNLOCK] Attempt ");
    Serial.print(attempts);
    Serial.println("/10 started.");
  }
}

void setup() {
  // Set output latch inactive before switching the pin to output mode.
  digitalWrite(RELAY_PIN, RELAY_INACTIVE_LEVEL);
  pinMode(RELAY_PIN, OUTPUT);
  relayOff();

  // Feedback is expected to be driven by an external circuit.
  // Choose INPUT_PULLDOWN/INPUT_PULLUP only if appropriate for the actual circuit.
  pinMode(FEEDBACK_PIN, INPUT);

  Serial.begin(115200);
  delay(300);
  Serial.println();
  Serial.println("iKey 3.1 ESP32 unlock pulse engine");
  Serial.println("GPIO23=relay, GPIO25=feedback HIGH means open");
  Serial.println("Send 'u' to run one bounded local hardware test.");
  Serial.println("Web/API polling is not connected in this firmware stage.");
  Serial.print("Initial feedback: ");
  Serial.println(feedbackSaysOpen() ? "OPEN/HIGH" : "not-open/LOW");
}

void loop() {
  while (Serial.available() > 0) {
    const char c = static_cast<char>(Serial.read());
    if (c == 'u' || c == 'U') {
      startUnlockTest();
    }
  }

  serviceUnlockStateMachine();
  delay(2);
}
