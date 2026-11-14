import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;
let cachedBinaryPath: string | null = null;

export async function activate(context: vscode.ExtensionContext) {
  // 1. 确保二进制文件存在并获取路径
  cachedBinaryPath = await ensureFucklangBinary(context);

  // 2. 注册运行 FuckLang 的命令
  let runCommand = vscode.commands.registerCommand('fucklang.run', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const document = editor.document;
    if (document.languageId !== 'fucklang') {
      vscode.window.showErrorMessage('This is not a FuckLang file.');
      return;
    }

    if (!cachedBinaryPath) {
      vscode.window.showErrorMessage('FuckLang interpreter is not available.');
      return;
    }

    // 运行前保存当前文件到临时文件
    const tempFilePath = path.join(
      context.globalStorageUri.fsPath,
      `temp_run_${Date.now()}.fuck`
    );
    fs.writeFileSync(tempFilePath, document.getText());

    // 使用 VS Code 终端执行
    const terminal = vscode.window.createTerminal({
      name: 'FuckLang Run',
      cwd: path.dirname(document.uri.fsPath)
    });
    terminal.show();
    terminal.sendText(`& "${cachedBinaryPath}" "${tempFilePath}"`);
  });

  context.subscriptions.push(runCommand);

  // 3. 启动 LSP 语言服务器
  const serverModule = context.asAbsolutePath(
    path.join('..', 'server', 'out', 'server.js')
  );

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', '--inspect=6009'] }
    }
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'fucklang' }],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher('**/*.fuck')
    }
  };

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

// ==========================================
// 核心逻辑：检测、下载并赋权 FuckLang 二进制
// ==========================================

async function ensureFucklangBinary(context: vscode.ExtensionContext): Promise<string | null> {
  const platform = process.platform;
  const arch = process.arch;
  
  // 映射表
  const downloadUrls: Record<string, string> = {
    "fucklang-darwin-arm64": "https://github.com/CaoHaoran-Dev/FuckLang/releases/latest/download/fucklang-darwin-arm64",
    "fucklang-darwin-amd64": "https://github.com/CaoHaoran-Dev/FuckLang/releases/latest/download/fucklang-darwin-amd64",
    "fucklang-linux-arm64": "https://github.com/CaoHaoran-Dev/FuckLang/releases/latest/download/fucklang-linux-arm64",
    "fucklang-linux-amd64": "https://github.com/CaoHaoran-Dev/FuckLang/releases/latest/download/fucklang-linux-amd64",
    "fucklang-linux-riscv64": "https://github.com/CaoHaoran-Dev/FuckLang/releases/latest/download/fucklang-linux-riscv64",
    "fucklang-linux-loong64": "https://github.com/CaoHaoran-Dev/FuckLang/releases/latest/download/fucklang-linux-loong64",
    "fucklang-windows-arm64.exe": "https://github.com/CaoHaoran-Dev/FuckLang/releases/latest/download/fucklang-windows-arm64.exe",
    "fucklang-windows-amd64.exe": "https://github.com/CaoHaoran-Dev/FuckLang/releases/latest/download/fucklang-windows-amd64.exe"
  };

  // 确定目标文件名
  let targetName = '';
  if (platform === 'win32') {
    targetName = arch === 'x64' ? 'fucklang-windows-amd64.exe' : 'fucklang-windows-arm64.exe';
  } else if (platform === 'darwin') {
    targetName = arch === 'x64' ? 'fucklang-darwin-amd64' : 'fucklang-darwin-arm64';
  } else if (platform === 'linux') {
    if (arch === 'arm64') targetName = 'fucklang-linux-arm64';
    else if (arch === 'riscv64') targetName = 'fucklang-linux-riscv64';
    else if (arch === 'loong64') targetName = 'fucklang-linux-loong64';
    else targetName = 'fucklang-linux-amd64';
  } else {
    vscode.window.showErrorMessage(`FuckLang is not supported on this platform: ${platform} ${arch}`);
    return null;
  }

  const downloadUrl = downloadUrls[targetName];
  if (!downloadUrl) {
    vscode.window.showErrorMessage(`Could not find download URL for ${targetName}`);
    return null;
  }

  const binDir = context.globalStorageUri.fsPath;
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }
  
  const localPath = path.join(binDir, targetName);

  // 检查是否已经存在且大小大于 0
  if (fs.existsSync(localPath)) {
    const stats = fs.statSync(localPath);
    // 只要文件大于 0 字节就认为下载过了（应对小体积二进制）
    if (stats.size > 0) {
      return localPath;
    } else {
      fs.unlinkSync(localPath); // 0 字节，删掉重下
    }
  }

  return vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: `Downloading FuckLang interpreter (${targetName})...`,
    cancellable: false
  }, async () => {
    try {
      await downloadFile(downloadUrl, localPath);
      
      if (platform !== 'win32') {
        fs.chmodSync(localPath, 0o755);
      }
      
      vscode.window.showInformationMessage('FuckLang interpreter downloaded and configured successfully!');
      return localPath;
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to download FuckLang: ${error}`);
      return null;
    }
  });
}

// 使用原生 fetch 下载，彻底解决 0KB 问题
async function downloadFile(url: string, dest: string): Promise<void> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'vscode-fucklang-extension' },
    redirect: 'follow'
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(dest, buffer);
}