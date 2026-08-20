/**
 * Notion to Website - Article Fetcher
 * Converts Notion pages to HTML and saves to articles.json.
 * Cover images are downloaded locally (Notion URLs expire).
 *
 * Dependencies: @notionhq/client, notion-to-md, marked
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// ============================================
// IMPORTS & INITIALIZATION
// ============================================

let Client, NotionToMarkdown, marked;

try {
    const notionModule = require('@notionhq/client');
    Client = notionModule.Client;
    console.log('✅ @notionhq/client loaded');
} catch (err) {
    console.error('❌ Failed to load @notionhq/client:', err.message);
    process.exit(1);
}

try {
    const n2mModule = require('notion-to-md');
    NotionToMarkdown = n2mModule.NotionToMarkdown;
    console.log('✅ notion-to-md loaded');
} catch (err) {
    console.error('❌ Failed to load notion-to-md:', err.message);
    process.exit(1);
}

try {
    const markedModule = require('marked');
    marked = markedModule.marked;
    console.log('✅ marked loaded');
} catch (err) {
    console.error('❌ Failed to load marked:', err.message);
    process.exit(1);
}

// ============================================
// ENVIRONMENT VALIDATION
// ============================================

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

if (!NOTION_API_KEY) {
    console.error('❌ NOTION_API_KEY is not set');
    process.exit(1);
}

if (!DATABASE_ID) {
    console.error('❌ NOTION_DATABASE_ID is not set');
    process.exit(1);
}

// ============================================
// NOTION CLIENT SETUP
// ============================================

const notion = new Client({ auth: NOTION_API_KEY });
const n2m = new NotionToMarkdown({ notionClient: notion });

console.log('✅ Notion client initialized');
console.log('📋 Database ID:', DATABASE_ID.substring(0, 8) + '...');

// ============================================
// IMAGE DOWNLOAD HELPERS
// ============================================

const IMAGES_DIR = path.join(process.cwd(), 'assets', 'images', 'articles');
const PLACEHOLDER = 'assets/images/cover-placeholder.svg';

function ensureImagesDir() {
    if (!fs.existsSync(IMAGES_DIR)) {
        fs.mkdirSync(IMAGES_DIR, { recursive: true });
        console.log('📁 Created images directory:', IMAGES_DIR);
    }
}

/**
 * Download a remote cover and save locally.
 * Returns a local relative path, or PLACEHOLDER if the download fails.
 */
function downloadImage(imageUrl, filename) {
    return new Promise((resolve) => {
        if (!imageUrl) {
            resolve(null);
            return;
        }

        try {
            const parsedUrl = new URL(imageUrl);
            let ext = path.extname(parsedUrl.pathname).split('?')[0] || '.jpg';
            ext = ext.match(/\.(jpg|jpeg|png|gif|webp|svg|avif)/i)?.[0] || '.jpg';

            const localFilename = `${filename}${ext}`;
            const localPath = path.join(IMAGES_DIR, localFilename);
            const relativePath = `assets/images/articles/${localFilename}`;
            const protocol = parsedUrl.protocol === 'https:' ? https : http;

            const request = protocol.get(imageUrl, { timeout: 30000 }, (response) => {
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    downloadImage(response.headers.location, filename).then(resolve);
                    return;
                }

                if (response.statusCode !== 200) {
                    console.warn(`   ⚠️ Failed to download cover (HTTP ${response.statusCode})`);
                    resolve(PLACEHOLDER);
                    return;
                }

                const fileStream = fs.createWriteStream(localPath);
                response.pipe(fileStream);

                fileStream.on('finish', () => {
                    fileStream.close();
                    const sizeKB = (fs.statSync(localPath).size / 1024).toFixed(1);
                    console.log(`   📥 Downloaded cover: ${localFilename} (${sizeKB} KB)`);
                    optimizeImage(localPath, relativePath).then(resolve);
                });

                fileStream.on('error', (err) => {
                    fs.unlink(localPath, () => {});
                    console.warn(`   ⚠️ Error writing cover file: ${err.message}`);
                    resolve(PLACEHOLDER);
                });
            });

            request.on('error', (err) => {
                console.warn(`   ⚠️ Error downloading cover: ${err.message}`);
                resolve(PLACEHOLDER);
            });

            request.on('timeout', () => {
                request.destroy();
                console.warn('   ⚠️ Timeout downloading cover');
                resolve(PLACEHOLDER);
            });
        } catch (err) {
            console.warn(`   ⚠️ Invalid cover URL: ${err.message}`);
            resolve(PLACEHOLDER);
        }
    });
}

