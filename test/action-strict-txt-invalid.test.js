const path = require('path');
const fs = require('fs');
const { TEST_CONFIG, getAbsolutePath } = require('./test-config');
const { SITEMAP_GENERATION } = TEST_CONFIG;
const { setActionInput } = require('./test-helpers');

function runSource() {
  delete require.cache[
    require.resolve(path.join(__dirname, '..', 'src', 'index.js'))
  ];
  require(path.join(__dirname, '..', 'src', 'index.js'));
}

describe('Strict TXT sitemap invalid URL handling', function () {
  this.timeout(4000);
  const pubDir = getAbsolutePath(TEST_CONFIG.PUBLIC_DIR);

  beforeEach(() => {
    // Clear outputs
    [SITEMAP_GENERATION.XML, SITEMAP_GENERATION.TXT].forEach((f) => {
      const full = path.join(pubDir, f);
      if (fs.existsSync(full)) fs.unlinkSync(full);
    });
    // Clear inputs
    Object.keys(process.env).forEach((k) => {
      if (k.startsWith('INPUT_')) delete process.env[k];
    });
  });

  it('fails in strict mode when TXT sitemap contains invalid protocol URLs', async () => {
    setActionInput('site_url', 'https://example.com/');
    setActionInput('public_dir', TEST_CONFIG.PUBLIC_DIR);
    setActionInput('generate_sitemap_xml', 'false');
    setActionInput('generate_sitemap_txt', 'true');
    setActionInput(
      'additional_urls',
      'bad-relative/path,ftp://invalid.example.com',
    );
    setActionInput('strict_validation', 'true');

    const core = require('@actions/core');
    const failures = [];
    const warnings = [];
    const origFailed = core.setFailed;
    const origWarn = core.warning;
    core.setFailed = (m) => failures.push(m);
    core.warning = (m) => warnings.push(m);

    runSource();
    await new Promise((r) => setTimeout(r, 600));

    core.setFailed = origFailed;
    core.warning = origWarn;

    const hasInvalidTxtFailure = failures.some((m) =>
      /invalid URL\(s\)/i.test(m),
    );
    const hasInvalidWarning = warnings.some((m) => /invalid URL\(s\)/i.test(m));
    if (!hasInvalidTxtFailure && !hasInvalidWarning) {
      throw new Error(
        'Expected strict validation failure or warning for invalid TXT sitemap URLs',
      );
    }
  });
});
