/**
 * Blackout Secure Sitemap Generator
 * Copyright © 2025-2026 Blackout Secure
 * SPDX-License-Identifier: Apache-2.0
 *
 * Finding model, severity semantics, and Markdown report rendering.
 *
 * Severities:
 *   pass  — control satisfied the configured policy
 *   warn  — review recommended, not a hard block on its own
 *   fail  — required control failed and should be remediated
 *   error — the audit itself could not complete for this control
 *   skip  — the control was disabled or lacked the evidence to assess
 */

const crypto = require('crypto');

const SEVERITY_ORDER = ['pass', 'skip', 'warn', 'fail', 'error'];

/**
 * Rule family display order — drives the section banners in reports.
 * Entries are `[idPrefix, header, blurb]`.
 */
const RULE_FAMILIES = Object.freeze([
  ['SM00', 'Site files', 'robots.txt, security.txt, humans.txt, and custom 404 coverage'],
  ['SM01', 'URL hygiene', 'Scheme, origin, duplicates, query strings, fragments, and length'],
  ['SM02', 'Protocol limits', 'sitemaps.org URL count, file size, and sitemap-index requirements'],
  ['SM03', 'SEO metadata', 'lastmod and canonical coverage across discovered URLs'],
]);

const RULE_TITLES = Object.freeze({
  SM001: 'robots.txt present',
  SM002: 'robots.txt references the sitemap',
  SM003: 'Custom 404 page present',
  SM004: 'security.txt published',
  SM005: 'humans.txt published',
  SM010: 'URLs use HTTPS',
  SM011: 'URLs share the declared site origin',
  SM012: 'No duplicate URLs',
  SM013: 'No query strings in sitemap URLs',
  SM014: 'No fragments in sitemap URLs',
  SM015: 'Consistent trailing-slash style',
  SM016: 'URL length within limits',
  SM017: 'No noindex pages in the sitemap',
  SM020: 'URL count within the sitemaps.org limit',
  SM021: 'Sitemap file size within the sitemaps.org limit',
  SM022: 'Sitemap index emitted when split',
  SM023: 'Sitemap contains at least the minimum URL count',
  SM030: 'lastmod coverage',
  SM031: 'Canonical coverage',
});

const RULE_HELP = Object.freeze({
  SM001: 'https://developers.google.com/search/docs/crawling-indexing/robots/intro',
  SM002: 'https://www.sitemaps.org/protocol.html#submit_robots',
  SM003: 'https://developers.google.com/search/docs/crawling-indexing/http-network-errors',
  SM004: 'https://www.rfc-editor.org/rfc/rfc9116',
  SM005: 'https://humanstxt.org/',
  SM010: 'https://developers.google.com/search/docs/crawling-indexing/https',
  SM011: 'https://www.sitemaps.org/protocol.html#location',
  SM012: 'https://www.sitemaps.org/protocol.html',
  SM013: 'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls',
  SM014: 'https://www.sitemaps.org/protocol.html#location',
  SM015: 'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls',
  SM016: 'https://www.sitemaps.org/protocol.html',
  SM017: 'https://developers.google.com/search/docs/crawling-indexing/block-indexing',
  SM020: 'https://www.sitemaps.org/protocol.html#index',
  SM021: 'https://www.sitemaps.org/protocol.html#index',
  SM022: 'https://www.sitemaps.org/protocol.html#index',
  SM023: 'https://www.sitemaps.org/protocol.html',
  SM030: 'https://www.sitemaps.org/protocol.html#xmlTagDefinitions',
  SM031: 'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls',
});

