/**
 * سكربت جلب المقالات من Notion
 * يعمل عبر GitHub Actions يومياً
 */

const fs = require('fs');
const path = require('path');

// Import Notion Client
let Client;
try {
    const notionModule = require('@notionhq/client');
    Client = notionModule.Client;
    console.log('✅ Notion client loaded successfully');
} catch (err) {
    console.error('❌ Failed to load @notionhq/client:', err.message);
    process.exit(1);
}

// Validate environment variables early
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

// Initialize Notion Client
const notion = new Client({
    auth: NOTION_API_KEY
});

console.log('✅ Notion client initialized');

/**
 * الدالة الرئيسية لجلب المقالات
 */
async function fetchArticles() {
    try {
        console.log('🔄 جاري جلب المقالات من Notion...');
        console.log('📋 Database ID:', DATABASE_ID.substring(0, 8) + '...');

        // جلب المقالات المنشورة فقط
        const response = await notion.databases.query({
            database_id: DATABASE_ID,
            filter: {
                property: 'Published',
                checkbox: {
                    equals: true
                }
            },
            sorts: [
                {
                    property: 'Date',
                    direction: 'descending'
                }
            ]
        });

        console.log(`📚 تم العثور على ${response.results.length} مقال`);

        // معالجة كل مقال
        const articles = await Promise.all(
            response.results.map(async (page, index) => {
                console.log(`   📝 معالجة المقال ${index + 1}...`);
                const content = await getPageContent(page.id);
                
                return {
                    id: page.id.replace(/-/g, ''),
                    title: getTitle(page.properties.Title || page.properties.Name),
                    title_en: getRichText(page.properties.Title_EN),
                    description: getRichText(page.properties.Description),
                    date: getDate(page.properties.Date),
                    category: getSelect(page.properties.Category),
                    tags: getMultiSelect(page.properties.Tags),
                    cover: getCover(page.cover),
                    icon: getIcon(page.icon),
                    read_time: getNumber(page.properties.ReadTime) || estimateReadTime(content),
                    featured: getCheckbox(page.properties.Featured),
                    content: content,
                    url: page.url,
                    last_edited: page.last_edited_time
                };
            })
        );

        // حفظ في ملف JSON
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        const outputPath = path.join(dataDir, 'articles.json');
        const outputData = {
            last_updated: new Date().toISOString(),
            count: articles.length,
            articles: articles
        };

        fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), 'utf8');

        console.log(`✅ تم حفظ ${articles.length} مقال في ${outputPath}`);
        console.log(`📅 آخر تحديث: ${outputData.last_updated}`);
        
    } catch (error) {
        console.error('❌ خطأ في جلب المقالات:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

/**
 * جلب محتوى الصفحة (blocks)
 */
async function getPageContent(pageId) {
    try {
        const blocks = [];
        let cursor = undefined;

        // جلب كل الـ blocks (مع التعامل مع الصفحات)
        do {
            const response = await notion.blocks.children.list({
                block_id: pageId,
                start_cursor: cursor,
                page_size: 100
            });

            blocks.push(...response.results);
            cursor = response.has_more ? response.next_cursor : undefined;
        } while (cursor);

        return blocks.map(block => parseBlock(block)).filter(Boolean);
    } catch (error) {
        console.error(`   ⚠️ خطأ في جلب محتوى الصفحة ${pageId}:`, error.message);
        return [];
    }
}

/**
 * تحويل block إلى كائن منظم
 */
function parseBlock(block) {
    const type = block.type;
    
    switch (type) {
        case 'paragraph':
            const text = getRichTextContent(block.paragraph.rich_text);
            return text ? { type: 'paragraph', content: text } : null;
            
        case 'heading_1':
            return { 
                type: 'heading_1', 
                content: getRichTextContent(block.heading_1.rich_text) 
            };
            
        case 'heading_2':
            return { 
                type: 'heading_2', 
                content: getRichTextContent(block.heading_2.rich_text) 
            };
            
        case 'heading_3':
            return { 
                type: 'heading_3', 
                content: getRichTextContent(block.heading_3.rich_text) 
            };
            
        case 'bulleted_list_item':
            return { 
                type: 'bullet', 
                content: getRichTextContent(block.bulleted_list_item.rich_text) 
            };
            
        case 'numbered_list_item':
            return { 
                type: 'number', 
                content: getRichTextContent(block.numbered_list_item.rich_text) 
            };
            
        case 'code':
            return { 
                type: 'code', 
                content: getRichTextContent(block.code.rich_text),
                language: block.code.language || 'plaintext'
            };
            
        case 'quote':
            return { 
                type: 'quote', 
                content: getRichTextContent(block.quote.rich_text) 
            };
            
        case 'callout':
            return { 
                type: 'callout', 
                content: getRichTextContent(block.callout.rich_text),
                icon: block.callout.icon?.emoji || '💡'
            };
            
        case 'image':
            const imageUrl = block.image.type === 'external' 
                ? block.image.external.url 
                : block.image.file.url;
            return { 
                type: 'image', 
                url: imageUrl,
                caption: getRichTextContent(block.image.caption)
            };
            
        case 'divider':
            return { type: 'divider' };
            
        case 'toggle':
            return {
                type: 'toggle',
                title: getRichTextContent(block.toggle.rich_text)
            };
            
        case 'table':
            return { type: 'table', id: block.id };
            
        default:
            return null;
    }
}

// ==================== Helper Functions ====================

function getTitle(property) {
    if (!property || !property.title) return '';
    return property.title.map(t => t.plain_text).join('');
}

function getRichText(property) {
    if (!property || !property.rich_text) return '';
    return property.rich_text.map(t => t.plain_text).join('');
}

function getRichTextContent(richText) {
    if (!richText || !richText.length) return '';
    return richText.map(t => {
        let text = t.plain_text;
        
        // تطبيق التنسيقات
        if (t.annotations.bold) text = `<strong>${text}</strong>`;
        if (t.annotations.italic) text = `<em>${text}</em>`;
        if (t.annotations.code) text = `<code>${text}</code>`;
        if (t.annotations.strikethrough) text = `<del>${text}</del>`;
        if (t.annotations.underline) text = `<u>${text}</u>`;
        if (t.href) text = `<a href="${t.href}" target="_blank" rel="noopener">${text}</a>`;
        
        return text;
    }).join('');
}

function getDate(property) {
    if (!property || !property.date) return null;
    return property.date.start;
}

function getSelect(property) {
    if (!property || !property.select) return null;
    return property.select.name;
}

function getMultiSelect(property) {
    if (!property || !property.multi_select) return [];
    return property.multi_select.map(s => s.name);
}

function getNumber(property) {
    if (!property || property.number === null || property.number === undefined) return null;
    return property.number;
}

function getCheckbox(property) {
    if (!property) return false;
    return property.checkbox || false;
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

function estimateReadTime(content) {
    const text = content
        .filter(b => b.type === 'paragraph' || b.type === 'bullet' || b.type === 'number')
        .map(b => b.content)
        .join(' ');
    
    // إزالة HTML tags
    const plainText = text.replace(/<[^>]*>/g, '');
    const words = plainText.split(/\s+/).filter(w => w.length > 0).length;
    
    // 200 كلمة في الدقيقة للقراءة بالعربية
    return Math.max(1, Math.ceil(words / 200));
}

// تشغيل السكربت
fetchArticles();
