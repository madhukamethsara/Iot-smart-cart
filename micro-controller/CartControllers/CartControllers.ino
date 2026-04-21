#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <HardwareSerial.h>

// ---------------- WIFI ----------------
const char* WIFI_SSID = "#####";
const char* WIFI_PASSWORD = "####";

// ---------------- BACKEND ----------------
// Exact backend route:
// POST http://<YOUR_PC_IP>:8787/api/carts/:cart_id/scan
const char* SERVER_BASE_URL = "#####";
const int CART_ID = 2;

// ---------------- GM65 Barcode Scanner ----------------
HardwareSerial scannerSerial(2);

#define SCANNER_RX 16
#define SCANNER_TX 17

String barcodeBuffer = "";
String lastScannedBarcode = "";
unsigned long lastReceiveTime = 0;
const unsigned long barcodeTimeout = 150;

// ---------------- Ultrasonic Sensor ----------------
const int trigPin = 5;
const int echoPin = 18;

// ---------------- Buzzer ----------------
#define BUZZER_PIN 14

// ---------------- LCD ----------------
LiquidCrystal_I2C lcd(0x27, 16, 2);

// ---------------- Calibration ----------------
const float EMPTY_DISTANCE_CM = 9.9;
const float MASS_CONSTANT_G_PER_CM = 500.0;

// ---------------- Measurement ----------------
float currentDistance = 0.0;
float currentCompression = 0.0;
float currentMassG = 0.0;

float baselineDistance = 0.0;
float baselineCompression = 0.0;
float baselineMassG = 0.0;

float finalDistance = 0.0;
float finalCompression = 0.0;
float finalMassG = 0.0;

float deltaMassG = 0.0;

bool processingScan = false;
bool productMeasured = false;

// ---------------- Timing ----------------
unsigned long lastSensorUpdate = 0;
const unsigned long sensorInterval = 300;

const unsigned long placementTimeout = 6000;
const unsigned long settleDelay = 1200;
const float minDetectMassG = 20.0;

// ---------------- Buzzer State ----------------
bool buzzerRunning = false;
int buzzerStep = 0;
unsigned long buzzerStepStart = 0;

// ---------------- Function Prototypes ----------------
float getDistance();
float getAverageDistance(int samples);
float calculateCompression(float distance);
float calculateMassGrams(float compression);

void connectWiFi();
bool isWiFiConnected();

void updateBarcodeReader();
void processProductAfterScan();
void showLiveWaitingScreen();
void showMeasuredData();

void startBuzzerPattern();
void updateBuzzerPattern();

void showTwoLine(String line1, String line2);

bool sendDeltaToBackend(String barcode, float measuredWeight);
String buildCartScanUrl();

void setup() {
  Serial.begin(115200);
  delay(1000);

  // GM65 scanner UART2
  scannerSerial.begin(9600, SERIAL_8N1, SCANNER_RX, SCANNER_TX);

  // Ultrasonic
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);

  // LCD
  Wire.begin(21, 22);
  lcd.init();
  lcd.backlight();
  lcd.clear();

  // Buzzer
  ledcAttach(BUZZER_PIN, 2000, 8);
  ledcWriteTone(BUZZER_PIN, 0);

  showTwoLine("Connecting WiFi", "Please wait...");
  connectWiFi();

  showTwoLine("Scan Product", "M:0g");

  Serial.println("=================================");
  Serial.println("System Ready");
  Serial.println("Backend route:");
  Serial.println(buildCartScanUrl());
  Serial.println("Mass logic: DELTA MASS");
  Serial.println("=================================");
}

void loop() {
  if (!isWiFiConnected()) {
    connectWiFi();
  }

  updateBarcodeReader();
  showLiveWaitingScreen();
  updateBuzzerPattern();
}

// ---------------- WIFI ----------------
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connecting to WiFi");
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Connecting...");
  lcd.setCursor(0, 1);
  lcd.print("WiFi");

  unsigned long startAttempt = millis();

  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 20000) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi connected");
    Serial.print("ESP32 IP: ");
    Serial.println(WiFi.localIP());

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Connected");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP());
    delay(1500);
  } else {
    Serial.println("WiFi connection failed");

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Failed");
    lcd.setCursor(0, 1);
    lcd.print("Retrying...");
    delay(1500);
  }
}

bool isWiFiConnected() {
  return WiFi.status() == WL_CONNECTED;
}

