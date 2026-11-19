#!/usr/bin/env node
// Scans static/sources/*/ (one folder per book) and writes src/lib/data/manifest.json.
//
// A source folder looks like:
//   static/sources/<id>/source.json   — title, author, year, optional groupOrder
//   static/sources/<id>/order.json   — optional display order: [{ page, group, name }]
//   static/sources/<id>/raw/         — faithful traced SVGs
//   static/sources/<id>/smooth/      — smoothed SVGs (same names)
//
// Without order.json, marks are sorted naturally per group (top-level first).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcesDir = path.join(root, 'static', 'sources');
const outFile = path.join(root, 'src', 'lib', 'data', 'manifest.json');

const natural = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const compare = (a, b) => natural.compare(a, b);

function readSvgSize(file) {
	const head = fs.readFileSync(file, 'utf8').slice(0, 1000);
	let m = head.match(/<svg[^>]*\bviewBox\s*=\s*["']\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)/i);
	if (m) return { w: Math.round(+m[3]), h: Math.round(+m[4]) };
	m = head.match(/<svg[^>]*\bwidth\s*=\s*["']?([\d.]+)/i);
	const w = m ? Math.round(+m[1]) : null;
	m = head.match(/<svg[^>]*\bheight\s*=\s*["']?([\d.]+)/i);
	const h = m ? Math.round(+m[1]) : null;
	if (w && h) return { w, h };
	throw new Error(`no viewBox or width/height in ${file}`);
}

function walkSvgs(dir, group = '', out = new Map()) {
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		if (e.isDirectory()) {
			walkSvgs(path.join(dir, e.name), group ? `${group}/${e.name}` : e.name, out);
		} else if (e.name.endsWith('.svg')) {
			if (!out.has(group)) out.set(group, []);
			out.get(group).push(e.name.slice(0, -4));
		}
	}
	return out;
}

const sources = [];

for (const entry of fs.readdirSync(sourcesDir, { withFileTypes: true }).sort((a, b) => compare(a.name, b.name))) {
	if (!entry.isDirectory()) continue;
	const dir = path.join(sourcesDir, entry.name);
	const id = entry.name;

	const metaPath = path.join(dir, 'source.json');
	const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};

	const variants = ['smooth', 'raw'].filter((v) => fs.existsSync(path.join(dir, v)));
	if (variants.length === 0) {
		console.warn(`! ${id}: no raw/ or smooth/ folder, skipping`);
		continue;
	}

	const groups = walkSvgs(path.join(dir, variants[0]));
	const orderPath = path.join(dir, 'order.json');
	const hasOrder = fs.existsSync(orderPath);
	const order = hasOrder ? JSON.parse(fs.readFileSync(orderPath, 'utf8')) : null;

	// Build the ordered list of { group, name }.
	let ordered = [];

	if (order) {
		const seen = new Set();
		for (const o of order) seen.add(`${o.group || ''}/${o.name}`);

		// warn about files missing from order.json
		for (const [group, names] of groups) {
			for (const n of names) {
				if (!seen.has(`${group}/${n}`)) console.warn(`! ${id}: ${group || 'plates'}/${n} not in order.json — skipped`);
			}
		}

		// group priority: root (plates) first, then groupOrder if given,
		// otherwise remaining groups in order.json appearance order
		const rest = meta.groupOrder
			? meta.groupOrder.filter((g) => g !== '')
			: [...new Set(order.map((o) => o.group).filter(Boolean))];
		const unknown = rest.filter((g) => !groups.has(g));
		for (const g of unknown) console.warn(`! ${id}: groupOrder lists unknown group "${g}"`);

		ordered = [
			...order.filter((o) => !o.group),
			...rest.flatMap((g) => order.filter((o) => o.group === g))
		];
	} else {
		ordered = [
			...(groups.get('') || []).sort(compare).map((name) => ({ group: '', name })),
			...[...groups.keys()]
				.filter((g) => g !== '')
				.sort(compare)
				.flatMap((g) => groups.get(g).sort(compare).map((name) => ({ group: g, name })))
		];
	}

	const marks = [];
	for (const o of ordered) {
		const group = o.group || '';
		const primary = path.join(dir, variants[0], group, `${o.name}.svg`);
		if (!fs.existsSync(primary)) {
			console.warn(`! ${id}: missing ${variants[0]}/${group || 'plates'}/${o.name}.svg — skipped`);
			continue;
		}
		const { w, h } = readSvgSize(primary);
		for (const v of variants) {
			if (v !== variants[0] && !fs.existsSync(path.join(dir, v, group, `${o.name}.svg`))) {
				console.warn(`! ${id}: ${v}/${group || 'plates'}/${o.name}.svg missing for a variant`);
			}
		}
		marks.push({ n: o.name, ...(group ? { g: group } : {}), w, h });
	}

	sources.push({
		id,
		title: meta.title || id,
		author: meta.author || '',
		...(meta.year ? { year: meta.year } : {}),
		variants,
		marks
	});
	console.log(`✓ ${id}: ${marks.length} marks (${variants.join(', ')})`);
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify({ sources }, null, '\t') + '\n');
console.log(`\nwrote ${path.relative(root, outFile)} — ${sources.reduce((n, s) => n + s.marks.length, 0)} marks total`);
