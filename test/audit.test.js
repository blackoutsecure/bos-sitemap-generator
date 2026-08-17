/**
 * Blackout Secure Sitemap Generator
 * Copyright © 2025-2026 Blackout Secure
 * SPDX-License-Identifier: Apache-2.0
 *
 * Sitemap/SEO audit rule tests.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const cfgMod = require('../src/lib/config');
const { audit, shouldFail } = require('../src/lib/audit');

const SITE = 'https://example.com';

function fixture(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bos-sitemap-audit-'));
  for (const [relative, contents] of Object.entries(files)) {
    const target = path.join(dir, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents, 'utf8');
  }
  return dir;
}

function configWith(overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bos-sitemap-cfg-'));
  fs.mkdirSync(path.join(dir, '.github'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, '.bos-sitemap.yml'),
    JSON.stringify({ sitemap: overrides }),
    'utf8',
  );
  const cfg = cfgMod.resolve(dir);
  fs.rmSync(dir, { recursive: true, force: true });
  return cfg;
}

function findingFor(result, ruleId) {
  return result.findings.find((f) => f.ruleId === ruleId);
}

function urlList(...urls) {
  return urls.map((url) => ({ url, lastmod: '2026-01-01T00:00:00Z' }));
}

describe('lib/audit', () => {
  const dirs = [];

  afterEach(() => {
    while (dirs.length) fs.rmSync(dirs.pop(), { recursive: true, force: true });
  });

  function publicDir(files) {
    const dir = fixture(files);
    dirs.push(dir);
    return dir;
  }

  it('emits a finding for every known rule', () => {
    const cfg = configWith();
    const result = audit({
      cfg,
      siteUrl: SITE,
      publicDir: publicDir({ 'index.html': '<html></html>' }),
      urls: urlList(`${SITE}/`),
    });
    assert.strictEqual(result.findings.length, Object.keys(cfgMod.RULE_DEFAULTS).length);
  });

  it('records disabled controls as skip rather than dropping them', () => {
    const cfg = configWith({ audit: { rules: { require_https: 'skip' } } });
    const result = audit({
      cfg,
      siteUrl: SITE,
      publicDir: publicDir({}),
      urls: urlList('http://example.com/insecure'),
    });
    const finding = findingFor(result, 'SM010');
    assert.strictEqual(finding.severity, 'skip');
    assert.match(finding.message, /Control disabled/);
  });

  it('passes SM001/SM002 when robots.txt declares a sitemap', () => {
    const cfg = configWith();
    const result = audit({
      cfg,
      siteUrl: SITE,
      publicDir: publicDir({
        'robots.txt': `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`,
      }),
      urls: urlList(`${SITE}/`),
    });
    assert.strictEqual(findingFor(result, 'SM001').severity, 'pass');
    assert.strictEqual(findingFor(result, 'SM002').severity, 'pass');
  });

  it('warns when robots.txt exists without a sitemap directive', () => {
    const cfg = configWith();
    const result = audit({
      cfg,
      siteUrl: SITE,
      publicDir: publicDir({ 'robots.txt': 'User-agent: *\nAllow: /\n' }),
      urls: urlList(`${SITE}/`),
    });
    assert.strictEqual(findingFor(result, 'SM001').severity, 'pass');
    assert.strictEqual(findingFor(result, 'SM002').severity, 'warn');
  });

  it('flags non-https and off-origin URLs', () => {
    const cfg = configWith({
      audit: { rules: { require_https: 'fail', require_same_origin: 'fail' } },
    });
    const result = audit({
      cfg,
      siteUrl: SITE,
      publicDir: publicDir({}),
      urls: urlList('http://example.com/a', 'https://other.test/b'),
    });
    assert.strictEqual(findingFor(result, 'SM010').severity, 'fail');
    assert.strictEqual(findingFor(result, 'SM011').severity, 'fail');
    // Both entries are off-origin: the http:// URL differs by scheme.
    assert.strictEqual(findingFor(result, 'SM011').evidence.total, 2);
  });

  it('detects duplicate URLs', () => {
    const cfg = configWith();
    const result = audit({
      cfg,
      siteUrl: SITE,
      publicDir: publicDir({}),
      urls: urlList(`${SITE}/a`, `${SITE}/a`, `${SITE}/b`),
    });
    const finding = findingFor(result, 'SM012');
    assert.strictEqual(finding.severity, 'warn');
    assert.deepStrictEqual(finding.evidence.samples, [`${SITE}/a`]);
  });

  it('detects query strings and fragments', () => {
    const cfg = configWith();
    const result = audit({
      cfg,
      siteUrl: SITE,
      publicDir: publicDir({}),
      urls: urlList(`${SITE}/a?utm=1`, `${SITE}/b#top`),
    });
    assert.strictEqual(findingFor(result, 'SM013').severity, 'warn');
    assert.strictEqual(findingFor(result, 'SM014').severity, 'warn');
  });

  it('detects mixed trailing-slash conventions', () => {
    const cfg = configWith();
    const mixed = audit({
      cfg,
      siteUrl: SITE,
      publicDir: publicDir({}),
      urls: urlList(`${SITE}/docs/`, `${SITE}/guide`),
    });
    assert.strictEqual(findingFor(mixed, 'SM015').severity, 'warn');

    const consistent = audit({
      cfg,
      siteUrl: SITE,
      publicDir: publicDir({}),
      urls: urlList(`${SITE}/docs/`, `${SITE}/guide/`),
    });
    assert.strictEqual(findingFor(consistent, 'SM015').severity, 'pass');
  });

  it('ignores file URLs and the site root for trailing-slash style', () => {
    const cfg = configWith();
    const result = audit({
      cfg,
      siteUrl: SITE,
      publicDir: publicDir({}),
      urls: urlList(`${SITE}/`, `${SITE}/about.html`, `${SITE}/docs/`),
    });
    assert.strictEqual(findingFor(result, 'SM015').severity, 'pass');
  });

  it('enforces the configured maximum URL length', () => {
    const cfg = configWith({ audit: { max_url_length: 30 } });
    const result = audit({
      cfg,
      siteUrl: SITE,
      publicDir: publicDir({}),
      urls: urlList(`${SITE}/${'x'.repeat(60)}`),
    });
    assert.strictEqual(findingFor(result, 'SM016').severity, 'warn');
    assert.strictEqual(findingFor(result, 'SM016').evidence.max_url_length, 30);
  });

  it('flags noindex pages that are advertised in the sitemap', () => {
    const cfg = configWith();
    const dir = publicDir({
      'private.html': '<html><head><meta name="robots" content="noindex, nofollow"></head></html>',
      'index.html': '<html></html>',
    });
    const result = audit({
      cfg,
      siteUrl: SITE,
      publicDir: dir,
      urls: urlList(`${SITE}/private.html`, `${SITE}/`),
    });
    const finding = findingFor(result, 'SM017');
    assert.strictEqual(finding.severity, 'warn');
    assert.deepStrictEqual(finding.evidence.samples, ['private.html']);
  });

  it('requires a sitemap index once the sitemap is split', () => {
    const cfg = configWith();
    const missing = audit({
      cfg,
      siteUrl: SITE,
      publicDir: publicDir({}),
      urls: urlList(`${SITE}/a`),
      chunkCount: 2,
    });
    assert.strictEqual(findingFor(missing, 'SM022').severity, 'warn');

    const dir = publicDir({ 'sitemap-index.xml': '<sitemapindex/>' });
    const present = audit({
      cfg,
      siteUrl: SITE,
      publicDir: dir,
      urls: urlList(`${SITE}/a`),
      chunkCount: 2,
      sitemapIndexPath: path.join(dir, 'sitemap-index.xml'),
    });
    assert.strictEqual(findingFor(present, 'SM022').severity, 'pass');
  });

  it('flags an empty sitemap against the configured minimum', () => {
    const cfg = configWith();
    const result = audit({
      cfg,
      siteUrl: SITE,
      publicDir: publicDir({}),
      urls: [],
    });
    assert.strictEqual(findingFor(result, 'SM023').severity, 'warn');
  });

  it('reports lastmod coverage', () => {
    const cfg = configWith({ audit: { rules: { require_lastmod: 'warn' } } });
    const result = audit({
      cfg,
      siteUrl: SITE,
      publicDir: publicDir({}),
      urls: [{ url: `${SITE}/a` }, { url: `${SITE}/b`, lastmod: '2026-01-01' }],
    });
    const finding = findingFor(result, 'SM030');
    assert.strictEqual(finding.severity, 'warn');
    assert.strictEqual(finding.evidence.with_lastmod, 1);
  });

  it('reports canonical coverage', () => {
    const cfg = configWith({
      audit: { rules: { require_canonical_coverage: 'warn' } },
    });
    const result = audit({
      cfg,
      siteUrl: SITE,
      publicDir: publicDir({
        'a.html': `<html><head><link rel="canonical" href="${SITE}/a"></head></html>`,
        'b.html': '<html></html>',
      }),
      urls: urlList(`${SITE}/a`),
    });
    const finding = findingFor(result, 'SM031');
    assert.strictEqual(finding.severity, 'warn');
    assert.deepStrictEqual(finding.evidence.samples, ['b.html']);
  });

  it('flags oversized generated files', () => {
    const cfg = configWith();
    const dir = publicDir({ 'sitemap.xml': 'x'.repeat(2048) });
    const result = audit({
      cfg,
      siteUrl: SITE,
      publicDir: dir,
      urls: urlList(`${SITE}/a`),
      generatedFiles: [path.join(dir, 'sitemap.xml')],
      maxSizeMb: 0.000001,
    });
    assert.strictEqual(findingFor(result, 'SM021').severity, 'warn');
  });

  it('drives the exit disposition from fail_on', () => {
    const cfg = configWith({ audit: { rules: { require_https: 'fail' } } });
    const result = audit({
      cfg,
      siteUrl: SITE,
      publicDir: publicDir({}),
      urls: urlList('http://example.com/a'),
    });
    assert.strictEqual(shouldFail(result, 'fail'), true);
    assert.strictEqual(shouldFail(result, 'never'), false);
  });

  it('exposes run context for reporting', () => {
    const cfg = configWith();
    const result = audit({
      cfg,
      siteUrl: SITE,
      publicDir: publicDir({ 'index.html': '<html></html>' }),
      urls: urlList(`${SITE}/`),
    });
    assert.strictEqual(result.context.url_count, 1);
    assert.strictEqual(result.context.html_page_count, 1);
    assert.strictEqual(result.context.site_url, SITE);
  });
});
