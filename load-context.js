import fs from "fs-extra";

const projectName = process.argv[2];

if (!projectName) {
  console.log("Укажи проект");
  process.exit();
}

const requestedFiles = process.argv.slice(3);

if (requestedFiles.length === 0) {
  console.log("Укажи файлы контекста");
  process.exit();
}

const resultsPath = `./projects/${projectName}/results`;

let fullContext = "";

for (const fileName of requestedFiles) {
  const filePath = `${resultsPath}/${fileName}.md`;

  if (!fs.existsSync(filePath)) {
    console.log(`Файл не найден: ${fileName}.md`);
    continue;
  }

  const content = fs.readFileSync(
    filePath,
    "utf-8"
  );

  fullContext += `

# FILE: ${fileName}.md

${content}

`;
}

console.log(fullContext);