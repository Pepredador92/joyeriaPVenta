import { build } from 'esbuild';
import path from 'path';

const buildMain = async () => {
  console.log('Building Electron main process...');

  try {
    await build({
      entryPoints: [
        path.resolve(__dirname, '../src/main/main.ts'),
        path.resolve(__dirname, '../src/main/preload.ts')
      ],
      bundle: true,
      platform: 'node',
      target: 'node18',
      format: 'cjs',
      external: ['electron', 'better-sqlite3', 'sharp', 'electron-log'],
      outdir: path.resolve(__dirname, '../dist/main'),
      outExtension: { '.js': '.cjs' },
      sourcemap: true,
      minify: false,
      define: {
        'process.env.NODE_ENV': '"development"'
      }
    });

    console.log('Main process build completed successfully!');
  } catch (error) {
    console.error('Main process build failed:', error);
    process.exit(1);
  }
};

buildMain();
