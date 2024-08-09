class Extension {
  constructor() {
    this.port = browser.runtime.connect({name: "logger"});
    this.searchQueryPort = browser.runtime.connect({name: "searchQuery"});
    this.observer = null;

    this.urlCheckPromises = new Map();
    this.blacklistedWebsites = new Set();
    this.blacklistedWebsitesPromise = Promise.resolve(new Set());
    this.messageQueue = [];
    this.addedNodesQueue = [];

    this.filteredCount = 0;
    this.filteredUrls = new Set();
    this.processedResults = new Set();
    this.displayedResults = new Set();

    this.filteredAdsCount = 0;
    this.filteredContainersCount = 0;
    this.newAdsCount = 0;

    this.lastSearchQuery = '';
    this.searchId = 0;
    // Use feature detection to ensure compatibility with both Manifest V2 and V3
    const storage = browser.storage.sync || browser.storage.local;
    storage.get(['enableSearchFilter', 'enableSponsoredFilter', 'enableLogger'], (data) => {
      this.enableSearchFilter = data.enableSearchFilter;
      this.enableSponsoredFilter = data.enableSponsoredFilter;
      this.enableLogger = data.enableLogger;
    });
  }

  setupListeners() {
    browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.command === 'rejudge' || request.blacklistedWebsites || request.command === 'update') {
        const storage = browser.storage.sync || browser.storage.local;
        storage.get('blacklistedWebsites', (data) => {
          this.blacklistedWebsites = new Set(data.blacklistedWebsites);
          this.blacklistedWebsitesPromise = Promise.resolve(new Set(data.blacklistedWebsites));
          this.filterSearchResults(this.blacklistedWebsites, true);
        });
        return;
      }
      else if (request.command === 'ready') {
        sendResponse({ ready: true });
        return;
      } else if (request.command === 'test') {
        sendResponse({status: 'ok'});
      } else if (request.command === 'updateState') {
        this.updateState(request.key, request.newValue);
      }
    });
    
    this.blacklistedWebsitesPromise.then(() => this.setupObserver());
  }

  updateState(key, newValue) {
    try {
      switch (key) {
        case 'enableSearchFilter':
          this.enableSearchFilter = newValue;
          break;
        case 'enableSponsoredFilter':
          this.enableSponsoredFilter = newValue;
          break;
        case 'enableLogger':
          this.enableLogger = newValue;
          this.setupSearchBoxObserver();
          break;
        default:
          throw new Error(`Invalid key: ${key}`);
      }
    } catch (error) {
      console.error(`Error in updateState: ${error.message}`);
    }
  }
  
  handleAddedNode(node) {
    return this.filterSearchResults(true);
  }

  async processAddedNodes() {
    while (this.addedNodesQueue.length > 0) {
      const node = this.addedNodesQueue.shift();
      await this.handleAddedNode(node);
    }
  }

  handleRemovedNode(node) {
    this.processedResults.delete(node);
  }

  setupObserver() {
    this.observer = new MutationObserver((mutations) => {
    // Get the current URL
    let url = new URL(window.location.href);

    if (/google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(url.hostname) && url.pathname.startsWith('/search')) {
      let tbm = url.searchParams.get('tbm');
      let specializedSearchTypes = ['isch', 'vid', 'nws', 'shop', 'bks', 'fin'];

      if (specializedSearchTypes.includes(tbm)) {
        this.observer.disconnect();
        return;
      }
    }

    mutations.forEach(mutation => {
      try {
        mutation.addedNodes.forEach(node => {
          if (node instanceof HTMLElement && !this.processedResults.has(node)) {
            this.addedNodesQueue.push(node);
            this.processedResults.add(node);
          }
        });

        mutation.removedNodes.forEach(node => {
          if (node instanceof HTMLElement && this.processedResults.has(node)) {
            this.handleRemovedNode(node);
          }
        });
      } catch (error) {
        console.error('Error processing mutation:', error);
      }
    });
    
    if (this.addedNodesQueue.length > 0) {
      this.processAddedNodes();
    }
  });

  this.observer.observe(document, { childList: true, subtree: true });

  window.addEventListener('popstate', this.handlePageNavigation.bind(this));
}

