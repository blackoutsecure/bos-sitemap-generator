/**
 * Copyright 2025 Blackout Secure
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit tests for utils.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  formatFileSize,
  findPublicDir,
  inferSiteUrl,
} = require('../../src/lib/utils');

describe('Utils', function () {
  describe('formatFileSize', function () {
    it('should format bytes correctly', function () {
      assert.strictEqual(formatFileSize(0), '0 B');
      assert.strictEqual(formatFileSize(500), '500 B');
      assert.strictEqual(formatFileSize(1023), '1023 B');
    });

    it('should format kilobytes correctly', function () {
      assert.strictEqual(formatFileSize(1024), '1.00 KB');
      assert.strictEqual(formatFileSize(1536), '1.50 KB');
      assert.strictEqual(formatFileSize(10240), '10.00 KB');
      assert.strictEqual(formatFileSize(1024 * 500), '500.00 KB');
    });

    it('should format megabytes correctly', function () {
      assert.strictEqual(formatFileSize(1024 * 1024), '1.00 MB');
      assert.strictEqual(formatFileSize(1024 * 1024 * 1.5), '1.50 MB');
      assert.strictEqual(formatFileSize(1024 * 1024 * 50), '50.00 MB');
    });
  });

  describe('findPublicDir', function () {
    let tempDir;

    beforeEach(function () {
      // Create temporary directory for testing
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitemap-test-'));
      // Store original cwd
      this.originalCwd = process.cwd();
      process.chdir(tempDir);
    });

    afterEach(function () {
      // Restore original cwd
      process.chdir(this.originalCwd);
      // Clean up temp directory
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should return null when no directories exist', function () {
      const result = findPublicDir();
      assert.strictEqual(result, null);
    });

    it('should find dist directory', function () {
      fs.mkdirSync(path.join(tempDir, 'dist'));
      fs.writeFileSync(
        path.join(tempDir, 'dist', 'index.html'),
        '<html></html>',
      );
      const result = findPublicDir();
      assert.strictEqual(result, 'dist');
    });

    it('should find build directory', function () {
      fs.mkdirSync(path.join(tempDir, 'build'));
      fs.writeFileSync(
        path.join(tempDir, 'build', 'index.html'),
        '<html></html>',
      );
      const result = findPublicDir();
      assert.strictEqual(result, 'build');
    });

    it('should find public directory', function () {
      fs.mkdirSync(path.join(tempDir, 'public'));
      fs.writeFileSync(
        path.join(tempDir, 'public', 'index.html'),
        '<html></html>',
      );
      const result = findPublicDir();
      assert.strictEqual(result, 'public');
    });

    it('should prefer directory with index.html', function () {
      fs.mkdirSync(path.join(tempDir, 'dist'));
      fs.mkdirSync(path.join(tempDir, 'build'));
      fs.writeFileSync(
        path.join(tempDir, 'dist', 'page.html'),
        '<html></html>',
      );
      fs.writeFileSync(
        path.join(tempDir, 'build', 'index.html'),
        '<html></html>',
      );
      const result = findPublicDir();
      assert.strictEqual(result, 'build');
    });

    it('should prefer directory with more HTML files', function () {
      fs.mkdirSync(path.join(tempDir, 'dist'));
      fs.mkdirSync(path.join(tempDir, 'build'));
      fs.writeFileSync(
        path.join(tempDir, 'dist', 'page1.html'),
        '<html></html>',
      );
      fs.writeFileSync(
        path.join(tempDir, 'dist', 'page2.html'),
        '<html></html>',
      );
      fs.writeFileSync(
        path.join(tempDir, 'dist', 'page3.html'),
        '<html></html>',
      );
      fs.writeFileSync(
        path.join(tempDir, 'build', 'page1.html'),
        '<html></html>',
      );
      const result = findPublicDir();
      assert.strictEqual(result, 'dist');
    });

    it('should use candidate input if provided and exists', function () {
      fs.mkdirSync(path.join(tempDir, 'custom'));
      fs.mkdirSync(path.join(tempDir, 'dist'));
      fs.writeFileSync(
        path.join(tempDir, 'custom', 'index.html'),
        '<html></html>',
      );
      fs.writeFileSync(
        path.join(tempDir, 'dist', 'index.html'),
        '<html></html>',
      );
      const result = findPublicDir('custom');
      assert.strictEqual(result, 'custom');
    });
  });

  describe('inferSiteUrl', function () {
    let tempDir;
    let originalEnv;

    beforeEach(function () {
      // Create temporary directory for testing
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitemap-test-'));
      // Save original environment
      originalEnv = process.env.GITHUB_REPOSITORY;
    });

    afterEach(function () {
      // Restore environment
      if (originalEnv !== undefined) {
        process.env.GITHUB_REPOSITORY = originalEnv;
      } else {
        delete process.env.GITHUB_REPOSITORY;
      }
      // Clean up temp directory
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should return null when no CNAME or GitHub repo', function () {
      delete process.env.GITHUB_REPOSITORY;
      const result = inferSiteUrl(tempDir);
      assert.strictEqual(result, null);
    });

    it('should read from CNAME file', function () {
      const cnamePath = path.join(tempDir, 'CNAME');
      fs.writeFileSync(cnamePath, 'example.com\n');
      const result = inferSiteUrl(tempDir);
      assert.strictEqual(result, 'https://example.com');
    });

    it('should trim whitespace from CNAME', function () {
      const cnamePath = path.join(tempDir, 'CNAME');
      fs.writeFileSync(cnamePath, '  example.com  \n');
      const result = inferSiteUrl(tempDir);
      assert.strictEqual(result, 'https://example.com');
    });

    it('should handle CNAME without publicDir', function () {
      fs.writeFileSync('CNAME', 'example.com');
      const result = inferSiteUrl(null);
      assert.strictEqual(result, 'https://example.com');
      fs.unlinkSync('CNAME');
    });

    it('should infer from GitHub Pages user/org site', function () {
      delete process.env.GITHUB_REPOSITORY;
      process.env.GITHUB_REPOSITORY = 'myuser/myuser.github.io';
      const result = inferSiteUrl(tempDir);
      assert.strictEqual(result, 'https://myuser.github.io/');
    });

    it('should infer from GitHub Pages project site', function () {
      delete process.env.GITHUB_REPOSITORY;
      process.env.GITHUB_REPOSITORY = 'myuser/myproject';
      const result = inferSiteUrl(tempDir);
      assert.strictEqual(result, 'https://myuser.github.io/myproject/');
    });

    it('should handle case-insensitive GitHub Pages user/org site', function () {
      delete process.env.GITHUB_REPOSITORY;
      process.env.GITHUB_REPOSITORY = 'MyUser/MyUser.github.io';
      const result = inferSiteUrl(tempDir);
      assert.strictEqual(result, 'https://MyUser.github.io/');
    });

    it('should prefer CNAME over GitHub Pages', function () {
      const cnamePath = path.join(tempDir, 'CNAME');
      fs.writeFileSync(cnamePath, 'custom.com');
      process.env.GITHUB_REPOSITORY = 'myuser/myproject';
      const result = inferSiteUrl(tempDir);
      assert.strictEqual(result, 'https://custom.com');
    });

    it('should handle empty CNAME file', function () {
      const cnamePath = path.join(tempDir, 'CNAME');
      fs.writeFileSync(cnamePath, '');
      process.env.GITHUB_REPOSITORY = 'myuser/myproject';
      const result = inferSiteUrl(tempDir);
      assert.strictEqual(result, 'https://myuser.github.io/myproject/');
    });

    it('should return null when only owner without repo', function () {
      delete process.env.GITHUB_REPOSITORY;
      process.env.GITHUB_REPOSITORY = 'myuser/';
      const result = inferSiteUrl(tempDir);
      assert.strictEqual(result, null);
    });
  });
});
