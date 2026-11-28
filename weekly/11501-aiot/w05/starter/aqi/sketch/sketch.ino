// W5 花蓮 AQI 跑馬燈：MCU 這半——跟 Linux 要一行字，在點陣上由右往左捲
#include <ArduinoGraphics.h>
#include <Arduino_LED_Matrix.h>
#include <Arduino_RouterBridge.h>

Arduino_LED_Matrix matrix;

void setup() {
  matrix.begin();
  matrix.clear();
  Bridge.begin();
}

void loop() {
  String text;
  bool ok = Bridge.call("get_aqi_text").result(text);
  if (!ok) {
    text = "WAIT";
  }
  matrix.beginDraw();
  matrix.stroke(0xFFFFFFFF);
  matrix.textScrollSpeed(60);
  matrix.textFont(Font_5x7);
  matrix.beginText(0, 1, 0xFFFFFF);
  matrix.println("   " + text + "   ");
  matrix.endText(SCROLL_LEFT);
  matrix.endDraw();
}
