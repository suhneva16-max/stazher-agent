import fs from "fs";
import XLSX from "xlsx";

const projectName = process.argv[2];

if (!projectName) {
  console.log("Укажи проект");
  process.exit();
}

const inputPath = `./projects/${projectName}/results/ads.md`;
const outputPath = `./projects/${projectName}/results/direct-import.xlsx`;

if (!fs.existsSync(inputPath)) {
  console.log(`Файл не найден: ${inputPath}`);
  process.exit();
}

const markdown = fs.readFileSync(inputPath, "utf-8");

function parseAds(text) {
  const lines = text.split(/\r?\n/);
  const ads = [];
  let currentCampaign = "";
  let currentGroup = "";
  let groupNumber = 0;
  let lastGroupKey = "";
  let currentAd = null;

  for (const raw of lines) {
    const line = raw.trim();

    const groupMatch = line.match(/^###\s+(.+)$/);
    if (groupMatch) {
      currentGroup = groupMatch[1].trim();
      const groupKey = `${currentCampaign}::${currentGroup}`;
      if (groupKey !== lastGroupKey) {
        groupNumber++;
        lastGroupKey = groupKey;
      }
      currentAd = null;
      continue;
    }

    const campaignMatch = line.match(/^##\s+(.+)$/);
    if (campaignMatch) {
      currentCampaign = campaignMatch[1].trim();
      currentGroup = "";
      currentAd = null;
      continue;
    }

    if (/^\*\*Объявление/i.test(line)) {
      currentAd = {
        campaign: currentCampaign,
        group: currentGroup,
        groupNumber,
        title1: "",
        title2: "",
        text: ""
      };
      ads.push(currentAd);
      continue;
    }

    if (line.startsWith("|") && currentAd) {
      const cells = line.split("|").map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
      if (cells.length < 2) continue;
      const field = cells[0];
      const value = cells[1];
      if (field === "Элемент" || /^-+$/.test(field)) continue;
      if (field === "Заголовок 1") currentAd.title1 = value;
      else if (field === "Заголовок 2") currentAd.title2 = value;
      else if (field === "Текст") currentAd.text = value;
    }
  }

  return ads;
}

const ads = parseAds(markdown);

if (ads.length === 0) {
  console.log("Не удалось распарсить ни одного объявления из ads.md");
  process.exit();
}

const columns = [
  "Доп. объявление группы",
  "Тип объявления",
  "ID группы",
  "Название группы",
  "Номер группы",
  "ID фразы",
  "Фраза (с минус-словами)",
  "ID объявления",
  "Заголовок 1",
  "Заголовок 2",
  "Текст",
  "Длина",
  "Комбинаторика",
  "Ссылка"
];

const emptyRow = new Array(columns.length).fill("");

const aoa = [];

for (let i = 0; i < 8; i++) aoa.push([...emptyRow]);

aoa.push(columns);

for (const ad of ads) {
  aoa.push([
    "-",
    "Текстово-графическое",
    "",
    ad.group,
    ad.groupNumber,
    "",
    "",
    "",
    ad.title1,
    ad.title2,
    ad.text,
    0,
    0,
    ""
  ]);
}

const worksheet = XLSX.utils.aoa_to_sheet(aoa);
const workbook = XLSX.utils.book_new();

XLSX.utils.book_append_sheet(workbook, worksheet, "Direct Import");

XLSX.writeFile(workbook, outputPath);

console.log(`XLSX создан: ${outputPath} (объявлений: ${ads.length}, групп: ${new Set(ads.map(a => a.groupNumber)).size})`);
