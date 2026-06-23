export async function calculateRiskScore(participant: string, socket: any): Promise<number> {
  let riskScore = 0;
  const phone = participant.split('@')[0];

  // 1. Country code check (Indonesia is +62)
  const isIndonesian = phone.startsWith('62');
  if (!isIndonesian) {
    riskScore += 40;
  }

  // 2. Profile picture check
  let hasProfilePic = false;
  if (socket && typeof socket.profilePictureUrl === 'function') {
    try {
      const url = await socket.profilePictureUrl(participant, 'image');
      if (url) hasProfilePic = true;
    } catch {
      hasProfilePic = false;
    }
  }
  if (!hasProfilePic) {
    riskScore += 30;
  }

  // 3. JID length check (> 13 digits)
  if (phone.length > 13) {
    riskScore += 20;
  }

  // 4. Missing name check
  let hasName = false;
  if (socket && socket.contacts) {
    const contact = socket.contacts[participant];
    if (contact && (contact.name || contact.notify || contact.verifiedName)) {
      hasName = true;
    }
  }
  if (!hasName) {
    riskScore += 10;
  }

  return riskScore;
}

export function getGradedCaptcha(riskScore: number, phone: string): { answer: string; captchaMsg: string } {
  let captchaMsg = '';
  let answer = '';

  if (riskScore < 30) {
    // Low risk: Simple math addition (a + b)
    const a = Math.floor(Math.random() * 9) + 1;
    const b = Math.floor(Math.random() * 9) + 1;
    answer = String(a + b);
    captchaMsg = `⚠️ *VERIFIKASI CAPTCHA (RISIKO RENDAH)* ⚠️\n\nHalo @${phone}, silakan jawab matematika berikut untuk masuk ke grup:\n*${a} + ${b} = ?*\n\nKetik jawabannya di grup ini dalam waktu 2 menit, atau Anda akan dikeluarkan otomatis!`;
  } else if (riskScore < 60) {
    // Medium risk: Reverse-word spelling
    const words = ['kucing', 'anjing', 'gajah', 'jerapah', 'harimau', 'kelinci', 'monyet', 'singa', 'zebra', 'panda'];
    const word = words[Math.floor(Math.random() * words.length)];
    answer = word.split('').reverse().join('');
    captchaMsg = `⚠️ *VERIFIKASI CAPTCHA (RISIKO SEDANG)* ⚠️\n\nHalo @${phone}, silakan ketik kata berikut secara terbalik untuk masuk ke grup:\n➡️ *${word}*\n\nKetik jawabannya di grup ini dalam waktu 2 menit, atau Anda akan dikeluarkan otomatis!`;
  } else {
    // High risk: Complex math ((a * b) - c)
    const a = Math.floor(Math.random() * 8) + 3; // 3-10
    const b = Math.floor(Math.random() * 8) + 3; // 3-10
    const c = Math.floor(Math.random() * 5) + 1; // 1-5
    answer = String((a * b) - c);
    captchaMsg = `⚠️ *VERIFIKASI CAPTCHA (RISIKO TINGGI)* ⚠️\n\nHalo @${phone}, silakan selesaikan kuis matematika berikut untuk masuk ke grup:\n*(${a} * ${b}) - ${c} = ?*\n\nKetik jawabannya di grup ini dalam waktu 2 menit, atau Anda akan dikeluarkan otomatis!`;
  }

  return { answer, captchaMsg };
}
