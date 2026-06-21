import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
if (!fs.existsSync(schemaPath)) {
  console.error('schema.prisma not found at:', schemaPath);
  process.exit(1);
}

let provider = process.env.DATABASE_PROVIDER || 'sqlite';
const databaseUrl = process.env.DATABASE_URL || '';

// Fallback detection from URL
if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
  provider = 'postgresql';
} else if (databaseUrl.startsWith('mysql://')) {
  provider = 'mysql';
}

console.log(`[Prisma Prep] Setting database provider to: ${provider}`);

let content = fs.readFileSync(schemaPath, 'utf-8');
let lines = content.split(/\r?\n/);
let insideDb = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (line.startsWith('datasource db')) {
    insideDb = true;
  }
  if (insideDb && line.startsWith('provider')) {
    lines[i] = lines[i].replace(/"[^"]+"/, `"${provider}"`);
    insideDb = false; // exit
    break;
  }
}

fs.writeFileSync(schemaPath, lines.join('\n'), 'utf-8');
console.log('[Prisma Prep] schema.prisma updated successfully.');
