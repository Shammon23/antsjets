// Capture common attribution values for the future GHL form integration.
(function(){
  const params = new URLSearchParams(window.location.search);
  const keys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
  keys.forEach(k => { if (params.get(k)) sessionStorage.setItem(k, params.get(k)); });
  document.querySelectorAll('form').forEach(form => {
    keys.concat(['landing_page']).forEach(k => {
      const input = form.querySelector(`[name="${k}"]`);
      if (!input) return;
      input.value = k === 'landing_page' ? window.location.pathname : (sessionStorage.getItem(k) || '');
    });
    form.addEventListener('submit', e => {
      if (form.dataset.ghlPlaceholder === 'true') {
        e.preventDefault();
        alert('Thanks — this is the first website build. The live quote form will be connected to GHL next. For now, please call 07920 401090 or email info@antsjets.co.uk.');
      }
    });
  });
})();
