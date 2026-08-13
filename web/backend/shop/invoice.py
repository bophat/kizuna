import io
from decimal import Decimal
from django.conf import settings
from django.utils import timezone
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer,
    KeepTogether, PageBreak
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

# Register system font for Unicode support (Vietnamese + Japanese)
# Try to find a suitable font on the system
FONT_CANDIDATES = [
    # macOS system fonts with good Unicode support (including Homebrew-installed Noto Sans JP)
    '/Users/phattdt/Library/Fonts/NotoSansJP[wght].ttf',  # Homebrew installed variable font
    '/System/Library/Fonts/PingFang.ttc',
    '/System/Library/Fonts/Helvetica.ttc',
    '/System/Library/Fonts/ArialHB.ttc',
    '/System/Library/Fonts/STHeiti Light.ttc',
    # Linux common fonts
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
    # Windows common fonts
    'C:/Windows/Fonts/arial.ttf',
    'C:/Windows/Fonts/msyh.ttc',
]

FONT_NAME = 'Helvetica'
FONT_NAME_BOLD = 'Helvetica-Bold'

# First: Try to register Noto Sans JP variable font (supports Japanese + Vietnamese)
noto_regular = None
noto_bold = None

# Try variable font from Homebrew/macOS user fonts
for font_path in FONT_CANDIDATES:
    if not os.path.exists(font_path):
        continue
    try:
        if 'NotoSansJP' in font_path:
            # Variable font - register with subfontIndex
            pdfmetrics.registerFont(TTFont('NotoSansJP', font_path, subfontIndex=0))
            pdfmetrics.registerFont(TTFont('NotoSansJP-Bold', font_path, subfontIndex=6))  # Bold weight
            noto_regular = 'NotoSansJP'
            noto_bold = 'NotoSansJP-Bold'
            break
        elif font_path.endswith('.ttc'):
            pdfmetrics.registerFont(TTFont('CustomFont', font_path, subfontIndex=0))
            pdfmetrics.registerFont(TTFont('CustomFont-Bold', font_path, subfontIndex=0))
            if FONT_NAME == 'Helvetica':
                FONT_NAME = 'CustomFont'
                FONT_NAME_BOLD = 'CustomFont-Bold'
                break
        else:
            font_name = os.path.basename(font_path).replace('.ttf', '')
            pdfmetrics.registerFont(TTFont(font_name, font_path))
            # Try to find bold variant
            bold_path = font_path.replace('.ttf', '-Bold.ttf').replace('Regular', 'Bold')
            if os.path.exists(bold_path):
                pdfmetrics.registerFont(TTFont(f'{font_name}-Bold', bold_path))
                FONT_NAME = font_name
                FONT_NAME_BOLD = f'{font_name}-Bold'
            else:
                FONT_NAME = font_name
                FONT_NAME_BOLD = font_name
            break
    except Exception:
        continue

# If Noto Sans JP found, use it as primary
if noto_regular and noto_bold:
    FONT_NAME = noto_regular
    FONT_NAME_BOLD = noto_bold

# Fallback: Also check local fonts directory
FONT_DIR = os.path.join(os.path.dirname(__file__), 'fonts')
DEJAVU_REGULAR = os.path.join(FONT_DIR, 'DejaVuSans.ttf')
DEJAVU_BOLD = os.path.join(FONT_DIR, 'DejaVuSans-Bold.ttf')

if os.path.exists(DEJAVU_REGULAR) and FONT_NAME == 'Helvetica':
    try:
        pdfmetrics.registerFont(TTFont('DejaVu', DEJAVU_REGULAR))
        pdfmetrics.registerFont(TTFont('DejaVu-Bold', DEJAVU_BOLD))
        FONT_NAME = 'DejaVu'
        FONT_NAME_BOLD = 'DejaVu-Bold'
    except Exception:
        pass


