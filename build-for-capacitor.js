// build-for-capacitor.js
// A simple script to ensure a clean build before Capacitor sync
import { rmSync, existsSync } from 'fs';
import { execSync } from 'child_process';

const distDir = 'dist';
const androidDir = 'android';

console.log('🧹 Cleaning previous builds...');
if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true, force: true });
    console.log(`   Removed ${distDir}`);
}
if (existsSync(androidDir)) {
    rmSync(androidDir, { recursive: true, force: true });
    console.log(`   Removed ${androidDir}`);
}

console.log('🏗️  Building web project with Vite...');
try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Web build complete.');
} catch (error) {
    console.error('❌ Web build failed:', error.message);
    process.exit(1);
}