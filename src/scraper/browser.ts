import { chromium, Browser } from 'playwright';

const log = (level: 'info' | 'warn' | 'error', message: string, extra?: Record<string, unknown>) =>
  console.log(JSON.stringify({ level, component: 'scraper', message, ...extra }));

const BROWSER_CONTEXT_OPTIONS = {
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
};

let browser: Browser | null = null;

// Shared lazy-init Playwright browser instance — used by C01 and C02
export async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    log('info', 'Launching Chromium browser');
    browser = await chromium.launch({ headless: true });
    log('info', 'Chromium browser ready');
  }
  return browser;
}

async function newPage() {
  const b = await getBrowser();
  const context = await b.newContext(BROWSER_CONTEXT_OPTIONS);
  return context.newPage();
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    log('info', 'Closing Chromium browser');
    await browser.close();
    browser = null;
  }
}

// Extract title + body text from a page URL
export async function extractPageContent(url: string): Promise<{ title: string; bodyText: string }> {
  log('info', 'Extracting page content', { url });
  const page = await newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // Wait for SAP Community article body to render — try known selectors with a timeout
    try {
      await page.waitForSelector(
        '.lia-message-body-content, .lia-quilt-column-main-content, article, main',
        { timeout: 10_000 }
      );
    } catch { /* selector not found — proceed with whatever is rendered */ }

    const title = ((await page.title()).trim() || new URL(url).hostname)
      .replace(/\s*[-|]\s*SAP Community\s*$/i, '')
      .trim();

    const bodyText = await page.evaluate(() => {
      // SAP Community-specific selectors first, then generic fallbacks
      const selectors = [
        '.lia-message-body-content',
        '.lia-quilt-column-main-content',
        'article',
        'main',
        '[role="main"]',
        '.content',
        'body',
      ];
      for (const sel of selectors) {
        // @ts-ignore — runs inside browser context; document is available
        const el = document.querySelector(sel);
        // @ts-ignore
        if (el && (el as any).innerText?.trim().length > 200) return (el as any).innerText as string;
      }
      // @ts-ignore
      return (document.body as any).innerText as string;
    }) as string;

    const cleaned = bodyText.trim().replace(/\n{3,}/g, '\n\n');

    if (cleaned.length < 100) {
      throw new Error(`Extracted text too short (${cleaned.length} chars) — page may not have loaded correctly`);
    }
    log('info', 'Page content extracted', { url, title, chars: cleaned.length });
    return { title, bodyText: cleaned };
  } finally {
    await page.close();
  }
}

// Scrape article links from a topic landing page.
// Returns links whose href contains SAP Community article path patterns.
export async function scrapeArticleLinks(url: string): Promise<{ title: string; url: string }[]> {
  log('info', 'Scraping article links from landing page', { url });
  const page = await newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(3000);

    const base = new URL(url).origin;
    const links = await page.evaluate((baseUrl: string) => {
      // @ts-ignore
      const anchors = Array.from(document.querySelectorAll('a[href]')) as any[];
      const seen = new Set<string>();
      const results: { title: string; url: string }[] = [];
      for (const a of anchors) {
        const href: string = a.getAttribute('href') ?? '';
        const full = href.startsWith('http') ? href : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
        // Only keep actual article/post URLs — /ba-p/ (blog posts) and /td-p/ (discussions)
        // Exclude category pages (/ct-p/), board indexes (/bg-p/, /f/), and user profiles
        if (!full.includes('/ba-p/') && !full.includes('/td-p/')) continue;
        const clean = full.split('?')[0].split('#')[0];
        if (seen.has(clean)) continue;
        seen.add(clean);
        // Prefer the title from .lia-message-subject inside the link, fall back to innerText
        const subjectEl = a.querySelector('.lia-message-subject, h2, h3');
        const text = (subjectEl ?? a).innerText?.trim().replace(/\s+/g, ' ') ?? '';
        if (text.length < 5) continue;
        results.push({ title: text, url: clean });
      }
      return results;
    }, base) as { title: string; url: string }[];

    log('info', 'Article links scraped', { url, count: links.length });
    return links;
  } finally {
    await page.close();
  }
}

// Extract the published date from an article page.
// Returns null if no date element is found — caller should fail open.
export async function scrapeArticleDate(url: string): Promise<Date | null> {
  log('info', 'Scraping article date', { url });
  const page = await newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(3000);

    const dateStr = await page.evaluate(() => {
      // SAP Community uses a meta tag for the canonical published date
      // @ts-ignore
      const meta = document.querySelector('meta[property="article:published_time"]');
      // @ts-ignore
      if (meta) return meta.getAttribute('content');
      // Fallback: visible date text
      const selectors = ['.DateTime', '.post-date', '.published-date', '.article-date', '[data-published]'];
      for (const sel of selectors) {
        // @ts-ignore
        const el = document.querySelector(sel);
        if (!el) continue;
        // @ts-ignore
        const val = (el as any).getAttribute?.('data-published') ?? (el as any).innerText?.trim();
        if (val) return val;
      }
      return null;
    }) as string | null;

    if (!dateStr) {
      log('warn', 'No published date found on article page', { url });
      return null;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      log('warn', 'Unparseable date string on article page', { url, dateStr });
      return null;
    }
    log('info', 'Article date scraped', { url, date: d.toISOString() });
    return d;
  } finally {
    await page.close();
  }
}
