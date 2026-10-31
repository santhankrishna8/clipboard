// The only bridge between a window and the main process: call(channel, ...args), send(...), on(callback).
const { contextBridge, ipcRenderer } = require('electron');

const plain = (e) => new Error(String((e && e.message) || e).replace(/^Error invoking remote method '[^']*': (Error: )?/, ''));

contextBridge.exposeInMainWorld('clip', {
  call: (channel, ...args) => ipcRenderer.invoke(channel, ...args).catch((e) => { throw plain(e); }),
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
  on: (cb) => {
    const listener = (_e, name, payload) => cb(name, payload);
    ipcRenderer.on('evt', listener);
    return () => ipcRenderer.removeListener('evt', listener);
  },
});
