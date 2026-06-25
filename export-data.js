import { DatabaseSync } from "node:sqlite";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Xuất dữ liệu tóm tắt từ database SQLite ra file data.js tĩnh
 * @param {string} dbPath Đường dẫn tới database SQLite
 * @param {string} outputPath Đường dẫn ghi file output JS
 */
export function exportData(dbPath = join(__dirname, "articles.db"), outputPath = join(__dirname, "data.js")) {
  try {
    const db = new DatabaseSync(dbPath);
    
    // Truy vấn tất cả bài viết có tóm tắt
    const query = db.prepare(`
      SELECT url, title, date, summary
      FROM articles
      WHERE summary IS NOT NULL AND summary != ''
      ORDER BY date DESC
    `);
    
    const articles = query.all();
    
    // Định dạng file data.js dưới dạng biến JavaScript toàn cục
    const fileContent = `// Dữ liệu được tạo tự động từ articles.db. Không sửa trực tiếp file này.
const ARTICLES_DATA = ${JSON.stringify(articles, null, 2)};
`;
    
    writeFileSync(outputPath, fileContent, "utf-8");
    console.log(`✅ Đã xuất thành công ${articles.length} bài viết ra file: ${outputPath}`);
  } catch (error) {
    throw new Error(`Lỗi khi xuất dữ liệu: ${error.message}`);
  }
}

// Hỗ trợ chạy trực tiếp từ dòng lệnh (CLI)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    console.log("Đang chạy xuất dữ liệu trực tiếp...");
    exportData();
  } catch (error) {
    console.error("❌ " + error.message);
    process.exit(1);
  }
}
