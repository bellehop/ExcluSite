let isBlacklistEdited = false;
let textarea = document.getElementById('blacklistedWebsites');
const urlRegexp = /^[a-zA-Z0-9.-]+\.(com|org|net|edu|gov|mil|aero|asia|biz|cat|coop|info|int|jobs|mobi|museum|name|post|pro|tel|travel|xxx|ac|ad|ae|af|ag|ai|al|am|an|ao|aq|ar|as|at|au|aw|ax|az|ba|bb|bd|be|bf|bg|bh|bi|bj|bm|bn|bo|br|bs|bt|bv|bw|by|bz|ca|cc|cd|cf|cg|ch|ci|ck|cl|cm|cn|co|cr|cu|cv|cx|cy|cz|de|dj|dk|dm|do|dz|ec|ee|eg|er|es|et|eu|fi|fj|fk|fm|fo|fr|ga|gb|gd|ge|gf|gg|gh|gi|gl|gm|gn|gp|gq|gr|gs|gt|gu|gw|gy|hk|hm|hn|hr|ht|hu|id|ie|il|im|in|io|iq|ir|is|it|je|jm|jo|jp|ke|kg|kh|ki|km|kn|kp|kr|kw|ky|kz|la|lb|lc|li|lk|lr|ls|lt|lu|lv|ly|ma|mc|md|me|mg|mh|mk|ml|mm|mn|mo|mp|mq|mr|ms|mt|mu|mv|mw|mx|my|mz|na|nc|ne|nf|ng|ni|nl|no|np|nr|nu|nz|om|pa|pe|pf|pg|ph|pk|pl|pm|pn|pr|ps|pt|pw|py|qa|re|ro|rs|ru|rw|sa|sb|sc|sd|se|sg|sh|si|sj|Ja|sk|sl|sm|sn|so|sr|ss|st|su|sv|sx|sy|sz|tc|td|tf|tg|th|tj|tk|tl|tm|tn|to|tp|tr|tt|tv|tw|tz|ua|ug|uk|us|uy|uz|va|vc|ve|vg|vi|vn|vu|wf|ws|ye|yt|yu|za|zm|zw)$/;
const storage = browser.storage.sync || browser.storage.local;

storage.onChanged.addListener(function(changes, areaName) {
  if (areaName === 'sync' || areaName === 'local') { 
    if (changes.blacklistedWebsites) {
      updateBlacklistedWebsites(changes.blacklistedWebsites.newValue);
    }

    // If any of the switches change, update the corresponding switch element
    const switches = ['enableSearchFilter', 'enableSponsoredFilter', 'enableLogger'];
    switches.forEach(switchId => {
      if (changes[switchId]) {
        let switchElement = document.getElementById(switchId);
        if (switchElement) {
          switchElement.checked = changes[switchId].newValue;
        }
      }
    });
  }
});

browser.runtime.onInstalled.addListener(function() {
  // Set default values for configuration switches
  storage.set({
    enableSearchFilter: true,
    enableSponsoredFilter: false,
    enableLogger: false
  });
});

