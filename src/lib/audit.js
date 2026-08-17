/**
 * Blackout Secure Sitemap Generator
 * Copyright © 2025-2026 Blackout Secure
 * SPDX-License-Identifier: Apache-2.0
 *
 * Deterministic sitemap/SEO posture audit.
 *
 * Every rule is driven by `sitemap.audit.rules.<name>` in the layered
 * configuration. A rule configured as `skip` still emits a finding so the
 * report records that the control was deliberately not assessed.
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const { Finding, AuditResult } = require('./findings');
const { extractCanonicalUrl, extractRobotsMeta } = require('./html-parser');

const MAX_EVIDENCE_SAMPLES = 5;

/**
 * Run the full sitemap/SEO audit.
 *
 * @param {object} options - Audit inputs.
 * @param {object} options.cfg - Resolved configuration.
 * @param {string} options.siteUrl - Declared public base URL.
 * @param {string} options.publicDir - Published site directory.
 * @param {string} [options.sitemapOutputDir] - Sitemap output directory.
 * @param {Array<object>} [options.urls] - Sitemap URL entries.
 * @param {string[]} [options.generatedFiles] - Paths of generated sitemap files.
 * @param {number} [options.chunkCount] - Number of sitemap chunks written.
 * @param {string} [options.sitemapIndexPath] - Path of the sitemap index, if any.
 * @param {number} [options.maxUrlsPerSitemap] - sitemaps.org URL ceiling.
 * @param {number} [options.maxSizeMb] - sitemaps.org uncompressed size ceiling.
 * @returns {AuditResult} Findings plus run context.
 */
