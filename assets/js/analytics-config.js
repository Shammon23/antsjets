/* Public configuration, not credentials. Leave IDs empty until real properties exist. */
window.ANTSJETS_ANALYTICS_CONFIG = {
  umami: {
    endpoint: 'https://analytics.antsjets.co.uk',
    websiteId: ''
  },
  // GA4 stays disabled until Sean supplies a real property ID. Loader is consent-gated.
  ga4: { measurementId: '', enabled: false },
  // Enable ONLY alongside trusted code verifying actual GHL/backend submission success.
  verifiedFormSuccessEnabled: false
};