// ---------------- Barcode Reader ----------------
void updateBarcodeReader() {
  if (processingScan) return;

  while (scannerSerial.available()) {
    char c = scannerSerial.read();

    if (c != '\n' && c != '\r') {
      barcodeBuffer += c;
    }

    lastReceiveTime = millis();
  }

  if (barcodeBuffer.length() > 0 && (millis() - lastReceiveTime > barcodeTimeout)) {
    lastScannedBarcode = barcodeBuffer;
    barcodeBuffer = "";

    processingScan = true;

    Serial.println("\n===== PRODUCT SCANNED =====");
    Serial.print("Barcode: ");
    Serial.println(lastScannedBarcode);

    showTwoLine("Barcode OK", "Measuring...");
    startBuzzerPattern();

    processProductAfterScan();
  }
}

// ---------------- Main Delta Logic ----------------
void processProductAfterScan() {
  // 1. Baseline before product is placed
  baselineDistance = getAverageDistance(10);
  baselineCompression = calculateCompression(baselineDistance);
  baselineMassG = calculateMassGrams(baselineCompression);

  Serial.println("----- BASELINE BEFORE ADD -----");
  Serial.print("Baseline Distance: ");
  Serial.print(baselineDistance, 2);
  Serial.println(" cm");

  Serial.print("Baseline Total Mass: ");
  Serial.print(baselineMassG, 0);
  Serial.println(" g");

  showTwoLine("Place Product", "Wait...");

  // 2. Wait for product placement
  unsigned long startWait = millis();
  bool detected = false;

  while (millis() - startWait < placementTimeout) {
    updateBuzzerPattern();

    float testDistance = getAverageDistance(5);
    float testCompression = calculateCompression(testDistance);
    float testMass = calculateMassGrams(testCompression);
    float testDelta = testMass - baselineMassG;

    Serial.print("Waiting -> Current Mass: ");
    Serial.print(testMass, 0);
    Serial.print(" g | Delta: ");
    Serial.print(testDelta, 0);
    Serial.println(" g");

    lcd.setCursor(0, 0);
    lcd.print("Place Product   ");

    lcd.setCursor(0, 1);
    lcd.print("dM:");
    lcd.print(testDelta, 0);
    lcd.print("g   ");

    if (testDelta >= minDetectMassG) {
      detected = true;
      break;
    }

    delay(120);
  }

  if (!detected) {
    Serial.println("No product detected");

    showTwoLine("No Product", "Try Again");
    delay(2000);

    processingScan = false;
    productMeasured = false;
    showTwoLine("Scan Product", "M:0g");
    return;
  }

  // 3. Allow system to settle
  delay(settleDelay);

  // 4. Final measurement
  finalDistance = getAverageDistance(12);
  finalCompression = calculateCompression(finalDistance);
  finalMassG = calculateMassGrams(finalCompression);

  deltaMassG = finalMassG - baselineMassG;

  if (deltaMassG < 0) {
    deltaMassG = 0;
  }

  currentDistance = finalDistance;
  currentCompression = finalCompression;
  currentMassG = finalMassG;
  productMeasured = true;

  Serial.println("----- FINAL AFTER ADD -----");
  Serial.print("Final Distance: ");
  Serial.print(finalDistance, 2);
  Serial.println(" cm");

  Serial.print("Final Total Mass: ");
  Serial.print(finalMassG, 0);
  Serial.println(" g");

  Serial.print("Delta Product Mass: ");
  Serial.print(deltaMassG, 0);
  Serial.println(" g");

  // 5. Send exact product delta mass to backend
  bool sentOk = sendDeltaToBackend(lastScannedBarcode, deltaMassG);

  if (sentOk) {
    showMeasuredData();
  } else {
    showTwoLine("Backend Error", "Check Serial");
    delay(2500);
  }

  processingScan = false;
}

// ---------------- LCD Final Result ----------------
void showMeasuredData() {
  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("Add:");
  lcd.print(deltaMassG, 0);
  lcd.print("g");

  lcd.setCursor(0, 1);
  lcd.print("Tot:");
  lcd.print(finalMassG, 0);
  lcd.print("g");

  delay(3000);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Scan Product");
  lcd.setCursor(0, 1);
  lcd.print("M:");
  lcd.print(finalMassG, 0);
  lcd.print("g   ");

  productMeasured = false;
}

// ---------------- Live Waiting Screen ----------------
void showLiveWaitingScreen() {
  if (productMeasured || processingScan) return;

  if (millis() - lastSensorUpdate < sensorInterval) return;
  lastSensorUpdate = millis();

  float d = getDistance();
  float comp = calculateCompression(d);
  float massG = calculateMassGrams(comp);

  Serial.print("Live -> Distance: ");
  Serial.print(d, 1);
  Serial.print(" cm | Compression: ");
  Serial.print(comp, 1);
  Serial.print(" cm | Total Mass: ");
  Serial.print(massG, 0);
  Serial.println(" g");

  lcd.setCursor(0, 0);
  lcd.print("Scan Product   ");

  lcd.setCursor(0, 1);
  lcd.print("M:");
  lcd.print(massG, 0);
  lcd.print("g   ");
}

