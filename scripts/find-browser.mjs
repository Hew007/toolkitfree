import fs from 'node:fs';

const installPaths = {
  Chrome: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ],
  Edge: [
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/microsoft-edge',
  ],
};

export function findBrowser(browserName = 'Chrome') {
  const name = browserName === 'Edge' ? 'Edge' : 'Chrome';
  const candidates = [
    process.env.BROWSER_PATH,
    process.env.CHROME_PATH,
    ...installPaths[name],
  ].filter(Boolean);
  const match = candidates.find((candidate) => fs.existsSync(candidate));
  if (!match) {
    throw new Error(`${name} was not found. Set BROWSER_PATH to run browser tests.`);
  }
  return match;
}
