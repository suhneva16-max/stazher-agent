import fs from "fs-extra";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const query = process.argv.slice(2).join(" ");

if (!query) {
  console.log("Укажи поисковый запрос");
  process.exit();
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

const chunks = fs.readJsonSync("./knowledge/embeddings.json");

const response = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: query,
});

const queryEmbedding = response.data[0].embedding;

const results = chunks
  .map((chunk) => ({
    source: chunk.source,
    text: chunk.text,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }))
  .sort((a, b) => b.score - a.score)
  .slice(0, 3);

console.log(JSON.stringify(results, null, 2));