textarea.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = this.scrollHeight + 'px';
    isBlacklistEdited = true; // Set the flag to true when the textarea content changes
});
textarea.addEventListener('keypress', function(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
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

function normalizeWebsite(website) {
  return website.replace(/^(http:\/\/|https:\/\/|www\.)/, '').replace(/\/$/, '');
}

function saveBlacklistedWebsites(blacklistedWebsites) {
  try {
    const storage = browser.storage.sync || browser.storage.local;
    storage.set({ blacklistedWebsites }, function () {
    if (!browser.runtime.lastError) {
        updateBlacklistedWebsites(blacklistedWebsites);
        updateEditButtonState();
        isBlacklistEdited = false; // Reset the flag when the changes are saved
    }
    });
  } catch {}
}

function updateEditButtonState() {
  const storage = browser.storage.sync || browser.storage.local;
  storage.get(['blacklistedWebsites'], function(data) {
    let blacklistedWebsites = data.blacklistedWebsites || [];
    let editButton = document.getElementById('edit');
    editButton.disabled = blacklistedWebsites.length === 0 || isBlacklistEdited;
  });
}

function updateBlacklistedWebsites(blacklistedWebsites) {
  const blacklistedTextarea = document.getElementById('blacklistedWebsites');
  const displayWebsites = blacklistedWebsites.map(website => website.replace('www.', ''));
  blacklistedTextarea.value = displayWebsites.join('\n');

  const buttons = ['edit', 'export', 'clear', 'save'].map(id => document.getElementById(id));
  const isDisabled = blacklistedWebsites.length === 0;
  buttons.forEach(button => button.disabled = isDisabled);

  blacklistedTextarea.setAttribute('readonly', '');
}

function openTab(tabId) {
  const pages = document.getElementsByClassName('page');
  Array.from(pages).forEach(page => page.style.display = 'none');

  const tabs = document.getElementsByClassName('tab');
  Array.from(tabs).forEach(tab => tab.classList.remove('active'));

  document.getElementById(tabId).style.display = 'block';
  document.getElementById(tabId + 'Button').classList.add('active');
  localStorage.setItem('lastOpenedTab', tabId);
}
  
  function updateExportButtonState() {
    const exportButton = document.getElementById('export');
    storage.get(['blacklistedWebsites'], function(data) {
      const hasWebsites = data.blacklistedWebsites && data.blacklistedWebsites.length > 0;
      if (hasWebsites) {
        updateBlacklistedWebsites(data.blacklistedWebsites);
        exportButton.disabled = false;
      } else {
        document.getElementById('blacklistedWebsites').value = '';
        exportButton.disabled = true;
      }
    });
}

document.addEventListener('DOMContentLoaded', function() {
  const switches = ['enableSearchFilter', 'enableSponsoredFilter', 'enableLogger'];
  const storage = browser.storage.sync || browser.storage.local;

  storage.get(switches, function(data) {
    switches.forEach(switchId => {
      let switchElement = document.getElementById(switchId);
      let switchState;
  
      // Set the initial state of the switch
      if (data[switchId] !== undefined) {
        switchState = data[switchId];
      } else {
        switchState = switchId === 'enableSearchFilter';
        let newState = {};
        newState[switchId] = switchState;
        storage.set(newState); // Save the default state back to the storage
      }
      switchElement.checked = switchState;
  
      // Save the new state of the switch when it's toggled
      switchElement.addEventListener('change', function() {
        let newState = {};
        newState[switchId] = this.checked;
        storage.set(newState);
  
        if (switchId === 'enableSponsoredFilter') {
          browser.runtime.sendMessage({ action: 'toggleSponsoredFilter', enableSponsoredFilter: this.checked });
        }
      });
    });
  });  

  updateEditButtonState();
  updateExportButtonState();

  storage.get([...switches, 'blacklistedWebsites'], function (data) {
    const buttons = ['export', 'save'].map(id => document.getElementById(id));
    if (data.blacklistedWebsites && data.blacklistedWebsites.length > 0) {
      updateBlacklistedWebsites(data.blacklistedWebsites);
      buttons.forEach(button => button.disabled = false);
    } else {
      document.getElementById('blacklistedWebsites').value = '';
      buttons.forEach(button => button.disabled = true);
    }
  });

  document.getElementById('clear').disabled = true;
   
storage.get(['blacklistedWebsites'], function(data) {
  if (data.blacklistedWebsites) {
    updateBlacklistedWebsites(data.blacklistedWebsites || []);
  } else {
    document.getElementById('blacklistedWebsites').value = '';
  }
});

  var lastOpenedTab = localStorage.getItem('lastOpenedTab') || 'settings';
  openTab(lastOpenedTab);
    
    ['settings', 'feedback', 'faq', 'donate'].forEach(tabId => {
        document.getElementById(tabId + 'Button').addEventListener('click', function() {
          openTab(tabId);
        });
    });

browser.runtime.onMessage.addListener(function(message) {
  if (message.action === 'addWebsite' || message.action === 'removeWebsite') {
    const website = normalizeWebsite(message.website);
    storage.get('blacklistedWebsites', function(data) {
      let blacklistedWebsites = data.blacklistedWebsites || [];
      if (message.action === 'addWebsite' && !blacklistedWebsites.includes(website)) {
        blacklistedWebsites.push(website);
      } else if (message.action === 'removeWebsite') {
        blacklistedWebsites = blacklistedWebsites.filter(site => site !== website);
      }
      storage.set({ blacklistedWebsites });
      updateBlacklistedWebsites(blacklistedWebsites);
    });
  }
});

document.getElementById('add').addEventListener('click', function() {
  let website = document.getElementById('website').value.trim();
  let websites = website.replace(/,\s*$/, '').split(',').map(site => normalizeWebsite(site.trim().toLowerCase()));
    document.getElementById('website').setCustomValidity('');
      
    storage.get(['blacklistedWebsites'], function(data) {
      let blacklistedWebsites = data.blacklistedWebsites || [];
      let newWebsites = [];
      let existingWebsites = [];
      websites.forEach(website => {
        if (blacklistedWebsites.includes(website) || (!isValidUrl(website) && !isValidDomain(website))) {
          existingWebsites.push(website);
        } else {
          newWebsites.push(website);
          blacklistedWebsites.push(website);
        }
      });          
  
      if (existingWebsites.length > 0) {
        alert('These websites are already in the blacklist or are invalid: ' + existingWebsites.join(', '));
      }
  
      if (newWebsites.length > 0) {
        let displayWebsite = website;
        updateBlacklistedWebsites(blacklistedWebsites.map(site => site === website ? displayWebsite : site));
        saveBlacklistedWebsites(blacklistedWebsites);
        updateEditButtonState();
  
        browser.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          browser.tabs.sendMessage(tabs[0].id, { blacklistedWebsites });
        });
      }
    });
  });

document.getElementById('remove').addEventListener('click', function() {
    let website = document.getElementById('website').value.trim();
    let websites = website.split(',').map(site => normalizeWebsite(site.trim()));
    
    storage.get(['blacklistedWebsites'], function(data) {
      let blacklistedWebsites = data.blacklistedWebsites || [];   
      
      websites.forEach(website => {
          blacklistedWebsites = blacklistedWebsites.filter(site => normalizeWebsite(site).split('.')[0] !== website.split('.')[0]);
      });
      updateBlacklistedWebsites(blacklistedWebsites);
      saveBlacklistedWebsites(blacklistedWebsites);
      updateEditButtonState();

      browser.tabs.query({active: true, currentWindow: true}, function(tabs) {
          browser.tabs.sendMessage(tabs[0].id, { blacklistedWebsites });
      });
  });
});

document.getElementById('clear').addEventListener('click', function() {
    const blacklistedWebsites = [];
    updateBlacklistedWebsites(blacklistedWebsites);
    saveBlacklistedWebsites(blacklistedWebsites);

    browser.tabs.query({active: true, currentWindow: true}, function(tabs) {
        browser.tabs.sendMessage(tabs[0].id, { blacklistedWebsites });
    });
    alert('Blacklist cleared successfully!');
    updateEditButtonState();
  });

document.getElementById('save').addEventListener('click', function() {
    let textarea = document.getElementById('blacklistedWebsites');
    let websites = textarea.value.split('\n').filter(site => site.trim() !== '');

    let invalidWebsites = websites.filter(website => !isValidUrl(website) && !isValidDomain(website));
    if (invalidWebsites.length > 0) {
        textarea.style.borderColor = 'red';
        alert('The following websites are not valid URLs or domains: ' + invalidWebsites.join(', '));
        return;
      } 
      textarea.style.borderColor = '';
      
    saveBlacklistedWebsites(websites);

    browser.tabs.query({active: true, currentWindow: true}, function(tabs) {
        browser.tabs.sendMessage(tabs[0].id, { blacklistedWebsites: websites });
    });
    
    alert('Blacklist saved successfully!');
    isBlacklistEdited = false; // Reset the flag when the save button is clicked
    this.disabled = false; // Enable the save button again
    textarea.setAttribute('readonly', ''); // Make the textarea readonly again
    updateEditButtonState();
  });

document.getElementById('edit').addEventListener('click', function() {
    let textarea = document.getElementById('blacklistedWebsites');
    textarea.removeAttribute('readonly');
    textarea.focus();

    browser.runtime.sendMessage({ command: 'startEditing' });
    isBlacklistEdited = true; // Set the flag to true when the user starts editing
    });
    
    document.getElementById('blacklistedWebsites').addEventListener('input', function() {
      this.value = this.value.replace(/ /g, '');
      updateEditButtonState();
    });

document.getElementById('export').addEventListener('click', function() {
  storage.get(['blacklistedWebsites'], function(data) {
    let blacklistedWebsites = data.blacklistedWebsites || [];
    let blob = new Blob([JSON.stringify(blacklistedWebsites)], {type: "text/plain;charset=utf-8"});
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = 'blacklist.json';
    a.click();
    alert('Blacklist exported successfully');
});
updateExportButtonState();
});

document.getElementById('import').addEventListener('click', function() {
    document.getElementById('file').click();
  });

document.getElementById('file').addEventListener('change', function () {
  let file = this.files[0];

    if (!file || file.size === 0 || file.size > 1000000 || file.type !== 'application/json') return;

    let reader = new FileReader();
    reader.onload = function () {
      let content = this.result.trim();

      if (content.charAt(0) !== '[' || content.charAt(content.length - 1) !== ']') {
        alert('Invalid JSON format. Please provide a valid JSON file.');
        return;
      }
  
      try {
        let blacklistedWebsites = JSON.parse(content);
  
        if (!Array.isArray(blacklistedWebsites) || blacklistedWebsites.length === 0) {
          alert('Invalid or empty file. Please provide a valid JSON array.');
          return;
        }
        storage.set({ blacklistedWebsites }, function () {
          if (browser.runtime.lastError) return;
  
          updateBlacklistedWebsites(blacklistedWebsites);
          alert('Blacklist imported successfully');
        });
      } catch (error) {
        alert('Error parsing JSON. Please provide a valid JSON file.');
      }
    };
    reader.readAsText(file);
  });
});

window.addEventListener('beforeunload', function (e) {
  // If the user is in edit mode, display a confirmation dialog
  if (isBlacklistEdited) {
    e.preventDefault();
    e.returnValue = '';
  }
});
