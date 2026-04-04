import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  const nameArgIndex = argv.findIndex((token) => token === "--name");
  if (nameArgIndex === -1 || nameArgIndex === argv.length - 1) {
    throw new Error("Missing required --name argument (example: --name my-plugin)");
  }
  return argv[nameArgIndex + 1];
}

function sanitizePluginName(rawName) {
  const normalized = rawName.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(normalized)) {
    throw new Error("Plugin name must contain lowercase letters, numbers, and dashes only.");
  }
  return normalized;
}

function toTitleCase(name) {
  return name
    .split("-")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function toPascalCase(name) {
  return name
    .split("-")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

async function main() {
  const pluginName = sanitizePluginName(parseArgs(process.argv.slice(2)));
  const root = process.cwd();
  const templateRoot = path.join(root, "templates", "plugin-app");
  const targetRoot = path.join(root, "apps", pluginName);

  await mkdir(path.join(targetRoot, "src"), { recursive: true });

  const replacements = {
    "__PLUGIN_NAME__": pluginName,
    "__PLUGIN_TITLE__": toTitleCase(pluginName),
    "__PLUGIN_COMPONENT__": `${toPascalCase(pluginName)}View`,
  };

  const files = [
    ["package.json.template", "package.json"],
    ["tsconfig.json.template", "tsconfig.json"],
    ["README.md.template", "README.md"],
    [path.join("src", "index.ts.template"), path.join("src", "index.ts")],
  ];

  for (const [templateRelative, targetRelative] of files) {
    const templatePath = path.join(templateRoot, templateRelative);
    const targetPath = path.join(targetRoot, targetRelative);
    let content = await readFile(templatePath, "utf8");
    for (const [key, value] of Object.entries(replacements)) {
      content = content.replaceAll(key, value);
    }
    await writeFile(targetPath, content, "utf8");
  }

  console.log(`Scaffolded plugin app at apps/${pluginName}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
