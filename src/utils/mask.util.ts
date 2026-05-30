const SENSITIVE_KEY_PATTERN = /(password|passwd|secret|token|apikey|api_key|cookie|session|auth|credential|private)/i;
const PHONE_PATTERN = /\b(\+?62|0)?\d{8,15}\b/g;

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 4) return '****';
  return `${'*'.repeat(Math.max(4, digits.length - 4))}${digits.slice(-4)}`;
}

export function redactText(value: string): string {
  return value.replace(PHONE_PATTERN, (match) => maskPhone(match));
}

export function redactSensitive<T>(input: T): T {
  if (input === null || input === undefined) return input;
  if (typeof input === 'string') return redactText(input) as T;
  if (typeof input !== 'object') return input;
  if (Array.isArray(input)) return input.map((item) => redactSensitive(item)) as T;

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      output[key] = '[REDACTED]';
    } else {
      output[key] = redactSensitive(value);
    }
  }
  return output as T;
}
