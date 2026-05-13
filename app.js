import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function run() {
  const response = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: "Ты AI-директолог по имени Стажер.",
      },
      {
        role: "user",
        content: "Проанализируй нишу строительства домов.",
      },
    ],
  });

  console.log(response.choices[0].message.content);
}

run();