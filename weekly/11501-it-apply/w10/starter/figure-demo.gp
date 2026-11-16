# figure-demo.gp — 用純文字腳本畫一張圖，輸出 PDF 給 LaTeX 放進論文
# 執行方式：把這個檔和 figure-data.dat 放在同一個資料夾，終端機輸入
#   gnuplot figure-demo.gp
# 跑完同一個資料夾會多出 figure-demo.pdf
# 圖內文字用英文：gnuplot 的中文字型每台電腦不同，先求圖出得來。

set terminal pdfcairo size 10cm,7cm font "Sans,10"
set output "figure-demo.pdf"

set title "Compile errors per week (demo data)"
set xlabel "Week"
set ylabel "Errors"
set grid
set key top right
set xrange [0.5:8.5]
set yrange [0:*]
set style data linespoints

plot "figure-data.dat" using 1:2 title "Group A" lw 2 pt 7, \
     "figure-data.dat" using 1:3 title "Group B" lw 2 pt 5

set output

# 想要 PNG（放進 Word 或簡報）？把上面 terminal／output 兩行換成：
#   set terminal pngcairo size 1000,700 font "Sans,14"
#   set output "figure-demo.png"
