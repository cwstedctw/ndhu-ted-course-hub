#!/bin/bash
# probe-my-setup.sh — AIoT W2 唯讀探針：只看，不改。這支腳本不會動到系統任何一個字。
echo "== 這台電腦 =="
if [ -r /etc/os-release ]; then grep -E '^(NAME|VERSION)=' /etc/os-release
else echo "這台沒有 /etc/os-release，正常：不是 Linux 就不會有"; fi
echo "架構：$(uname -m)"
echo
echo "== USB 上的板子 =="
if command -v lsusb >/dev/null 2>&1; then
  lsusb | grep -E '2341:0078|05c6:9008' || echo "沒看到板子。2341:0078 才正常，05c6:9008 要舉手"
else echo "這台沒有 lsusb，正常：教室那台 Ubuntu 才有"; fi
echo
echo "== App Lab 附的 adb =="
ADB=$(find "$HOME/.arduino15/packages/arduino/tools/adb" \
  -type f -name adb -perm -u+x -print 2>/dev/null | sort -V | tail -n 1)
if [ -z "$ADB" ]; then
  echo "找不到 App Lab 附的 adb，把這份輸出給老師看"
else
  echo "本次使用：$ADB"
  "$ADB" devices -l
fi
echo
echo "== 以上全部是唯讀，沒有改到任何東西。有一行看不懂就舉手。 =="
