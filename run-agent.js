import OpenAI from "openai";
import fs from "fs-extra";
import dotenv from "dotenv";

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const projectName = process.argv[2];
const resultType = process.argv[3];

const contextFiles = process.argv.slice(4);

if (!projectName || !resultType) {
  console.log("Ошибка запуска");
  process.exit();
}

const systemPrompt = fs.readFileSync(
  "./prompts/system-directolog.md",
  "utf-8"
);

const taskPrompt = fs.readFileSync(
  `./projects/${projectName}/task.md`,
  "utf-8"
);

let contextText = "";

for (const fileName of contextFiles) {

  const filePath =
    `./projects/${projectName}/results/${fileName}.md`;

  if (!fs.existsSync(filePath)) {
    continue;
  }

  const content = fs.readFileSync(
    filePath,
    "utf-8"
  );

  contextText += `

# FILE: ${fileName}

${content}

`;
}

async function run() {

  const response =
    await client.chat.completions.create({

      model: "gpt-4.1-mini",

      messages: [

        {
          role: "system",
          content: systemPrompt,
        },

        {
          role: "user",
          content: `
ЗАДАЧА:

${taskPrompt}

КОНТЕКСТ:

${contextText}

Создай результат:
${resultType}
`,
        },

      ],

    });

  const result =
    response.choices[0].message.content;

  const savePath =
    `./projects/${projectName}/results/${resultType}.md`;

  fs.writeFileSync(
    savePath,
    result,
    "utf-8"
  );

  console.log(`
Результат сохранен:

${savePath}
`);
}

run();