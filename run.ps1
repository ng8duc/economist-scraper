# Thiết lập UTF-8 cho Console Output để hiển thị tiếng Việt và emoji đúng cách
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Thiết lập để dừng script nếu xảy ra lỗi
$ErrorActionPreference = "Stop"

# Xác định thư mục chứa file script này để chạy chính xác dù gọi từ đâu
$ScriptDir = $PSScriptRoot
if (-not $ScriptDir) {
    $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}
Set-Location $ScriptDir

# Hàm hiển thị thông báo có màu sắc
function Write-Log ($Message, $Color = "Cyan") {
    Write-Host $Message -ForegroundColor $Color
}

Write-Log "==================================================" "Cyan"
Write-Log "   BẮT ĐẦU TIẾN TRÌNH CÀO VÀ TÓM TẮT DỮ LIỆU BÁO  " "Cyan"
Write-Log "==================================================" "Cyan"

# Bước 1: Chạy scraper.js
Write-Log "`n[1/3] Đang chạy cào dữ liệu (scraper.js)..." "Cyan"
node scraper.js
if ($LASTEXITCODE -eq 0) {
    Write-Log "✔ Hoàn thành bước cào dữ liệu!" "Green"
} else {
    Write-Log "✘ Lỗi khi chạy scraper.js! Dừng tiến trình." "Red"
    Exit 1
}

# Bước 2: Chạy clean_db.js
Write-Log "`n[2/3] Đang chạy làm sạch database (clean_db.js)..." "Cyan"
node clean_db.js
if ($LASTEXITCODE -eq 0) {
    Write-Log "✔ Hoàn thành bước làm sạch database!" "Green"
} else {
    Write-Log "✘ Lỗi khi chạy clean_db.js! Dừng tiến trình." "Red"
    Exit 1
}

# Bước 3: Chạy summariser.js
Write-Log "`n[3/3] Đang chạy tóm tắt và xuất dữ liệu (summariser.js)..." "Cyan"
node summariser.js
if ($LASTEXITCODE -eq 0) {
    Write-Log "✔ Hoàn thành bước tóm tắt và xuất dữ liệu!" "Green"
} else {
    Write-Log "✘ Lỗi khi chạy summariser.js! Dừng tiến trình." "Red"
    Exit 1
}

Write-Log "`n==================================================" "Green"
Write-Log "🎉 ĐÃ HOÀN THÀNH TẤT CẢ CÁC BƯỚC THÀNH CÔNG!" "Green"
Write-Log "==================================================" "Green"
