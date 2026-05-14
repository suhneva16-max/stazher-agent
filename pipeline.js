import fs from "fs-extra";
import { execSync } from "child_process";

const projectName = process.argv[2];

if (!projectName) {
  console.log("Укажи проект");
  process.exit();
}

const pipelinePath = `./projects/${projectName}/pipeline.json`;

if (!fs.existsSync(pipelinePath)) {
  console.log("pipeline.json не найден");
  process.exit();
}

const pipeline = JSON.parse(
  fs.readFileSync(pipelinePath, "utf-8")
);

for (const step of pipeline) {
  const contextArgs = step.context.join(" ");

  const command = `node run-agent.js ${projectName} ${step.task} ${contextArgs}`;

  console.log(`
Запуск:
${command}
`);

  try {
    execSync(command, {
      stdio: "inherit",
    });
  } catch (error) {
    console.log(`
Ошибка pipeline
`);
    console.log(error);
    break;
  }
}

console.log(`
Pipeline завершен
`);