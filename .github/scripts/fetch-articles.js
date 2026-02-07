/**
 * Notion to Website - Article Fetcher
 * Converts Notion pages to HTML and saves to articles.json
 * 
 * Dependencies: @notionhq/client, notion-to-md, marked
 */

const fs = require('fs');
const path = require('path');

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
// MAIN FUNCTION
// ============================================

async function fetchArticles() {
    try {
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
    
    // Get page content as Markdown
    const mdBlocks = await n2m.pageToMarkdown(page.id);
    const mdString = n2m.toMarkdownString(mdBlocks);
    
    // Convert Markdown to HTML
    const contentHtml = marked.parse(mdString.parent || mdString || '');
    
    // Build article object
    return {
        id: page.id.replace(/-/g, ''),
        title: getTitle(props.Title || props.Name),
        title_en: getRichText(props.Title_EN),
        description: getRichText(props.Description),
        date: getDate(props.Date),
        category: getSelect(props.Category),
        tags: getMultiSelect(props.Tags),
        cover: getCover(page.cover),
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
