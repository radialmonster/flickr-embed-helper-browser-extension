const ROOT_ID = 'fwe-root';
const MENU_GET_PREFIX = 'get-embed';
const MENU_ADD_PREFIX = 'add-to-collection';
const MENU_CLEAR = 'clear-collection';
const MENU_MANAGE = 'manage-collections';

const SIZES = [
  // Original (has unique secret, arbitrary dimensions, can be any format)
  { key: 'original',  label: 'Original',        suffix: 'o' },
  
  // Extra Large sizes (all have unique secrets, can be restricted by owner)
  { key: 'large6k',   label: 'Extra Large (6144px)', suffix: '6k' },
  { key: 'large5k',   label: 'Extra Large (5120px)', suffix: '5k' },
  { key: 'large4k',   label: 'Extra Large (4096px)', suffix: '4k' },
  { key: 'large3k',   label: 'Extra Large (3072px)', suffix: '3k' },
  { key: 'large2k',   label: 'Large (2048px)',        suffix: 'k' },
  { key: 'large1600', label: 'Large (1600px)',        suffix: 'h' },
  
  // Regular sizes (shared secret)
  { key: 'large1024', label: 'Large (1024px)',   suffix: 'b' },
  { key: 'medium800', label: 'Medium (800px)',   suffix: 'c' },
  { key: 'medium640', label: 'Medium (640px)',   suffix: 'z' },
  { key: 'medium500', label: 'Medium (500px)',   suffix: '' },   // No suffix for 500px
  { key: 'small400',  label: 'Small (400px)',    suffix: 'w' },
  { key: 'small320',  label: 'Small (320px)',    suffix: 'n' },
  { key: 'small240',  label: 'Small (240px)',    suffix: 'm' },
  
  // Thumbnails (shared secret)
  { key: 'thumbnail', label: 'Thumbnail (100px)', suffix: 't' },
  { key: 'square150', label: 'Square (150px)',    suffix: 'q' },
  { key: 'square75',  label: 'Square (75px)',     suffix: 's' }
];


chrome.runtime.onInstalled.addListener(() => {
  // Initialize default settings
  chrome.storage.local.get(['collections', 'activeCollection', 'defaultSize'], data => {
    const updates = {};

    if (!data.collections) {
      updates.collections = { default: [] };
    }
    if (!data.activeCollection) {
      updates.activeCollection = 'default';
    }
    if (!data.defaultSize) {
      updates.defaultSize = 'large1024'; // Default to 1024px
    }
    
    if (Object.keys(updates).length > 0) {
      chrome.storage.local.set(updates);
    }
  });

  // Create context menus directly - force refresh
  chrome.contextMenus.removeAll(() => {
    console.log('🔄 Recreating context menus without Quick Batch features');
    recreateAllMenus();
  });
});

// Listen for storage changes to update context menus when collections change
chrome.storage.onChanged.addListener((changes, namespace) => {
  console.log('🔍 Storage changed:', namespace, Object.keys(changes));
  if (namespace === 'local' && changes.collections) {
    console.log('✅ Collections changed, updating context menus');
    console.log('📂 Old collections:', changes.collections.oldValue ? Object.keys(changes.collections.oldValue) : 'none');
    console.log('📂 New collections:', changes.collections.newValue ? Object.keys(changes.collections.newValue) : 'none');
    updateCollectionMenus(changes.collections.newValue);
  }
});

// Function to update collection menus dynamically
async function updateCollectionMenus(collections) {
  try {
    // Remove existing collection menu items (but keep the main structure)
    chrome.contextMenus.removeAll(() => {
      console.log('🔄 Recreating all context menus with updated collections');
      recreateAllMenus();
    });
  } catch (error) {
    console.error('Error updating collection menus:', error);
  }
}

