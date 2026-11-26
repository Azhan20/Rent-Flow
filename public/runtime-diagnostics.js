(() => {
  const safeErrorType = (value) => {
    const name = value && typeof value.name === 'string' ? value.name : '';
    return /^[A-Za-z]+Error$/.test(name) ? name : 'Error';
  };

  window.addEventListener('error', (event) => {
    if (event.target && event.target !== window) {
      const assetType = event.target.tagName === 'SCRIPT'
        ? 'script'
        : event.target.tagName === 'LINK'
          ? 'style-or-preload'
          : 'resource';
      console.error(JSON.stringify({ area: 'frontend.asset', outcome: 'load_failed', assetType }));
      return;
    }
    console.error(JSON.stringify({ area: 'frontend.runtime', errorType: safeErrorType(event.error) }));
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    console.error(JSON.stringify({ area: 'frontend.runtime', failure: 'unhandled_rejection', errorType: safeErrorType(event.reason) }));
  });
})();
