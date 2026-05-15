import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
  html: true,
  xhtmlOut: false,
  breaks: false,
  linkify: true,
  typographer: false,
});

interface SectionMeta { icon: string; label: string; color: string; tabKey: string; }

const SECTION_META: Record<string, SectionMeta> = {
  'the big picture': { icon: 'bi-binoculars', label: 'The Big Picture', color: '#0070f3', tabKey: 'big-picture' },
  'strategy in motion': { icon: 'bi-graph-up-arrow', label: 'Strategy in Motion', color: '#1a7f4b', tabKey: 'strategy' },
  'under the hood': { icon: 'bi-gear', label: 'Under the Hood', color: '#6b3fa0', tabKey: 'tech' },
};
const TAB_ORDER = ['the big picture', 'strategy in motion', 'under the hood'];

// Split HTML on <h3> boundaries → { preamble, sections: [{heading, content}] }
function splitOnH3(html: string): { preamble: string; sections: { heading: string; content: string }[] } {
  const sections: { heading: string; content: string }[] = [];
  const re = /<h3>([^<]*)<\/h3>/g;
  let lastIndex = 0;
  let preamble = html;
  let first = true;
  let match: RegExpExecArray | null;

  while ((match = re.exec(html)) !== null) {
    if (first) {
      preamble = html.slice(0, match.index);
      first = false;
    } else {
      sections[sections.length - 1].content = html.slice(lastIndex, match.index);
    }
    sections.push({ heading: match[1].trim(), content: '' });
    lastIndex = match.index + match[0].length;
  }
  if (sections.length > 0) {
    sections[sections.length - 1].content = html.slice(lastIndex);
  }
  return { preamble, sections };
}

function extractFirstBlockquoteText(html: string): string {
  const m = html.match(/<blockquote>\s*<p>([\s\S]*?)<\/p>\s*<\/blockquote>/);
  return m ? m[1].trim() : '';
}

function buildTopicCard(id: string, title: string, innerHtml: string): string {
  const { preamble, sections } = splitOnH3(innerHtml);
  const teaserText = extractFirstBlockquoteText(preamble);

  const tabSections = TAB_ORDER.map((key, i) => {
    const meta = SECTION_META[key];
    const found = sections.find((s) => s.heading.toLowerCase() === key);
    let content = found ? found.content : '<p class="text-muted small">No content.</p>';
    // The Big Picture tab: strip the leading blockquote — it is already shown as the topic teaser
    if (key === 'the big picture') {
      content = content.replace(/<blockquote>[\s\S]*?<\/blockquote>\s*/, '');
    }
    const inputId = `tab-${id}-${meta.tabKey}`;
    const checked = i === 0 ? ' checked' : '';
    return { meta, content, inputId, checked };
  });

  const radioInputs = tabSections
    .map(({ inputId, checked }) => `<input type="radio" class="tab-radio" name="tabs-${id}" id="${inputId}"${checked} />`)
    .join('\n');

  const tabLabels = tabSections
    .map(({ meta, inputId }) =>
      `<label class="tab-label" for="${inputId}" style="--tab-color:${meta.color}">` +
      `<i class="bi ${meta.icon} tab-icon"></i>${meta.label}</label>`)
    .join('\n');

  const tabPanels = tabSections
    .map(({ content }) => `<div class="tab-panel">${content}</div>`)
    .join('\n');

  const teaserHtml = teaserText
    ? `<div class="topic-teaser"><p>${teaserText}</p></div>`
    : '';
  const footerHtml = `<span class="topic-footer"><span class="footer-cta"><i class="bi bi-arrows-expand"></i> Click to expand</span></span>`;

  return `
<details class="topic-block" id="${id}">
  <summary class="topic-summary">
    <span class="topic-chevron">▸</span>
    <span class="topic-title-text">${title}</span>
    ${teaserHtml}
    ${footerHtml}
  </summary>
  <div class="topic-body">
    ${radioInputs}
    <div class="tab-bar">${tabLabels}</div>
    <div class="tab-content">${tabPanels}</div>
  </div>
  <div class="topic-collapse-bar">
    <span class="footer-cta"><i class="bi bi-arrows-collapse"></i> Click to collapse</span>
  </div>
</details>`;
}

function buildAdditionalReading(innerHtml: string): string {
  // Extract just the links for the sidebar — strip the <ul> wrapper, keep <li> items
  return innerHtml;
}

