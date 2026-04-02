import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true, // Позволяет не импортировать describe, it, expect в каждом файле
    environment: 'node',
    include: ['src/**/*.{unit,feature}.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
})