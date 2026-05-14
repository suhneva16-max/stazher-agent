import fs from "fs-extra";

const projectName = process.argv[2];

if (!projectName) {
  console.log("Укажи имя проекта");
  process.exit();
}

const basePath = `./projects/${projectName}`;

const folders = [
  `${basePath}`,
  `${basePath}/knowledge`,
  `${basePath}/results`,
];

for (const folder of folders) {
  fs.ensureDirSync(folder);
}

fs.writeFileSync(
  `${basePath}/task.md`,
  `# ЗАДАЧА

Опиши задачу проекта.
`,
  "utf-8"
);

fs.writeFileSync(
  `${basePath}/pipeline.json`,
  JSON.stringify(
    {
      steps: [
        "analysis",
        "audience",
        "ads"
      ]
    },
    null,
    2
  ),
  "utf-8"
);

console.log(`Проект создан: ${projectName}`);