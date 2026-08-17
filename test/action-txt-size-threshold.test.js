const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { setActionInput } = require('./test-helpers');

function runSource() {
  delete require.cache[
    require.resolve(path.join(__dirname, '..', 'src', 'index.js'))
  ];
  require(path.join(__dirname, '..', 'src', 'index.js'));
}

describe('TXT sitemap size threshold override', () => {
  afterEach(() => {
    Object.keys(process.env).forEach((k) => {
      if (k.startsWith('INPUT_') || k.startsWith('TEST_'))
        delete process.env[k];
    });
  });

  it('fails (strict) when TXT sitemap exceeds overridden size limit', async () => {
    process.env.TEST_TXT_MAX_SIZE_MB = '0'; // effectively any content triggers failure
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-size-'));
    // Create multiple files to produce several URLs in TXT sitemap
    for (let i = 0; i < 5; i++) {
      fs.writeFileSync(
        path.join(dir, `f${i}.html`),
        `<html><body>${i}</body></html>`,
        'utf8',
      );
    }

    // Set up input environment
    setActionInput('site_url', 'https://example.com/');
    setActionInput('public_dir', dir);
    setActionInput('sitemap_output_dir', dir);
    setActionInput('humans_output_dir', dir);
    setActionInput('generate_sitemap_xml', 'false');
    setActionInput('generate_sitemap_txt', 'true');
    setActionInput('strict_validation', 'true');

    const core = require('@actions/core');
    const failures = [];
    const origFail = core.setFailed;
    core.setFailed = (m) => failures.push(m);

    runSource();
    await new Promise((r) => setTimeout(r, 300));

    core.setFailed = origFail;
    const hasSizeFailure = failures.some((m) => /Exceeds 0 MB/i.test(m));
    assert.ok(
      hasSizeFailure,
      'Expected TXT size failure with overridden threshold',
    );
  });
});
