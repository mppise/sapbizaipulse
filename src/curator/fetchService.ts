import { scrapeArticleLinks, scrapeArticleDate } from '../scraper/browser';
import { contentEntryExistsBySourceRef, insertContentEntry, listContentEntries } from '../db';
import { loadTopicUrls } from './configLoader';

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

const log = (level: 'info' | 'warn' | 'error', message: string, extra?: Record<string, unknown>) =>
  console.log(JSON.stringify({ level, component: 'fetchService', message, ...extra }));

export type FetchEmitter = (event: string, data: Record<string, unknown>) => void;

// [F-C01-AUTOFETCH] Crawl topic landing pages, discover articles, ingest those within cutoff window.
// Body text is fetched and synthesized at approve time — only title + URL stored here.
export async function autoFetch(
  emit: FetchEmitter = () => {},
): Promise<{ added: number; skipped: number; errors: { sourceRef: string; message: string }[] }> {
  const urls = loadTopicUrls();
  const cutoff = await getCutoff();
  log('info', 'Starting auto-fetch', { topicPages: urls.length, cutoff: cutoff.toISOString() });

  let added = 0, skipped = 0;
  const errors: { sourceRef: string; message: string }[] = [];

  for (const landingUrl of urls) {
    log('info', 'Processing landing page', { url: landingUrl });
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

        if (publishedDate && publishedDate < cutoff) {
          log('info', 'Article older than cutoff — stopping crawl for this landing page', {
            url: article.url,
            publishedDate: publishedDate.toISOString(),
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

// Cutoff = max(2 weeks ago, most recent ingestion_date in DB)
async function getCutoff(): Promise<Date> {
  const twoWeeksAgo = new Date(Date.now() - TWO_WEEKS_MS);
  try {
    const entries = await listContentEntries();
    if (entries.length === 0) {
      log('info', 'No existing entries — using 2-week cutoff', { cutoff: twoWeeksAgo.toISOString() });
      return twoWeeksAgo;
    }
    const mostRecent = entries.reduce((latest, e) =>
      e.ingestionDate > latest ? e.ingestionDate : latest,
      entries[0].ingestionDate
    );
    const cutoff = mostRecent > twoWeeksAgo ? mostRecent : twoWeeksAgo;
    log('info', 'Cutoff calculated', { mostRecentIngestion: mostRecent.toISOString(), twoWeeksAgo: twoWeeksAgo.toISOString(), cutoff: cutoff.toISOString() });
    return cutoff;
  } catch {
    log('warn', 'Could not determine last ingestion date — falling back to 2-week cutoff');
    return twoWeeksAgo;
  }
}
