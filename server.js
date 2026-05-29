import express from "express";
import { spawn } from "child_process";
import fs from "fs-extra";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import XLSX from "xlsx";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD;

const PROJECTS_DIR = path.join(__dirname, "projects");
const TASKS_DIR = path.join(__dirname, "prompts", "tasks");

fs.ensureDirSync(PROJECTS_DIR);

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const tokens = new Set();

function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token || !tokens.has(token)) {
    return res.status(401).json({ error: "Не авторизован" });
  }
  next();
}

function safeName(name) {
  return /^[\wа-яА-ЯёЁ\-. ]+$/u.test(name) && !name.includes("..");
}

app.post("/api/login", (req, res) => {
  const { password } = req.body || {};
  if (!ACCESS_PASSWORD) {
    return res.status(500).json({ error: "ACCESS_PASSWORD не настроен" });
  }
  if (password !== ACCESS_PASSWORD) {
    return res.status(401).json({ error: "Неверный пароль" });
  }
  const token = crypto.randomBytes(32).toString("hex");
  tokens.add(token);
  res.json({ token });
});

app.post("/api/logout", auth, (req, res) => {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  tokens.delete(token);
  res.json({ ok: true });
});

app.get("/api/projects", auth, async (req, res) => {
  try {
    const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
    const projects = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const projectPath = path.join(PROJECTS_DIR, e.name);
      const taskPath = path.join(projectPath, "task.md");
      const resultsPath = path.join(projectPath, "results");
      let task = "";
      let results = [];
      let createdAt = null;
      try {
        if (await fs.pathExists(taskPath)) task = await fs.readFile(taskPath, "utf-8");
      } catch {}
      try {
        if (await fs.pathExists(resultsPath)) {
          const files = await fs.readdir(resultsPath);
          results = files.filter(f => f.endsWith(".md") || f.endsWith(".xlsx"));
        }
      } catch {}
      try {
        const stat = await fs.stat(projectPath);
        createdAt = stat.birthtimeMs || stat.ctimeMs;
      } catch {}
      projects.push({ name: e.name, task: task.slice(0, 200), results, createdAt });
    }
    projects.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    res.json({ projects });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/projects", auth, async (req, res) => {
  const { name, task } = req.body || {};
  if (!name || !safeName(name)) return res.status(400).json({ error: "Некорректное имя проекта" });
  if (!task || typeof task !== "string") return res.status(400).json({ error: "Нет описания задачи" });

  const projectPath = path.join(PROJECTS_DIR, name);
  if (await fs.pathExists(projectPath)) {
    return res.status(409).json({ error: "Проект с таким именем уже существует" });
  }
  try {
    await fs.ensureDir(path.join(projectPath, "knowledge"));
    await fs.ensureDir(path.join(projectPath, "results"));
    await fs.writeFile(path.join(projectPath, "task.md"), task, "utf-8");
    res.json({ ok: true, name });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/projects/:name", auth, async (req, res) => {
  const { name } = req.params;
  if (!safeName(name)) return res.status(400).json({ error: "Некорректное имя" });
  const projectPath = path.join(PROJECTS_DIR, name);
  if (!(await fs.pathExists(projectPath))) {
    return res.status(404).json({ error: "Проект не найден" });
  }
  try {
    await fs.remove(projectPath);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/tasks", auth, async (req, res) => {
  try {
    const files = await fs.readdir(TASKS_DIR);
    const tasks = files
      .filter(f => f.endsWith(".md"))
      .map(f => f.replace(/\.md$/, ""));
    res.json({ tasks });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const running = new Map();

app.post("/api/run", auth, async (req, res) => {
  const { project, task } = req.body || {};
  if (!project || !safeName(project)) return res.status(400).json({ error: "Некорректный проект" });
  if (!task || !/^[\w\-]+$/.test(task)) return res.status(400).json({ error: "Некорректная задача" });

  const projectPath = path.join(PROJECTS_DIR, project);
  if (!(await fs.pathExists(projectPath))) {
    return res.status(404).json({ error: "Проект не найден" });
  }
  const taskPath = path.join(TASKS_DIR, `${task}.md`);
  if (!(await fs.pathExists(taskPath))) {
    return res.status(404).json({ error: "Задача не найдена" });
  }

  const key = `${project}::${task}`;
  if (running.has(key)) {
    return res.status(429).json({ error: "Эта задача уже выполняется" });
  }
  running.set(key, true);

  const child = spawn(process.execPath, ["run-agent.js", project, task], {
    cwd: __dirname,
    env: process.env,
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", d => { stdout += d.toString(); });
  child.stderr.on("data", d => { stderr += d.toString(); });

  child.on("close", code => {
    running.delete(key);
    const resultFile = path.join(projectPath, "results", `${task}.md`);
    const ok = code === 0 && fs.existsSync(resultFile);
    if (ok) {
      res.json({ ok: true, file: `${task}.md`, stdout, stderr });
    } else {
      res.status(500).json({
        error: `Агент завершился с кодом ${code}`,
        stdout,
        stderr,
      });
    }
  });

  child.on("error", err => {
    running.delete(key);
    res.status(500).json({ error: err.message });
  });
});

const pipelineRunning = new Set();

app.post("/api/pipeline", auth, async (req, res) => {
  const { projectName, siteUrl } = req.body || {};
  if (!projectName || !safeName(projectName)) {
    return res.status(400).json({ error: "Некорректное имя проекта" });
  }
  if (!siteUrl || !/^https?:\/\//i.test(siteUrl)) {
    return res.status(400).json({ error: "Некорректный URL (нужен http:// или https://)" });
  }

  const uniqueName = `${projectName}-${Date.now()}`;
  if (pipelineRunning.has(uniqueName)) {
    return res.status(429).json({ error: "Пайплайн уже выполняется" });
  }
  pipelineRunning.add(uniqueName);

  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  req.setTimeout(0);
  res.setTimeout?.(0);

  const send = (obj) => {
    res.write(JSON.stringify(obj) + "\n");
  };

  const runStep = (name, args) => new Promise((resolve) => {
    send({ step: name, status: "running" });
    const child = spawn(process.execPath, args, { cwd: __dirname, env: process.env });
    let stderr = "";
    let stdout = "";
    child.stdout.on("data", d => { stdout += d.toString(); });
    child.stderr.on("data", d => { stderr += d.toString(); });
    child.on("close", code => {
      if (code === 0) {
        send({ step: name, status: "done" });
        resolve(true);
      } else {
        send({ step: name, status: "error", message: (stderr || stdout).slice(-600) || `exit ${code}` });
        resolve(false);
      }
    });
    child.on("error", err => {
      send({ step: name, status: "error", message: err.message });
      resolve(false);
    });
  });

  try {
    send({ projectName: uniqueName });
    if (!(await runStep("create", ["create-project.js", uniqueName]))) {
      send({ done: true, ok: false, projectName: uniqueName });
      return res.end();
    }
    if (!(await runStep("crawl", ["crawl-site.js", uniqueName, siteUrl]))) {
      send({ done: true, ok: false, projectName: uniqueName });
      return res.end();
    }
    const steps = ["audience", "analysis", "campaigns", "ads", "export-direct"];
    for (const step of steps) {
      if (!(await runStep(step, ["run-agent.js", uniqueName, step]))) {
        send({ done: true, ok: false, projectName: uniqueName });
        return res.end();
      }
    }
    send({ done: true, ok: true, projectName: uniqueName });
    res.end();
  } catch (e) {
    send({ done: true, ok: false, message: e.message, projectName: uniqueName });
    res.end();
  } finally {
    pipelineRunning.delete(uniqueName);
  }
});

app.get("/api/projects/:project/export-xlsx", auth, async (req, res) => {
  const { project } = req.params;
  if (!safeName(project)) return res.status(400).json({ error: "Некорректный проект" });

  const filePath = path.join(PROJECTS_DIR, project, "results", "export-direct.md");
  if (!(await fs.pathExists(filePath))) {
    return res.status(404).json({ error: "Файл export-direct.md не найден. Сначала запустите задачу export-direct." });
  }

  const content = await fs.readFile(filePath, "utf-8");
  const match = content.match(/```json\s*([\s\S]*?)```/);
  if (!match) {
    return res.status(400).json({ error: "В export-direct.md не найден блок ```json ... ```" });
  }

  let data;
  try {
    data = JSON.parse(match[1].trim());
  } catch (e) {
    return res.status(400).json({ error: "Ошибка парсинга JSON: " + e.message });
  }
  if (!Array.isArray(data)) {
    return res.status(400).json({ error: "JSON должен быть массивом объектов" });
  }

  const headers = ["Кампания", "Группа", "Ключевая фраза", "Заголовок 1", "Текст объявления", "Ссылка"];
  const rows = [headers, ...data.map(d => [
    d.campaign || "",
    d.group || "",
    d.keyword || "",
    d.title || "",
    d.text || "",
    d.url || "",
  ])];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 32 }, { wch: 32 }, { wch: 32 }, { wch: 40 }, { wch: 60 }, { wch: 40 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Объявления");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const encoded = encodeURIComponent(`${project}-direct.xlsx`);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="direct.xlsx"; filename*=UTF-8''${encoded}`);
  res.send(buffer);
});

app.get("/api/projects/:project/results/:file", auth, async (req, res) => {
  const { project, file } = req.params;
  if (!safeName(project) || file.includes("..") || file.includes("/") || file.includes("\\")) {
    return res.status(400).json({ error: "Некорректный путь" });
  }
  const filePath = path.join(PROJECTS_DIR, project, "results", file);
  if (!(await fs.pathExists(filePath))) {
    return res.status(404).json({ error: "Файл не найден" });
  }
  if (file.endsWith(".xlsx")) {
    return res.download(filePath);
  }
  const content = await fs.readFile(filePath, "utf-8");
  res.type("text/plain; charset=utf-8").send(content);
});

app.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
});
