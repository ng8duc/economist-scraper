import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const DB_FILE = "articles.db";

function main() {
  if (!existsSync(DB_FILE)) {
    console.log(`Database file "${DB_FILE}" does not exist. Skipping.`);
    return;
  }

  // Calculate the target date: today - 30 days
  const dateLimit = new Date();
  dateLimit.setDate(dateLimit.getDate() - 30);

  // Format to yyyy/mm/dd
  const yyyy = dateLimit.getFullYear();
  const mm = String(dateLimit.getMonth() + 1).padStart(2, "0");
  const dd = String(dateLimit.getDate()).padStart(2, "0");
  const targetDate = `${yyyy}/${mm}/${dd}`;

  const db = new DatabaseSync(DB_FILE);

  // Delete all articles older than the target date
  const deleteStmt = db.prepare(`
    DELETE FROM articles
    WHERE date < ?
  `);

  const result = deleteStmt.run(targetDate);
  console.log(`Đã xóa ${result.changes} bài viết cũ hơn ${targetDate}.`);
}

main();
