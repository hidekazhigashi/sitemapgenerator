const Crawler = require('crawler');
const { URL } = require('url');
const https = require('https');
const tls = require('tls');

class SitemapGenerator {
    constructor(baseUrl, options = {}) {
        this.baseUrl = baseUrl;
        this.baseDomain = new URL(baseUrl).hostname;
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
                    error: error.message
                });
            }
        } else {
            this.processPageResult(res);
        }
        
        done();
    }

    processPageResult(res) {
        const url = res.request.uri.href;
        const depth = res.options.metadata?.depth || 0;
        const $ = res.$;

        console.log(`Processed: ${url} (depth: ${depth}, queue: ${this.crawler.queueSize}, total: ${this.sitemapData.length + 1})`);

        // ページ情報を抽出
        const title = $('title').text().trim() || 'No Title';
        const metaDescription = $('meta[name="description"]').attr('content') || '';
        const h1 = $('h1').first().text().trim() || '';

        this.sitemapData.push({
            url: url,
            title: title,
            metaDescription: metaDescription,
            h1: h1,
            depth: depth,
            status: res.statusCode || 200,
            contentType: res.headers['content-type'] || '',
            lastModified: res.headers['last-modified'] || '',
            contentLength: res.headers['content-length'] || ''
        });

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
                
                if (urlObj.hostname === this.baseDomain && 
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
            this.onComplete = resolve;
            
            // 初期URLを処理開始
            this.visitedUrls.add(this.baseUrl);
            this.crawler.queue({
                uri: this.baseUrl,
                metadata: { depth: 0 }
            });

            // タイムアウト設定（30分）
            setTimeout(() => {
                if (!this.isComplete) {
                    console.log('Crawling timeout reached');
                    this.isComplete = true;
                    resolve({ sitemapData: this.sitemapData, sslInfo: this.sslInfo });
                }
            }, 30 * 60 * 1000);
        });
    }

    // クローリング停止
    stop() {
        this.isComplete = true;
        // 現在進行中のリクエストは完了させるが、新しいリクエストは停止
        this.crawler.queue = [];
    }
}

async function generateSitemap(url, options = {}) {
    const generator = new SitemapGenerator(url, options);
    return await generator.generate();
}

module.exports = { generateSitemap };