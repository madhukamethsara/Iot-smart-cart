#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>

const char* ssid = "Madhuka iPhone"; 
const char* password = "madhuka123"; 
const char* serverUrl = "http://172.20.10.4:8787";

#define SS_PIN 21
#define RST_PIN 22

MFRC522 rfid(SS_PIN, RST_PIN);
MFRC522::MIFARE_Key key;

void setup() {
  Serial.begin(9600);
  SPI.begin();
  rfid.PCD_Init();
  
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");

  // Initialize default key
  for (byte i = 0; i < 6; i++) key.keyByte[i] = 0xFF;
}

void loop() {
  // Check for new card
  if (!rfid.PICC_IsNewCardPresent()) return;
  if (!rfid.PICC_ReadCardSerial()) return;

  // Read UID
  String uidStr = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uidStr += "0";
    uidStr += String(rfid.uid.uidByte[i], HEX);
  }
  
  uidStr.toUpperCase();  // just call it, don't assign
  uidStr.trim();         // remove any accidental whitespace

  Serial.println("Scanned UID: " + uidStr);

  // Send to backend
 if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;

    // Build correct URL with RFID
    String fullUrl = String(serverUrl) + "/api/cart/rfid/" + uidStr;
    Serial.println("Request URL: " + fullUrl);

    http.begin(fullUrl);
    http.addHeader("Content-Type", "application/json");

    int httpResponseCode = http.GET();   // 👈 CHANGE POST → GET

    Serial.print("HTTP Response code: ");
    Serial.println(httpResponseCode);

    if (httpResponseCode > 0) {
        String response = http.getString();
        Serial.println("Server Response: " + response);
    } else {
        Serial.println("Error sending request");
    }

    http.end();
} else {
    Serial.println("WiFi not connected");
}

rfid.PICC_HaltA();
rfid.PCD_StopCrypto1();
delay(3000);
}