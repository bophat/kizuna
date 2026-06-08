import i18n from '../i18n';

/**
 * Map tên field API (Django) → translation key cho label thân thiện.
 * Nếu không có trong map, sẽ dùng tên field gốc (viết hoa chữ cái đầu).
 */
const FIELD_LABEL_MAP: Record<string, string> = {
  name: 'inventory.modal.name_label',
  price: 'inventory.modal.price_label',
  stock: 'inventory.modal.stock_label',
  brand: 'inventory.modal.brand_label',
  category: 'inventory.modal.category_label',
  image: 'inventory.modal.image_label',
  description: 'inventory.modal.description_label',
  weight: 'inventory.modal.weight_label',
  slug: 'categories.modal.slug_label',
  email: 'users.modal.email',
  username: 'staff.modal.username',
  password: 'staff.modal.password_temp',
  first_name: 'users.modal.first_name',
  last_name: 'users.modal.last_name',
};

/**
 * Map message lỗi API (Django) → message thân thiện (vi/en/ja).
 * Key là regex pattern để match message gốc.
 */
const ERROR_MESSAGE_MAP: Array<{ pattern: RegExp; key: string }> = [
  { pattern: /may not be blank/i, key: 'validation.required' },
  { pattern: /this field is required/i, key: 'validation.required' },
  { pattern: /a valid number is required/i, key: 'validation.invalid_number' },
  { pattern: /a valid integer is required/i, key: 'validation.invalid_number' },
  { pattern: /ensure this value is greater than/i, key: 'validation.min_value' },
  { pattern: /ensure this value is less than/i, key: 'validation.max_value' },
  { pattern: /this field must be unique/i, key: 'validation.unique' },
  { pattern: /already exists/i, key: 'validation.unique' },
  { pattern: /ensure this field has no more than/i, key: 'validation.too_long' },
  { pattern: /ensure this field has at least/i, key: 'validation.too_short' },
  { pattern: /a valid email/i, key: 'validation.invalid_email' },
  { pattern: /upload a valid image/i, key: 'validation.invalid_image' },
  { pattern: /the submitted data was not a file/i, key: 'validation.invalid_file' },
  { pattern: /not a valid choice/i, key: 'validation.invalid_choice' },
];

function getFieldLabel(field: string): string {
  const key = FIELD_LABEL_MAP[field];
  if (key) {
    const translated = i18n.t(key);
    // Nếu translation trả về key gốc (không tìm thấy), dùng fallback
    if (translated !== key) return translated;
  }
  // Fallback: chuyển snake_case thành chữ viết hoa đầu
  return field
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function translateErrorMessage(message: string): string {
  for (const { pattern, key } of ERROR_MESSAGE_MAP) {
    if (pattern.test(message)) {
      const translated = i18n.t(key);
      if (translated !== key) return translated;
    }
  }
  // Fallback: trả về message gốc
  return message;
}

/**
 * Parse Django REST Framework error response thành message thân thiện cho user.
 *
 * Input format (Django DRF):
 *   { "name": ["This field may not be blank."], "price": ["A valid number is required."] }
 *   hoặc { "detail": "Not found." }
 *   hoặc { "non_field_errors": ["..."] }
 *   hoặc ["error message"]
 *
 * Output: chuỗi message dễ đọc, ví dụ:
 *   "• Tên hiện vật: Trường này không được để trống\n• Giá: Vui lòng nhập số hợp lệ"
 */
export function formatApiErrors(errorData: unknown): string {
  if (!errorData) return i18n.t('common.error_occurred');

  // String đơn giản
  if (typeof errorData === 'string') return errorData;

  // Array of strings
  if (Array.isArray(errorData)) {
    return errorData.map((msg) => translateErrorMessage(String(msg))).join('\n');
  }

  // Object (Django DRF format)
  if (typeof errorData === 'object') {
    const obj = errorData as Record<string, unknown>;

    // { "detail": "..." }
    if ('detail' in obj && typeof obj.detail === 'string') {
      return translateErrorMessage(obj.detail);
    }

    const lines: string[] = [];

    for (const [field, messages] of Object.entries(obj)) {
      const label = field === 'non_field_errors'
        ? ''
        : getFieldLabel(field);

      const msgList = Array.isArray(messages) ? messages : [messages];
      const translatedMsgs = msgList
        .map((msg) => translateErrorMessage(String(msg)))
        .join(', ');

      if (label) {
        lines.push(`• ${label}: ${translatedMsgs}`);
      } else {
        lines.push(`• ${translatedMsgs}`);
      }
    }

    return lines.join('\n');
  }

  return i18n.t('common.error_occurred');
}
