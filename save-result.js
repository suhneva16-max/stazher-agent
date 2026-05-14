import fs from "fs-extra";

const projectName = process.argv[2];
const resultType = process.argv[3];

if (!projectName) {
  console.log("Укажи проект");
  process.exit();
}

if (!resultType) {
  console.log("Укажи тип результата: audience, structure, ads, negatives");
  process.exit();
}

const allowedTypes = ["audience", "structure", "ads", "negatives", "analysis"];

if (!allowedTypes.includes(resultType)) {
  console.log("Недопустимый тип результата");
  console.log("Можно использовать: audience, structure, ads, negatives, analysis");
  process.exit();
}

const resultText = fs.readFileSync("./input.txt", "utf-8");

fs.ensureDirSync(`./projects/${projectName}/results`);

fs.writeFileSync(
  `./projects/${projectName}/results/${resultType}.md`,
  resultText,
  "utf-8"
);

console.log(`Результат сохранен: projects/${projectName}/results/${resultType}.md`);