handlePageNavigation = async () => {
  let url = new URL(window.location.href);

  if (/google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(url.hostname) && url.pathname.startsWith('/search')) {
    let tbm = url.searchParams.get('tbm');
    let specializedSearchTypes = ['isch', 'vid', 'nws', 'shop', 'bks', 'fin'];

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    await Promise.all(Array.from(this.processedResults, node => this.handleAddedNode(node)));

    this.processedResults.clear();
    this.filteredUrls.clear();

    if (!specializedSearchTypes.includes(tbm)) {
      this.setupObserver(this.blacklistedWebsites);
    }
  } else {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

normalizeWebsite(website) {
  return website.replace(/^(http:\/\/|https:\/\/|www\.)/, '').replace(/\/$/, '');
}

isBlacklisted(url) {
  if (this.urlCheckPromises.has(url)) {
    return this.urlCheckPromises.get(url);
  }

  let checkPromise = new Promise((resolve) => {
    let actualUrl;
    let hostname;
    try {
      actualUrl = new URL(url);
      hostname = actualUrl.hostname.toLowerCase();
    } catch (error) {
      resolve(false);
      return;
    }    

    if (hostname) {
      this.blacklistedWebsitesPromise.then(blacklistedWebsites => {
        let isBlacklisted = hostname.split('.').some((part, index, parts) => {
          let subdomain = parts.slice(index).join('.');
          return blacklistedWebsites.has(subdomain);
        });
        resolve(isBlacklisted);
      });
    } else {
      resolve(false);
    }
  });

  this.urlCheckPromises.set(url, checkPromise);

  checkPromise.finally(() => {
    this.urlCheckPromises.delete(url);
  });

  return checkPromise;
}

getTabId() {
  return new Promise(resolve => {
    browser.runtime.sendMessage({command: 'getTabId'}, function(response) {
      resolve(response.tabId);
    });
  });
}

async setupSearchBoxObserver() {
    if (!this.enableLogger) {
      if (this.searchBoxObserver) {
        this.searchBoxObserver.disconnect();
      }
      return;
    }
  this.searchBoxObserver = new MutationObserver(async (mutations) => {
    const searchBox = document.querySelector('input[name="q"]');
    if (searchBox && searchBox.value !== this.lastSearchQuery) {
      this.displayedResults.clear();
      let tabId = await this.getTabId();
      if (tabId !== undefined) {
        if (searchBox.value !== this.lastSearchQuery) {
          this.sendportMessage(this.searchQueryPort, {
            command: 'searchQueryChanged', 
            newSearchQuery: searchBox.value,
            searchId: this.searchId,
            timestamp: Date.now(),
            tabId: tabId
          });
          this.lastSearchQuery = searchBox.value;
        }
      }
      this.searchId++;
    }
  });
  this.searchBoxObserver.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['value'] });
}

sendportMessage(port, message) {
  let retries = 3;
  let delay = 500;

  const tryPostMessage = () => {
    try {
      port.postMessage(message);
      if (this.messageQueue.length > 0) {
        this.sendportMessage(port, this.messageQueue.shift());
      }
    } catch (error) {
      if (retries > 0) {
        retries--;
        port = browser.runtime.connect({name: "searchQuery"});
        setTimeout(tryPostMessage, delay);
        delay *= 2;
      } else {
        this.messageQueue.push(message);
      }
    }
  }

  tryPostMessage();
}

identifyElements(selector) {
  return document.querySelectorAll(selector);
}

buildFilteredMessage(url, header, hostname) {
  return {
      type: 'filtered',
      content: `FILTERED - "${header ? header.textContent : url}", Hostname: ${hostname}`
  };
}

async filterSearchResults(rejudge = false) {
  const searchResults = this.identifyElements('div.g:not(.liYKde), div.M8OgIe:not(.liYKde)');
  const messages = [];
  const hasBlacklistedWebsites = this.blacklistedWebsites.length !== 0;
  let promises = [];

  if (this.enableSearchFilter) {
  for (let [index, result] of searchResults.entries()) {
      const header = result.querySelector('h3');
      const link = result.querySelector('a');
      if (link) {
        let urlToCheck = link.href.trim();
        if (urlToCheck.includes('/url?')) {
          urlToCheck = new URL(urlToCheck).searchParams.get('url');
        }
        if (urlToCheck !== '' && (rejudge || !this.filteredUrls.has(urlToCheck))) {
          try {
            const hostname = new URL(urlToCheck).hostname;
            promises.push(this.isBlacklisted(urlToCheck).then(isBlacklisted => {
              if (isBlacklisted && hasBlacklistedWebsites) {
                result.style.display = 'none';
                if (!this.filteredUrls.has(urlToCheck)) {
                  this.filteredUrls.add(urlToCheck);
                  this.filteredCount++;
                  messages.push(this.buildFilteredMessage(urlToCheck, header, hostname));
                }

              } else {
                this.displayedResults.add(result);
              }
            }));
          } catch (error) {
            continue;
          }
        }
      
    }
  }
}

  await Promise.all(promises);
    await this.filterSponsoredContainers();
    await this.sendMessages(messages);
}