// Function to recreate all menus (extracted from onInstalled)
function recreateAllMenus() {
  chrome.contextMenus.create({
    id: ROOT_ID,
    title: 'Flickr Embed Helper',
    contexts: ['image', 'link', 'page'],
    documentUrlPatterns: ['*://*.flickr.com/*']
  });

  // STREAMLINED MENU - Top level actions
  chrome.contextMenus.create({
    id: 'copy-for-wordpress',
    parentId: ROOT_ID,
    title: '📋 Copy Embed Code (Default Size)',
    contexts: ['image', 'link', 'page'],
    documentUrlPatterns: ['*://*.flickr.com/*']
  });

  // Add size-specific embed options
  chrome.contextMenus.create({
    id: 'embed-sizes-menu',
    parentId: ROOT_ID,
    title: '📐 Copy Embed Code (Choose Size)',
    contexts: ['image', 'link', 'page'],
    documentUrlPatterns: ['*://*.flickr.com/*']
  });

  chrome.contextMenus.create({
    id: 'copy-photo-url',
    parentId: ROOT_ID,
    title: '🔗 Copy Photo URL',
    contexts: ['image', 'link', 'page'],
    documentUrlPatterns: ['*://*.flickr.com/*']
  });

  chrome.contextMenus.create({
    id: 'add-to-default-collection',
    parentId: ROOT_ID,
    title: '📂 Add to Collection (Default)',
    contexts: ['image', 'link', 'page'],
    documentUrlPatterns: ['*://*.flickr.com/*']
  });

  // Add to Collection submenu
  chrome.contextMenus.create({
    id: 'add-to-collection-menu',
    parentId: ROOT_ID,
    title: '📁 Add to Collection',
    contexts: ['all']
  });

  // Get current collections and create menu items for each
  chrome.storage.local.get(['collections'], (data) => {
    const collections = data.collections || { default: [] };
    console.log('📂 Creating context menu items for collections:', Object.keys(collections));

    // Create menu item for each collection
    Object.keys(collections).forEach(collectionName => {
      console.log(`📂 Creating menu item for collection: ${collectionName}`);
      chrome.contextMenus.create({
        id: `add-to-collection-${collectionName}`,
        parentId: 'add-to-collection-menu',
        title: `📂 ${collectionName}`,
        contexts: ['all']
      });
    });

    // Add separator and manage option
    chrome.contextMenus.create({
      id: 'separator-collections',
      parentId: 'add-to-collection-menu',
      type: 'separator',
      contexts: ['all']
    });

    chrome.contextMenus.create({
      id: 'manage-collections-submenu',
      parentId: 'add-to-collection-menu',
      title: '⚙️ Manage Collections',
      contexts: ['all']
    });
  });

  chrome.contextMenus.create({
    id: 'separator1',
    parentId: ROOT_ID,
    type: 'separator',
    contexts: ['image', 'link', 'page']
  });

  chrome.contextMenus.create({
    id: 'change-default-size',
    parentId: ROOT_ID,
    title: '⚙️ Set Copy Embed Code Default Size',
    contexts: ['all']
  });

  // Add size options for both changing default and direct embedding
  for (const size of SIZES) {
    // For setting default size
    chrome.contextMenus.create({
      id: `set-default-${size.key}`,
      parentId: 'change-default-size',
      title: size.label,
      contexts: ['all']
    });

    // For direct embedding with size choice
    const needsApi = ['original', 'large6k', 'large5k', 'large4k', 'large3k', 'large2k', 'large1600'].includes(size.key);
    const sizeTitle = needsApi ? `${size.label} (🔑 API Required)` : `${size.label} (🌐 oEmbed)`;

    chrome.contextMenus.create({
      id: `embed-size-${size.key}`,
      parentId: 'embed-sizes-menu',
      title: sizeTitle,
      contexts: ['image', 'link', 'page']
    });
  }

  chrome.contextMenus.create({
    id: MENU_MANAGE,
    parentId: ROOT_ID,
    title: '⚙️ Manage Collections and Options',
    contexts: ['all']
  });
}

