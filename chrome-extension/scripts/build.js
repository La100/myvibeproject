#!/usr/bin/env node

import { execSync } from 'child_process'
import { copyFileSync, mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const distDir = join(rootDir, 'dist')

console.log('🚀 Building Chrome Extension React...')

// Run vite build
console.log('📦 Running Vite build...')
execSync('vite build', { stdio: 'inherit', cwd: rootDir })

// Create icons directory
const iconsDir = join(distDir, 'icons')
if (!existsSync(iconsDir)) {
    mkdirSync(iconsDir, { recursive: true })
}

// Copy manifest.json
console.log('📄 Copying manifest.json...')
copyFileSync(
    join(rootDir, 'manifest.json'),
    join(distDir, 'manifest.json')
)

// Copy icons from original extension
// console.log('🎨 Copying icons...')
// const originalIconsDir = join(rootDir, '..', '..', 'chrome-extension', 'icons')
// copyFileSync(
//     join(originalIconsDir, 'icon.svg'),
//     join(iconsDir, 'icon.svg')
// )

console.log('✅ Build completed successfully!')
console.log('📁 Extension files are in:', distDir)
console.log('')
console.log('To load in Chrome:')
console.log('1. Open chrome://extensions/')
console.log('2. Enable Developer mode')
console.log('3. Click "Load unpacked"')
console.log('4. Select the dist/ folder') 