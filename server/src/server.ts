import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InitializeResult,
  MarkupKind
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;

connection.onInitialize((params: InitializeParams): InitializeResult => {
  const capabilities = params.capabilities;
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ['.']
      }
    }
  };
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
  }
});

// ---------------- 内置符号表 ----------------

interface BuiltinDoc {
  label: string;
  detail: string;
  documentation: string;
  kind: CompletionItemKind;
}

const TOP_BUILTINS: BuiltinDoc[] = [
  { label: 'len', detail: 'len(x)', documentation: '返回 String / Array / Hash 的长度', kind: CompletionItemKind.Function },
  { label: 'push', detail: 'push(arr, v)', documentation: '原地向数组末尾追加元素，返回同一个数组', kind: CompletionItemKind.Function },
  { label: 'type', detail: 'type(x)', documentation: '返回值的类型名，如 "INTEGER"、"HASH"', kind: CompletionItemKind.Function },
  { label: 'suck', detail: 'suck()', documentation: '从标准输入读取一行，返回 String', kind: CompletionItemKind.Function },
  { label: 'fucking', detail: 'fucking(fmt, ...)', documentation: 'fmt.Sprintf 风格的格式化打印', kind: CompletionItemKind.Function },
  { label: 'fuckoff', detail: 'fuckoff(code [, msg])', documentation: '以整数 code 退出程序，可选错误信息', kind: CompletionItemKind.Function }
];

const NAMESPACES: Record<string, BuiltinDoc[]> = {
  str: [
    { label: 'len', detail: 'str.len(s)', documentation: '字符串字节长度', kind: CompletionItemKind.Method },
    { label: 'upper', detail: 'str.upper(s)', documentation: '转大写', kind: CompletionItemKind.Method },
    { label: 'lower', detail: 'str.lower(s)', documentation: '转小写', kind: CompletionItemKind.Method },
    { label: 'trim', detail: 'str.trim(s)', documentation: '去除首尾空白', kind: CompletionItemKind.Method },
    { label: 'split', detail: 'str.split(s, sep)', documentation: '按分隔符拆成 Array', kind: CompletionItemKind.Method },
    { label: 'contains', detail: 'str.contains(s, sub)', documentation: '子串判断', kind: CompletionItemKind.Method },
    { label: 'replace', detail: 'str.replace(s, old, new)', documentation: '替换所有出现', kind: CompletionItemKind.Method },
    { label: 'join', detail: 'str.join(arr, sep)', documentation: '用分隔符连接字符串数组', kind: CompletionItemKind.Method }
  ],
  arr: [
    { label: 'len', detail: 'arr.len(a)', documentation: '数组长度', kind: CompletionItemKind.Method },
    { label: 'push', detail: 'arr.push(a, v)', documentation: '原地追加并返回数组', kind: CompletionItemKind.Method },
    { label: 'pop', detail: 'arr.pop(a)', documentation: '弹出并返回最后一个元素', kind: CompletionItemKind.Method },
    { label: 'slice', detail: 'arr.slice(a, i, j)', documentation: '子数组 [i:j]', kind: CompletionItemKind.Method },
    { label: 'contains', detail: 'arr.contains(a, v)', documentation: '成员判断', kind: CompletionItemKind.Method },
    { label: 'keys', detail: 'arr.keys(h)', documentation: 'Hash 的键数组', kind: CompletionItemKind.Method },
    { label: 'values', detail: 'arr.values(h)', documentation: 'Hash 的值数组', kind: CompletionItemKind.Method }
  ],
  file: [
    { label: 'read', detail: 'file.read(path)', documentation: '读取整个文件为 String', kind: CompletionItemKind.Method },
    { label: 'write', detail: 'file.write(path, content)', documentation: '写入文件（0644）', kind: CompletionItemKind.Method },
    { label: 'exists', detail: 'file.exists(path)', documentation: '文件是否存在', kind: CompletionItemKind.Method }
  ]
};

// ---------------- 源码扫描 ----------------

interface SymbolInfo {
  name: string;
  kind: CompletionItemKind;
  detail: string;
}

// 去掉注释和字符串内容，保留长度以便位置计算（用空格替换）
function maskCommentsAndStrings(text: string): string {
  let out = '';
  let i = 0;
  const n = text.length;
  let inString = false;
  let inLineComment = false;

  while (i < n) {
    const c = text[i];
    const next = i + 1 < n ? text[i + 1] : '';

    if (inLineComment) {
      if (c === '\n') {
        inLineComment = false;
        out += c;
      } else {
        out += ' ';
      }
      i++;
      continue;
    }

    if (inString) {
      if (c === '\\' && i + 1 < n) {
        out += '  ';
        i += 2;
        continue;
      }
      if (c === '"') {
        inString = false;
        out += c;
      } else {
        out += c === '\n' ? '\n' : ' ';
      }
      i++;
      continue;
    }

    if (c === '/' && next === '/') {
      inLineComment = true;
      out += '  ';
      i += 2;
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
      i++;
      continue;
    }

    out += c;
    i++;
  }
  return out;
}

