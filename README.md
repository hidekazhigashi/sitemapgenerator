# 🗺️ Sitemap Generator

ウェブサイトをスクレイピングして、詳細なサイトマップをZIPファイルで生成するウェブアプリケーションです。スクリーンショット機能とExcelレポートを含む包括的なサイト分析ツールです。

## 🚀 特徴

- **プロフェッショナルクローリング**: Node Crawlerを使用した高性能Webスクレイピング
- **並行処理**: 最大10つの同時接続による高速クローリング
- **スクリーンショット機能**: Playwrightによる高品質なページキャプチャ
- **詳細なレポート**: URL階層構造、タイトル、メタ情報を含む詳細なExcelファイル
- **ZIP圧縮配信**: Excelファイルとスクリーンショットを圧縮してダウンロード
- **智的重複回避**: 自動重複URL検出とスキップ機能
- **視覚的なUI**: 直感的で使いやすいWebインターフェース
- **リアルタイム進行状況**: Server-Sent Eventsによるリアルタイム進行状況表示
- **カスタマイズ可能**: 最大深度、ページ数、スクリーンショット設定
- **SSL証明書分析**: HTTPS サイトのSSL証明書情報取得

## 📋 出力内容

生成されるZIPファイルには以下が含まれます：

### 📄 Excelファイル (`sitemap_[domain]_[date].xlsx`)

#### 📊 Summaryシート（第1シート）
**ドメイン情報**
- **Target URL**: 検索対象URL
- **Domain**: ドメイン名
- **Protocol**: プロトコル（HTTP/HTTPS）

**SSL証明書情報**（HTTPSサイトの場合）
- **Certificate Issuer**: 証明書発行者
- **Subject**: 証明書の対象
- **Valid From**: 有効期間開始日
- **Valid To**: 有効期間終了日
- **Signature Algorithm**: 署名アルゴリズム
- **Serial Number**: シリアル番号

**クローリング統計**
- **Total Pages Found**: 発見したページ数
- **Error Pages**: エラーページ数
- **Maximum Depth**: 最大深度
- **Generated**: 生成日時

**スクリーンショット統計**（スクリーンショット有効時）
- **Screenshots Captured**: キャプチャ成功数
- **Screenshot Failures**: キャプチャ失敗数
- **Success Rate**: 成功率

#### 📋 Sitemapシート（第2シート）
**基本情報**
- **No.**: 連番（Full Pathでソート済み）
- **Level 1～5**: URLパスを階層ごとに分割表示
- **Full Path**: 完全なパス（ドメイン除く）

**ページ情報**
- **Page Title**: ページタイトル
- **Meta Description**: メタディスクリプション
- **H1**: メインの見出し
- **Depth**: クローリングの深さ
- **Status**: HTTPステータスコード
- **Content Type**: コンテンツタイプ
- **Screenshot**: スクリーンショットファイル名（Excel連番、例：001.png）

