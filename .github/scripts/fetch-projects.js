/**
 * Notion to Website - Projects Fetcher
 * Queries a Notion database for published projects,
 * downloads cover & content images locally (Notion URLs expire after 1h),
 * converts page content to HTML, and saves to data/projects.json.
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

    // Configure marked for rich formatting
    marked.setOptions({
        gfm: true,        // GitHub Flavored Markdown (tables, strikethrough, etc.)
        breaks: true,      // Convert \n to <br>
    });

    console.log('✅ marked loaded');
} catch (err) {
    console.error('❌ Failed to load marked:', err.message);
    process.exit(1);
}

// ============================================
// ENVIRONMENT VALIDATION
// ============================================

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const DATABASE_ID = process.env.NOTION_PROJECTS_DATABASE_ID;

if (!NOTION_API_KEY) {
    console.error('❌ NOTION_API_KEY is not set');
    process.exit(1);
}

if (!DATABASE_ID) {
    console.error('❌ NOTION_PROJECTS_DATABASE_ID is not set');
    process.exit(1);
}

// ============================================
// NOTION CLIENT SETUP
// ============================================

const notion = new Client({ auth: NOTION_API_KEY });
const n2m = new NotionToMarkdown({ notionClient: notion });

console.log('✅ Notion client initialized');
console.log('📋 Projects Database ID:', DATABASE_ID.substring(0, 8) + '...');

// ============================================
// IMAGE DOWNLOAD HELPERS
// ============================================

const IMAGES_DIR = path.join(process.cwd(), 'assets', 'images', 'projects');

/** Ensure the images directory exists */
function ensureImagesDir() {
    if (!fs.existsSync(IMAGES_DIR)) {
        fs.mkdirSync(IMAGES_DIR, { recursive: true });
        console.log('📁 Created images directory:', IMAGES_DIR);
    }
}

/**
 * Download a remote image and save it locally.
 * Returns the local relative path (e.g. "assets/images/projects/abc123-cover.jpg")
 * or the original URL if the download fails.
 */
function downloadImage(imageUrl, filename) {
    return new Promise((resolve) => {
        if (!imageUrl) {
            resolve(null);
            return;
        }

        try {
            const parsedUrl = new URL(imageUrl);

            // Determine file extension from URL or default to .jpg
            let ext = path.extname(parsedUrl.pathname).split('?')[0] || '.jpg';
            // Sanitize extension
            ext = ext.match(/\.(jpg|jpeg|png|gif|webp|svg|avif)/i)?.[0] || '.jpg';

            const localFilename = `${filename}${ext}`;
            const localPath = path.join(IMAGES_DIR, localFilename);
            const relativePath = `assets/images/projects/${localFilename}`;

            const protocol = parsedUrl.protocol === 'https:' ? https : http;

            const request = protocol.get(imageUrl, { timeout: 30000 }, (response) => {
                // Follow redirects
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    downloadImage(response.headers.location, filename).then(resolve);
                    return;
                }

                if (response.statusCode !== 200) {
                    console.warn(`   ⚠️ Failed to download image (HTTP ${response.statusCode}): ${imageUrl.substring(0, 80)}...`);
                    resolve(imageUrl); // Fallback to original URL
                    return;
                }

                const fileStream = fs.createWriteStream(localPath);
                response.pipe(fileStream);

                fileStream.on('finish', () => {
                    fileStream.close();
                    const sizeKB = (fs.statSync(localPath).size / 1024).toFixed(1);
                    console.log(`   📥 Downloaded image: ${localFilename} (${sizeKB} KB)`);
                    resolve(relativePath);
                });

                fileStream.on('error', (err) => {
                    fs.unlink(localPath, () => {}); // Cleanup partial file
                    console.warn(`   ⚠️ Error writing image file: ${err.message}`);
                    resolve(imageUrl);
                });
            });

            request.on('error', (err) => {
                console.warn(`   ⚠️ Error downloading image: ${err.message}`);
                resolve(imageUrl);
            });

            request.on('timeout', () => {
                request.destroy();
                console.warn(`   ⚠️ Timeout downloading image`);
                resolve(imageUrl);
            });

        } catch (err) {
            console.warn(`   ⚠️ Invalid image URL: ${err.message}`);
            resolve(imageUrl);
        }
    });
}

/**
 * Replace all Notion image URLs in HTML content with locally downloaded versions.
 * Targets both Notion's S3 URLs and Unsplash/external URLs.
 */
