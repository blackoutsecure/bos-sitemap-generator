const assert = require('assert');
const fs = require('fs');
const {
  TEST_CONFIG,
  getAbsolutePath,
  getPublicFilePath,
} = require('./test-config');
const {
  executeActionWithOverrides,
  cleanTestArtifacts: _cleanTestArtifacts,
} = require('./test-helpers');

const PUBLIC_DIR = getAbsolutePath(TEST_CONFIG.PUBLIC_DIR);
const SITEMAP_XML_PATH = getPublicFilePath(TEST_CONFIG.SITEMAP_GENERATION.XML);
const SITEMAP_TXT_PATH = getPublicFilePath(TEST_CONFIG.SITEMAP_GENERATION.TXT);
const INDEX_HTML_PATH = getPublicFilePath(TEST_CONFIG.INDEX_HTML_FILE);

function ensureTestFiles() {
  // Ensure dist directory exists
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }
  // Create test files if not present
  if (!fs.existsSync(INDEX_HTML_PATH)) {
    fs.writeFileSync(INDEX_HTML_PATH, '<html><body>Home</body></html>', 'utf8');
  }
}

describe('Action Additional URLs', () => {
  before(() => {
    ensureTestFiles();
  });

  afterEach(() => {
    // Clean up generated files
    if (fs.existsSync(SITEMAP_XML_PATH)) {
      fs.unlinkSync(SITEMAP_XML_PATH);
    }
    if (fs.existsSync(SITEMAP_TXT_PATH)) {
      fs.unlinkSync(SITEMAP_TXT_PATH);
    }
    // Clean environment variables
    Object.keys(process.env).forEach((k) => {
      if (k.startsWith('INPUT_')) delete process.env[k];
    });
  });

  it('includes manual additional_urls entries', async () => {
    const extra = TEST_CONFIG.ADDITIONAL_URLS;
    await executeActionWithOverrides(
      PUBLIC_DIR,
      {
        site_url: TEST_CONFIG.SITE_URL,
        additional_urls: extra.join(','),
        generate_sitemap_txt: 'false',
      },
      200,
    );
    const xmlPath = SITEMAP_XML_PATH;
    // Poll for file appearance (async writes + build time)
    const start = Date.now();
    while (!fs.existsSync(xmlPath) && Date.now() - start < 3000) {
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(fs.existsSync(xmlPath), 'Expected sitemap.xml to be generated');
    const xml = fs.readFileSync(xmlPath, 'utf8');
    extra.forEach((u) => assert.ok(xml.includes(u), `XML should contain ${u}`));
  });
});
