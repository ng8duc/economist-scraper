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
  
  // Query all articles matching the date condition
  const query = db.prepare(`
    SELECT url, title, date, content
    FROM articles
    WHERE date >= ?
    ORDER BY date DESC
  `);

  const articles = query.all(targetDate);
  return articles;
}

main();
