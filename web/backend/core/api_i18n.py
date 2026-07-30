import re


ERROR_TRANSLATIONS = {
    'Cart is empty': {
        'ja': 'カートは空です',
        'vi': 'Giỏ hàng đang trống',
    },
    'Email field is required': {
        'ja': 'メールアドレスは必須です',
        'vi': 'Email là trường bắt buộc',
    },
    'Email is required': {
        'ja': 'メールアドレスは必須です',
        'vi': 'Vui lòng nhập email',
    },
    'Favorite not found': {
        'ja': 'お気に入りが見つかりません',
        'vi': 'Không tìm thấy mục yêu thích',
    },
    'Item not in cart': {
        'ja': '商品はカートにありません',
        'vi': 'Sản phẩm không có trong giỏ hàng',
    },
    'Product not found': {
        'ja': '商品が見つかりません',
        'vi': 'Không tìm thấy sản phẩm',
    },
    'User or Role not found': {
        'ja': 'ユーザーまたは役割が見つかりません',
        'vi': 'Không tìm thấy người dùng hoặc vai trò',
    },
    'product_id and price are required': {
        'ja': '商品IDと価格は必須です',
        'vi': 'Mã sản phẩm và giá là bắt buộc',
    },
    'product_id is required': {
        'ja': '商品IDは必須です',
        'vi': 'Mã sản phẩm là bắt buộc',
    },
    'Refresh token missing': {
        'ja': '更新トークンがありません',
        'vi': 'Thiếu refresh token',
    },
    'AI concierge is disabled — an admin will reply shortly.': {
        'ja': 'AIコンシェルジュは無効です。管理者がまもなく返信します。',
        'vi': 'AI Concierge đang tắt. Quản trị viên sẽ sớm phản hồi.',
    },
    'AI failed to parse results': {
        'ja': 'AIが結果を解析できませんでした',
        'vi': 'AI không thể phân tích kết quả',
    },
    'AI service unavailable': {
        'ja': 'AIサービスを利用できません',
        'vi': 'Dịch vụ AI hiện không khả dụng',
    },
    'At least one image is required': {
        'ja': '画像が1枚以上必要です',
        'vi': 'Cần ít nhất một hình ảnh',
    },
    'File must be a CSV file': {
        'ja': 'CSVファイルを選択してください',
        'vi': 'Tệp phải có định dạng CSV',
    },
    'File too large. Max 2MB': {
        'ja': 'ファイルが大きすぎます。最大2MBです',
        'vi': 'Tệp quá lớn. Tối đa 2MB',
    },
    'File too large. Max 5MB': {
        'ja': 'ファイルが大きすぎます。最大5MBです',
        'vi': 'Tệp quá lớn. Tối đa 5MB',
    },
    'Invalid date format. Use YYYY-MM-DD': {
        'ja': '日付形式が正しくありません。YYYY-MM-DDを使用してください',
        'vi': 'Định dạng ngày không hợp lệ. Hãy dùng YYYY-MM-DD',
    },
    'Invalid file encoding. Please use UTF-8.': {
        'ja': 'ファイルの文字コードが正しくありません。UTF-8を使用してください。',
        'vi': 'Mã hóa tệp không hợp lệ. Vui lòng sử dụng UTF-8.',
    },
    'Invalid file type. Allowed: JPEG, PNG, WEBP, GIF': {
        'ja': 'ファイル形式が正しくありません。JPEG、PNG、WEBP、GIFのみ使用できます',
        'vi': 'Loại tệp không hợp lệ. Chỉ hỗ trợ JPEG, PNG, WEBP, GIF',
    },
    'Invalid file type. Only JPEG, PNG, WEBP allowed': {
        'ja': 'ファイル形式が正しくありません。JPEG、PNG、WEBPのみ使用できます',
        'vi': 'Loại tệp không hợp lệ. Chỉ hỗ trợ JPEG, PNG, WEBP',
    },
    'Invalid month or year': {
        'ja': '月または年が正しくありません',
        'vi': 'Tháng hoặc năm không hợp lệ',
    },
    'Invalid year': {
        'ja': '年が正しくありません',
        'vi': 'Năm không hợp lệ',
    },
    'Key cannot be changed': {
        'ja': 'キーは変更できません',
        'vi': 'Không thể thay đổi khóa',
    },
    'No CSV file provided': {
        'ja': 'CSVファイルが選択されていません',
        'vi': 'Chưa cung cấp tệp CSV',
    },
    'No avatar file provided': {
        'ja': 'アバター画像が選択されていません',
        'vi': 'Chưa cung cấp ảnh đại diện',
    },
    'No image file provided': {
        'ja': '画像ファイルが選択されていません',
        'vi': 'Chưa cung cấp tệp ảnh',
    },
    'message is required': {
        'ja': 'メッセージは必須です',
        'vi': 'Tin nhắn là bắt buộc',
    },
    'query is required': {
        'ja': '検索内容は必須です',
        'vi': 'Nội dung tìm kiếm là bắt buộc',
    },
    'session_id is required': {
        'ja': 'セッションIDは必須です',
        'vi': 'Mã phiên là bắt buộc',
    },
    'Yêu cầu confirmation=true để thực hiện bulk import thật.': {
        'en': 'confirmation=true is required to perform a real bulk import.',
        'ja': '実際の一括インポートには confirmation=true が必要です。',
    },
    'Yêu cầu confirmation=true để thực hiện import thật.': {
        'en': 'confirmation=true is required to perform a real import.',
        'ja': '実際のインポートには confirmation=true が必要です。',
    },
    'Yêu cầu confirmation=true để thực hiện sync thật.': {
        'en': 'confirmation=true is required to perform a real sync.',
        'ja': '実際の同期には confirmation=true が必要です。',
    },
}


PATTERN_TRANSLATIONS = (
    (
        re.compile(r'^No (?P<model>.+) matches the given query\.$'),
        {
            'ja': '該当するデータが見つかりません。',
            'vi': 'Không tìm thấy dữ liệu phù hợp.',
        },
    ),
    (
        re.compile(r'^Product (?P<name>.+) is not available for checkout$'),
        {
            'ja': '商品「{name}」は現在購入できません',
            'vi': 'Sản phẩm “{name}” hiện không thể thanh toán',
        },
    ),
    (
        re.compile(r'^Insufficient stock for (?P<name>.+)\. Available: (?P<count>\d+)$'),
        {
            'ja': '商品「{name}」の在庫が不足しています。在庫数: {count}',
            'vi': 'Sản phẩm “{name}” không đủ tồn kho. Hiện có: {count}',
        },
    ),
)


def translate_api_error(value, language):
    if not isinstance(value, str):
        return value

    language = (language or 'en').split('-')[0]
    translations = ERROR_TRANSLATIONS.get(value)
    if translations:
        return translations.get(language, value)

    for pattern, localized in PATTERN_TRANSLATIONS:
        match = pattern.match(value)
        if match and language in localized:
            return localized[language].format(**match.groupdict())

    return value


class ApiErrorLocalizationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if response.status_code < 400 or not hasattr(response, 'data'):
            return response

        data = response.data
        if isinstance(data, dict):
            language = getattr(request, 'LANGUAGE_CODE', 'en')
            for key in ('error', 'detail', 'message'):
                if key in data:
                    data[key] = translate_api_error(data[key], language)
        return response
