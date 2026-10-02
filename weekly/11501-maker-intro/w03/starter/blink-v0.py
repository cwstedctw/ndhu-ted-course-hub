# blink-v0.py — 上週那支：紅燈一直閃
# 紅燈接 16 號腳位，短腳串一顆 220Ω 回到 GND（跟上週一樣）。
# 今天要做的：在 red.value(1) 後面加 print('亮')、red.value(0) 後面加 print('滅')，
# 按播放，看右下角那格黑底面板印出來的順序。

from machine import Pin      # 跟板子講話用的工具
import time                  # 「等一下」用的工具

red = Pin(16, Pin.OUT)       # 16 號腳位當輸出，取名叫 red
wait = 0.5                   # 一個名字，裝著 0.5 這個數字（單位：秒）

while True:                  # 底下縮排的四行，做完就回到這裡再做一次
    red.value(1)             # 亮
    time.sleep(wait)         # 等 wait 秒
    red.value(0)             # 滅
    time.sleep(wait)         # 再等 wait 秒
