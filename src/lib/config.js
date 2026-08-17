/**
 * Blackout Secure Sitemap Generator
 * Copyright © 2025-2026 Blackout Secure
 * SPDX-License-Identifier: Apache-2.0
 *
 * Layered configuration loader, schema, and defaults.
 *
 * This module is the single source of truth for what knobs the generator
 * exposes and what their defaults are. Configuration is deep-merged in
 * marketplace, global, then repository order before schema validation.
 *
 * Design notes:
 *   * Defaults are conservative — no audit rule defaults to `fail`, so
 *     first-time adopters see findings without breaking their pipeline.
 *   * Unknown top-level keys are NOT an error (forward-compat with other
 *     BOS kits that share `.github/bos-universal-config.json`).
 *   * Validation throws `ConfigError` with the offending key path.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/** Raised when a config file parses but is semantically invalid. */
class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

const SEVERITIES = ['fail', 'warn', 'skip'];
const FAIL_ON_LEVELS = ['fail', 'never'];
const LASTMOD_STRATEGIES = ['git', 'filemtime', 'current', 'none'];
const CHANGEFREQS = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'];

const CONFIG_SECTION = 'sitemap';
const MARKETPLACE_CONFIG_FILE = 'marketplace-config.json';
const DEFAULT_GLOBAL_CONFIG_PATH = '.github/blackout-secure-sitemap-generator-global-config.yml';

const DEFAULT_CONFIG_PATHS = [
  '.github/bos-universal-config.json',
  '.github/bos-universal-config.yml',
  '.github/bos-universal-config.yaml',
  'bos-universal-config.json',
  'bos-universal-config.yml',
  'bos-universal-config.yaml',
  '.bos-sitemap.yml',
  '.bos-sitemap.yaml',
  'bos-sitemap.yml',
];

