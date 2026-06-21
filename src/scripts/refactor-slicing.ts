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

  const pattern1 = /ctx\.body\.trim\(\)\.split\(\/\\s\+\/\)\[0\]\.slice\(1\)\.toLowerCase\(\)/g;
  const pattern2 = /ctx\.body\.trim\(\)\.split\(\/\\s\+\/\)\[0\]\.slice\(1\)/g;

  if (pattern1.test(content)) {
    content = content.replace(pattern1, "ctx.command?.commandName || ''");
    changed = true;
  }
  if (pattern2.test(content)) {
    content = content.replace(pattern2, "ctx.command?.commandName || ''");
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log('[Refactor] Updated:', filePath);
  }
});
