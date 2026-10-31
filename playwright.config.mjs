import { defineConfig, devices } from '@playwright/test';

// Chrome is the daily desktop and phone check. SwiftShader is what this
// environment and GitHub-hosted runners use when there is no GPU.
const chrome = {
  channel: 'chrome',
  launchOptions: { args: ['--enable-unsafe-swiftshader'] },
};

// iPhone 13 is the Safari check: a 390×844 WebKit viewport with touch, the
// phone most DeskLab visitors in China actually use. Firefox is the other
// desktop engine. Neither inherits Chrome's channel or SwiftShader flag.
const iphone = devices['iPhone 13'];

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5174',
    headless: true,
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  },
  projects: [
    { name: 'desktop', use: { ...chrome, viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...chrome, viewport: { width: 390, height: 844 } } },
    { name: 'webkit-iphone', use: { ...iphone } },
    { name: 'firefox', use: { browserName: 'firefox', viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
