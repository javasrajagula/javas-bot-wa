const SENSITIVE_KEY_PATTERN = /(password|passwd|secret|token|apikey|api_key|cookie|session|auth|credential|private)/i;
const PHONE_PATTERN = /\b(\+?62|0)?\d{8,15}\b/g;

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 4) return '****';
  return `${'*'.repeat(Math.max(4, digits.length - 4))}${digits.slice(-4)}`;
}

export function redactText(value: string): string {
  if (!value) return value;
  let redacted = value;
  
  // 2. Redact URL query parameters (e.g. token=xyz, apikey=xyz, secret=xyz, password=xyz, key=xyz)
  redacted = redacted.replace(
    /(?<=\b)(token|password|passwd|secret|apikey|api_key|cookie|session|auth|credential|key)=([^&?\s#"\\]+)/gi,
    '$1=[REDACTED]'
  );

  // 3. Redact JSON-like properties or simple key-value settings for sensitive keys
  // For example: "apiKey": "xyz" or secret: 'xyz'
  redacted = redacted.replace(
    /(?<=\b)(token|password|passwd|secret|apikey|api_key|cookie|session|auth|credential|key)(["']?\s*[:=]\s*["'])([^"'\s\\]+)(["']?)/gi,
    '$1$2[REDACTED]$4'
  );

  // 4. Redact Bearer tokens: Bearer <token>
  redacted = redacted.replace(
    /(bearer\s+)([a-zA-Z0-9\-\_\.\~\+\/]+=*)/gi,
    '$1[REDACTED]'
  );

  // 5. Redact API Keys / Specific Tokens
  redacted = redacted.replace(/sk-[a-zA-Z0-9_-]{30,}/g, '[OPENAI_KEY_REDACTED]');
  redacted = redacted.replace(/AIzaSy[a-zA-Z0-9_-]{33}/g, '[GOOGLE_KEY_REDACTED]');
  redacted = redacted.replace(/(xox[baprs]-[0-9]{10,12}-[a-zA-Z0-9]{24}|mockslack-[0-9]{10,12}-[a-zA-Z0-9]{24})/g, '[SLACK_TOKEN_REDACTED]');

  // 6. Redact credentials in URLs: http://user:pass@host
  redacted = redacted.replace(/(https?:\/\/)([^:\s]+):([^@\s]+)(@)/gi, '$1$2:[PASSWORD_REDACTED]$4');

  // 1. Redact phone numbers (done last so as not to corrupt high-entropy tokens/keys)
  redacted = redacted.replace(PHONE_PATTERN, (match) => maskPhone(match));

  return redacted;
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

export function redactLogLine(line: string): string {
  return redactText(line);
}

