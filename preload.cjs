const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  chooseSavePath: (defaultName) =>
    ipcRenderer.invoke("show-save-dialog", defaultName),
});
