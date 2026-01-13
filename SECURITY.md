# Security Policy

## Reporting Security Vulnerabilities

**Do not open public GitHub issues for security vulnerabilities.**

If you discover a security vulnerability in Blackout Secure Sitemap Generator, please report it by emailing security@blackoutsecure.app.

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested remediation (if any)

We take all security reports seriously and will acknowledge your report within 48 hours.

## Security Best Practices

### When Using This Action

1. **Keep Dependencies Updated**: Regularly update the action and dependencies
   ```yaml
   - uses: blackoutsecure/bos-sitemap-generator@v1  # Pin to specific version
   ```

2. **Use Specific Versions**: Avoid using `@latest` in production workflows
   ```yaml
   # Good
   - uses: blackoutsecure/bos-sitemap-generator@v1.0.0
   
   # Avoid
   - uses: blackoutsecure/bos-sitemap-generator@latest
   ```

3. **Secure Your Site URLs**: Don't expose sensitive URLs in your workflow logs
   ```yaml
   env:
     SITE_URL: ${{ secrets.SITE_URL }}
   ```

4. **Git Depth Configuration**: When using `git` lastmod strategy:
   ```yaml
   - uses: actions/checkout@v4
     with:
       fetch-depth: 0  # Required for full git history
   ```

5. **Artifact Retention**: Configure artifact retention appropriately:
   ```yaml
   - uses: blackoutsecure/bos-sitemap-generator@v1
     with:
       artifact_retention_days: '7'  # Keep sitemaps for limited time
   ```

## Supported Versions

| Version | Status | Support Until |
|---------|--------|----------------|
| 1.x     | Active | -              |
| 0.x     | EOL    | -              |

## Node Version

This action uses Node.js 20. We recommend keeping Node.js updated for the latest security patches.

## Vulnerability Scanning

- Dependencies are regularly scanned for known vulnerabilities
- Updates are released as needed for security fixes
- Check GitHub Security tab for any reported vulnerabilities

## Security-Related Files

- [NOTICE](./NOTICE) - Third-party notices
- [LICENSE](./LICENSE) - Apache License 2.0

## Questions?

For security-related questions, please contact: security@blackoutsecure.com

---

**Thank you for helping keep our project secure!**