// Handle messages from options page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateContextMenus') {
    console.log('🔄 Manual context menu update requested from options page');
    chrome.storage.local.get(['collections'], (data) => {
      updateCollectionMenus(data.collections || { default: [] });
    });
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'generateEmbed') {
    // Handle embed generation request from options page
    console.log('🎯 Generating embed from options page:', message);
    
    generateEmbedFromMessage(message.photoData, message.sizeKey)
      .then(embedHtml => {
        sendResponse({ success: true, embedHtml: embedHtml });
      })
      .catch(error => {
        console.error('❌ Error generating embed:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Keep message channel open for async response
  }
});

// Generate embed without needing tab context (for options page)
async function generateEmbedFromMessage(photoData, sizeKey) {
  console.log('🎯 Photo data for embed generation:', photoData);
  
  if (!photoData || !photoData.photoId || !photoData.username) {
    throw new Error('Missing required photo data');
  }

  // Get user settings to determine preferred method
  const { flickrApiKey, defaultMethod = 'auto' } = await chrome.storage.local.get(['flickrApiKey', 'defaultMethod']);
  
  const hasApiCredentials = flickrApiKey;
  const requestedSize = SIZES.find(s => s.key === sizeKey);
  const needsLargerSize = requestedSize && ['original', 'large6k', 'large5k', 'large4k', 'large3k', 'large2k', 'large1600'].includes(sizeKey);
  
  // Determine which method to use
  let useApi = false;
  if (defaultMethod === 'api' && hasApiCredentials) {
    useApi = true;
  } else if (defaultMethod === 'auto' && hasApiCredentials && needsLargerSize) {
    useApi = true;
  }
  
  if (useApi) {
    console.log('🔑 Using Flickr API for larger size:', sizeKey);
    const apiEmbedCode = await getFlickrApiEmbedCode(photoData, sizeKey, flickrApiKey);
    if (apiEmbedCode) {
      console.log('✅ Successfully retrieved embed from Flickr API');
      return apiEmbedCode;
    }
    console.log('❌ Flickr API failed, falling back to oEmbed...');
  }

  // Try to get official embed code from Flickr's oEmbed API
  console.log('🌐 Attempting to get official embed from Flickr oEmbed API...');
  const officialEmbedCode = await getOfficialEmbedCode(photoData, sizeKey);
  
  if (officialEmbedCode) {
    console.log('✅ Successfully retrieved official embed from oEmbed API');
    return officialEmbedCode;
  }
  
  console.log('❌ oEmbed API failed - no fallback available');
  throw new Error('Could not generate embed code: oEmbed API failed');
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log('🎯 Context menu clicked:', info.menuItemId);
  console.log('🔍 Tab info:', { id: tab.id, url: tab.url });
  
  try {
    // Manage Collections
    if (info.menuItemId === MENU_MANAGE) {
      chrome.runtime.openOptionsPage();
      return;
    }


    // Copy embed code (using default size)
    if (info.menuItemId === 'copy-for-wordpress') {
      console.log('🎯 Copy for WordPress clicked');
      const { defaultSize } = await chrome.storage.local.get('defaultSize');
      console.log('📐 Using size:', defaultSize || 'large1024');
      const embedHtml = await generateEmbed(info, tab, defaultSize || 'large1024');
      console.log('📝 Generated embed HTML:', embedHtml ? embedHtml.substring(0, 100) + '...' : 'null');
      await copyToClipboard(embedHtml, tab.id);
      return;
    }

    // Copy photo URL
    if (info.menuItemId === 'copy-photo-url') {
      console.log('🎯 Copy Photo URL clicked');
      const photoData = await getPhotoDataFromTab(tab);
      if (photoData && photoData.photoId && photoData.username) {
        const photoUrl = photoData.albumId
          ? `https://www.flickr.com/photos/${photoData.username}/${photoData.photoId}/in/album-${photoData.albumId}`
          : `https://www.flickr.com/photos/${photoData.username}/${photoData.photoId}`;
        await copyToClipboard(photoUrl, tab.id);
        console.log('🔗 Copied photo URL:', photoUrl);
      } else {
        notify(tab.id, 'Could not extract photo URL');
      }
      return;
    }

    // Add to default collection
    if (info.menuItemId === 'add-to-default-collection') {
      console.log('🎯 Add to Default Collection clicked');
      const photoData = await getPhotoDataFromTab(tab);
      if (photoData && photoData.photoId && photoData.username) {
        await addToDefaultCollection(photoData, tab.id);
      } else {
        notify(tab.id, 'Could not extract photo data');
      }
      return;
    }


    // Direct embed with specific size
    if (info.menuItemId.startsWith('embed-size-')) {
      const sizeKey = info.menuItemId.replace('embed-size-', '');
      console.log('🃐 Direct embed with size:', sizeKey);
      const embedHtml = await generateEmbed(info, tab, sizeKey);
      console.log('📝 Generated embed HTML:', embedHtml ? embedHtml.substring(0, 100) + '...' : 'null');
      await copyToClipboard(embedHtml, tab.id);
      return;
    }
    
    // Set Default Size
    if (info.menuItemId.startsWith('set-default-')) {
      const sizeKey = info.menuItemId.replace('set-default-', '');
      await chrome.storage.local.set({ defaultSize: sizeKey });
      const size = SIZES.find(s => s.key === sizeKey);
      notify(tab.id, `Default size set to ${size.label}`);
      return;
    }

    // Add to specific collection
    if (info.menuItemId.startsWith('add-to-collection-') && info.menuItemId !== 'add-to-collection-menu') {
      const collectionName = info.menuItemId.replace('add-to-collection-', '');
      const { defaultSize } = await chrome.storage.local.get('defaultSize');
      const embedHtml = await generateEmbed(info, tab, defaultSize || 'large1024');
      await addToCollection(embedHtml, collectionName, tab.id);
      return;
    }

    // Manage collections from submenu
    if (info.menuItemId === 'manage-collections-submenu') {
      chrome.runtime.openOptionsPage();
      return;
    }

    // Legacy support for old menu structure
    const isGet = info.menuItemId.startsWith(MENU_GET_PREFIX + '-');
    const isAdd = info.menuItemId.startsWith(MENU_ADD_PREFIX + '-');
    if (isGet || isAdd) {
      const parts = info.menuItemId.split('-');
      const sizeKey = parts.slice(-1)[0];
      const embedHtml = await generateEmbed(info, tab, sizeKey);

      if (isGet) {
        await copyToClipboard(embedHtml, tab.id);
      } else if (isAdd) {
        await addToCollection(embedHtml, tab.id);
      }
    }
  } catch (err) {
    console.error('Error handling context menu action:', err);
    if (tab && tab.id) {
      notify(tab.id, 'Error: ' + err.message);
    }
  }
});