def get_styles():
    """Get paragraph styles for invoice."""
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        name='InvoiceTitle',
        fontName=FONT_NAME_BOLD,
        fontSize=24,
        leading=28,
        textColor=colors.HexColor('#99051D'),  # Brand red
        alignment=TA_CENTER,
        spaceAfter=6,
    ))

    styles.add(ParagraphStyle(
        name='InvoiceSubtitle',
        fontName=FONT_NAME,
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#666666'),
        alignment=TA_CENTER,
        spaceAfter=20,
    ))

    styles.add(ParagraphStyle(
        name='SectionHeader',
        fontName=FONT_NAME_BOLD,
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#333333'),
        spaceBefore=12,
        spaceAfter=6,
    ))

    styles.add(ParagraphStyle(
        name='InfoLabel',
        fontName=FONT_NAME_BOLD,
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#555555'),
    ))

    styles.add(ParagraphStyle(
        name='InfoValue',
        fontName=FONT_NAME,
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#333333'),
    ))

    styles.add(ParagraphStyle(
        name='TableHeader',
        fontName=FONT_NAME_BOLD,
        fontSize=9,
        leading=12,
        textColor=colors.white,
        alignment=TA_CENTER,
    ))

    styles.add(ParagraphStyle(
        name='TableCell',
        fontName=FONT_NAME,
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#333333'),
        alignment=TA_LEFT,
    ))

    styles.add(ParagraphStyle(
        name='TableCellCenter',
        fontName=FONT_NAME,
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#333333'),
        alignment=TA_CENTER,
    ))

    styles.add(ParagraphStyle(
        name='TableCellRight',
        fontName=FONT_NAME,
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#333333'),
        alignment=TA_RIGHT,
    ))

    styles.add(ParagraphStyle(
        name='TotalLabel',
        fontName=FONT_NAME_BOLD,
        fontSize=10,
        leading=13,
        textColor=colors.HexColor('#333333'),
        alignment=TA_RIGHT,
    ))

    styles.add(ParagraphStyle(
        name='TotalValue',
        fontName=FONT_NAME_BOLD,
        fontSize=10,
        leading=13,
        textColor=colors.HexColor('#99051D'),
        alignment=TA_RIGHT,
    ))

    styles.add(ParagraphStyle(
        name='GrandTotalLabel',
        fontName=FONT_NAME_BOLD,
        fontSize=12,
        leading=15,
        textColor=colors.HexColor('#333333'),
        alignment=TA_RIGHT,
    ))

    styles.add(ParagraphStyle(
        name='GrandTotalValue',
        fontName=FONT_NAME_BOLD,
        fontSize=12,
        leading=15,
        textColor=colors.HexColor('#99051D'),
        alignment=TA_RIGHT,
    ))

    styles.add(ParagraphStyle(
        name='FooterText',
        fontName=FONT_NAME,
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#888888'),
        alignment=TA_CENTER,
        spaceBefore=20,
    ))

    return styles


def format_currency(amount, currency='USD'):
    """Format currency for display."""
    if currency == 'VND':
        return f"{amount:,.0f} ₫".replace(',', '.')
    return f"${amount:,.2f}"


def format_vnd(amount):
    """Format VND currency."""
    return f"{amount:,.0f} ₫".replace(',', '.')


