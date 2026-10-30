# blink-v1.py — 閃五次就停：前三次快、後兩次慢
# 跟上週同一顆燈：紅燈接 16 號腳位，短腳串 220Ω 回到 GND。
# 右下角那格會印出每一次的 n 和 wait，對照燈看。

from machine import Pin
import time

red = Pin(16, Pin.OUT)
times = 5                    # 一共閃幾次

for n in range(times):       # n 會從 0 數到 4，剛好 5 次
    if n < 3:                # n 還小於 3 的時候（0、1、2）
        wait = 0.2           # 快
    else:                    # 其他時候（3、4）
        wait = 1.0           # 慢
    print('n =', n, ' wait =', wait)
    red.value(1)
    time.sleep(wait)
    red.value(0)
    time.sleep(wait)

print('閃完了，燈停在滅')
