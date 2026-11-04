
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>
#include <math.h>

// ==========================================
// WIFI CONFIGURATION
// ==========================================

const char* WIFI_SSID = "main";
const char* WIFI_PASSWORD = "12345678";

// ==========================================
// FIREBASE CONFIGURATION - NO AUTHENTICATION
// ==========================================

const char* FIREBASE_HOST =
  "https://s3-skills-default-rtdb.firebaseio.com";

// ==========================================
// SENSOR PINS
// ==========================================

#define LED_CURRENT_PIN 32
#define PUMP_CURRENT_PIN 33

#define LED_VOLTAGE_PIN 34
#define PUMP_VOLTAGE_PIN 35

// ==========================================
// CALIBRATION
// ==========================================

// ACS712 5A sensitivity:
// 185mV/A at 5V, halved by external 10k/10k divider
const float CURRENT_SENSITIVITY = 0.0925;

// Voltage module 5:1 divider and external 10k/15k divider
const float VOLTAGE_MULTIPLIER = 8.3333;

// Ignore small current noise
// Physical sensor noise deadband calibration
// Clamps off-time floating voltage (~1.18V - 1.8V) and ACS712 quiescent drift (~0.14A - 0.22A)
const float CURRENT_DEADBAND = 0.22;
const float VOLTAGE_DEADBAND = 2.00;

// Current sensor zero offsets
float ledCurrentOffset = 0;
float pumpCurrentOffset = 0;

// ==========================================
// TIMING
// ==========================================

const unsigned long SAMPLE_INTERVAL = 1000;

unsigned long lastSample = 0;

// ==========================================
// STATISTICS
// ==========================================

struct Statistics {

  float sum = 0;
  float minimum = 999999;
  float maximum = -999999;

  unsigned long count = 0;

  void add(float value) {

    sum += value;
    count++;

    if (value < minimum) {
      minimum = value;
    }

    if (value > maximum) {
      maximum = value;
    }
  }

  float average() {

    if (count == 0) return 0;

    return sum / count;
  }

  void reset() {

    sum = 0;
    minimum = 999999;
    maximum = -999999;
    count = 0;
  }
};

Statistics minuteStats[4];
Statistics hourStats[4];

long currentMinute = -1;
long currentHour = -1;

// ==========================================
// ADC READING
// ==========================================

float readADCVoltage(int pin) {

  const int samples = 20;

  unsigned long total = 0;

  for (int i = 0; i < samples; i++) {

    total += analogReadMilliVolts(pin);

    delay(2);
  }

  return (total / (float)samples) / 1000.0;
}

// ==========================================
// CURRENT SENSOR CALIBRATION
// ==========================================

float calibrateCurrent(int pin) {

  Serial.println("Calibrating current sensor...");

  const int samples = 500;

  unsigned long total = 0;

  for (int i = 0; i < samples; i++) {

    total += analogReadMilliVolts(pin);

    delay(2);
  }

  float offset =
    (total / (float)samples) / 1000.0;

  Serial.print("Zero offset: ");
  Serial.print(offset, 4);
  Serial.println(" V");

  return offset;
}

// ==========================================
// CURRENT MEASUREMENT
// ==========================================

float readCurrent(int pin, float offset) {

  float measuredVoltage = readADCVoltage(pin);

  float difference = measuredVoltage - offset;

  float current =
    difference / CURRENT_SENSITIVITY;

  // Display magnitude only
  current = fabsf(current);

  if (current < CURRENT_DEADBAND) {
    current = 0;
  }

  return current;
}

// ==========================================
// VOLTAGE MEASUREMENT
// ==========================================

float readVoltage(int pin) {

  float adcVoltage = readADCVoltage(pin);

  float actualVoltage =
    adcVoltage * VOLTAGE_MULTIPLIER;

  if (actualVoltage < VOLTAGE_DEADBAND) {
    actualVoltage = 0.0;
  }

  return actualVoltage;
}

