# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## What this is

`bos-sitemap-generator` is a GitHub Marketplace Action that walks a built static site,
discovers URLs, and writes standards-compliant sitemaps: `sitemap.xml`, a plain-text
`sitemap.txt`, gzip companions (`*.xml.gz`), and a `sitemap-index.xml` when the URL count
exceeds the 50,000-URL sitemaps.org ceiling. After generation it runs a deterministic
sitemap/SEO posture audit (rule IDs `SM001`-`SM031`) and emits a Markdown step summary,
SARIF 2.1.0 for code scanning, a JSON report, a recommendations sidecar, and a skips
sidecar. The same modules back a local CLI, `bos-sitemap` (`src/cli.js`), with `version`,
`validate`, `audit`, and `sarif` subcommands.

The verified in-org consumer is `bos-automation-hub`, whose
`.github/workflows/deploy-cloudflare-pages.yml` pins this action by commit SHA
(`blackoutsecure/bos-sitemap-generator@fee1be2a6770cd2ee4b6424ccb67ab1ff6bf554a # v1.0.2`)
behind an `inputs.generate_sitemap` gate. That workflow sparse-checks out
`sync-files/config/sitemap-generator-global-config.json` from the hub and passes it as
`global_config_path`, so the hub file is the real org-tier default source. The hub also
references this action from `.github/actions/cf-pages-headers-generate/action.yml`.

Stack: Node.js, CommonJS throughout. `action.yml` declares `runs.using: node20` with
`main: dist/index.js`; `package.json` sets `engines.node: ">=20"`. Runtime dependencies are
`@actions/core ^1.11.1`, `@actions/artifact ^2.1.2`, `glob ^10.3.10`, `js-yaml ^4.3.1`,
`node-html-parser ^6.1.12`, and `sitemap ^8.0.0`. Tooling: Mocha `^10.8.2` (with
`chai ^4.5.0` and `nyc ^17.1.0`), ESLint `^9.12.0` flat config, Prettier `^3.3.3`, and
`@vercel/ncc ^0.38.1` as the bundler. Package version `0.1.0`, `private: true`, Apache-2.0.

## Commands

```bash
npm ci                       # install from the committed package-lock.json

npm run build                # ncc build src/index.js -o dist  -> dist/index.js
npm test                     # mocha; `pretest` rebuilds dist/ first
npx mocha test/config.test.js        # one file (skips the pretest rebuild)
npx mocha test/unit/utils.test.js

npx eslint .                 # lint, read-only
npm run lint                 # eslint . --fix (writes)
npx prettier --check "**/*.{js,json,md}"
npm run format               # prettier --write (writes)

npm run check                # eslint . && prettier --check && npm test
npm run coverage             # nyc html + text
npm run clean                # node test/cli.js clean — remove generated sitemaps
npm run cli -- validate --root .     # local config cascade dry-run
```

## Validating changes

The only workflow file in this repository is the hub-distributed
`.github/workflows/bos-universal-gatekeeper-kicker.yml`. It is the single dispatch front
door: `authorize`, `resolve-target-ref`, `sync-check-dev` / `sync-check-main`,
`parse-config`, `preflight`, then one of `action-test`, `metadata`,
`marketplace-validate`, `marketplace-release`, `release-dev`, or `release-main`, each
routed to a reusable workflow in `bos-automation-hub`. Pushes and pull requests are gated
by the hub's reusable `bos-universal-security.yml`, reported as one required check.

Locally, narrowest first: run the single Mocha file for the module you touched, then
`npx eslint .`, then `npx prettier --check "**/*.{js,json,md}"`, then the whole suite via
`npm test`. Finish with the bundle check — run `npm run build` and confirm
`git status --short dist/index.js` is clean, or stage the rebuilt bundle if it changed.
`npm run check` runs lint, format check, and tests in one shot but does not by itself
prove `dist/` is committed in sync.

`test/` uses the repository's own `dist/` directory as the fixture site
(`test/test-config.js` sets `PUBLIC_DIR: 'dist'`), so the committed `dist/*.html`,
`dist/*.xml`, and `dist/*.txt` files are test inputs, not build output. Generated
`dist/sitemap*` files are gitignored; do not commit them.

## Architecture

