# truncated.gp：同一份資料、同一個標題，只改了兩行（標了 <-- 的那兩行）
# 用法：gnuplot truncated.gp    跑完會多出 truncated.png
# 想自己做：把 scatter.gp 另存成 truncated.gp，只改 set output 和 set yrange 這兩行。

set terminal pngcairo size 900,650 font "Sans,16"
set output "truncated.png"          # <-- 改 1：輸出檔名

set title "Sleep vs. quiz score (FICTIONAL data, n = 20)"
set xlabel "Average sleep per week (hours)"
set ylabel "Quiz score (points)"
set grid
set key off
set xrange [4.5:9]
set yrange [69:83]                  # <-- 改 2：Y 軸只畫 69 到 83 分

plot "sleep-quiz.dat" using 1:2 with points pt 7 ps 1.8 lc rgb "#1f6f8b"

set output