/**
 * Replace every remote image URL in the article body with a locally
 * downloaded copy. Mirrors downloadAndReplaceImages() in fetch-projects.js —
 * without it the body images rot on the same one-hour clock as the covers.
 */
async function downloadAndReplaceImages(html, articleId) {
    const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi;
    const matches = [...html.matchAll(imgRegex)];
    if (matches.length === 0) return html;

    let updatedHtml = html;
    let imgIndex = 0;

    for (const match of matches) {
        const originalUrl = match[1];

        // Skip already-local paths
        if (originalUrl.startsWith('assets/') || originalUrl.startsWith('./') || originalUrl.startsWith('/')) {
            continue;
        }

        const localPath = await downloadImage(originalUrl, `${articleId}-content-${imgIndex}`);
        if (localPath && localPath !== originalUrl) {
            updatedHtml = updatedHtml.replace(originalUrl, localPath);
        }
        imgIndex++;
    }

    return updatedHtml;
}


/**
 * Re-encode a downloaded image as a width-capped WebP and drop the original.
 * Notion hands back full-resolution exports — the project images were landing
 * at 6.6 MB each, which put one project page at 10.7 MB of images alone.
 * Falls back to the untouched original if `sharp` is unavailable, so the sync
 * never fails over an optimisation step.
 *
 * @returns {string} the relative path the JSON should reference
 */
async function optimizeImage(localPath, relativePath, maxWidth = 1600) {
    let sharp;
    try {
        sharp = require('sharp');
    } catch {
        console.warn('   ⚠️ sharp unavailable — keeping original image');
        return relativePath;
    }

    const webpPath = localPath.replace(/\.(png|jpe?g)$/i, '.webp');
    if (webpPath === localPath) return relativePath;   // already webp/svg/gif

    try {
        const before = fs.statSync(localPath).size;
        await sharp(localPath)
            .resize({ width: maxWidth, withoutEnlargement: true })
            .webp({ quality: 82 })
            .toFile(webpPath);
        const after = fs.statSync(webpPath).size;
        fs.unlinkSync(localPath);
        console.log(`   🗜️  Optimised: ${(before / 1048576).toFixed(2)} MB → ${(after / 1048576).toFixed(2)} MB`);
        return relativePath.replace(/\.(png|jpe?g)$/i, '.webp');
    } catch (err) {
        console.warn(`   ⚠️ Could not optimise image: ${err.message}`);
        return relativePath;
    }
}

// ============================================
// MAIN FUNCTION
// ============================================

