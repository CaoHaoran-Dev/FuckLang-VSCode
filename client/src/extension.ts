import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;
let cachedBinaryPath: string | null = null;
let outputChannel: vscode.LogOutputChannel;
let terminal: vscode.Terminal | undefined;

export async function activate(context: vscode.ExtensionContext) {
  // log: true 返回 LogOutputChannel，满足 LanguageClientOptions.outputChannel 的类型要求
  outputChannel = vscode.window.createOutputChannel('FuckLang', { log: true });
  context.subscriptions.push(outputChannel);

  // 1. 确保二进制文件存在并获取路径（失败不阻塞 LSP 和命令注册）
  try {
    cachedBinaryPath = await ensureFucklangBinary(context);
  } catch (err) {
    outputChannel.appendLine(`[binary] 初始化失败: ${err}`);
    cachedBinaryPath = null;
  }

  // 2. 注册运行命令
  const runCommand = vscode.commands.registerCommand('fucklang.run', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'fucklang') {
      vscode.window.showErrorMessage('This is not a FuckLang file.');
      return;
    }

    if (!cachedBinaryPath) {
      vscode.window.showErrorMessage('FuckLang interpreter is not available. Check the Output panel.');
      return;
    }

    const document = editor.document;
    // 先保存，保证运行的是磁盘上的最新内容
    if (document.isDirty) {
      const saved = await document.save();
      if (!saved) {
        vscode.window.showErrorMessage('保存文件失败，无法运行');
        return;
      }
    }

    const interpreter = cachedBinaryPath;
    const filePath = document.uri.fsPath;
    const cwd = path.dirname(filePath);

    terminal = getOrCreateTerminal(cwd);
    terminal.show(true);

    // 关键：PowerShell 需要用 & 调用运算符才能执行带引号的路径；
    // cmd / bash / zsh 直接写引号路径即可。
    const cmd = buildRunCommand(interpreter, filePath);
    terminal.sendText(cmd, true);
  });

  context.subscriptions.push(runCommand);

  // 3. 启动 LSP 语言服务器
  // 注意：asAbsolutePath 相对于扩展根目录，server 就在根目录下，不要带 ".."
  const serverModule = context.asAbsolutePath(
    path.join('server', 'out', 'server.js')
  );

  if (!fs.existsSync(serverModule)) {
    outputChannel.appendLine(`[LSP] 服务器入口不存在: ${serverModule}`);
    outputChannel.appendLine('[LSP] 请先在 server 目录执行 npm run compile（或 tsc -b）');
    // 不启动 LSP，但扩展其余功能（运行命令）仍可用
  } else {
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
      },
      outputChannel,
      errorHandler: {
        error: (error, message, count) => {
          outputChannel.appendLine(`[LSP error] ${error?.message ?? error}`);
          return { action: 1 /* Continue */, handled: false } as any;
        },
        closed: () => {
          outputChannel.appendLine('[LSP closed] 服务器连接已关闭，尝试重启由客户端决定');
          return { action: 1 /* Continue */, handled: false } as any;
        }
      }
    };

    client = new LanguageClient(
      'fucklangLanguageServer',
      'FuckLang Language Server',
      serverOptions,
      clientOptions
    );

    try {
      await client.start();
      outputChannel.appendLine('[LSP] 语言服务器已启动');
    } catch (err: any) {
      outputChannel.appendLine(`[LSP] 启动失败: ${err?.stack ?? err}`);
      // 关键：置空，避免 deactivate 对 startFailed 状态调用 stop()
      client = undefined;
    }
  }
}

export async function deactivate(): Promise<void> {
  if (terminal) {
    terminal.dispose();
    terminal = undefined;
  }
  if (client) {
    try {
      await client.stop();
    } catch (err: any) {
      // starting / startFailed 状态下 stop 会抛异常，静默忽略
      console.warn('[LSP] stop 异常（已忽略）:', err?.message ?? err);
    } finally {
      client = undefined;
    }
  }
}

// ---------- 终端复用 ----------

function getOrCreateTerminal(cwd: string): vscode.Terminal {
  if (terminal && terminal.exitStatus === undefined) {
    return terminal;
  }
  terminal = vscode.window.createTerminal({ name: 'FuckLang Run', cwd });
  return terminal;
}

// ---------- 根据 shell 类型构造运行命令 ----------

function buildRunCommand(interpreter: string, filePath: string): string {
  // 判断当前默认终端是否为 PowerShell（Windows 上 VS Code 默认可能是 PowerShell / cmd / Git Bash）
  const shell = vscode.env.shell || '';
  const isPowerShell = /powershell|pwsh/i.test(shell);
  const isWindows = process.platform === 'win32';

  if (isWindows && isPowerShell) {
    // PowerShell：& 是调用运算符，必须加，否则引号路径被当成字符串
    return `& "${interpreter}" "${filePath}"`;
  }

  // cmd / bash / zsh / fish：直接执行
  return `"${interpreter}" "${filePath}"`;
}

// ==========================================
// 核心逻辑：检测、下载并赋权 FuckLang 二进制
// ==========================================

async function ensureFucklangBinary(context: vscode.ExtensionContext): Promise<string | null> {
  const platform = process.platform;
  const arch = process.arch;

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

  if (fs.existsSync(localPath)) {
    const stats = fs.statSync(localPath);
    if (stats.size > 0) {
      return localPath;
    }
    fs.unlinkSync(localPath);
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