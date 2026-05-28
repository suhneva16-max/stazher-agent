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

const utm = "?utm_source=yandex&utm_medium=cpc&utm_campaign={campaign_name}&utm_term={keyword}";

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

const NCOLS = columns.length;
const emptyRow = () => new Array(NCOLS).fill("");

function buildTextsSheet() {
  const aoa = [];

  for (let i = 0; i < 4; i++) aoa.push(emptyRow());

  const r5 = emptyRow();
  r5[0] = "Предложение текстовых блоков для кампании";
  aoa.push(r5);

  const r6 = emptyRow();
  r6[0] = "Тип кампании:";
  r6[1] = "Единая перфоманс-кампания";
  aoa.push(r6);

  const r7 = emptyRow();
  r7[0] = "№ заказа:";
  r7[1] = "";
  r7[2] = "Валюта:";
  r7[3] = "RUB";
  aoa.push(r7);

  const r8 = emptyRow();
  r8[0] = "Минус-фразы на кампанию:";
  r8[1] = "";
  aoa.push(r8);

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
      utm
    ]);
  }

  return XLSX.utils.aoa_to_sheet(aoa);
}

function buildRegionsSheet() {
  const aoa = [
    [],
    [],
    ["Регионы"]
  ];
  return XLSX.utils.aoa_to_sheet(aoa);
}

function buildDictionarySheet() {
  const aoa = [
    ["Словарь значений полей"],
    [],
    ["Поле", "Допустимые значения"],
    ["Доп. объявление группы", "- (основное объявление), + (дополнительное объявление)"],
    ["Тип объявления", "Текстово-графическое, Графическое, Мобильное, Видеообъявление"],
    ["Тип кампании", "Единая перфоманс-кампания, Текстово-графические объявления, Реклама приложений, Мастер кампаний"],
    ["Валюта", "RUB, USD, EUR, BYN, KZT, CHF, TRY, UAH"],
    ["Длина", "Число — длина текста объявления в символах"],
    ["Комбинаторика", "0 — не использовать комбинаторику, 1 — использовать"]
  ];
  return XLSX.utils.aoa_to_sheet(aoa);
}

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, buildTextsSheet(), "Тексты");
XLSX.utils.book_append_sheet(workbook, buildRegionsSheet(), "Регионы");
XLSX.utils.book_append_sheet(workbook, buildDictionarySheet(), "Словарь значений полей");

XLSX.writeFile(workbook, outputPath);

console.log(`XLSX создан: ${outputPath} (объявлений: ${ads.length}, групп: ${new Set(ads.map(a => a.groupNumber)).size})`);
