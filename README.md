# FuckLang for VS Code

> The official Visual Studio Code extension for FuckLang — a lightweight, Turing-complete scripting language where the keywords are English profanity.

---

## Overview

This extension provides first-class support for [FuckLang](https://github.com/CaoHaoran-Dev/FuckLang) inside Visual Studio Code. It brings syntax highlighting, smart code snippets, intelligent variable auto-completion (powered by a built-in LSP), and a seamless "one-click run" experience without the need to manually configure the interpreter path.

The extension automatically detects your operating system (Windows, macOS, Linux) and architecture (x64, ARM64, RISC-V, LoongArch64), downloading the correct FuckLang interpreter in the background on first use.

---

## Features

- **Syntax Highlighting** — Full colorization for keywords, operators, built-ins, and string escapes.
- **Smart Code Snippets** — Rapid generation of common FuckLang structures (`shit`, `damn`, `hell`, `orgy`, `bitch`) with intelligent Tab-stops.
- **Intelligent Auto-completion** — A lightweight Language Server (LSP) actively scans your document to suggest user-defined variables and built-in functions.
- **Zero Configuration** — No need to install Go or compile the interpreter yourself. The extension auto-downloads the correct native binary for your platform.
- **One-Click Run** — Execute FuckLang files directly using the ▶️ play button in the top-right corner, via the right-click context menu, or with `Ctrl+F5` (`Cmd+F5` on macOS).
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

The extension will use the integrated terminal to execute the code, ensuring full support for standard input functions like `suck()`.

### Auto-completion & Snippets
- Type `sh` and press `Tab` to instantly expand to `shit name = value`.
- Type `orgy` and press `Tab` to generate a complete C-style loop.
- Type a variable name you previously defined with `shit`, and the LSP will suggest it as you type.

---

## Architecture

Unlike simple grammar-only extensions, this extension is split into two parts to provide dynamic features:

- **Client (`client/src/extension.ts`)** — Manages the interpreter download logic, registers VS Code commands, and spawns the language server.
- **Server (`server/src/server.ts`)** — A Language Server Protocol (LSP) implementation that parses the active document to provide context-aware variable completions.

---

## Extension Settings

Currently, this extension works entirely out of the box. No manual configuration is required. The downloaded binaries are cached in your global VS Code storage directory (`~/.config/Code/User/globalStorage/CaoHaoran-Dev.fucklang-vscode` on Linux, or the equivalent `AppData` location on Windows).

---

## Known Issues

- Hash printing order is unspecified (inherited from FuckLang's Go implementation).
- The LSP currently uses regular expressions for variable extraction. Highly complex macro-level scopes may not be perfectly captured.

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