### 📸 スクリーンショットフォルダ（スクリーンショット有効時）
- **screenshots/**: 各ページのスクリーンショット画像
- **ファイル名**: Excel連番に対応（001.png, 002.png, 003.png...）
- **フォーマット**: PNG/JPEG（設定可能）
- **ビューポート**: デスクトップ/ラップトップ/タブレット/モバイル（設定可能）

### 📄 README.txt
- ファイル一覧と説明
- 統計情報
- スクリーンショットとExcelの対応関係

## 🛠️ インストール

1. **リポジトリをクローン**:
```bash
git clone <repository-url>
cd sitemapgenerator
```

2. **依存関係をインストール**:
```bash
npm install
```

3. **Playwrightブラウザをインストール**（スクリーンショット機能用）:
```bash
npx playwright install chromium
```

## 🎯 使用方法

1. **サーバーを起動**:
```bash
npm start
```

2. **ブラウザでアクセス**: `http://localhost:3000`

3. **基本設定**:
   - **ウェブサイトURL**: スクレイピング対象のURL
   - **最大深度**: 何階層まで辿るか (1-5階層)
   - **最大ページ数**: 最大何ページまで処理するか (50-500ページ)

4. **詳細設定** (オプション): 「⚙️ 詳細設定」をクリック
   
   **Node Crawler設定**:
   - **同時接続数**: 1-10接続 (推奨: 5接続)
   - **タイムアウト**: 5-30秒 (推奨: 10秒)
   - **リトライ回数**: 0-5回 (推奨: 2回)
   - **リクエスト間隔**: 100-2000ms (推奨: 500ms)
   
   **スクリーンショット設定**:
   - **📸 スクリーンショットを取得する**: チェックボックス
   - **画面サイズ**: デスクトップ(1920x1080) / ラップトップ(1280x720) / タブレット(768x1024) / モバイル(375x667)
   - **画像形式**: PNG(高品質) / JPEG(軽量)
   - **画質**: 60% / 80%(標準) / 95%(高品質) ※JPEG時のみ
   - **フルページ取得**: ページ全体をキャプチャ

5. **「サイトマップを生成」ボタンをクリック**

6. **リアルタイム進行状況を確認**:
   - 🔗 接続中 → ⚙️ 初期化中 → 🔒 SSL確認中 → 🚀 クローラー開始
   - 🕷️ クローリング中 → 📊 Excel生成中 → 📦 ZIP作成中 → ✅ 完了

7. **完了後、ZIPファイルが自動的にダウンロード**されます

## 🏗️ プロジェクト構造

```
sitemapgenerator/
├── src/
│   ├── app.js              # メインサーバーファイル
│   ├── scraper.js          # スクレイピング＆スクリーンショット機能
│   ├── excelGenerator.js   # Excel生成機能
│   └── zipGenerator.js     # ZIP圧縮機能
├── public/
│   ├── index.html          # メインHTML
│   ├── css/style.css       # スタイルシート
│   └── js/script.js        # フロントエンドJS
├── temp/                   # 一時スクリーンショット保存先
├── package.json
└── README.md
```

## 🔧 技術スタック

- **Backend**: Node.js + Express
- **Crawling**: Node Crawler (高性能Webクローリング)
- **Parsing**: Cheerio (サーバーサイドjQuery)
- **Screenshots**: Playwright (ブラウザ自動化)
- **Excel Generation**: ExcelJS
- **ZIP Compression**: Archiver
- **Real-time Progress**: Server-Sent Events
- **Frontend**: HTML/CSS/JavaScript (バニラJS)
- **Other**: CORS, Body-parser, TLS/SSL分析

## ⚙️ 設定オプション

### 基本設定
- `maxDepth`: 最大クローリング深度 (1-5, デフォルト: 3)
- `maxPages`: 最大処理ページ数 (50-500, デフォルト: 100)
- `delay`: リクエスト間の遅延時間（ミリ秒）(100-2000, デフォルト: 500)

### Node Crawler設定
- `maxConnections`: 同時接続数 (1-10, デフォルト: 5)
- `timeout`: タイムアウト時間 (5-30秒, デフォルト: 10秒)
- `retries`: リトライ回数 (0-5回, デフォルト: 2回)
- `skipDuplicates`: 重複URL自動スキップ (常に有効)

### スクリーンショット設定
- `captureScreenshots`: スクリーンショット取得有効/無効 (デフォルト: 無効)
- `screenshotViewport`: ビューポートサイズ (desktop/laptop/tablet/mobile, デフォルト: desktop)
- `screenshotFormat`: 画像形式 (png/jpeg, デフォルト: png)
- `screenshotQuality`: JPEG画質 (60-95, デフォルト: 80)
- `fullPageScreenshot`: フルページキャプチャ (デフォルト: 有効)

## 📦 出力ファイル仕様

### ファイル名規則
- **ZIPファイル**: `sitemap_[ドメイン]_[YYYY-MM-DD].zip`
- **Excelファイル**: `sitemap_[ドメイン]_[YYYY-MM-DD].xlsx`
- **スクリーンショット**: `001.png`, `002.png`, `003.png`...（Excel行番号に対応）

### ZIP構造
```
sitemap_example.com_2025-08-16.zip
├── sitemap_example.com_2025-08-16.xlsx
├── screenshots/
│   ├── 001.png  (Excel行1に対応)
│   ├── 002.png  (Excel行2に対応)
│   └── ...
└── README.txt  (ファイル説明とマッピング)
```

## 🚨 注意事項

- **robots.txt**: robots.txtを尊重し、適切なスクレイピングを心がけてください
- **処理時間**: 大規模なサイトやスクリーンショット有効時は処理時間がかかります
- **JavaScript**: SPAなど、JavaScriptで動的生成されるコンテンツは取得できません
- **CORS制限**: 一部のサイトにはアクセスできない場合があります
- **メモリ使用量**: スクリーンショット機能は大量のメモリを使用します
- **ディスク容量**: 大量のスクリーンショットにより一時的にディスク容量を消費します
- **同時接続数**: 高すぎる同時接続数は対象サーバーに負荷をかける可能性があります

## 🔍 使用例

### 基本的なサイトマップ生成
```
URL: https://example.com
最大深度: 3階層
最大ページ数: 100ページ
同時接続数: 5接続
スクリーンショット: 無効
```

### 詳細分析（スクリーンショット付き）
```
URL: https://example.com
最大深度: 2階層
最大ページ数: 50ページ
同時接続数: 3接続
スクリーンショット: 有効
  - ビューポート: デスクトップ
  - 形式: PNG
  - フルページ: 有効
```

## 📈 パフォーマンス

- **処理速度**: 同時接続数により調整可能（1-10接続）
- **メモリ効率**: スクリーンショット一時保存後、自動クリーンアップ
- **ファイルサイズ**: ZIP圧縮により効率的な配信
- **プログレス追跡**: リアルタイム進行状況とキューサイズ表示

## 📝 ライセンス

MIT License

## 🤝 コントリビューション

プルリクエストやイシューの報告は歓迎します。

## 🔄 更新履歴

- **v2.0**: スクリーンショット機能追加、ZIP圧縮対応
- **v1.5**: Playwright統合、連番ファイル命名
- **v1.0**: 基本的なサイトマップ生成機能