import prisma from './db/client.js';
import readline from 'readline';
import { hdQueue, downloaderQueue, generalQueue } from './queues/queue.js';
import { pluginManager } from './config/plugins.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

function clearConsole() {
  console.clear();
}

async function showHeader() {
  console.log('\x1b[36m====================================================\x1b[0m');
  console.log('\x1b[1m\x1b[35m         JAVAS BOT WA - ADMIN CLI DASHBOARD         \x1b[0m');
  console.log('\x1b[36m====================================================\x1b[0m');
}

async function listGroups() {
  clearConsole();
  await showHeader();
  console.log('\x1b[33m🏢 LIST GRUP WA TERDAFTAR:\x1b[0m\n');

  try {
    const groups = await prisma.groupConfig.findMany();
    if (groups.length === 0) {
      console.log('Belum ada grup terdaftar.');
    } else {
      groups.forEach((g, idx) => {
        const features = JSON.parse(g.featuresJson || '{}');
        const activeFeaturesCount = Object.values(features).filter(v => v === true).length;
        console.log(`[${idx + 1}] ID: ${g.groupId}`);
        console.log(`    Bot Active: ${g.botEnabled ? '🟢 YES' : '🔴 NO'} | Prefix: "${g.prefix}"`);
        console.log(`    Fitur Aktif: ${activeFeaturesCount} fitur`);
      });
    }
  } catch (err: any) {
    console.error('Gagal mengambil data grup:', err.message);
  }

  await askQuestion('\nTekan ENTER untuk kembali ke Menu Utama...');
}

async function toggleGroupFeature() {
  clearConsole();
  await showHeader();
  console.log('\x1b[33m🔄 TOGGLE FITUR GRUP:\x1b[0m\n');

  try {
    const groups = await prisma.groupConfig.findMany();
    if (groups.length === 0) {
      console.log('Tidak ada grup terdaftar.');
      await askQuestion('\nTekan ENTER untuk kembali...');
      return;
    }

    groups.forEach((g, idx) => {
      console.log(`[${idx + 1}] ID: ${g.groupId}`);
    });

    const choiceIdx = parseInt(await askQuestion('\nPilih nomor grup: '), 10) - 1;
    if (isNaN(choiceIdx) || choiceIdx < 0 || choiceIdx >= groups.length) {
      console.log('Pilihan tidak valid.');
      await askQuestion('\nTekan ENTER untuk kembali...');
      return;
    }

    const selectedGroup = groups[choiceIdx];
    const features = JSON.parse(selectedGroup.featuresJson || '{}');

    console.log(`\nFitur di grup ${selectedGroup.groupId}:`);
    const featureKeys = Object.keys(features);
    featureKeys.forEach((key, idx) => {
      console.log(`[${idx + 1}] ${key}: ${features[key] ? '🟢 ON' : '🔴 OFF'}`);
    });

    const featIdx = parseInt(await askQuestion('\nPilih nomor fitur untuk di-toggle: '), 10) - 1;
    if (isNaN(featIdx) || featIdx < 0 || featIdx >= featureKeys.length) {
      console.log('Pilihan tidak valid.');
      await askQuestion('\nTekan ENTER untuk kembali...');
      return;
    }

    const targetFeature = featureKeys[featIdx];
    features[targetFeature] = !features[targetFeature];

    await prisma.groupConfig.update({
      where: { id: selectedGroup.id },
      data: { featuresJson: JSON.stringify(features) }
    });

    console.log(`\n✅ Fitur "${targetFeature}" berhasil di-toggle menjadi: ${features[targetFeature] ? '🟢 ON' : '🔴 OFF'}`);
  } catch (err: any) {
    console.error('Error toggling feature:', err.message);
  }

  await askQuestion('\nTekan ENTER untuk kembali...');
}

async function viewUsageStats() {
  clearConsole();
  await showHeader();
  console.log('\x1b[33m📈 STATISTIK PENGGUNAAN:\x1b[0m\n');

  try {
    const totalUsers = await prisma.userProfile.count();
    const totalCommands = await prisma.usageLog.count();

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const commandsToday = await prisma.usageLog.count({
      where: { createdAt: { gte: startOfToday } }
    });

    const logsToday = await prisma.usageLog.findMany({
      where: { createdAt: { gte: startOfToday } },
      select: { feature: true }
    });

    const counts: Record<string, number> = {};
    for (const log of logsToday) {
      counts[log.feature] = (counts[log.feature] || 0) + 1;
    }
    const sortedFeatures = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    console.log(`👥 Total User: ${totalUsers}`);
    console.log(`⚡ Total Eksekusi Command: ${totalCommands}`);
    console.log(`📊 Command Hari Ini: ${commandsToday}`);
    console.log('\n🔥 Fitur Populer Hari Ini:');
    if (sortedFeatures.length === 0) {
      console.log('  Belum ada data.');
    } else {
      sortedFeatures.forEach(([feat, count], idx) => {
        console.log(`  ${idx + 1}. ${feat}: ${count} kali`);
      });
    }
  } catch (err: any) {
    console.error('Error fetching stats:', err.message);
  }

  await askQuestion('\nTekan ENTER untuk kembali...');
}

