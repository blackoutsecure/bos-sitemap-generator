const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { setActionInput } = require('./test-helpers');
const { TEST_CONFIG } = require('./test-config');
const { SITEMAP_GENERATION } = TEST_CONFIG;

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

describe('Invalid changefreq/priority warnings', () => {
  afterEach(() => {
    Object.keys(process.env).forEach((k) => {
      if (k.startsWith('INPUT_')) delete process.env[k];
    });
  });

  it('emits warning for invalid changefreq value', async () => {
    // Create temp site with a couple files
    const os = require('os');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'freqprio-'));
    fs.writeFileSync(
      path.join(dir, 'index.html'),
      '<html><body>Home</body></html>',
      'utf8',
    );
    fs.writeFileSync(
      path.join(dir, 'about.html'),
      '<html><body>About</body></html>',
      'utf8',
    );
    const core = require('@actions/core');
    const warnings = [];
    const origWarn = core.warning;
    core.warning = (m) => warnings.push(m);

    runSource(dir, {
      site_url: TEST_CONFIG.SITE_URL,
      changefreq: 'sometimes',
      strict_validation: 'false',
      generate_sitemap_txt: 'false',
    });

    // Wait for async operations
    await new Promise((r) => setTimeout(r, TEST_CONFIG.ASYNC_WAIT_MS));

    core.warning = origWarn;
    const hasChangefreqWarning = warnings.some((m) =>
      /Invalid <changefreq>/i.test(m),
    );

    // Assert that changefreq warning was emitted
    assert.ok(
      hasChangefreqWarning,
      `Expected changefreq warning for invalid value "sometimes". Warnings: ${JSON.stringify(warnings)}`,
    );

    // Verify sitemap was still generated despite warnings
    const xmlPath = path.join(dir, SITEMAP_GENERATION.XML);
    const start = Date.now();
    while (!fs.existsSync(xmlPath) && Date.now() - start < 2500) {
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(fs.existsSync(xmlPath), 'sitemap.xml should exist');
  });

  it('fails early for invalid priority value', async () => {
    const os = require('os');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'priority-invalid-'));
    fs.writeFileSync(
      path.join(dir, 'index.html'),
      '<html><body>Test</body></html>',
      'utf8',
    );

    const core = require('@actions/core');
    const failures = [];
    const origSetFailed = core.setFailed;
    core.setFailed = (m) => failures.push(m);

    runSource(dir, {
      site_url: TEST_CONFIG.SITE_URL,
      priority: '1.5',
      strict_validation: 'false',
      generate_sitemap_txt: 'false',
    });

    // Wait for execution
    await new Promise((r) => setTimeout(r, 100));

    core.setFailed = origSetFailed;

    const hasPriorityError = failures.some((m) =>
      /Invalid priority value/i.test(m),
    );
    assert.ok(
      hasPriorityError,
      `Expected priority error for invalid value "1.5". Failures: ${JSON.stringify(failures)}`,
    );

    // Priority validation fails early, so sitemap won't be generated
    const xmlPath = path.join(dir, SITEMAP_GENERATION.XML);
    assert.ok(
      !fs.existsSync(xmlPath),
      'sitemap.xml should not exist when priority validation fails',
    );
  });

  it('accepts all valid changefreq values', async function () {
    this.timeout(12000);
    const validValues = [
      'always',
      'hourly',
      'daily',
      'weekly',
      'monthly',
      'yearly',
      'never',
    ];

    for (const freq of validValues) {
      const os = require('os');
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), `freq-${freq}-`));
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
        changefreq: freq,
        strict_validation: 'false',
        generate_sitemap_txt: 'false',
      });

      // Wait for async operations (allowing extra time for validations)
      await new Promise((r) => setTimeout(r, TEST_CONFIG.ASYNC_WAIT_MS));

      core.warning = origWarn;

      const hasChangefreqWarning = warnings.some((m) =>
        /Invalid <changefreq>/i.test(m),
      );
      assert.ok(
        !hasChangefreqWarning,
        `Valid changefreq value "${freq}" should not trigger warning. Warnings: ${JSON.stringify(warnings)}`,
      );
    }
  });

  it('fails for priority values outside 0.0-1.0 range', async function () {
    this.timeout(TEST_CONFIG.ACTION_TIMEOUT_MS);
    const invalidValues = ['-0.1', '1.5', '2.0', '-1', '5.0', 'abc'];

    for (const priority of invalidValues) {
      const os = require('os');
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), `priority-invalid-`));
      fs.writeFileSync(
        path.join(dir, 'index.html'),
        '<html><body>Test</body></html>',
        'utf8',
      );

      const core = require('@actions/core');
      const failures = [];
      const origSetFailed = core.setFailed;
      core.setFailed = (m) => failures.push(m);

      runSource(dir, {
        site_url: TEST_CONFIG.SITE_URL,
        priority: priority,
        strict_validation: 'false',
        generate_sitemap_txt: 'false',
      });

      // Wait for execution
      await new Promise((r) => setTimeout(r, TEST_CONFIG.ASYNC_WAIT_MS));

      core.setFailed = origSetFailed;

      const hasPriorityError = failures.some((m) =>
        /Invalid priority value/i.test(m),
      );
      assert.ok(
        hasPriorityError,
        `Invalid priority value "${priority}" should trigger error. Failures: ${JSON.stringify(failures)}`,
      );
    }
  });

  it('accepts valid priority values in 0.0-1.0 range', async function () {
    this.timeout(TEST_CONFIG.ACTION_TIMEOUT_MS);
    const validValues = ['0.0', '0.3', '0.5', '0.8', '1.0', '0.75'];

    for (const priority of validValues) {
      const os = require('os');
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), `priority-valid-`));
      fs.writeFileSync(
        path.join(dir, 'index.html'),
        '<html><body>Test</body></html>',
        'utf8',
      );

      const core = require('@actions/core');
      const failures = [];
      const warnings = [];
      const origSetFailed = core.setFailed;
      const origWarn = core.warning;
      core.setFailed = (m) => failures.push(m);
      core.warning = (m) => warnings.push(m);

      runSource(dir, {
        site_url: TEST_CONFIG.SITE_URL,
        priority: priority,
        strict_validation: 'false',
        generate_sitemap_txt: 'false',
      });

      // Wait for async operations
      await new Promise((r) => setTimeout(r, TEST_CONFIG.ASYNC_WAIT_MS));

      core.setFailed = origSetFailed;
      core.warning = origWarn;

      const hasPriorityError = failures.some((m) =>
        /Invalid priority value/i.test(m),
      );
      assert.ok(
        !hasPriorityError,
        `Valid priority value "${priority}" should not trigger error. Failures: ${JSON.stringify(failures)}`,
      );

      // Should warn that Google ignores priority
      const hasGoogleWarning = warnings.some((m) =>
        /Google ignores <priority>/i.test(m),
      );
      assert.ok(
        hasGoogleWarning,
        `Priority value "${priority}" should trigger Google warning. Warnings: ${JSON.stringify(warnings)}`,
      );
    }
  });
});
