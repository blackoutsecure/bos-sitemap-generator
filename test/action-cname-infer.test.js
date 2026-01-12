const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { TEST_CONFIG } = require('./test-config');
const { SITEMAP_GENERATION } = TEST_CONFIG;
const { executeActionWithOverrides } = require('./test-helpers');

function tempSite() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitemap-cname-'));
  fs.writeFileSync(path.join(dir, 'CNAME'), 'mydomain.test', 'utf8');
  fs.writeFileSync(
    path.join(dir, 'index.html'),
    '<html><body>CNAME</body></html>',
    'utf8',
  );
  return dir;
}

describe('Action CNAME Inference', () => {
  afterEach(() => {
    Object.keys(process.env).forEach((k) => {
      if (k.startsWith('INPUT_')) delete process.env[k];
    });
  });

  it('infers site_url from CNAME when input missing', async () => {
    const dir = tempSite();
    await executeActionWithOverrides(dir, {
      // force empty site_url so autodetect can infer from CNAME instead of event default
      site_url: '',
      allow_autodetect: 'true',
      generate_sitemap_txt: 'false',
    });
    const xmlPath = path.join(dir, SITEMAP_GENERATION.XML);
    assert.ok(fs.existsSync(xmlPath));
    const xml = fs.readFileSync(xmlPath, 'utf8');
    // Expect at least one URL starting with inferred domain
    assert.ok(
      /https:\/\/mydomain\.test\//.test(xml),
      'Sitemap should contain inferred CNAME domain URLs',
    );
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });
});
