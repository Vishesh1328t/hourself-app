const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

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
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Load the HTML natively without any backend logic
    mainWindow.loadFile('index.html');

    // Smooth exact window appearance
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
}

app.whenReady().then(() => {
    const dataPath = path.join(app.getPath('userData'), 'hourself_data.json');

    ipcMain.on('load-data', (event) => {
        try {
            if (fs.existsSync(dataPath)) {
                event.returnValue = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
            } else {
                event.returnValue = {};
            }
        } catch (error) {
            console.error('Error loading data:', error);
            event.returnValue = {};
        }
    });

    ipcMain.on('save-data', (event, data) => {
        try {
            fs.writeFileSync(dataPath, JSON.stringify(data));
        } catch (error) {
            console.error('Error saving data:', error);
        }
    });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
