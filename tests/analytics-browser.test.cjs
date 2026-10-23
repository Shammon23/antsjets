const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const root=path.resolve(__dirname,'..');
const fixtureId='11111111-1111-4111-8111-111111111111'; // Mock-only UUID, never a real endpoint.
async function harness(configured=false, privacy=false) {
  const browser=await chromium.launch({headless:true,executablePath:process.env.ANALYTICS_TEST_CHROMIUM || undefined,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:390,height:844}});
  if(privacy) await context.addInitScript(()=>Object.defineProperty(navigator,'globalPrivacyControl',{value:true}));
  const payloads=[], unexpected=[],errors=[];
  await context.route('**/*', async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.hostname==='analytics.antsjets.co.uk') {payloads.push(req.postDataJSON());await route.fulfill({status:200,body:'{}',headers:{'Access-Control-Allow-Origin':'*'}});return;}
    if(url.hostname==='www.antsjets.co.uk') {
      const file=path.join(root,url.pathname==='/'?'index.html':url.pathname.slice(1));
      if(fs.existsSync(file)&&fs.statSync(file).isFile()) {
        let body=fs.readFileSync(file);if(configured&&file.endsWith('analytics-config.js')) body=body.toString().replace("websiteId: ''",`websiteId: '${fixtureId}'`);
        const ext=path.extname(file), mime={'.js':'application/javascript','.html':'text/html','.css':'text/css','.webp':'image/webp','.png':'image/png'}[ext]||'application/octet-stream';
        await route.fulfill({status:200,body,contentType:mime});return;
      }
    }
    // Do not contact live iframe/vendors during local-only analytics tests.
    if(!url.hostname.includes('leadconnector')&&!url.hostname.includes('msgsndr')) unexpected.push(req.url());
    await route.fulfill({status:200,body:'',contentType:'text/html'});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('https://www.antsjets.co.uk/contact.html?email=private%40example.com&utm_source=facebook&utm_campaign=patio#private');
  return {browser,page,payloads,unexpected,errors};
}
test('browser: unconfigured stays silent even with consent; settings withdraw available',async()=>{
  const s=await harness();try {
    await s.page.getByRole('button',{name:'Analytics settings',exact:true}).click();
    await s.page.getByRole('button',{name:'Allow analytics',exact:true}).click();
    await s.page.locator('a[href^="tel:"]').first().evaluate(a=>{a.addEventListener('click',e=>e.preventDefault());a.click();});
    assert.equal(s.payloads.length,0);
    await s.page.getByRole('button',{name:'Analytics settings',exact:true}).click();
    await s.page.getByRole('button',{name:'Reject / withdraw analytics',exact:true}).click();
    assert.equal(await s.page.evaluate(()=>AntsJetsAnalytics.status().allowed),false);
    assert.deepEqual(s.errors,[]);assert.deepEqual(s.unexpected,[]);
  } finally {await s.browser.close();}
});
test('browser: consent gates requests, click events, visibility, withdrawal and persisted denial',async()=>{
  const s=await harness(true);try {
    assert.equal(s.payloads.length,0);
    await s.page.getByRole('button',{name:'Allow analytics',exact:true}).click();
    await s.page.waitForFunction(()=>AntsJetsAnalytics.status().allowed);
    await s.page.locator('a[href^="tel:"]').first().evaluate(a=>{a.addEventListener('click',e=>e.preventDefault());a.click();});
    await s.page.locator('a[href^="sms:"]').first().evaluate(a=>{a.addEventListener('click',e=>e.preventDefault());a.click();});
    await s.page.locator('a[data-contact="whatsapp"]').first().evaluate(a=>{a.addEventListener('click',e=>e.preventDefault());a.click();});
    await s.page.locator('iframe').scrollIntoViewIfNeeded();
    await s.page.waitForTimeout(150);
    const names=s.payloads.map(p=>p.payload.name);
    assert.ok(names.includes('call_click'));assert.ok(names.includes('text_click'));assert.equal(names.filter(n=>n==='whatsapp_click').length,1);
    assert.ok(s.payloads.some(p=>p.payload.name==='quote_form_open'&&p.payload.data.source==='iframe_visible'));
    assert.ok(!names.includes('form_submit'));
    const before=s.payloads.length;
    await s.page.evaluate(()=>window.postMessage({type:'form-submit',success:true},'*'));
    await s.page.getByRole('button',{name:'Analytics settings',exact:true}).click();
    await s.page.getByRole('button',{name:'Reject / withdraw analytics',exact:true}).click();
    await s.page.evaluate(()=>AntsJetsAnalytics.track('call_click'));
    await s.page.reload();await s.page.waitForTimeout(100);
    assert.equal(s.payloads.length,before);
    assert.doesNotMatch(JSON.stringify(s.payloads),/private|%40|email=/);
    assert.deepEqual(s.errors,[]);assert.deepEqual(s.unexpected,[]);
  } finally {await s.browser.close();}
});
test('browser: GPC cannot be overridden by UI or first-party API',async()=>{
  const s=await harness(true,true);try {
    await s.page.getByRole('button',{name:'Analytics settings',exact:true}).click();
    assert.equal(await s.page.getByRole('button',{name:'Allow analytics',exact:true}).isDisabled(),true);
    await s.page.evaluate(()=>{AntsJetsAnalytics.setConsent(true);AntsJetsAnalytics.track('call_click');});
    assert.equal(s.payloads.length,0);
  } finally {await s.browser.close();}
});
