(() => {
  const value = window.location.hash.slice(1);
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/i.test(value)) {
    window.__accRegistrationCredential = value;
  }
})();
