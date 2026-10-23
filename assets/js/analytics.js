/* First-party, opt-in Umami transport. No vendor script or automatic URL capture. */
(function (root) {
  'use strict';
  function createAnalytics(env, config) {
    config = config || {};
    const umami = config.umami || {};
    const key = 'aj-analytics-consent-v1';
    let consent = false, choice = false, viewed = false;
    const blocked = () => env.navigator.globalPrivacyControl === true ||
      env.navigator.doNotTrack === '1' || env.navigator.doNotTrack === 'yes' || env.doNotTrack === '1';
    const page = env.location.pathname;
    const excluded = /\/(?:ad-creative-gallery|404)(?:\.html)?\/?$/.test(page) ||
      !!env.document.querySelector('meta[name="robots"][content*="noindex"]');
    const allowedHost = env.location.protocol === 'https:' &&
      ['antsjets.co.uk', 'www.antsjets.co.uk'].includes(env.location.hostname);
    // Config generated from public static pages: never send arbitrary /email-or-phone paths.
    const allowedPage = config.allowedPaths ? config.allowedPaths.includes(page) : /^\/[a-z-]*(?:\.html)?$/.test(page);
    const configured = umami.endpoint === 'https://analytics.antsjets.co.uk' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(umami.websiteId || '');
    try {
      const saved = JSON.parse(env.localStorage.getItem(key));
      if (saved && saved.expires > Date.now() && typeof saved.allowed === 'boolean') {
        consent = saved.allowed; choice = true;
      }
    } catch (_) { /* Storage unavailable: default denied. */ }
    function campaignURL() {
      const input = new URLSearchParams(env.location.search), output = new URLSearchParams();
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(k => {
        const v = input.get(k) || '';
        // Only campaign slugs; reject emails, phone-like digit runs and encoded/free-text data.
        if (/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(v) && !/\d{7}/.test(v.replace(/[-_]/g,''))) output.set(k, v);
      });
      return page + (output.size ? '?' + output.toString() : '');
    }
    const google = config.ga4 || {};
    const googleConfigured = google.enabled === true && /^G-[A-Z0-9]{6,20}$/.test(google.measurementId || '');
    let googleLoaded = false;
    function sendGoogle(name, data, referrer) {
      if (!googleConfigured) return;
      env.dataLayer = env.dataLayer || [];
      env.gtag = env.gtag || function () { env.dataLayer.push(arguments); };
      if (!googleLoaded) {
        env.gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
        env.gtag('consent','update',{analytics_storage:'granted'});
        env.gtag('js',new Date());
        env.gtag('config',google.measurementId,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false});
        const script = env.document.createElement('script');
        script.async = true; script.src = 'https://www.googletagmanager.com/gtag/js?id=' + google.measurementId;
        env.document.head.appendChild(script); googleLoaded = true;
      }
      env.gtag('event',name || 'page_view',Object.assign({page_location:env.location.origin + campaignURL(),page_referrer:referrer,send_to:google.measurementId},data || {}));
    }
    function send(name, data) {
      if (!consent || blocked() || (!configured && !googleConfigured) || excluded || !allowedHost || !allowedPage) return false;
      let referrer = '';
      try { const ref = new URL(env.document.referrer); if (/^https?:$/.test(ref.protocol)) referrer = ref.origin; } catch (_) {}
      try { sendGoogle(name,data,referrer); } catch (_) { /* Google failure must not break the site. */ }
      if (!configured) return googleConfigured;
      const payload = {website:umami.websiteId, hostname:env.location.hostname,
        url: name ? page : campaignURL(), referrer,
        language:env.navigator.language || '', screen:env.screen.width + 'x' + env.screen.height};
      if (name) { payload.name = name; payload.data = data; }
      try {
        Promise.resolve(env.fetch(umami.endpoint + '/api/send', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({type:'event',payload}), credentials:'omit',
          referrerPolicy:'no-referrer', keepalive:true
        })).catch(() => {});
        return true;
      } catch (_) { return false; }
    }
    function view() { if (!viewed && send()) viewed = true; }
    function setConsent(allowed) {
      consent = allowed === true; choice = true;
      if (googleConfigured) {
        env['ga-disable-' + google.measurementId] = !consent || blocked();
        if (googleLoaded) env.gtag('consent','update',{analytics_storage:consent && !blocked() ? 'granted' : 'denied'});
        if (!consent && env.document.cookie) {
          env.document.cookie.split(';').forEach(part => {
            const name = part.trim().split('=')[0];
            if (/^_ga(?:_|$)/.test(name)) ['', '; domain=.antsjets.co.uk', '; domain=' + env.location.hostname].forEach(domain => {
              env.document.cookie = name + '=; Max-Age=0; path=/' + domain + '; Secure; SameSite=Lax';
            });
          });
        }
      }
      try { env.localStorage.setItem(key, JSON.stringify({allowed:consent, expires:Date.now()+180*86400000})); } catch (_) {}
      view();
    }
    function track(name, params) {
      if (!['call_click','text_click','whatsapp_click','quote_form_open'].includes(name)) return false;
      const data = {page};
      if (name === 'quote_form_open') {
        if (!params || !['cta','iframe_visible'].includes(params.source)) return false;
        data.source = params.source;
      }
      return send(name,data);
    }
    // For trusted first-party integration ONLY, after backend-verified successful submission.
    // Disabled until that integration is implemented. No postMessage/DOM submit inference.
    function recordVerifiedFormSubmit() {
      return config.verifiedFormSuccessEnabled === true && send('form_submit',{page});
    }
    return {setConsent,track,recordVerifiedFormSubmit,view,
      status:()=>({choice,allowed:consent && !blocked(),blocked:blocked(),configured:configured || googleConfigured,excluded})};
  }
  if (typeof module === 'object' && module.exports) { module.exports = {createAnalytics}; return; }
  const env = root;
  // A future GA4 implementation must keep this default before loading Google code.
  // Measurement ID slot is deliberately inert: NO Google requests, even after opting in.
  env.dataLayer = env.dataLayer || [];
  (function () {
    env.dataLayer.push(arguments);
  })('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
  const api = createAnalytics(env, env.ANTSJETS_ANALYTICS_CONFIG);
  env.AntsJetsAnalytics = api;
  if (api.status().excluded) return;
  const panel = document.createElement('section');
  panel.setAttribute('aria-label','Analytics privacy choices');
  panel.style.cssText = 'padding:16px;background:#f1f5f9;color:#0b1f33;border-bottom:1px solid #cbd5e1;font:16px/1.5 sans-serif;position:relative;z-index:2';
  const text = document.createElement('p');
  text.textContent = 'Optional analytics helps us understand visits and quote enquiries. It stays off unless you allow it. Your choice does not affect getting a quote.';
  panel.appendChild(text);
  const privacy = document.createElement('a'); privacy.href = '/privacy-policy.html'; privacy.textContent = 'Privacy policy'; panel.appendChild(privacy);
  const status = document.createElement('p'); status.setAttribute('role','status'); panel.appendChild(status);
  function refresh() {
    const s = api.status();
    status.textContent = s.blocked ? 'Analytics is off: your browser sends a privacy signal.' :
      s.allowed ? 'Analytics preference saved. You can withdraw at any time.' : 'Analytics is off.';
  }
  function button(label, action) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
    b.style.cssText = 'display:inline-block;margin:8px;padding:10px 16px;border:2px solid #0b1f33;border-radius:4px;background:white;color:#0b1f33;font:inherit;cursor:pointer';
    b.addEventListener('click', action); panel.appendChild(b); return b;
  }
  const allow = button('Allow analytics',()=>{api.setConsent(true);refresh();panel.hidden=true;});
  allow.disabled = api.status().blocked;
  button('Reject / withdraw analytics',()=>{api.setConsent(false);refresh();panel.hidden=true;});
  document.body.prepend(panel); refresh(); panel.hidden = api.status().choice || api.status().blocked || !api.status().configured;
  const settings = document.createElement('button'); settings.type='button'; settings.textContent='Analytics settings';
  settings.style.cssText='font:inherit;text-decoration:underline;padding:8px;cursor:pointer';
  settings.addEventListener('click',()=>{panel.hidden=false;refresh();panel.scrollIntoView({block:'start'});allow.focus();});
  (document.querySelector('.footer-bottom') || document.body).appendChild(settings);
  api.view();
  document.addEventListener('click', event => {
    const a = event.target.closest && event.target.closest('a[href]'); if (!a) return;
    const href = a.getAttribute('href');
    if (/^tel:/i.test(href)) api.track('call_click');
    else if (/^sms:/i.test(href)) api.track('text_click');
    else {
      let url; try { url = new URL(href,env.location.href); } catch (_) { return; }
      if (['wa.me','api.whatsapp.com','www.whatsapp.com'].includes(url.hostname) || url.protocol === 'whatsapp:') api.track('whatsapp_click');
      else if (url.origin === env.location.origin && /^\/contact(?:\.html)?\/?$/.test(url.pathname)) api.track('quote_form_open',{source:'cta'});
    }
  });
  // Visibility is a form-open signal, NEVER a submission. Do not inspect iframe contents.
  const frame = document.querySelector('iframe[id="inline-P391OQMNiIgPmiUGfN6W"]');
  if (frame && env.IntersectionObserver) {
    const observer = new env.IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting && e.intersectionRatio >= 0.25) &&
          api.track('quote_form_open',{source:'iframe_visible'})) observer.disconnect();
    },{threshold:0.25});
    observer.observe(frame);
  }
})(typeof window !== 'undefined' ? window : globalThis);
