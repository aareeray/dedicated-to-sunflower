const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('requestfailed', request => {
    console.log('PAGE REQUEST FAILED:', request.url(), request.failure()?.errorText);
  });

  try {
    console.log('Navigating to http://localhost:5173/ ...');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2', timeout: 10000 });
    console.log('Page loaded. Waiting 3 seconds for async code...');
    await new Promise(r => setTimeout(r, 3000));
  } catch (err) {
    console.log('Navigation or wait error:', err.message);
  } finally {
    await browser.close();
  }
})();