async function getPhotoDataFromTab(tab) {
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getPhotoData' });
    return response;
  } catch (err) {
    console.error('❌ Could not get photo data from content script:', err);
    return null;
  }
}

async function generateEmbed(info, tab, sizeKey) {
  // Get photo data from content script
  const photoData = await getPhotoDataFromTab(tab);
  if (!photoData) {
    throw new Error('Could not get photo data from content script');
  }
  
  console.log('🎯 Photo data received in background:', photoData);

  if (!photoData.photoId || !photoData.username) {
    console.error('❌ Missing required photo data:', photoData);
    throw new Error('Could not extract photo information from page');
  }

  // Get user settings to determine preferred method
  const { flickrApiKey, defaultMethod = 'auto' } = await chrome.storage.local.get(['flickrApiKey', 'defaultMethod']);
  
  const hasApiCredentials = flickrApiKey;
  const requestedSize = SIZES.find(s => s.key === sizeKey);
  const needsLargerSize = requestedSize && ['original', 'large6k', 'large5k', 'large4k', 'large3k', 'large2k', 'large1600'].includes(sizeKey);
  
  // Determine which method to use
  let useApi = false;
  if (defaultMethod === 'api' && hasApiCredentials) {
    useApi = true;
  } else if (defaultMethod === 'auto' && hasApiCredentials && needsLargerSize) {
    useApi = true;
  }
  
  if (useApi) {
    console.log('🔑 Using Flickr API for larger size:', sizeKey);
    const apiEmbedCode = await getFlickrApiEmbedCode(photoData, sizeKey, flickrApiKey);
    if (apiEmbedCode) {
      console.log('✅ Successfully retrieved embed from Flickr API');
      return apiEmbedCode;
    }
    console.log('❌ Flickr API failed, falling back to oEmbed...');
  }

  // Try to get official embed code from Flickr's oEmbed API
  console.log('🌐 Attempting to get official embed from Flickr oEmbed API...');
  const officialEmbedCode = await getOfficialEmbedCode(photoData, sizeKey);
  
  if (officialEmbedCode) {
    console.log('✅ Successfully retrieved official embed from oEmbed API');
    return officialEmbedCode;
  }
  
  console.log('❌ oEmbed API failed - no fallback available');
  throw new Error('Could not generate embed code: oEmbed API failed');
}


