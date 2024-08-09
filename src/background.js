// background.js
let blacklistedWebsites = new Set();
let blacklistLoadedPromise;

const MAX_CACHE_SIZE = 5000;
let urlCheckCache; 

let tabStates = {};
let resultsBuffer = {};

let ports = {};

const MAX_MESSAGES_PER_TAB = 300;
let lastSearchId = null;
let currentTabId = null;
let currentWindowId = null;
let urlRegexp;
const browser = window.browser || window.chrome;
const storage = browser.storage.sync || browser.storage.local;
let enableSearchFilter;
let enableSponsoredFilter;
let enableLogger;

async function initialize() {
  try {
    let data = await browser.storage.local.get([
      'blacklistedWebsites', 
      'tabStates', 
      'urlCheckCache', 
      'currentTabId', 
      'currentWindowId',
      'enableSearchFilter',
      'enableSponsoredFilter',
      'enableLogger'
    ]);
    blacklistedWebsites = new Set(data.blacklistedWebsites || []);
    tabStates = data.tabStates || {};
    urlCheckCache = new LRUCache(MAX_CACHE_SIZE);
    currentTabId = data.currentTabId || null;
    currentWindowId = data.currentWindowId || null;

    enableSearchFilter = data.enableSearchFilter !== undefined ? data.enableSearchFilter : true;
    enableSponsoredFilter = data.enableSponsoredFilter !== undefined ? data.enableSponsoredFilter : false;
    enableLogger = data.enableLogger !== undefined ? data.enableLogger : false;
  } catch (error) {
    console.error('Error while loading data: ', error);
  }
  urlRegexp = /^[a-zA-Z0-9.-]+\.(com|org|net|edu|gov|mil|aero|asia|biz|cat|coop|info|int|jobs|mobi|museum|name|post|pro|tel|travel|xxx|ac|ad|ae|af|ag|ai|al|am|an|ao|aq|ar|as|at|au|aw|ax|az|ba|bb|bd|be|bf|bg|bh|bi|bj|bm|bn|bo|br|bs|bt|bv|bw|by|bz|ca|cc|cd|cf|cg|ch|ci|ck|cl|cm|cn|co|cr|cu|cv|cx|cy|cz|de|dj|dk|dm|do|dz|ec|ee|eg|er|es|et|eu|fi|fj|fk|fm|fo|fr|ga|gb|gd|ge|gf|gg|gh|gi|gl|gm|gn|gp|gq|gr|gs|gt|gu|gw|gy|hk|hm|hn|hr|ht|hu|id|ie|il|im|in|io|iq|ir|is|it|je|jm|jo|jp|ke|kg|kh|ki|km|kn|kp|kr|kw|ky|kz|la|lb|lc|li|lk|lr|ls|lt|lu|lv|ly|ma|mc|md|me|mg|mh|mk|ml|mm|mn|mo|mp|mq|mr|ms|mt|mu|mv|mw|mx|my|mz|na|nc|ne|nf|ng|ni|nl|no|np|nr|nu|nz|om|pa|pe|pf|pg|ph|pk|pl|pm|pn|pr|ps|pt|pw|py|qa|re|ro|rs|ru|rw|sa|sb|sc|sd|se|sg|sh|si|sj|Ja|sk|sl|sm|sn|so|sr|ss|st|su|sv|sx|sy|sz|tc|td|tf|tg|th|tj|tk|tl|tm|tn|to|tp|tr|tt|tv|tw|tz|ua|ug|uk|us|uy|uz|va|vc|ve|vg|vi|vn|vu|wf|ws|ye|yt|yu|za|zm|zw)$/;
  resultsBuffer = {};
  lastSearchId = null;

  updateBlacklistPromise();
}

browser.runtime.onStartup.addListener(initialize);

browser.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install' || reason === 'update') {
    initialize();
  }
});

async function saveData() {
  try {
    if (!urlCheckCache) {
      urlCheckCache = new LRUCache(MAX_CACHE_SIZE);
    }
    await browser.storage.local.set({
      blacklistedWebsites: Array.from(blacklistedWebsites),
      tabStates: tabStates,
      urlCheckCache: urlCheckCache.toJSON(), 
      currentTabId: currentTabId, 
      currentWindowId: currentWindowId, 
      enableSearchFilter: enableSearchFilter,
      enableSponsoredFilter: enableSponsoredFilter, 
      enableLogger: enableLogger 
    });
  } catch (error) {
    console.error('Error while saving data: ', error);
  }
}

function updateBlacklistedWebsites(websites) {
  websites = websites || [];

  const validWebsites = [];
  for (let website of websites) {
    if (isValidUrl(website) || isValidDomain(website)) {
      validWebsites.push(website);
    }
  }
  blacklistedWebsites = new Set(validWebsites);
}

function updateBlacklistPromise() {
  blacklistLoadedPromise = storage.get(['blacklistedWebsites']).then((data) => {
    updateBlacklistedWebsites(data.blacklistedWebsites);
  });
}

