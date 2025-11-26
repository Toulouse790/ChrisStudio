import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
        },
      },
      plugins: [
        react(),
        viteStaticCopy({
            targets: [
                {
                    src: 'node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js',
                    dest: 'ffmpeg'
                },
                {
                    src: 'node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm',
                    dest: 'ffmpeg'
                }
            ]
        })
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