```text
action.yml                     Manifest: node20, main dist/index.js, 45 inputs, 15 outputs
package.json                   Scripts, deps, engines.node >=20, bin bos-sitemap -> src/cli.js
src/index.js                   Action entrypoint: inputs, config cascade, generation, audit, outputs
src/cli.js                     bos-sitemap CLI: version | validate | audit | sarif
src/marketplace-config.json    Bundled tier-1 baseline under the `sitemap` key
src/lib/config.js              Config discovery, deep merge, schema validation, ConfigError
src/lib/utils.js               normalizeUrl, findPublicDir, inferSiteUrl, git lastmod, size format
src/lib/url-builder.js         glob scan, canonical parsing, link discovery, dedupe, exclude, sort
src/lib/html-parser.js         extractCanonicalUrl, discoverInternalLinks, extractRobotsMeta
src/lib/sitemap-writer.js      writeSitemapXml/Txt/Gzip/SitemapIndex via the `sitemap` package
src/lib/sitemap-validator.js   XML/TXT/index validation for generated and external sitemaps
src/lib/audit.js               SM001-SM031 posture audit driven by sitemap.audit.rules
src/lib/findings.js            Finding + AuditResult model, severities, titles, help, remediation
src/lib/report.js              Console table, annotations, step summary, JSON/recs/skips
src/lib/sarif.js               SARIF 2.1.0 auditRun/merge/load/dump
src/lib/ai.js                  Optional findings summary; deterministic local fallback
src/lib/metadata.js            Package identity; project-config.js holds branding + XML header
dist/index.js                  Committed ncc bundle — build output, never hand-edited
dist/*.html|*.xml|*.txt        Committed test fixtures used as the sample published site
test/*.test.js, test/unit/     Mocha specs; action-level tests drive the real entrypoint
test/test-config.js            Shared TEST_CONFIG; test-helpers.js does INPUT_* env plumbing
test/cli.js                    Dev helper: clean | build | run | verify | coverage
.mocharc.json                  spec test/**/*.test.js, timeout 20000
.github/bos-universal-config.json  Repo-owned gate, marketplace allowlist, repo_metadata
```

Generation flow. `src/index.js` calls `cfgMod.resolve()` before anything else. Config
precedence, lowest first: the bundled `src/marketplace-config.json`
(`use_marketplace_config`, default `true`, `require`d so `ncc` inlines it); the org global
config at `global_config_path`, default
`.github/blackout-secure-sitemap-generator-global-config.yml`, with tri-state
`use_global_config` (`auto` loads when present, `true` requires it, `false` disables); then
the repository config from `config_path` or auto-discovery over `DEFAULT_CONFIG_PATHS`
(`.github/bos-universal-config.json` first, `.bos-sitemap.yml` last). Each tier reads the
optional `sitemap` section, mappings deep-merge, lists and scalars replace, unknown
top-level keys are ignored so sibling BOS kits can share one universal config, and applied
tiers are echoed to the `config_sources` output. Action inputs sit above all of it: an
empty input means "inherit from the cascade".

Optional auto-detection (`allow_autodetect`) then fills `public_dir` from
`dist`/`build`/`out`/`public`/`website`/`static` and `site_url` from a `CNAME` file or the
`GITHUB_REPOSITORY` GitHub Pages convention. `buildUrls()` globs `include_patterns` under
`public_dir` minus `exclude_patterns`, resolves `<link rel="canonical">` when
`parse_canonical` is on, follows internal `<a href>` targets when `discover_links` is on
(capped at 10,000 discovered links and 100,000 total URLs), attaches `lastmod` from the
`lastmod_strategy` (`git` | `filemtime` | `current` | `none`), merges `additional_urls`,
dedupes, applies `exclude_urls` wildcards, and sorts by URL for stable output.
`src/lib/sitemap-writer.js` writes one pretty-printed `sitemap.xml` under the 50,000-URL
chunk limit, or numbered `sitemap-N.xml` parts plus `sitemap-index.xml` above it, with
matching TXT and gzip variants, into `sitemap_output_dir` (default `public_dir`).
Validation, optional artifact upload, external sitemap validation, the audit, and reporting
run last, then the outputs are set.

