const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

// --- 設定 ---
// スクリプトが src の中にある場合、'..' でプロジェクトルートに戻ります
const PROJECT_ROOT = path.join(__dirname, '..'); 
const BACKUP_ROOT = path.join(PROJECT_ROOT, 'backups');
const TARGETS = ['index.html', 'src']; // プロジェクトルートから見た対象

/**
 * フォルダを再帰的にコピーする関数
 */
function copyRecursiveSync(src, dest) {
    if (!fs.existsSync(src)) return;
    const stats = fs.statSync(src);
    if (stats.isDirectory()) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach((childItemName) => {
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

function createBackup() {
    const now = new Date();
    const timestamp = now.getFullYear() + 
        String(now.getMonth() + 1).padStart(2, '0') + 
        String(now.getDate()).padStart(2, '0') + '_' + 
        String(now.getHours()).padStart(2, '0') + 
        String(now.getMinutes()).padStart(2, '0');

    const folderName = `PianoWorks_Backup_${timestamp}`;
    const zipFileName = `${folderName}.zip`;
    const folderPath = path.join(BACKUP_ROOT, folderName);

    // バックアップディレクトリの作成
    if (!fs.existsSync(BACKUP_ROOT)) fs.mkdirSync(BACKUP_ROOT, { recursive: true });
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

    console.log(`🚀 プロジェクトルート(src外)を対象にバックアップを開始します: ${folderName}`);

    const zip = new AdmZip();

    TARGETS.forEach(target => {
        const srcPath = path.join(PROJECT_ROOT, target);
        const destPath = path.join(folderPath, target);

        if (fs.existsSync(srcPath)) {
            const stats = fs.statSync(srcPath);
            if (stats.isDirectory()) {
                zip.addLocalFolder(srcPath, target);
                copyRecursiveSync(srcPath, destPath);
                console.log(`  ✅ Added Folder: ${target}`);
            } else {
                zip.addLocalFile(srcPath);
                fs.copyFileSync(srcPath, destPath);
                console.log(`  ✅ Added File: ${target}`);
            }
        } else {
            console.warn(`  ⚠️ Warning: ${target} が見つかりません。参照先: ${srcPath}`);
        }
    });

    const zipOutputPath = path.join(BACKUP_ROOT, zipFileName);
    zip.writeZip(zipOutputPath);

    console.log(`\n✨ 完了しました！`);
    console.log(`📁 保存場所: ${folderPath}`);
}

createBackup();