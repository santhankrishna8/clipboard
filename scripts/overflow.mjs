import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844 });
await p.goto(pathToFileURL('site/index.html').href);
await new Promise((r) => setTimeout(r, 800));
console.log(await p.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > 392 && getComputedStyle(e).position !== 'fixed').slice(0, 14).map((e) => e.tagName.toLowerCase() + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right)).join('\n')));
await b.close();
