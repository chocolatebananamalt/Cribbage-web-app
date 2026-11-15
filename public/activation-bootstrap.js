(() => {
  function capture() {
    if (window.location.pathname !== "/activate") return;
    const value = window.location.hash.slice(1);
    if (!value) return;
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    delete window.__accActivationCredential;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/i.test(value)) {
      window.__accActivationCredential = value;
    }
  }
  window.addEventListener("pagehide", () => { delete window.__accActivationCredential; });
  window.addEventListener("hashchange", capture);
  window.addEventListener("acc-activation-capture", capture);
  capture();
})();
