const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  TEST_CONFIG,
  getAbsolutePath,
  getPublicFilePath,
} = require('./test-config');
const { SITEMAP_GENERATION } = TEST_CONFIG;
const { executeActionWithOverrides } = require('./test-helpers');

describe('Action Git lastmod strategy', () => {
  const publicDir = getAbsolutePath(TEST_CONFIG.PUBLIC_DIR);
  const testFile = getPublicFilePath(TEST_CONFIG.TEST_HTML_FILE);
  let committedIso;

  before(() => {
    // create test file and commit to repository to ensure git log returns value
    fs.writeFileSync(testFile, '<html><body>Git Test</body></html>', 'utf8');
    try {
      execSync(
        `git add ${TEST_CONFIG.PUBLIC_DIR}/${TEST_CONFIG.TEST_HTML_FILE}`,
      );
      execSync('git commit -m "test: add git-test.html"');
      committedIso = execSync(
        `git log -1 --pretty=format:%cI -- ${TEST_CONFIG.PUBLIC_DIR}/${TEST_CONFIG.TEST_HTML_FILE}`,
        { encoding: 'utf8' },
      ).trim();
    } catch {
      // if git commit fails (detached or no user config), skip
      committedIso = null;
    }
  });

  after(() => {
    // do not remove file (keeps repo state), but clear env
    Object.keys(process.env).forEach((k) => {
      if (k.startsWith('INPUT_')) delete process.env[k];
    });
  });

  it('embeds lastmod from git when available', async function () {
    this.timeout(8000);
    await executeActionWithOverrides(publicDir, {
      site_url: TEST_CONFIG.SITE_URL,
      lastmod_strategy: 'git',
      generate_sitemap_txt: 'false',
    });
    const xmlPath = path.join(publicDir, SITEMAP_GENERATION.XML);
    assert.ok(fs.existsSync(xmlPath));
    const xml = fs.readFileSync(xmlPath, 'utf8');
    if (committedIso) {
      assert.ok(
        xml.includes(committedIso.slice(0, 10)),
        'XML should contain git commit date fragment',
      );
    }
  });
});
