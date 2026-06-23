import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import { PRD_CATALOG } from './prd-feature-catalog.js';

export class PRDScaffoldCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const commandName = ctx.command?.commandName?.toLowerCase() || '';

    if (!commandName) return;

    const entry = PRD_CATALOG.find(e => e.name.toLowerCase() === commandName || e.aliases.map(a => a.toLowerCase()).includes(commandName));
    if (!entry) return;

    await adapter.sendMessage(
      ctx.chatId,
      `⚠️ Fitur *[${entry.id}] ${entry.name}* (awaiting full implementation) telah terdaftar.\n\n` +
      `📝 *Deskripsi:* ${entry.description}\n` +
      `💡 *Cara pakai:* \`${entry.usage}\`\n\n` +
      `Fitur ini sedang dalam pengembangan dan akan aktif penuh setelah Batch terkait diimplementasikan.`,
      { quotedMessageId: ctx.id }
    );
  }
}

const EXCLUDED_SCAFFOLD_IDS = new Set([
  'F001', 'F002', 'F003', 'F004', 'F005', 'F006', 'F007', 'F008', 'F009', 'F010',
  'F011', 'F012', 'F013', 'F014', 'F015', 'F016', 'F017', 'F018', 'F019', 'F020',
  'F021', 'F022', 'F023', 'F024', 'F025', 'F026', 'F027', 'F028', 'F029', 'F030',
  'F031', 'F038', 'F039', 'F040', 'F041', 'F042', 'F043',
  'F045', 'F047', 'F048', 'F094', 'F100', 'F113'
]);

const scaffold = new PRDScaffoldCommand();

for (const entry of PRD_CATALOG) {
  if (EXCLUDED_SCAFFOLD_IDS.has(entry.id)) continue;
  if (entry.id.startsWith('G')) continue; // Skip all games, handled by prd-games.command
  const names = [entry.name, ...entry.aliases];
  registerCommand(names, scaffold);
}
