let logger;
let port = browser.runtime.connect({name: "logger"});

const popup = document.getElementById('popup');
const toggleLoggerBtn = document.getElementById('toggle-logger');
const urlRegexp = /^[a-zA-Z0-9.-]+\.(com|org|net|edu|gov|mil|aero|asia|biz|cat|coop|info|int|jobs|mobi|museum|name|post|pro|tel|travel|xxx|ac|ad|ae|af|ag|ai|al|am|an|ao|aq|ar|as|at|au|aw|ax|az|ba|bb|bd|be|bf|bg|bh|bi|bj|bm|bn|bo|br|bs|bt|bv|bw|by|bz|ca|cc|cd|cf|cg|ch|ci|ck|cl|cm|cn|co|cr|cu|cv|cx|cy|cz|de|dj|dk|dm|do|dz|ec|ee|eg|er|es|et|eu|fi|fj|fk|fm|fo|fr|ga|gb|gd|ge|gf|gg|gh|gi|gl|gm|gn|gp|gq|gr|gs|gt|gu|gw|gy|hk|hm|hn|hr|ht|hu|id|ie|il|im|in|io|iq|ir|is|it|je|jm|jo|jp|ke|kg|kh|ki|km|kn|kp|kr|kw|ky|kz|la|lb|lc|li|lk|lr|ls|lt|lu|lv|ly|ma|mc|md|me|mg|mh|mk|ml|mm|mn|mo|mp|mq|mr|ms|mt|mu|mv|mw|mx|my|mz|na|nc|ne|nf|ng|ni|nl|no|np|nr|nu|nz|om|pa|pe|pf|pg|ph|pk|pl|pm|pn|pr|ps|pt|pw|py|qa|re|ro|rs|ru|rw|sa|sb|sc|sd|se|sg|sh|si|sj|Ja|sk|sl|sm|sn|so|sr|ss|st|su|sv|sx|sy|sz|tc|td|tf|tg|th|tj|tk|tl|tm|tn|to|tp|tr|tt|tv|tw|tz|ua|ug|uk|us|uy|uz|va|vc|ve|vg|vi|vn|vu|wf|ws|ye|yt|yu|za|zm|zw)$/;

port.onMessage.addListener(function (message) {
  if (message && message.messages) {
    const existingMessages = document.querySelectorAll('.message, div[data-type="statsUpdated"], div[data-type="adStatsUpdated"]');
    existingMessages.forEach(message => message.remove());

    message.messages.forEach((message) => {
      if (message.type === 'stats') {
        handleStatsUpdated(message.content);
      } else if (message.type === 'adStats') {
        handleAdStatsUpdated(message.content);
      } else {
        appendMessage(message.content);
      }
    });
  }
});

function isValidUrl(input) {
    try {
        new URL(input);
        return true;
    } catch (error) {
        return false;
    }
}

function isValidDomain(domain) {
  return urlRegexp.test(domain);
}

function extractBaseDomain(url) {
  let hostname;
  if (url.indexOf("://") > -1) {
      hostname = url.split('/')[2];
  }
  else {
      hostname = url.split('/')[0];
  }

  hostname = hostname.split('?')[0];

  let domain = hostname;

  if (hostname.lastIndexOf(".") > 0) {
      let parts = hostname.split(".");
      let cnt = parts.length;
      let tld = parts[cnt - 1];
      let tld2 = parts[cnt - 2];
      domain = tld2 + "." + tld;
  }

  return domain;
}

function normalizeWebsite(website) {
  return website.replace(/^(http:\/\/|https:\/\/|www\.)/, '').replace(/\/$/, '');
}

