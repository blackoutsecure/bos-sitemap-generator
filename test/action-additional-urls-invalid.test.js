const path = require('path');
const fs = require('fs');
const { TEST_CONFIG } = require('./test-config');
const { SITEMAP_GENERATION } = TEST_CONFIG;
const { setActionInput } = require('./test-helpers');

function runSource() {
  delete require.cache[
    require.resolve(path.join(__dirname, '..', 'src', 'index.js'))
  ];
  require(path.join(__dirname, '..', 'src', 'index.js'));
}

describe('Early additional_urls strict validation', function () {
  this.timeout(4000);
  const pubDir = path.join(__dirname, '..', 'public');

  beforeEach(() => {
    [
      SITEMAP_GENERATION.XML,
      SITEMAP_GENERATION.TXT,
      SITEMAP_GENERATION.INDEX,
    ].forEach((f) => {
      const full = path.join(pubDir, f);
      if (fs.existsSync(full)) fs.unlinkSync(full);
    });
    Object.keys(process.env).forEach((k) => {
      if (k.startsWith('INPUT_')) delete process.env[k];
    });
  });

  it('fails early on invalid protocol in additional_urls when strict', async () => {
    setActionInput('site_url', 'https://example.com/');
    setActionInput('public_dir', 'public');
    setActionInput('generate_sitemap_xml', 'false');
    setActionInput('generate_sitemap_txt', 'true');
    setActionInput(
      'additional_urls',
      'ftp://bad.example.com,bad-relative/path',
    );
    setActionInput('strict_validation', 'true');

    const core = require('@actions/core');
    const failures = [];
    const origFailed = core.setFailed;
    core.setFailed = (m) => failures.push(m);

    runSource();
    await new Promise((r) => setTimeout(r, 400));

    core.setFailed = origFailed;

    const earlyFailure = failures.find((m) =>
      /invalid URL\(s\) in additional_urls/i.test(m),
    );
    if (!earlyFailure) {
      throw new Error(
        'Expected early strict failure for invalid additional_urls entries',
      );
    }
  });
});
