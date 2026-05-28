import fs from "fs";

const projectName = process.argv[2];

if (!projectName) {
  console.log("Укажи проект");
  process.exit();
}

const inputPath = `./projects/${projectName}/results/export-direct.md`;
const outputPath = `./projects/${projectName}/results/title2-fixed.json`;

const raw = fs.readFileSync(inputPath, "utf-8");
const data = JSON.parse(raw);
const rulesRaw = fs.readFileSync("./knowledge/title2-rules.json", "utf-8");
const rules = JSON.parse(rulesRaw);
function makeTitle2(item) {
  const keyword = (item.keyword || "").toLowerCase();
  const title = (item.title || "").toLowerCase();
  const group = (item.group || "").toLowerCase();

for (const rule of rules) {
  if (
    keyword.includes(rule.match) ||
    title.includes(rule.match) ||
    group.includes(rule.match)
  ) {
    return rule.title2;
  }

  return "Запись онлайн";
}


const result = data.map((item) => ({
  ...item,
  title2: makeTitle2(item),
}));

fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf-8");

console.log(`Готово: ${outputPath}`);