Action contract. Required: `site_url`. Optional with defaults: `public_dir` (`dist`),
`include_patterns` (`**/*.html,**/*.htm`), `exclude_patterns` (`**/*.map`), `exclude_urls`
(`*/sitemap*.xml,*/sitemap*.txt,*/sitemap*.xml.gz`), `exclude_extensions`
(`.zip,.exe,.dmg,.pkg,.deb,.rpm,.tar,.gz,.7z,.rar,.iso`), `gzip`, `parse_canonical`,
`discover_links`, `allow_autodetect`, `generate_sitemap_xml`, `generate_sitemap_txt`,
`generate_sitemap_gzip`, `validate_output`, `strict_validation`, `upload_artifacts`,
`use_marketplace_config`, `enable_audit`, `step_summary`, `enable_ai_summary` (all `true`),
the six `debug_*` flags (`false`), `lastmod_strategy` (`git`), `sitemap_filename`
(`sitemap.xml`), `artifact_name` (`sitemap-files`), `use_global_config` and `ai_provider`
(`auto`), and `global_config_path`
(`.github/blackout-secure-sitemap-generator-global-config.yml`). Optional with no default:
`sitemap_output_dir`, `additional_urls`, `changefreq`, `priority`, `prefer_company_name`,
`validate_sitemaps`, `artifact_retention_days`, `config_path`, `audit_fail_on`,
`sarif_output`, `report_json`, `recommendations_json`, `skips_json`. Outputs:
`sitemap_path`, `sitemap_index_path`, `sitemap_txt_path`, `url_count`, `config_sources`,
`audit_verdict`, `audit_pass_count`, `audit_warn_count`, `audit_fail_count`,
`audit_error_count`, `audit_skip_count`, `sarif_path`, `report_json_path`,
`recommendations_json_path`, `ai_summary`. `src/index.js` also still honours the undeclared
legacy aliases `generate_xml_sitemap`, `generate_txt_sitemap`, and `generate_gzip`.

`src/` to `dist/` relationship. Verified against `package.json`: the `build` script is
`ncc build src/index.js -o dist`, producing the single webpack bundle `dist/index.js`.
That bundle is committed build output. Marketplace consumers fetch a tag and execute
`dist/index.js` directly — they never run `npm install` — so it must always match `src/`.
Regenerate it only with `npm run build`; never hand-edit it. A pull request that changes
anything under `src/` (including `src/marketplace-config.json`, which `ncc` inlines) must
include the rebuilt `dist/index.js` in the same commit; `npm test` enforces this locally
through the `pretest` hook. `.gitignore` carries a managed `dist/` rule, so the bundle
updates cleanly only because it is already tracked; a new file under `dist/` needs
`git add -f`.

## Conventions

CommonJS everywhere (`require` / `module.exports`), matching `eslint.config.js`'s
`sourceType: 'commonjs'` and ECMAScript 2022. Every file opens with the four-line Blackout
Secure copyright banner plus `SPDX-License-Identifier: Apache-2.0`, and non-trivial modules
add a short paragraph explaining the module's contract and its design trade-offs. Public
functions carry JSDoc with `@param` and `@returns`. Files are flat and single-purpose under
`src/lib/`; `src/index.js` orchestrates and the libraries decide nothing about the action
surface. Prettier is authoritative for formatting (100 columns, single quotes, trailing
commas, semicolons, LF); ESLint adds `prefer-const`, `no-var`, and `no-unused-vars` as a
warning with a `^_` ignore prefix. Inputs are read only through `@actions/core`, never
`process.env` directly, and always with a config-derived fallback:

```js
function boolInput(name, fallback) {
  const raw = (core.getInput(name) || '').trim();
  if (!raw) return fallback;
  return /^true$/i.test(raw);
}
```

`listInput` is the comma-separated counterpart. Config parsing raises `ConfigError` with the
offending key path; runtime problems either call `core.warning` and continue or
`core.setFailed` and `return` — the top-level `run()` wraps everything in one try/catch and
never throws past it. Audit rules never throw: a rule configured `skip` still emits a `skip`
finding so the report records that the control was deliberately not assessed, and `skip`
must never be read as a pass.

Adding a new option end to end: declare the input in `action.yml` with a description and a
default; add the key and its default to `src/marketplace-config.json` under `sitemap`; add
the typed accessor and validation to the matching `*FromObject` function in
`src/lib/config.js`; read it in `src/index.js` via `boolInput` / `listInput` /
`core.getInput` with the config value as fallback; thread it through the relevant `src/lib/`
module; add a Mocha spec under `test/`; document it in the README input table; then run
`npm run build` and commit the regenerated `dist/index.js`.

