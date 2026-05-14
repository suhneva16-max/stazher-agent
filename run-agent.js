import OpenAI from "openai";
import fs from "fs-extra";
import dotenv from "dotenv";
import { retrieveKnowledge } from "./retrieve-knowledge.js";
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

const promptPath =
  `./prompts/tasks/${resultType}.md`;

if (!fs.existsSync(promptPath)) {
  console.log("Prompt не найден");
  process.exit();
}

const systemPrompt = fs.readFileSync(
  promptPath,
  "utf-8"
);
const globalKnowledge = fs.readFileSync(
  "./knowledge/direct-rules.md",
  "utf-8"
);

const projectKnowledgePath =
  `./projects/${projectName}/knowledge`;

let projectKnowledge = "";

if (fs.existsSync(projectKnowledgePath)) {

  const knowledgeFiles =
    fs.readdirSync(projectKnowledgePath);

  for (const file of knowledgeFiles) {

    const content =
      fs.readFileSync(
        `${projectKnowledgePath}/${file}`,
        "utf-8"
      );

    projectKnowledge += `

# FILE: ${file}

${content}

`;
  }
}
const taskPrompt = fs.readFileSync(
  `./projects/${projectName}/task.md`,
  "utf-8"
);
const ragKnowledge = await retrieveKnowledge(
  `${resultType} ${taskPrompt}`,
  3
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

# GLOBAL KNOWLEDGE

${globalKnowledge}
# RAG KNOWLEDGE

${ragKnowledge}
# PROJECT KNOWLEDGE

${projectKnowledge}

# TASK

${taskPrompt}

# CONTEXT

${contextText}

# RESULT TYPE

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