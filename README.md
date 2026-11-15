# FuckLang for VS Code

> The official Visual Studio Code extension for FuckLang — a lightweight, Turing-complete scripting language where the keywords are English profanity.

---

## Overview

This extension provides first-class support for [FuckLang](https://github.com/CaoHaoran-Dev/FuckLang) inside Visual Studio Code. It brings syntax highlighting, smart code snippets, intelligent auto-completion (powered by a built-in LSP), and a seamless "one-click run" experience without the need to manually configure the interpreter path.

The extension automatically detects your operating system (Windows, macOS, Linux) and architecture (x64, ARM64, RISC-V, LoongArch64), downloading the correct FuckLang interpreter in the background on first use.

---

## Features

- **Syntax Highlighting** — Full colorization for keywords, operators, built-ins, namespaces, and string escapes.
- **Smart Code Snippets** — Rapid generation of common FuckLang structures (`shit`, `damn`, `hell`, `orgy`, `bitch`) plus `str.*`, `arr.*`, `file.*` method snippets.
- **Intelligent Auto-completion** — A lightweight Language Server (LSP) scans your document and suggests:
  - User-defined variables (`shit x = ...`)
  - Named functions (`bitch foo(...)`)
  - Function parameters (both named and anonymous functions)
  - `orgy` loop variables
  - All built-in functions with signature + documentation
  - Namespace members after typing `.` (`str.` → `len`, `upper`, ...)
- **Comment/String Aware** — Auto-completion skips symbols that appear inside `//` comments or `"..."` strings, so `// shit fake` won't pollute your suggestions.
- **Zero Configuration** — No need to install Go or compile the interpreter yourself. The extension auto-downloads the correct native binary for your platform.
- **One-Click Run** — Execute FuckLang files using the ▶️ play button, the right-click context menu, or `Ctrl+F5` (`Cmd+F5` on macOS).
- **Shell-Aware Execution** — Automatically adapts the run command for PowerShell (`& "exe" "file"`), cmd, bash, and zsh, so quoted paths with spaces work everywhere.
- **Resilient LSP Startup** — If the language server fails to start, the extension logs the real reason to the `FuckLang` Output channel and keeps the run command working instead of spamming "Client is not running" errors.
- **Multi-Architecture** — Native support for x86_64, ARM64 (macOS/Linux/Windows), RISC-V (Linux), and LoongArch64 (Linux).

---

## Usage

Create a file named `hello.fuck`:

```fuck
shit name = "world"
fuck "hello " + name
```

### Running the Code
1. Click the **▶️ (Run)** button in the editor title bar.
2. Or right-click inside the editor and select **Run FuckLang File**.
3. Or press **`Ctrl+F5`** (Windows/Linux) / **`Cmd+F5`** (macOS).

The extension uses the integrated terminal to execute the code, ensuring full support for standard input functions like `suck()`.

### Auto-completion & Snippets
- Type `sh` and press `Tab` to expand to `shit name = value`.
- Type `orgy` and press `Tab` to generate a complete C-style loop.
- Type `str.` to see all string namespace methods.
- Type a variable or function name you previously defined and the LSP will suggest it as you type.
- Completion is suppressed inside comments and strings.

### Diagnostics & Logs
Open the **Output** panel and select **FuckLang** to see:
- Interpreter download progress
- LSP startup status (`[LSP] 语言服务器已启动`)
- Any LSP errors with full stack traces
- Missing server module warnings if `server/out/server.js` hasn't been compiled

---

## Architecture

Unlike simple grammar-only extensions, this extension is split into two parts to provide dynamic features:

- **Client (`client/src/extension.ts`)** — Manages the interpreter download logic, registers VS Code commands, spawns the language server, and handles graceful startup/shutdown.
- **Server (`server/src/server.ts`)** — A Language Server Protocol (LSP) implementation that parses the active document to provide context-aware variable, function, parameter, and namespace completions.

### Interpreter Resolution

On first use the extension detects your platform and architecture, downloads the matching FuckLang binary from the official GitHub releases, and caches it in VS Code's global storage directory:

- **Windows**: `%APPDATA%\Code\User\globalStorage\caohaoran-dev.fucklang-vscode\`
- **macOS**: `~/Library/Application Support/Code/User/globalStorage/caohaoran-dev.fucklang-vscode/`
- **Linux**: `~/.config/Code/User/globalStorage/caohaoran-dev.fucklang-vscode/`

Subsequent runs reuse the cached binary with no network access.

Supported targets:

| Platform | Architectures |
| :--- | :--- |
| Windows | x86_64 (`amd64`), ARM64 |
| macOS | Intel (`amd64`), Apple Silicon (`arm64`) |
| Linux | x86_64 (`amd64`), ARM64, RISC-V (`riscv64`), LoongArch64 |

---

## Known Issues

- Hash printing order is unspecified (inherited from FuckLang's Go implementation).
- The LSP uses masked regex scanning (comments and strings are blanked before matching). Highly nested or dynamically generated code may not be perfectly captured, but every statically declared symbol is.
- `else damn` snippets must be inserted immediately after the closing `}` of the preceding block.

---

## Contributing

Contributions, issues, and feature requests are welcome!
Feel free to check the [issues page](https://github.com/CaoHaoran-Dev/FuckLang-VSCode/issues).

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

## License

This project is licensed under the [MIT License](LICENSE).