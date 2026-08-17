const assert = require('assert');
const path = require('path');
const {
  extractCanonicalUrl,
  discoverInternalLinks,
} = require('../../src/lib/html-parser');

describe('HTML Parser', () => {
  const fixturesDir = path.join(__dirname, '../fixtures/html');

  describe('extractCanonicalUrl', () => {
    it('should extract canonical URL from HTML', () => {
      const htmlPath = path.join(fixturesDir, 'valid-canonical.html');
      const canonical = extractCanonicalUrl(htmlPath);

      assert.strictEqual(canonical, 'https://example.com/canonical-page');
    });

    it('should return null for HTML without canonical', () => {
      const htmlPath = path.join(fixturesDir, 'no-canonical.html');
      const canonical = extractCanonicalUrl(htmlPath);

      assert.strictEqual(canonical, null);
    });

    it('should handle malformed HTML gracefully', () => {
      const htmlPath = path.join(fixturesDir, 'malformed.html');
      const canonical = extractCanonicalUrl(htmlPath);

      // Should not throw, may return null or partial result
      assert.ok(canonical === null || typeof canonical === 'string');
    });

    it('should return null for non-existent file', () => {
      const htmlPath = path.join(fixturesDir, 'nonexistent.html');
      const canonical = extractCanonicalUrl(htmlPath);

      assert.strictEqual(canonical, null);
    });
  });

  describe('discoverInternalLinks', () => {
    it('should discover internal links from HTML', () => {
      const htmlPath = path.join(fixturesDir, 'with-links.html');
      const links = discoverInternalLinks(htmlPath);

      assert.ok(Array.isArray(links));
      assert.ok(links.includes('/'));
      assert.ok(links.includes('/about'));
      assert.ok(links.includes('/products/item1.html'));
    });

    it('should exclude external links', () => {
      const htmlPath = path.join(fixturesDir, 'with-links.html');
      const links = discoverInternalLinks(htmlPath);

      assert.ok(
        !links.some(
          (link) => link.startsWith('http://') || link.startsWith('https://'),
        ),
      );
    });

    it('should exclude anchor links', () => {
      const htmlPath = path.join(fixturesDir, 'with-links.html');
      const links = discoverInternalLinks(htmlPath);

      assert.ok(!links.some((link) => link.startsWith('#')));
    });

    it('should return empty array for HTML without links', () => {
      const htmlPath = path.join(fixturesDir, 'no-canonical.html');
      const links = discoverInternalLinks(htmlPath);

      assert.ok(Array.isArray(links));
      assert.strictEqual(links.length, 0);
    });

    it('should handle malformed HTML gracefully', () => {
      const htmlPath = path.join(fixturesDir, 'malformed.html');
      const links = discoverInternalLinks(htmlPath);

      assert.ok(Array.isArray(links));
    });

    it('should return empty array for non-existent file', () => {
      const htmlPath = path.join(fixturesDir, 'nonexistent.html');
      const links = discoverInternalLinks(htmlPath);

      assert.ok(Array.isArray(links));
      assert.strictEqual(links.length, 0);
    });
  });
});
