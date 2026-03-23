const { app, BrowserWindow } = require('electron');
const path = require('path');
// Import and boot up our local Express Server dynamically
require('./server'); 

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 850,
        minWidth: 800,
        minHeight: 600,
        titleBarStyle: 'hiddenInset', // Native macOS transparent window controls
        backgroundColor: '#0a0a0f',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    // Wait 1 second for Express to formally bind to port 3000, then load the UI
    setTimeout(() => {
        mainWindow.loadURL('http://localhost:3000');
    }, 1000);

    // Smooth exact window appearance
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    // Standard macOS behavior: keep process running in dock even if window is closed
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
