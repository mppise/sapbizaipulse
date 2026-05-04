import { extractPageContent } from '../scraper/browser';

// [F-C01-INGEST-URL] Fetch a URL and return preview content
export async function fetchUrl(url: string): Promise<{ title: string; bodyText: string }> {
  return extractPageContent(url);
}
