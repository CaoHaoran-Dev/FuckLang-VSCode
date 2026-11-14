import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InitializeResult
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';

// 创建 LSP 连接
const connection = createConnection(ProposedFeatures.all);

// 创建文档管理器
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // 告诉客户端支持代码补全
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ['.']
      }
    }
  };
  return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
  }
});

// ---------------- 核心补全逻辑 ----------------

connection.onCompletion(
  (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    // 获取当前文档内容
    const document = documents.get(_textDocumentPosition.textDocument.uri);
    if (!document) return [];

    const text = document.getText();

    // 1. 先用正则提取当前文件里所有的 shit 定义的变量名
    const varRegex = /shit\s+([a-zA-Z_]\w*)/g;
    let match;
    const completions: CompletionItem[] = [];
    
    // 防止重复
    const existingVars = new Set<string>();

    while ((match = varRegex.exec(text)) !== null) {
      const varName = match[1];
      if (!existingVars.has(varName)) {
        existingVars.add(varName);
        completions.push({
          label: varName,
          kind: CompletionItemKind.Variable,
          data: 1 // 用于 resolve
        });
      }
    }

    // 2. 也可以硬编码一些内置函数补全
    const builtins = ['len', 'push', 'type', 'suck', 'fucking', 'fuckoff'];
    for (const b of builtins) {
      completions.push({
        label: b,
        kind: CompletionItemKind.Function,
        data: 2
      });
    }

    return completions;
  }
);

connection.onCompletionResolve(
  (item: CompletionItem): CompletionItem => {
    if (item.data === 1) {
      item.detail = 'FuckLang Variable';
      item.documentation = '用户自定义的变量';
    } else if (item.data === 2) {
      item.detail = 'FuckLang Builtin Function';
      item.documentation = 'FuckLang 内置函数';
    }
    return item;
  }
);

// 监听文档变化
documents.listen(connection);

// 启动服务器
connection.listen();