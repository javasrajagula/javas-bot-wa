import { WhatsAppAdapter } from './whatsapp.adapter.js';

export class AdapterHolder {
  public static setAdapter(adapter: WhatsAppAdapter): void {
    (globalThis as any).__whatsapp_adapter_instance__ = adapter;
  }

  public static getAdapter(): WhatsAppAdapter {
    const instance = (globalThis as any).__whatsapp_adapter_instance__;
    if (!instance) {
      throw new Error('WhatsAppAdapter has not been set in the AdapterHolder.');
    }
    return instance;
  }

  public static hasAdapter(): boolean {
    const instance = (globalThis as any).__whatsapp_adapter_instance__;
    return instance !== undefined && instance !== null;
  }
}
