import { readdir, readFile, stat } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const skillsRoot = dirname(fileURLToPath(import.meta.url));
const entries = await readdir(skillsRoot, { withFileTypes: true });
const results = [];

for (const entry of entries.filter((item) => item.isDirectory())) {
  const root = resolve(skillsRoot, entry.name);
  const skillFile = resolve(root, "SKILL.md");
  const source = await readFile(skillFile, "utf8");
  const frontmatter = source.match(/^---\n([\s\S]*?)\n---\n/);
  if (!frontmatter) throw new Error(`${entry.name}: frontmatter mancante`);
  const name = frontmatter[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = frontmatter[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
  if (name !== entry.name) throw new Error(`${entry.name}: name non coincide con la cartella`);
  if (!description || description.length < 30) throw new Error(`${entry.name}: description non valida`);

  const links = [...source.matchAll(/\]\(([^)]+)\)/g)]
    .map((match) => match[1])
    .filter((link) => !/^[a-z]+:/i.test(link) && !link.startsWith("#"));
  for (const link of links) {
    const target = resolve(root, link);
    if (!(await stat(target)).isFile()) throw new Error(`${entry.name}: riferimento non valido ${link}`);
  }
  results.push({ name, description, skillFile, referencesChecked: links.length });
}

if (!results.length) throw new Error("Nessuna skill trovata");
console.log(JSON.stringify({ ok: true, skills: results }, null, 2));