async function saveBlacklistedWebsites(blacklistedWebsites) {
  let retryCount = 0;
  let maxRetries = 3;
  const storage = browser.storage.sync || browser.storage.local;
  while (retryCount < maxRetries) {
    try {
      await new Promise((resolve, reject) => {
        storage.set({ blacklistedWebsites }, function () {
          if (browser.runtime.lastError) {
            reject(browser.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
      break; 
    } catch (error) {
      retryCount++;
      if (retryCount === maxRetries) {
        throw error;
      }
    }
  }
}

async function updateBlacklistedWebsites(blacklistedWebsites) {
  return new Promise((resolve, reject) => {
      const blacklistedTextarea = document.getElementById('blacklistedWebsites');
      const displayWebsites = blacklistedWebsites.map(website => normalizeWebsite(website));
      blacklistedTextarea.value = displayWebsites.join('\n');
      resolve();
  });
}

function createMessageElement(type, stats) {
  const messageElement = document.createElement('div');
  messageElement.dataset.type = type;

  if (type === 'statsUpdated') {
    let formattedMessage = '';
    if (stats.filteredCount) {
      formattedMessage += `Number of filtered search results: ${stats.filteredCount}`;
      const spanElement = document.createElement('span');
      spanElement.style.color = 'rgb(255,182,66)';
      spanElement.textContent = formattedMessage;
      messageElement.appendChild(spanElement);
    }
  } else if (type === 'adStatsUpdated') {
    let formattedMessage = '';
    if (stats.filteredAdsCount) {
      formattedMessage += `Filtered Ads: ${stats.filteredAdsCount}`;
      const spanElement = document.createElement('span');
      spanElement.style.color = 'rgb(184,39,98)';
      spanElement.textContent = formattedMessage;
      messageElement.appendChild(spanElement);
    }
  } else {
    let formattedMessage = JSON.stringify(stats);
    const textNode = document.createTextNode(formattedMessage);
    messageElement.appendChild(textNode);
  }
  return messageElement;
}

function handleStatsUpdated(message) {
  let stats = {};

  let match = message.match(/Number of filtered search results: (\d+)/);
  if (match) {
    stats.filteredCount = match[1];
  }

  updateSummaryMessage(stats, 'statsUpdated');
}

function handleAdStatsUpdated(message) {
  let adStats = {}; 

  let match = message.match(/Filtered Ads: (\d+)/);
  if (match) {
    adStats.filteredAdsCount = match[1];
  }

  updateSummaryMessage(adStats, 'adStatsUpdated');
}

function updateSummaryMessage(stats, type) {
  const existingMessage = document.querySelector(`div[data-type="${type}"]`);
  const newMessage = createMessageElement(type, stats);

  if (existingMessage) {
    existingMessage.parentNode.replaceChild(newMessage, existingMessage);
  } else {
    if (type === 'statsUpdated') {
      logger.insertBefore(newMessage, logger.firstChild);
    } else if (type === 'adStatsUpdated') {
      const statsUpdatedMessage = document.querySelector(`div[data-type="statsUpdated"]`);
      if (statsUpdatedMessage && statsUpdatedMessage.nextSibling) {
        logger.insertBefore(newMessage, statsUpdatedMessage.nextSibling);
      } else {
        logger.appendChild(newMessage);
      }
    } else {
      logger.appendChild(newMessage);
    }
  }
}

function appendMessage(message, type) {
  let content = typeof message === 'object' ? JSON.stringify(message) : message;

  const msg = document.createElement('div');
  msg.textContent = content;
  msg.classList.add('message');
  msg.dataset.content = content; 

  let fragment = document.createDocumentFragment();
  fragment.appendChild(msg);

  if (type === 'filtered') {
    const existingMessage = document.querySelector(`div[data-content="${content.replace(/"/g, '\\"')}"]`);
    if (!existingMessage) {
      logger.appendChild(fragment);
      browser.storage.local.set({ loggerState: logger.innerHTML });

      if (logger.scrollTop + logger.clientHeight === logger.scrollHeight) {
        logger.scrollTop = logger.scrollHeight;
      }
    }
  } else {
    logger.appendChild(fragment);
  }

  browser.storage.local.set({ [`logs_${message.tabId}`]: logger.innerHTML }, function() {
    if (browser.runtime.lastError) {
      let retryCount = 0;
      let maxRetries = 3;
      while (browser.runtime.lastError && retryCount < maxRetries) {
        browser.storage.local.set({ [`logs_${message.tabId}`]: logger.innerHTML });
        retryCount++;
      }
    }
  });
}

function refreshLogger() {
  document.getElementById('logger').innerHTML = '';
  browser.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!browser.runtime.lastError && tabs[0]) {
      let activeTab = tabs[0];
      browser.tabs.reload(activeTab.id);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  logger = document.getElementById('logger');
  const addBtn = document.getElementById('add');
  const removeBtn = document.getElementById('remove');
  const refreshBtn = document.getElementById('refresh');
  let websiteElement = document.getElementById('website');
  let modal = document.getElementById("modal");
  let span = document.getElementsByClassName("close")[0];
  let modalMessage = document.getElementById("modal-message");
  let yesBtn = document.getElementById('yesBtn');
  let noBtn = document.getElementById('noBtn');
  let originalPopupSize;
  const storage = browser.storage.sync || browser.storage.local;
  
  storage.get(['blacklistedWebsites', 'enableLogger'], (data) => {
    if (!browser.runtime.lastError) {
      const blacklistedWebsites = data.blacklistedWebsites || [];
      updateBlacklistedWebsites(blacklistedWebsites);
      removeBtn.disabled = blacklistedWebsites.length === 0;
      if (!data.enableLogger) {
        toggleLoggerBtn.style.display = 'none';
      } else {
        toggleLoggerBtn.style.display = 'block';
      }
    } else {
      let retryCount = 0;
      let maxRetries = 3;
      while (browser.runtime.lastError && retryCount < maxRetries) {
        storage.get(['blacklistedWebsites', 'enableLogger']);
        retryCount++;
      }
    }
  });

browser.tabs.query({active: true, currentWindow: true}, (tabs) => {
  if (browser.runtime.lastError) {
    return;
  }
  if (tabs[0]) {
    let activeTabId = tabs[0].id;
    port.postMessage({command: 'getMessages', tabId: activeTabId});

    let key = `${activeTabId}`;
    browser.storage.local.get(key, function(data) {
      let messages = data[key] || [];
      messages.forEach((message) => {
        if (message.type === 'stats') {
          handleStatsUpdated(message.content);
        } else if (message.type === 'adStats') {
          handleAdStatsUpdated(message.content);
        } else {
          appendMessage(message.content);
        }
      });
    });
  }
});

port.onMessage.addListener(function (message) {
  if (message.command === 'reloadMessages') {
    const existingMessages = document.querySelectorAll('.message, div[data-type="statsUpdated"], div[data-type="adStatsUpdated"]');
    existingMessages.forEach(message => message.remove());

    browser.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        let currentTabId = tabs[0].id;
        port.postMessage({command: 'getMessages', tabId: currentTabId});
      }
    });
  }
});

document.getElementById('options-link').addEventListener('click', function(event) {
  event.preventDefault(); 
  let optionsUrl = browser.runtime.getURL('options.html'); 

  browser.tabs.query({url: optionsUrl}, function(tabs) {
    if (tabs.length) {
      browser.tabs.update(tabs[0].id, {active: true});
    } else {
      browser.tabs.create({url: optionsUrl});
    }
  });
});

browser.storage.onChanged.addListener(function(changes, namespace) {
  for (let key in changes) {
    if (key === 'enableLogger') {
      toggleLoggerBtn.style.display = changes[key].newValue ? 'block' : 'none';
    }
  }
});

toggleLoggerBtn.addEventListener('click', function () {
  if (!logger.classList.contains('visible')) {
    // Store the original size of the popup
    originalPopupSize = popup.style.height;

    logger.classList.add('visible'); // Show logger
    refreshBtn.style.display = 'inline-block'; // Show refresh button
    popup.classList.add('popup-expanded');
  } else {
    logger.classList.remove('visible'); // Hide logger
    refreshBtn.style.display = 'none'; // Hide refresh button
    popup.classList.remove('popup-expanded');

    // Restore the original size of the popup
    popup.style.height = originalPopupSize;
  }
});

document.getElementById('refresh').addEventListener('click', () => {
  refreshLogger();
});

span.onclick = () => {
  modal.style.display = "none";
  removeBtn.disabled = false;
  document.getElementById('yesBtn').style.display = "none";
  document.getElementById('noBtn').style.display = "none";
}

addBtn.addEventListener('click', () => {
  let website = document.getElementById('website').value.trim();
  website = normalizeWebsite(website).toLowerCase();
  websiteElement.setCustomValidity('');

  if (!isValidUrl(website) && !isValidDomain(website)) {
  modalMessage.innerText = 'Please enter a valid URL or domain (e.g., example.com)';
  modal.style.display = "block";    
  websiteElement.setCustomValidity('Invalid URL or domain');
  websiteElement.classList.add('invalid');
  return;
  } else {
    websiteElement.classList.remove('invalid');
  }

  storage.get(['blacklistedWebsites'], (data) => {
    let blacklistedWebsites = data.blacklistedWebsites || [];
    blacklistedWebsites = blacklistedWebsites.map(site => 
    normalizeWebsite(site).toLowerCase());

  if (blacklistedWebsites.includes(website)) {
    modalMessage.innerText = 'This website is already in the blacklist.';
    modal.style.display = "block";
    return;
  }
  handleAddition(website, blacklistedWebsites);
  });
});

async function handleAddition(website, blacklistedWebsites) {
  let displayWebsite = website;
  blacklistedWebsites.push(website);
  updateBlacklistedWebsites(blacklistedWebsites.map(site => (site === website ? displayWebsite : site)));
  await saveBlacklistedWebsites(blacklistedWebsites);
  removeBtn.disabled = false;
  browser.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (tabs[0]) {
      let tabId = tabs[0].id;

      browser.tabs.sendMessage(tabId, {command: 'test'}, function(response) {
        if (!browser.runtime.lastError) {
          browser.tabs.sendMessage(tabId, { blacklistedWebsites: blacklistedWebsites });
        }
      });
    }
  });
  appendMessage(`Added website to blacklist: ${displayWebsite}`);
}

removeBtn.addEventListener('click', () => {
  let website = document.getElementById('website').value.trim();
  website = normalizeWebsite(website).toLowerCase();

  const storage = browser.storage.sync || browser.storage.local;
  storage.get(['blacklistedWebsites'], (data) => {
    let blacklistedWebsites = data.blacklistedWebsites || [];
    blacklistedWebsites = blacklistedWebsites.map(site => normalizeWebsite(site).toLowerCase());

    let yesBtnClick = function() {
      let allVersions = blacklistedWebsites.filter(site => extractBaseDomain(site) === baseDomain);
      blacklistedWebsites = blacklistedWebsites.filter(site => extractBaseDomain(site) !== baseDomain);
      handleRemoval(allVersions, blacklistedWebsites);
    };
    
    let noBtnClick = function() {
      blacklistedWebsites = blacklistedWebsites.filter(site => site !== website);
      handleRemoval(website, blacklistedWebsites);
    };
    
    if (!blacklistedWebsites.includes(website)) {
      modalMessage.innerText = 'This website is not in the blacklist.';
      modal.style.display = "block";
      return;
    }

    let baseDomain = extractBaseDomain(website);

    let allVersions = blacklistedWebsites.filter(site => extractBaseDomain(site) === baseDomain);

    if (allVersions.length > 1) {

      modalMessage.innerText = 'Do you want to remove all versions of this domain from the blacklist?';
      modal.style.display = "block";

      removeBtn.disabled = true;
      document.getElementById('yesBtn').style.display = "inline-block";
      document.getElementById('noBtn').style.display = "inline-block";

      yesBtn.removeEventListener('click', yesBtnClick);
      noBtn.removeEventListener('click', noBtnClick);
      yesBtn.addEventListener('click', yesBtnClick);
      noBtn.addEventListener('click', noBtnClick);
    } else {
      blacklistedWebsites = blacklistedWebsites.filter(site => site !== website);
      handleRemoval(website, blacklistedWebsites);
    }
  });
});

async function handleRemoval(websites, blacklistedWebsites) {

  if (typeof websites === 'string') {
    websites = [websites];
  }

  for (let website of websites) {
    appendMessage(`Removed website from blacklist: ${website}`);
  }

  updateBlacklistedWebsites(blacklistedWebsites);
  await saveBlacklistedWebsites(blacklistedWebsites);
  removeBtn.disabled = blacklistedWebsites.length === 0;

  browser.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (tabs[0]) {
      let tabId = tabs[0].id;
  
      browser.tabs.sendMessage(tabId, {command: 'test'}, function(response) {
        if (!browser.runtime.lastError) {
          browser.tabs.sendMessage(tabId, { blacklistedWebsites: blacklistedWebsites });
        }
      });
    }
  });  

  modal.style.display = "none";
  removeBtn.disabled = false;

  document.getElementById('yesBtn').style.display = "none";
  document.getElementById('noBtn').style.display = "none";
}
});

window.addEventListener('beforeunload', function() {
  if (port) {
    port.disconnect();
  }
});
