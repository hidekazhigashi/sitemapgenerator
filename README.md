# 🗺️ Sitemap Generator

ウェブサイトをスクレイピングして、詳細なサイトマップをExcelファイルで生成するウェブアプリケーションです。

## 🚀 特徴

- **プロフェッショナルクローリング**: Node Crawlerを使用した高性能Webスクレイピング
- **並行処理**: 最大5つの同時接続による高速クローリング
- **詳細なレポート**: URL階層構造、タイトル、メタ情報を含む詳細なExcelファイル
- **智的重複回避**: 自動重複URL検出とスキップ機能
- **視覚的なUI**: 直感的で使いやすいWebインターフェース
- **カスタマイズ可能**: 最大深度やページ数の設定
- **リトライ機能**: ネットワークエラー時の自動再試行

## 📋 出力内容

生成されるExcelファイルには以下の情報が含まれます：

## 📊 Summaryシート（第1シート）
### ドメイン情報
- **Target URL**: 検索対象URL
- **Domain**: ドメイン名
- **Protocol**: プロトコル（HTTP/HTTPS）

### SSL証明書情報（HTTPSサイトの場合）
- **Certificate Issuer**: 証明書発行者
- **Subject**: 証明書の対象
- **Valid From**: 有効期間開始日
- **Valid To**: 有効期間終了日
- **Signature Algorithm**: 署名アルゴリズム
- **Serial Number**: シリアル番号

### クローリング統計
- **Total Pages Found**: 発見したページ数
- **Error Pages**: エラーページ数
- **Maximum Depth**: 最大深度
- **Generated**: 生成日時

## 📋 Sitemapシート（第2シート）
### 基本情報
- **No.**: 連番（Full Pathでソート済み）
- **Level 1～5**: URLパスを階層ごとに分割表示
- **Full Path**: 完全なパス（ドメイン除く）

### ページ情報
- **Page Title**: ページタイトル
- **Meta Description**: メタディスクリプション
- **H1**: メインの見出し
- **Depth**: クローリングの深さ
- **Status**: HTTPステータスコード
- **Content Type**: コンテンツタイプ

## 🛠️ インストール

1. リポジトリをクローン:
```bash
git clone <repository-url>
cd sitemapgenerator
```

2. 依存関係をインストール:
```bash
npm install
```

## 🎯 使用方法

1. サーバーを起動:
```bash
npm start
```

2. ブラウザで `http://localhost:3000` にアクセス

3. 以下の設定を行います：
   - **ウェブサイトURL**: スクレイピング対象のURL
   - **最大深度**: 何階層まで辿るか (1-5階層)
   - **最大ページ数**: 最大何ページまで処理するか (50-500ページ)

4. **詳細設定** (オプション): 「⚙️ 詳細設定」をクリックして以下を調整可能
   - **同時接続数**: 1-10接続 (推奨: 5接続)
   - **タイムアウト**: 5-30秒 (推奨: 10秒)
   - **リトライ回数**: 0-5回 (推奨: 2回)
   - **リクエスト間隔**: 100-2000ms (推奨: 500ms)

5. 「サイトマップを生成」ボタンをクリック

6. 生成が完了すると、Excelファイルが自動的にダウンロードされます

## 🏗️ プロジェクト構造

```
sitemapgenerator/
├── src/
│   ├── app.js              # メインサーバーファイル
│   ├── scraper.js          # スクレイピング機能
│   └── excelGenerator.js   # Excel生成機能
├── public/
│   ├── index.html          # メインHTML
│   ├── css/style.css       # スタイルシート
│   └── js/script.js        # フロントエンドJS
├── sample/
│   └── sample.xlsx         # サンプル出力ファイル
├── package.json
└── README.md
```

## 🔧 技術スタック

- **Backend**: Node.js + Express
- **Crawling**: Node Crawler (高性能Webクローリング)
- **Parsing**: Cheerio (サーバーサイドjQuery)
- **Excel Generation**: ExcelJS
- **Frontend**: HTML/CSS/JavaScript
- **Other**: CORS, Body-parser

## ⚙️ 設定オプション

Node Crawlerベースの高性能スクレイピング処理は以下の設定でカスタマイズできます：

### 基本設定
- `maxDepth`: 最大クローリング深度 (デフォルト: 3)
- `maxPages`: 最大処理ページ数 (デフォルト: 100)
- `delay`: リクエスト間の遅延時間（ミリ秒）(デフォルト: 500)

### Node Crawler設定
- `maxConnections`: 同時接続数 (デフォルト: 5)
- `timeout`: タイムアウト時間 (デフォルト: 10秒)
- `retries`: リトライ回数 (デフォルト: 2)
- `skipDuplicates`: 重複URL自動スキップ (デフォルト: true)

## 🚨 注意事項

- robots.txtを尊重し、適切なスクレイピングを心がけてください
- 大規模なサイトでは処理時間がかかる場合があります
- 一部のサイトでは、JavaScriptが必要なコンテンツは取得できません
- CORS制限により、一部のサイトにはアクセスできない場合があります

## 📝 ライセンス

MIT License

## 🤝 コントリビューション

プルリクエストやイシューの報告は歓迎します。