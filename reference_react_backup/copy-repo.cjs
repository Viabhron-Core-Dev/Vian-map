const fs = require('fs');
const path = require('path');

const source = __dirname;
const target = path.join(__dirname, 'reference_react_backup');

const excludes = ['node_modules', '.git', 'reference', 'reference_react_backup', 'dist', 'copy-repo.js'];

function copyFolderSync(from, to) {
    if (!fs.existsSync(to)) {
        fs.mkdirSync(to, { recursive: true });
    }
    const items = fs.readdirSync(from);
    for (const item of items) {
        if (excludes.includes(item)) continue;
        
        const srcPath = path.join(from, item);
        const destPath = path.join(to, item);
        
        const stat = fs.statSync(srcPath);
        if (stat.isDirectory()) {
            copyFolderSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

console.log('Initiating backup...');
copyFolderSync(source, target);
console.log('Backup complete at reference_react_backup/');
