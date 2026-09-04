const TOKEN_STORAGE_KEY = 'zendeskToken';
const TOKEN_TIMESTAMP_STORAGE_KEY = 'zendeskTokenTimestamp';
const TOKEN_EXPIRATION_TIME = 50 * 60 * 1000;
const WAIT_TIMEOUT = 8000;
const WAIT_INTERVAL = 200;

let initialized = false;
let initializingPromise = null;
let widgetListenersBound = false;
let outsideClickTimer = null;

function waitForZendesk() {
  if (window.zE) {
    return Promise.resolve(window.zE);
  }

  return new Promise(resolve => {
    const startTime = new Date().getTime();
    const timer = setInterval(() => {
      if (window.zE) {
        clearInterval(timer);
        resolve(window.zE);
        return;
      }

      if (new Date().getTime() - startTime >= WAIT_TIMEOUT) {
        clearInterval(timer);
        resolve(null);
      }
    }, WAIT_INTERVAL);
  });
}

async function fetchZendeskToken() {
  try {
    const token = await window.mdyAPI('Zendesk', 'GetWidgetJwt', {});

    if (!token) return;

    window.safeLocalStorageSetItem(TOKEN_STORAGE_KEY, token);
    window.safeLocalStorageSetItem(TOKEN_TIMESTAMP_STORAGE_KEY, new Date().getTime().toString());
    return token;
  } catch (error) {
    console.error('Error fetching Zendesk token:', error);
  }
}

function getZendeskToken() {
  const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  const timestamp = window.localStorage.getItem(TOKEN_TIMESTAMP_STORAGE_KEY);

  if (token && timestamp && new Date().getTime() - parseInt(timestamp, 10) < TOKEN_EXPIRATION_TIME) {
    return Promise.resolve(token);
  }

  return fetchZendeskToken();
}

function hideZendeskLauncher() {
  if (window.zE) {
    window.zE('messenger', 'hide');
  }
}

function closeZendeskWidget() {
  if (window.zE) {
    window.zE('messenger', 'close');
  }
}

function handleZendeskOpen() {
  clearTimeout(outsideClickTimer);
  outsideClickTimer = setTimeout(() => {
    document.body.addEventListener('click', closeZendeskWidget, false);
    outsideClickTimer = null;
  }, 0);
}

function handleZendeskClose() {
  clearTimeout(outsideClickTimer);
  outsideClickTimer = null;
  document.body.removeEventListener('click', closeZendeskWidget, false);
  hideZendeskLauncher();
}

function bindWidgetListeners() {
  if (!window.zE || widgetListenersBound) return;

  window.zE('messenger:on', 'open', handleZendeskOpen);
  window.zE('messenger:on', 'close', handleZendeskClose);
  widgetListenersBound = true;
}

export async function initZendeskWidget({ hide = true } = {}) {
  if (initialized) {
    if (hide) {
      hideZendeskLauncher();
    }

    return true;
  }

  if (!initializingPromise) {
    initializingPromise = waitForZendesk()
      .then(async zE => {
        if (!zE) return false;

        if (hide) {
          hideZendeskLauncher();
        }

        const token = await getZendeskToken();
        if (!token || !window.zE) return false;

        window.zE('messenger', 'loginUser', callback => callback(token));
        initialized = true;
        return true;
      })
      .catch(error => {
        console.error('Error initializing Zendesk:', error);
        return false;
      });
  }

  const result = await initializingPromise;
  initializingPromise = null;

  if (result && hide) {
    hideZendeskLauncher();
  }

  return result;
}

export async function openZendeskWidget() {
  const ready = await initZendeskWidget({ hide: false });

  if (!ready || !window.zE) return false;

  bindWidgetListeners();
  window.zE('messenger', 'show');
  window.zE('messenger', 'open');
  return true;
}
