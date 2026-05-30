import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import { checkIfAdmin } from '../index.js';
import { localizerService, LanguageCode, PersonaType } from '../../services/system/localizer.service.js';
import prisma from '../../db/client.js';

export class LocaleCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (!ctx.isGroup) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya dapat digunakan di dalam grup.', { quotedMessageId: ctx.id });
      return;
    }

    const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
    if (!isAdmin) {
      const currentLocale = await localizerService.getGroupLocale(ctx.chatId);
      const errText = localizerService.format('admin_only', currentLocale);
      await adapter.sendMessage(ctx.chatId, errText, { quotedMessageId: ctx.id });
      return;
    }

    const commandType = ctx.body.trim().split(/\s+/)[0].slice(1).toLowerCase();

    // Fetch current config
    let config = await prisma.groupConfig.findUnique({
      where: { groupId: ctx.chatId }
    });

    const features = config ? JSON.parse(config.featuresJson || '{}') : {};

    // 1. /setlang [id|en|jawa|sunda]
    if (commandType === 'setlang') {
      const lang = args[0]?.trim().toLowerCase();
      const validLangs = ['id', 'en', 'jawa', 'sunda'];

      if (!lang || !validLangs.includes(lang)) {
        await adapter.sendMessage(
          ctx.chatId,
          `⚠️ Format salah.\nGunakan: \`/setlang [id|en|jawa|sunda]\`\nContoh: \`/setlang jawa\``,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      features.language = lang;

      await prisma.groupConfig.update({
        where: { groupId: ctx.chatId },
        data: { featuresJson: JSON.stringify(features) }
      });

      const newLocale = { language: lang as LanguageCode, persona: (features.persona || 'formal') as PersonaType };
      
      const successTexts: Record<LanguageCode, string> = {
        id: '✅ Bahasa grup berhasil diubah menjadi *Bahasa Indonesia*.',
        en: '✅ Group language successfully changed to *English*.',
        jawa: '✅ Basa grup sampun kasil diubah dados *Basa Jawa*.',
        sunda: '✅ Basa grup parantos hasil dirobih janten *Basa Sunda*.'
      };

      await adapter.sendMessage(ctx.chatId, successTexts[lang as LanguageCode], { quotedMessageId: ctx.id });
      return;
    }

    // 2. /setpersona [formal|santai|lucu|islami|sekolah]
    if (commandType === 'setpersona') {
      const persona = args[0]?.trim().toLowerCase();
      const validPersonas = ['formal', 'santai', 'lucu', 'islami', 'sekolah'];

      if (!persona || !validPersonas.includes(persona)) {
        await adapter.sendMessage(
          ctx.chatId,
          `⚠️ Format salah.\nGunakan: \`/setpersona [formal|santai|lucu|islami|sekolah]\`\nContoh: \`/setpersona santai\``,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      features.persona = persona;

      await prisma.groupConfig.update({
        where: { groupId: ctx.chatId },
        data: { featuresJson: JSON.stringify(features) }
      });

      const lang = (features.language || 'id') as LanguageCode;

      const successTexts: Record<PersonaType, Record<LanguageCode, string>> = {
        formal: {
          id: '✅ Gaya bahasa bot berhasil diubah menjadi *Formal*. Bot akan merespon Anda secara sopan dan terstruktur.',
          en: '✅ Bot persona successfully changed to *Formal*. The bot will respond politely and structured.',
          jawa: '✅ Gaya basa bot sampun diubah dados *Formal*. Matur nuwun sanget.',
          sunda: '✅ Gaya basa bot parantos dirobih janten *Formal*. Hatur nuhun pisan.'
        },
        santai: {
          id: '✅ Gaya bahasa bot diubah janten *Santai*. Halo bro/sist, sekarang kita bisa ngobrol asik!',
          en: '✅ Bot persona changed to *Casual*. Hey guys, let\'s chat casually!',
          jawa: '✅ Gaya basa bot diubah dados *Santai*. Piye kabare lur? Monggo disambi.',
          sunda: '✅ Gaya basa bot dirobih janten *Santai*. Kumaha daramang lur? Hayu ngawangkong!'
        },
        lucu: {
          id: '✅ Gaya bahasa bot diubah jadi *Lucu*. Wkwkwk siap menghibur warga dengan jokes garing! 🤪',
          en: '✅ Bot persona changed to *Funny*. Lol prepare yourself for some corny jokes! 🤪',
          jawa: '✅ Gaya basa bot diubah dados *Lucu*. Wkwk ngguyu dhisik lur sing penting happy! 🤪',
          sunda: '✅ Gaya basa bot dirobih janten *Lucu*. Wkwk seuri heula euy ngarah awet ngora! 🤪'
        },
        islami: {
          id: '✅ Gaya bahasa bot berhasil diubah menjadi *Islami*. Semoga ukhuwah kita dirahmati Allah. Jazakallah Khair.',
          en: '✅ Bot persona changed to *Islamic*. May Allah bless our brotherhood. Jazakallah Khair.',
          jawa: '✅ Gaya basa bot diubah dados *Islami*. Mugi angsal berkah saking Gusti Allah. Jazakallah Khair.',
          sunda: '✅ Gaya basa bot dirobih janten *Islami*. Mugia barokah kanggo urang sadaya. Jazakallah Khair.'
        },
        sekolah: {
          id: '✅ Gaya bahasa bot berhasil diubah menjadi *Sekolah*. Mari kita mulai belajar dengan fokus dan tertib!',
          en: '✅ Bot persona changed to *School*. Let\'s begin studying with focus and discipline!',
          jawa: '✅ Gaya basa bot diubah dados *Sekolah*. Monggo sinau bareng kanthi tertib nggih.',
          sunda: '✅ Gaya basa bot dirobih janten *Sekolah*. Hayu urang diajar sasarengan kalayan tertib.'
        }
      };

      await adapter.sendMessage(ctx.chatId, successTexts[persona as PersonaType][lang] || successTexts[persona as PersonaType]['id'], { quotedMessageId: ctx.id });
      return;
    }
  }
}

// Register commands
const localeCmd = new LocaleCommand();
registerCommand(['setlang', 'setpersona'], localeCmd);