function audit({
  cfg,
  siteUrl,
  publicDir,
  sitemapOutputDir = publicDir,
  urls = [],
  generatedFiles = [],
  chunkCount = 1,
  sitemapIndexPath = '',
  maxUrlsPerSitemap = 50000,
  maxSizeMb = 50,
}) {
  const rules = cfg.audit.rules;
  const findings = [];

  /**
   * Evaluate one rule against a boolean outcome.
   * @param {string} ruleId - Rule identifier.
   * @param {string} ruleName - Config key under `audit.rules`.
   * @param {object} outcome - Evaluation outcome.
   * @param {boolean} outcome.ok - Whether the control is satisfied.
   * @param {string} outcome.passMessage - Evidence when satisfied.
   * @param {string} outcome.failMessage - Evidence when violated.
   * @param {string} [outcome.location] - Location for the finding.
   * @param {object} [outcome.evidence] - Machine-readable evidence.
   */
  const evaluate = (ruleId, ruleName, outcome) => {
    const severity = rules[ruleName];
    if (severity === 'skip') {
      findings.push(
        new Finding({
          ruleId,
          severity: 'skip',
          message: `Control disabled via \`sitemap.audit.rules.${ruleName}: skip\`.`,
          location: outcome.location || '',
          evidence: { rule: ruleName },
        }),
      );
      return;
    }
    findings.push(
      new Finding({
        ruleId,
        severity: outcome.ok ? 'pass' : severity,
        message: outcome.ok ? outcome.passMessage : outcome.failMessage,
        location: outcome.location || '',
        evidence: outcome.evidence || {},
      }),
    );
  };

  const site = safeUrl(siteUrl);
  const robots = readSiteFile(publicDir, 'robots.txt');
  const htmlFiles = listHtmlFiles(publicDir);
  const parsedUrls = urls
    .map((item) => ({ raw: item.url, parsed: safeUrl(item.url), item }))
    .filter((entry) => entry.parsed);

  // ── SM00x: site files ────────────────────────────────────────────
  evaluate('SM001', 'require_robots_txt', {
    ok: robots !== null,
    passMessage: 'robots.txt found in the published directory.',
    failMessage: `No robots.txt found under \`${publicDir}\`.`,
    location: path.join(publicDir, 'robots.txt'),
  });

  const sitemapDirective = robots ? /^\s*sitemap\s*:\s*\S+/im.test(robots) : false;
  evaluate('SM002', 'require_robots_sitemap_reference', {
    ok: sitemapDirective,
    passMessage: 'robots.txt declares at least one `Sitemap:` directive.',
    failMessage: robots
      ? 'robots.txt exists but declares no `Sitemap:` directive.'
      : 'robots.txt is absent, so no `Sitemap:` directive can be declared.',
    location: path.join(publicDir, 'robots.txt'),
    evidence: { robots_txt_present: robots !== null },
  });

  const notFound = readSiteFile(publicDir, '404.html') ?? readSiteFile(publicDir, '404/index.html');
  evaluate('SM003', 'require_404_page', {
    ok: notFound !== null,
    passMessage: 'A custom 404 page is published.',
    failMessage: `No 404.html found under \`${publicDir}\`.`,
    location: path.join(publicDir, '404.html'),
  });

  const securityTxt =
    readSiteFile(publicDir, '.well-known/security.txt') ?? readSiteFile(publicDir, 'security.txt');
  evaluate('SM004', 'require_security_txt', {
    ok: securityTxt !== null,
    passMessage: 'security.txt is published.',
    failMessage: 'No security.txt found at /.well-known/security.txt or /security.txt.',
    location: path.join(publicDir, '.well-known/security.txt'),
  });

  const humansTxt = readSiteFile(publicDir, 'humans.txt');
  evaluate('SM005', 'require_humans_txt', {
    ok: humansTxt !== null,
    passMessage: 'humans.txt is published.',
    failMessage: `No humans.txt found under \`${publicDir}\`.`,
    location: path.join(publicDir, 'humans.txt'),
  });

  // ── SM01x: URL hygiene ───────────────────────────────────────────
  const insecure = parsedUrls.filter((e) => e.parsed.protocol !== 'https:');
  evaluate('SM010', 'require_https', {
    ok: insecure.length === 0,
    passMessage: `All ${parsedUrls.length} URL(s) use HTTPS.`,
    failMessage: `${insecure.length} URL(s) do not use HTTPS.`,
    evidence: samples(insecure.map((e) => e.raw)),
  });

  const offOrigin = site ? parsedUrls.filter((e) => e.parsed.origin !== site.origin) : [];
  evaluate('SM011', 'require_same_origin', {
    ok: offOrigin.length === 0,
    passMessage: site
      ? `All URL(s) share the declared origin ${site.origin}.`
      : 'No site origin declared; origin comparison not applicable.',
    failMessage: `${offOrigin.length} URL(s) do not match the declared origin ${site?.origin}.`,
    evidence: samples(offOrigin.map((e) => e.raw)),
  });

  const duplicates = findDuplicates(parsedUrls.map((e) => e.raw));
  evaluate('SM012', 'forbid_duplicate_urls', {
    ok: duplicates.length === 0,
    passMessage: 'No duplicate URLs in the sitemap.',
    failMessage: `${duplicates.length} URL(s) appear more than once.`,
    evidence: samples(duplicates),
  });

  const queried = parsedUrls.filter((e) => e.parsed.search);
  evaluate('SM013', 'forbid_query_strings', {
    ok: queried.length === 0,
    passMessage: 'No sitemap URL carries a query string.',
    failMessage: `${queried.length} URL(s) carry a query string.`,
    evidence: samples(queried.map((e) => e.raw)),
  });

  const fragmented = parsedUrls.filter((e) => e.parsed.hash);
  evaluate('SM014', 'forbid_fragments', {
    ok: fragmented.length === 0,
    passMessage: 'No sitemap URL carries a fragment.',
    failMessage: `${fragmented.length} URL(s) carry a fragment.`,
    evidence: samples(fragmented.map((e) => e.raw)),
  });

  const slashStyles = trailingSlashStyles(parsedUrls);
  evaluate('SM015', 'consistent_trailing_slash', {
    ok: slashStyles.consistent,
    passMessage: `Trailing-slash style is consistent (${slashStyles.dominant || 'n/a'}).`,
    failMessage:
      `Mixed trailing-slash styles: ${slashStyles.withSlash} with, ` +
      `${slashStyles.withoutSlash} without.`,
    evidence: {
      with_slash: slashStyles.withSlash,
      without_slash: slashStyles.withoutSlash,
      ...samples(slashStyles.minoritySamples),
    },
  });

  const maxLength = cfg.audit.maxUrlLength;
  const overlong = parsedUrls.filter((e) => e.raw.length > maxLength);
  evaluate('SM016', 'max_url_length', {
    ok: overlong.length === 0,
    passMessage: `All URL(s) are within ${maxLength} characters.`,
    failMessage: `${overlong.length} URL(s) exceed ${maxLength} characters.`,
    evidence: { max_url_length: maxLength, ...samples(overlong.map((e) => e.raw)) },
  });

  const noindexPaths = htmlFiles.filter((file) =>
    /(^|,|\s)noindex(\s|,|$)/i.test(extractRobotsMeta(path.join(publicDir, file)) || ''),
  );
  const noindexInSitemap = matchFilesToUrls(noindexPaths, parsedUrls, site);
  evaluate('SM017', 'forbid_noindex_urls', {
    ok: noindexInSitemap.length === 0,
    passMessage: 'No noindex page is advertised in the sitemap.',
    failMessage: `${noindexInSitemap.length} noindex page(s) are advertised in the sitemap.`,
    evidence: samples(noindexInSitemap),
  });

  // ── SM02x: protocol limits ───────────────────────────────────────
  const largestChunk = Math.min(urls.length, maxUrlsPerSitemap);
  evaluate('SM020', 'url_count_limit', {
    ok: largestChunk <= maxUrlsPerSitemap,
    passMessage: `Largest sitemap holds ${largestChunk} URL(s) (limit ${maxUrlsPerSitemap}).`,
    failMessage: `A sitemap exceeds the ${maxUrlsPerSitemap} URL limit.`,
    evidence: { total_urls: urls.length, limit: maxUrlsPerSitemap },
  });

  const oversized = generatedFiles
    .map((file) => ({ file, bytes: fileSize(file) }))
    .filter(({ bytes }) => bytes !== null && bytes > maxSizeMb * 1024 * 1024);
  evaluate('SM021', 'file_size_limit', {
    ok: oversized.length === 0,
    passMessage: `All ${generatedFiles.length} generated file(s) are under ${maxSizeMb} MB.`,
    failMessage: `${oversized.length} generated file(s) exceed ${maxSizeMb} MB.`,
    evidence: { max_size_mb: maxSizeMb, ...samples(oversized.map((o) => o.file)) },
  });

  const indexRequired = chunkCount > 1;
  const indexPresent = Boolean(sitemapIndexPath) && fileSize(sitemapIndexPath) !== null;
  evaluate('SM022', 'require_sitemap_index_when_split', {
    ok: !indexRequired || indexPresent,
    passMessage: indexRequired
      ? 'Sitemap index emitted for the split sitemap set.'
      : 'Sitemap was not split; no index required.',
    failMessage: `Sitemap was split into ${chunkCount} file(s) but no sitemap index was written.`,
    location: sitemapIndexPath || path.join(sitemapOutputDir, 'sitemap-index.xml'),
    evidence: { chunk_count: chunkCount },
  });

  evaluate('SM023', 'min_url_count', {
    ok: urls.length >= cfg.audit.minUrlCount,
    passMessage: `Sitemap holds ${urls.length} URL(s) (minimum ${cfg.audit.minUrlCount}).`,
    failMessage: `Sitemap holds ${urls.length} URL(s), below the configured minimum of ${cfg.audit.minUrlCount}.`,
    evidence: { url_count: urls.length, minimum: cfg.audit.minUrlCount },
  });

  // ── SM03x: SEO metadata ──────────────────────────────────────────
  const withLastmod = urls.filter((item) => Boolean(item.lastmod)).length;
  evaluate('SM030', 'require_lastmod', {
    ok: urls.length > 0 && withLastmod === urls.length,
    passMessage: `All ${urls.length} URL(s) carry a <lastmod> value.`,
    failMessage: `${urls.length - withLastmod} of ${urls.length} URL(s) have no <lastmod> value.`,
    evidence: { with_lastmod: withLastmod, total: urls.length },
  });

  const withoutCanonical = htmlFiles.filter(
    (file) => !extractCanonicalUrl(path.join(publicDir, file)),
  );
  evaluate('SM031', 'require_canonical_coverage', {
    ok: htmlFiles.length > 0 && withoutCanonical.length === 0,
    passMessage: `All ${htmlFiles.length} HTML page(s) declare a canonical URL.`,
    failMessage: htmlFiles.length
      ? `${withoutCanonical.length} of ${htmlFiles.length} HTML page(s) declare no canonical URL.`
      : 'No HTML pages were found to assess canonical coverage.',
    evidence: samples(withoutCanonical),
  });

  return new AuditResult(findings, {
    site_url: siteUrl,
    public_dir: publicDir,
    sitemap_output_dir: sitemapOutputDir,
    url_count: urls.length,
    html_page_count: htmlFiles.length,
    chunk_count: chunkCount,
    generated_files: generatedFiles.length,
  });
}

