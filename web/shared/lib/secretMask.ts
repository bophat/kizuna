export const SECRET_MASK_PREFIX = '********';

export function isMaskedSecretValue(value: string | undefined | null): boolean {
  if (!value) return true;
  return value.startsWith(SECRET_MASK_PREFIX);
}

export function secretFieldPlaceholder(value: string | undefined | null): string {
  return isMaskedSecretValue(value) && value ? 'Leave blank to keep current value' : 'Enter new value';
}
