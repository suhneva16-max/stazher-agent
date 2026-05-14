import fs from "fs-extra";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const indexPath = "./knowledge/index.json";
const outputPath = "./knowledge/embeddings.json";

const chunks = fs.readJsonSync(indexPath);

const embeddedChunks = [];

for (const chunk of chunks) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: chunk.text,
  });

  embeddedChunks.push({
    ...chunk,
    embedding: response.data[0].embedding,
  });

  console.log(`Embedded: ${chunk.source}`);
}

fs.writeJsonSync(outputPath, embeddedChunks, { spaces: 2 });

console.log(`Embeddings сохранены: ${outputPath}`);