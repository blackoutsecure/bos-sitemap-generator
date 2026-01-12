const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { TEST_CONFIG } = require('./test-config');
const { SITEMAP_GENERATION } = TEST_CONFIG;
const { executeActionWithOverrides } = require('./test-helpers');

function createDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitemap-exc-'));
  fs.writeFileSync(path.join(dir, 'keep.html'), '<html></html>', 'utf8');
  fs.writeFileSync(path.join(dir, 'drop.zip'), 'binary', 'utf8');
  fs.writeFileSync(path.join(dir, 'pageA.html'), '<html></html>', 'utf8');
  fs.writeFileSync(path.join(dir, 'pageB.html'), '<html></html>', 'utf8');
  return dir;
}

describe('Action Exclusions (extensions & wildcard ?)', () => {
  afterEach(() => {
    Object.keys(process.env).forEach((k) => {
      if (k.startsWith('INPUT_')) delete process.env[k];
    });
  });
  it('excludes disallowed extensions and wildcard pattern', async () => {
    const dir = createDir();
    await executeActionWithOverrides(dir, {
      site_url: TEST_CONFIG.SITE_URL,
      exclude_extensions: '.zip',
      exclude_urls: '*/page?.html', // should match pageA.html and pageB.html
    });
    const xmlPath = path.join(dir, SITEMAP_GENERATION.XML);
    assert.ok(fs.existsSync(xmlPath));
    const xml = fs.readFileSync(xmlPath, 'utf8');
    assert.ok(xml.includes('https://example.com/keep.html'));
    assert.ok(!xml.includes('https://example.com/drop.zip'));
    assert.ok(!xml.includes('https://example.com/pageA.html'));
    assert.ok(!xml.includes('https://example.com/pageB.html'));
  });
});
