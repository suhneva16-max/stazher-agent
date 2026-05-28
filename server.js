import express from "express";
import { execSync } from "child_process";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static("public"));

app.post("/api/run", async (req, res) => {
  const { projectName } = req.body;
  if (!projectName) return res.status(400).json({ error: "Нет имени проекта" });

  const steps = ["audience","analysis","campaigns","ads","export-direct"];
  const results = {};

  for (const step of steps) {
    try {
      execSync(`node run-agent.js ${projectName} ${step}`, { stdio: "pipe" });
      const filePath = `./projects/${projectName}/results/${step}.md`;
      if (fs.existsSync(filePath)) {
        results[step] = fs.readFileSync(filePath, "utf-8");
      }
    } catch (e) {
      results[step] = `Ошибка: ${e.message}`;
    }
  }

  res.json({ success: true, results });
});

app.get("/api/results/:project/:file", (req, res) => {
  const filePath = `./projects/${req.params.project}/results/${req.params.file}`;
  if (fs.existsSync(filePath)) {
    res.send(fs.readFileSync(filePath, "utf-8"));
  } else {
    res.status(404).send("Файл не найден");
  }
});

app.listen(3000, () => console.log("Сервер запущен: http://localhost:3000"));