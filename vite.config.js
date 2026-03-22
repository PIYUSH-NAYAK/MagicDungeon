import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Polyfill Buffer, process, global — required by @solana/web3.js
      // and @magicblock-labs/ephemeral-rollups-sdk in the browser
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
  ],
  optimizeDeps: {
    exclude: [],
    entries: ['src/**/*.{js,jsx,ts,tsx}'],
  },
})