const DEFAULT_REMEDIATIONS = Object.freeze({
  SM001:
    'Publish a robots.txt at the site root so crawlers can discover crawl directives and the sitemap location.',
  SM002:
    'Add a `Sitemap: <absolute sitemap URL>` directive to robots.txt so crawlers discover the sitemap without manual submission.',
  SM003:
    'Add a custom 404.html to the published directory so unknown paths return a branded, indexable-safe error page.',
  SM004:
    'Publish /.well-known/security.txt per RFC 9116 so researchers can report vulnerabilities through a documented channel.',
  SM005: 'Publish /humans.txt to credit the team and tooling behind the site.',
  SM010:
    'Serve the site over HTTPS and set `site_url` to the https:// origin so every sitemap entry is a secure URL.',
  SM011:
    'Remove or correct the off-origin entries; sitemap URLs must live under the same host as the sitemap itself.',
  SM012:
    'De-duplicate the discovered URLs — usually caused by overlapping include patterns or canonical/link discovery emitting the same page twice.',
  SM013:
    'Strip tracking or pagination query strings from sitemap URLs, or exclude them via `exclude_urls`.',
  SM014: 'Remove URL fragments from sitemap entries; fragments are never indexed as distinct URLs.',
  SM015:
    'Pick one trailing-slash convention and normalise every URL to it so crawlers do not treat both forms as duplicates.',
  SM016:
    'Shorten the offending paths, or exclude them; overly long URLs are truncated by some crawlers.',
  SM017:
    'Remove pages carrying `<meta name="robots" content="noindex">` from the sitemap — advertising a noindex URL wastes crawl budget.',
  SM020:
    'Split the sitemap into multiple files and publish a sitemap index; a single sitemap may not exceed 50,000 URLs.',
  SM021:
    'Split the sitemap or enable gzip output; a single uncompressed sitemap may not exceed 50 MB.',
  SM022:
    'Enable sitemap-index generation so the split sitemap files are discoverable from one entry point.',
  SM023:
    'Check `public_dir`, `include_patterns`, and `exclude_patterns` — the run produced fewer URLs than the configured minimum.',
  SM030:
    'Set `lastmod_strategy` to `git` or `filemtime` so search engines can prioritise recrawling changed pages.',
  SM031:
    'Add `<link rel="canonical">` to the published HTML pages so duplicate URL forms consolidate onto one indexable URL.',
});

function defaultTitle(ruleId) {
  return RULE_TITLES[ruleId] || ruleId;
}

function defaultRemediation(ruleId, message) {
  return (
    DEFAULT_REMEDIATIONS[ruleId] ||
    message ||
    'Review the sitemap configuration and apply the recommended SEO control.'
  );
}

/** A single evidence-backed audit result. */
class Finding {
  /**
   * @param {object} options - Finding fields.
   * @param {string} options.ruleId - Stable rule identifier (e.g. `SM010`).
   * @param {string} options.severity - One of pass/warn/fail/error/skip.
   * @param {string} options.message - Evidence describing what was observed.
   * @param {string} [options.location] - URL, file path, or `(site)`.
   * @param {string} [options.title] - Human-readable control name.
   * @param {object} [options.evidence] - Machine-readable evidence payload.
   * @param {string} [options.remediation] - Recommended remediation text.
   * @param {string} [options.source] - Emitting subsystem.
   */
  constructor({
    ruleId,
    severity,
    message,
    location = '',
    title = '',
    evidence = {},
    remediation = '',
    source = 'sitemap-audit',
  }) {
    this.ruleId = ruleId;
    this.severity = severity;
    this.message = message;
    this.location = location;
    this.title = title || defaultTitle(ruleId);
    this.evidence = evidence || {};
    this.remediation = remediation || defaultRemediation(ruleId, message);
    this.remediationConfidence = 'deterministic';
    this.remediationSource = 'Blackout Secure Recommended Remediation';
    this.source = source;
    this.helpUri = RULE_HELP[ruleId] || 'https://www.sitemaps.org/protocol.html';
  }

  /** Identity that stays stable as recommendation wording changes. */
  get findingKey() {
    const identity = `${this.ruleId}|${this.location || '(site)'}`;
    const digest = crypto.createHash('sha256').update(identity, 'utf8').digest('hex').slice(0, 16);
    return `${this.ruleId.toLowerCase()}-${digest}`;
  }

  /** @returns {object} JSON-serialisable representation. */
  toJSON() {
    return {
      finding_key: this.findingKey,
      rule_id: this.ruleId,
      severity: this.severity,
      title: this.title,
      message: this.message,
      source: this.source,
      location: this.location,
      evidence: this.evidence,
      remediation: this.remediation,
      remediation_confidence: this.remediationConfidence,
      remediation_source: this.remediationSource,
      help_uri: this.helpUri,
    };
  }

  /** @returns {object} Machine-readable recommendation contract. */
  recommendation() {
    return {
      finding_key: this.findingKey,
      rule_id: this.ruleId,
      title: this.title,
      location: this.location,
      recommendation: this.remediation,
      confidence: this.remediationConfidence,
      source: this.remediationSource,
      patch_status: 'unavailable',
    };
  }
}

