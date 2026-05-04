// Quick diagnostic: inspect DOM structure of a SAP Community article page
// Run with: npx ts-node --skip-project scripts/inspect-page.ts <url>
import { chromium } from 'playwright';

async function inspect(url: string) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
  });
  const page = await context.newPage();
  console.log(`Loading: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(3000);

  const info = await page.evaluate(() => {
    const result: Record<string, string | null> = {};

    // @ts-ignore
    result['page.title'] = document.title;
    // @ts-ignore
    result['page.url'] = window.location.href;

    // Dump ALL h1/h2 on the page
    // @ts-ignore
    const headings = Array.from(document.querySelectorAll('h1, h2'));
    // @ts-ignore
    result['all-headings'] = headings.map((h: any) =>
      `<${h.tagName} class="${h.className}"> ${h.innerText?.trim().slice(0, 100)}`
    ).join(' || ') || 'none';

    // Dump ALL time elements
    // @ts-ignore
    const times = Array.from(document.querySelectorAll('time'));
    // @ts-ignore
    result['all-time-elements'] = times.map((t: any) =>
      `datetime="${t.getAttribute('datetime')}" class="${t.className}" text="${t.innerText?.trim().slice(0, 40)}"`
    ).join(' | ') || 'none found';

    // Common article title selectors
    const titleSelectors = [
      'h1', 'h1.lia-message-subject', '.lia-message-subject',
      '.page-title', '[data-testid="page-title"]',
      'article h1', '.blog-title', '.post-title',
    ];
    for (const sel of titleSelectors) {
      // @ts-ignore
      const el = document.querySelector(sel);
      // @ts-ignore
      if (el) result[`title:${sel}`] = (el as any).innerText?.trim().slice(0, 120) ?? null;
    }

    // Common date selectors
    const dateSelectors = [
      'time[datetime]', '.post-date', '.published-date',
      '.lia-component-post-date-last-edited', '.DateTime',
      '[data-published]', 'meta[property="article:published_time"]',
      '.publish-date', 'span.local-date', '.lia-quilt-column-message-date',
    ];
    for (const sel of dateSelectors) {
      // @ts-ignore
      const el = document.querySelector(sel);
      if (el) {
        // @ts-ignore
        const val = (el as any).getAttribute?.('datetime')
          // @ts-ignore
          ?? (el as any).getAttribute?.('content')
          // @ts-ignore
          ?? (el as any).getAttribute?.('data-published')
          // @ts-ignore
          ?? (el as any).innerText?.trim().slice(0, 80);
        result[`date:${sel}`] = val ?? null;
      }
    }

    return result;
  });

  console.log('\n=== DOM Inspection Results ===');
  for (const [key, val] of Object.entries(info)) {
    if (val) console.log(`  ${key}: ${val}`);
  }

  await browser.close();
}

const url = process.argv[2];
if (!url) { console.error('Usage: npx ts-node --skip-project scripts/inspect-page.ts <url>'); process.exit(1); }
inspect(url).catch(console.error);
