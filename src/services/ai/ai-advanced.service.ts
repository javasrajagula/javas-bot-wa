import { aiProviderService } from './ai-provider.service.js';

export async function analyzeGroupSentiment(messages: string[]): Promise<string> {
  const prompt = `Berikut adalah daftar pesan obrolan terbaru di suatu grup:\n\n${messages.join('\n')}\n\nAnalisis sentimen grup berdasarkan pesan-pesan tersebut. Tentukan mood grup saat ini (positif, netral, atau negatif), berikan statistik emosi singkat (persentase perkiraan), dan rangkum topik emosional utama dalam Bahasa Indonesia.`;
  return await aiProviderService.generateText(prompt, "Anda adalah asisten analis sentimen obrolan grup yang ahli.");
}

export async function generateStory(theme: string): Promise<string> {
  const prompt = `Buatlah cerita pendek interaktif yang menarik berdasarkan tema: "${theme}". Cerita harus memiliki 2 pilihan alur di bagian akhir agar pembaca bisa memilih kelanjutannya. Tulis dalam Bahasa Indonesia secara kreatif.`;
  return await aiProviderService.generateText(prompt, "Anda adalah pendongeng dan penulis cerita interaktif yang berbakat.");
}

export async function recommendGroupContent(messages: string[]): Promise<string> {
  const prompt = `Berikut adalah beberapa pesan obrolan terakhir di grup:\n\n${messages.join('\n')}\n\nBerdasarkan tren diskusi di atas, sarankan 3 topik diskusi baru yang hangat, menarik, dan relevan agar grup tetap aktif dan interaktif. Berikan penjelasan singkat mengapa topik tersebut disarankan.`;
  return await aiProviderService.generateText(prompt, "Anda adalah asisten konsultan keterlibatan komunitas (community engagement).");
}
