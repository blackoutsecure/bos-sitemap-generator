const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { TEST_CONFIG } = require('./test-config');
const { SITEMAP_GENERATION } = TEST_CONFIG;
const { executeActionWithOverrides } = require('./test-helpers');

function createDiscoverSite(extraLinks) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitemap-discover-'));
  // Create target files for links
  for (let i = 0; i < extraLinks; i++) {
    fs.writeFileSync(
      path.join(dir, `linked-${i}.html`),
      `<html><body>Linked ${i}</body></html>`,
      'utf8',
    );
  }
  // index with anchors
  const anchors = Array.from(
    { length: extraLinks },
    (_, i) => `<a href="/linked-${i}.html">L${i}</a>`,
  ).join('');
  fs.writeFileSync(
    path.join(dir, 'index.html'),
    `<html><body>${anchors}</body></html>`,
    'utf8',
  );
  return dir;
}

describe('Link Discovery Limit Enforcement', () => {
  afterEach(() => {
    Object.keys(process.env).forEach((k) => {
      if (k.startsWith('INPUT_') || k.startsWith('TEST_MAX_'))
        delete process.env[k];
    });
  });

  it('caps discovered links at TEST_MAX_DISCOVERED_LINKS', async () => {
    process.env.TEST_MAX_DISCOVERED_LINKS = '5';
    const dir = createDiscoverSite(12); // create more links than cap
    await executeActionWithOverrides(
      dir,
      {
        site_url: TEST_CONFIG.SITE_URL,
        parse_canonical: 'false',
        discover_links: 'true',
        generate_sitemap_txt: 'false',
        include_patterns: 'index.html',
      },
      300,
    );
    const xmlPath = path.join(dir, SITEMAP_GENERATION.XML);
    assert.ok(fs.existsSync(xmlPath));
    const xml = fs.readFileSync(xmlPath, 'utf8');
    // Extract loc URLs only to avoid counting other contexts
    const locs = (xml.match(/<loc>(.*?)<\/loc>/g) || []).map((tag) =>
      tag.replace(/<\/?loc>/g, ''),
    );
    const discovered = locs.filter((u) => /linked-\d+\.html$/.test(u));
    assert.ok(
      discovered.length <= 5,
      `Expected at most 5 discovered links, got ${discovered.length}`,
    );
  });
});