/** Aggregate of every finding emitted by one audit run. */
class AuditResult {
  /**
   * @param {Finding[]} [findings] - Findings in emission order.
   * @param {object} [context] - Run context echoed into reports.
   */
  constructor(findings = [], context = {}) {
    this.findings = findings;
    this.context = context;
  }

  get passed() {
    return this.findings.filter((f) => f.severity === 'pass');
  }

  get warned() {
    return this.findings.filter((f) => f.severity === 'warn');
  }

  get failed() {
    return this.findings.filter((f) => f.severity === 'fail');
  }

  get errored() {
    return this.findings.filter((f) => f.severity === 'error');
  }

  get skipped() {
    return this.findings.filter((f) => f.severity === 'skip');
  }

  /** @returns {object} Per-severity counts. */
  totals() {
    return {
      pass: this.passed.length,
      warn: this.warned.length,
      fail: this.failed.length,
      error: this.errored.length,
      skip: this.skipped.length,
    };
  }

  /** @returns {object[]} Recommendation contracts for non-pass findings. */
  recommendations() {
    return this.findings
      .filter((f) => f.severity !== 'pass' && f.remediation.trim())
      .map((f) => f.recommendation());
  }

  /** @returns {object} Full JSON report payload. */
  toJSON() {
    return {
      schema_version: 1,
      context: this.context,
      totals: this.totals(),
      verdict: verdict(this.totals())[0],
      findings: this.findings.map((f) => f.toJSON()),
      recommendations: this.recommendations(),
    };
  }

  /** @returns {string} GitHub-flavoured Markdown audit report. */
  summaryMarkdown() {
    return renderMarkdown(this);
  }
}

function verdict(totals) {
  if (totals.error) {
    return [
      'Inconclusive',
      'One or more controls could not be evaluated. Re-run after resolving the audit errors below.',
    ];
  }
  if (totals.fail) {
    return [
      'Action required',
      'At least one required sitemap/SEO control failed and should be remediated before release.',
    ];
  }
  if (totals.warn) {
    return [
      'Review recommended',
      'No blocking failures. The warnings below are worth reviewing before release.',
    ];
  }
  if (totals.pass) {
    return ['Pass', 'Every configured sitemap and SEO control satisfied its policy.'];
  }
  return ['Not assessed', 'No controls produced an assessable result for this run.'];
}

function severityLabel(severity) {
  switch (severity) {
    case 'pass':
      return '✅ Pass';
    case 'warn':
      return '⚠️ Warning';
    case 'fail':
      return '🔴 High';
    case 'error':
      return '🔥 Critical';
    default:
      return '⚪ Not Assessed';
  }
}