// Simplified: No dimension calculations needed with suffix-only approach

// All dimension calculations removed - using suffix-only approach

// Get embed code using Flickr API for larger sizes
async function getFlickrApiEmbedCode(photoData, sizeKey, apiKey) {
  try {
    console.log('🔑 Using Flickr API to get photo sizes...');
    
    // Call flickr.photos.getSizes to get all available sizes
    const apiUrl = `https://api.flickr.com/services/rest/?method=flickr.photos.getSizes&api_key=${apiKey}&photo_id=${photoData.photoId}&format=json&nojsoncallback=1`;
    
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.stat !== 'ok') {
      throw new Error(`API error: ${data.message || 'Unknown error'}`);
    }
    
    console.log('📐 Available sizes from API:', data.sizes.size.map(s => `${s.label} (${s.width}×${s.height})`));
    
    // Map size keys to Flickr API labels
    const sizeMapping = {
      'original': 'Original',
      'large6k': 'Extra Large 6144',
      'large5k': 'Extra Large 5120', 
      'large4k': 'Extra Large 4096',
      'large3k': 'Extra Large 3072',
      'large2k': 'Large 2048',
      'large1600': 'Large 1600',
      'large1024': 'Large',
      'medium800': 'Medium 800',
      'medium640': 'Medium 640',
      'medium500': 'Medium',
      'small400': 'Small 400',
      'small320': 'Small 320',
      'small240': 'Small',
      'thumbnail': 'Thumbnail',
      'square150': 'Large Square',
      'square75': 'Square'
    };
    
    const targetLabel = sizeMapping[sizeKey];
    if (!targetLabel) {
      throw new Error(`Unknown size key: ${sizeKey}`);
    }
    
    // Find the requested size
    let selectedSize = data.sizes.size.find(s => s.label === targetLabel);
    
    // If exact size not found, find the closest smaller size
    if (!selectedSize) {
      const availableSizes = data.sizes.size.sort((a, b) => b.width - a.width);
      const requestedSize = SIZES.find(s => s.key === sizeKey);
      const targetWidth = getSizeTargetWidth(sizeKey);
      
      selectedSize = availableSizes.find(s => s.width <= targetWidth) || availableSizes[availableSizes.length - 1];
      console.log(`📐 Exact size '${targetLabel}' not found, using closest: ${selectedSize.label} (${selectedSize.width}×${selectedSize.height})`);
    }
    
    if (!selectedSize) {
      throw new Error('No suitable size found');
    }
    
    console.log(`✅ Selected size: ${selectedSize.label} (${selectedSize.width}×${selectedSize.height})`);
    
    // Build photo URL
    const photoUrl = photoData.albumId 
      ? `https://www.flickr.com/photos/${photoData.username}/${photoData.photoId}/in/album-${photoData.albumId}`
      : `https://www.flickr.com/photos/${photoData.username}/${photoData.photoId}`;
    
    // Create embed code
    const title = photoData.title || 'Flickr Photo';
    const embedCode = `<a data-flickr-embed="true" href="${photoUrl}" title="${title}"><img src="${selectedSize.source}" width="${selectedSize.width}" height="${selectedSize.height}" alt="${title}"/></a><script async src="//embedr.flickr.com/assets/client-code.js" charset="utf-8"></script>`;
    
    return embedCode;
    
  } catch (error) {
    console.error('❌ Error using Flickr API:', error);
    return null;
  }
}

// Helper function to get target width for size key
function getSizeTargetWidth(sizeKey) {
  const sizeToWidth = {
    'original': 10000,
    'large6k': 6144,
    'large5k': 5120,
    'large4k': 4096,
    'large3k': 3072,
    'large2k': 2048,
    'large1600': 1600,
    'large1024': 1024,
    'medium800': 800,
    'medium640': 640,
    'medium500': 500,
    'small400': 400,
    'small320': 320,
    'small240': 240,
    'thumbnail': 100,
    'square150': 150,
    'square75': 75
  };
  return sizeToWidth[sizeKey] || 1024;
}

