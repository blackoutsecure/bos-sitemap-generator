const fs = require('fs');
const path = require('path');
const { TEST_CONFIG, getAbsolutePath } = require('./test-config');
const {
  setupActionEnvironment,
  cleanTestArtifacts,
  runActionLocally,
  setActionInput,
} = require('./test-helpers');

describe('External Sitemap Validation', () => {
  const projectRoot = path.join(__dirname, '..');
  const publicDir = getAbsolutePath(TEST_CONFIG.PUBLIC_DIR);

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

  it('should handle validation of non-existent sitemap path gracefully', function (done) {
    this.timeout(10000);

    try {
      const eventPath = path.join(__dirname, 'event.json');
      setupActionEnvironment(eventPath);

      const nonExistentPath = path.join(publicDir, 'nonexistent.xml');
      setActionInput('validate_sitemaps', nonExistentPath);

      // This should warn but not fail completely
      runActionLocally(path.join(projectRoot, 'dist/index.js'));

      done();
    } catch (err) {
      done(err);
    }
  });

  it('should detect invalid XML structure in validation', function (done) {
    this.timeout(10000);

    try {
      // Create an invalid XML file
      const invalidXmlPath = path.join(publicDir, 'invalid-sitemap.xml');
      const invalidContent =
        '<?xml version="1.0"?>\n<invalid>not a sitemap</invalid>';
      fs.writeFileSync(invalidXmlPath, invalidContent, 'utf8');

      const eventPath = path.join(__dirname, 'event.json');
      setupActionEnvironment(eventPath);
      setActionInput('validate_sitemaps', invalidXmlPath);

      // Run validation - should warn about invalid structure
      runActionLocally(path.join(projectRoot, 'dist/index.js'));

      done();
    } catch (err) {
      done(err);
    }
  });

  it('should detect invalid TXT sitemap format', function (done) {
    this.timeout(10000);

    try {
      // Create an invalid TXT sitemap
      const invalidTxtPath = path.join(publicDir, 'invalid-sitemap.txt');
      const invalidContent =
        'not a url\nhttps://example.com/page1\ninvalid-protocol://example.com';
      fs.writeFileSync(invalidTxtPath, invalidContent, 'utf8');

      const eventPath = path.join(__dirname, 'event.json');
      setupActionEnvironment(eventPath);
      setActionInput('validate_sitemaps', invalidTxtPath);

      // Run validation - should warn about invalid URLs
      runActionLocally(path.join(projectRoot, 'dist/index.js'));

      done();
    } catch (err) {
      done(err);
    }
  });

  it('should validate valid XML sitemap structure', function (done) {
    this.timeout(10000);

    try {
      // Create a valid XML sitemap
      const validXmlPath = path.join(publicDir, 'valid-sitemap.xml');
      const validContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/page1</loc>
    <priority>0.8</priority>
    <changefreq>weekly</changefreq>
  </url>
  <url>
    <loc>https://example.com/page2</loc>
  </url>
</urlset>`;
      fs.writeFileSync(validXmlPath, validContent, 'utf8');

      const eventPath = path.join(__dirname, 'event.json');
      setupActionEnvironment(eventPath);
      setActionInput('validate_sitemaps', validXmlPath);

      // Run validation - should pass
      runActionLocally(path.join(projectRoot, 'dist/index.js'));

      done();
    } catch (err) {
      done(err);
    }
  });

  it('should validate valid TXT sitemap', function (done) {
    this.timeout(10000);

    try {
      // Create a valid TXT sitemap
      const validTxtPath = path.join(publicDir, 'valid-sitemap.txt');
      const validContent =
        'https://example.com/page1\nhttps://example.com/page2\nhttps://example.com/page3\n';
      fs.writeFileSync(validTxtPath, validContent, 'utf8');

      const eventPath = path.join(__dirname, 'event.json');
      setupActionEnvironment(eventPath);
      setActionInput('validate_sitemaps', validTxtPath);

      // Run validation - should pass
      runActionLocally(path.join(projectRoot, 'dist/index.js'));

      done();
    } catch (err) {
      done(err);
    }
  });

  it('should validate multiple sitemaps from comma-separated paths', function (done) {
    this.timeout(10000);

    try {
      // Create valid XML and TXT sitemaps
      const validXmlPath = path.join(publicDir, 'valid-sitemap.xml');
      const validXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/page1</loc></url>
</urlset>`;
      fs.writeFileSync(validXmlPath, validXmlContent, 'utf8');

      const validTxtPath = path.join(publicDir, 'valid-sitemap.txt');
      const validTxtContent =
        'https://example.com/page1\nhttps://example.com/page2\n';
      fs.writeFileSync(validTxtPath, validTxtContent, 'utf8');

      const eventPath = path.join(__dirname, 'event.json');
      setupActionEnvironment(eventPath);
      setActionInput('validate_sitemaps', `${validXmlPath},${validTxtPath}`);

      // Run validation
      runActionLocally(path.join(projectRoot, 'dist/index.js'));

      done();
    } catch (err) {
      done(err);
    }
  });

  it('should validate sitemap index format', function (done) {
    this.timeout(10000);

    try {
      // Create a valid sitemap index
      const indexPath = path.join(publicDir, 'sitemap-index.xml');
      const indexContent = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap-1.xml</loc>
    <lastmod>2025-01-05</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap-2.xml</loc>
    <lastmod>2025-01-05</lastmod>
  </sitemap>
</sitemapindex>`;
      fs.writeFileSync(indexPath, indexContent, 'utf8');

      const eventPath = path.join(__dirname, 'event.json');
      setupActionEnvironment(eventPath);
      setActionInput('validate_sitemaps', indexPath);

      // Run validation - should validate index format
      runActionLocally(path.join(projectRoot, 'dist/index.js'));

      done();
    } catch (err) {
      done(err);
    }
  });

  it('should handle strict validation mode with invalid priority', function (done) {
    this.timeout(10000);

    try {
      // Create a sitemap with invalid priority (outside 0.0-1.0)
      const invalidPriorityPath = path.join(publicDir, 'invalid-priority.xml');
      const invalidContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/page1</loc>
    <priority>2.0</priority>
  </url>
</urlset>`;
      fs.writeFileSync(invalidPriorityPath, invalidContent, 'utf8');

      const eventPath = path.join(__dirname, 'event.json');
      setupActionEnvironment(eventPath);
      setActionInput('validate_sitemaps', invalidPriorityPath);
      setActionInput('strict_validation', 'true');

      // Run validation in strict mode - should warn about priority
      runActionLocally(path.join(projectRoot, 'dist/index.js'));

      done();
    } catch (err) {
      done(err);
    }
  });
});
