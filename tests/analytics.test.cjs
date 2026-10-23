const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const codePath = '../assets/js/analytics.js';
const make = (...args) => require(codePath).createAnalytics(...args);
const uuid = '11111111-1111-4111-8111-111111111111'; // Offline test fixture only.
function setup(overrides={}, config={}) {
  const requests=[]; const stored={};
  const env={location:new URL('https://www.antsjets.co.uk/contact.html?email=person%40example.com&utm_source=facebook&utm_campaign=patio&utm_term=07920401090#private'),navigator:{language:'en-GB'},screen:{width:390,height:844},document:{referrer:'https://example.com/path?email=secret',querySelector:()=>null},localStorage:{getItem:k=>stored[k]||null,setItem:(k,v)=>stored[k]=v},fetch:(u,o)=>{requests.push({u,o,body:JSON.parse(o.body)});return Promise.resolve({ok:true});},...overrides};
  const api=make(env,{umami:{endpoint:'https://analytics.antsjets.co.uk',websiteId:uuid},...config});
  return {api,env,requests,stored};
}
test('missing UUID fails closed even with consent',()=>{const s=setup({}, {umami:{endpoint:'https://analytics.antsjets.co.uk',websiteId:''}});s.api.setConsent(true);assert.equal(s.requests.length,0);});
test('denied by default, grant sends one sanitized view, withdraw stops',()=>{const s=setup();s.api.track('call_click');assert.equal(s.requests.length,0);s.api.setConsent(true);s.api.setConsent(true);assert.equal(s.requests.length,1);const p=s.requests[0].body.payload;assert.equal(p.referrer,'https://example.com');assert.equal(p.url,'/contact.html?utm_source=facebook&utm_campaign=patio');assert.equal(s.requests[0].o.referrerPolicy,'no-referrer');assert.equal(s.requests[0].o.credentials,'omit');s.api.setConsent(false);s.api.track('call_click');assert.equal(s.requests.length,1);});
test('DNT/GPC override explicit consent',()=>{for(const navigator of [{doNotTrack:'1'},{globalPrivacyControl:true}]){const s=setup({navigator});s.api.setConsent(true);assert.equal(s.requests.length,0);}});
test('only allowlisted events and no arbitrary parameters',()=>{const s=setup();s.api.setConsent(true);s.api.track('call_click',{email:'leak'});s.api.track('made_up');s.api.track('form_submit');assert.equal(s.requests.length,2);assert.deepEqual(s.requests[1].body.payload.data,{page:'/contact.html'});});
test('quote origin explicitly distinguishes CTA and visible iframe',()=>{const s=setup();s.api.setConsent(true);s.api.track('quote_form_open',{source:'cta',message:'secret'});s.api.track('quote_form_open',{source:'iframe_visible'});assert.equal(s.requests[1].body.payload.data.source,'cta');assert.equal(s.requests[2].body.payload.data.source,'iframe_visible');assert.ok(!JSON.stringify(s.requests).includes('secret'));});
test('verified submission hook disabled until verified integration exists',()=>{const s=setup();s.api.setConsent(true);assert.equal(s.api.recordVerifiedFormSubmit(),false);assert.equal(s.requests.length,1);const enabled=setup({}, {verifiedFormSuccessEnabled:true});enabled.api.setConsent(true);assert.equal(enabled.api.recordVerifiedFormSubmit(),true);assert.equal(enabled.requests[1].body.payload.name,'form_submit');});
test('excluded pages and unapproved origins do not send',()=>{for(const url of ['https://www.antsjets.co.uk/ad-creative-gallery.html','https://www.antsjets.co.uk/404.html','http://localhost:8000/contact.html']){const s=setup({location:new URL(url)});s.api.setConsent(true);assert.equal(s.requests.length,0);}});
test('storage failure and network failure are non-fatal',()=>{const s=setup({localStorage:{getItem(){throw Error();},setItem(){throw Error();}},fetch(){return Promise.reject(Error('offline'));}});assert.doesNotThrow(()=>s.api.setConsent(true));});
test('cross-origin postMessages are never installed as analytics input',()=>{assert.doesNotMatch(fs.readFileSync(require.resolve(codePath),'utf8'),/addEventListener\(['"]message['"]/);});
test('malicious UTMs, arbitrary queries and fragments never reach payloads',()=>{
  for(const value of ['person@example.com','07920-401090','07920_401090','%2507%2540','hello world','x'.repeat(65)]) {
    const location=new URL('https://www.antsjets.co.uk/contact.html');location.searchParams.set('utm_campaign',value);location.searchParams.set('message','private');location.hash='secret';
    const s=setup({location});s.api.setConsent(true);assert.equal(s.requests[0].body.payload.url,'/contact.html');
  }
});
test('noindex metadata excludes pages even when configuration is valid',()=>{const s=setup({document:{referrer:'',querySelector:()=>({})}});s.api.setConsent(true);assert.equal(s.requests.length,0);});
test('persisted valid consent works; expired or malformed choices default denied',()=>{
  const localStorage=value=>({getItem:()=>value,setItem:()=>{}});
  const yes=setup({localStorage:localStorage(JSON.stringify({allowed:true,expires:Date.now()+100000}))});yes.api.view();assert.equal(yes.requests.length,1);
  for(const value of ['oops',JSON.stringify({allowed:true,expires:1}),JSON.stringify({allowed:'yes',expires:Date.now()+100000})]){const s=setup({localStorage:localStorage(value)});s.api.view();assert.equal(s.requests.length,0);}
});
test('all public pages have references once in config-first order; noindex pages deliberately omitted',()=>{
  const path=require('node:path'), root=path.resolve(__dirname,'..');let included=0,excluded=0;
  for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.html'))){const html=fs.readFileSync(path.join(root,file),'utf8');const skip=['404.html','ad-creative-gallery.html'].includes(file)||/<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html);const refs=html.match(/<script src="assets\/js\/analytics(?:-config)?\.js" defer><\/script>/g)||[];
    assert.equal(refs.length,skip?0:2,file);if(skip)excluded++;else {included++;assert.ok(refs[0].includes('analytics-config.js'),file);}
  }assert.ok(included>=85);assert.ok(excluded>=2);
});
test('GA4 loader needs valid ID and consent, uses sanitized URLs, and withdrawal disables',()=>{
  const scripts=[];
  const document={referrer:'https://google.com/search?q=private',querySelector:()=>null,createElement:()=>({}),head:{appendChild:s=>scripts.push(s)},cookie:''};
  const s=setup({document},{umami:{},ga4:{enabled:true,measurementId:'G-TEST12345'}});
  s.api.view();assert.equal(scripts.length,0);
  s.api.setConsent(true);assert.equal(scripts.length,1);assert.equal(s.requests.length,0);
  const events=s.env.dataLayer.map(a=>Array.from(a)).filter(a=>a[0]==='event');
  assert.equal(events[0][1],'page_view');assert.equal(events[0][2].page_location,'https://www.antsjets.co.uk/contact.html?utm_source=facebook&utm_campaign=patio');
  s.api.track('call_click');s.api.setConsent(false);const count=s.env.dataLayer.length;s.api.track('call_click');
  assert.equal(s.env.dataLayer.length,count);assert.equal(s.env['ga-disable-G-TEST12345'],true);
});
test('GA4 remains disabled without a real property ID',()=>{const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../assets/js/analytics-config.js'),'utf8'),sandbox);assert.equal(sandbox.window.ANTSJETS_ANALYTICS_CONFIG.ga4.enabled,false);assert.equal(sandbox.window.ANTSJETS_ANALYTICS_CONFIG.ga4.measurementId,'');});
