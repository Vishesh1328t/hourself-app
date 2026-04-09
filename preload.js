const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    loadData: () => ipcRenderer.sendSync('load-data'),
    saveData: (data) => ipcRenderer.send('save-data', data)
});
