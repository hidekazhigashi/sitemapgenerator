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

async function createExcelFile(sitemapData, sslInfo, baseUrl) {
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

    worksheet.columns = [
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

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
    };

    sortedData.forEach((page, index) => {
        const urlParts = parseUrlPath(page.url);
        
        const row = worksheet.addRow({
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
        });

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

    worksheet.addTable({
        name: 'SitemapTable',
        ref: 'A1',
        headerRow: true,
        totalsRow: false,
        style: {
            theme: 'TableStyleMedium9',
            showRowStripes: true,
        },
        columns: [
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
        ],
        rows: sortedData.map((page, index) => {
            const urlParts = parseUrlPath(page.url);
            return [
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
    summaryWorksheet.addRow(['Generated:', new Date().toLocaleString()]);

    // Summaryシートのスタイリング
    summaryWorksheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF0066CC' } };
    summaryWorksheet.getCell('A3').font = { bold: true, size: 12, color: { argb: 'FF333333' } };
    
    if (sslInfo && baseUrl.startsWith('https://')) {
        summaryWorksheet.getCell('A9').font = { bold: true, size: 12, color: { argb: 'FF333333' } };
        summaryWorksheet.getCell('A16').font = { bold: true, size: 12, color: { argb: 'FF333333' } };
    } else {
        summaryWorksheet.getCell('A9').font = { bold: true, size: 12, color: { argb: 'FF333333' } };
    }
    
    summaryWorksheet.getColumn('A').width = 25;
    summaryWorksheet.getColumn('B').width = 40;

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
}

module.exports = { createExcelFile };