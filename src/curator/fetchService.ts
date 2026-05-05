import { scrapeArticleLinks, scrapeArticleDate } from '../scraper/browser';
import { contentEntryExistsBySourceRef, insertContentEntry, listContentEntries } from '../db';
import { loadTopicUrls } from './configLoader';

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

const log = (level: 'info' | 'warn' | 'error', message: string, extra?: Record<string, unknown>) =>
  console.log(JSON.stringify({ level, component: 'fetchService', message, ...extra }));

export type FetchEmitter = (event: string, data: Record<string, unknown>) => void;

// Per-domain cutoff: max(2 weeks ago, most recent ingestion_date for entries from that domain).
// A domain with no prior entries always gets the 2-week default, so newly added sources
// are back-filled rather than skipped entirely.
function computeCutoffForDomain(hostname: string, entries: { sourceRef: string; ingestionDate: Date }[]): Date {
  const twoWeeksAgo = new Date(Date.now() - TWO_WEEKS_MS);
  const domainEntries = entries.filter(e => {
    try { return new URL(e.sourceRef).hostname === hostname; } catch { return false; }
  });
  if (domainEntries.length === 0) {
    log('info', 'No existing entries for domain — using 2-week cutoff', { hostname, cutoff: twoWeeksAgo.toISOString() });
    return twoWeeksAgo;
  }
  const mostRecent = domainEntries.reduce((latest, e) =>
    e.ingestionDate > latest ? e.ingestionDate : latest,
    domainEntries[0].ingestionDate
  );
  const cutoff = mostRecent > twoWeeksAgo ? mostRecent : twoWeeksAgo;
  log('info', 'Cutoff calculated for domain', { hostname, mostRecentIngestion: mostRecent.toISOString(), cutoff: cutoff.toISOString() });
  return cutoff;
}

// [F-C01-AUTOFETCH] Crawl topic landing pages, discover articles, ingest those within cutoff window.
// Body text is fetched and synthesized at approve time — only title + URL stored here.
export async function autoFetch(
  emit: FetchEmitter = () => {},
): Promise<{ added: number; skipped: number; errors: { sourceRef: string; message: string }[] }> {
  const urls = loadTopicUrls();
  log('info', 'Starting auto-fetch', { topicPages: urls.length });

  // Load all existing entries once — used for per-domain cutoff computation
  let allEntries: { sourceRef: string; ingestionDate: Date }[] = [];
  try {
    allEntries = await listContentEntries();
  } catch {
    log('warn', 'Could not load existing entries — all domains will use 2-week cutoff');
  }

  let added = 0, skipped = 0;
  const errors: { sourceRef: string; message: string }[] = [];

  for (const landingUrl of urls) {
    const hostname = (() => { try { return new URL(landingUrl).hostname; } catch { return ''; } })();
    const cutoff = computeCutoffForDomain(hostname, allEntries);

    log('info', 'Processing landing page', { url: landingUrl, cutoff: cutoff.toISOString() });
    emit('landing_start', { url: landingUrl });
    let articleLinks: { title: string; url: string }[];
    try {
      articleLinks = await scrapeArticleLinks(landingUrl);
      log('info', 'Found article links on landing page', { url: landingUrl, count: articleLinks.length });
      emit('landing_done', { url: landingUrl, count: articleLinks.length });
    } catch (err) {
      const msg = `Failed to scrape landing page: ${(err as Error).message}`;
      log('error', msg, { url: landingUrl });
      errors.push({ sourceRef: landingUrl, message: msg });
      emit('article_error', { url: landingUrl, message: msg });
      continue;
    }

    for (const article of articleLinks) {
      try {
        const exists = await contentEntryExistsBySourceRef(article.url);
        if (exists) {
          log('info', 'Skipping duplicate article', { url: article.url });
          skipped++;
          emit('article_skipped', { url: article.url, title: article.title, reason: 'duplicate' });
          continue;
        }

        emit('article_processing', { url: article.url, title: article.title });
        const publishedDate = await scrapeArticleDate(article.url);

        if (!publishedDate || publishedDate < cutoff) {
          log('info', 'Article at or beyond cutoff (or no date) — stopping crawl for this landing page', {
            url: article.url,
            publishedDate: publishedDate?.toISOString() ?? 'unknown',
            cutoff: cutoff.toISOString(),
          });
          skipped++;
          emit('article_skipped', { url: article.url, title: article.title, reason: 'too_old' });
          break;
        }

        await insertContentEntry({
          title: article.title,
          sourceType: 'auto-fetch',
          sourceRef: article.url,
          sensitivity: 'Internal',
          publishedDate,
        });
        log('info', 'Article ingested', { url: article.url, title: article.title, publishedDate: publishedDate?.toISOString() ?? 'unknown' });
        added++;
        emit('article_ingested', { url: article.url, title: article.title });
      } catch (err) {
        log('error', 'Error processing article', { url: article.url, detail: (err as Error).message });
        errors.push({ sourceRef: article.url, message: (err as Error).message });
        emit('article_error', { url: article.url, title: article.title, message: (err as Error).message });
      }
    }
  }

  log('info', 'Auto-fetch complete', { added, skipped, errors: errors.length });
  emit('fetch_complete', { added, skipped, errors: errors.length });
  return { added, skipped, errors };
}
