import axios from 'axios';
import { env } from '../../config/env.js';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class AiProviderService {
  private getProvider(): string {
    return env.AI_PROVIDER || 'none';
  }

  private getApiKey(): string {
    return env.AI_API_KEY || '';
  }

  private getBaseUrl(): string {
    return env.AI_API_BASE_URL || 'https://api.openai.com/v1';
  }

  public async generateText(prompt: string, systemPrompt?: string): Promise<string> {
    const provider = this.getProvider();
    if (provider === 'none') {
      return this.getMockResponse(prompt);
    }

    try {
      const messages: ChatMessage[] = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      return await this.callOpenAiCompatible(messages);
    } catch (err: any) {
      console.error('[AI] Call failed, using mock fallback:', err.message);
      return `⚠️ *Gagal menghubungi AI Provider (${provider})*.\n\n🤖 *Fallback:* ${this.getMockResponse(prompt)}`;
    }
  }

  public async generateChat(messages: ChatMessage[]): Promise<string> {
    const provider = this.getProvider();
    if (provider === 'none') {
      const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || '';
      return this.getMockResponse(lastUserMsg);
    }

    try {
      return await this.callOpenAiCompatible(messages);
    } catch (err: any) {
      console.error('[AI] Chat call failed, using mock fallback:', err.message);
      const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || '';
      return `⚠️ *Gagal menghubungi AI Provider (${provider})*.\n\n🤖 *Fallback:* ${this.getMockResponse(lastUserMsg)}`;
    }
  }

  private async callOpenAiCompatible(messages: ChatMessage[]): Promise<string> {
    const apiKey = this.getApiKey();
    const baseUrl = this.getBaseUrl();
    const provider = this.getProvider();

    const model = provider === 'openai' ? 'gpt-4o-mini' : 'local-model';
    const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await axios.post(
      url,
      {
        model,
        messages,
        temperature: 0.7,
        max_tokens: 1000
      },
      {
        headers,
        timeout: 15000
      }
    );

    const text = response.data?.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('Respons API kosong atau tidak valid.');
    }
    return text.trim();
  }

  private getMockResponse(prompt: string): string {
    const clean = prompt.toLowerCase().trim();
    if (clean.includes('halo') || clean.includes('hi') || clean.includes('helo')) {
      return 'Halo! Saya Javas AI, asisten pintar Anda. Bagaimana saya bisa membantu Anda hari ini?';
    }
    if (clean.includes('siapa kamu') || clean.includes('siapa namamu')) {
      return 'Saya Javas AI, model bahasa asisten virtual yang terintegrasi dengan WhatsApp Bot Anda.';
    }
    return `Halo! Saya menerima pertanyaan Anda: "${prompt}".\nSaat ini, fitur AI terintegrasi sedang dalam mode offline/dinonaktifkan oleh Owner. Harap hubungi Owner untuk mengaktifkan API key.`;
  }
}

export const aiProviderService = new AiProviderService();