browser.storage.onChanged.addListener(async function(changes, areaName) {
  if (areaName === 'sync' || areaName === 'local') { 
    if (changes.blacklistedWebsites) {
      updateBlacklistedWebsites(changes.blacklistedWebsites.newValue);
      updateBlacklistPromise();

      browser.tabs.query({}, function(tabs) {
        for (let tab of tabs) {
          sendMessage(tab.id, { command: 'update', blacklistedWebsites: Array.from(blacklistedWebsites) });
        }
      });
    }
    for (let key in changes) {
      if (key === 'enableSearchFilter' || key === 'enableSponsoredFilter' || key === 'enableLogger') {
        propagateStateChanges(key, changes[key].newValue);
      }
    }
  }
});

function propagateStateChanges(key, newValue) {
  browser.tabs.query({}, function(tabs) {
    for (let tab of tabs) {
      sendMessage(tab.id, { command: 'updateState', key: key, newValue: newValue });
    }
  });
}

class LRUCache {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.cache = new Map();

    browser.storage.local.get('cache', (data) => {
      this.cache = new Map(data.cache || []);
    });
  }

  get(key) {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);

    browser.storage.local.set({ cache: Array.from(this.cache) });
  }

  toJSON() {
    return Array.from(this.cache.entries());
  }
}

function isValidUrl(input) {
  return new Promise((resolve, reject) => {
    let cachedResult = urlCheckCache.get(input);
    if (cachedResult !== undefined) {
      resolve(cachedResult);
    } else {
      let isValid;
      try {
        new URL(input);
        isValid = true;
      } catch (error) {
        isValid = isValidDomain(input);
      }

      urlCheckCache.set(input, isValid);
      resolve(isValid);
    }
  });
}

function isValidDomain(domain) {
  return urlRegexp.test(domain);
}

function sendMessage(tabId, message, retryCount = 0) {
  if (!navigator.onLine || typeof tabId !== 'number') {
    return;
  }

  return browser.tabs.get(tabId).then(tab => {
    if (tab.status === 'complete') {
      return Promise.race([
        browser.tabs.sendMessage(tabId, { command: 'ready' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timed out')), 5000))
      ]).then(response => {
        if (response && response.ready) {
          return browser.tabs.sendMessage(tabId, { command: 'update', blacklistedWebsites: Array.from(blacklistedWebsites), ...message });
        }
      });
    }
  }).catch(e => {
    if ((e.message === 'Could not establish connection. Receiving end does not exist.' || e.message === 'Operation timed out') && retryCount < 3) {
      setTimeout(() => sendMessage(tabId, message, retryCount + 1), 1000);
    }
  });
}

browser.windows.onFocusChanged.addListener(function(windowId) {
  if (windowId !== browser.windows.WINDOW_ID_NONE) {
    browser.windows.get(windowId, {populate: true}, function(window) {
      if (!browser.runtime.lastError && window && window.type === 'normal' && window.focused) {
        const activeTab = window.tabs.find(tab => tab.active);
        if (activeTab) {
          if (/https?:\/\/(www\.)?google\./.test(activeTab.url)) {
            currentTabId = activeTab.id;
            tabStates[activeTab.id] = {active: true};
            saveData();
          }
        }
      }
    });
  }
});

browser.tabs.onRemoved.addListener(function(tabId, removeInfo) {
  if (tabId === currentTabId) {
    currentTabId = null;
  }
  delete tabStates[tabId];
  saveData();

  browser.storage.local.remove(tabId.toString(), function() {
    if (!browser.runtime.lastError && ports.logger) {
      ports.logger.postMessage({command: 'reloadMessages'});
    }
  });
});

browser.tabs.onActivated.addListener(function(activeInfo) {
  browser.tabs.get(activeInfo.tabId, function(tab) {
    if (!browser.runtime.lastError && activeInfo.windowId === currentWindowId && activeInfo.tabId === currentTabId) {
      currentTabId = activeInfo.tabId;
      if (!tabStates[activeInfo.tabId]) {
        tabStates[activeInfo.tabId] = {active: true, count: 0};
      } else {
        tabStates[activeInfo.tabId].active = true;
      }
      saveData();
      updateBadgeText(currentTabId);
    }
  });
});

function updateBadgeText(tabId) {
  let count = tabStates[tabId].count || 0;
  let badgeText;
  if (count > 99) {
    badgeText = '99+';
  } else if (count > 0) {
    badgeText = count.toString();
  } else {
    badgeText = '';
  }
  
  browser.browserAction.setBadgeText({text: badgeText, tabId: tabId});
  browser.browserAction.setBadgeBackgroundColor({color: "rgb(8,38,53)", tabId: tabId});
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command === 'getTabId') {
    return handleGetTabId(sendResponse);
  } else if (message.filteredCount !== undefined) {
    if (tabStates[message.tabId]) {
      tabStates[message.tabId].count = message.filteredCount;
      updateBadgeText(message.tabId);
    } else {
      console.warn(`Received message from untracked tab: ${message.tabId}`);
    }
  }
});