// Get official embed code from Flickr's oEmbed API
async function getOfficialEmbedCode(photoData, sizeKey) {
  try {
    console.log('🌐 Using Flickr oEmbed API for official embed code...');
    
    // Construct the photo URL - use the original context if available
    let photoUrl;
    if (photoData.albumId) {
      photoUrl = `https://www.flickr.com/photos/${photoData.username}/${photoData.photoId}/in/album-${photoData.albumId}`;
    } else {
      photoUrl = `https://www.flickr.com/photos/${photoData.username}/${photoData.photoId}`;
    }
    
    // Map our size keys to maxwidth values for oEmbed
    const sizeToMaxWidth = {
      'original': 6000,   // Get largest available
      'large6k': 6144,
      'large5k': 5120,
      'large4k': 4096,
      'large3k': 3072,
      'large2k': 2048,
      'large1600': 1600,
      'large1024': 1024,
      'medium800': 800,
      'medium640': 640,
      'medium500': 500,
      'small400': 400,
      'small320': 320,
      'small240': 240,
      'thumbnail': 100,
      'square150': 150,
      'square75': 75
    };
    
    const maxWidth = sizeToMaxWidth[sizeKey] || 1024;
    console.log('📐 Requesting size:', sizeKey, 'with maxwidth:', maxWidth);
    
    // Build oEmbed URL
    const oembedUrl = `https://www.flickr.com/services/oembed/?format=json&url=${encodeURIComponent(photoUrl)}&maxwidth=${maxWidth}`;
    console.log('🔗 oEmbed URL:', oembedUrl);
    
    // Fetch from oEmbed API
    const response = await fetch(oembedUrl);
    
    if (!response.ok) {
      console.error('❌ oEmbed API error:', response.status, response.statusText);
      return null;
    }
    
    const oembedData = await response.json();
    console.log('✅ oEmbed response:', oembedData);
    
    // Extract the HTML embed code
    if (oembedData.html) {
      console.log('✅ Official Flickr embed code retrieved');
      return oembedData.html;
    } else if (oembedData.url && oembedData.width && oembedData.height) {
      // Fallback: build embed code from oEmbed data
      const title = oembedData.title || photoData.title || 'Flickr Photo';
      const embedCode = `<a data-flickr-embed="true" href="${photoUrl}" title="${title}"><img src="${oembedData.url}" width="${oembedData.width}" height="${oembedData.height}" alt="${title}"/></a><script async src="//embedr.flickr.com/assets/client-code.js" charset="utf-8"></script>`;
      console.log('✅ Built embed code from oEmbed data');
      return embedCode;
    } else {
      console.error('❌ Invalid oEmbed response - missing html or image data');
      return null;
    }
    
  } catch (error) {
    console.error('❌ Error fetching from oEmbed API:', error);
    return null;
  }
}