/**
 * Decide the process exit disposition for an audit result.
 * @param {AuditResult} result - Completed audit.
 * @param {string} failOn - Either `fail` or `never`.
 * @returns {boolean} True when the run should be marked failed.
 */
function shouldFail(result, failOn) {
  if (failOn === 'never') return false;
  return result.failed.length > 0 || result.errored.length > 0;
}

function safeUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function readSiteFile(dir, relative) {
  try {
    return fs.readFileSync(path.join(dir, relative), 'utf8');
  } catch {
    return null;
  }
}

function fileSize(file) {
  try {
    return fs.statSync(file).size;
  } catch {
    return null;
  }
}

function listHtmlFiles(dir) {
  try {
    return glob.sync('**/*.{html,htm}', { cwd: dir, nodir: true, dot: false });
  } catch {
    return [];
  }
}

function findDuplicates(values) {
  const seen = new Set();
  const dupes = new Set();
  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  return [...dupes];
}

function trailingSlashStyles(entries) {
  let withSlash = 0;
  let withoutSlash = 0;
  const slashSamples = [];
  const noSlashSamples = [];

  for (const entry of entries) {
    const { pathname } = entry.parsed;
    // The site root is always "/" — it carries no style signal.
    if (pathname === '/') continue;
    // Only extension-less paths express a trailing-slash convention.
    if (/\.[a-z0-9]+$/i.test(pathname)) continue;
    if (pathname.endsWith('/')) {
      withSlash += 1;
      slashSamples.push(entry.raw);
    } else {
      withoutSlash += 1;
      noSlashSamples.push(entry.raw);
    }
  }

  const consistent = withSlash === 0 || withoutSlash === 0;
  const dominant = withSlash >= withoutSlash ? 'trailing slash' : 'no trailing slash';
  const minoritySamples = withSlash >= withoutSlash ? noSlashSamples : slashSamples;

  return { withSlash, withoutSlash, consistent, dominant, minoritySamples };
}

function matchFilesToUrls(relativeFiles, parsedUrls, site) {
  if (!site) return [];
  const inSitemap = new Set(parsedUrls.map((e) => e.parsed.pathname));
  const matched = [];
  for (const file of relativeFiles) {
    const asPath = `/${file.replace(/\\/g, '/')}`;
    const asDir = asPath.replace(/\/index\.html?$/i, '/');
    if (inSitemap.has(asPath) || inSitemap.has(asDir)) matched.push(file);
  }
  return matched;
}

function samples(values) {
  if (!values || !values.length) return {};
  return {
    samples: values.slice(0, MAX_EVIDENCE_SAMPLES),
    sample_truncated: values.length > MAX_EVIDENCE_SAMPLES,
    total: values.length,
  };
}

module.exports = {
  audit,
  shouldFail,
  MAX_EVIDENCE_SAMPLES,
};
