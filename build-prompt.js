import fs from "fs-extra";

const projectName = process.argv[2];

if (!projectName) {
  console.log("Укажи название проекта");
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

const finalPrompt = `
# СИСТЕМНАЯ РОЛЬ

${systemPrompt}

---

# ЗАДАЧА ПОЛЬЗОВАТЕЛЯ

${taskPrompt}

---

# ФОРМАТ ОТВЕТА

Дай структурированный ответ:

1. Сегменты целевой аудитории
2. Боли и возражения
3. Драйверы покупки
4. Структура поисковой кампании
5. Идеи объявлений
6. Что нужно уточнить перед запуском рекламы
`;

fs.ensureDirSync("./exports");

fs.writeFileSync(
  `./exports/${projectName}-prompt.md`,
  finalPrompt,
  "utf-8"
);

console.log(
  `Готовый промпт создан: exports/${projectName}-prompt.md`
);