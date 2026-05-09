// CommonJS wrapper so Electron (which can't use top-level ESM await) can start the server.
// This file bootstraps the ESM server module via a dynamic import.
(async () => {
  await import("./index.js");
})();