browser.tabs.onUpdated.addListener(async function(tabId, changeInfo, tab) {
  if (tab.windowId === currentWindowId) {
    currentTabId = tabId;
    saveData();
  }
  if (changeInfo.status === 'complete') {
    let url = new URL(tab.url);
    if (/google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(url.hostname) && url.pathname.startsWith('/search')) {
      let tbm = url.searchParams.get('tbm');
      let specializedSearchTypes = ['isch', 'vid', 'nws', 'shop', 'bks', 'fin'];
      if (!specializedSearchTypes.includes(tbm)) {
        await blacklistLoadedPromise;
        let result = urlCheckCache[tab.url];
        if (result === undefined) {
          result = await isValidUrl(tab.url);
          urlCheckCache[tab.url] = result;
        }

        if (result) {
          tabStates[tabId] = tabStates[tabId] || {};
        }

        tabStates[tabId] = tabStates[tabId] || {};
        tabStates[tabId].url = tab.url;
        tabStates[tabId].requestedBlacklist = true;
        saveData();

        try {
          browser.tabs.get(tabId, function(tab) {
            if (!browser.runtime.lastError && tab.status === 'complete') {
              browser.tabs.sendMessage(tabId, { command: 'rejudge', blacklistedWebsites: Array.from(blacklistedWebsites) }).catch(() => {});
            }
          });    
        } catch (error) {
          let retryCount = 0;
          let maxRetries = 3;
          while (retryCount < maxRetries) {
            try {
              browser.tabs.get(tabId, function(tab) {
                if (!browser.runtime.lastError && tab.status === 'complete') {
                  browser.tabs.sendMessage(tabId, { command: 'rejudge', blacklistedWebsites: Array.from(blacklistedWebsites) }).catch(() => {});
                }
              });
              break;
            } catch (error) {
              retryCount++;
            }
          }
        }
        
      }
    }
  }
});

browser.webNavigation.onCommitted.addListener(async function(details) {
  if (details.transitionType === "reload"|| details.transitionType === "link" || details.transitionType === "typed") {

    await blacklistLoadedPromise;

    let key = `${details.tabId}`;
    try {
      await browser.storage.local.remove(key);
      if (ports.logger) {
        ports.logger.postMessage({command: 'reloadMessages'});
      }
    } catch (error) {
      let retryCount = 0;
      let maxRetries = 3;
      while (retryCount < maxRetries) {
        try {
          await browser.storage.local.remove(key);
          if (ports.logger) {
            ports.logger.postMessage({command: 'reloadMessages'});
          }
          break;
        } catch (error) {
          retryCount++;
        }
      }
    }
  }
});

browser.runtime.onConnect.addListener(function(port) {
  if (port.name === 'logger' || port.name === 'searchQuery') {
    ports[port.name] = port;
    port.onMessage.addListener(function(message) {
      let tabId = message.tabId;
      if (message.command === 'getMessages') {
        let key = `${tabId}`;
        new Promise((resolve, reject) => {
          browser.storage.local.get(key, function(data) {
            let messages = data[key] || [];
            resolve({messages});
          });
        }).then((result) => {
          if (port) {
            port.postMessage(result);
          }
        });
        return true; 
      } else if (message.command === 'searchQueryChanged') {
          return handleSearchQueryChanged(message, tabId);
      }
      if (message && message.messages) {
        let messages = message.messages.filter(msg => msg.type === 'stats' || msg.type === 'filtered' || msg.type === 'adStats');
        let key = `${tabId}`;
        new Promise((resolve, reject) => {
          browser.storage.local.get(key, function(data) {
            let existingMessages = data[key] || [];
    
            let updatedMessages = existingMessages.concat(messages.filter((msg) =>
              !existingMessages.some((exMsg) => exMsg.content === msg.content && exMsg.searchQuery === msg.searchQuery)
            ));
    
            if (updatedMessages.length > MAX_MESSAGES_PER_TAB) {
              updatedMessages = updatedMessages.slice(updatedMessages.length - MAX_MESSAGES_PER_TAB);
            }
    
            browser.storage.local.set({[key]: updatedMessages}, function() {
              if (browser.runtime.lastError) {
                console.error(`Error saving messages for tab ${tabId}: ${browser.runtime.lastError.message}`);
                reject(browser.runtime.lastError);
              } else {
                resolve(updatedMessages);
              }
            });
          });
        }).then((updatedMessages) => {

            if (ports.logger) {
              ports.logger.postMessage({tabId: tabId, messages: updatedMessages});
            }
          
        });
        return true;
      }
  });
  port.onDisconnect.addListener(function() {
    delete ports[port.name];
  });
}
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command === 'getTabId') {
    return handleGetTabId(sendResponse);
  }
});

function handleGetTabId(sendResponse) {
  browser.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!browser.runtime.lastError && tabs.length > 0) {
      sendResponse({tabId: tabs[0].id});
    }
  });
  return true;
}

function handleSearchQueryChanged(message, tabId) {
  if (tabId !== null) {
    tabStates[tabId] = { lastSearchQuery: message.newSearchQuery, lastSearchId: message.searchId };
    saveData(); 
    if (ports['searchQuery']) {
      ports['searchQuery'].postMessage({result: 'Search query updated'});
    }
  }
}
