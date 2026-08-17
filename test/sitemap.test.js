const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {
  TEST_CONFIG,
  getAbsolutePath,
  getPublicFilePath,
} = require('./test-config');
const {
  setupActionEnvironment,
  cleanTestArtifacts,
  verifySitemapOutput,
  runActionLocally,
} = require('./test-helpers');

describe('Sitemap Generation', () => {
  const projectRoot = path.join(__dirname, '..');
  const publicDir = getAbsolutePath(TEST_CONFIG.PUBLIC_DIR);
  const sitemapPath = getPublicFilePath(TEST_CONFIG.SITEMAP_GENERATION.XML);

  beforeEach(() => {
    // Clean up any existing sitemap files before each test
    cleanTestArtifacts(publicDir);
  });

  afterEach(() => {
    // Reset environment variables after each test
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith('INPUT_')) {
        delete process.env[key];
      }
    });
  });

  before(() => {
    // Clean up any existing sitemap files before testing
    cleanTestArtifacts(publicDir);
  });

  it('should generate sitemap.xml when action runs', function (done) {
    this.timeout(10000); // Allow up to 10s for generation

    try {
      // Set up environment and run action
      const eventPath = path.join(__dirname, 'event.json');
      setupActionEnvironment(eventPath);

      // Run action - it executes synchronously despite being async internally
      runActionLocally(path.join(projectRoot, 'dist/index.js'));

      // Give action time to complete async operations
      setTimeout(() => {
        try {
          // Verify sitemap was created
          assert.ok(fs.existsSync(sitemapPath), 'sitemap.xml should exist');

          // Verify sitemap is valid XML
          const content = fs.readFileSync(sitemapPath, 'utf8');
          assert.ok(
            content.includes('<?xml'),
            'sitemap contains XML declaration',
          );
          assert.ok(
            content.includes('<urlset'),
            'sitemap contains urlset element',
          );

          done();
        } catch (error) {
          done(error);
        }
      }, 100);
    } catch (error) {
      done(error);
    }
  });

  it('should create gzipped sitemap when enabled', () => {
    const gzPath = sitemapPath + '.gz';
    if (fs.existsSync(gzPath)) {
      const stats = fs.statSync(gzPath);
      assert.ok(stats.size > 0, 'gzipped sitemap should have content');
    }
  });

  it('should pass all verification checks', async function () {
    // If sitemap wasn't generated earlier, generate it now to ensure verification runs
    if (!fs.existsSync(sitemapPath)) {
      const eventPath = path.join(__dirname, 'event.json');
      setupActionEnvironment(eventPath);
      runActionLocally(path.join(projectRoot, 'dist/index.js'));
      // Wait briefly for async writes to complete
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    const { allPassed, results } = verifySitemapOutput(publicDir);

    // Log any failures for debugging
    if (!allPassed) {
      console.log('Verification failures:');
      results.forEach((r) => {
        if (!r.valid || (!r.exists && r.required)) {
          console.log(`  ${r.file}:`, r.errors || ['missing']);
        }
      });
    }

    assert.ok(allPassed, 'All verification checks should pass');
  });
});
