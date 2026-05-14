import fs from "fs-extra";

const knowledgeDir = "./knowledge";
const outputPath = "./knowledge/index.json";

const files = fs
  .readdirSync(knowledgeDir)
  .filter((file) => file.endsWith(".md"));

const chunks = [];

for (const file of files) {
  const content = fs.readFileSync(`${knowledgeDir}/${file}`, "utf-8");

  const parts = content
    .split(/\n(?=# )|\n(?=## )|\n(?=### )/)
    .map((part) => part.trim())
    .filter(Boolean);

  for (const part of parts) {
    chunks.push({
      source: file,
      text: part,
    });
  }
}

fs.writeFileSync(outputPath, JSON.stringify(chunks, null, 2), "utf-8");

console.log(`Индекс создан: ${outputPath}`);
console.log(`Фрагментов: ${chunks.length}`);