function postProcess(html: string): { topics: string; sidebar: string } {
  // Resolve ## Heading {#slug} → <h2 id="slug">
  html = html.replace(
    /<h([1-6])>([^<]+?)\s*\{#([\w-]+)\}<\/h\1>/g,
    (_m, level, text, id) => `<h${level} id="${id}">${text.trim()}</h${level}>`,
  );

  // Split on <h2 id="..."> and render each block
  const topicRe = /<h2 id="([^"]+)">([^<]+)<\/h2>([\s\S]*?)(?=<h2 id="|$)/g;
  let topics = '';
  let sidebar = '';
  let match: RegExpExecArray | null;

  while ((match = topicRe.exec(html)) !== null) {
    const [, id, title, inner] = match;
    if (id === 'additional-reading') {
      sidebar = buildAdditionalReading(inner);
    } else {
      topics += buildTopicCard(id, title.trim(), inner);
    }
  }

  return { topics, sidebar };
}

export function renderMarkdown(markdownContent: string): string {
  try {
    const { topics, sidebar } = postProcess(md.render(markdownContent));
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const topicCount = (markdownContent.match(/^## .+ \{#(?!additional-reading)/mg) ?? []).length;
    const topicLabel = topicCount > 0 ? `${topicCount} topic${topicCount !== 1 ? 's' : ''}` : '';

    const sidebarHtml = sidebar ? `
<aside class="nl-sidebar">
  <div class="nl-sidebar-inner">
    <div class="sidebar-heading"><i class="bi bi-journal-bookmark"></i> Additional Reading</div>
    ${sidebar}
  </div>
</aside>` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SAP Business AI Pulse</title>
<link rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
  integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH"
  crossorigin="anonymous" />
<link rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" />
<style>
  :root {
    --sap-blue:   #0070f3;
    --sap-green:  #1a7f4b;
    --sap-purple: #6b3fa0;
    --sap-gold:   #e8a000;
    --sap-bg:     #f5f6f8;
    --sap-header: #000639;
    --sap-text:   #1d2d3e;
    --card-radius: 10px;
  }
  * { box-sizing: border-box; }
  body { font-family: "72","72full",Arial,Helvetica,sans-serif; background: var(--sap-bg); color: var(--sap-text); margin: 0; }

  /* ── Header ── */
  .nl-header {
    background: var(--sap-header); color: #fff;
    padding: .65rem 2rem;
    position: sticky; top: 0; z-index: 100;
    box-shadow: 0 1px 6px rgba(0,0,0,.35);
  }
  .nl-header-inner {
    max-width: 1200px; margin: 0 auto;
    display: flex; align-items: baseline; gap: 1rem; flex-wrap: wrap;
  }
  .nl-header h1 { font-size: 1.05rem; font-weight: 700; margin: 0; color: #fff; white-space: nowrap; }
  .nl-header .meta { font-size: .75rem; color: #a8b4c4; white-space: nowrap; }
  .nl-disclaimer {
    width: 100%;
    font-size: .62rem;
    color: #4e5e70;
    font-style: italic;
    margin-top: .1rem;
  }
  .pulse-icon {
    font-size: .95rem;
    color: var(--sap-gold);
    margin-right: .4rem;
    animation: pulse 1.8s infinite;
  }
  @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.3)} }

  /* ── Two-pane layout ── */
  .nl-layout {
    max-width: 1200px;
    margin: 2rem auto;
    padding: 0 1.5rem;
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 1.5rem;
    align-items: start;
  }

  /* ── Main topic pane ── */
  .nl-main { min-width: 0; }

  /* ── Sidebar ── */
  .nl-sidebar { min-width: 0; }
  .nl-sidebar-inner {
    background: #fff;
    border-radius: var(--card-radius);
    box-shadow: 0 1px 4px rgba(0,0,0,.07);
    padding: 1rem 1.2rem 1.2rem;
    position: sticky;
    top: 4rem;
  }
  .sidebar-heading {
    font-size: .72rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 1px; color: #888;
    display: flex; align-items: center; gap: .4rem;
    margin-bottom: .75rem;
    padding-bottom: .5rem;
    border-bottom: 1px solid #e8eaed;
  }
  .sidebar-heading i { font-size: .9rem; }
  .nl-sidebar-inner ul { margin: 0; padding: 0; list-style: none; }
  .nl-sidebar-inner li { margin-bottom: .55rem; padding-bottom: .55rem; border-bottom: 1px solid #f0f2f5; }
  .nl-sidebar-inner li:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
  .nl-sidebar-inner a { color: var(--sap-blue); font-size: .8rem; line-height: 1.4; text-decoration: none; display: block; }
  .nl-sidebar-inner a:hover { text-decoration: underline; }

  /* ── Responsive: stack on narrow screens ── */
  @media (max-width: 768px) {
    .nl-layout {
      grid-template-columns: 1fr;
      padding: 0 1rem;
    }
    .nl-sidebar { order: 2; }
    .nl-sidebar-inner { position: static; }
    .nl-main { order: 1; }
  }

  /* ── Topic card ── */
  details.topic-block {
    background: #fff; border-radius: var(--card-radius);
    margin-bottom: 1rem;
    box-shadow: 0 1px 4px rgba(0,0,0,.07);
    border-left: 4px solid var(--sap-blue);
    overflow: hidden;
  }

  summary.topic-summary {
    display: grid;
    grid-template-columns: 1.3rem 1fr;
    grid-template-rows: auto auto auto;
    column-gap: .6rem;
    padding: .9rem 1.4rem .9rem 1rem;
    cursor: pointer; list-style: none; user-select: none;
  }
  summary.topic-summary::-webkit-details-marker { display: none; }

  .topic-chevron {
    grid-column: 1; grid-row: 1 / 4;
    align-self: center;
    font-size: .81rem; color: #bbb;
    transition: transform .2s;
  }
  details.topic-block[open] .topic-chevron { transform: rotate(90deg); }

  .topic-title-text {
    grid-column: 2; grid-row: 1;
    font-size: 1.125rem; font-weight: 700; color: var(--sap-text); line-height: 1.6;
  }
  .topic-teaser {
    grid-column: 2; grid-row: 2;
    margin-top: .25rem;
    font-size: .911rem; color: #4e5e70; line-height: 1.5;
  }
  .topic-teaser p { margin: 0; }

  /* ── Card footer (collapsed hint) ── */
  .topic-footer {
    grid-column: 1 / -1; grid-row: 3;
    margin: .5rem -1rem -.9rem -1rem;
    padding: .4rem 1.4rem .4rem 1rem;
    font-size: .75rem; color: #6b7a8d;
    display: flex; align-items: center; justify-content: flex-end; gap: .4rem;
  }
  .topic-footer .footer-cta {
    display: flex; align-items: center; gap: .25rem;
    color: var(--sap-blue); font-weight: 600;
  }
  .topic-footer .footer-cta i { font-size: .9rem; }
  details.topic-block[open] .topic-footer { display: none; }

  /* ── Card collapse bar (visible when open) ── */
  .topic-collapse-bar {
    display: none;
    padding: .4rem 1.4rem;
    border-top: 1px solid #e8eaed;
    font-size: .75rem;
    justify-content: flex-end;
    cursor: pointer;
  }
  .topic-collapse-bar .footer-cta {
    display: flex; align-items: center; gap: .25rem;
    color: #888; font-weight: 600;
  }
  .topic-collapse-bar .footer-cta i { font-size: .9rem; }
  .topic-collapse-bar:hover .footer-cta { color: var(--sap-blue); }
  details.topic-block[open] .topic-collapse-bar { display: flex; }

  /* ── Topic body + tabs ── */
  .topic-body { padding: 0 1.4rem 1.8rem; }

  .tab-radio { display: none; }

  .tab-bar {
    display: flex;
    border-bottom: 2px solid #e8eaed;
    margin: 0 -1.4rem 1rem;
    padding: 0 1.4rem;
  }
  .tab-label {
    padding: .55rem 1rem;
    font-size: .866rem; font-weight: 600; color: #999;
    cursor: pointer;
    border-bottom: 3px solid transparent; margin-bottom: -2px;
    transition: color .15s, border-color .15s;
    white-space: nowrap; display: flex; align-items: center; gap: .3rem;
  }
  .tab-label:hover { color: var(--tab-color, var(--sap-blue)); }
  .tab-icon { font-size: 1.125rem; line-height: 1; }

  .tab-panel { display: none; }

  /* Active tab panel and label — positional (radio 1/2/3 → panel/label 1/2/3) */
  .tab-radio:nth-of-type(1):checked ~ .tab-content .tab-panel:nth-of-type(1),
  .tab-radio:nth-of-type(2):checked ~ .tab-content .tab-panel:nth-of-type(2),
  .tab-radio:nth-of-type(3):checked ~ .tab-content .tab-panel:nth-of-type(3) { display: block; }

  .tab-radio:nth-of-type(1):checked ~ .tab-bar .tab-label:nth-of-type(1),
  .tab-radio:nth-of-type(2):checked ~ .tab-bar .tab-label:nth-of-type(2),
  .tab-radio:nth-of-type(3):checked ~ .tab-bar .tab-label:nth-of-type(3) {
    color: var(--tab-color, var(--sap-blue));
    border-bottom-color: var(--tab-color, var(--sap-blue));
  }

  .tab-panel h4 { font-size: .9rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #555; margin: 1rem 0 .4rem; }
  .tab-panel p  { font-size: 1.013rem; line-height: 2.2; margin-bottom: 1.2rem; }
  .tab-panel ul, .tab-panel ol { font-size: 1.013rem; padding-left: 1.3rem; }
  .tab-panel li { margin-bottom: .7rem; }
  .tab-panel a  { color: var(--sap-blue); }
  .tab-panel blockquote {
    background: #f4f6fa; border-left: 3px solid #c5cdd9; border-radius: 4px;
    padding: .9rem 1.4rem; font-size: .956rem; font-style: italic; color: #666;
    margin: 0 0 1.4rem;
  }
  .tab-panel blockquote p { margin: 0; font-size: .956rem; }

  /* ── Reader guide ── */
  .nl-reader-guide {
    background: #fffbea;
    border: 1px solid #f0c040;
    border-left: 4px solid #e8a000;
    border-radius: 6px;
    padding: .9rem 1.1rem 1rem;
    margin-bottom: 1.4rem;
  }
  .nl-reader-guide h3 {
    font-size: 1.05rem; font-weight: 700; color: var(--sap-text);
    margin: 0 0 .5rem;
  }
  .nl-reader-guide p { margin: 0 0 .75rem; color: var(--sap-text); }
  .nl-reader-guide .guide-tabs {
    display: flex; gap: .6rem 1.2rem; flex-wrap: wrap; align-items: flex-start;
    margin-top: .1rem;
  }
  .nl-reader-guide .guide-tab {
    display: flex; align-items: flex-start; flex-direction: column; gap: .15rem;
    font-size: .82rem;
  }
  .nl-reader-guide .guide-tab .tab-name {
    display: flex; align-items: center; gap: .3rem;
    font-weight: 700; font-size: .75rem;
    padding: .2rem .55rem;
    border-radius: 4px;
    white-space: nowrap;
  }
  .nl-reader-guide .guide-tab .tab-desc {
    font-weight: 400; font-size: .78rem; color: #5a6475;
    line-height: 1.3; padding-left: .2rem;
  }
  .nl-reader-guide .guide-tab.exec  .tab-name { background: #d6eaff; color: #004ea0; }
  .nl-reader-guide .guide-tab.strat .tab-name { background: #d4f0e2; color: #0d5c32; }
  .nl-reader-guide .guide-tab.deep  .tab-name { background: #e8d9f8; color: #45206e; }

  /* ── Tabs — colored backgrounds ── */
  /* Active tab label gets a tinted background swatch behind it */
  .tab-radio:nth-of-type(1):checked ~ .tab-bar .tab-label:nth-of-type(1) { background: #d6eaff; border-radius: 6px 6px 0 0; padding-bottom: calc(.55rem + 3px); }
  .tab-radio:nth-of-type(2):checked ~ .tab-bar .tab-label:nth-of-type(2) { background: #d4f0e2; border-radius: 6px 6px 0 0; padding-bottom: calc(.55rem + 3px); }
  .tab-radio:nth-of-type(3):checked ~ .tab-bar .tab-label:nth-of-type(3) { background: #e8d9f8; border-radius: 6px 6px 0 0; padding-bottom: calc(.55rem + 3px); }

  /* Inactive tab labels get a very subtle tint */
  .tab-label:nth-of-type(1) { background: #eef5ff; border-radius: 6px 6px 0 0; }
  .tab-label:nth-of-type(2) { background: #edf8f2; border-radius: 6px 6px 0 0; }
  .tab-label:nth-of-type(3) { background: #f3ecfb; border-radius: 6px 6px 0 0; }

  /* Active tab panel gets a light tint matching its tab color */
  .tab-radio:nth-of-type(1):checked ~ .tab-content .tab-panel:nth-of-type(1) { background: #f5f9ff; border-radius: 0 6px 6px 6px; padding: 1rem 1.1rem; margin: 0 -1.4rem; }
  .tab-radio:nth-of-type(2):checked ~ .tab-content .tab-panel:nth-of-type(2) { background: #f2fbf6; border-radius: 0 6px 6px 6px; padding: 1rem 1.1rem; margin: 0 -1.4rem; }
  .tab-radio:nth-of-type(3):checked ~ .tab-content .tab-panel:nth-of-type(3) { background: #f9f4ff; border-radius: 0 6px 6px 6px; padding: 1rem 1.1rem; margin: 0 -1.4rem; }

  /* ── HR (separators between topics — hidden, cards provide spacing) ── */
  hr { display: none; }

  /* ── Footer ── */
  .nl-footer { text-align: center; font-size: .75rem; color: #aaa; padding: 2rem 1rem 3rem; }
</style>
</head>
<body>

<header class="nl-header">
  <div class="nl-header-inner">
    <h1><i class="bi bi-broadcast pulse-icon"></i>SAP Business AI Pulse</h1>
    <div class="meta">${date}${topicLabel ? ` &nbsp;·&nbsp; ${topicLabel}` : ''}</div>
  </div>
</header>

<div class="nl-layout">
  <main class="nl-main">
    <div class="nl-reader-guide mb-4">
      <h3><i class="bi bi-map-fill" style="color:var(--sap-gold);margin-right:.35rem"></i>Reading Guide<i class="bi bi-compass-fill" style="color:var(--sap-gold);margin-left:.35rem"></i></h3>
      <p>SAP Business AI Pulse is a focused, educational newsletter dedicated to SAP's AI domain. Its purpose is to keep you informed — not to advise or recommend — so you can build your own understanding of where SAP Business AI is heading and what it means for your role. Each edition covers a curated set of topics, and every topic is structured across three reading depths so you can engage at the level that matters most to you.</p>
      <p>Click any topic to expand it, then use the tabs to choose your depth.</p>
      <ol class="guide-tabs">
        <li class="guide-tab exec">
          <span class="tab-name"><i class="bi bi-binoculars"></i> The Big Picture</span>
          <span class="tab-desc">What happened and why it matters — written for executives and decision-makers</span>
        </li>
        <li class="guide-tab strat">
          <span class="tab-name"><i class="bi bi-graph-up-arrow"></i> Strategy in Motion</span>
          <span class="tab-desc">Business &amp; competitive implications — written for business leaders</span>
        </li>
        <li class="guide-tab deep">
          <span class="tab-name"><i class="bi bi-gear"></i> Under the Hood</span>
          <span class="tab-desc">Technical deep-dive for practitioners — written for technical experts</span>
        </li>
      </ol>
    </div>
    ${topics}
  </main>
  ${sidebarHtml}
</div>

<footer class="nl-footer">
    <p>SAP Business AI Pulse · Generated using SAP Business AI Platform</p>
    <p>Disclaimer: This is not an official SAP newsletter and is not endorsed by SAP. The content shared reflects independent perspectives and is provided for educational and informational purposes only. It should not be interpreted as SAP's official guidance, recommendations, or position.</p>
</footer>

<script>
document.querySelector('.nl-main').addEventListener('click', function(e) {
  var summary = e.target.closest('summary.topic-summary');
  var collapseBar = e.target.closest('.topic-collapse-bar');
  if (collapseBar) {
    collapseBar.closest('details.topic-block').open = false;
    return;
  }
  if (!summary) return;
  var opening = !summary.parentElement.open;
  if (opening) {
    document.querySelectorAll('details.topic-block[open]').forEach(function(d) { d.open = false; });
  }
});
</script>
</body>
</html>`;
  } catch (err) {
    throw Object.assign(
      new Error(`Markdown conversion failed: ${(err as Error).message}`),
      { code: 'LIFECYCLE_CONVERT_FAILED', cause: err },
    );
  }
}
