import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { importTestAccount } from './mt5-test-fixture.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dir = process.env.GLASS_SELECTION_ARTIFACTS || '/tmp/bluespherix-glass-multiselect';
await fs.mkdir(dir,{ recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const errors = []; page.on('pageerror',error=>errors.push(error.message));
const url = process.env.GLASS_SELECTION_URL || 'http://127.0.0.1:3001/';
const selected = control => control.locator('xpath=self::*[@data-glass-selection="selected"]').waitFor();
const uncoated = async control => { await control.locator('xpath=self::*[not(@data-glass-selection)]').waitFor(); return true; };
const nav = name => page.locator('nav').getByRole('button',{name,exact:true}).click();

await importTestAccount(page, url);
await nav('Diario'); await page.getByRole('heading',{name:'Diario di trading.'}).waitFor();
const tags = page.locator('.diary-chips button'), checks = page.locator('.diary-checks label');
for (const tag of await tags.all()) if (await tag.getAttribute('aria-pressed')==='true') await tag.click();
for (const tag of [tags.nth(0),tags.nth(1)]) { await tag.click(); await selected(tag); }
for (const label of [checks.nth(0),checks.nth(1)]) { if (!(await label.locator('input').isChecked())) await label.click(); await selected(label); }
await page.locator('.diary-field textarea').first().click(); await page.keyboard.press('Escape');
for (const control of [tags.nth(0),tags.nth(1),checks.nth(0),checks.nth(1)]) await selected(control);
const period = page.getByRole('button',{name:'90G',exact:true}); await period.click(); await selected(period);
await page.getByRole('heading',{name:'Diario di trading.'}).click();
await selected(period);
await selected(tags.nth(0)); await selected(tags.nth(1));
await tags.nth(0).click(); assert(await uncoated(tags.nth(0))); await selected(tags.nth(1));
await checks.nth(0).click(); assert(await uncoated(checks.nth(0))); await selected(checks.nth(1));
await tags.nth(1).focus(); await page.keyboard.press('Space'); assert(await uncoated(tags.nth(1)));
await page.keyboard.press('Space'); await selected(tags.nth(1));
await page.locator('.diary-chips').screenshot({path:`${dir}/journal-tags.png`});
// Replacing the editor must discard old coatings and reflect the new entry.
await page.locator('.diary-trade').nth(1).click();
await page.waitForTimeout(200);
assert(await page.locator('.diary-chips button[data-glass-persistent]').evaluateAll(nodes=>nodes.every(el=>el.getAttribute('aria-pressed')==='true')));
assert(await page.locator('.diary-checks label[data-glass-persistent]').evaluateAll(nodes=>nodes.every(el=>el.querySelector('input').checked)));

await page.setViewportSize({width:390,height:844});
assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
assert.equal(await page.locator('canvas').count(),1);

const fallback = await browser.newPage({viewport:{width:1024,height:820},reducedMotion:'reduce'});
await fallback.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:get.call(this,type,...args);};});
await importTestAccount(fallback, url);
await fallback.goto(`${url}#journal`);
const f=fallback.locator('.diary-chips button').first();
if(await f.getAttribute('aria-pressed')!=='true') await f.click();
await selected(f); await fallback.getByRole('heading',{name:'Diario di trading.'}).click();
await selected(f); assert.notEqual(await f.evaluate(el=>getComputedStyle(el).backgroundImage),'none','multi-select fallback stays visible');
await f.click(); assert(await uncoated(f));
await fallback.close();
assert.deepEqual(errors,[]);
await fs.writeFile(`${dir}/multiple.json`,JSON.stringify({pass:true,errors,checks:'independent toggles, tags, checklist, click outside, Escape, single selections, editor replacement, mobile, fallback, one canvas'},null,2));
console.log(JSON.stringify({pass:true,errors})); await browser.close();
