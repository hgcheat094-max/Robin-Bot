import { test } from 'node:test';
import assert from 'node:assert/strict';
import MD from '../public/markdown.js';

const r = (s) => MD.render(s);

test('escapes raw HTML and script injection', () => {
  const html = r('<script>alert(1)</script> <img src=x onerror=alert(1)>');
  assert.ok(!html.includes('<script'));
  assert.ok(!html.includes('<img'));
  assert.match(html, /&lt;script&gt;/);
});

test('only links http, https and mailto', () => {
  assert.match(r('[ok](https://example.com/a?b=1&c=2)'), /<a href="https:\/\/example.com\/a\?b=1&amp;c=2" target="_blank" rel="noopener noreferrer">ok<\/a>/);
  assert.ok(!r('[bad](javascript:alert(1))').includes('<a '));
  assert.ok(!r('[bad](data:text/html;base64,AAAA)').includes('<a '));
  assert.match(r('visit https://example.com/path.'), /<a href="https:\/\/example.com\/path"[^>]*>https:\/\/example.com\/path<\/a>\./);
});

test('attribute breakout in URLs is neutralised', () => {
  const html = r('[x](https://a.com/"onmouseover="alert(1))');
  assert.ok(!/onmouseover="/.test(html.replace(/&quot;/g, '')) || !html.includes('" onmouseover'));
  assert.ok(!html.includes('"onmouseover="'));
});

test('inline formatting', () => {
  assert.equal(r('**bold** and *it* and ~~gone~~ and `code`'), '<p><strong>bold</strong> and <em>it</em> and <del>gone</del> and <code>code</code></p>');
  assert.equal(r('2 * 3 * 4'), '<p>2 * 3 * 4</p>');
  assert.equal(r('snake_case_name stays'), '<p>snake_case_name stays</p>');
  assert.equal(r('`<b>`'), '<p><code>&lt;b&gt;</code></p>');
});

test('forged placeholder characters cannot inject output', () => {
  const html = r('hi \u00010\u0002 there');
  assert.ok(!html.includes('undefined'));
});

test('headings, hr, blockquote', () => {
  assert.equal(r('## Title'), '<h2>Title</h2>');
  assert.equal(r('# C#'), '<h1>C#</h1>');
  assert.equal(r('---'), '<hr>');
  assert.equal(r('> quoted **text**'), '<blockquote><p>quoted <strong>text</strong></p></blockquote>');
});

test('nested and ordered lists', () => {
  const html = r('- a\n  - a1\n  - a2\n- b\n\n1. one\n2. two');
  assert.equal(html, '<ul><li>a<ul><li>a1</li><li>a2</li></ul></li><li>b</li></ul><ol><li>one</li><li>two</li></ol>');
  assert.match(r('3. x\n4. y'), /<ol start="3">/);
});

test('task lists', () => {
  assert.match(r('- [x] done\n- [ ] todo'), /<li class="task"><input type="checkbox" disabled checked> done<\/li><li class="task"><input type="checkbox" disabled> todo<\/li>/);
});

test('fenced code with highlighting and copy button', () => {
  const html = r('```js\nconst a = "hi"; // note\n```');
  assert.match(html, /class="code-block"/);
  assert.match(html, /<span class="code-lang">js<\/span>/);
  assert.match(html, /<span class="tok-k">const<\/span>/);
  assert.match(html, /<span class="tok-s">&quot;hi&quot;<\/span>/);
  assert.match(html, /<span class="tok-c">\/\/ note<\/span>/);
  assert.match(html, /class="copy-code"/);
});

test('code content is escaped, never interpreted', () => {
  const html = r('```html\n<div class="x">&amp;</div>\n```');
  assert.ok(!html.includes('<div class="x">'));
  assert.match(html, /&lt;/);
});

test('unclosed fence renders as an open code block while streaming', () => {
  const html = r('Here:\n```python\ndef f(x):\n    return x');
  assert.match(html, /<pre><code class="language-python">/);
  assert.match(html, /<span class="tok-k">def<\/span>/);
});

test('code fence inside a list item', () => {
  const html = r('1. Install:\n   ```bash\n   npm install\n   ```\n2. Run it');
  assert.match(html, /<ol><li>Install:<div class="code-block">/);
  assert.match(html, /npm<\/span> install/);
  assert.match(html, /<li>Run it<\/li>/);
});

test('tables with alignment', () => {
  const html = r('| Name | Qty |\n|:-----|----:|\n| Apple | 3 |\n| Pear | 10 |');
  assert.match(html, /<table>/);
  assert.match(html, /<th class="al-l">Name<\/th><th class="al-r">Qty<\/th>/);
  assert.match(html, /<td class="al-r">10<\/td>/);
});

test('a header-like line without a separator is a normal paragraph', () => {
  assert.equal(r('a | b'), '<p>a | b</p>');
});

test('paragraphs and soft line breaks', () => {
  assert.equal(r('one\ntwo\n\nthree'), '<p>one<br>two</p><p>three</p>');
});

test('empty and non-string input', () => {
  assert.equal(r(''), '');
  assert.equal(r(null), '');
  assert.equal(r(undefined), '');
});

test('does not choke on large input', () => {
  const big = ('word '.repeat(20) + '\n\n').repeat(2000) + '```js\n' + 'let x = 1;\n'.repeat(3000) + '```';
  const t = Date.now();
  const html = r(big);
  assert.ok(html.length > 1000);
  assert.ok(Date.now() - t < 1500, 'rendering took too long');
});
