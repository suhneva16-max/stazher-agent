import fs from "fs-extra";
import axios from "axios";
import * as cheerio from "cheerio";

const projectName = process.argv[2];
const url = process.argv[3];

if (!projectName || !url) {
  console.log(`
Использование:

node crawl-site.js PROJECT URL

Пример:
node crawl-site.js hostel-spb https://twincitieshostels.com
`);
  process.exit();
}

const MAX_PAGES = 5;
const MAX_PAGE_CHARS = 10000;
const MAX_TOTAL_CHARS = 50000;

function normalizeUrl(baseUrl, link) {
  try {
    return new URL(link, baseUrl).href;
  } catch {
    return null;
  }
}

async function loadPage(pageUrl) {
  const response = await axios.get(pageUrl);
  const html = response.data;

  const $ = cheerio.load(html);

  $("script, style, noscript").remove();

  const title = $("title").text().trim();

  const text = $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PAGE_CHARS);

  const links = [];
  const baseHost = new URL(url).host;

  $("a").each((_, element) => {
    const href = $(element).attr("href");
    const fullUrl = normalizeUrl(pageUrl, href);
    if (!fullUrl) return;

    try {
      const parsed = new URL(fullUrl);
      if (parsed.host !== baseHost) return;
      const clean = parsed.origin + parsed.pathname;
      if (clean === url) return;
      links.push(clean);
    } catch {
      return;
    }
  });

  return {
    url: pageUrl,
    title,
    text,
    links,
  };
}

async function run() {
  const firstPage = await loadPage(url);

  const uniqueLinks = [...new Set(firstPage.links)];

  const pages = [firstPage];

  for (const link of uniqueLinks) {
    if (pages.length >= MAX_PAGES) break;
    try {
      const page = await loadPage(link);
      pages.push(page);
    } catch {
      console.log(`Не удалось загрузить: ${link}`);
    }
  }

  let result = `# КОНТЕКСТ САЙТА

URL: ${url}
Страниц собрано: ${pages.length}

`;

  for (const page of pages) {
    result += `

## PAGE

URL: ${page.url}
TITLE: ${page.title}

${page.text}

`;
  }

  if (result.length > MAX_TOTAL_CHARS) {
    result = result.slice(0, MAX_TOTAL_CHARS);
  }

  const savePath = `./projects/${projectName}/task.md`;

  fs.writeFileSync(savePath, result, "utf-8");

  console.log(`
Сайт собран:

${savePath}
`);
}

run();