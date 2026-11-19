#!/usr/bin/env node
// Renders the built site in headless Chromium and saves screenshots to
// .qa/ — a quick visual check after changes. Run the preview server first:
//
//   npm run build && npm run preview
//   npm run qa
//
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.QA_URL || 'http://localhost:4173';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.qa');
const shots = [
	['01-desktop-grid.png', { width: 1440, height: 900 }, async (page) => {
		await page.waitForTimeout(2800); // let the loader veil lift
		// the grid must actually be visible — regression guard for the
		// fade-in (a pruned `.ld` rule once left every image at opacity 0)
		const vis = await page.evaluate(() => {
			const img = document.querySelector('.cell-btn img');
			const visible = [...document.querySelectorAll('.cell-btn img')].filter((i) =>
				!i.className.includes('ld') ? false : getComputedStyle(i).opacity === '1'
			).length;
			return { first: img ? getComputedStyle(img).opacity : null, visible };
		});
		if (vis.first !== '1') errors.push(`01-desktop-grid: first image opacity ${vis.first} — grid invisible!`);
		if (vis.visible < 6) errors.push(`01-desktop-grid: only ${vis.visible} visible images`);
	}],
	['02-desktop-scrolled.png', { width: 1440, height: 900 }, async (page) => {
		await page.mouse.wheel(0, 2600);
		await page.waitForTimeout(900);
	}],
	['03-desktop-detail.png', { width: 1440, height: 900 }, async (page) => {
		await page.locator('.cell-btn').nth(24).scrollIntoViewIfNeeded();
		await page.locator('.cell-btn').nth(24).click();
		await page.waitForTimeout(700);
	}],
	['04-desktop-detail-raw.png', { width: 1440, height: 900 }, async (page) => {
		await page.getByRole('button', { name: 'Raw' }).click();
		await page.waitForTimeout(700);
	}],
	['05-desktop-10cols.png', { width: 1440, height: 900 }, async (page) => {
		await page.keyboard.press('Escape');
		await page.locator('.r-desk input').evaluate((el) => {
			el.value = '10';
			el.dispatchEvent(new Event('input', { bubbles: true }));
		});
		await page.waitForTimeout(400);
	}],
	['06-mobile-grid.png', { width: 390, height: 844, isMobile: true, hasTouch: true }, async (page) => {
		await page.waitForTimeout(2800);
	}],
	['07-mobile-detail.png', { width: 390, height: 844, isMobile: true, hasTouch: true }, async (page) => {
		await page.locator('.cell-btn').nth(3).click();
		await page.waitForTimeout(700);
	}]
];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const errors = [];

for (const [name, viewport, interact] of shots) {
	const page = await browser.newPage({ viewport });
	page.on('console', (m) => {
		if (m.type() === 'error') errors.push(`${name}: ${m.text()}`);
	});
	page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
	await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
	await interact(page);
	await page.screenshot({ path: path.join(OUT, name) });
	await page.close();
	console.log(`✓ ${name}`);
}

await browser.close();
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'console errors: none');
