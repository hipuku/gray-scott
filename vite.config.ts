/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@kern': path.resolve(__dirname, 'node_modules/kern/src'),
      // Deduplicate lucide-react so kern and gray-scott share one version/types.
      // Kern declares lucide-react as a peerDependency; without this alias the
      // symlinked kern resolves to its own devDep copy (different version → TS
      // nominal type mismatch on LucideIcon).
      'lucide-react': path.resolve(__dirname, 'node_modules/lucide-react'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
