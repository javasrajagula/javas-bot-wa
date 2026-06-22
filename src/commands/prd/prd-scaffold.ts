import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import { PRD_CATALOG } from './prd-feature-catalog.js';

export class PRDScaffoldCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const commandName = ctx.command?.commandName?.toLowerCase() || '';

    if (!commandName) return;

    await adapter.sendMessage(
      ctx.chatId,
      `⚠️ Fitur /${commandName} (coming soon / scaffold ready) sedang dalam pengembangan.`,
      { quotedMessageId: ctx.id }
    );
  }
}

const EXCLUDED_SCAFFOLD_IDS = new Set([
  'F007', 'F022', 'F029', 'F031', 'F038', 'F039', 'F040', 'F041', 'F042', 'F043', 'F045', 'F047', 'F048', 'F094', 'F100', 'F113'
]);

const scaffold = new PRDScaffoldCommand();

for (const entry of PRD_CATALOG) {
  if (EXCLUDED_SCAFFOLD_IDS.has(entry.id)) continue;
  const names = [entry.name, ...entry.aliases];
  registerCommand(names, scaffold);
}