## Blackout Secure conventions

These apply to every repository in the `blackoutsecure` organization.

### Branch model

- `dev` is the default branch and where all work lands.
- `main` is the promoted stable runtime that consumers reference through `@main`.
- Version tags (`vX.Y.Z` and a floating `vX`) point at promoted runtime commits.
- Promotion is driven from `bos-automation-hub` (`release-promote.yml`). Do not push
  directly to `main` and do not move tags by hand.

### Centrally managed files - do not hand-edit here

`blackoutsecure/bos-automation-hub` distributes these through
`bos-managed-file-sync-action`. Change the source under the hub's `sync-files/`, never the
copy in this repository:

- `LICENSE`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md`, `SUPPORT.md`
- `.github/FUNDING.yml`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/`
- `.github/workflows/bos-universal-gatekeeper-kicker.yml`
- the `# >>> managed-file-sync:<service> >>> ... # <<< managed-file-sync:<service> <<<`
  delimited blocks inside `.editorconfig`, `.markdownlint.yaml`, `.shellcheckrc`,
  `.yamllint.yml`, `.gitignore`, and `README.md`

`.github/bos-universal-config.json` is repo-owned. It holds this repository's overrides on
top of the hub's global config and is the right place to change gate behaviour.

### CI gate

Pushes and pull requests run the hub's reusable `bos-universal-security.yml`, reported as a
single required check. It runs markdownlint, yamllint, shellcheck, and actionlint; ESLint,
Prettier, Ruff, pytest, and Bats where the repository has them; `bos-code-scanning-kit`
(secret scan, SAST, GHAS posture) and CodeQL; dependency review; and compliance checks for
the canonical README header and a conventional-commit PR title
(`feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert: subject`).

Every `uses:` reference in a workflow must be a commit SHA with a trailing version comment,
for example `actions/checkout@<sha> # v4.2.2`.

## Boundaries

### Always

- Run `npm run build` and commit the regenerated `dist/index.js` in the same change as any
  `src/` edit, including changes to `src/marketplace-config.json`.
- Add or update a Mocha spec under `test/` for every behaviour change, then run
  `npx eslint .`, `npx prettier --check "**/*.{js,json,md}"`, and `npm test`.
- Read action inputs through `@actions/core` with the resolved config value as the fallback,
  so an empty input inherits the cascade.
- Validate new config keys in `src/lib/config.js` and default them in
  `src/marketplace-config.json`; default anything that could break a consumer to `warn`.
- Keep the `dist/*.html`, `dist/*.xml`, and `dist/*.txt` fixtures intact — the test suite
  uses `dist/` as its sample published site.

### Ask first

- Renaming, removing, or re-defaulting any `action.yml` input or output. This is published
  Marketplace surface and the hub pins it by SHA in `deploy-cloudflare-pages.yml`.
- Renaming or renumbering an `SM###` audit rule, or changing a rule's default severity.
- Changing the config precedence order, `DEFAULT_CONFIG_PATHS`, the `sitemap` section key,
  or `DEFAULT_GLOBAL_CONFIG_PATH` — the hub's
  `sync-files/config/sitemap-generator-global-config.json` depends on them.
- Adding a runtime dependency, a new network call, or a new AI provider path.
- Changing the bundler, the `build` script, or the `pretest` hook.
- Editing `marketplace.allowlist_paths` / `blocked_paths` / `required_paths` in
  `.github/bos-universal-config.json`.

### Never

- Never hand-edit `dist/index.js`; it is generated only by `npm run build`.
- Never commit secrets, tokens, or API keys — AI credentials are read from the environment
  and must never be logged or written into config, tests, or fixtures.
- Never hand-edit centrally managed files or managed-file-sync marker blocks here; change
  them under the hub's `sync-files/`.
- Never use an unpinned `uses:` ref; every action reference is a 40-character commit SHA
  with a trailing version comment.
- Never push directly to `main` or move a version tag by hand; promotion runs from the hub.
- Never weaken a check to make a build pass: do not lower an audit severity, add an ESLint
  disable, or set `audit_fail_on: never` to get green.
- Never let an audit `skip` be reported or treated as a `pass`.
- Never commit generated `dist/sitemap*` artifacts, `coverage/`, or `node_modules/`.
