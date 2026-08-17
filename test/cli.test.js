/**
 * Blackout Secure Sitemap Generator
 * Copyright © 2025-2026 Blackout Secure
 * SPDX-License-Identifier: Apache-2.0
 *
 * CLI argument parsing and subcommand tests.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { main, parseArgs } = require('../src/cli');
const sarifMod = require('../src/lib/sarif');
const { Finding } = require('../src/lib/findings');

function capture() {
  const chunks = { out: '', err: '' };
  const stdout = process.stdout.write.bind(process.stdout);
  const stderr = process.stderr.write.bind(process.stderr);
  process.stdout.write = (text) => {
    chunks.out += text;
    return true;
  };
  process.stderr.write = (text) => {
    chunks.err += text;
    return true;
  };
  return {
    chunks,
    restore: () => {
      process.stdout.write = stdout;
      process.stderr.write = stderr;
    },
  };
}

async function run(argv) {
  const { chunks, restore } = capture();
  try {
    const code = await main(argv);
    return { code, ...chunks };
  } finally {
    restore();
  }
}

describe('cli/parseArgs', () => {
  it('parses the command, flags, and repeated inputs', () => {
    const parsed = parseArgs([
      'sarif',
      '--input',
      'a.sarif',
      '--input',
      'b.sarif',
      '--output',
      'merged.sarif',
    ]);
    assert.strictEqual(parsed.command, 'sarif');
    assert.deepStrictEqual(parsed.repeated.input, ['a.sarif', 'b.sarif']);
    assert.strictEqual(parsed.flags.output, 'merged.sarif');
  });

  it('camel-cases multi-word flags', () => {
    const parsed = parseArgs(['audit', '--site-url', 'https://example.com']);
    assert.strictEqual(parsed.flags.siteUrl, 'https://example.com');
  });

  it('handles the tri-state global config switches', () => {
    assert.strictEqual(parseArgs(['validate', '--use-global-config']).flags.useGlobalConfig, true);
    assert.strictEqual(parseArgs(['validate', '--no-global-config']).flags.useGlobalConfig, false);
    assert.strictEqual(parseArgs(['validate']).flags.useGlobalConfig, undefined);
  });

  it('rejects a flag with a missing value', () => {
    assert.throws(() => parseArgs(['audit', '--site-url']), /requires a value/);
  });
});

describe('cli/main', () => {
  it('prints the package version', async () => {
    const { code, out } = await run(['version']);
    assert.strictEqual(code, 0);
    assert.match(out.trim(), /^\d+\.\d+\.\d+/);
  });

  it('prints usage with no command', async () => {
    const { code, out } = await run([]);
    assert.strictEqual(code, 0);
    assert.match(out, /bos-sitemap <command>/);
  });

  it('rejects an unknown command', async () => {
    const { code, err } = await run(['teleport']);
    assert.strictEqual(code, 2);
    assert.match(err, /unknown command/);
  });

  it('validates and prints the resolved configuration cascade', async () => {
    const { code, out } = await run(['validate']);
    assert.strictEqual(code, 0);
    assert.match(out, /Package metadata:/);
    assert.match(out, /bundled:marketplace-config\.json/);
    assert.match(out, /audit rules:/);
    assert.match(out, /require_https/);
  });

  it('surfaces a config error as exit code 2', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bos-sitemap-cli-'));
    try {
      fs.writeFileSync(path.join(dir, 'bad.yml'), 'audit:\n  fail_on: sometimes\n', 'utf8');
      const { code, err } = await run(['validate', '--root', dir, '--config', 'bad.yml']);
      assert.strictEqual(code, 2);
      assert.match(err, /audit\.fail_on/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('requires --site-url for the audit command', async () => {
    const { code, err } = await run(['audit']);
    assert.strictEqual(code, 2);
    assert.match(err, /--site-url is required/);
  });

  it('reports a missing public dir', async () => {
    const { code, err } = await run([
      'audit',
      '--site-url',
      'https://example.com',
      '--public-dir',
      'definitely-not-here',
    ]);
    assert.strictEqual(code, 2);
    assert.match(err, /public dir not found/);
  });

  it('merges SARIF inputs and skips missing files', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bos-sitemap-cli-'));
    try {
      const input = path.join(dir, 'a.sarif');
      sarifMod.dump(
        sarifMod.merge({
          runs: [
            sarifMod.auditRun([
              new Finding({
                ruleId: 'SM010',
                severity: 'warn',
                message: 'example',
              }),
            ]),
          ],
        }),
        input,
      );

      const output = path.join(dir, 'merged.sarif');
      const { code, err } = await run([
        'sarif',
        '--input',
        input,
        '--input',
        path.join(dir, 'missing.sarif'),
        '--output',
        output,
      ]);
      assert.strictEqual(code, 0);
      assert.match(err, /skipping missing SARIF input/);
      assert.strictEqual(sarifMod.load(output).runs.length, 1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('requires --output for the sarif command', async () => {
    const { code, err } = await run(['sarif']);
    assert.strictEqual(code, 2);
    assert.match(err, /--output is required/);
  });
});