// ==========================================
// WIFI CONNECTION
// ==========================================

bool connectWiFi() {

  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  Serial.println("Connecting to WiFi...");

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();

  while (
    WiFi.status() != WL_CONNECTED &&
    millis() - start < 20000
  ) {

    delay(500);

    Serial.print(".");
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {

    Serial.println("WiFi connected");

    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());

    return true;
  }

  Serial.println("WiFi connection failed");

  return false;
}

// ==========================================
// FIREBASE UPLOAD - NO AUTHENTICATION
// ==========================================

bool firebasePut(String path, String json) {

  if (!connectWiFi()) {
    return false;
  }

  WiFiClientSecure client;

  // Testing only: disables certificate verification
  client.setInsecure();

  HTTPClient https;

  String url =
    String(FIREBASE_HOST) +
    path +
    ".json";

  if (!https.begin(client, url)) {

    Serial.println("Firebase connection failed");

    return false;
  }

  https.addHeader(
    "Content-Type",
    "application/json"
  );

  int response = https.PUT(json);

  String payload = https.getString();

  https.end();

  if (response >= 200 && response < 300) {

    Serial.println("Firebase upload successful");

    return true;
  }

  Serial.print("Firebase HTTP error: ");
  Serial.println(response);

  Serial.println(payload);

  return false;
}

// ==========================================
// UPLOAD LIVE SENSOR DATA
// ==========================================

void uploadLiveData(
  float ledCurrent,
  float pumpCurrent,
  float ledVoltage,
  float pumpVoltage,
  time_t timestamp
) {

  JsonDocument doc;

  doc["ledCurrent"] = ledCurrent;

  doc["waterPumpCurrent"] = pumpCurrent;

  doc["ledVoltage"] = ledVoltage;

  doc["waterPumpVoltage"] = pumpVoltage;

  doc["timestamp"] = (long)timestamp;

  String json;

  serializeJson(doc, json);

  firebasePut("/live", json);
}

// ==========================================
// UPLOAD MINUTE / HOUR STATISTICS
// ==========================================

void uploadStatistics(
  String period,
  long bucket,
  Statistics stats[4]
) {

  if (stats[0].count == 0) {
    return;
  }

  JsonDocument doc;

  const char* names[4] = {

    "ledCurrent",
    "waterPumpCurrent",
    "ledVoltage",
    "waterPumpVoltage"
  };

  for (int i = 0; i < 4; i++) {

    JsonObject sensor =
      doc[names[i]].to<JsonObject>();

    sensor["average"] = stats[i].average();

    sensor["minimum"] = stats[i].minimum;

    sensor["maximum"] = stats[i].maximum;

    sensor["samples"] = stats[i].count;
  }

  doc["bucket"] = bucket;

  String json;

  serializeJson(doc, json);

  String path =
    "/aggregates/" +
    period +
    "/" +
    String(bucket);

  firebasePut(path, json);
}

// ==========================================
// UPDATE STATISTICS
// ==========================================

void updateStatistics(
  float ledCurrent,
  float pumpCurrent,
  float ledVoltage,
  float pumpVoltage,
  time_t timestamp
) {

  float values[4] = {

    ledCurrent,
    pumpCurrent,
    ledVoltage,
    pumpVoltage
  };

  long minuteBucket = timestamp / 60;

  long hourBucket = timestamp / 3600;

  if (currentMinute == -1) {

    currentMinute = minuteBucket;

    currentHour = hourBucket;
  }

  // Minute boundary
  if (minuteBucket != currentMinute) {

    uploadStatistics(
      "minute",
      currentMinute,
      minuteStats
    );

    for (int i = 0; i < 4; i++) {
      minuteStats[i].reset();
    }

    currentMinute = minuteBucket;
  }

  // Hour boundary
  if (hourBucket != currentHour) {

    uploadStatistics(
      "hour",
      currentHour,
      hourStats
    );

    for (int i = 0; i < 4; i++) {
      hourStats[i].reset();
    }

    currentHour = hourBucket;
  }

  // Add current sample
  for (int i = 0; i < 4; i++) {

    minuteStats[i].add(values[i]);

    hourStats[i].add(values[i]);
  }
}

