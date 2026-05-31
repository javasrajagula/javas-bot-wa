import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';

export interface GameAnswerHandler {
  canHandle(ctx: MessageContext): Promise<boolean>;
  handleAnswer(ctx: MessageContext, adapter: WhatsAppAdapter): Promise<boolean>;
}

class GameSessionService {
  private handlers: GameAnswerHandler[] = [];

  public registerHandler(handler: GameAnswerHandler) {
    this.handlers.push(handler);
  }

  public async handleMessage(ctx: MessageContext, adapter: WhatsAppAdapter): Promise<boolean> {
    for (const handler of this.handlers) {
      try {
        if (await handler.canHandle(ctx)) {
          const handled = await handler.handleAnswer(ctx, adapter);
          if (handled) return true;
        }
      } catch (err) {
        console.error('[Game Session Service] Error in handler:', err);
      }
    }
    return false;
  }
}

export const gameSessionService = new GameSessionService();
export default gameSessionService;
