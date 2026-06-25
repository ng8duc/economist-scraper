#!/bin/bash

# Thiết lập để dừng script nếu xảy ra lỗi ở bất kỳ bước nào
set -e

# Xác định thư mục chứa file script này để chạy chính xác dù gọi từ đâu
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Màu sắc hiển thị terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}   BẮT ĐẦU TIẾN TRÌNH CÀO VÀ TÓM TẮT DỮ LIỆU BÁO  ${NC}"
echo -e "${BLUE}==================================================${NC}"

# Bước 1: Chạy scraper.js
echo -e "\n${BLUE}[1/3] Đang chạy cào dữ liệu (scraper.js)...${NC}"
if node scraper.js; then
    echo -e "${GREEN}✔ Hoàn thành bước cào dữ liệu!${NC}"
else
    echo -e "${RED}✘ Lỗi khi chạy scraper.js! Dừng tiến trình.${NC}"
    exit 1
fi

# Bước 2: Chạy clean_db.js
echo -e "\n${BLUE}[2/3] Đang chạy làm sạch database (clean_db.js)...${NC}"
if node clean_db.js; then
    echo -e "${GREEN}✔ Hoàn thành bước làm sạch database!${NC}"
else
    echo -e "${RED}✘ Lỗi khi chạy clean_db.js! Dừng tiến trình.${NC}"
    exit 1
fi

# Bước 3: Chạy summariser.js
echo -e "\n${BLUE}[3/3] Đang chạy tóm tắt và xuất dữ liệu (summariser.js)...${NC}"
if node summariser.js; then
    echo -e "${GREEN}✔ Hoàn thành bước tóm tắt và xuất dữ liệu!${NC}"
else
    echo -e "${RED}✘ Lỗi khi chạy summariser.js! Dừng tiến trình.${NC}"
    exit 1
fi

echo -e "\n${GREEN}==================================================${NC}"
echo -e "${GREEN}🎉 ĐÃ HOÀN THÀNH TẤT CẢ CÁC BƯỚC THÀNH CÔNG!${NC}"
echo -e "${GREEN}==================================================${NC}"