async function viewPremiumUsers() {
  clearConsole();
  await showHeader();
  console.log('\x1b[33m⚡ PREMIUM USERS:\x1b[0m\n');

  try {
    const premiums = await prisma.premiumUser.findMany();
    if (premiums.length === 0) {
      console.log('Tidak ada premium user terdaftar.');
    } else {
      const now = new Date();
      premiums.forEach((p, idx) => {
        const isExpired = new Date(p.expiresAt) < now;
        console.log(`[${idx + 1}] ID: ${p.userId}`);
        console.log(`    Expires At: ${new Date(p.expiresAt).toLocaleString()}`);
        console.log(`    Status: ${isExpired ? '🔴 EXPIRED' : '🟢 ACTIVE'}`);
      });
    }
  } catch (err: any) {
    console.error('Error fetching premiums:', err.message);
  }

  await askQuestion('\nTekan ENTER untuk kembali...');
}

async function viewWarningLog() {
  clearConsole();
  await showHeader();
  console.log('\x1b[33m⚠️ WARNING LOG:\x1b[0m\n');

  try {
    const warnings = await prisma.warning.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    if (warnings.length === 0) {
      console.log('Belum ada log warning.');
    } else {
      warnings.forEach((w, idx) => {
        console.log(`[${idx + 1}] Group: ${w.groupId} | User: ${w.userId}`);
        console.log(`    Reason: ${w.reason || 'No reason specified'}`);
        console.log(`    Warned By: ${w.warnedBy || 'System'} | ${new Date(w.createdAt).toLocaleString()}`);
      });
    }
  } catch (err: any) {
    console.error('Error fetching warnings:', err.message);
  }

  await askQuestion('\nTekan ENTER untuk kembali...');
}

async function viewQueueStatus() {
  clearConsole();
  await showHeader();
  console.log('\x1b[33m📥 QUEUE STATUS:\x1b[0m\n');

  console.log(`• HD Enhancement Queue Size: ${hdQueue.getLength()}`);
  console.log(`• Downloader Queue Size: ${downloaderQueue.getLength()}`);
  console.log(`• General Queue Size: ${generalQueue.getLength()}`);

  await askQuestion('\nTekan ENTER untuk kembali...');
}

async function viewErrorLogs() {
  clearConsole();
  await showHeader();
  console.log('\x1b[33m🔴 ERROR LOG:\x1b[0m\n');

  try {
    const errors = await prisma.errorLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    if (errors.length === 0) {
      console.log('Tidak ada error tercatat.');
    } else {
      errors.forEach((e, idx) => {
        console.log(`[${idx + 1}] [${new Date(e.createdAt).toLocaleString()}] [Scope: ${e.scope || 'N/A'}] [Feature: ${e.feature || 'N/A'}]`);
        console.log(`    Message: ${e.message}`);
        if (e.stack) {
          console.log(`    Stack: ${e.stack.split('\n')[0]}`);
        }
      });
    }
  } catch (err: any) {
    console.error('Error fetching error logs:', err.message);
  }

  await askQuestion('\nTekan ENTER untuk kembali...');
}

async function mainMenu() {
  while (true) {
    clearConsole();
    await showHeader();
    console.log('Silakan pilih menu:');
    console.log('1. Lihat Daftar Grup');
    console.log('2. Toggle Fitur Grup');
    console.log('3. Lihat Statistik Penggunaan');
    console.log('4. Lihat Premium Users');
    console.log('5. Lihat Warning Log');
    console.log('6. Lihat Status Queue');
    console.log('7. Lihat Error Log');
    console.log('8. Keluar');

    const choice = (await askQuestion('\nMasukkan pilihan (1-8): ')).trim();

    if (choice === '1') await listGroups();
    else if (choice === '2') await toggleGroupFeature();
    else if (choice === '3') await viewUsageStats();
    else if (choice === '4') await viewPremiumUsers();
    else if (choice === '5') await viewWarningLog();
    else if (choice === '6') await viewQueueStatus();
    else if (choice === '7') await viewErrorLogs();
    else if (choice === '8') {
      console.log('\nSampai jumpa kembali, Owner!');
      rl.close();
      break;
    } else {
      await askQuestion('\nPilihan tidak valid. Tekan ENTER untuk coba lagi...');
    }
  }
}

// Connect to prisma and boot CLI dashboard
console.log('Connecting to database...');
prisma.$connect()
  .then(() => mainMenu())
  .catch(err => {
    console.error('Fatal DB connection error:', err);
    rl.close();
  });
