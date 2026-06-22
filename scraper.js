import { chromium } from "playwright";
import { join } from "path";
import { DatabaseSync } from "node:sqlite";

const EXT_PATH = join(import.meta.dirname, "bypass-paywalls-chrome-clean-master");
const TOPICS = [
  "https://www.economist.com/topics/finance-and-economics",
  "https://www.economist.com/topics/business",
  "https://www.economist.com/topics/science-and-technology"
];

// Helper function to scrape a single topic
async function scrapeTopic(page, db, topicUrl) {
  const topicName = topicUrl.split("/").pop();
  const articlePrefix = `/${topicName}/`;

  console.log(`\n==================================================`);
  console.log(`Scraping Topic: ${topicName.toUpperCase()}`);
  console.log(`URL: ${topicUrl}`);
  console.log(`Article prefix pattern: ${articlePrefix}`);
  console.log(`==================================================\n`);

  await page.goto(topicUrl, { waitUntil: "domcontentloaded" });
  console.log(`Opened ${topicUrl}`);

  // Handle cookie popup if it appears
  try {
    const cookieIframe = page.frameLocator('iframe[id^="sp_message_iframe"]');
    const acceptButton = cookieIframe.getByRole('button', { name: 'Accept all', exact: true });
    await acceptButton.waitFor({ state: "visible", timeout: 5000 });
    console.log("Cookie consent popup detected. Clicking 'Accept all'...");
    await acceptButton.click();
    await page.waitForTimeout(1000);
  } catch (e) {
    // Cookie popup didn't appear or already accepted in this session
  }

  // Extract article links matching prefix
  let links = [];
  try {
    links = await page.$$eval(
      'a',
      (anchors, prefix) => {
        return anchors
          .map((a) => a.getAttribute("href"))
          .filter((href) => href && href.startsWith(prefix));
      },
      articlePrefix
    );
  } catch (err) {
    console.error("Error extracting links:", err.message);
    return;
  }

  const uniqueLinks = [...new Set(links)];
  console.log(`Found ${uniqueLinks.length} article links matching "${articlePrefix}"`);
  uniqueLinks.forEach((link) => console.log(` - ${link}`));
  console.log();

  if (uniqueLinks.length === 0) {
    console.log(`No articles found for topic ${topicName}.`);
    return;
  }

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO articles (url, title, content, date)
    VALUES (?, ?, ?, ?)
  `);
  const checkStmt = db.prepare(`
    SELECT 1 FROM articles WHERE url = ?
  `);

  console.log(`Starting to scrape ${uniqueLinks.length} articles...`);
  for (let i = 0; i < uniqueLinks.length; i++) {
    const link = uniqueLinks[i];
    const detailUrl = `https://www.economist.com${link}`;

    // Skip if already scraped to save time and network requests
    const exists = checkStmt.get(detailUrl);
    if (exists) {
      console.log(`[${i + 1}/${uniqueLinks.length}] Skipping (already in database): ${detailUrl}`);
      continue;
    }

    console.log(`[${i + 1}/${uniqueLinks.length}] Scraping: ${detailUrl}`);

    try {
      await page.goto(detailUrl, { waitUntil: "domcontentloaded" });
      // Allow extension paywall bypass and page rendering to finish
      await page.waitForTimeout(3000);

      const title = await page.locator("h1").first().innerText().catch(() => "");
      
      const content = await page.evaluate(() => {
        const pElements = Array.from(document.querySelectorAll("article p, .article__body-text p"));
        return pElements
          .map((p) => {
            let node = p;
            while (node && node.tagName.toLowerCase() !== 'article') {
              const className = node.className || '';
              const id = node.id || '';
              if (
                className.includes('related') || 
                className.includes('teaser') || 
                className.includes('recommend') ||
                id.includes('related') ||
                id.includes('teaser')
              ) {
                return null;
              }
              node = node.parentElement;
            }
            return p.textContent.trim();
          })
          .filter((text) => text && text.length > 0)
          .join("\n\n");
      });

      if (title || content) {
        const dateMatch = link.match(/\/(\d{4}\/\d{2}\/\d{2})\//);
        const date = dateMatch ? dateMatch[1] : null;
        insertStmt.run(detailUrl, title, content, date);
        console.log(`Saved to DB: "${title}" (${content.split("\n\n").length} paragraphs, date: ${date})`);
      } else {
        console.log(`Warning: No content extracted for ${detailUrl}`);
      }
    } catch (err) {
      console.error(`Failed to scrape article ${detailUrl}:`, err.message);
    }

    // Delay between article scrapes
    if (i < uniqueLinks.length - 1) {
      await page.waitForTimeout(2000);
    }
  }
}

async function main() {
  console.log("Initializing database...");
  const db = new DatabaseSync("articles.db");
  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      url TEXT PRIMARY KEY,
      title TEXT,
      content TEXT,
      date TEXT
    )
  `);

  try {
    db.exec("ALTER TABLE articles ADD COLUMN date TEXT");
  } catch (e) {
    // Ignore if column already exists
  }

  // Backfill existing records with date if date is NULL
  try {
    const records = db.prepare("SELECT url FROM articles WHERE date IS NULL").all();
    if (records.length > 0) {
      console.log(`Backfilling date column for ${records.length} existing articles...`);
      const updateStmt = db.prepare("UPDATE articles SET date = ? WHERE url = ?");
      for (const row of records) {
        const urlMatch = row.url.match(/\/(\d{4}\/\d{2}\/\d{2})\//);
        if (urlMatch) {
          updateStmt.run(urlMatch[1], row.url);
        }
      }
      console.log("Backfill completed.");
    }
  } catch (e) {
    console.error("Failed to backfill dates:", e.message);
  }

  console.log(`Loading extension: ${EXT_PATH}`);
  console.log("Launching Chromium...\n");

  const context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [
      "--start-maximized",
      `--load-extension=${EXT_PATH}`,
      `--disable-extensions-except=${EXT_PATH}`,
    ],
    viewport: null,
  });

  // Auto-close extension popup tabs
  context.on("page", async (page) => {
    try {
      await page.waitForURL(url => url.protocol === "chrome-extension:" || url.href.includes("options.html"), { timeout: 2000 });
      if (page.url().startsWith("chrome-extension://")) {
        console.log(`Closing extension page: ${page.url()}`);
        await page.close();
      }
    } catch (e) {
      // Ignore errors if the page is already closed or it's a normal page
    }
  });

  const page = context.pages()[0] || (await context.newPage());

  // Scrape each topic sequentially
  for (const topicUrl of TOPICS) {
    await scrapeTopic(page, db, topicUrl).catch((err) => {
      console.error(`Error scraping topic ${topicUrl}:`, err.message);
    });
  }

  console.log("\nDone. Closing browser.");
  await context.close();
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
