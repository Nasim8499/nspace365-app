import React from 'react';

/* Tiny, dependency-free markdown renderer good enough for agent output:
   headings, lists, tables, fenced code, quotes, hr, bold/italic/code/links. */

function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|~~[^~]+~~)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyBase}-${i++}`;
    if (tok.startsWith('**')) out.push(<strong key={k}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('~~')) out.push(<s key={k}>{tok.slice(2, -2)}</s>);
    else if (tok.startsWith('`'))
      out.push(<code key={k}>{tok.slice(1, -1)}</code>);
    else if (tok.startsWith('[')) {
      const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok);
      if (mm)
        out.push(
          <a key={k} href={mm[2]} target="_blank" rel="noreferrer noopener">
            {mm[1]}
          </a>
        );
    } else out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = (text || '').split('\n');
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // fenced code
    if (/^```/.test(line.trim())) {
      const lang = line.trim().replace(/^```/, '').trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      blocks.push(
        <pre key={`c${key++}`}>
          <code data-lang={lang}>{buf.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // heading
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const content = inline(h[2], `h${key}`);
      blocks.push(
        level <= 2 ? (
          <h3 key={`h${key++}`}>{content}</h3>
        ) : (
          <h4 key={`h${key++}`} style={{ margin: '12px 0 6px', fontSize: 14.5 }}>
            {content}
          </h4>
        )
      );
      i++;
      continue;
    }

    // hr
    if (/^(\*\*\*|---|___)$/.test(line.trim())) {
      blocks.push(<hr key={`hr${key++}`} />);
      i++;
      continue;
    }

    // table
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      const parseRow = (r: string) =>
        r
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());
      const head = parseRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        rows.push(parseRow(lines[i]));
        i++;
      }
      blocks.push(
        <table key={`t${key++}`}>
          <thead>
            <tr>
              {head.map((c, ci) => (
                <th key={ci}>{inline(c, `th${ci}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                {r.map((c, ci) => (
                  <td key={ci}>{inline(c, `td${ri}-${ci}`)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
      continue;
    }

    // lists
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, ''));
        i++;
      }
      const Tag = ordered ? 'ol' : 'ul';
      blocks.push(
        React.createElement(
          Tag,
          { key: `l${key++}` },
          items.map((it, ii) => <li key={ii}>{inline(it, `li${ii}`)}</li>)
        )
      );
      continue;
    }

    // blockquote
    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      blocks.push(<blockquote key={`q${key++}`}>{inline(buf.join(' '), `q${key}`)}</blockquote>);
      continue;
    }

    // blank
    if (!line.trim()) {
      i++;
      continue;
    }

    // paragraph
    const buf: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4}\s|```|\s*\|)/.test(lines[i]) &&
      !/^\s*([-*+]|\d+\.)\s+/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push(<p key={`p${key++}`}>{inline(buf.join(' '), `p${key}`)}</p>);
  }

  return <>{blocks}</>;
}
