import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
  // 服务器模块路径
  const serverModule = context.asAbsolutePath(
    path.join('..', 'server', 'out', 'server.js')
  );

  // 如果是开发环境，用 node 运行；如果是调试，开启 inspect 端口
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', '--inspect=6009'] }
    }
  };

  // 客户端配置：告诉它只处理 fucklang 文件
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'fucklang' }],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
    }
  };

  // 创建并启动客户端
  client = new LanguageClient(
    'fucklangLanguageServer',
    'FuckLang Language Server',
    serverOptions,
    clientOptions
  );

  client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}