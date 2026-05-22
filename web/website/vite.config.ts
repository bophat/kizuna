import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { existsSync } from 'fs';
import {defineConfig, loadEnv} from 'vite';

const sharedDir = existsSync(path.resolve(__dirname, 'shared'))
  ? path.resolve(__dirname, 'shared')
  : path.resolve(__dirname, '../shared');

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@izuna/shared': sharedDir,
        react: path.resolve(__dirname, 'node_modules/react'),
        'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
        'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime.js'),
        clsx: path.resolve(__dirname, 'node_modules/clsx'),
        'tailwind-merge': path.resolve(__dirname, 'node_modules/tailwind-merge'),
      },
    },
    server: {
      fs: { allow: ['..'] },
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: process.env.BACKEND_URL || 'http://backend:8000',
          changeOrigin: true,
        },
        '/media': {
          target: process.env.BACKEND_URL || 'http://backend:8000',
          changeOrigin: true,
        }
      }
    },
  };
});
