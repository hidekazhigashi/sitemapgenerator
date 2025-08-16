class SitemapGenerator {
    constructor() {
        this.form = document.getElementById('sitemapForm');
        this.generateBtn = document.getElementById('generateBtn');
        this.statusSection = document.getElementById('statusSection');
        this.resultSection = document.getElementById('resultSection');
        this.errorSection = document.getElementById('errorSection');
        this.progressText = document.getElementById('progressText');
        this.progressFill = document.getElementById('progressFill');
        
        this.init();
    }
    
    init() {
        this.form.addEventListener('submit', this.handleSubmit.bind(this));
        document.getElementById('retryBtn').addEventListener('click', this.retry.bind(this));
        document.getElementById('downloadBtn').addEventListener('click', this.downloadAgain.bind(this));
        document.getElementById('toggleAdvanced').addEventListener('click', this.toggleAdvancedSettings.bind(this));
        document.getElementById('captureScreenshots').addEventListener('change', this.toggleScreenshotSettings.bind(this));
    }
    
    toggleScreenshotSettings() {
        const checkbox = document.getElementById('captureScreenshots');
        const settings = document.getElementById('screenshotSettings');
        
        if (checkbox.checked) {
            settings.style.display = 'block';
        } else {
            settings.style.display = 'none';
        }
    }
    
    toggleAdvancedSettings() {
        const toggleBtn = document.getElementById('toggleAdvanced');
        const advancedOptions = document.getElementById('advancedOptions');
        const toggleIcon = toggleBtn.querySelector('.toggle-icon');
        
        if (advancedOptions.style.display === 'none') {
            advancedOptions.style.display = 'block';
            toggleBtn.classList.add('active');
            toggleIcon.textContent = '▲';
        } else {
            advancedOptions.style.display = 'none';
            toggleBtn.classList.remove('active');
            toggleIcon.textContent = '▼';
        }
    }
    
    async handleSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(this.form);
        const url = formData.get('url');
        const maxDepth = parseInt(formData.get('maxDepth'));
        const maxPages = parseInt(formData.get('maxPages'));
        
        // 詳細設定の値を取得
        const maxConnections = parseInt(formData.get('maxConnections')) || 5;
        const timeout = parseInt(formData.get('timeout')) * 1000 || 10000; // 秒をミリ秒に変換
        const retries = parseInt(formData.get('retries')) || 2;
        const delay = parseInt(formData.get('delay')) || 500;
        
        // スクリーンショット設定の値を取得
        const captureScreenshots = formData.get('captureScreenshots') === 'on';
        const screenshotViewport = formData.get('screenshotViewport') || 'desktop';
        const screenshotFormat = formData.get('screenshotFormat') || 'png';
        const screenshotQuality = parseInt(formData.get('screenshotQuality')) || 80;
        const fullPageScreenshot = formData.get('fullPageScreenshot') === 'on';
        
        if (!this.validateUrl(url)) {
            this.showError('有効なURLを入力してください');
            return;
        }
        
        this.startGeneration();
        
        try {
            await this.generateSitemap(url, { 
                maxDepth, 
                maxPages, 
                maxConnections, 
                timeout, 
                retries, 
                delay,
                captureScreenshots,
                screenshotViewport,
                screenshotFormat,
                screenshotQuality,
                fullPageScreenshot
            });
        } catch (error) {
            this.showError(error.message);
        }
    }
    
    validateUrl(url) {
        try {
            new URL(url);
            return url.startsWith('http://') || url.startsWith('https://');
        } catch {
            return false;
        }
    }
    
    startGeneration() {
        this.hideAllSections();
        this.statusSection.style.display = 'block';
        this.setButtonLoading(true);
        this.updateProgress('サイトマップ生成を開始しています...', 10);
    }
    
    async generateSitemap(url, options) {
        try {
            // セッションIDを生成
            const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            // Server-Sent Eventsで進行状況を受信
            this.setupProgressStream(sessionId);
            
            const response = await fetch('/api/generate-sitemap', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url, sessionId, ...options })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'サーバーエラーが発生しました');
            }
            
            this.updateProgress('Excelファイルを生成しています...', 80);
            
            const blob = await response.blob();
            
            this.updateProgress('ダウンロードを準備しています...', 95);
            
            this.downloadFile(blob, this.generateFileName(url));
            
            this.updateProgress('完了！', 100);
            
            setTimeout(() => {
                this.showSuccess();
            }, 500);
            
        } catch (error) {
            console.error('Generation error:', error);
            throw error;
        }
    }
    
    downloadFile(blob, filename) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        this.lastDownloadBlob = blob;
        this.lastDownloadFilename = filename;
    }
    
    generateFileName(url) {
        try {
            const domain = new URL(url).hostname.replace(/^www\./, '');
            const timestamp = new Date().toISOString().slice(0, 10);
            return `sitemap_${domain}_${timestamp}.zip`;
        } catch {
            return `sitemap_${Date.now()}.zip`;
        }
    }
    
    setupProgressStream(sessionId) {
        this.eventSource = new EventSource(`/api/progress/${sessionId}`);
        
        this.eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.updateDetailedProgress(data);
            } catch (error) {
                console.error('Progress parsing error:', error);
            }
        };
        
        this.eventSource.onerror = (error) => {
            console.error('SSE Error:', error);
        };
    }
    
    updateDetailedProgress(data) {
        const { phase, message, percentage, currentUrl, pagesFound, queueSize, currentDepth } = data;
        
        // メインメッセージと進行状況を更新
        this.progressText.textContent = message;
        this.progressFill.style.width = `${percentage}%`;
        
        // 詳細情報を表示
        this.updatePhaseIndicator(phase);
        
        if (currentUrl || pagesFound !== undefined) {
            this.updateCrawlingDetails(currentUrl, pagesFound, queueSize, currentDepth);
        }
    }
    
    updatePhaseIndicator(phase) {
        // 既存のフェーズインジケーターがあれば削除
        const existingIndicator = document.querySelector('.phase-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        // 新しいフェーズインジケーターを作成
        const indicator = document.createElement('div');
        indicator.className = 'phase-indicator';
        
        const phases = {
            'connecting': { text: '🔗 接続中', color: '#667eea' },
            'initializing': { text: '⚙️ 初期化中', color: '#667eea' },
            'ssl-check': { text: '🔒 SSL確認中', color: '#f39c12' },
            'starting-crawler': { text: '🚀 クローラー開始', color: '#e67e22' },
            'crawling': { text: '🕷️ クローリング中', color: '#27ae60' },
            'generating-excel': { text: '📊 Excel生成中', color: '#9b59b6' },
            'creating-zip': { text: '📦 ZIP作成中', color: '#8e44ad' },
            'completed': { text: '✅ 完了', color: '#2ecc71' }
        };
        
        const phaseInfo = phases[phase] || { text: '🔄 処理中', color: '#95a5a6' };
        indicator.innerHTML = `<span style="color: ${phaseInfo.color}">${phaseInfo.text}</span>`;
        
        this.progressText.parentNode.insertBefore(indicator, this.progressText);
    }
    
    updateCrawlingDetails(currentUrl, pagesFound, queueSize, currentDepth) {
        // 詳細情報エリアを作成または更新
        let detailsArea = document.querySelector('.crawling-details');
        if (!detailsArea) {
            detailsArea = document.createElement('div');
            detailsArea.className = 'crawling-details';
            this.progressText.parentNode.appendChild(detailsArea);
        }
        
        detailsArea.innerHTML = `
            <div class="detail-item">📄 発見ページ数: <strong>${pagesFound || 0}</strong></div>
            <div class="detail-item">📊 キュー残数: <strong>${queueSize || 0}</strong></div>
            <div class="detail-item">🔗 現在の深度: <strong>${currentDepth || 0}</strong></div>
            ${currentUrl ? `<div class="detail-item current-url">🌐 処理中: <span title="${currentUrl}">${this.shortenUrl(currentUrl)}</span></div>` : ''}
        `;
    }
    
    shortenUrl(url) {
        if (url.length > 50) {
            return url.substring(0, 47) + '...';
        }
        return url;
    }

    updateProgress(text, percentage) {
        this.progressText.textContent = text;
        this.progressFill.style.width = `${percentage}%`;
    }
    
    showSuccess() {
        this.hideAllSections();
        this.resultSection.style.display = 'block';
        this.setButtonLoading(false);
        this.cleanupEventSource();
    }
    
    showError(message) {
        this.hideAllSections();
        this.errorSection.style.display = 'block';
        document.getElementById('errorMessage').textContent = message;
        this.setButtonLoading(false);
        this.cleanupEventSource();
    }
    
    cleanupEventSource() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        
        // 詳細情報エリアをクリア
        const detailsArea = document.querySelector('.crawling-details');
        if (detailsArea) {
            detailsArea.remove();
        }
        
        const phaseIndicator = document.querySelector('.phase-indicator');
        if (phaseIndicator) {
            phaseIndicator.remove();
        }
    }
    
    hideAllSections() {
        this.statusSection.style.display = 'none';
        this.resultSection.style.display = 'none';
        this.errorSection.style.display = 'none';
    }
    
    setButtonLoading(loading) {
        const btnText = this.generateBtn.querySelector('.btn-text');
        const spinner = this.generateBtn.querySelector('.spinner');
        
        if (loading) {
            btnText.textContent = '生成中...';
            spinner.style.display = 'inline-block';
            this.generateBtn.disabled = true;
        } else {
            btnText.textContent = 'サイトマップを生成';
            spinner.style.display = 'none';
            this.generateBtn.disabled = false;
        }
    }
    
    retry() {
        this.hideAllSections();
        this.setButtonLoading(false);
    }
    
    downloadAgain() {
        if (this.lastDownloadBlob && this.lastDownloadFilename) {
            this.downloadFile(this.lastDownloadBlob, this.lastDownloadFilename);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SitemapGenerator();
});