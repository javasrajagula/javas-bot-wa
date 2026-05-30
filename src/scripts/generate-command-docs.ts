import fs from 'fs';
import path from 'path';
import { COMMAND_METADATA_LIST } from '../commands/registry/command-metadata.js';

const docsDir = path.join(process.cwd(), 'docs');
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

const grouped = new Map<string, typeof COMMAND_METADATA_LIST>();
for (const command of COMMAND_METADATA_LIST) {
  const list = grouped.get(command.category) || [];
  list.push(command);
  grouped.set(command.category, list);
}

let markdown = `# Command Reference\n\nGenerated from \`src/commands/registry/command-metadata.ts\`.\n\n`;
for (const [category, commands] of [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  markdown += `## ${category}\n\n`;
  markdown += `| Command | Aliases | Role | Usage | Description |\n`;
  markdown += `| --- | --- | --- | --- | --- |\n`;
  for (const command of commands.sort((a, b) => a.name.localeCompare(b.name))) {
    markdown += `| \`${command.name}\` | ${command.aliases.map(alias => `\`${alias}\``).join(', ') || '-'} | ${command.minRole || 'user'} | \`${command.usage}\` | ${command.description} |\n`;
  }
  markdown += '\n';
}

fs.writeFileSync(path.join(docsDir, 'commands.md'), markdown, 'utf-8');
console.log('Generated docs/commands.md');