def generate_invoice_pdf(order, request=None):
    """
    Generate PDF invoice for an order.
    Returns BytesIO buffer with PDF content.
    """
    from .models import InvoiceSettings

    # Get invoice settings
    invoice_settings = InvoiceSettings.get_active()

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=20*mm,
        rightMargin=20*mm,
        topMargin=15*mm,
        bottomMargin=20*mm,
    )

    styles = get_styles()
    story = []
    width = A4[0] - 40*mm  # usable width

    # ===== HEADER =====
    # Use customizable company name
    company_name = invoice_settings.company_name
    story.append(Paragraph(company_name, styles['InvoiceTitle']))
    story.append(Paragraph("HÓA ĐƠN BÁN HÀNG / SALES INVOICE", styles['InvoiceSubtitle']))

    # Company info if available
    if invoice_settings.address:
        story.append(Paragraph(invoice_settings.address.replace('\n', '<br/>'), styles['InfoValue']))
    if invoice_settings.phone:
        story.append(Paragraph(f"Điện thoại: {invoice_settings.phone}", styles['InfoValue']))
    if invoice_settings.email:
        story.append(Paragraph(f"Email: {invoice_settings.email}", styles['InfoValue']))
    if invoice_settings.tax_id:
        story.append(Paragraph(f"Mã số thuế: {invoice_settings.tax_id}", styles['InfoValue']))
    story.append(Spacer(1, 8))

    # ===== ORDER INFO TABLE =====
    order_code = order.order_code or f"KZ{order.pk:010d}"
    created_date = timezone.localtime(order.created_at).strftime('%d/%m/%Y %H:%M')

    info_data = [
        [Paragraph('Mã đơn hàng:', styles['InfoLabel']), Paragraph(order_code, styles['InfoValue']),
         Paragraph('Ngày đặt:', styles['InfoLabel']), Paragraph(created_date, styles['InfoValue'])],
        [Paragraph('Trạng thái:', styles['InfoLabel']), Paragraph(order.get_status_display(), styles['InfoValue']),
         Paragraph('Thanh toán:', styles['InfoLabel']), Paragraph(order.get_payment_method_display(), styles['InfoValue'])],
    ]

    info_table = Table(info_data, colWidths=[30*mm, 55*mm, 25*mm, 60*mm])
    info_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 8))

    # ===== CUSTOMER INFO =====
    story.append(Paragraph('THÔNG TIN KHÁCH HÀNG / CUSTOMER INFO', styles['SectionHeader']))

    user = order.user
    try:
        profile = user.profile
        phone = profile.phone or ''
        address = profile.address or ''
    except:
        phone = ''
        address = ''

    customer_data = [
        [Paragraph('Họ tên:', styles['InfoLabel']), Paragraph(user.get_full_name() or user.username, styles['InfoValue']),
         Paragraph('Email:', styles['InfoLabel']), Paragraph(user.email or '', styles['InfoValue'])],
        [Paragraph('Điện thoại:', styles['InfoLabel']), Paragraph(phone, styles['InfoValue']),
         Paragraph('Địa chỉ:', styles['InfoLabel']), Paragraph(address, styles['InfoValue'])],
    ]

    customer_table = Table(customer_data, colWidths=[25*mm, 60*mm, 20*mm, 65*mm])
    customer_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    story.append(customer_table)
    story.append(Spacer(1, 10))

    # ===== ORDER ITEMS TABLE =====
    story.append(Paragraph('CHI TIẾT ĐƠN HÀNG / ORDER DETAILS', styles['SectionHeader']))

    # Table header
    headers = ['STT', 'Sản phẩm', 'SL', 'Đơn giá', 'Thành tiền']
    header_row = [Paragraph(h, styles['TableHeader']) for h in headers]

    # Table data
    data = [header_row]
    for idx, item in enumerate(order.items.all(), 1):
        product_name = item.product_name or (item.product.name if item.product else 'N/A')
        qty = item.quantity
        unit_price = item.price
        line_total = unit_price * qty

        row = [
            Paragraph(str(idx), styles['TableCellCenter']),
            Paragraph(product_name, styles['TableCell']),
            Paragraph(str(qty), styles['TableCellCenter']),
            Paragraph(format_currency(unit_price), styles['TableCellRight']),
            Paragraph(format_currency(line_total), styles['TableCellRight']),
        ]
        data.append(row)

    col_widths = [12*mm, 85*mm, 12*mm, 38*mm, 43*mm]
    items_table = Table(data, colWidths=col_widths, repeatRows=1)
    items_table.setStyle(TableStyle([
        # Header
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#99051D')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        # Body
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F9F9F9')]),
        # Grid
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#DDDDDD')),
        ('LINEBELOW', (0, 0), (-1, 0), 1.5, colors.HexColor('#99051D')),
        # Padding
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        # Alignment
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 10))

    # ===== TOTALS =====
    totals_data = [
        [Paragraph('Tạm tính:', styles['TotalLabel']), Paragraph(format_currency(order.subtotal_amount), styles['TotalValue'])],
        [Paragraph('Phí vận chuyển:', styles['TotalLabel']), Paragraph(format_currency(order.shipping_amount), styles['TotalValue'])],
    ]

    if order.discount_amount > 0:
        totals_data.append([
            Paragraph(f'Giảm giá ({order.coupon_code}):', styles['TotalLabel']),
            Paragraph(f'- {format_currency(order.discount_amount)}', styles['TotalValue']),
        ])

    totals_data.append([
        Paragraph('TỔNG CỘNG:', styles['GrandTotalLabel']),
        Paragraph(format_currency(order.total_amount), styles['GrandTotalValue']),
    ])

    totals_table = Table(totals_data, colWidths=[140*mm, 50*mm])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('LINEABOVE', (0, -1), (-1, -1), 1.5, colors.HexColor('#99051D')),
    ]))
    story.append(totals_table)
    story.append(Spacer(1, 15))

    # ===== BANK INFO (if available) =====
    if invoice_settings.bank_info:
        story.append(Paragraph('THÔNG TIN CHUYỂN KHOẢN:', styles['SectionHeader']))
        story.append(Paragraph(invoice_settings.bank_info.replace('\n', '<br/>'), styles['InfoValue']))
        story.append(Spacer(1, 10))

    # ===== NOTES =====
    if order.admin_notes:
        story.append(Paragraph('GHI CHÚ:', styles['SectionHeader']))
        story.append(Paragraph(order.admin_notes, styles['InfoValue']))
        story.append(Spacer(1, 10))

    # ===== FOOTER =====
    story.append(Spacer(1, 20))
    footer_text = invoice_settings.footer_text or 'Cảm ơn quý khách đã mua sắm tại KIZUNA! / Thank you for shopping at KIZUNA!'
    story.append(Paragraph(footer_text, styles['FooterText']))
    story.append(Paragraph(
        f'Hóa đơn được tạo tự động lúc {timezone.localtime(timezone.now()).strftime("%d/%m/%Y %H:%M")}',
        styles['FooterText']
    ))

    # Build PDF
    doc.build(story)
    buffer.seek(0)
    return buffer


def generate_invoice_filename(order):
    """Generate filename for invoice PDF."""
    order_code = order.order_code or f"KZ{order.pk:010d}"
    date_str = timezone.localtime(order.created_at).strftime('%Y%m%d')
    return f"invoice_{order_code}_{date_str}.pdf"