function collectSymbols(masked: string): SymbolInfo[] {
  const found = new Map<string, SymbolInfo>();

  const add = (s: SymbolInfo) => {
    if (!s.name) return;
    // 后定义覆盖前定义，但类型不同则保留先出现的（变量优先）
    if (!found.has(s.name)) found.set(s.name, s);
  };

  // 1) shit name = ...
  for (const m of masked.matchAll(/\bshit\s+([A-Za-z_]\w*)/g)) {
    add({ name: m[1], kind: CompletionItemKind.Variable, detail: 'FuckLang 变量' });
  }

  // 2) bitch name(params) { ... }
  for (const m of masked.matchAll(/\bbitch\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/g)) {
    add({ name: m[1], kind: CompletionItemKind.Function, detail: `FuckLang 函数 (${m[2].trim()})` });
    for (const p of m[2].split(',')) {
      const name = p.trim();
      if (/^[A-Za-z_]\w*$/.test(name)) {
        add({ name, kind: CompletionItemKind.Variable, detail: 'FuckLang 函数参数' });
      }
    }
  }

  // 3) bitch(params) { ... } 匿名函数参数
  for (const m of masked.matchAll(/\bbitch\s*\(([^)]*)\)\s*\{/g)) {
    for (const p of m[1].split(',')) {
      const name = p.trim();
      if (/^[A-Za-z_]\w*$/.test(name)) {
        add({ name, kind: CompletionItemKind.Variable, detail: 'FuckLang 匿名函数参数' });
      }
    }
  }

  // 4) orgy shit i = ...; ...
  for (const m of masked.matchAll(/\borgy\s+shit\s+([A-Za-z_]\w*)/g)) {
    add({ name: m[1], kind: CompletionItemKind.Variable, detail: 'FuckLang 循环变量' });
  }

  // 5) for 循环里可能出现的 shit i += / -= ...
  for (const m of masked.matchAll(/\b([A-Za-z_]\w*)\s*(\+=|-=|\*=|\/=)/g)) {
    // 只补那些没被显式声明过的？不，复合赋值也可能是外部变量，尽量补全
    if (!found.has(m[1])) {
      add({ name: m[1], kind: CompletionItemKind.Variable, detail: 'FuckLang 变量' });
    }
  }

  return [...found.values()];
}

function isInsideCommentOrString(text: string, offset: number): boolean {
  const masked = maskCommentsAndStrings(text);
  // masked 在注释/字符串内部用空格填充，看当前位置原始字符是否还是原样
  // 简化：如果在 masked 中该位置是空格，且原文不是空格，则认为在注释/字符串内
  const orig = text[offset] ?? '';
  const m = masked[offset] ?? '';
  return m === ' ' && orig !== ' ' && orig !== '\n';
}

// ---------------- 补全 ----------------

connection.onCompletion(
  (params: TextDocumentPositionParams): CompletionItem[] => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];

    const text = document.getText();
    const offset = document.offsetAt(params.position);

    // 光标在注释/字符串里不提示
    if (isInsideCommentOrString(text, Math.max(0, offset - 1))) {
      return [];
    }

    // 取当前行的前缀（到光标）
    const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
    const before = text.slice(lineStart, offset);

    // 成员访问：xxx. 前缀
    const memberMatch = /([A-Za-z_]\w*)\.\s*(\w*)$/.exec(before);
    if (memberMatch) {
      const ns = memberMatch[1];
      const items = NAMESPACES[ns];
      if (items) {
        return items.map(it => ({
          label: it.label,
          kind: it.kind,
          detail: it.detail,
          documentation: { kind: MarkupKind.Markdown, value: '```fuck\n' + it.detail + '\n```\n' + it.documentation },
          data: { source: 'namespace', ns }
        }));
      }
      return [];
    }

    const symbols = collectSymbols(maskCommentsAndStrings(text));
    const items: CompletionItem[] = [];

    for (const s of symbols) {
      items.push({
        label: s.name,
        kind: s.kind,
        detail: s.detail,
        data: { source: 'symbol' }
      });
    }

    for (const b of TOP_BUILTINS) {
      items.push({
        label: b.label,
        kind: b.kind,
        detail: b.detail,
        documentation: { kind: MarkupKind.Markdown, value: '```fuck\n' + b.detail + '\n```\n' + b.documentation },
        data: { source: 'builtin' }
      });
    }

    // 命名空间本身也提示
    for (const ns of Object.keys(NAMESPACES)) {
      items.push({
        label: ns,
        kind: CompletionItemKind.Module,
        detail: `FuckLang ${ns}. 命名空间`,
        data: { source: 'namespace-root' }
      });
    }

    return items;
  }
);

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  return item;
});

documents.listen(connection);
connection.listen();