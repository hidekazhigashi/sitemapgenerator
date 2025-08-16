const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { generateSitemap } = require('./scraper');
const { createExcelFile } = require('./excelGenerator');

// 進行状況管理
const progressSessions = new Map();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Server-Sent Events エンドポイント
app.get('/api/progress/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // セッションを登録
    progressSessions.set(sessionId, res);
    
    // 初期メッセージ
    res.write(`data: ${JSON.stringify({
        phase: 'connecting',
        message: '接続を確立しています...',
        percentage: 0
    })}\n\n`);

    // クライアントが切断した時の処理
    req.on('close', () => {
        progressSessions.delete(sessionId);
    });
});

// 進行状況を送信する関数
function sendProgress(sessionId, phase, message, percentage, details = {}) {
    const session = progressSessions.get(sessionId);
    if (session) {
        const data = {
            phase,
            message,
            percentage,
            timestamp: new Date().toISOString(),
            ...details
        };
        session.write(`data: ${JSON.stringify(data)}\n\n`);
    }
}

app.post('/api/generate-sitemap', async (req, res) => {
    try {
        const { url, maxDepth, maxPages, maxConnections, timeout, retries, delay, sessionId } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        const options = {
            maxDepth: maxDepth || 3,
            maxPages: maxPages || 100,
            maxConnections: maxConnections || 5,
            timeout: timeout || 10000,
            retries: retries || 2,
            delay: delay || 500,
            progressCallback: (phase, message, percentage, details) => {
                sendProgress(sessionId, phase, message, percentage, details);
            }
        };

        console.log(`Starting sitemap generation for: ${url} with options:`, options);
        
        // 初期化フェーズ
        sendProgress(sessionId, 'initializing', '設定を初期化しています...', 5);
        
        const result = await generateSitemap(url, options);
        const { sitemapData, sslInfo } = result;
        
        // Excel生成フェーズ
        sendProgress(sessionId, 'generating-excel', 'Excelファイルを生成しています...', 90);
        
        const excelBuffer = await createExcelFile(sitemapData, sslInfo, url);
        
        // 完了フェーズ
        sendProgress(sessionId, 'completed', '完了しました！', 100, {
            totalPages: sitemapData.length
        });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="sitemap.xlsx"');
        res.send(excelBuffer);
        
    } catch (error) {
        console.error('Error generating sitemap:', error);
        res.status(500).json({ 
            error: 'Failed to generate sitemap',
            details: error.message 
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});