#!/usr/bin/env node

/**
 * ネットワーク診断スクリプト
 * スマホから接続できない問題を診断します
 */

const os = require("os");
const { execSync } = require("child_process");

console.log("\n🔍 ネットワーク診断\n");

// 1. ローカルIPアドレスの確認
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        addresses.push({
          interface: name,
          address: iface.address,
          netmask: iface.netmask,
        });
      }
    }
  }
  
  return addresses;
}

const ips = getLocalIP();
console.log("📡 ネットワークインターフェース:");
ips.forEach(({ interface: name, address, netmask }) => {
  console.log(`   ${name}: ${address} (${netmask})`);
});
console.log("");

// 2. ポートの確認
console.log("🔌 ポートの状態:");
try {
  const port5173 = execSync("lsof -i :5173 | grep LISTEN", { encoding: "utf-8" });
  console.log("   ✅ ポート 5173: リッスン中");
  console.log(`   ${port5173.trim().split("\n")[0]}`);
} catch (e) {
  console.log("   ❌ ポート 5173: リッスンしていません");
}

try {
  const port4000 = execSync("lsof -i :4000 | grep LISTEN", { encoding: "utf-8" });
  console.log("   ✅ ポート 4000: リッスン中");
  console.log(`   ${port4000.trim().split("\n")[0]}`);
} catch (e) {
  console.log("   ❌ ポート 4000: リッスンしていません");
}
console.log("");

// 3. ファイアウォールの確認
console.log("🛡️  ファイアウォール:");
try {
  const firewallStatus = execSync("/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate", { encoding: "utf-8" });
  console.log(`   ${firewallStatus.trim()}`);
} catch (e) {
  console.log("   ⚠️  ファイアウォールの状態を確認できませんでした");
}
console.log("");

// 4. 接続テスト
console.log("🌐 接続テスト:");
if (ips.length > 0) {
  const mainIP = ips[0].address;
  console.log(`   テスト対象: ${mainIP}`);
  
  const http = require("http");
  
  // ポート5173のテスト
  const test5173 = new Promise((resolve) => {
    const req = http.request({
      hostname: mainIP,
      port: 5173,
      path: "/",
      method: "GET",
      timeout: 3000,
    }, (res) => {
      console.log(`   ✅ http://${mainIP}:5173 - Status: ${res.statusCode}`);
      resolve(true);
    });
    
    req.on("error", (error) => {
      console.log(`   ❌ http://${mainIP}:5173 - Error: ${error.message}`);
      resolve(false);
    });
    
    req.on("timeout", () => {
      console.log(`   ⏱️  http://${mainIP}:5173 - Timeout`);
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
  
  // ポート4000のテスト
  const test4000 = new Promise((resolve) => {
    const req = http.request({
      hostname: mainIP,
      port: 4000,
      path: "/health",
      method: "GET",
      timeout: 3000,
    }, (res) => {
      console.log(`   ✅ http://${mainIP}:4000 - Status: ${res.statusCode}`);
      resolve(true);
    });
    
    req.on("error", (error) => {
      console.log(`   ❌ http://${mainIP}:4000 - Error: ${error.message}`);
      resolve(false);
    });
    
    req.on("timeout", () => {
      console.log(`   ⏱️  http://${mainIP}:4000 - Timeout`);
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
  
  Promise.all([test5173, test4000]).then(() => {
    console.log("");
    console.log("💡 スマホから接続する場合:");
    console.log(`   1. PCとスマホが同じWi-Fiネットワークに接続されていることを確認`);
    console.log(`   2. スマホのブラウザで以下のURLを開く:`);
    console.log(`      http://${mainIP}:5173`);
    console.log(`   3. ポート番号（:5173）を必ず含めること`);
    console.log(`   4. http:// で始めること（https:// ではない）`);
    console.log("");
  });
} else {
  console.log("   ❌ ローカルIPアドレスが見つかりませんでした");
  console.log("   Wi-Fiまたは有線LANに接続していることを確認してください");
  console.log("");
}