async sendMessages(messages) {
  let tabId = await this.getTabId();
  browser.runtime.sendMessage({
    tabId: tabId,
    filteredCount: this.filteredCount
  });
  
    if (!this.enableLogger) {
      return;
    }
  
  return new Promise((resolve, reject) => {
    if (messages.length === 0) {
      resolve();
      return;
    }
    this.messageQueue.push(...messages);

    try {
      if (!this.port) {
        this.port = browser.runtime.connect({name: "logger"});
        if (!this.port) {
          resolve();
          return;
        }
        this.port.onDisconnect.addListener(() => {
          this.port = null;
        });
      }

      this.port.postMessage({
        messages: [
          {
            type: 'stats',
            content: `Number of filtered search results: ${this.filteredCount}`
          },
          ...this.messageQueue
        ],
        searchQuery: this.lastSearchQuery,
        searchId: this.searchId,
        tabId: tabId
      });
      this.messageQueue = [];
      resolve();
    } catch (error) {
      console.error('Error sending messages:', error); // Log the error
      reject(error);
    }
  });
}

async sendAdStatsMessages() {
  if (this.newAdsCount === 0) {
    return;
  }

  const adStatsMessage = {
    type: 'adStats',
    content: `Filtered Ads: ${this.filteredAdsCount}`
  };

  this.messageQueue.push(adStatsMessage);

  await this.sendMessages(this.messageQueue);

  this.messageQueue = [];
  this.newAdsCount = 0;
}

isDtldBlacklisted(dtld) {
  if (this.blacklistedWebsites.length === 0) {
    return false;
  }
  const normalizedDtld = this.normalizeWebsite(dtld);
  return this.blacklistedWebsites.has(normalizedDtld);
}

  async filterContainer(container) {
    if (!this.enableSponsoredFilter) {
      return;
    }
    const sponsoredContent = Array.from(this.identifyElements('[data-pla-slot-pos], div.uEierd', container));

    if (sponsoredContent.length === 0) {
      return;
    }
    const hasBlacklistedWebsites = this.blacklistedWebsites.length !== 0;

    let promises = sponsoredContent.map(async (content) => {
      const dtldElement = content.querySelector('[data-dtld]');
      const dtld = dtldElement ? dtldElement.getAttribute('data-dtld') : null;
      const link = content.querySelector('.plantl.pla-unit-single-clickable-target.clickable-card');
      const urlToCheck = link ? link.href.trim() : null;

      if ((dtld && this.isDtldBlacklisted(dtld)) || (urlToCheck && await this.isBlacklisted(urlToCheck))) {
        if (hasBlacklistedWebsites && !content.hasAttribute('data-filtered')) {
          this.filteredAdsCount++;
          this.newAdsCount++;
          content.style.display = 'none'; 
          content.setAttribute('data-filtered', '');
          await this.sendAdStatsMessages();
        }
      }
    });
    if (this.newAdsCount > 0) {
      await this.sendAdStatsMessages();
      this.newAdsCount = 0;
    }
    await Promise.all(promises);
  }

  async filterSponsoredContainers() {
    if (!this.enableSponsoredFilter) {
      return;
    }
    const sponsoredContainers = Array.from(this.identifyElements('[data-pla][data-pla-slot], div.uEierd'));
    
    // Use Promise.all to process all containers in parallel
    await Promise.all(sponsoredContainers.map(async (container) => {
      if (!container.hasAttribute('data-container-filtered')) {
        await this.filterContainer(container);
        const allBlacklisted = Array.from(container.querySelectorAll('[data-pla-slot-pos]')).every(content => content.style.display === 'none');
        if (allBlacklisted && this.blacklistedWebsites.length !== 0) {
          container.style.display = 'none';
          container.setAttribute('data-container-filtered', '');
          this.filteredContainersCount++;
          const adsInContainer = container.querySelectorAll('[data-pla-slot-pos]').length;
          this.newAdsCount += adsInContainer; 
          
          this.filteredAdsCount += adsInContainer;
          
          if (this.newAdsCount > 0) {
            await this.sendAdStatsMessages();
            this.newAdsCount = 0;
          }
        }
      }
    }));
  }
}

const extension = new Extension();
extension.setupListeners();
extension.setupSearchBoxObserver();
