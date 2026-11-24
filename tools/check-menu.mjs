#!/usr/bin/env node
// Checks the menu data for mistakes before you publish.
// Run from the project folder:   node tools/check-menu.mjs
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const errors = [], warnings = [];

function load(rel) {
  try { return JSON.parse(readFileSync(join(root, rel), "utf8")); }
  catch (e) { errors.push(`${rel}: ${e.message}`); return null; }
}

const settings = load("data/settings.json");
const menu = load("data/menu.json");
const en = load("data/lang/en.json");
if (!settings || !menu || !en) finish();

const menuIds = new Set(menu.menus.map(m => m.id));
const cats = new Map(menu.categories.map(c => [c.id, c]));
const dietary = new Set(Object.keys(en.dietary));
const allergens = new Set(Object.keys(en.allergens));
const list = v => v == null ? [] : Array.isArray(v) ? v : [v];

for (const c of menu.categories) {
  if (!menuIds.has(c.menu)) errors.push(`category "${c.id}": unknown menu "${c.menu}"`);
}
for (const r of settings.schedule) {
  if (!menuIds.has(r.menu)) errors.push(`settings.json schedule: unknown menu "${r.menu}"`);
  if (!/^\d{2}:\d{2}$/.test(r.from) || !/^\d{2}:\d{2}$/.test(r.to)) errors.push(`settings.json schedule: times must look like "06:00"`);
}

const seen = new Set();
for (const [i, it] of menu.items.entries()) {
  const where = `item #${i + 1} "${it.id || it.name || "?"}"`;
  if (!it.id) errors.push(`${where}: missing "id"`);
  else if (seen.has(it.id)) errors.push(`${where}: duplicate id`);
  else if (!/^[a-z0-9-]+$/.test(it.id)) errors.push(`${where}: id should only use lowercase letters, numbers and dashes`);
  seen.add(it.id);
  if (!it.name) errors.push(`${where}: missing "name"`);
  for (const m of list(it.menu)) if (!menuIds.has(m)) errors.push(`${where}: unknown menu "${m}"`);
  const cat = cats.get(it.category);
  if (!cat) errors.push(`${where}: unknown category "${it.category}"`);
  else if (!list(it.menu).includes(cat.menu)) errors.push(`${where}: category "${it.category}" belongs to the "${cat.menu}" menu, not "${list(it.menu).join(", ")}"`);
  const hasPrices = Array.isArray(it.prices) && it.prices.length;
  if (it.price == null && !hasPrices) errors.push(`${where}: needs a "price" (or a "prices" list)`);
  if (it.price != null && typeof it.price !== "number") errors.push(`${where}: price must be a number like 12.50 (no $ sign or quotes)`);
  for (const p of [...list(it.prices), ...list(it.extras)]) {
    if (!p.label || typeof p.price !== "number") errors.push(`${where}: each prices/extras entry needs a "label" and a numeric "price"`);
  }
  for (const d of list(it.dietary)) if (!dietary.has(d)) errors.push(`${where}: unknown dietary code "${d}" (use ${[...dietary].join(", ")})`);
  for (const a of list(it.allergens)) if (!allergens.has(a)) errors.push(`${where}: unknown allergen "${a}" (use ${[...allergens].join(", ")})`);
  if (it.photo && !/^https?:\/\//.test(it.photo) && !existsSync(join(root, it.photo))) errors.push(`${where}: photo file not found: public/${it.photo}`);
}

for (const { code } of settings.languages) {
  if (code === "en") continue;
  const L = load(`data/lang/${code}.json`);
  if (!L) continue;
  const missing = menu.items.filter(it => it.available !== false && !(L.items && L.items[it.id] && L.items[it.id].name));
  const missingDesc = menu.items.filter(it => it.description && !(L.items && L.items[it.id] && L.items[it.id].description));
  if (missing.length) warnings.push(`${code}.json: no translated name for ${missing.map(i => i.id).join(", ")} (English will be shown)`);
  if (missingDesc.length) warnings.push(`${code}.json: no translated description for ${missingDesc.map(i => i.id).join(", ")}`);
  for (const id of Object.keys(L.items || {})) if (!seen.has(id)) warnings.push(`${code}.json: translation for "${id}" but no such item in menu.json`);
  for (const c of menu.categories) if (!(L.categories && L.categories[c.id])) warnings.push(`${code}.json: no translated name for category "${c.id}"`);
}

finish();
function finish() {
  for (const w of warnings) console.log("⚠️  " + w);
  for (const e of errors) console.log("❌ " + e);
  if (errors.length) { console.log(`\n${errors.length} error(s) – fix these before publishing.`); process.exit(1); }
  console.log(`✅ Menu looks good (${menu ? menu.items.length : 0} items${warnings.length ? `, ${warnings.length} warning(s)` : ""}).`);
  process.exit(0);
}