/** Every audit rule the kit knows about, with its baseline severity. */
const RULE_DEFAULTS = Object.freeze({
  require_robots_txt: 'warn',
  require_robots_sitemap_reference: 'warn',
  require_404_page: 'skip',
  require_security_txt: 'skip',
  require_humans_txt: 'skip',
  require_https: 'warn',
  require_same_origin: 'warn',
  forbid_duplicate_urls: 'warn',
  forbid_query_strings: 'warn',
  forbid_fragments: 'warn',
  consistent_trailing_slash: 'warn',
  max_url_length: 'warn',
  forbid_noindex_urls: 'warn',
  url_count_limit: 'warn',
  file_size_limit: 'warn',
  require_sitemap_index_when_split: 'warn',
  require_lastmod: 'skip',
  require_canonical_coverage: 'skip',
  min_url_count: 'warn',
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Discovery / resolution
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Find the preferred repository config file.
 * @param {string} cwd - Repository root.
 * @returns {string|null} Absolute path, or null when absent.
 */
function discover(cwd) {
  for (const relative of DEFAULT_CONFIG_PATHS) {
    const candidate = path.resolve(cwd, relative);
    if (isFile(candidate)) return candidate;
  }
  return null;
}

/**
 * Resolve the marketplace, optional global, and repository config tiers.
 *
 * `useGlobalConfig` is tri-state: `null`/`undefined` auto-loads the
 * conventional path when present, `true` requires it, `false` disables it.
 *
 * @param {string} root - Repository root.
 * @param {object} [options] - Resolution options.
 * @param {string} [options.configPath] - Explicit repository config path.
 * @param {string} [options.globalConfigPath] - Global config path.
 * @param {boolean|null} [options.useGlobalConfig] - Tri-state global toggle.
 * @param {boolean} [options.useMarketplaceConfig] - Apply bundled baseline.
 * @param {string} [options.repoName] - Fallback for `project_name`.
 * @returns {object} Resolved config.
 */
function resolve(root, options = {}) {
  const {
    configPath = '',
    globalConfigPath = DEFAULT_GLOBAL_CONFIG_PATH,
    useGlobalConfig = null,
    useMarketplaceConfig = true,
    repoName = '',
  } = options;

  const resolvedRoot = path.resolve(root || '.');

  let repoPath = null;
  if (configPath) {
    repoPath = fromRoot(resolvedRoot, configPath);
    if (!isFile(repoPath)) {
      throw new ConfigError(`config not found: ${repoPath}`);
    }
  } else {
    repoPath = discover(resolvedRoot);
  }

  let globalPath = null;
  if (useGlobalConfig !== false) {
    const candidate = fromRoot(resolvedRoot, globalConfigPath || DEFAULT_GLOBAL_CONFIG_PATH);
    if (isFile(candidate)) {
      globalPath = candidate;
    } else if (useGlobalConfig === true) {
      throw new ConfigError(`global config not found: ${candidate}`);
    }
  }

  return load(repoPath, { globalPath, useMarketplaceConfig, repoName });
}

/**
 * Load and merge the bundled marketplace, global, and repository tiers.
 * @param {string|null} configPath - Repository config path.
 * @param {object} [options] - Load options.
 * @param {string|null} [options.globalPath] - Global config path.
 * @param {boolean} [options.useMarketplaceConfig] - Apply bundled baseline.
 * @param {string} [options.repoName] - Fallback for `project_name`.
 * @returns {object} Resolved config.
 */
function load(configPath, options = {}) {
  const { globalPath = null, useMarketplaceConfig = true, repoName = '' } = options;

  let merged = {};
  const sourcePaths = [];

  if (useMarketplaceConfig) {
    merged = loadMarketplaceSection();
    sourcePaths.push(`bundled:${MARKETPLACE_CONFIG_FILE}`);
  }

  if (globalPath) {
    merged = deepMerge(merged, loadSection(globalPath));
    sourcePaths.push(globalPath);
  }

  if (configPath) {
    merged = deepMerge(merged, loadSection(configPath));
    sourcePaths.push(configPath);
  }

  return fromObject(merged, {
    sourcePath: configPath || globalPath || '',
    sourcePaths,
    repoName,
  });
}

function fromRoot(root, candidate) {
  return path.isAbsolute(candidate) ? candidate : path.resolve(root, candidate);
}

function isFile(candidate) {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function loadMarketplaceSection() {
  let doc;
  try {
    // Required (not read from disk) so `ncc` inlines the baseline into the
    // bundled `dist/index.js` instead of resolving a path at runtime.
    doc = require('../marketplace-config.json');
  } catch (err) {
    throw new ConfigError(`failed to load marketplace config: ${err.message}`);
  }
  if (!isPlainObject(doc)) {
    throw new ConfigError(`bundled:${MARKETPLACE_CONFIG_FILE}: top-level must be a mapping`);
  }
  const section = Object.prototype.hasOwnProperty.call(doc, CONFIG_SECTION)
    ? doc[CONFIG_SECTION]
    : doc;
  if (!isPlainObject(section)) {
    throw new ConfigError(
      `bundled:${MARKETPLACE_CONFIG_FILE}: \`${CONFIG_SECTION}\` must be a mapping`,
    );
  }
  // Clone so a caller mutating the resolved config cannot poison the
  // module-level require cache for subsequent resolutions.
  return structuredClone(section);
}

function loadSection(filePath) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new ConfigError(`config not found: ${filePath}`);
    }
    throw new ConfigError(`failed to read config ${filePath}: ${err.message}`);
  }
  return parseDocument(text, filePath);
}

/**
 * Parse YAML/JSON and extract the optional `sitemap` section.
 * @param {string} text - File contents.
 * @param {string} source - Human-readable source label.
 * @returns {object} The extracted section.
 */
