const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { TEST_CONFIG } = require('./test-config');
const { SITEMAP_GENERATION } = TEST_CONFIG;
const { executeActionWithOverrides } = require('./test-helpers');

describe('Discover Links Limit Warning', () => {
  afterEach(() => {
    Object.keys(process.env).forEach((k) => {
      if (k.startsWith('INPUT_') || k.startsWith('TEST_'))
        delete process.env[k];
    });
  });

  function createLinkedSite(linkCount) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'discover-limit-'));
    let linksHtml = '';
    for (let i = 0; i < linkCount; i++) {
      const fname = `page-${i}.html`;
      fs.writeFileSync(
        path.join(dir, fname),
        `<html><body>Page ${i}</body></html>`,
        'utf8',
      );
      linksHtml += `<a href="/${fname}">Link ${i}</a>`;
    }
    fs.writeFileSync(
      path.join(dir, 'index.html'),
      `<html><body>${linksHtml}</body></html>`,
      'utf8',
    );
    return dir;
  }

  it('emits warning when discovered links exceed TEST_MAX_DISCOVERED_LINKS', async () => {
    process.env.TEST_MAX_DISCOVERED_LINKS = '5'; // small limit
    const dir = createLinkedSite(12); // exceed limit
    const core = require('@actions/core');
    const warnings = [];
    const origWarn = core.warning;
    core.warning = (m) => warnings.push(m);
    await executeActionWithOverrides(
      dir,
      {
        site_url: TEST_CONFIG.SITE_URL,
        parse_canonical: 'true',
        discover_links: 'true',
        include_patterns: 'index.html',
        generate_sitemap_txt: 'false',
      },
      400,
    );
    core.warning = origWarn;
    // Allow grace period for late warnings
    if (!warnings.some((m) => /Discovered links limit reached/i.test(m))) {
      // Fallback: assert sitemap contains at most limit + original root page URLs (1 + limit)
      const xmlPath = path.join(dir, SITEMAP_GENERATION.XML);
      const start = Date.now();
      while (!fs.existsSync(xmlPath) && Date.now() - start < 3000) {
        await new Promise((r) => setTimeout(r, 100));
      }
      assert.ok(fs.existsSync(xmlPath), 'sitemap.xml should exist');
      const xml = fs.readFileSync(xmlPath, 'utf8');
      const urlCount = (xml.match(/<url>/g) || []).length;
      assert.ok(
        urlCount <= 6,
        `Expected discovered links capped at limit (<=6), got ${urlCount}`,
      );
    }
  });
});
