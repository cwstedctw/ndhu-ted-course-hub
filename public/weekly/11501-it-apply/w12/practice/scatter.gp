# scatter.gp：散點圖（scatter plot），Y 軸從 0 畫到 100（滿分）
# 用法：這個檔和 sleep-quiz.dat 放同一個資料夾，在那個資料夾開終端機，輸入
#   gnuplot scatter.gp
# 跑完會多出 scatter.png。圖裡的字用英文：中文字型每台電腦不同，先求圖出得來。

set terminal pngcairo size 900,650 font "Sans,16"
set output "scatter.png"

set title "Sleep vs. quiz score (FICTIONAL data, n = 20)"
set xlabel "Average sleep per week (hours)"
set ylabel "Quiz score (points)"
set grid
set key off
set xrange [4.5:9]
set yrange [0:100]

plot "sleep-quiz.dat" using 1:2 with points pt 7 ps 1.8 lc rgb "#1f6f8b"

set output