function mdEscape(text) {
  return String(text ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');
}

function familyFor(ruleId) {
  return RULE_FAMILIES.findIndex(([prefix]) => ruleId.startsWith(prefix));
}

function recommendedActions(totals) {
  const actions = [];
  if (totals.fail) {
    actions.push('Remediate every 🔴 High finding — these are required controls that failed.');
  }
  if (totals.error) {
    actions.push(
      'Investigate every 🔥 Critical finding — the audit could not collect evidence for those controls.',
    );
  }
  if (totals.warn) {
    actions.push(
      'Triage the ⚠️ Warning findings and either remediate them or raise their severity to `skip` in config once accepted.',
    );
  }
  if (totals.skip) {
    actions.push(
      'Review ⚪ Not Assessed controls — enable them in `sitemap.audit.rules` when they are relevant to this site.',
    );
  }
  if (!actions.length) {
    actions.push('No action required. Keep the audit wired into CI to catch regressions.');
  }
  return actions;
}

function renderMarkdown(result) {
  const totals = result.totals();
  const [headline, detail] = verdict(totals);
  const ctx = result.context || {};

  const lines = [
    '# Blackout Secure Sitemap Generator Audit Report',
    '',
    '**Provided by [Blackout Secure](https://blackoutsecure.app)**',
    '',
    '## Summary',
    '',
    `**Verdict:** ${mdEscape(headline)}`,
    '',
    detail,
    '',
    `**Totals:** ✅ ${totals.pass} pass · ⚠️ ${totals.warn} warning · ` +
      `🔴 ${totals.fail} high · 🔥 ${totals.error} critical · ` +
      `⚪ ${totals.skip} not assessed`,
    '',
    '| Severity | Count | Meaning |',
    '| -------- | ----- | ------- |',
    `| ✅ Pass | ${totals.pass} | Control satisfied the configured policy. |`,
    `| ⚠️ Warning | ${totals.warn} | Review recommended; not usually a hard block by itself. |`,
    `| 🔴 High | ${totals.fail} | Required control failed and should be remediated. |`,
    `| 🔥 Critical | ${totals.error} | Audit execution or evidence collection error. |`,
    `| ⚪ Not Assessed | ${totals.skip} | Check was skipped or lacked sufficient evidence. |`,
    '',
  ];

  if (Object.keys(ctx).length) {
    lines.push('## Run Context', '');
    lines.push('| Field | Value |', '| ----- | ----- |');
    for (const [key, value] of Object.entries(ctx)) {
      lines.push(`| ${mdEscape(key)} | ${mdEscape(value)} |`);
    }
    lines.push('');
  }

  lines.push('## Recommended Actions', '');
  for (const action of recommendedActions(totals)) {
    lines.push(`- ${action}`);
  }
  lines.push('');

  lines.push(
    '## Scope and Methodology',
    '',
    'This automated audit reviews the generated sitemap set and the published site directory against the sitemaps.org protocol and mainstream search-engine guidance. Results are evidence-based at run time and are intended to support release, SEO, and content-governance review.',
    '',
  );

  const recommendations = result.findings.filter(
    (f) => f.severity !== 'pass' && f.remediation.trim(),
  );
  lines.push(
    '## Recommendations',
    '',
    '| Finding Key | Rule | Assessment | Location | Evidence / Why | Recommended Action |',
    '| ----------- | ---- | ---------- | -------- | -------------- | ------------------ |',
  );
  if (recommendations.length) {
    for (const f of recommendations) {
      lines.push(
        `| \`${f.findingKey}\` | \`${f.ruleId}\` | ${severityLabel(f.severity)} | ` +
          `${mdEscape(f.location || '—')} | ${mdEscape(f.message)} | ${mdEscape(f.remediation)} |`,
      );
    }
  } else {
    lines.push('| — | — | — | — | — | — |');
  }
  lines.push('');

  if (!result.findings.length) {
    lines.push(
      '## Detailed Findings',
      '',
      '_No findings were emitted by the configured audit controls._',
      '',
    );
    return `${lines.join('\n')}\n`;
  }

  const buckets = new Map();
  for (const f of result.findings) {
    const idx = familyFor(f.ruleId);
    if (!buckets.has(idx)) buckets.set(idx, []);
    buckets.get(idx).push(f);
  }

  lines.push('## Detailed Findings', '');
  const emitted = [...RULE_FAMILIES.map((_, i) => i), -1];
  for (const idx of emitted) {
    const rows = buckets.get(idx);
    if (!rows || !rows.length) continue;
    const [, header, blurb] =
      idx === -1 ? ['', 'Other', 'Uncategorised controls'] : RULE_FAMILIES[idx];
    lines.push(`### ${header}`, `_${blurb}_`, '');

    const attention = rows.filter((f) => f.severity !== 'pass');
    const passed = rows.filter((f) => f.severity === 'pass');

    if (attention.length) {
      lines.push(
        '#### Findings Requiring Attention',
        '',
        '| Rule | Severity | Location | Control | Evidence | Recommended Remediation |',
        '| ---- | -------- | -------- | ------- | -------- | ----------------------- |',
      );
      for (const f of attention) {
        lines.push(
          `| \`${f.ruleId}\` | ${severityLabel(f.severity)} | ${mdEscape(f.location || '—')} | ` +
            `${mdEscape(f.title)} | ${mdEscape(f.message)} | ${mdEscape(f.remediation)} |`,
        );
      }
      lines.push('');
    }

    if (passed.length) {
      lines.push(
        '#### Passed Controls',
        '',
        '| Rule | Severity | Location | Control | Evidence |',
        '| ---- | -------- | -------- | ------- | -------- |',
      );
      for (const f of passed) {
        lines.push(
          `| \`${f.ruleId}\` | ${severityLabel(f.severity)} | ${mdEscape(f.location || '—')} | ` +
            `${mdEscape(f.title)} | ${mdEscape(f.message)} |`,
        );
      }
      lines.push('');
    }
  }

  return `${lines.join('\n')}\n`;
}

module.exports = {
  Finding,
  AuditResult,
  RULE_FAMILIES,
  RULE_TITLES,
  RULE_HELP,
  DEFAULT_REMEDIATIONS,
  SEVERITY_ORDER,
  severityLabel,
  verdict,
  mdEscape,
  familyFor,
};
