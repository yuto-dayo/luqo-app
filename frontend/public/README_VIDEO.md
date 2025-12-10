# ウェルカム動画について

初回ログイン時に表示されるウェルカム動画を配置するディレクトリです。

## ファイル配置

このディレクトリに `welcome-video.mp4` を配置してください。

```
frontend/public/welcome-video.mp4
```

## 動作

- キャッシュを削除した後の初回ログイン時のみ動画が表示されます
- 動画再生完了後、またはスキップ後は次回以降は表示されません
- フラグは `localStorage` の `luqo_has_seen_welcome_video` で管理されます

## 動画ファイルの要件

- 形式: MP4
- 推奨コーデック: H.264
- ファイルサイズ: 可能な限り小さく（PWAとして使用するため）

## テスト方法

動画を再表示したい場合は、ブラウザの開発者ツールで以下を実行してください：

```javascript
localStorage.removeItem('luqo_has_seen_welcome_video');
```

その後、ページをリロードすると動画が再表示されます。

