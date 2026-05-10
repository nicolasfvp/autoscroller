import { defineConfig } from 'vite'

export default defineConfig({
    base: './',
    server: {
        host: true
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser']
                }
            }
        }
    }
})
