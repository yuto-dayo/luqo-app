#!/usr/bin/env node

/**
 * ローカルIPアドレスを表示するスクリプト
 * スマホから接続する際に使用するIPアドレスを確認できます
 */

const os = require("os");

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // IPv4で、内部（非ループバック）アドレスのみを取得
      if (iface.family === "IPv4" && !iface.internal) {
        addresses.push({
          interface: name,
          address: iface.address,
        });
      }
    }
  }

  return addresses;
}

const ips = getLocalIP();

console.log("\n📱 スマホから接続するための情報:\n");

if (ips.length === 0) {
  console.log("❌ ローカルIPアドレスが見つかりませんでした。");
  console.log("   Wi-Fiまたは有線LANに接続していることを確認してください。\n");
  process.exit(1);
}

ips.forEach(({ interface: name, address }) => {
  console.log(`🌐 インターフェース: ${name}`);
  console.log(`   IPアドレス: ${address}`);
  console.log(`   Frontend URL: http://${address}:5173`);
  console.log(`   Backend URL: http://${address}:4000`);
  console.log("");
});

console.log("💡 使い方:");
console.log("   1. PCとスマホを同じWi-Fiネットワークに接続");
console.log("   2. 上記のFrontend URLをスマホのブラウザで開く");
console.log("   3. APIは自動的に同じホスト名で接続されます\n");