async function copyToClipboard(text, tabId) {
  try {
    console.log('📋 Copying to clipboard:', text.substring(0, 100) + '...');
    
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (textToCopy) => {
        try {
          console.log('📋 Clipboard function executing with text:', textToCopy.substring(0, 100) + '...');
          
          // Try modern Clipboard API first
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(textToCopy);
            console.log('✅ Modern clipboard API succeeded');
            return { success: true, method: 'modern', length: textToCopy.length };
          }
          
          // Fallback to execCommand
          const ta = document.createElement('textarea');
          ta.value = textToCopy;
          Object.assign(ta.style, { 
            position: 'fixed', 
            top: '0', 
            left: '0', 
            width: '1px',
            height: '1px',
            opacity: '0',
            border: 'none',
            outline: 'none',
            boxShadow: 'none',
            background: 'transparent'
          });
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          ta.setSelectionRange(0, textToCopy.length);
          
          const success = document.execCommand('copy');
          document.body.removeChild(ta);
          
          console.log('📋 Fallback copy command result:', success);
          return { success, method: 'fallback', length: textToCopy.length };
        } catch (error) {
          console.error('❌ Clipboard copy error:', error);
          return { success: false, error: error.message };
        }
      },
      args: [text]
    });
    
    const result = results[0]?.result;
    if (result?.success) {
      console.log(`✅ Clipboard copy successful via ${result.method} method`);
      notify(tabId, 'Embed code copied to clipboard');
    } else {
      console.error('❌ Clipboard copy failed:', result);
      notify(tabId, 'Failed to copy to clipboard: ' + (result?.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('❌ Failed to execute clipboard script:', error);
    notify(tabId, 'Failed to copy to clipboard: ' + error.message);
  }
}

async function addToDefaultCollection(photoData, tabId) {
  const { collections = {} } = await chrome.storage.local.get(['collections']);

  // Ensure default collection exists
  if (!collections['default']) {
    collections['default'] = [];
  }

  // Check if already in collection (avoid duplicates)
  const alreadyExists = collections['default'].some(item => item.photoId === photoData.photoId);
  if (alreadyExists) {
    notify(tabId, 'Photo already in default collection');
    return;
  }

  collections['default'].push({
    photoId: photoData.photoId,
    username: photoData.username,
    title: photoData.title || `Photo ${photoData.photoId}`,
    albumId: photoData.albumId,
    addedAt: new Date().toISOString()
  });

  await chrome.storage.local.set({ collections });
  notify(tabId, `Added to default collection (${collections['default'].length} photos)`);
}

async function addToCollection(embedHtml, tabId) {
  const data = await chrome.storage.local.get(['collections', 'activeCollection']);
  const collections = data.collections || {};
  const active = data.activeCollection || 'default';
  collections[active] = collections[active] || [];
  // Extract photo data from embed HTML before storing
  const photoData = extractPhotoDataFromEmbed(embedHtml);
  if (!photoData) {
    notify(tabId, 'Failed to extract photo data');
    return;
  }

  collections[active].push({
    photoId: photoData.photoId,
    username: photoData.username,
    title: photoData.title,
    albumId: photoData.albumId,
    addedAt: new Date().toISOString()
  });
  await chrome.storage.local.set({ collections });
  notify(tabId, `Added to collection \"${active}\"`);
}


async function addToCollection(embedHtml, collectionName, tabId) {
  const { collections = {} } = await chrome.storage.local.get('collections');
  
  // Ensure collection exists
  if (!collections[collectionName]) {
    collections[collectionName] = [];
  }
  
  // Extract photo data first for duplicate checking
  const photoData = extractPhotoDataFromEmbed(embedHtml);
  if (!photoData) {
    notify(tabId, 'Failed to extract photo data');
    return;
  }

  // Check if already in collection (avoid duplicates)
  const alreadyExists = collections[collectionName].some(item => item.photoId === photoData.photoId);
  if (alreadyExists) {
    notify(tabId, `Photo already in collection "${collectionName}"`);
    return;
  }
  
  collections[collectionName].push({
    photoId: photoData.photoId,
    username: photoData.username,
    title: photoData.title,
    albumId: photoData.albumId,
    addedAt: new Date().toISOString()
  });
  
  await chrome.storage.local.set({ collections });
  notify(tabId, `Added to collection "${collectionName}" (${collections[collectionName].length} photos)`);
}

function extractPhotoDataFromEmbed(embedHtml) {
  // Extract photo data from existing embed HTML
  // Pattern: https://www.flickr.com/photos/username/photoId/in/album-albumId or https://www.flickr.com/photos/username/photoId
  const urlMatch = embedHtml.match(/href="https:\/\/www\.flickr\.com\/photos\/([^/]+)\/(\d+)(?:\/in\/album-([^"]+))?"/);
  if (!urlMatch) return null;

  // Extract title from embed HTML (from alt text or data-flickr-embed-title)
  let title = '';
  const altMatch = embedHtml.match(/alt="([^"]+)"/);
  const titleMatch = embedHtml.match(/title="([^"]+)"/);
  if (altMatch) title = altMatch[1];
  else if (titleMatch) title = titleMatch[1];

  return {
    photoId: urlMatch[2],
    username: urlMatch[1],
    albumId: urlMatch[3] || null,
    title: title || `Photo ${urlMatch[2]}`
  };
}



function notify(tabId, message) {
  chrome.tabs.sendMessage(tabId, {
    action: 'showNotification',
    message: message
  }).catch(() => {
    // Fallback to console if content script not available
    console.log('Notification:', message);
  });
}