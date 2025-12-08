#!/usr/bin/env node

/**
 * Viteサーバーの接続テストスクリプト
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

const PORT = 5173;
const localIP = getLocalIP();

const testUrls = [
  `http://localhost:${PORT}`,
  localIP ? `http://${localIP}:${PORT}` : null,
].filter(Boolean);

console.log("\n🔍 Viteサーバー接続テスト\n");

async function testUrl(url) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: "/",
      method: "GET",
      timeout: 5000,
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
          console.log(`   Content-Type: ${res.headers["content-type"]}`);
          resolve(true);
        } else {
          console.log(`⚠️  ${url}`);
          console.log(`   Status: ${res.statusCode}`);
          resolve(false);
        }
      });
    });

    req.on("error", (error) => {
      console.log(`❌ ${url}`);
      console.log(`   Error: ${error.message}`);
      if (error.code === "ECONNREFUSED") {
        console.log(`   → サーバーが起動していないか、外部からアクセスできません`);
      } else if (error.code === "ETIMEDOUT") {
        console.log(`   → 接続がタイムアウトしました`);
      }
      resolve(false);
    });

    req.on("timeout", () => {
      console.log(`⏱️  ${url}`);
      console.log(`   Error: Connection timeout`);
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

async function runTests() {
  const results = [];
  for (const url of testUrls) {
    const result = await testUrl(url);
    results.push({ url, success: result });
    console.log("");
  }

  console.log("📊 テスト結果:\n");
  results.forEach(({ url, success }) => {
    console.log(`   ${success ? "✅" : "❌"} ${url}`);
  });
  console.log("");

  const allSuccess = results.every((r) => r.success);
  const localhostSuccess = results.find((r) => r.url.includes("localhost"))?.success;
  const localIPSuccess = results.find((r) => !r.url.includes("localhost"))?.success;

  if (!allSuccess) {
    if (localhostSuccess && !localIPSuccess) {
      console.log("⚠️  問題: localhostからは接続できますが、ローカルIPからは接続できません。");
      console.log("   対処法:");
      console.log("   1. Viteサーバーを再起動してください");
      console.log("   2. vite.config.ts で `host: '0.0.0.0'` が設定されているか確認してください");
      console.log("   3. ファイアウォールの設定を確認してください");
    } else if (!localhostSuccess) {
      console.log("❌ 問題: Viteサーバーが起動していないか、接続できません。");
      console.log("   対処法:");
      console.log("   1. フロントエンドサーバーを起動してください: cd frontend && npm run dev");
    }
  } else {
    console.log("✅ すべての接続テストが成功しました！");
    if (localIP) {
      console.log(`\n📱 スマホから接続するURL: http://${localIP}:${PORT}`);
    }
  }
}

runTests();

