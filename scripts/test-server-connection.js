#!/usr/bin/env node

/**
 * サーバー接続テストスクリプト
 * スマホから接続する前に、サーバーが正しく起動しているか確認できます
 */

const http = require("http");
const os = require("os");

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

const PORT = process.env.PORT || 4000;
const localIP = getLocalIP();

const testUrls = [
  `http://localhost:${PORT}/health`,
  `http://localhost:${PORT}/api/v1/test`,
  localIP ? `http://${localIP}:${PORT}/health` : null,
  localIP ? `http://${localIP}:${PORT}/api/v1/test` : null,
].filter(Boolean);

console.log("\n🔍 サーバー接続テスト\n");

let successCount = 0;
let failCount = 0;

async function testUrl(url) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: "GET",
      timeout: 3000,
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        if (res.statusCode === 200) {
          console.log(`✅ ${url}`);
          console.log(`   Status: ${res.statusCode}`);
          try {
            const json = JSON.parse(data);
            console.log(`   Response:`, JSON.stringify(json, null, 2));
          } catch {
            console.log(`   Response: ${data.substring(0, 100)}`);
          }
          successCount++;
        } else {
          console.log(`⚠️  ${url}`);
          console.log(`   Status: ${res.statusCode}`);
          failCount++;
        }
        console.log("");
        resolve();
      });
    });

    req.on("error", (error) => {
      console.log(`❌ ${url}`);
      console.log(`   Error: ${error.message}`);
      console.log("");
      failCount++;
      resolve();
    });

    req.on("timeout", () => {
      console.log(`⏱️  ${url}`);
      console.log(`   Error: Connection timeout`);
      console.log("");
      req.destroy();
      failCount++;
      resolve();
    });

    req.end();
  });
}

async function runTests() {
  for (const url of testUrls) {
    await testUrl(url);
  }

  console.log("\n📊 テスト結果:");
  console.log(`   成功: ${successCount}`);
  console.log(`   失敗: ${failCount}`);
  console.log("");

  if (successCount === 0) {
    console.log("❌ サーバーに接続できませんでした。");
    console.log("   以下を確認してください:");
    console.log("   1. サーバーが起動しているか (cd server && npm run dev)");
    console.log("   2. ポート", PORT, "が使用可能か");
    console.log("   3. ファイアウォールの設定");
    process.exit(1);
  } else if (failCount > 0) {
    console.log("⚠️  一部の接続テストが失敗しました。");
    console.log("   スマホから接続する場合は、成功したURLを使用してください。");
  } else {
    console.log("✅ すべての接続テストが成功しました！");
    if (localIP) {
      console.log(`\n📱 スマホから接続するURL: http://${localIP}:5173`);
    }
  }
}

runTests();
