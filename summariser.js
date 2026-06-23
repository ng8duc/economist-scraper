import { GoogleGenAI } from "@google/genai";
import { readFileSync, existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import "dotenv/config";
import { fileURLToPath } from "node:url";

// Khởi tạo client Gemini
// SDK sẽ tự động sử dụng biến môi trường GEMINI_API_KEY hoặc GOOGLE_API_KEY.
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!apiKey || apiKey === "your_gemini_api_key_here") {
  console.error("Error: GEMINI_API_KEY chưa được thiết lập.");
  console.error("Vui lòng cập nhật API Key trong tệp .env:");
  console.error("  GEMINI_API_KEY=mã_khóa_của_bạn");
  console.error("Lấy mã khóa API tại: https://aistudio.google.com/");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

/**
 * Tóm tắt văn bản được cung cấp sử dụng Gemini API.
 * 
 * @param {string} text - Đoạn văn bản cần tóm tắt
 * @param {object} options - Các cấu hình tùy chọn
 * @param {string} options.model - Tên model sử dụng (mặc định: "gemini-2.5-flash")
 * @param {string} options.language - Ngôn ngữ đầu ra cho bản tóm tắt (mặc định: "Tiếng Việt")
 * @param {string} options.style - Phong cách tóm tắt (mặc định: "dạng danh sách và một đoạn ngắn")
 * @returns {Promise<string>} Kết quả tóm tắt từ Gemini
 */
export async function summariseText(text, options = {}) {
  const model = options.model || process.env.GEMINI_MODEL || "gemma-4-26b-a4b-it";
  const language = options.language || "Tiếng Việt";
  const style = options.style || "dạng danh sách gạch đầu dòng và một đoạn tóm tắt ngắn";

  if (!text || text.trim().length === 0) {
    throw new Error("Nội dung văn bản trống.");
  }

  const prompt = `
Bạn là một biên tập viên chuyên nghiệp. Hãy cung cấp một bản tóm tắt chất lượng cao, ngắn gọn cho văn bản dưới đây.
Bản tóm tắt phải được viết bằng ${language}.
Định dạng bản tóm tắt dưới dạng: ${style}.
Chỉ trả về kết quả tóm tắt thuần túy. Không chào hỏi, không dẫn nhập, không giải thích, không hội thoại.

--- NỘI DUNG CẦN TÓM TẮT ---
${text}
--- HẾT NỘI DUNG ---
`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    throw new Error(`Lỗi Gemini API: ${error.message}`);
  }
}

/**
 * Duyệt qua cơ sở dữ liệu SQLite, tạo cột 'summary' nếu chưa có,
 * và tiến hành tóm tắt nội dung của tất cả các bài viết chưa có tóm tắt.
 * 
 * @param {string} dbPath - Đường dẫn đến tệp cơ sở dữ liệu SQLite (mặc định: "articles.db")
 */
export async function summariseDatabase(dbPath = "articles.db") {
  if (!existsSync(dbPath)) {
    throw new Error(`Tệp cơ sở dữ liệu "${dbPath}" không tồn tại.`);
  }

  const db = new DatabaseSync(dbPath);

  // Tạo cột summary nếu chưa tồn tại trong bảng articles
  try {
    db.exec("ALTER TABLE articles ADD COLUMN summary TEXT");
    console.log("Đã kiểm tra/tạo thành công cột 'summary' trong bảng 'articles'.");
  } catch (e) {
    // Cột đã tồn tại, có thể bỏ qua lỗi này
  }

  // Lấy danh sách các bài viết có nội dung nhưng chưa được tóm tắt
  const query = db.prepare(`
    SELECT url, title, content
    FROM articles
    WHERE content IS NOT NULL AND content != '' AND (summary IS NULL OR summary = '')
  `);
  
  const articles = query.all();

  if (articles.length === 0) {
    console.log("Không có bài viết nào cần tóm tắt (tất cả đã có tóm tắt hoặc không có nội dung).");
    return;
  }

  console.log(`Tìm thấy ${articles.length} bài viết cần tóm tắt.`);

  const updateStmt = db.prepare(`
    UPDATE articles
    SET summary = ?
    WHERE url = ?
  `);

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    console.log(`[${i + 1}/${articles.length}] Đang tóm tắt: "${article.title || article.url}"...`);

    try {
      const summary = await summariseText(article.content);
      updateStmt.run(summary, article.url);
      console.log("-> Tóm tắt và cập nhật DB thành công.");
    } catch (error) {
      console.error(`-> Lỗi khi tóm tắt bài viết "${article.title || article.url}":`, error.message);
    }

    // Tránh bị giới hạn tần suất gọi API (Rate Limit) bằng cách dừng 1.5 giây giữa các lượt gọi
    if (i < articles.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
}

// Hỗ trợ chạy trực tiếp từ dòng lệnh (CLI)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const main = async () => {
    const dbPath = "articles.db";
    console.log(`Đang kiểm tra cơ sở dữ liệu: ${dbPath}...`);

    if (!existsSync(dbPath)) {
      console.error(`Lỗi: Không tìm thấy tệp cơ sở dữ liệu "${dbPath}".`);
      console.error("Vui lòng chạy scraper.js trước để cào dữ liệu và khởi tạo cơ sở dữ liệu.");
      process.exit(1);
    }

    try {
      await summariseDatabase(dbPath);
      console.log("\nHoàn thành quá trình tóm tắt cơ sở dữ liệu.");
    } catch (error) {
      console.error("\nLỗi hệ thống trong quá trình tóm tắt:", error.message);
      process.exit(1);
    }
  };

  main();
}
