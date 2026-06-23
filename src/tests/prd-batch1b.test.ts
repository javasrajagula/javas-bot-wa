import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import prisma from '../db/client.js';
import { SetupCommand, handleWizardInput, wizardSessions } from '../commands/setup.command.js';
import { FeatureCommand } from '../commands/feature.command.js';
import { commandRegistry } from '../commands/registry/command-registry.js';
import { parseFeatureFlags, getGroupFeatures } from '../config/feature-flags.js';

describe('PRD Batch 1B — Group Configurations and Feature Toggle Admin Presets', () => {
  const groupId = 'test-group-batch1b@g.us';
  const userId = '628111111111@s.whatsapp.net';

  let mockAdapter: any;
  let sentMessages: { chatId: string; text: string; options?: any }[] = [];

  beforeAll(async () => {
    // Import target modules statically to ensure registry initialization in Vitest
    await import('../commands/setup.command.js');
    await import('../commands/feature.command.js');

    await prisma.groupConfig.deleteMany({ where: { groupId } });
    await prisma.customVariable.deleteMany({ where: { groupId } });

    mockAdapter = {
      sock: {
        groupMetadata: async () => {
          return {
            id: groupId,
            participants: [
              { id: userId, admin: 'admin' }
            ]
          };
        }
      },
      sendMessage: async (chatId: string, text: string, options?: any) => {
        sentMessages.push({ chatId, text, options });
        return { key: { id: 'mock-msg-' + Math.random() } };
      }
    };
  });

  afterAll(async () => {
    await prisma.groupConfig.deleteMany({ where: { groupId } });
    await prisma.customVariable.deleteMany({ where: { groupId } });
  });

  const getCtx = (cmdName: string, body: string): any => ({
    id: `msg-${Math.random()}`,
    chatId: groupId,
    senderId: userId,
    body,
    isGroup: true,
    command: {
      prefix: '/',
      rawCommandName: cmdName,
      commandName: cmdName,
      args: body.split(/\s+/).slice(1),
      isCommand: true
    }
  });

  it('verifies setupwizard metadata has transitioned to implemented', async () => {
    const cmd = await commandRegistry.get('setupwizard');
    expect(cmd).toBeDefined();
    expect(cmd?.metadata.featureFlag).toBe('prd_admin_ops');
  });

  it('verifies that applying F022 presets updates the features config and groupMode variable correctly', async () => {
    const setupCmd = new SetupCommand();

    // 1. Test "aman" preset (security focused)
    sentMessages = [];
    const ctxAman = getCtx('presetfitur', '/presetfitur aman');
    await setupCmd.execute(ctxAman, ctxAman.command.args, mockAdapter);

    expect(sentMessages[0].text).toContain('Pack AMAN Berhasil Diterapkan');
    
    // Check config in database
    const configAman = await prisma.groupConfig.findUnique({ where: { groupId } });
    const featuresAman = parseFeatureFlags(configAman?.featuresJson || '{}');
    expect(featuresAman.antilink).toBe(true);
    expect(featuresAman.antispam).toBe(true);
    expect(featuresAman.captcha).toBe(true);
    expect(featuresAman.antiraid).toBe(true);

    const modeAman = await prisma.customVariable.findUnique({
      where: { groupId_userId_key: { groupId, userId: 'system', key: 'groupMode' } }
    });
    expect(modeAman?.value).toBe('aman');

    // 2. Test "ramai" preset (engagement focused)
    sentMessages = [];
    const ctxRamai = getCtx('presetfitur', '/presetfitur ramai');
    await setupCmd.execute(ctxRamai, ctxRamai.command.args, mockAdapter);

    expect(sentMessages[0].text).toContain('Pack RAMAI Berhasil Diterapkan');
    const configRamai = await prisma.groupConfig.findUnique({ where: { groupId } });
    const featuresRamai = parseFeatureFlags(configRamai?.featuresJson || '{}');
    expect(featuresRamai.leveling).toBe(true);
    expect(featuresRamai.miniGames).toBe(true);
    expect(featuresRamai.prd_games).toBe(true);

    const modeRamai = await prisma.customVariable.findUnique({
      where: { groupId_userId_key: { groupId, userId: 'system', key: 'groupMode' } }
    });
    expect(modeRamai?.value).toBe('ramai');

    // 3. Test "ringan" preset (minimalist focus)
    sentMessages = [];
    const ctxRingan = getCtx('presetfitur', '/presetfitur ringan');
    await setupCmd.execute(ctxRingan, ctxRingan.command.args, mockAdapter);

    expect(sentMessages[0].text).toContain('Pack RINGAN Berhasil Diterapkan');
    const configRingan = await prisma.groupConfig.findUnique({ where: { groupId } });
    const featuresRingan = parseFeatureFlags(configRingan?.featuresJson || '{}');
    expect(featuresRingan.leveling).toBe(false);
    expect(featuresRingan.miniGames).toBe(false);
    expect(featuresRingan.werewolf).toBe(false);
  });

  it('verifies that applying F021 onboarding presets updates settings correctly', async () => {
    const setupCmd = new SetupCommand();

    sentMessages = [];
    const ctxSekolah = getCtx('presetfitur', '/presetfitur sekolah');
    await setupCmd.execute(ctxSekolah, ctxSekolah.command.args, mockAdapter);

    expect(sentMessages[0].text).toContain('Pack SEKOLAH Berhasil Diterapkan');
    const configSekolah = await prisma.groupConfig.findUnique({ where: { groupId } });
    const featuresSekolah = parseFeatureFlags(configSekolah?.featuresJson || '{}');
    expect(featuresSekolah.attendance).toBe(true);
    expect(featuresSekolah.reminder).toBe(true);

    const modeSekolah = await prisma.customVariable.findUnique({
      where: { groupId_userId_key: { groupId, userId: 'system', key: 'groupMode' } }
    });
    expect(modeSekolah?.value).toBe('sekolah');
  });

  it('returns a comprehensive help list when pack name is invalid', async () => {
    const setupCmd = new SetupCommand();

    sentMessages = [];
    const ctxInvalid = getCtx('presetfitur', '/presetfitur invalidpack');
    await setupCmd.execute(ctxInvalid, ctxInvalid.command.args, mockAdapter);

    expect(sentMessages[0].text).toContain('Pack/preset tidak ditemukan');
    expect(sentMessages[0].text).toContain('Preset Fitur Grup (F022)');
    expect(sentMessages[0].text).toContain('Onboarding Wizard Presets (F021)');
    expect(sentMessages[0].text).toContain('aman');
    expect(sentMessages[0].text).toContain('sekolah');
  });

  it('runs interactive setupwizard steps and saves config at the end', async () => {
    const setupCmd = new SetupCommand();

    // Start wizard
    sentMessages = [];
    const ctxStart = getCtx('setupwizard', '/setupwizard');
    await setupCmd.execute(ctxStart, ctxStart.command.args, mockAdapter);

    expect(sentMessages[0].text).toContain('Javas Bot WA — Setup Wizard');
    expect(sentMessages[0].text).toContain('Langkah 1/10: Welcome Message');

    const session = wizardSessions.get(groupId);
    expect(session).toBeDefined();
    expect(session?.step).toBe(1);

    // Run through steps
    const stepInputs = [
      'y', // step 1 -> step 2 (goodbye)
      'n', // step 2 -> step 3 (antilink)
      'y', // step 3 -> step 4 (antispam)
      'y', // step 4 -> step 5 (badword)
      'n', // step 5 -> step 6 (captcha)
      'y', // step 6 -> step 7 (prefix)
      '!', // step 7 -> step 8 (punishment mode)
      'warn', // step 8 -> step 9 (group mode)
      'komunitas', // step 9 -> step 10 (confirmation)
      'y' // step 10 -> save config & delete session
    ];

    for (let i = 0; i < stepInputs.length; i++) {
      sentMessages = [];
      const ctxInput = getCtx('', stepInputs[i]);
      const handled = await handleWizardInput(ctxInput, mockAdapter);
      expect(handled).toBe(true);

      if (i < stepInputs.length - 1) {
        expect(wizardSessions.get(groupId)).toBeDefined();
      } else {
        expect(wizardSessions.get(groupId)).toBeUndefined();
      }
    }

    // Verify database saved values
    const finalConfig = await prisma.groupConfig.findUnique({ where: { groupId } });
    expect(finalConfig?.prefix).toBe('!');
    
    const finalFeatures = parseFeatureFlags(finalConfig?.featuresJson || '{}');
    expect(finalFeatures.welcome).toBe(true);
    expect(finalFeatures.goodbye).toBe(false);
    expect(finalFeatures.antilink).toBe(true);
    expect(finalFeatures.antispam).toBe(true);
    expect(finalFeatures.badword).toBe(false);
    expect(finalFeatures.captcha).toBe(true);
    expect(finalFeatures.antilinkMode).toBe('warn');
    expect(finalFeatures.antispamMode).toBe('warn');

    const finalMode = await prisma.customVariable.findUnique({
      where: { groupId_userId_key: { groupId, userId: 'system', key: 'groupMode' } }
    });
    expect(finalMode?.value).toBe('komunitas');
  });

  it('verifies that feature toggles work properly via /feature command', async () => {
    const featCmd = new FeatureCommand();

    // 1. Toggle prd_moderation to OFF
    sentMessages = [];
    const ctxOff = getCtx('feature', '/feature prd_moderation off');
    await featCmd.execute(ctxOff, ctxOff.command.args, mockAdapter);

    expect(sentMessages[0].text).toContain('prd_moderation');
    expect(sentMessages[0].text).toContain('OFF');

    const configOff = await prisma.groupConfig.findUnique({ where: { groupId } });
    const featuresOff = parseFeatureFlags(configOff?.featuresJson || '{}');
    expect(featuresOff.prd_moderation).toBe(false);

    // 2. Toggle prd_moderation back to ON
    sentMessages = [];
    const ctxOn = getCtx('feature', '/feature prd_moderation on');
    await featCmd.execute(ctxOn, ctxOn.command.args, mockAdapter);

    expect(sentMessages[0].text).toContain('prd_moderation');
    expect(sentMessages[0].text).toContain('ON');

    const configOn = await prisma.groupConfig.findUnique({ where: { groupId } });
    const featuresOn = parseFeatureFlags(configOn?.featuresJson || '{}');
    expect(featuresOn.prd_moderation).toBe(true);
  });
});
