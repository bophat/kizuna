import { Fragment, type ReactNode } from 'react';

type ContentType = 'markdown' | 'html';

interface ContentRendererProps {
  content: string;
  contentType: ContentType;
  className?: string;
}

const ALLOWED_HTML_TAGS = new Set([
  'A', 'BLOCKQUOTE', 'BR', 'CODE', 'EM', 'H1', 'H2', 'H3', 'H4', 'HR',
  'LI', 'OL', 'P', 'PRE', 'STRONG', 'TABLE', 'TBODY', 'TD', 'TH', 'THEAD',
  'TR', 'UL',
]);
const ALLOWED_HTML_ATTRIBUTES: Record<string, Set<string>> = {
  A: new Set(['href', 'rel', 'target', 'title']),
  TD: new Set(['colspan', 'rowspan']),
  TH: new Set(['colspan', 'rowspan', 'scope']),
};

function isSafeLink(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith('/') || normalized.startsWith('#') ||
    normalized.startsWith('http://') || normalized.startsWith('https://') ||
    normalized.startsWith('mailto:') || normalized.startsWith('tel:');
}

export function sanitizeHtmlForDisplay(content: string) {
  if (typeof DOMParser === 'undefined') return '';
  const document = new DOMParser().parseFromString(content, 'text/html');
  const elements = Array.from(document.body.querySelectorAll('*')).reverse();

  elements.forEach((element) => {
    if (!ALLOWED_HTML_TAGS.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }

    const allowedAttributes = ALLOWED_HTML_ATTRIBUTES[element.tagName] || new Set<string>();
    Array.from(element.attributes).forEach((attribute) => {
      if (!allowedAttributes.has(attribute.name.toLowerCase())) {
        element.removeAttribute(attribute.name);
      }
    });

    if (element.tagName === 'A') {
      const href = element.getAttribute('href') || '';
      if (!isSafeLink(href)) element.removeAttribute('href');
      if (element.getAttribute('target') === '_blank') {
        element.setAttribute('rel', 'noopener noreferrer');
      } else if (element.hasAttribute('target')) {
        element.setAttribute('target', '_self');
      }
    }
  });

  return document.body.innerHTML;
}

function inlineMarkdown(value: string, keyPrefix: string): ReactNode[] {
  const pattern = /(\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\*([^*\n]+)\*|_([^_\n]+)_)/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > cursor) nodes.push(value.slice(cursor, match.index));
    const key = `${keyPrefix}-${match.index}`;
    if (match[2] && match[3]) {
      const href = isSafeLink(match[3]) ? match[3] : '#';
      const external = href.startsWith('http://') || href.startsWith('https://');
      nodes.push(
        <a key={key} href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>
          {match[2]}
        </a>,
      );
    } else if (match[4] || match[5]) {
      nodes.push(<strong key={key}>{match[4] || match[5]}</strong>);
    } else if (match[6]) {
      nodes.push(<code key={key}>{match[6]}</code>);
    } else {
      nodes.push(<em key={key}>{match[7] || match[8]}</em>);
    }
    cursor = pattern.lastIndex;
  }
  if (cursor < value.length) nodes.push(value.slice(cursor));
  return nodes;
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.trim().startsWith('```')) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push(<pre key={`code-${index}`}><code>{codeLines.join('\n')}</code></pre>);
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      const children = inlineMarkdown(heading[2], `heading-${index}`);
      const level = heading[1].length;
      if (level === 1) blocks.push(<h1 key={`heading-${index}`}>{children}</h1>);
      if (level === 2) blocks.push(<h2 key={`heading-${index}`}>{children}</h2>);
      if (level === 3) blocks.push(<h3 key={`heading-${index}`}>{children}</h3>);
      if (level === 4) blocks.push(<h4 key={`heading-${index}`}>{children}</h4>);
      index += 1;
      continue;
    }

    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      blocks.push(<hr key={`hr-${index}`} />);
      index += 1;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^\s*>\s?/, ''));
        index += 1;
      }
      blocks.push(<blockquote key={`quote-${index}`}>{inlineMarkdown(quoteLines.join(' '), `quote-${index}`)}</blockquote>);
      continue;
    }

    const unordered = /^\s*[-*+]\s+(.+)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
    if (unordered || ordered) {
      const items: ReactNode[] = [];
      const itemPattern = unordered ? /^\s*[-*+]\s+(.+)$/ : /^\s*\d+[.)]\s+(.+)$/;
      while (index < lines.length) {
        const item = itemPattern.exec(lines[index]);
        if (!item) break;
        items.push(<li key={`item-${index}`}>{inlineMarkdown(item[1], `item-${index}`)}</li>);
        index += 1;
      }
      blocks.push(unordered ? <ul key={`list-${index}`}>{items}</ul> : <ol key={`list-${index}`}>{items}</ol>);
      continue;
    }

    const paragraph: string[] = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^(#{1,4})\s+|^\s*([-*+]\s+|\d+[.)]\s+|>\s?|```)/.test(lines[index])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(<p key={`paragraph-${index}`}>{inlineMarkdown(paragraph.join(' '), `paragraph-${index}`)}</p>);
  }

  return <>{blocks.map((block, index) => <Fragment key={index}>{block}</Fragment>)}</>;
}

export function ContentRenderer({ content, contentType, className = '' }: ContentRendererProps) {
  const baseClass = [
    'content-renderer text-base leading-8 text-zinc-700 dark:text-zinc-300',
    '[&_h1]:mt-10 [&_h1]:mb-5 [&_h1]:text-4xl [&_h1]:font-serif [&_h1]:font-semibold [&_h1]:text-zinc-900 dark:[&_h1]:text-white',
    '[&_h2]:mt-9 [&_h2]:mb-4 [&_h2]:text-3xl [&_h2]:font-serif [&_h2]:font-semibold [&_h2]:text-zinc-900 dark:[&_h2]:text-white',
    '[&_h3]:mt-7 [&_h3]:mb-3 [&_h3]:text-2xl [&_h3]:font-serif [&_h3]:font-semibold [&_h3]:text-zinc-900 dark:[&_h3]:text-white',
    '[&_h4]:mt-6 [&_h4]:mb-3 [&_h4]:text-xl [&_h4]:font-semibold [&_h4]:text-zinc-900 dark:[&_h4]:text-white',
    '[&_p]:my-4 [&_a]:text-[#99051d] [&_a]:underline [&_a]:underline-offset-4',
    '[&_ul]:my-5 [&_ul]:list-disc [&_ul]:pl-7 [&_ol]:my-5 [&_ol]:list-decimal [&_ol]:pl-7 [&_li]:my-2',
    '[&_blockquote]:my-6 [&_blockquote]:border-l-4 [&_blockquote]:border-[#99051d]/30 [&_blockquote]:pl-5 [&_blockquote]:italic',
    '[&_pre]:my-6 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-zinc-900 [&_pre]:p-5 [&_pre]:text-zinc-100',
    '[&_code]:rounded [&_code]:bg-zinc-100 [&_code]:px-1.5 [&_code]:py-0.5 dark:[&_code]:bg-zinc-800',
    '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_hr]:my-8 [&_hr]:border-zinc-200',
    '[&_table]:my-6 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:p-3 [&_td]:border [&_td]:p-3',
    className,
  ].join(' ');

  if (contentType === 'html') {
    return <div className={baseClass} dangerouslySetInnerHTML={{ __html: sanitizeHtmlForDisplay(content) }} />;
  }
  return <div className={baseClass}><MarkdownContent content={content} /></div>;
}