function parseDocument(text, source) {
  let doc;
  try {
    doc = yaml.load(text) || {};
  } catch (err) {
    throw new ConfigError(`invalid YAML/JSON in ${source}: ${err.message}`);
  }
  if (!isPlainObject(doc)) {
    throw new ConfigError(`${source}: top-level must be a mapping`);
  }
  const section = Object.prototype.hasOwnProperty.call(doc, CONFIG_SECTION)
    ? doc[CONFIG_SECTION]
    : doc;
  if (!isPlainObject(section)) {
    throw new ConfigError(`${source}: \`${CONFIG_SECTION}\` must be a mapping`);
  }
  return section;
}

/**
 * Recursively merge mappings; lists and scalars are replaced wholesale.
 * @param {object} base - Lower-precedence mapping.
 * @param {object} override - Higher-precedence mapping.
 * @returns {object} Merged mapping.
 */
function deepMerge(base, override) {
  const merged = { ...base };
  for (const [key, value] of Object.entries(override || {})) {
    const current = merged[key];
    merged[key] =
      isPlainObject(current) && isPlainObject(value) ? deepMerge(current, value) : value;
  }
  return merged;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Schema
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function fromObject(doc, { sourcePath = '', sourcePaths = [], repoName = '' }) {
  const owner = readString(doc, 'owner');
  const email = readString(doc, 'email');
  const projectName = readString(doc, 'project_name') || repoName;

  return Object.freeze({
    owner,
    projectName,
    email,
    generate: generateFromObject(readMapping(doc, 'generate')),
    discovery: discoveryFromObject(readMapping(doc, 'discovery')),
    seo: seoFromObject(readMapping(doc, 'seo')),
    audit: auditFromObject(readMapping(doc, 'audit')),
    reporting: reportingFromObject(readMapping(doc, 'reporting')),
    remediation: remediationFromObject(readMapping(doc, 'remediation')),
    sourcePath,
    sourcePaths: Object.freeze([...sourcePaths]),
  });
}

function generateFromObject(d) {
  const filename = readString(d, 'sitemap_filename', 'sitemap.xml');
  if (!/\.xml$/i.test(filename)) {
    throw new ConfigError(
      `generate.sitemap_filename: '${filename}' must end in .xml (sitemaps.org protocol)`,
    );
  }
  return Object.freeze({
    xml: readBool(d, 'xml', true),
    txt: readBool(d, 'txt', true),
    gzip: readBool(d, 'gzip', true),
    sitemapFilename: filename,
  });
}

function discoveryFromObject(d) {
  return Object.freeze({
    parseCanonical: readBool(d, 'parse_canonical', true),
    discoverLinks: readBool(d, 'discover_links', true),
    includePatterns: readStringList(d, 'include_patterns'),
    excludePatterns: readStringList(d, 'exclude_patterns'),
    excludeUrls: readStringList(d, 'exclude_urls'),
    excludeExtensions: Object.freeze(
      readStringList(d, 'exclude_extensions').map((ext) =>
        ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`,
      ),
    ),
    additionalUrls: readStringList(d, 'additional_urls'),
  });
}

function seoFromObject(d) {
  const strategy = readString(d, 'lastmod_strategy', 'git');
  if (!LASTMOD_STRATEGIES.includes(strategy)) {
    throw new ConfigError(
      `seo.lastmod_strategy: '${strategy}' is not one of ${LASTMOD_STRATEGIES.join(', ')}`,
    );
  }

  const changefreq = readString(d, 'changefreq');
  if (changefreq && !CHANGEFREQS.includes(changefreq)) {
    throw new ConfigError(
      `seo.changefreq: '${changefreq}' is not one of ${CHANGEFREQS.join(', ')}`,
    );
  }

  const rawPriority = d.priority;
  let priority = '';
  if (rawPriority !== undefined && rawPriority !== null && rawPriority !== '') {
    const numeric = Number(rawPriority);
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) {
      throw new ConfigError(`seo.priority: '${rawPriority}' must be a number between 0.0 and 1.0`);
    }
    priority = String(rawPriority);
  }

  return Object.freeze({
    lastmodStrategy: strategy,
    changefreq,
    priority,
  });
}

function auditFromObject(d) {
  const failOn = readString(d, 'fail_on', 'fail');
  if (!FAIL_ON_LEVELS.includes(failOn)) {
    throw new ConfigError(`audit.fail_on: '${failOn}' is not one of ${FAIL_ON_LEVELS.join(', ')}`);
  }

  const rawRules = readMapping(d, 'rules');
  const rules = {};
  for (const [name, fallback] of Object.entries(RULE_DEFAULTS)) {
    rules[name] = readSeverity(rawRules, name, fallback, 'audit.rules');
  }
  for (const name of Object.keys(rawRules)) {
    if (!(name in RULE_DEFAULTS)) {
      throw new ConfigError(`audit.rules.${name}: unknown rule`);
    }
  }

  return Object.freeze({
    enable: readBool(d, 'enable', true),
    failOn,
    maxUrlLength: readPositiveInt(d, 'max_url_length', 2048),
    minUrlCount: readNonNegativeInt(d, 'min_url_count', 1),
    rules: Object.freeze(rules),
  });
}

function reportingFromObject(d) {
  return Object.freeze({
    stepSummary: readBool(d, 'step_summary', true),
    sarif: readBool(d, 'sarif', true),
    jsonReport: readBool(d, 'json_report', true),
    recommendations: readBool(d, 'recommendations', true),
  });
}

function remediationFromObject(d) {
  return Object.freeze({
    enableAiFindingsSummary: readBool(d, 'enable_ai_findings_summary', true),
    aiFindingsSummaryProvider: readString(d, 'ai_findings_summary_provider', 'auto'),
    localHeuristicFallback: readBool(d, 'local_heuristic_fallback', true),
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Typed accessors
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function readMapping(d, key) {
  const value = d[key];
  if (value === undefined || value === null) return {};
  if (!isPlainObject(value)) {
    throw new ConfigError(`\`${key}\`: must be a mapping`);
  }
  return value;
}

function readString(d, key, fallback = '') {
  const value = d[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string') {
    throw new ConfigError(`\`${key}\`: must be a string`);
  }
  return value.trim();
}

function readBool(d, key, fallback) {
  const value = d[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'boolean') {
    throw new ConfigError(`\`${key}\`: must be a boolean (true/false)`);
  }
  return value;
}

function readStringList(d, key) {
  const value = d[key];
  if (value === undefined || value === null) return Object.freeze([]);
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    throw new ConfigError(`\`${key}\`: must be a list of strings`);
  }
  return Object.freeze(value.map((v) => v.trim()).filter(Boolean));
}

function readSeverity(d, key, fallback, prefix) {
  const value = d[key];
  if (value === undefined || value === null) return fallback;
  if (!SEVERITIES.includes(value)) {
    throw new ConfigError(`${prefix}.${key}: '${value}' is not one of ${SEVERITIES.join(', ')}`);
  }
  return value;
}

function readPositiveInt(d, key, fallback) {
  const value = readNonNegativeInt(d, key, fallback);
  if (value === 0) {
    throw new ConfigError(`\`${key}\`: must be a positive integer`);
  }
  return value;
}

function readNonNegativeInt(d, key, fallback) {
  const value = d[key];
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || value < 0) {
    throw new ConfigError(`\`${key}\`: must be a non-negative integer`);
  }
  return value;
}

module.exports = {
  ConfigError,
  SEVERITIES,
  FAIL_ON_LEVELS,
  LASTMOD_STRATEGIES,
  CHANGEFREQS,
  CONFIG_SECTION,
  MARKETPLACE_CONFIG_FILE,
  DEFAULT_GLOBAL_CONFIG_PATH,
  DEFAULT_CONFIG_PATHS,
  RULE_DEFAULTS,
  discover,
  resolve,
  load,
  deepMerge,
};