async function downloadAndReplaceImages(html, projectId) {
    // Match all <img src="..."> in the HTML
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

        const filename = `${projectId}-content-${imgIndex}`;
        const localPath = await downloadImage(originalUrl, filename);

        if (localPath !== originalUrl) {
            updatedHtml = updatedHtml.replace(originalUrl, localPath);
        }

        imgIndex++;
    }

    return updatedHtml;
}

// ============================================
// MAIN FUNCTION
// ============================================

async function fetchProjects() {
    try {
        ensureImagesDir();
        console.log('\n🔄 Fetching projects from Notion...\n');

        // Query the database for published projects
        const response = await notion.databases.query({
            database_id: DATABASE_ID,
            filter: {
                property: 'Publish',
                checkbox: { equals: true }
            },
            sorts: [
                { property: 'Date', direction: 'descending' }
            ]
        });

        console.log(`📚 Found ${response.results.length} published project(s)\n`);

        if (response.results.length === 0) {
            console.log('⚠️ No published projects found. Check your Notion database.');
        }

        // Process each project
        const projects = [];

        for (let i = 0; i < response.results.length; i++) {
            const page = response.results[i];
            console.log(`🔧 Processing project ${i + 1}/${response.results.length}...`);

            try {
                const project = await processProject(page);
                projects.push(project);
                console.log(`   ✓ "${project.title}" (${project.content_html.length} chars)\n`);
            } catch (err) {
                console.error(`   ✗ Error processing page ${page.id}:`, err.message);
            }
        }

        // Save to JSON
        const outputData = {
            last_updated: new Date().toISOString(),
            count: projects.length,
            projects: projects
        };

        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        const outputPath = path.join(dataDir, 'projects.json');
        fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), 'utf8');

        console.log(`\n✅ Saved ${projects.length} project(s) to ${outputPath}`);
        console.log(`📅 Last updated: ${outputData.last_updated}`);

    } catch (error) {
        console.error('\n❌ Fatal error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// ============================================
// PROJECT PROCESSING
// ============================================

async function processProject(page) {
    const props = page.properties;
    const projectId = page.id.replace(/-/g, '');

    // --- Cover Image ---
    let coverUrl = getCoverFromPage(page) || getCoverFromFiles(props['Cover Image']);
    let localCover = null;

    if (coverUrl) {
        console.log(`   🖼️  Downloading cover image...`);
        localCover = await downloadImage(coverUrl, `${projectId}-cover`);
    }

    // --- Page Content → Markdown → HTML ---
    const mdBlocks = await n2m.pageToMarkdown(page.id);
    const mdString = n2m.toMarkdownString(mdBlocks);
    let contentHtml = marked.parse(mdString.parent || mdString || '');

    // --- Download & replace content images ---
    contentHtml = await downloadAndReplaceImages(contentHtml, projectId);

    // --- Build final project object ---
    return {
        id: projectId,
        title: getTitle(props.Name || props.Title),
        summary: getRichText(props.Summary || props.Description),
        date: getDate(props.Date),
        categories: getMultiSelect(props.Categories),
        cover: localCover,
        preview_link: getUrl(props['Preview Link']),
        content_html: contentHtml,
        read_time: estimateReadTime(contentHtml),
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

function getMultiSelect(prop) {
    if (!prop || !prop.multi_select) return [];
    return prop.multi_select.map(s => s.name);
}

function getUrl(prop) {
    if (!prop || !prop.url) return null;
    return prop.url;
}

function getCheckbox(prop) {
    if (!prop) return false;
    return prop.checkbox || false;
}

/**
 * Get cover from the page-level cover (set via Notion's cover feature).
 */
function getCoverFromPage(page) {
    const cover = page.cover;
    if (!cover) return null;
    if (cover.type === 'external') return cover.external.url;
    if (cover.type === 'file') return cover.file.url;
    return null;
}

/**
 * Get cover from a "Files & media" property (e.g. "Cover Image").
 * Notion stores uploaded files in an array.
 */
function getCoverFromFiles(prop) {
    if (!prop || !prop.files || prop.files.length === 0) return null;
    const file = prop.files[0];
    if (file.type === 'file') return file.file.url;
    if (file.type === 'external') return file.external.url;
    return null;
}

function estimateReadTime(html) {
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const wordCount = text.split(' ').filter(w => w.length > 0).length;
    // ~200 words per minute for Arabic
    return Math.max(1, Math.ceil(wordCount / 200));
}

// ============================================
// RUN
// ============================================

fetchProjects();
