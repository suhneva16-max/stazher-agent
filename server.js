import express from "express";
import { execSync } from "child_process";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static("public"));

const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const rateLimitLog = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const recent = (rateLimitLog.get(ip) || []).filter(t => t > cutoff);
  if (recent.length >= RATE_LIMIT_MAX) return false;
  recent.push(now);
  rateLimitLog.set(ip, recent);
  return true;
}

app.post("/api/run", async (req, res) => {
  const { projectName, siteUrl, password } = req.body;

  if (!ACCESS_PASSWORD) {
    return res.status(500).json({ error: "ACCESS_PASSWORD не настроен на сервере" });
  }

  if (password !== ACCESS_PASSWORD) {
    return res.status(401).json({ error: "Неверный пароль" });
  }

  if (!checkRateLimit(req.ip)) {
    return res.status(429).json({ error: "Превышен лимит: не более 5 запусков в час" });
  }

  if (!projectName) return res.status(400).json({ error: "Нет имени проекта" });
  if (!siteUrl) return res.status(400).json({ error: "Нет URL сайта" });

  const uniqueProjectName = `${projectName}-${Date.now()}`;
  const projectPath = `./projects/${uniqueProjectName}`;

  try {
    execSync(`node create-project.js "${uniqueProjectName}"`, { stdio: "pipe" });
  } catch (e) {
    return res.status(500).json({ error: `Ошибка создания проекта: ${e.message}` });
  }

  try {
    execSync(`node crawl-site.js "${uniqueProjectName}" "${siteUrl}"`, { stdio: "pipe" });
  } catch (e) {
    return res.status(500).json({ error: `Ошибка краулинга: ${e.message}` });
  }

  const steps = ["audience","analysis","campaigns","ads","export-direct"];
  const results = {};

  for (const step of steps) {
    try {
      execSync(`node run-agent.js ${uniqueProjectName} ${step}`, { stdio: "pipe" });
      const filePath = `./projects/${uniqueProjectName}/results/${step}.md`;
      if (fs.existsSync(filePath)) {
        results[step] = fs.readFileSync(filePath, "utf-8");
      }
    } catch (e) {
      results[step] = `Ошибка: ${e.message}`;
    }
  }

  res.json({ success: true, projectName: uniqueProjectName, results });
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