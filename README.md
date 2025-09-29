# Harts Game Replay Viewer

Phaser 3とAlpine.jsを使用したHartsゲーム履歴再生ソフトです。

## 機能

- **リプレイファイル読み込み**: JSON形式のゲーム履歴ファイルを読み込み
- **再生コントロール**: 再生、一時停止、停止、リセット機能
- **速度調整**: 0.5x〜3xの速度で再生可能
- **ターン操作**: 前後のターンに手動でジャンプ
- **タイムライン**: クリックで任意のタイミングにシーク
- **ゲーム情報表示**: プレイヤー情報、スコア、現在のターンを表示
- **カード表示**: トランプカードのビジュアル表示とアニメーション

## セットアップ

### 必要要件
- Node.js (14.0.0以上)
- npm (6.0.0以上)

### インストール

```bash
# 依存関係をインストール
npm install
```

### 開発サーバーの起動

```bash
# 開発サーバーを起動（ブラウザが自動で開きます）
npm run dev

# または
npm start
```

### ビルド

```bash
# プロダクション用にビルド
npm run build
```

## 使用方法

1. アプリケーションを起動
2. 「リプレイを読み込み」ボタンでJSONファイルを選択
3. 再生コントロールでゲームを再生

### リプレイファイル形式

```json
{
  "gameType": "Hearts",
  "startTime": "2025-09-22T10:00:00Z",
  "players": [
    {"name": "Player 1", "score": 0},
    {"name": "Player 2", "score": 5},
    {"name": "Player 3", "score": 10},
    {"name": "Player 4", "score": 3}
  ],
  "rounds": [
    {
      "roundNumber": 1,
      "tricks": [
        {
          "trickNumber": 1,
          "plays": [
            {
              "playerIndex": 0,
              "card": "C_2",
              "timestamp": 1000
            }
          ]
        }
      ]
    }
  ]
}
```

## 技術スタック

- **Phaser 3**: 2Dゲームエンジン
- **Alpine.js**: 軽量フロントエンドフレームワーク
- **Webpack 5**: モジュールバンドラー
- **Babel**: JavaScriptトランスパイラー
- **CSS3**: スタイリング
- **HTML5**: マークアップ

## プロジェクト構造

```
harts-view/
├── src/
│   ├── index.js          # メインアプリケーションファイル
│   ├── styles.css        # アプリケーションスタイル
│   └── demo-data.json    # デモデータ
├── public/
│   └── index.html        # HTMLテンプレート
├── dist/                 # ビルド出力ディレクトリ
├── package.json          # NPM設定
├── webpack.config.js     # Webpack設定
├── .babelrc             # Babel設定
├── .gitignore           # Git無視ファイル設定
└── README.md            # このファイル
```

## 開発

### 新機能の追加
1. `src/index.js`にゲームロジックを追加
2. `public/index.html`でUIを更新
3. `src/styles.css`でスタイルを調整

### デバッグ
ブラウザのコンソールで`window.GameViewer`オブジェクトを使用してゲーム状態にアクセスできます。

## ライセンス

MIT License