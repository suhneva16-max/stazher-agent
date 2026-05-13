import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs-extra";

dotenv.config();

const systemPrompt = fs.readFileSync(
  "./prompts/system-directolog.md",
  "utf-8"
);

const taskPrompt = fs.readFileSync(
  "./projects/test-dom/task.md",
  "utf-8"
);

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function run() {
  const response = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: taskPrompt,
      },
    ],
  });

  console.log(response.choices[0].message.content);
}

run();