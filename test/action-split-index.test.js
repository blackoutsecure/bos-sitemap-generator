const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { TEST_CONFIG } = require('./test-config');
const { SITEMAP_GENERATION } = TEST_CONFIG;
const { executeActionWithOverrides } = require('./test-helpers');

function createSite(fileCount) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitemap-split-'));
  for (let i = 0; i < fileCount; i++) {
    fs.writeFileSync(
      path.join(dir, `page-${i}.html`),
      `<html><body>Page ${i}</body></html>`,
      'utf8',
    );
  }
  return dir;
}

describe('Sitemap Splitting & Index Generation', () => {
  afterEach(() => {
    Object.keys(process.env).forEach((k) => {
      if (k.startsWith('INPUT_') || k.startsWith('TEST_MAX_'))
        delete process.env[k];
    });
  });

  it('creates multiple sitemap parts and index when threshold exceeded', async () => {
    process.env.TEST_MAX_URLS_PER_SITEMAP = '5'; // force small chunk size
    const dir = createSite(12); // should produce 3 chunks of 5,5,2

    await executeActionWithOverrides(
      dir,
      {
        site_url: TEST_CONFIG.SITE_URL,
        parse_canonical: 'false',
        discover_links: 'false',
        generate_sitemap_txt: 'false',
      },
      400,
    );

    const indexPath = path.join(dir, SITEMAP_GENERATION.INDEX);
    assert.ok(fs.existsSync(indexPath), 'sitemap-index.xml should exist');
    const part1 = path.join(dir, 'sitemap-1.xml');
    const part2 = path.join(dir, 'sitemap-2.xml');
    const part3 = path.join(dir, 'sitemap-3.xml');
    assert.ok(fs.existsSync(part1));
    assert.ok(fs.existsSync(part2));
    assert.ok(fs.existsSync(part3));
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    assert.ok(indexContent.includes('sitemap-1.xml'));
    assert.ok(indexContent.includes('sitemap-2.xml'));
    assert.ok(indexContent.includes('sitemap-3.xml'));
  });
});
