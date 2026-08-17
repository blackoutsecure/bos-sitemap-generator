/**
 * Blackout Secure Sitemap Generator
 * Copyright © 2025-2026 Blackout Secure
 * SPDX-License-Identifier: Apache-2.0
 *
 * AI provider detection, summarization, and deterministic fallback tests.
 */

const assert = require('assert');

const aiMod = require('../src/lib/ai');
const { Finding, AuditResult } = require('../src/lib/findings');
const { packageMetadata } = require('../src/lib/metadata');

function result(severities = ['fail', 'warn']) {
  return new AuditResult(
    severities.map(
      (severity, index) =>
        new Finding({
          ruleId: `SM01${index}`,
          severity,
          message: `finding ${index}`,
        }),
    ),
  );
}

describe('lib/ai', () => {
  it('selects GitHub Models when a token is exposed', () => {
    const provider = aiMod.detectProvider('auto', {
      GITHUB_TOKEN: 'ghs_example',
    });
    assert.strictEqual(provider.name, 'github-models');
    assert.strictEqual(provider.endpoint, aiMod.GITHUB_MODELS_ENDPOINT);
    assert.strictEqual(provider.model, 'openai/gpt-4o-mini');
  });

  it('prefers the dedicated models token and model overrides', () => {
    const provider = aiMod.detectProvider('github', {
      GITHUB_TOKEN: 'ghs_ignored',
      GITHUB_MODELS_TOKEN: 'ghs_preferred',
      GITHUB_MODELS_MODEL_SITEMAP: 'openai/gpt-4.1-mini',
    });
    assert.strictEqual(provider.token, 'ghs_preferred');
    assert.strictEqual(provider.model, 'openai/gpt-4.1-mini');
  });

  it('returns null when no credentials are present', () => {
    assert.strictEqual(aiMod.detectProvider('auto', {}), null);
  });

  it('returns null for explicitly disabled providers', () => {
    for (const name of ['none', 'disabled', 'false', 'off']) {
      assert.strictEqual(
        aiMod.detectProvider(name, { GITHUB_TOKEN: 'ghs_example' }),
        null,
        `${name} disables AI`,
      );
    }
  });

  it('requires both a key and an endpoint for external providers', () => {
    assert.strictEqual(aiMod.detectProvider('acme', { ACME_API_KEY: 'k' }), null);
    const provider = aiMod.detectProvider('acme', {
      ACME_API_KEY: 'k',
      ACME_API_ENDPOINT: 'https://acme.test/v1/chat',
      ACME_MODEL: 'acme-small',
    });
    assert.strictEqual(provider.name, 'acme');
    assert.strictEqual(provider.model, 'acme-small');
  });

  it('rejects non-HTTPS provider endpoints', () => {
    assert.strictEqual(
      aiMod.detectProvider('acme', {
        ACME_API_KEY: 'k',
        ACME_API_ENDPOINT: 'http://acme.test/v1/chat',
      }),
      null,
    );
  });

  it('produces a factual local summary', () => {
    const text = aiMod.localSummary(result());
    assert.match(text, /1 high, 1 warning/);
    assert.strictEqual(text.split('\n').length, 3);
  });

  it('reports a clean run in the local summary', () => {
    const text = aiMod.localSummary(result(['pass', 'pass']));
    assert.match(text, /No sitemap or SEO control requires attention/);
  });

  it('truncates long local summaries with a tail count', () => {
    const text = aiMod.localSummary(result(['fail', 'warn', 'warn', 'warn']));
    assert.match(text, /2 further finding\(s\)/);
  });

  it('falls back to the local summary when no provider is available', async () => {
    const summary = await aiMod.buildSummary(
      result(),
      {
        enableAiFindingsSummary: true,
        aiFindingsSummaryProvider: 'auto',
        localHeuristicFallback: true,
      },
      { environ: {} },
    );
    assert.strictEqual(summary.provider, 'local-heuristic');
    assert.ok(summary.text);
  });

  it('returns an empty summary when both AI and fallback are disabled', async () => {
    const summary = await aiMod.buildSummary(result(), {
      enableAiFindingsSummary: false,
      aiFindingsSummaryProvider: 'auto',
      localHeuristicFallback: false,
    });
    assert.strictEqual(summary.text, '');
    assert.strictEqual(summary.provider, 'disabled');
  });

  it('uses the local summary when AI is disabled but fallback is on', async () => {
    const summary = await aiMod.buildSummary(result(), {
      enableAiFindingsSummary: false,
      aiFindingsSummaryProvider: 'auto',
      localHeuristicFallback: true,
    });
    assert.strictEqual(summary.provider, 'local-heuristic');
  });

  it('treats a transport failure as ordinary unavailability', async () => {
    const summary = await aiMod.summarize([], {
      name: 'acme',
      endpoint: 'http://127.0.0.1:1/unreachable',
      model: 'x',
      token: 'k',
    });
    assert.strictEqual(summary, null);
  });

  it('never throws for a null provider', async () => {
    assert.strictEqual(await aiMod.summarize([], null), null);
  });
});

describe('lib/metadata', () => {
  it('reports package identity from package.json', () => {
    const pkg = packageMetadata();
    assert.strictEqual(pkg.name, 'bos-sitemap-generator');
    assert.match(pkg.version, /^\d+\.\d+\.\d+/);
    assert.ok(pkg.author);
    assert.ok(pkg.description);
  });
});
