const { app, BrowserWindow, shell, session } = require('electron');
const START_URL = 'https://resumeweave.jjhuang.chatgpt.site/';
function createWindow() {
  const window = new BrowserWindow({
    title: 'ResumeWeave', width: 1440, height: 900, minWidth: 980, minHeight: 680,
    backgroundColor: '#5b4bff', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('https://') && !url.startsWith('http://')) event.preventDefault();
  });
  window.loadURL(START_URL);
}
const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();
else {
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (window) { if (window.isMinimized()) window.restore(); window.focus(); }
  });
  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      callback(['media', 'geolocation', 'clipboard-sanitized-write'].includes(permission));
    });
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
}
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
