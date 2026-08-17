const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { TEST_CONFIG } = require('./test-config');
const { SITEMAP_GENERATION } = TEST_CONFIG;
const { setActionInput } = require('./test-helpers');

function runSource() {
  delete require.cache[
    require.resolve(path.join(__dirname, '..', 'src', 'index.js'))
  ];
  require(path.join(__dirname, '..', 'src', 'index.js'));
}

describe('Sitemap Index Validation', () => {
  afterEach(() => {
    Object.keys(process.env).forEach((k) => {
      if (k.startsWith('INPUT_') || k.startsWith('TEST_'))
        delete process.env[k];
    });
  });

  function createSite(fileCount) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitemap-index-'));
    for (let i = 0; i < fileCount; i++) {
      fs.writeFileSync(
        path.join(dir, `p-${i}.html`),
        `<html><body>Page ${i}</body></html>`,
        'utf8',
      );
    }
    return dir;
  }

  it('validates sitemap index successfully in strict mode', async () => {
    process.env.TEST_MAX_URLS_PER_SITEMAP = '3';
    const dir = createSite(7); // will split into 3,3,1 -> sitemap-index.xml

    // Set up input environment
    setActionInput('site_url', 'https://example.com/');
    setActionInput('public_dir', dir);
    setActionInput('sitemap_output_dir', dir);
    setActionInput('humans_output_dir', dir);
    setActionInput('parse_canonical', 'false');
    setActionInput('discover_links', 'false');
    setActionInput('strict_validation', 'true');
    setActionInput('generate_sitemap_txt', 'false');

    runSource();
    await new Promise((r) => setTimeout(r, 300));

    const indexPath = path.join(dir, SITEMAP_GENERATION.INDEX);
    assert.ok(fs.existsSync(indexPath), 'index should exist');
    const content = fs.readFileSync(indexPath, 'utf8');
    assert.ok(/<sitemapindex/i.test(content));
    assert.ok(/<sitemap>/i.test(content));
  });

  it('detects corrupted sitemap index (missing closing tag) as failure in strict mode', async () => {
    process.env.TEST_MAX_URLS_PER_SITEMAP = '3';
    process.env.TEST_CORRUPT_SITEMAP_INDEX = 'true';
    const dir = createSite(7);

    // Set up input environment
    setActionInput('site_url', 'https://example.com/');
    setActionInput('public_dir', dir);
    setActionInput('sitemap_output_dir', dir);
    setActionInput('humans_output_dir', dir);
    setActionInput('parse_canonical', 'false');
    setActionInput('discover_links', 'false');
    setActionInput('strict_validation', 'true');
    setActionInput('generate_sitemap_txt', 'false');

    const core = require('@actions/core');
    const failures = [];
    const origFailed = core.setFailed;
    core.setFailed = (m) => failures.push(m);

    runSource();
    await new Promise((r) => setTimeout(r, 300));

    core.setFailed = origFailed;
    const hasIndexFailure = failures.some((m) =>
      /Invalid sitemap index structure/i.test(m),
    );
    assert.ok(hasIndexFailure, 'Expected failure for corrupted sitemap index');
  });
});
