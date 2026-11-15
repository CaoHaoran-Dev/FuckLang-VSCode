import { build } from 'esbuild';

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  external: ['vscode'],  // vscode 模块由扩展宿主提供，不能打包
};

// 客户端 bundle
await build({
  ...shared,
  entryPoints: ['client/out/extension.js'],
  outfile: 'dist/extension.js',
  sourcemap: false,
  minify: true,
});

// 服务端 bundle
await build({
  ...shared,
  entryPoints: ['server/out/server.js'],
  outfile: 'dist/server.js',
  sourcemap: false,
  minify: true,
});

console.log('bundled client and server into dist/');