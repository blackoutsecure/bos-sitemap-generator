const assert = require('assert');
const path = require('path');
const fs = require('fs');
const {
  TEST_CONFIG,
  getAbsolutePath: _getAbsolutePath,
  getPublicFilePath: _getPublicFilePath,
} = require('./test-config');
const { setActionInput } = require('./test-helpers');

/**
 * Run src/index.js directly for proper mocking
 */
function runSource(publicDir, overrides = {}) {
  Object.entries(overrides).forEach(([k, v]) => setActionInput(k, v));
  setActionInput('public_dir', publicDir);
  setActionInput('sitemap_output_dir', publicDir);
  setActionInput('humans_output_dir', publicDir);
  setActionInput('security_output_dir', publicDir);

  // Default to true unless explicitly overridden
  if (!('generate_sitemap_xml' in overrides)) {
    setActionInput('generate_sitemap_xml', 'true');
  }
  if (!('generate_sitemap_txt' in overrides)) {
    setActionInput('generate_sitemap_txt', 'true');
  }
  if (!('generate_humans_txt' in overrides)) {
    setActionInput('generate_humans_txt', 'true');
  }
  if (!('generate_security_txt' in overrides)) {
    setActionInput('generate_security_txt', 'true');
  }

  const srcPath = path.resolve(__dirname, '..', 'src', 'index.js');
  delete require.cache[require.resolve(srcPath)];
  require(srcPath);
}

describe('lastmod_strategy validation', () => {
  afterEach(() => {
    Object.keys(process.env).forEach((k) => {
      if (k.startsWith('INPUT_')) delete process.env[k];
    });
  });

  it('accepts all valid lastmod_strategy values', async () => {
    const validValues = ['git', 'filemtime', 'current', 'none'];

    for (const strategy of validValues) {
      const os = require('os');
      const dir = fs.mkdtempSync(
        path.join(os.tmpdir(), `lastmod-${strategy}-`),
      );
      fs.writeFileSync(
        path.join(dir, 'index.html'),
        '<html><body>Test</body></html>',
        'utf8',
      );

      const core = require('@actions/core');
      const warnings = [];
      const errors = [];
      const origWarn = core.warning;
      const origError = core.error;
      core.warning = (m) => warnings.push(m);
      core.error = (m) => errors.push(m);

      runSource(dir, {
        site_url: TEST_CONFIG.SITE_URL,
        lastmod_strategy: strategy,
        strict_validation: 'false',
        generate_sitemap_txt: 'false',
      });

      // Wait for async operations
      await new Promise((r) => setTimeout(r, 700));

      core.warning = origWarn;
      core.error = origError;

      // Should not error for valid values
      const hasLastmodError = errors.some((m) =>
        /Invalid lastmod_strategy/i.test(m),
      );
      assert.ok(
        !hasLastmodError,
        `Valid lastmod_strategy "${strategy}" should not trigger error. Errors: ${JSON.stringify(errors)}`,
      );
    }
  });

  it('emits warning for "current" strategy (rarely recommended)', async () => {
    const os = require('os');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lastmod-current-'));
    fs.writeFileSync(
      path.join(dir, 'index.html'),
      '<html><body>Test</body></html>',
      'utf8',
    );

    const core = require('@actions/core');
    const warnings = [];
    const origWarn = core.warning;
    core.warning = (m) => warnings.push(m);

    runSource(dir, {
      site_url: TEST_CONFIG.SITE_URL,
      lastmod_strategy: 'current',
      strict_validation: 'false',
      generate_sitemap_txt: 'false',
    });

    // Wait for async operations
    await new Promise((r) => setTimeout(r, 700));

    core.warning = origWarn;

    const hasCurrentWarning = warnings.some(
      (m) =>
        /lastmod_strategy.*current.*rarely recommended/i.test(m) ||
        /Using "current".*rarely recommended/i.test(m),
    );
    assert.ok(
      hasCurrentWarning,
      `Expected warning for lastmod_strategy "current" (rarely recommended). Warnings: ${JSON.stringify(warnings)}`,
    );
  });

  it('emits warning for "none" strategy (not recommended)', async () => {
    const os = require('os');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lastmod-none-'));
    fs.writeFileSync(
      path.join(dir, 'index.html'),
      '<html><body>Test</body></html>',
      'utf8',
    );

    const core = require('@actions/core');
    const warnings = [];
    const origWarn = core.warning;
    core.warning = (m) => warnings.push(m);

    runSource(dir, {
      site_url: TEST_CONFIG.SITE_URL,
      lastmod_strategy: 'none',
      strict_validation: 'false',
      generate_sitemap_txt: 'false',
    });

    // Wait for async operations
    await new Promise((r) => setTimeout(r, 700));

    core.warning = origWarn;

    const hasNoneWarning = warnings.some(
      (m) =>
        /lastmod_strategy.*none.*not recommended/i.test(m) ||
        /Omitting.*lastmod.*not recommended/i.test(m),
    );
    assert.ok(
      hasNoneWarning,
      `Expected warning for lastmod_strategy "none" (not recommended). Warnings: ${JSON.stringify(warnings)}`,
    );
  });

  it('emits error for invalid lastmod_strategy value', async () => {
    const os = require('os');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lastmod-invalid-'));
    fs.writeFileSync(
      path.join(dir, 'index.html'),
      '<html><body>Test</body></html>',
      'utf8',
    );

    const core = require('@actions/core');
    const errors = [];
    const origError = core.error;
    core.error = (m) => errors.push(m);

    runSource(dir, {
      site_url: TEST_CONFIG.SITE_URL,
      lastmod_strategy: 'invalid-value',
      strict_validation: 'false',
      generate_sitemap_txt: 'false',
    });

    // Wait for async operations
    await new Promise((r) => setTimeout(r, 700));

    core.error = origError;

    const hasInvalidError = errors.some((m) =>
      /Invalid lastmod_strategy.*invalid-value/i.test(m),
    );
    assert.ok(
      hasInvalidError,
      `Expected error for invalid lastmod_strategy "invalid-value". Errors: ${JSON.stringify(errors)}`,
    );
  });
});
