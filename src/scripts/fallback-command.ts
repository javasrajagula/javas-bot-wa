import fs from 'fs';
import path from 'path';

function walkDir(dir: string, callback: (filePath: string) => void) {
  fs.readdirSync(dir).forEach((f) => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      callback(dirPath);
    }
  });
}

const commandsDir = path.join(process.cwd(), 'src', 'commands');
walkDir(commandsDir, (filePath) => {
  if (!filePath.endsWith('.ts')) return;
  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;

  // We want to replace "ctx.command?.commandName || ''" or 'ctx.command?.commandName || ""'
  // with a fallback that parses the command from ctx.body if ctx.command is undefined.
  const fallbackStr = "ctx.command?.commandName || ctx.body.trim().split(/\\s+/)[0].replace(/^[^\\w\\s]+/, '').toLowerCase()";

  const pattern1 = /ctx\.command\?\.commandName\s*\|\|\s*['"]/g;
  
  if (pattern1.test(content)) {
    // Specifically target the full assignment "ctx.command?.commandName || ''" or '""'
    content = content.replace(/ctx\.command\?\.commandName\s*\|\|\s*['"]['"]/g, fallbackStr);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log('[Refactor Fallback] Updated:', filePath);
  }
});
