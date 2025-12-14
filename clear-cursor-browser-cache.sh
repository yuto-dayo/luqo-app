#!/bin/bash

# Cursorブラウザキャッシュ削除スクリプト

echo "Cursorブラウザキャッシュを削除します..."
echo "⚠️  Cursorを閉じてから実行してください。"

# メインキャッシュディレクトリ
CACHE_DIR1="$HOME/Library/Application Support/Cursor/Shared Dictionary/cache"

# Partitions配下のキャッシュディレクトリ（複数ある可能性があるため）
CACHE_DIR2="$HOME/Library/Application Support/Cursor/Partitions"

# メインキャッシュを削除
if [ -d "$CACHE_DIR1" ]; then
    echo "削除中: $CACHE_DIR1"
    rm -rf "$CACHE_DIR1"
    echo "✓ メインキャッシュを削除しました"
else
    echo "メインキャッシュディレクトリが見つかりませんでした"
fi

# Partitions配下のキャッシュを削除
if [ -d "$CACHE_DIR2" ]; then
    echo "削除中: Partitions配下のキャッシュ..."
    find "$CACHE_DIR2" -type d -name "cache" -path "*/Shared Dictionary/cache" -exec rm -rf {} + 2>/dev/null
    echo "✓ Partitions配下のキャッシュを削除しました"
fi

echo ""
echo "完了しました！Cursorを再起動してください。"





