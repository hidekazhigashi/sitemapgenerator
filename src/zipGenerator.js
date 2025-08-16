const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

async function createZipFile(excelBuffer, sitemapData, screenshotFiles, screenshotDir, baseUrl) {
    return new Promise((resolve, reject) => {
        try {
            // ZIPアーカイブを作成
            const archive = archiver('zip', {
                zlib: { level: 9 } // 最高圧縮レベル
            });

            const chunks = [];
            
            // データイベントでチャンクを収集
            archive.on('data', (chunk) => {
                chunks.push(chunk);
            });

            // 完了時の処理
            archive.on('end', () => {
                const zipBuffer = Buffer.concat(chunks);
                console.log(`ZIP created: ${archive.pointer()} total bytes`);
                resolve(zipBuffer);
            });

            // エラーハンドリング
            archive.on('error', (err) => {
                console.error('ZIP creation error:', err);
                reject(err);
            });

            // Excelファイルを追加
            const domain = new URL(baseUrl).hostname.replace(/^www\./, '');
            const timestamp = new Date().toISOString().slice(0, 10);
            const excelFileName = `sitemap_${domain}_${timestamp}.xlsx`;
            
            archive.append(excelBuffer, { name: excelFileName });
            console.log(`Added Excel file: ${excelFileName}`);

            // スクリーンショットファイルを追加（スクリーンショットがある場合のみ）
            if (screenshotFiles && screenshotFiles.length > 0 && screenshotDir && fs.existsSync(screenshotDir)) {
                console.log(`Adding ${screenshotFiles.length} screenshot files...`);
                
                // sitemapDataのソート順に合わせてスクリーンショットファイルを再マッピング
                const sortedData = sitemapData.sort((a, b) => {
                    const parseUrlPath = (url) => {
                        try {
                            const urlObj = new URL(url);
                            return urlObj.pathname;
                        } catch {
                            return url;
                        }
                    };
                    const pathA = parseUrlPath(a.url);
                    const pathB = parseUrlPath(b.url);
                    return pathA.localeCompare(pathB);
                });

                // screenshotsフォルダ内に画像を配置（Excelの連番順で）
                for (let i = 0; i < sortedData.length; i++) {
                    const pageData = sortedData[i];
                    if (pageData.screenshot && pageData.screenshot === 'Saved') {
                        // 元のスクリーンショットファイルを見つける
                        const originalFile = screenshotFiles.find(file => file.url === pageData.url);
                        if (originalFile && fs.existsSync(originalFile.filePath)) {
                            // Excelの連番（1から開始）でファイル名を生成
                            const excelNumber = (i + 1).toString().padStart(3, '0');
                            const newFileName = `${excelNumber}.${originalFile.format}`;
                            const screenshotPath = `screenshots/${newFileName}`;
                            archive.file(originalFile.filePath, { name: screenshotPath });
                            console.log(`Added screenshot: ${screenshotPath} (Excel Row ${i + 1}) from ${originalFile.fileName} for ${pageData.url}`);
                        }
                    }
                }

                // README.txtファイルを作成
                const readmeContent = generateReadmeContent(sortedData, screenshotFiles, baseUrl);
                archive.append(readmeContent, { name: 'README.txt' });
            } else {
                // スクリーンショットがない場合でもREADME.txtを作成
                console.log('No screenshots to add, creating ZIP with Excel file only');
                const readmeContent = generateReadmeContent(sitemapData, [], baseUrl);
                archive.append(readmeContent, { name: 'README.txt' });
            }

            // アーカイブを完了
            archive.finalize();

        } catch (error) {
            console.error('Error creating ZIP file:', error);
            reject(error);
        }
    });
}

function generateReadmeContent(sitemapData, screenshotFiles, baseUrl) {
    const domain = new URL(baseUrl).hostname;
    const timestamp = new Date().toLocaleString();
    
    let content = `Sitemap Generator - Export Package
=================================

Generated: ${timestamp}
Target URL: ${baseUrl}
Domain: ${domain}

Files Included:
==============

1. Excel File:
   - sitemap_${domain.replace(/^www\./, '')}_${new Date().toISOString().slice(0, 10)}.xlsx
   - Contains complete sitemap data with page information

`;

    if (screenshotFiles && screenshotFiles.length > 0) {
        content += `2. Screenshots (${screenshotFiles.length} files):
   - Located in 'screenshots/' folder
   - Format: ${screenshotFiles[0]?.format || 'png'}
   - Viewport: ${screenshotFiles[0]?.viewport || 'desktop'}
   
Screenshot Files:
`;

        // ソート済みデータに基づいてスクリーンショットファイルリストを表示
        const sortedData = sitemapData.sort((a, b) => {
            const parseUrlPath = (url) => {
                try {
                    const urlObj = new URL(url);
                    return urlObj.pathname;
                } catch {
                    return url;
                }
            };
            const pathA = parseUrlPath(a.url);
            const pathB = parseUrlPath(b.url);
            return pathA.localeCompare(pathB);
        });

        sortedData.forEach((pageData, index) => {
            if (pageData.screenshot && pageData.screenshot === 'Saved') {
                const excelNumber = (index + 1).toString().padStart(3, '0');
                const format = screenshotFiles.find(f => f.url === pageData.url)?.format || 'png';
                content += `   ${index + 1}. ${excelNumber}.${format} - ${pageData.url}\n`;
            }
        });
    } else {
        content += `2. Screenshots: None captured
   - Screenshot capture was disabled or failed
`;
    }

    content += `
Statistics:
==========
Total Pages: ${sitemapData.length}
Screenshots: ${screenshotFiles ? screenshotFiles.length : 0}

Generated with Sitemap Generator
© 2025 Claude Code
`;

    return content;
}

module.exports = { createZipFile };