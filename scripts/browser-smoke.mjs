import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { root } from './verify-upstreams.mjs';

// Use rs2b0t's existing locked Playwright dependency; install no new browser tools.
const require = createRequire(path.join(root, 'rs2b0t/package.json'));
const { chromium } = require('playwright-core');
const runtime = process.env.HALLUMINA_RUNTIME_DIR;
assert(runtime && path.isAbsolute(runtime), 'Set HALLUMINA_RUNTIME_DIR. Start that runtime in another terminal first.');
const config = JSON.parse(fs.readFileSync(path.join(runtime, 'engine/data/config/world.json'), 'utf8'));
assert.equal(config.engine.revision, 289);
const origin = `http://127.0.0.1:${config.web.port}`;
const browser = await chromium.launch({
    executablePath: process.env.HALLUMINA_CHROMIUM_BIN ?? '/usr/bin/chromium',
    headless: true,
    args: ['--disable-dev-shm-usage']
});
try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 720 } });
    const errors = [];
    const responses = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => responses.push({ url: response.url(), status: response.status() }));
    // The native client needs only this disposable local world and embedded data.
    await page.route('**/*', route => {
        const url = route.request().url();
        return url.startsWith(origin + '/') || url.startsWith('data:') || url.startsWith('blob:') ? route.continue() : route.abort();
    });
    await page.goto(origin + '/rs2.cgi', { waitUntil: 'networkidle', timeout: 60_000 });
    await page.waitForFunction(() => document.querySelector('canvas')?.width === 765);
    // Cache archives finish before the title/login screen can render.
    const archiveNames = ['title', 'config', 'interface', 'media', 'versionlist', 'textures', 'wordenc', 'sounds'];
    await page.waitForTimeout(15_000);
    for (const name of archiveNames) {
        assert(responses.some(r => new URL(r.url).pathname.startsWith('/' + name) && r.status === 200), `Missing native cache archive: ${name}`);
    }
    assert.deepEqual(errors, [], 'Native client JavaScript errors');
    const screenshot = path.join(runtime, 'native-client.png');
    await page.screenshot({ path: screenshot });
    console.log(JSON.stringify({ result: 'PASS: native page, canvas, cache downloads, no page errors', screenshot, responses }, null, 2));
    console.log('Inspect the screenshot for the loaded title screen. This check does not log in or establish gameplay.');
} finally {
    await browser.close();
}
