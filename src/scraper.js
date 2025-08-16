const Crawler = require('crawler');
const { URL } = require('url');
const https = require('https');
const tls = require('tls');
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class SitemapGenerator {
    constructor(baseUrl, options = {}) {
        this.baseUrl = baseUrl;
        const baseUrlObj = new URL(baseUrl);
        this.baseDomain = baseUrlObj.hostname;
        // ベースURLのパスを保存（末尾にスラッシュがない場合は追加）
        this.basePath = baseUrlObj.pathname;
        if (!this.basePath.endsWith('/')) {
            this.basePath += '/';
        }
        this.visitedUrls = new Set();
        this.sitemapData = [];
        this.maxDepth = options.maxDepth || 3;
        this.maxPages = options.maxPages || 100;
        this.delay = options.delay || 500;
        this.maxConnections = options.maxConnections || 5;
        this.timeout = options.timeout || 10000;
        this.retries = options.retries || 2;
        this.urlQueue = [];
        this.isComplete = false;
        this.sslInfo = null;
        this.progressCallback = options.progressCallback || (() => {});
        
        // スクリーンショット設定
        this.captureScreenshots = options.captureScreenshots || false;
        this.screenshotViewport = options.screenshotViewport || 'desktop';
        this.screenshotFormat = options.screenshotFormat || 'png';
        this.screenshotQuality = options.screenshotQuality || 80;
        this.fullPageScreenshot = options.fullPageScreenshot || false;
        this.browser = null;
        this.screenshotFiles = []; // スクリーンショットファイルの情報を保存
        this.screenshotDir = null; // 一時スクリーンショットディレクトリ
        
        // Node Crawler設定
        this.crawler = new Crawler({
            maxConnections: this.maxConnections, // 同時接続数
            rateLimit: this.delay, // リクエスト間隔
            timeout: this.timeout,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            skipDuplicates: true, // 重複URL回避
            retries: this.retries, // リトライ回数
            callback: (error, res, done) => {
                this.handleCrawlerResult(error, res, done);
            }
        });

        // クローラーが全て完了した時のイベント
        this.crawler.on('drain', () => {
            // 少し待機してから完了判定を行う（新しいURLが追加される可能性があるため）
            setTimeout(() => {
                if (!this.isComplete && this.crawler.queueSize === 0) {
                    this.isComplete = true;
                    console.log(`Crawling completed! Found ${this.sitemapData.length} pages`);
                    
                    if (this.onComplete) {
                        this.onComplete({ sitemapData: this.sitemapData, sslInfo: this.sslInfo });
                    }
                }
            }, 2000); // 2秒待機
        });
    }

    handleCrawlerResult(error, res, done) {
        if (error) {
            console.error(`Error crawling ${res?.request?.uri?.href || 'unknown URL'}:`, error.message);
            
            if (res?.request?.uri?.href) {
                this.sitemapData.push({
                    url: res.request.uri.href,
                    title: 'Error',
                    metaDescription: '',
                    h1: '',
                    depth: res.options.metadata?.depth || 0,
                    status: 'Error',
                    contentType: '',
                    lastModified: '',
                    contentLength: '',
                    error: error.message,
                    screenshot: null
                });
            }
            done();
        } else {
            // 非同期処理に対応するため、awaitを使用
            this.processPageResult(res).then(() => {
                done();
            }).catch((err) => {
                console.error('Error in processPageResult:', err);
                done();
            });
        }
    }

    async processPageResult(res) {
        const url = res.request.uri.href;
        const depth = res.options.metadata?.depth || 0;
        const $ = res.$;

        console.log(`Processed: ${url} (depth: ${depth}, queue: ${this.crawler.queueSize}, total: ${this.sitemapData.length + 1})`);

        // ページ情報を抽出
        const title = $('title').text().trim() || 'No Title';
        const metaDescription = $('meta[name="description"]').attr('content') || '';
        const h1 = $('h1').first().text().trim() || '';

        const pageData = {
            url: url,
            title: title,
            metaDescription: metaDescription,
            h1: h1,
            depth: depth,
            status: res.statusCode || 200,
            contentType: res.headers['content-type'] || '',
            lastModified: res.headers['last-modified'] || '',
            contentLength: res.headers['content-length'] || '',
            screenshot: null
        };

        this.sitemapData.push(pageData);

        // スクリーンショットを取得（連番はsitemapDataに追加後に決まる）
        if (this.captureScreenshots) {
            try {
                const pageNumber = this.sitemapData.length;
                pageData.screenshot = await this.captureScreenshot(url, pageNumber);
            } catch (error) {
                console.error(`Screenshot error for ${url}:`, error.message);
                pageData.screenshot = 'Error';
            }
        }

        // 進行状況を更新
        const progress = Math.min((this.sitemapData.length / this.maxPages) * 80, 80); // 80%まで
        this.progressCallback('crawling', `ページを解析中... (${this.sitemapData.length}/${this.maxPages})`, 10 + progress, {
            currentUrl: url,
            pagesFound: this.sitemapData.length,
            queueSize: this.crawler.queueSize,
            currentDepth: depth
        });

        // 新しいリンクを抽出してキューに追加
        if (depth < this.maxDepth && this.sitemapData.length < this.maxPages) {
            this.extractAndQueueLinks($, url, depth);
        }
    }

    extractAndQueueLinks($, currentUrl, currentDepth) {
        const links = this.extractLinks($, currentUrl);
        const maxLinksPerPage = Math.max(10, 50 - (currentDepth * 10));
        
        let addedCount = 0;
        for (const link of links) {
            if (addedCount >= maxLinksPerPage) break;
            if (this.sitemapData.length >= this.maxPages) break;
            
            if (!this.visitedUrls.has(link)) {
                this.visitedUrls.add(link);
                
                // Crawlerにリンクを追加
                this.crawler.queue({
                    uri: link,
                    metadata: { depth: currentDepth + 1 }
                });
                
                addedCount++;
            }
        }
    }

    extractLinks($, currentUrl) {
        const links = new Set();
        
        $('a[href]').each((i, element) => {
            try {
                const href = $(element).attr('href');
                if (!href) return;

                const absoluteUrl = new URL(href, currentUrl).toString();
                const urlObj = new URL(absoluteUrl);
                
                // ベースパス以下のURLのみを対象とする
                const isWithinBasePath = urlObj.pathname.startsWith(this.basePath) || 
                                       urlObj.pathname === this.basePath.slice(0, -1); // 末尾スラッシュなしも許可
                
                if (urlObj.hostname === this.baseDomain && 
                    isWithinBasePath &&
                    !this.visitedUrls.has(absoluteUrl) &&
                    !absoluteUrl.includes('#') &&
                    !absoluteUrl.match(/\.(pdf|jpg|jpeg|png|gif|css|js|ico|zip|rar|exe|dmg)$/i)) {
                    links.add(absoluteUrl);
                }
            } catch (error) {
                // Invalid URL, skip
            }
        });

        return Array.from(links);
    }

    getViewportSize() {
        const viewports = {
            desktop: { width: 1920, height: 1080 },
            laptop: { width: 1280, height: 720 },
            tablet: { width: 768, height: 1024 },
            mobile: { width: 375, height: 667 }
        };
        return viewports[this.screenshotViewport] || viewports.desktop;
    }

    async initializeBrowser() {
        if (!this.browser && this.captureScreenshots) {
            try {
                // スクリーンショット用の一時ディレクトリを作成
                this.screenshotDir = path.join(__dirname, '..', 'temp', `screenshots_${Date.now()}`);
                if (!fs.existsSync(this.screenshotDir)) {
                    fs.mkdirSync(this.screenshotDir, { recursive: true });
                }
                
                // Playwrightでブラウザを起動
                this.browser = await chromium.launch({
                    headless: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                });
                console.log('Playwright browser initialized for screenshots');
                console.log('Screenshot directory:', this.screenshotDir);
            } catch (error) {
                console.error('Failed to initialize Playwright browser:', error.message);
                console.log('スクリーンショット機能を無効にします');
                this.captureScreenshots = false;
            }
        }
    }

    async captureScreenshot(url, pageNumber) {
        if (!this.browser) {
            await this.initializeBrowser();
            if (!this.browser) return 'Browser Error';
        }

        try {
            const context = await this.browser.newContext();
            const page = await context.newPage();
            const viewport = this.getViewportSize();
            
            await page.setViewportSize({
                width: viewport.width,
                height: viewport.height
            });

            await page.goto(url, { 
                waitUntil: 'networkidle', 
                timeout: 30000 
            });

            // ファイル名を連番で生成（3桁ゼロパディング）
            const paddedNumber = pageNumber.toString().padStart(3, '0');
            const fileName = `${paddedNumber}.${this.screenshotFormat}`;
            const filePath = path.join(this.screenshotDir, fileName);

            const screenshotOptions = {
                path: filePath,
                type: this.screenshotFormat,
                fullPage: this.fullPageScreenshot
            };

            if (this.screenshotFormat === 'jpeg') {
                screenshotOptions.quality = this.screenshotQuality;
            }

            await page.screenshot(screenshotOptions);
            await context.close();

            // スクリーンショットファイル情報を保存
            const fileInfo = {
                url: url,
                fileName: fileName,
                filePath: filePath,
                viewport: this.screenshotViewport,
                format: this.screenshotFormat,
                pageNumber: pageNumber
            };
            this.screenshotFiles.push(fileInfo);

            console.log(`Screenshot saved: ${fileName} (Page #${pageNumber}) for ${url}`);
            return 'Saved';
        } catch (error) {
            console.error(`Screenshot capture failed for ${url}:`, error.message);
            return 'Capture Error';
        }
    }

    async closeBrowser() {
        if (this.browser) {
            try {
                await this.browser.close();
                this.browser = null;
                console.log('Playwright browser closed');
            } catch (error) {
                console.error('Error closing browser:', error.message);
            }
        }
    }

    cleanupScreenshotDir() {
        if (this.screenshotDir && fs.existsSync(this.screenshotDir)) {
            try {
                // ディレクトリ内のファイルを削除
                const files = fs.readdirSync(this.screenshotDir);
                for (const file of files) {
                    fs.unlinkSync(path.join(this.screenshotDir, file));
                }
                // ディレクトリを削除
                fs.rmdirSync(this.screenshotDir);
                console.log('Screenshot directory cleaned up');
            } catch (error) {
                console.error('Error cleaning up screenshot directory:', error.message);
            }
        }
    }

    async getSSLInfo(hostname) {
        return new Promise((resolve) => {
            const options = {
                host: hostname,
                port: 443,
                rejectUnauthorized: false
            };

            const socket = tls.connect(options, () => {
                const cert = socket.getPeerCertificate();
                
                if (cert) {
                    const sslInfo = {
                        issuer: cert.issuer?.CN || cert.issuer?.O || 'Unknown',
                        validFrom: cert.valid_from,
                        validTo: cert.valid_to,
                        subject: cert.subject?.CN || 'Unknown',
                        serialNumber: cert.serialNumber,
                        signatureAlgorithm: cert.sigalg || 'Unknown'
                    };
                    
                    socket.end();
                    resolve(sslInfo);
                } else {
                    socket.end();
                    resolve({
                        issuer: 'No SSL Certificate',
                        validFrom: '',
                        validTo: '',
                        subject: '',
                        serialNumber: '',
                        signatureAlgorithm: ''
                    });
                }
            });

            socket.on('error', (error) => {
                console.log(`SSL Error for ${hostname}:`, error.message);
                resolve({
                    issuer: 'SSL Error',
                    validFrom: '',
                    validTo: '',
                    subject: '',
                    serialNumber: '',
                    signatureAlgorithm: ''
                });
            });

            socket.setTimeout(5000, () => {
                socket.destroy();
                resolve({
                    issuer: 'SSL Timeout',
                    validFrom: '',
                    validTo: '',
                    subject: '',
                    serialNumber: '',
                    signatureAlgorithm: ''
                });
            });
        });
    }


    async generate() {
        return new Promise(async (resolve, reject) => {
            console.log(`Starting sitemap generation with Node Crawler for: ${this.baseUrl}`);
            console.log(`Base path restriction: ${this.basePath}`);
            
            // スクリーンショット機能が有効な場合、ブラウザを初期化
            if (this.captureScreenshots) {
                this.progressCallback('initializing', 'スクリーンショット機能を初期化中...', 5);
                await this.initializeBrowser();
            }
            
            // SSL情報を取得
            if (this.baseUrl.startsWith('https://')) {
                this.progressCallback('ssl-check', 'SSL証明書情報を取得中...', 7);
                console.log('Getting SSL certificate information...');
                try {
                    this.sslInfo = await this.getSSLInfo(this.baseDomain);
                    console.log('SSL info retrieved:', this.sslInfo);
                } catch (error) {
                    console.log('Failed to get SSL info:', error.message);
                    this.sslInfo = {
                        issuer: 'SSL Info Error',
                        validFrom: '',
                        validTo: '',
                        subject: '',
                        serialNumber: '',
                        signatureAlgorithm: ''
                    };
                }
            }
            
            this.progressCallback('starting-crawler', 'クローラーを開始しています...', 10);
            
            // 完了時の処理を更新
            const originalResolve = resolve;
            this.onComplete = async (result) => {
                // ブラウザをクリーンアップ
                await this.closeBrowser();
                // スクリーンショットファイル情報を結果に追加
                result.screenshotFiles = this.screenshotFiles;
                result.screenshotDir = this.screenshotDir;
                originalResolve(result);
            };
            
            // 初期URLを処理開始
            this.visitedUrls.add(this.baseUrl);
            this.crawler.queue({
                uri: this.baseUrl,
                metadata: { depth: 0 }
            });

            // タイムアウト設定（30分）
            setTimeout(async () => {
                if (!this.isComplete) {
                    console.log('Crawling timeout reached');
                    this.isComplete = true;
                    await this.closeBrowser();
                    resolve({ 
                        sitemapData: this.sitemapData, 
                        sslInfo: this.sslInfo,
                        screenshotFiles: this.screenshotFiles,
                        screenshotDir: this.screenshotDir
                    });
                }
            }, 30 * 60 * 1000);
        });
    }

    // クローリング停止
    async stop() {
        this.isComplete = true;
        // 現在進行中のリクエストは完了させるが、新しいリクエストは停止
        this.crawler.queue = [];
        // ブラウザをクリーンアップ
        await this.closeBrowser();
    }
}

async function generateSitemap(url, options = {}) {
    const generator = new SitemapGenerator(url, options);
    return await generator.generate();
}

module.exports = { generateSitemap, SitemapGenerator };