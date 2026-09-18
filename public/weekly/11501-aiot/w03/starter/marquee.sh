#!/bin/bash
# 跑馬燈：讓一顆燈自己亮、暗、亮、暗，跑十次。
# 用法：./marquee.sh <要寫進去的那個檔>
#   真的點燈： ./marquee.sh /sys/class/leds/<你 ls 出來的名字>/brightness　（被擋才在前面加 sudo）
#   沒有板子： ./marquee.sh /dev/stdout        # 1 和 0 會直接印在螢幕上
LED="$1"                          # 第一個參數就是那個檔
for i in 1 2 3 4 5 6 7 8 9 10; do # 跑十次
  echo 1 > "$LED"                 # 寫 1 ＝ 亮
  sleep 0.3                       # 等 0.3 秒（sleep 不吃小數就改成 1）
  echo 0 > "$LED"                 # 寫 0 ＝ 暗
  sleep 0.3
done