// ==========================================
// SETUP
// ==========================================

void setup() {

  Serial.begin(115200);

  analogReadResolution(12);

  analogSetPinAttenuation(
    LED_CURRENT_PIN, ADC_11db
  );

  analogSetPinAttenuation(
    PUMP_CURRENT_PIN, ADC_11db
  );

  analogSetPinAttenuation(
    LED_VOLTAGE_PIN, ADC_11db
  );

  analogSetPinAttenuation(
    PUMP_VOLTAGE_PIN, ADC_11db
  );

  pinMode(LED_CURRENT_PIN, INPUT);

  pinMode(PUMP_CURRENT_PIN, INPUT);

  pinMode(LED_VOLTAGE_PIN, INPUT);

  pinMode(PUMP_VOLTAGE_PIN, INPUT);

  // Connect WiFi
  connectWiFi();

  // Set time using NTP
  configTime(
    19800,
    0,
    "pool.ntp.org",
    "time.google.com"
  );

  Serial.println("Synchronizing time...");

  time_t now = time(nullptr);

  unsigned long start = millis();

  while (
    now < 1700000000 &&
    millis() - start < 30000
  ) {

    delay(500);

    now = time(nullptr);
  }

  if (now < 1700000000) {

    Serial.println("Time synchronization failed");

  } else {

    Serial.println("Time synchronized");
  }

  // Disconnect loads before calibration
  ledCurrentOffset =
    calibrateCurrent(LED_CURRENT_PIN);

  pumpCurrentOffset =
    calibrateCurrent(PUMP_CURRENT_PIN);

  Serial.println();
  Serial.println("==============================");

  Serial.println("LED AND WATER PUMP MONITORING");

  Serial.println("==============================");

  Serial.println("Firebase authentication disabled");

  Serial.println("System started");
}

// ==========================================
// MAIN LOOP
// ==========================================

void loop() {

  if (
    millis() - lastSample >= SAMPLE_INTERVAL
  ) {

    lastSample = millis();

    time_t timestamp = time(nullptr);

    if (timestamp < 1700000000) {

      Serial.println("Waiting for valid time");

      return;
    }

    // Read current sensors
    float ledCurrent =
      readCurrent(
        LED_CURRENT_PIN,
        ledCurrentOffset
      );

    float pumpCurrent =
      readCurrent(
        PUMP_CURRENT_PIN,
        pumpCurrentOffset
      );

    // Read voltage sensors
    float ledVoltage =
      readVoltage(LED_VOLTAGE_PIN);

    float pumpVoltage =
      readVoltage(PUMP_VOLTAGE_PIN);

    // Serial Monitor output
    Serial.println();

    Serial.println("========== LIVE DATA ==========");

    Serial.print("LED Current: ");
    Serial.print(ledCurrent, 3);
    Serial.println(" A");

    Serial.print("Water Pump Current: ");
    Serial.print(pumpCurrent, 3);
    Serial.println(" A");

    Serial.print("LED Voltage: ");
    Serial.print(ledVoltage, 3);
    Serial.println(" V");

    Serial.print("Water Pump Voltage: ");
    Serial.print(pumpVoltage, 3);
    Serial.println(" V");

    Serial.print("Timestamp: ");
    Serial.println((long)timestamp);

    // Update statistics
    updateStatistics(
      ledCurrent,
      pumpCurrent,
      ledVoltage,
      pumpVoltage,
      timestamp
    );

    // Upload live readings
    uploadLiveData(
      ledCurrent,
      pumpCurrent,
      ledVoltage,
      pumpVoltage,
      timestamp
    );
  }
}
