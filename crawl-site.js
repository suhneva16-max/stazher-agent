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
    .trim();

  const links = [];

  $("a").each((_, element) => {
    const href = $(element).attr("href");
    const fullUrl = normalizeUrl(pageUrl, href);

    if (fullUrl && fullUrl.startsWith(url)) {
      links.push(fullUrl.split("#")[0]);
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

  const uniqueLinks = [...new Set(firstPage.links)].slice(0, 10);

  const pages = [firstPage];

  for (const link of uniqueLinks) {
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

  const savePath = `./projects/${projectName}/task.md`;

  fs.writeFileSync(savePath, result, "utf-8");

  console.log(`
Сайт собран:

${savePath}
`);
}

run();