from html import escape
from html.parser import HTMLParser
from urllib.parse import urlsplit


ALLOWED_TAGS = {
    'a', 'blockquote', 'br', 'code', 'em', 'h1', 'h2', 'h3', 'h4', 'hr',
    'li', 'ol', 'p', 'pre', 'strong', 'table', 'tbody', 'td', 'th', 'thead',
    'tr', 'ul',
}
VOID_TAGS = {'br', 'hr'}
SUPPRESSED_TAGS = {'embed', 'iframe', 'object', 'script', 'style', 'svg'}
ALLOWED_ATTRIBUTES = {
    'a': {'href', 'rel', 'target', 'title'},
    'td': {'colspan', 'rowspan'},
    'th': {'colspan', 'rowspan', 'scope'},
}


def _safe_link(value):
    value = value.strip()
    if not value:
        return ''
    if value.startswith(('/', '#')):
        return value
    return value if urlsplit(value).scheme.lower() in {'http', 'https', 'mailto', 'tel'} else ''


class _SafeHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.suppressed_depth = 0

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if self.suppressed_depth:
            if tag in SUPPRESSED_TAGS:
                self.suppressed_depth += 1
            return
        if tag in SUPPRESSED_TAGS:
            self.suppressed_depth = 1
            return
        if tag not in ALLOWED_TAGS:
            return

        safe_attrs = []
        for name, value in attrs:
            name = name.lower()
            value = value or ''
            if name not in ALLOWED_ATTRIBUTES.get(tag, set()):
                continue
            if name == 'href':
                value = _safe_link(value)
                if not value:
                    continue
            if name == 'target' and value not in {'_blank', '_self'}:
                continue
            if name in {'colspan', 'rowspan'} and not value.isdigit():
                continue
            safe_attrs.append((name, value))

        if tag == 'a' and any(name == 'target' and value == '_blank' for name, value in safe_attrs):
            safe_attrs = [(name, value) for name, value in safe_attrs if name != 'rel']
            safe_attrs.append(('rel', 'noopener noreferrer'))

        attrs_text = ''.join(
            f' {name}="{escape(value, quote=True)}"' for name, value in safe_attrs
        )
        self.parts.append(f'<{tag}{attrs_text}>')

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if self.suppressed_depth:
            if tag in SUPPRESSED_TAGS:
                self.suppressed_depth -= 1
            return
        if tag in ALLOWED_TAGS and tag not in VOID_TAGS:
            self.parts.append(f'</{tag}>')

    def handle_data(self, data):
        if not self.suppressed_depth:
            self.parts.append(escape(data))


def sanitize_store_page_html(content):
    parser = _SafeHTMLParser()
    parser.feed(content or '')
    parser.close()
    return ''.join(parser.parts)
