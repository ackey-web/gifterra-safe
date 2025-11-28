const fs = require('fs');
const path = require('path');

const artifactPath = path.join(__dirname, 'artifacts/contracts/GifterraFactoryLite.sol/GifterraFactoryLite.json');
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

const bytecode = artifact.bytecode.replace(/^0x/, '');
const sizeInBytes = bytecode.length / 2;
const maxSize = 24576;

console.log('========================================');
console.log('GifterraFactoryLite コントラクトサイズ');
console.log('========================================\n');

console.log('📦 バイトコードサイズ: ' + sizeInBytes.toLocaleString() + ' bytes');
console.log('📏 制限サイズ: ' + maxSize.toLocaleString() + ' bytes');
console.log('📊 使用率: ' + ((sizeInBytes / maxSize) * 100).toFixed(2) + '%');
console.log('✨ 余裕: ' + (maxSize - sizeInBytes).toLocaleString() + ' bytes\n');

if (sizeInBytes <= maxSize) {
    console.log('✅ デプロイ可能です！\n');
} else {
    console.log('❌ サイズオーバー（デプロイ不可）\n');
}
