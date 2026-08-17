/**
 * Blackout Secure Sitemap Generator
 * Copyright © 2025-2026 Blackout Secure
 * SPDX-License-Identifier: Apache-2.0
 *
 * Layered configuration loader tests.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const cfgMod = require('../src/lib/config');

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bos-sitemap-config-'));
}

function write(root, relative, contents) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents, 'utf8');
  return target;
}

describe('lib/config', () => {
  const roots = [];

  afterEach(() => {
    while (roots.length) {
      fs.rmSync(roots.pop(), { recursive: true, force: true });
    }
  });

  function root() {
    const dir = tmpRoot();
    roots.push(dir);
    return dir;
  }

  it('falls back to the bundled marketplace baseline', () => {
    const cfg = cfgMod.resolve(root());
    assert.strictEqual(cfg.generate.xml, true);
    assert.strictEqual(cfg.seo.lastmodStrategy, 'git');
    assert.strictEqual(cfg.audit.failOn, 'fail');
    assert.strictEqual(cfg.audit.rules.require_https, 'warn');
    assert.deepStrictEqual(cfg.sourcePaths, ['bundled:marketplace-config.json']);
  });

  it('starts from built-in defaults when the baseline is disabled', () => {
    const cfg = cfgMod.resolve(root(), { useMarketplaceConfig: false });
    assert.deepStrictEqual(cfg.sourcePaths, []);
    assert.strictEqual(cfg.audit.maxUrlLength, 2048);
    assert.strictEqual(cfg.audit.rules.require_lastmod, 'skip');
  });

  it('discovers .github/bos-universal-config.json and merges it', () => {
    const dir = root();
    write(
      dir,
      '.github/bos-universal-config.json',
      JSON.stringify({
        sitemap: {
          owner: 'blackoutsecure',
          audit: { rules: { require_https: 'fail' } },
        },
      }),
    );

    const cfg = cfgMod.resolve(dir);
    assert.strictEqual(cfg.owner, 'blackoutsecure');
    assert.strictEqual(cfg.audit.rules.require_https, 'fail');
    // Untouched keys still come from the bundled baseline.
    assert.strictEqual(cfg.audit.rules.require_robots_txt, 'warn');
  });

  it('applies global config beneath the repository config', () => {
    const dir = root();
    write(
      dir,
      '.github/blackout-secure-sitemap-generator-global-config.yml',
      'sitemap:\n  audit:\n    rules:\n      require_https: fail\n      forbid_fragments: fail\n',
    );
    write(
      dir,
      '.bos-sitemap.yml',
      'sitemap:\n  audit:\n    rules:\n      forbid_fragments: skip\n',
    );

    const cfg = cfgMod.resolve(dir);
    assert.strictEqual(cfg.audit.rules.require_https, 'fail');
    assert.strictEqual(cfg.audit.rules.forbid_fragments, 'skip');
    assert.strictEqual(cfg.sourcePaths.length, 3);
  });

  it('honours the tri-state global config toggle', () => {
    const dir = root();
    assert.throws(() => cfgMod.resolve(dir, { useGlobalConfig: true }), cfgMod.ConfigError);
    assert.doesNotThrow(() => cfgMod.resolve(dir, { useGlobalConfig: false }));
  });

  it('accepts a bare document without the sitemap section', () => {
    const dir = root();
    write(dir, '.bos-sitemap.yml', 'audit:\n  fail_on: never\n');
    assert.strictEqual(cfgMod.resolve(dir).audit.failOn, 'never');
  });

  it('defaults project_name to the repository name', () => {
    const cfg = cfgMod.resolve(root(), { repoName: 'bos-sitemap-generator' });
    assert.strictEqual(cfg.projectName, 'bos-sitemap-generator');
  });

  it('rejects an unknown audit rule', () => {
    const dir = root();
    write(dir, '.bos-sitemap.yml', 'audit:\n  rules:\n    require_unicorns: warn\n');
    assert.throws(() => cfgMod.resolve(dir), /unknown rule/);
  });

  it('rejects an invalid severity', () => {
    const dir = root();
    write(dir, '.bos-sitemap.yml', 'audit:\n  rules:\n    require_https: explode\n');
    assert.throws(() => cfgMod.resolve(dir), /is not one of/);
  });

  it('rejects an invalid lastmod strategy', () => {
    const dir = root();
    write(dir, '.bos-sitemap.yml', 'seo:\n  lastmod_strategy: vibes\n');
    assert.throws(() => cfgMod.resolve(dir), /seo\.lastmod_strategy/);
  });

  it('rejects an out-of-range priority', () => {
    const dir = root();
    write(dir, '.bos-sitemap.yml', 'seo:\n  priority: 1.5\n');
    assert.throws(() => cfgMod.resolve(dir), /seo\.priority/);
  });

  it('rejects a non-xml sitemap filename', () => {
    const dir = root();
    write(dir, '.bos-sitemap.yml', 'generate:\n  sitemap_filename: sitemap.txt\n');
    assert.throws(() => cfgMod.resolve(dir), /must end in \.xml/);
  });

  it('rejects a non-mapping top level document', () => {
    const dir = root();
    write(dir, '.bos-sitemap.yml', '- one\n- two\n');
    assert.throws(() => cfgMod.resolve(dir), /top-level must be a mapping/);
  });

  it('raises for a missing explicit config path', () => {
    assert.throws(() => cfgMod.resolve(root(), { configPath: 'nope.yml' }), /config not found/);
  });

  it('deep merges nested mappings and replaces lists', () => {
    const merged = cfgMod.deepMerge(
      { a: { b: 1, c: 2 }, list: [1, 2] },
      { a: { c: 3 }, list: [9] },
    );
    assert.deepStrictEqual(merged, { a: { b: 1, c: 3 }, list: [9] });
  });

  it('exposes a severity for every known rule', () => {
    const cfg = cfgMod.resolve(root());
    for (const name of Object.keys(cfgMod.RULE_DEFAULTS)) {
      assert.ok(
        cfgMod.SEVERITIES.includes(cfg.audit.rules[name]),
        `${name} resolved to a valid severity`,
      );
    }
  });
});
