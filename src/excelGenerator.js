const ExcelJS = require('exceljs');

function parseUrlPath(url) {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        
        // パスを'/'で分割し、空文字列を除去
        let pathSegments = pathname.split('/').filter(segment => segment !== '');
        
        // ルートパスの場合
        if (pathSegments.length === 0) {
            return { level1: '/', level2: '', level3: '', level4: '', level5: '', fullPath: '/' };
        }
        
        // 最大5階層まで
        const levels = ['', '', '', '', ''];
        pathSegments.slice(0, 5).forEach((segment, index) => {
            levels[index] = segment;
        });
        
        return {
            level1: levels[0] || '',
            level2: levels[1] || '',
            level3: levels[2] || '',
            level4: levels[3] || '',
            level5: levels[4] || '',
            fullPath: pathname
        };
    } catch (error) {
        return { level1: '', level2: '', level3: '', level4: '', level5: '', fullPath: url };
    }
}

async function createExcelFile(sitemapData, sslInfo, baseUrl, screenshotFiles = []) {
    const workbook = new ExcelJS.Workbook();
    
    // Summaryシートを最初に作成
    const summaryWorksheet = workbook.addWorksheet('Summary');
    
    // Sitemapシートを2番目に作成
    const worksheet = workbook.addWorksheet('Sitemap');

    // Full Pathでソート
    const sortedData = sitemapData.sort((a, b) => {
        const pathA = parseUrlPath(a.url).fullPath;
        const pathB = parseUrlPath(b.url).fullPath;
        return pathA.localeCompare(pathB);
    });

    // スクリーンショットが含まれているかチェック
    const hasScreenshots = sortedData.some(page => page.screenshot !== null && page.screenshot !== undefined);

    // 基本的な列定義
    const baseColumns = [
        { header: 'No.', key: 'no', width: 8 },
        { header: 'Level 1', key: 'level1', width: 20 },
        { header: 'Level 2', key: 'level2', width: 20 },
        { header: 'Level 3', key: 'level3', width: 20 },
        { header: 'Level 4', key: 'level4', width: 20 },
        { header: 'Level 5', key: 'level5', width: 20 },
        { header: 'Full Path', key: 'fullPath', width: 40 },
        { header: 'Page Title', key: 'title', width: 40 },
        { header: 'Meta Description', key: 'metaDescription', width: 60 },
        { header: 'H1', key: 'h1', width: 40 },
        { header: 'Depth', key: 'depth', width: 10 },
        { header: 'Status', key: 'status', width: 10 },
        { header: 'Content Type', key: 'contentType', width: 30 }
    ];

    // スクリーンショット列を追加
    if (hasScreenshots) {
        baseColumns.push({ header: 'Screenshot', key: 'screenshot', width: 15 });
    }

    worksheet.columns = baseColumns;

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
    };

    sortedData.forEach((page, index) => {
        const urlParts = parseUrlPath(page.url);
        
        const rowData = {
            no: index + 1,
            level1: urlParts.level1,
            level2: urlParts.level2,
            level3: urlParts.level3,
            level4: urlParts.level4,
            level5: urlParts.level5,
            fullPath: urlParts.fullPath,
            title: page.title,
            metaDescription: page.metaDescription,
            h1: page.h1,
            depth: page.depth,
            status: page.status,
            contentType: page.contentType
        };

        // スクリーンショット情報を追加
        if (hasScreenshots) {
            if (page.screenshot && page.screenshot !== 'Error' && page.screenshot !== 'Capture Error' && page.screenshot !== 'Browser Error') {
                // Excelの連番に対応するファイル名を表示
                const excelNumber = (index + 1).toString().padStart(3, '0');
                // screenshotFilesからフォーマット情報を取得
                const screenshotFile = screenshotFiles.find(sf => sf.url === page.url);
                const format = screenshotFile ? screenshotFile.format : 'png';
                rowData.screenshot = `${excelNumber}.${format}`;
            } else if (page.screenshot) {
                rowData.screenshot = page.screenshot; // Error情報を表示
            } else {
                rowData.screenshot = 'None';
            }
        }

        const row = worksheet.addRow(rowData);

        if (page.status !== 200 && page.status !== '200') {
            row.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFCCCC' }
            };
        }

        // 階層レベルに応じた色分け
        const levelColors = ['FFE6F3FF', 'FFD4F3FF', 'FFC2F0FF', 'FFB0ECFF', 'FF9EE8FF'];
        
        // Level列に色を適用
        ['level1', 'level2', 'level3', 'level4', 'level5'].forEach((levelKey, index) => {
            if (row.getCell(levelKey).value) {
                row.getCell(levelKey).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: levelColors[index] }
                };
            }
        });
        
        // Depth列にも色を適用
        const depthColors = ['FFFFFF', 'FFF2CC', 'FFE699', 'FFDB4D', 'FFD700'];
        const colorIndex = Math.min(page.depth, depthColors.length - 1);
        
        row.getCell('depth').fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: depthColors[colorIndex] }
        };
    });

    // テーブル列定義を動的に作成
    const tableColumns = [
        { name: 'No.' },
        { name: 'Level 1' },
        { name: 'Level 2' },
        { name: 'Level 3' },
        { name: 'Level 4' },
        { name: 'Level 5' },
        { name: 'Full Path' },
        { name: 'Page Title' },
        { name: 'Meta Description' },
        { name: 'H1' },
        { name: 'Depth' },
        { name: 'Status' },
        { name: 'Content Type' }
    ];

    if (hasScreenshots) {
        tableColumns.push({ name: 'Screenshot' });
    }

    worksheet.addTable({
        name: 'SitemapTable',
        ref: 'A1',
        headerRow: true,
        totalsRow: false,
        style: {
            theme: 'TableStyleMedium9',
            showRowStripes: true,
        },
        columns: tableColumns,
        rows: sortedData.map((page, index) => {
            const urlParts = parseUrlPath(page.url);
            const row = [
                index + 1,
                urlParts.level1,
                urlParts.level2,
                urlParts.level3,
                urlParts.level4,
                urlParts.level5,
                urlParts.fullPath,
                page.title,
                page.metaDescription,
                page.h1,
                page.depth,
                page.status,
                page.contentType
            ];

            if (hasScreenshots) {
                if (page.screenshot && page.screenshot !== 'Error' && page.screenshot !== 'Capture Error' && page.screenshot !== 'Browser Error') {
                    // Excelの連番に対応するファイル名を表示
                    const excelNumber = (index + 1).toString().padStart(3, '0');
                    // screenshotFilesからフォーマット情報を取得
                    const screenshotFile = screenshotFiles.find(sf => sf.url === page.url);
                    const format = screenshotFile ? screenshotFile.format : 'png';
                    row.push(`${excelNumber}.${format}`);
                } else if (page.screenshot) {
                    row.push(page.screenshot); // Error情報を表示
                } else {
                    row.push('None');
                }
            }

            return row;
        })
    });

    // Summaryシートの内容を作成
    const totalPages = sortedData.length;
    const errorPages = sortedData.filter(page => (page.status !== 200 && page.status !== '200')).length;
    const maxDepth = Math.max(...sortedData.map(page => page.depth));
    const uniqueDomains = new Set(sortedData.map(page => {
        try {
            return new URL(page.url).hostname;
        } catch {
            return 'unknown';
        }
    }));

    // スクリーンショット統計
    let screenshotStats = null;
    if (hasScreenshots) {
        const successfulScreenshots = sortedData.filter(page => 
            page.screenshot && 
            page.screenshot !== 'Error' && 
            page.screenshot !== 'Capture Error' && 
            page.screenshot !== 'Browser Error'
        ).length;
        const failedScreenshots = sortedData.filter(page => 
            page.screenshot && 
            (page.screenshot === 'Error' || page.screenshot === 'Capture Error' || page.screenshot === 'Browser Error')
        ).length;
        
        screenshotStats = {
            total: totalPages,
            successful: successfulScreenshots,
            failed: failedScreenshots,
            successRate: Math.round((successfulScreenshots / totalPages) * 100)
        };
    }

    // Summary情報を追加
    summaryWorksheet.addRow(['Sitemap Analysis Report']);
    summaryWorksheet.addRow([]);
    
    // 検索ドメイン情報
    summaryWorksheet.addRow(['Domain Information']);
    summaryWorksheet.addRow(['Target URL:', baseUrl]);
    summaryWorksheet.addRow(['Domain:', new URL(baseUrl).hostname]);
    summaryWorksheet.addRow(['Protocol:', new URL(baseUrl).protocol]);
    summaryWorksheet.addRow([]);
    
    // SSL証明書情報
    if (sslInfo && baseUrl.startsWith('https://')) {
        summaryWorksheet.addRow(['SSL Certificate Information']);
        summaryWorksheet.addRow(['Certificate Issuer:', sslInfo.issuer]);
        summaryWorksheet.addRow(['Subject:', sslInfo.subject]);
        summaryWorksheet.addRow(['Valid From:', sslInfo.validFrom]);
        summaryWorksheet.addRow(['Valid To:', sslInfo.validTo]);
        summaryWorksheet.addRow(['Signature Algorithm:', sslInfo.signatureAlgorithm]);
        summaryWorksheet.addRow(['Serial Number:', sslInfo.serialNumber]);
        summaryWorksheet.addRow([]);
    }
    
    // クローリング統計
    summaryWorksheet.addRow(['Crawling Statistics']);
    summaryWorksheet.addRow(['Total Pages Found:', totalPages]);
    summaryWorksheet.addRow(['Error Pages:', errorPages]);
    summaryWorksheet.addRow(['Maximum Depth:', maxDepth]);
    summaryWorksheet.addRow(['Unique Domains:', uniqueDomains.size]);
    summaryWorksheet.addRow([]);
    
    // スクリーンショット統計
    if (screenshotStats) {
        summaryWorksheet.addRow(['Screenshot Statistics']);
        summaryWorksheet.addRow(['Screenshots Captured:', screenshotStats.successful]);
        summaryWorksheet.addRow(['Screenshot Failures:', screenshotStats.failed]);
        summaryWorksheet.addRow(['Success Rate:', `${screenshotStats.successRate}%`]);
        summaryWorksheet.addRow([]);
    }
    
    summaryWorksheet.addRow(['Generated:', new Date().toLocaleString()]);

    // Summaryシートのスタイリング
    summaryWorksheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF0066CC' } };
    summaryWorksheet.getCell('A3').font = { bold: true, size: 12, color: { argb: 'FF333333' } };
    
    // セクションヘッダーのスタイリング（動的に行数を計算）
    let currentRow = 9; // Crawling Statistics行
    if (sslInfo && baseUrl.startsWith('https://')) {
        summaryWorksheet.getCell('A9').font = { bold: true, size: 12, color: { argb: 'FF333333' } };
        currentRow = 16; // SSL情報がある場合は16行目
    }
    summaryWorksheet.getCell(`A${currentRow}`).font = { bold: true, size: 12, color: { argb: 'FF333333' } };
    
    // スクリーンショット統計のヘッダースタイリング
    if (screenshotStats) {
        const screenshotHeaderRow = currentRow + 6; // Crawling Statisticsの後
        summaryWorksheet.getCell(`A${screenshotHeaderRow}`).font = { bold: true, size: 12, color: { argb: 'FF333333' } };
    }
    
    summaryWorksheet.getColumn('A').width = 25;
    summaryWorksheet.getColumn('B').width = 40;

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
}

module.exports = { createExcelFile };