// ---------------- Backend Send ----------------
String buildCartScanUrl() {
  return String(SERVER_BASE_URL) + "/api/carts/" + String(CART_ID) + "/scan";
}

bool sendDeltaToBackend(String barcode, float measuredWeight) {
  if (!isWiFiConnected()) {
    Serial.println("WiFi not connected");
    return false;
  }

  HTTPClient http;
  String url = buildCartScanUrl();

  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> requestDoc;
  requestDoc["barcode"] = barcode;
  requestDoc["measuredWeight"] = (int)round(measuredWeight);

  String requestBody;
  serializeJson(requestDoc, requestBody);

  Serial.println("----- SENDING TO BACKEND -----");
  Serial.print("POST URL: ");
  Serial.println(url);
  Serial.print("Request Body: ");
  Serial.println(requestBody);

  int httpCode = http.POST(requestBody);
  String response = http.getString();

  Serial.print("HTTP Code: ");
  Serial.println(httpCode);
  Serial.print("Response: ");
  Serial.println(response);

  if (httpCode <= 0) {
    Serial.println("HTTP request failed");
    http.end();
    return false;
  }

  StaticJsonDocument<2048> responseDoc;
  DeserializationError err = deserializeJson(responseDoc, response);

  if (err) {
    Serial.println("Failed to parse backend JSON response");
    http.end();
    return false;
  }

  bool success = responseDoc["success"] | false;
  const char* message = responseDoc["message"] | "No message";
  const char* lcdMessage = responseDoc["lcdMessage"] | message;

  if (success) {
    Serial.println("Backend verification success");
    Serial.print("Message: ");
    Serial.println(message);

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Added OK");
    lcd.setCursor(0, 1);
    lcd.print(lcdMessage);
    delay(1800);

    http.end();
    return true;
  } else {
    Serial.println("Backend verification failed");
    Serial.print("Message: ");
    Serial.println(message);

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Verify Failed");
    lcd.setCursor(0, 1);
    lcd.print(lcdMessage);
    delay(2500);

    http.end();
    return false;
  }
}

// ---------------- Ultrasonic Distance ----------------
float getDistance() {
  long duration;

  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);

  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  duration = pulseIn(echoPin, HIGH, 30000);

  if (duration == 0) {
    return 0.0;
  }

  return duration * 0.034 / 2.0;
}

// ---------------- Average Distance ----------------
float getAverageDistance(int samples) {
  float sum = 0.0;
  int count = 0;

  for (int i = 0; i < samples; i++) {
    float d = getDistance();

    if (d > 0.0) {
      sum += d;
      count++;
    }

    delay(60);
  }

  if (count == 0) {
    return 0.0;
  }

  return sum / count;
}

// ---------------- Calculations ----------------
float calculateCompression(float distance) {
  float compression = EMPTY_DISTANCE_CM - distance;

  if (compression < 0) {
    compression = 0;
  }

  return compression;
}

float calculateMassGrams(float compression) {
  float massG = compression * MASS_CONSTANT_G_PER_CM;

  if (massG < 0) {
    massG = 0;
  }

  return massG;
}

// ---------------- LCD Helper ----------------
void showTwoLine(String line1, String line2) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(line1);
  lcd.setCursor(0, 1);
  lcd.print(line2);
}

// ---------------- Buzzer ----------------
void startBuzzerPattern() {
  buzzerRunning = true;
  buzzerStep = 0;
  buzzerStepStart = millis();
}

void updateBuzzerPattern() {
  if (!buzzerRunning) return;

  unsigned long now = millis();

  switch (buzzerStep) {
    case 0:
      ledcWriteTone(BUZZER_PIN, 1200);
      buzzerStepStart = now;
      buzzerStep = 1;
      break;

    case 1:
      if (now - buzzerStepStart >= 150) {
        ledcWriteTone(BUZZER_PIN, 0);
        buzzerStepStart = now;
        buzzerStep = 2;
      }
      break;

    case 2:
      if (now - buzzerStepStart >= 100) {
        ledcWriteTone(BUZZER_PIN, 1000);
        buzzerStepStart = now;
        buzzerStep = 3;
      }
      break;

    case 3:
      if (now - buzzerStepStart >= 150) {
        ledcWriteTone(BUZZER_PIN, 0);
        buzzerStepStart = now;
        buzzerStep = 4;
      }
      break;

    case 4:
      if (now - buzzerStepStart >= 100) {
        ledcWriteTone(BUZZER_PIN, 700);
        buzzerStepStart = now;
        buzzerStep = 5;
      }
      break;

    case 5:
      if (now - buzzerStepStart >= 250) {
        ledcWriteTone(BUZZER_PIN, 0);
        buzzerRunning = false;
      }
      break;
  }
}