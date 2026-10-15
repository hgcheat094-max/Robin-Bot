/*
 * Tiny, dependency-free Markdown renderer with code highlighting.
 *
 * Safety model: ALL input is HTML-escaped before any markup is produced, links
 * are limited to http(s)/mailto, and the output only contains tags generated here.
 * It is also tolerant of half-finished text, so it can re-render on every
 * streamed chunk (an unclosed ``` fence simply renders as an open code block).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MD = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return ESC[c]; });
  }

  /* ------------------------------------------------------------------ */
  /* Syntax highlighting                                                 */
  /* ------------------------------------------------------------------ */

  var WORDS = {
    js: 'async await break case catch class const continue debugger default delete do else export extends finally for from function get if implements import in instanceof interface let new of private protected public readonly return set static super switch this throw try type typeof var void while with yield enum namespace declare abstract as',
    py: 'and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case self cls print',
    clike: 'abstract auto bool boolean break byte case catch char class const continue default defer delete do double else enum export extends extern final finally float fn for foreach func go goto if impl implements import in include inline instanceof int interface let long loop match mod move mut namespace new null operator override package private protected pub public readonly register return select short signed sizeof static string struct super switch template this throw throws trait try type typedef typename union unsafe unsigned use using var virtual void volatile where while yield fun val when object data sealed internal lateinit suspend',
    sh: 'if then else elif fi for while until do done case esac function in select time return exit break continue export local readonly declare unset source alias echo cd ls cat grep sed awk git npm npx pip sudo curl wget',
    sql: 'select from where and or not in is null like between join inner left right outer full cross on group by order having limit offset insert into values update set delete create alter drop table index view database primary key foreign references unique default distinct as union all case when then else end exists count sum avg min max asc desc with returning begin commit rollback',
    css: '',
    yaml: '',
    json: '',
    markup: ''
  };
  var LITERALS = 'true false null undefined NaN Infinity None True False nil TRUE FALSE NULL';

  var FAMILY = {
    js: 'js', javascript: 'js', jsx: 'js', ts: 'js', typescript: 'js', tsx: 'js', mjs: 'js', cjs: 'js', node: 'js',
    json: 'json', jsonc: 'json', json5: 'json',
    py: 'py', python: 'py', python3: 'py',
    sh: 'sh', bash: 'sh', shell: 'sh', zsh: 'sh', console: 'sh', terminal: 'sh',
    c: 'clike', cpp: 'clike', 'c++': 'clike', cc: 'clike', h: 'clike', hpp: 'clike', java: 'clike',
    cs: 'clike', csharp: 'clike', go: 'clike', golang: 'clike', rust: 'clike', rs: 'clike',
    kotlin: 'clike', kt: 'clike', swift: 'clike', php: 'clike', scala: 'clike', dart: 'clike',
    sql: 'sql', mysql: 'sql', postgres: 'sql', postgresql: 'sql', sqlite: 'sql',
    css: 'css', scss: 'css', less: 'css',
    html: 'markup', xml: 'markup', svg: 'markup', vue: 'markup',
    yaml: 'yaml', yml: 'yaml', toml: 'yaml', ini: 'yaml', env: 'yaml'
  };

  var NONE = '(?!)';
  var PATTERNS = {
    js: { comment: '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?(?:\\*\\/|$)', string: '"(?:\\\\.|[^"\\\\\\n])*"?|\'(?:\\\\.|[^\'\\\\\\n])*\'?|`(?:\\\\[\\s\\S]|[^`\\\\])*`?' },
    json: { comment: NONE, string: '"(?:\\\\.|[^"\\\\\\n])*"?' },
    py: { comment: '#[^\\n]*', string: '"""[\\s\\S]*?(?:"""|$)|\'\'\'[\\s\\S]*?(?:\'\'\'|$)|"(?:\\\\.|[^"\\\\\\n])*"?|\'(?:\\\\.|[^\'\\\\\\n])*\'?' },
    sh: { comment: '(?:^|\\s)#[^\\n]*', string: '"(?:\\\\.|[^"\\\\\\n])*"?|\'[^\'\\n]*\'?' },
    clike: { comment: '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?(?:\\*\\/|$)', string: '"(?:\\\\.|[^"\\\\\\n])*"?|\'(?:\\\\.|[^\'\\\\\\n])*\'?|`(?:\\\\[\\s\\S]|[^`\\\\])*`?' },
    sql: { comment: '--[^\\n]*|\\/\\*[\\s\\S]*?(?:\\*\\/|$)', string: '\'(?:\'\'|[^\'])*\'?|"[^"\\n]*"?' },
    css: { comment: '\\/\\*[\\s\\S]*?(?:\\*\\/|$)', string: '"(?:\\\\.|[^"\\\\\\n])*"?|\'(?:\\\\.|[^\'\\\\\\n])*\'?', keyword: '@[a-z-]+|\\.[a-zA-Z_][\\w-]*|#[a-zA-Z_][\\w-]*|[a-z-]+(?=\\s*:)' },
    yaml: { comment: '#[^\\n]*', string: '"(?:\\\\.|[^"\\\\\\n])*"?|\'[^\'\\n]*\'?', keyword: '^[ \\t-]*[\\w.-]+(?=\\s*:)' },
    markup: { comment: '<!--[\\s\\S]*?(?:-->|$)', string: '"[^"\\n]*"?|\'[^\'\\n]*\'?', keyword: '<\\/?[a-zA-Z][\\w:.-]*|\\/?>' }
  };

  var regexCache = {};
  function getRegex(family) {
    if (regexCache[family]) return regexCache[family];
    var p = PATTERNS[family];
    var words = (WORDS[family] || '').split(' ').filter(Boolean);
    var keyword = p.keyword || (words.length ? '\\b(?:' + words.join('|') + ')\\b' : NONE);
    var literal = family === 'markup' || family === 'css' ? NONE : '\\b(?:' + LITERALS.split(' ').join('|') + ')\\b';
    var number = family === 'markup' ? NONE : '\\b(?:0x[\\da-fA-F]+|\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)\\b';
    var src = '(' + p.comment + ')|(' + p.string + ')|(' + number + ')|(' + literal + ')|(' + keyword + ')';
    var flags = 'g' + (family === 'sql' ? 'i' : '') + (family === 'yaml' || family === 'sh' ? 'm' : '');
    regexCache[family] = new RegExp(src, flags);
    return regexCache[family];
  }

  function highlight(code, lang) {
    var family = FAMILY[String(lang || '').toLowerCase()];
    if (!family) return esc(code);
    var re = getRegex(family);
    re.lastIndex = 0;
    var out = '';
    var last = 0;
    var m;
    while ((m = re.exec(code))) {
      if (m[0] === '') { re.lastIndex++; continue; }
      var cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'n' : m[4] ? 'l' : 'k';
      out += esc(code.slice(last, m.index)) + '<span class="tok-' + cls + '">' + esc(m[0]) + '</span>';
      last = m.index + m[0].length;
    }
    return out + esc(code.slice(last));
  }

  var COPY_SVG =
    '<svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>';

  function codeBlock(code, lang) {
    return (
      '<div class="code-block"><div class="code-head"><span class="code-lang">' + esc(lang || 'text') + '</span>' +
      '<button type="button" class="copy-code" aria-label="Copy code">' + COPY_SVG + '<span class="copy-label">Copy code</span></button></div>' +
      '<pre><code' + (lang ? ' class="language-' + esc(lang) + '"' : '') + '>' + highlight(code, lang) + '</code></pre></div>'
    );
  }

  /* ------------------------------------------------------------------ */
  /* Inline                                                              */
  /* ------------------------------------------------------------------ */

  function emphasis(t) {
    return t
      .replace(/\*\*\*(?=\S)([\s\S]*?\S)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?!\w)/g, '$1<strong>$2</strong>')
      .replace(/(^|[^\w*])\*(?=[^\s*])([^*\n]*?[^\s*])\*(?!\w)/g, '$1<em>$2</em>')
      .replace(/(^|[^\w])_(?=[^\s_])([^_\n]*?[^\s_])_(?!\w)/g, '$1<em>$2</em>')
      .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');
  }

  function inline(src) {
    // Strip the control characters used as placeholders so input cannot forge them.
    src = String(src).replace(/[\u0001\u0002]/g, '');
    var tokens = [];
    function stash(html) {
      tokens.push(html);
      return '\u0001' + (tokens.length - 1) + '\u0002';
    }

    var s = src.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, function (_m, _ticks, code) {
      return stash('<code>' + esc(code.replace(/^ (.*) $/, '$1')) + '</code>');
    });

    s = esc(s);

    // [label](https://url "optional title")
    s = s.replace(/\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)(?:\s+&quot;[^\n]*?&quot;)?\)/gi, function (_m, label, url) {
      return stash('<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + emphasis(label) + '</a>');
    });

    // Bare URLs (already escaped, so stop before an escaped quote or bracket).
    s = s.replace(/(^|[\s(>])(https?:\/\/(?:(?!&quot;|&#39;|&lt;|&gt;)[^\s])*[^\s.,;:!?)\]])/g, function (_m, pre, url) {
      return pre + stash('<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + '</a>');
    });

    s = emphasis(s).replace(/\n/g, '<br>');

    for (var pass = 0; pass < 4 && /\u0001\d+\u0002/.test(s); pass++) {
      s = s.replace(/\u0001(\d+)\u0002/g, function (_m, i) { return tokens[+i]; });
    }
    return s;
  }

  /* ------------------------------------------------------------------ */
  /* Blocks                                                              */
  /* ------------------------------------------------------------------ */

  var FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*([\w+#.-]*)[^`]*$/;
  var LIST_RE = /^(\s*)([-*+]|\d{1,9}[.)])[ \t]+(.*)$/;
  var HR_RE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
  var HEADING_RE = /^ {0,3}(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/;
  var TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;
  var BLANK = /^\s*$/;

  function closingFence(fence) {
    return new RegExp('^ {0,3}' + (fence.charAt(0) === '`' ? '`' : '~') + '{' + fence.length + ',}[ \\t]*$');
  }

  function splitRow(line) {
    var t = line.trim().replace(/\\\|/g, '\u0003');
    if (t.charAt(0) === '|') t = t.slice(1);
    if (t.charAt(t.length - 1) === '|') t = t.slice(0, -1);
    return t.split('|').map(function (c) { return c.replace(/\u0003/g, '|').trim(); });
  }

  function isTableStart(lines, i) {
    var head = lines[i];
    var sep = lines[i + 1];
    if (head === undefined || sep === undefined || head.indexOf('|') === -1) return false;
    if (!TABLE_SEP.test(sep) || sep.indexOf('-') === -1) return false;
    return splitRow(head).length === splitRow(sep).length;
  }

  function startsBlock(line, next) {
    return (
      FENCE.test(line) || HEADING_RE.test(line) || HR_RE.test(line) || /^ {0,3}>/.test(line) ||
      LIST_RE.test(line) || isTableStart([line, next], 0)
    );
  }

  function table(lines, i) {
    var head = splitRow(lines[i]);
    var aligns = splitRow(lines[i + 1]).map(function (c) {
      var l = c.charAt(0) === ':';
      var r = c.charAt(c.length - 1) === ':';
      return l && r ? 'al-c' : r ? 'al-r' : l ? 'al-l' : '';
    });
    var html = '<div class="table-wrap"><table><thead><tr>';
    head.forEach(function (c, k) {
      html += '<th' + (aligns[k] ? ' class="' + aligns[k] + '"' : '') + '>' + inline(c) + '</th>';
    });
    html += '</tr></thead><tbody>';
    i += 2;
    while (i < lines.length && !BLANK.test(lines[i]) && lines[i].indexOf('|') !== -1) {
      var cells = splitRow(lines[i]);
      html += '<tr>';
      for (var k = 0; k < head.length; k++) {
        html += '<td' + (aligns[k] ? ' class="' + aligns[k] + '"' : '') + '>' + inline(cells[k] || '') + '</td>';
      }
      html += '</tr>';
      i++;
    }
    return [html + '</tbody></table></div>', i];
  }

  function list(lines, i) {
    var first = LIST_RE.exec(lines[i]);
    var base = first[1].length;
    var ordered = /\d/.test(first[2]);
    var start = ordered ? parseInt(first[2], 10) : 1;
    var items = [];
    var n = lines.length;
    var prevBlank = false;

    while (i < n) {
      var line = lines[i];

      if (BLANK.test(line)) {
        var j = i + 1;
        while (j < n && BLANK.test(lines[j])) j++;
        if (j >= n) { i = j; break; }
        var nextLine = lines[j];
        var nm = LIST_RE.exec(nextLine);
        var nind = nextLine.match(/^\s*/)[0].length;
        var continues = nm
          ? nind >= base && (nind >= base + 2 || /\d/.test(nm[2]) === ordered)
          : nind >= base + 2;
        if (!continues) break;
        i = j;
        prevBlank = true;
        continue;
      }

      var m = LIST_RE.exec(line);
      var ind = line.match(/^\s*/)[0].length;

      if (m) {
        if (ind < base) break;
        if (ind >= base + 2 && items.length) {
          var sub = list(lines, i);
          items[items.length - 1].kids.push(sub[0]);
          i = sub[1];
          prevBlank = false;
          continue;
        }
        if (/\d/.test(m[2]) !== ordered) break;
        items.push({ lines: [m[3]], kids: [] });
        i++;
        prevBlank = false;
        continue;
      }

      if (!items.length) break;
      var last = items[items.length - 1];

      if (ind >= base + 2) {
        var fm = FENCE.exec(line.trim());
        if (fm) {
          var close = closingFence(fm[1]);
          var strip = new RegExp('^ {0,' + ind + '}');
          var code = [];
          i++;
          while (i < n && !close.test(lines[i].trim())) { code.push(lines[i].replace(strip, '')); i++; }
          i++;
          last.kids.push(codeBlock(code.join('\n'), fm[2]));
        } else {
          last.lines.push(line.trim());
          i++;
        }
        prevBlank = false;
        continue;
      }

      // Lazy continuation of the previous item's paragraph.
      if (!prevBlank && !startsBlock(line, lines[i + 1])) {
        last.lines.push(line.trim());
        i++;
        continue;
      }
      break;
    }

    var html = ordered ? '<ol' + (start !== 1 ? ' start="' + start + '"' : '') + '>' : '<ul>';
    items.forEach(function (it) {
      var text = it.lines.join('\n');
      var task = /^\[( |x|X)\][ \t]+/.exec(text);
      var box = '';
      if (task) {
        box = '<input type="checkbox" disabled' + (task[1] === ' ' ? '' : ' checked') + '> ';
        text = text.slice(task[0].length);
      }
      html += '<li' + (task ? ' class="task"' : '') + '>' + box + inline(text) + it.kids.join('') + '</li>';
    });
    return [html + (ordered ? '</ol>' : '</ul>'), i];
  }

  function blocks(lines) {
    var out = [];
    var i = 0;
    var n = lines.length;

    while (i < n) {
      var line = lines[i];
      if (BLANK.test(line)) { i++; continue; }

      var f = FENCE.exec(line);
      if (f) {
        var close = closingFence(f[1]);
        var code = [];
        i++;
        while (i < n && !close.test(lines[i])) { code.push(lines[i]); i++; }
        i++; // closing fence (or end of input while streaming)
        out.push(codeBlock(code.join('\n'), f[2]));
        continue;
      }

      var hm = HEADING_RE.exec(line);
      if (hm) {
        var lvl = hm[1].length;
        out.push('<h' + lvl + '>' + inline(hm[2]) + '</h' + lvl + '>');
        i++;
        continue;
      }

      if (HR_RE.test(line)) { out.push('<hr>'); i++; continue; }

      if (/^ {0,3}>/.test(line)) {
        var inner = [];
        while (i < n && /^ {0,3}>/.test(lines[i])) {
          inner.push(lines[i].replace(/^ {0,3}> ?/, ''));
          i++;
        }
        out.push('<blockquote>' + blocks(inner) + '</blockquote>');
        continue;
      }

      if (isTableStart(lines, i)) {
        var t = table(lines, i);
        out.push(t[0]);
        i = t[1];
        continue;
      }

      if (LIST_RE.test(line)) {
        var l = list(lines, i);
        out.push(l[0]);
        i = l[1];
        continue;
      }

      var buf = [line];
      i++;
      while (i < n && !BLANK.test(lines[i]) && !startsBlock(lines[i], lines[i + 1])) {
        buf.push(lines[i]);
        i++;
      }
      out.push('<p>' + inline(buf.join('\n')) + '</p>');
    }
    return out.join('');
  }

  function render(src) {
    return blocks(String(src == null ? '' : src).replace(/\r\n?/g, '\n').split('\n'));
  }

  return { render: render, highlight: highlight, esc: esc };
});
