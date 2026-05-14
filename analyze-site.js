import fs from "fs";
import axios from "axios";
import * as cheerio from "cheerio";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const url = process.argv[2];
const projectName = process.argv[3];

if (!url || !projectName) {
  console.log(`
Использование:

node analyze-site.js URL PROJECT

Пример:
node analyze-site.js https://site.ru hostel-spb
`);
  process.exit();
}

async function loadSiteText(siteUrl) {
  const response = await axios.get(siteUrl);
  const html = response.data;

  const $ = cheerio.load(html);

  $("script, style, noscript").remove();

  const text = $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim();

  return text.slice(0, 12000);
}

async function run() {
  const siteText = fs.readFileSync(
  `./projects/${projectName}/raw-site-full.txt`,
  "utf-8"
);
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: `
Ты маркетолог-аналитик и директолог.

Анализируй только по тексту сайта.
Не выдумывай факты, которых нет в тексте.
Если данных нет — так и пиши.
`,
      },
      {
        role: "user",
        content: `
URL:
${url}

ТЕКСТ САЙТА:
${siteText}

Сформируй:

# BUSINESS
# UTP
# OFFERS
# AUDIENCE
# PAINS
# GEO
# COMPETITORS
`,
      },
    ],
  });

  const result = response.choices[0].message.content;

  const savePath = `./projects/${projectName}/site-analysis.md`;

  fs.writeFileSync(savePath, result, "utf-8");

  console.log(`
Анализ сохранен:

${savePath}
`);
}

run();