async function fetchArticles() {
    try {
        ensureImagesDir();
        console.log('\n🔄 Fetching articles from Notion...\n');

        // Query the database for published articles
        const response = await notion.databases.query({
            database_id: DATABASE_ID,
            filter: {
                property: 'Published',
                checkbox: { equals: true }
            },
            sorts: [
                { property: 'Date', direction: 'descending' }
            ]
        });

        console.log(`📚 Found ${response.results.length} published article(s)\n`);

        if (response.results.length === 0) {
            console.log('⚠️ No published articles found. Check your Notion database.');
        }

        // Process each article
        const articles = [];
        
        for (let i = 0; i < response.results.length; i++) {
            const page = response.results[i];
            console.log(`📝 Processing article ${i + 1}/${response.results.length}...`);
            
            try {
                const article = await processArticle(page);
                articles.push(article);
                console.log(`   ✓ "${article.title}" (${article.content_html.length} chars)`);
            } catch (err) {
                console.error(`   ✗ Error processing page ${page.id}:`, err.message);
            }
        }

        // Save to JSON
        const outputData = {
            last_updated: new Date().toISOString(),
            count: articles.length,
            articles: articles
        };

        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        const outputPath = path.join(dataDir, 'articles.json');
        fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), 'utf8');

        console.log(`\n✅ Saved ${articles.length} article(s) to ${outputPath}`);
        console.log(`📅 Last updated: ${outputData.last_updated}`);

    } catch (error) {
        console.error('\n❌ Fatal error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// ============================================
// ARTICLE PROCESSING
// ============================================

async function processArticle(page) {
    const props = page.properties;
    const articleId = page.id.replace(/-/g, '');

    // Get page content as Markdown
    const mdBlocks = await n2m.pageToMarkdown(page.id);
    const mdString = n2m.toMarkdownString(mdBlocks);

    // Convert Markdown to HTML
    let contentHtml = marked.parse(mdString.parent || mdString || '');

    // Notion image URLs are presigned and expire after an hour — download
    // them locally, exactly as fetch-projects.js does.
    contentHtml = await downloadAndReplaceImages(contentHtml, articleId);

    // Build article object
    return {
        id: articleId,
        title: getTitle(props.Title || props.Name),
        title_en: getRichText(props.Title_EN),
        description: getRichText(props.Description),
        date: getDate(props.Date),
        category: getSelect(props.Category),
        tags: getMultiSelect(props.Tags),
        // getCover() returns a presigned URL that dies after an hour. It must
        // be downloaded, not stored — every article cover on the live site was
        // returning HTTP 403 because this call was missing.
        cover: await downloadImage(getCover(page.cover), `${articleId}-cover`),
        icon: getIcon(page.icon),
        read_time: getNumber(props.ReadTime) || estimateReadTime(contentHtml),
        featured: getCheckbox(props.Featured),
        content_html: contentHtml,  // Full HTML content
        url: page.url,
        last_edited: page.last_edited_time
    };
}

// ============================================
// PROPERTY HELPERS
// ============================================

function getTitle(prop) {
    if (!prop || !prop.title) return 'Untitled';
    return prop.title.map(t => t.plain_text).join('') || 'Untitled';
}

function getRichText(prop) {
    if (!prop || !prop.rich_text) return '';
    return prop.rich_text.map(t => t.plain_text).join('');
}

function getDate(prop) {
    if (!prop || !prop.date) return null;
    return prop.date.start;
}

function getSelect(prop) {
    if (!prop || !prop.select) return null;
    return prop.select.name;
}

function getMultiSelect(prop) {
    if (!prop || !prop.multi_select) return [];
    return prop.multi_select.map(s => s.name);
}

function getNumber(prop) {
    if (!prop || prop.number === null || prop.number === undefined) return null;
    return prop.number;
}

function getCheckbox(prop) {
    if (!prop) return false;
    return prop.checkbox || false;
}

function getCover(cover) {
    if (!cover) return null;
    if (cover.type === 'external') return cover.external.url;
    if (cover.type === 'file') return cover.file.url;
    return null;
}

function getIcon(icon) {
    if (!icon) return null;
    if (icon.type === 'emoji') return icon.emoji;
    if (icon.type === 'external') return icon.external.url;
    if (icon.type === 'file') return icon.file?.url;
    return null;
}

function estimateReadTime(html) {
    // Strip HTML tags and count words
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const wordCount = text.split(' ').filter(w => w.length > 0).length;
    // Assume 200 words per minute for Arabic
    return Math.max(1, Math.ceil(wordCount / 200));
}

// ============================================
// RUN
// ============================================

fetchArticles();
