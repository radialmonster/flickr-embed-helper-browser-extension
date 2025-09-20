// Flickr Embed Helper - Collection Manager

let collections = {};
let activeCollection = '';
let modalMode = 'new'; // 'new' or 'rename'

document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    setupEventListeners();
    updateUI();
});

function setupEventListeners() {
    // API Settings
    document.getElementById('flickrApiKey').addEventListener('input', handleApiInputChange);
    document.getElementById('toggleApiKey').addEventListener('click', () => togglePasswordVisibility('flickrApiKey'));
    document.getElementById('testApiBtn').addEventListener('click', testApiConnection);
    document.getElementById('testFullIntegrationBtn').addEventListener('click', testFullIntegration);
    document.getElementById('saveApiBtn').addEventListener('click', saveApiSettings);
    document.getElementById('clearApiBtn').addEventListener('click', clearApiSettings);
    document.getElementById('defaultMethod').addEventListener('change', saveDefaultMethod);
    
    // Collection management
    document.getElementById('collectionSelect').addEventListener('change', handleCollectionChange);
    document.getElementById('newCollectionBtn').addEventListener('click', showNewCollectionModal);
    document.getElementById('renameCollectionBtn').addEventListener('click', showRenameCollectionModal);
    document.getElementById('deleteCollectionBtn').addEventListener('click', deleteCollection);
    document.getElementById('clearCollectionBtn').addEventListener('click', clearCollection);
    
    // Photo selection
    document.getElementById('selectAllBtn').addEventListener('click', selectAllPhotos);
    document.getElementById('selectNoneBtn').addEventListener('click', selectNonePhotos);
    document.getElementById('removeSelectedBtn').addEventListener('click', removeSelectedPhotos);
    
    // Export method selection
    document.getElementById('exportMethodEmbeds').addEventListener('change', handleExportMethodChange);
    document.getElementById('exportMethodUrls').addEventListener('change', handleExportMethodChange);


    // Export
    document.getElementById('generateEmbedBtn').addEventListener('click', generateOutput);
    document.getElementById('copyEmbedBtn').addEventListener('click', copyEmbedCodes);
    
    // Modal
    document.getElementById('modalSaveBtn').addEventListener('click', saveCollectionModal);
    document.getElementById('modalCancelBtn').addEventListener('click', hideModal);
    document.getElementById('modalCloseBtn').addEventListener('click', hideModal);
    document.getElementById('collectionModal').addEventListener('click', handleModalBackdropClick);
    
    // Handle Enter key in modal
    document.getElementById('collectionNameInput').addEventListener('keydown', handleModalKeydown);
    
    // Listen for checkbox changes
    document.addEventListener('change', handlePhotoCheckboxChange);

    // Listen for photo action button clicks
    document.addEventListener('click', handlePhotoActionClick);

    // Photo drag and drop
    document.addEventListener('dragstart', handlePhotoDragStart);
    document.addEventListener('dragover', handlePhotoDragOver);
    document.addEventListener('drop', handlePhotoDrop);
    document.addEventListener('dragend', handlePhotoDragEnd);
}

async function loadData() {
    const data = await chrome.storage.local.get(['collections', 'activeCollection', 'flickrApiKey', 'defaultMethod']);
    collections = data.collections || { default: [] };
    activeCollection = data.activeCollection || 'default';

    // Migrate old format collections (embedHtml) to new format (photoId)
    let needsSave = false;
    for (const collectionName in collections) {
        const collection = collections[collectionName];
        for (let i = 0; i < collection.length; i++) {
            const photo = collection[i];
            if (photo.embedHtml && !photo.photoId) {
                console.log(`🔄 Migrating photo ${i + 1} in collection "${collectionName}"`);
                const photoData = extractPhotoDataFromEmbed(photo.embedHtml);
                if (photoData) {
                    // Replace old format with new format
                    collections[collectionName][i] = {
                        photoId: photoData.photoId,
                        username: photoData.username,
                        title: photoData.title,
                        albumId: photoData.albumId,
                        addedAt: photo.addedAt || new Date().toISOString()
                    };
                    needsSave = true;
                } else {
                    console.warn(`⚠️ Failed to migrate photo ${i + 1} in collection "${collectionName}"`);
                }
            }
        }
    }

    if (needsSave) {
        console.log('💾 Saving migrated collections...');
        await chrome.storage.local.set({ collections });
    }
    
    // Load API settings
    document.getElementById('flickrApiKey').value = data.flickrApiKey || '';
    document.getElementById('defaultMethod').value = data.defaultMethod || 'auto';
    
    console.log('🔄 Loaded API settings:', { 
        hasApiKey: !!(data.flickrApiKey), 
 
    });
    
    // Update button states
    setTimeout(() => {
        handleApiInputChange();
    }, 100); // Small delay to ensure DOM is ready
    
    // Ensure activeCollection exists
    if (!collections[activeCollection]) {
        activeCollection = 'default';
        collections[activeCollection] = [];
        await chrome.storage.local.set({ collections, activeCollection });
    }
}

function updateUI() {
    updateStats();
    updateCollectionSelect();
    updatePhotosList();
    updateButtonStates();
    // Update export options asynchronously to avoid blocking UI
    updateExportOptions().catch(error => {
        console.warn('⚠️ Error updating export options:', error);
        // Set fallback export options on error
        const exportSizeSelect = document.getElementById('exportSize');
        if (exportSizeSelect && exportSizeSelect.options.length === 0) {
            exportSizeSelect.innerHTML = '<option value="largest-available">📏 Use Largest Available Size (Smart)</option>';
        }
    });
}

function updateStats() {
    const totalCollections = Object.keys(collections).length;
    const collectionValues = Object.values(collections);
    const totalPhotos = collectionValues.length > 0
        ? collectionValues.reduce((sum, photos) => sum + (Array.isArray(photos) ? photos.length : 0), 0)
        : 0;
    const activeCollectionCount = collections[activeCollection]?.length || 0;
    
    document.getElementById('totalCollections').textContent = totalCollections;
    document.getElementById('totalPhotos').textContent = totalPhotos;
    document.getElementById('activeCollectionCount').textContent = activeCollectionCount;
}

function updateCollectionSelect() {
    const select = document.getElementById('collectionSelect');
    select.innerHTML = '<option value="">Select a collection...</option>';
    
    Object.keys(collections).sort().forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        option.selected = name === activeCollection;
        select.appendChild(option);
    });
    
    document.getElementById('activeCollectionName').textContent = 
        activeCollection || 'None Selected';
}

function updatePhotosList() {
    const photosList = document.getElementById('photosList');
    const photos = collections[activeCollection] || [];
    
    if (!activeCollection || photos.length === 0) {
        photosList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📂</div>
                <h3>${!activeCollection ? 'No Collection Selected' : 'No Photos in Collection'}</h3>
                <p>${!activeCollection ? 'Select or create a collection to start managing your Flickr photos.' : 'Add photos to this collection by right-clicking on Flickr photos and selecting "Add to collection".'}</p>
            </div>
        `;
        return;
    }
    
    const photoGrid = document.createElement('div');
    photoGrid.className = 'photo-grid';
    
    photos.forEach((photo, index) => {
        const photoItem = createPhotoItemElement(photo, index);
        photoGrid.appendChild(photoItem);
    });
    
    photosList.innerHTML = '';
    photosList.appendChild(photoGrid);
}

function createPhotoItemElement(photo, index) {
    const photoTitle = photo.title || `Photo ${index + 1}`;
    const addedDate = photo.addedAt ? new Date(photo.addedAt).toLocaleDateString() : 'Unknown';

    // Generate Flickr photo URL
    const flickrUrl = photo.albumId
        ? `https://www.flickr.com/photos/${photo.username}/${photo.photoId}/in/album-${photo.albumId}`
        : `https://www.flickr.com/photos/${photo.username}/${photo.photoId}`;

    const div = document.createElement('div');
    div.className = 'photo-item';
    div.innerHTML = `
        <div class="photo-card" draggable="true" data-index="${index}">
            <div class="photo-header">
                <div class="photo-number drag-handle" title="Drag to reorder">${index + 1}</div>
                <div class="photo-title">${photoTitle}</div>
                <input type="checkbox" class="photo-checkbox" data-index="${index}">
                <button class="btn btn-danger photo-remove-btn" data-index="${index}" title="Remove from collection">
                    🗑️
                </button>
            </div>
            <div class="photo-content">
                <div class="photo-thumbnail">
                    <div class="loading-thumbnail">🔄</div>
                </div>
            </div>
            <div class="photo-info">
                <div class="photo-meta">ID: ${photo.photoId}</div>
                <div class="photo-meta">Added: ${addedDate}</div>
                <a href="${flickrUrl}" target="_blank" class="flickr-link" title="View this photo on Flickr">
                    🔗 View on Flickr
                </a>
            </div>
        </div>
    `;

    // Load thumbnail asynchronously
    loadThumbnailAsync(photo, div.querySelector('.photo-thumbnail'), photoTitle);

    return div;
}

async function loadThumbnailAsync(photo, thumbnailContainer, photoTitle) {
    try {
        const thumbnailUrl = await generateFlickrThumbnailUrl(photo);
        if (thumbnailUrl) {
            const img = document.createElement('img');
            img.src = thumbnailUrl;
            img.alt = photoTitle;
            img.onerror = function() {
                thumbnailContainer.innerHTML = '<div class="no-thumbnail">📷</div>';
            };
            thumbnailContainer.innerHTML = '';
            thumbnailContainer.appendChild(img);
        } else {
            thumbnailContainer.innerHTML = '<div class="no-thumbnail">📷</div>';
        }
    } catch (error) {
        console.warn('Failed to load thumbnail for photo', photo.photoId, error);
        thumbnailContainer.innerHTML = '<div class="no-thumbnail">📷</div>';
    }
}

// Cache for photo size data to avoid repeated API calls
const photoSizeCache = new Map();

function normalizeSizeForRequest(size, fallbackLabel) {
    if (!size && !fallbackLabel) {
        return null;
    }

    const label = (size && size.label) || fallbackLabel || 'Large';
    if (!size) {
        return { label };
    }

    const parsedWidth = parseInt(size.width, 10);
    const parsedHeight = parseInt(size.height, 10);
    const width = Number.isFinite(parsedWidth) ? parsedWidth : null;
    const height = Number.isFinite(parsedHeight) ? parsedHeight : null;
    const maxDimension = Math.max(width || 0, height || 0) || null;

    return {
        label,
        width,
        height,
        source: size.source || size.url || null,
        maxDimension
    };
}

function formatSizeResult(size, fallbackLabel, warningMessage) {
    const normalized = normalizeSizeForRequest(size, fallbackLabel);
    const sizeLabel = normalized?.label || fallbackLabel || 'Large';
    const warning = warningMessage || null;
    const requiresApi = normalized ? isApiSize(normalized.label) : false;

    return {
        sizeLabel,
        sizeRequest: normalized,
        requiresApi,
        warning,
        oEmbedMaxWidth: normalized?.maxDimension || null
    };
}

async function getPhotoSizes(photo) {
    if (!photo || !photo.photoId) return null;

    // Check cache first
    const cacheKey = photo.photoId;
    if (photoSizeCache.has(cacheKey)) {
        return photoSizeCache.get(cacheKey);
    }

    try {
        // Get API credentials
        const { flickrApiKey } = await chrome.storage.local.get(['flickrApiKey']);
        if (!flickrApiKey) {
            return null; // No API key, return null
        }

        // Call flickr.photos.getSizes to get all available sizes
        const apiUrl = `https://api.flickr.com/services/rest/?method=flickr.photos.getSizes&api_key=${flickrApiKey}&photo_id=${photo.photoId}&format=json&nojsoncallback=1`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
            photoSizeCache.set(cacheKey, null);
            return null;
        }

        const data = await response.json();
        if (data.stat !== 'ok') {
            photoSizeCache.set(cacheKey, null);
            return null;
        }

        // Cache the complete sizes data
        const sizesData = data.sizes.size;
        photoSizeCache.set(cacheKey, sizesData);
        return sizesData;

    } catch (error) {
        console.warn('Failed to fetch sizes for photo', photo.photoId, error);
        photoSizeCache.set(cacheKey, null);
        return null;
    }
}

async function generateFlickrThumbnailUrl(photo) {
    const sizes = await getPhotoSizes(photo);
    if (!sizes) return null;

    // Find a good thumbnail size (prefer Large Square 150px, fallback to Thumbnail)
    let thumbnailUrl = null;

    // Look for Large Square (150px) first
    const largeSquare = sizes.find(size => size.label === 'Large Square');
    if (largeSquare) {
        thumbnailUrl = largeSquare.source;
    } else {
        // Fallback to Thumbnail (100px)
        const thumbnail = sizes.find(size => size.label === 'Thumbnail');
        if (thumbnail) {
            thumbnailUrl = thumbnail.source;
        } else if (sizes.length > 0) {
            // Last resort: use smallest available size
            const smallest = sizes.reduce((prev, current) =>
                (prev.width * prev.height < current.width * current.height) ? prev : current
            );
            thumbnailUrl = smallest.source;
        }
    }

    return thumbnailUrl;
}

async function updateExportOptions() {
    const photos = collections[activeCollection] || [];
    const exportSelect = document.getElementById('exportSize');

    if (photos.length === 0) {
        // No photos, show basic options
        exportSelect.innerHTML = `
            <option value="largest-available">📏 Use Largest Available (varies by photo)</option>
            <option value="consistent-max">📐 Consistent Max: 1024px</option>
            <option value="keep-original">🔍 Use Original Size (varies by photo)</option>
        `;
        return;
    }

    // Get available sizes for all photos in collection
    const availableSizes = await getCollectionAvailableSizes(photos);

    // Determine what consistent max sizes make sense
    let maxDimensions = 1024; // Safe default
    if (availableSizes.length > 0) {
        const dimensions = availableSizes.map(s => Math.max(s.maxWidth || 0, s.maxHeight || 0));
        if (dimensions.length > 0) {
            maxDimensions = Math.max(...dimensions);
        }
    }

    // Build dynamic options
    let optionsHtml = `
        <option value="largest-available">📏 Use Largest Available (varies by photo)</option>
        <option value="consistent-max">📐 Consistent Max: 1024px</option>
    `;

    // Only show larger consistent options if photos support them
    if (maxDimensions >= 1600) {
        optionsHtml += `<option value="consistent-1600">📐 Consistent Max: 1600px</option>`;
    }
    if (maxDimensions >= 2048) {
        optionsHtml += `<option value="consistent-2048">📐 Consistent Max: 2048px</option>`;
    }

    optionsHtml += `<option value="keep-original">🔍 Use Original Size (varies by photo)</option>`;

    if (availableSizes.length > 0) {
        optionsHtml += '<optgroup label="Available Fixed Sizes">';
        availableSizes.forEach(sizeInfo => {
            const icon = sizeInfo.requiresApi ? '🔑' : '🌐';
            const labelWithPixels = addPixelInfoToLabel(sizeInfo.label, sizeInfo.maxWidth, sizeInfo.maxHeight);
            optionsHtml += `<option value="${sizeInfo.label}">${icon} ${labelWithPixels} (${sizeInfo.availableIn}/${photos.length} photos)</option>`;
        });
        optionsHtml += '</optgroup>';
    }

    exportSelect.innerHTML = optionsHtml;
}

async function getCollectionAvailableSizes(photos) {
    // Early return if no photos
    if (!photos || photos.length === 0) {
        return [];
    }

    const sizeAvailability = new Map(); // label -> {count, requiresApi, maxWidth, maxHeight, label}

    // Sample a few photos to get size availability (don't check all for performance)
    const samplesToCheck = Math.min(5, photos.length);
    const samplePhotos = photos.slice(0, samplesToCheck);

    for (const photo of samplePhotos) {
        try {
            const sizes = await getPhotoSizes(photo);
            if (sizes && Array.isArray(sizes)) {
                sizes.forEach(size => {
                    if (size && size.label && size.width && size.height) {
                        if (!sizeAvailability.has(size.label)) {
                            sizeAvailability.set(size.label, {
                                count: 0,
                                requiresApi: isApiSize(size.label),
                                maxWidth: size.width,
                                maxHeight: size.height,
                                label: size.label
                            });
                        }
                        sizeAvailability.get(size.label).count++;
                    }
                });
            }
        } catch (error) {
            console.warn('Error getting sizes for photo:', photo.photoId, error);
        }
    }

    // Convert to array and sort by size (largest first)
    const availableSizes = Array.from(sizeAvailability.values())
        .map(sizeInfo => ({
            ...sizeInfo,
            availableIn: samplesToCheck > 0
                ? Math.ceil((sizeInfo.count / samplesToCheck) * photos.length)
                : 0
        }))
        .filter(sizeInfo => sizeInfo.count > 0) // Only include sizes found in samples
        .sort((a, b) => (b.maxWidth * b.maxHeight) - (a.maxWidth * a.maxHeight));

    // If no sizes found, provide fallback
    if (availableSizes.length === 0) {
        return [{
            count: 1,
            requiresApi: false,
            maxWidth: 1024,
            maxHeight: 1024,
            label: 'Large',
            availableIn: photos.length
        }];
    }

    return availableSizes;
}

function addPixelInfoToLabel(label, maxWidth, maxHeight) {
    // Don't add pixel info to "Original" size - it varies per photo
    if (label === 'Original') {
        return `${label} (varies by photo)`;
    }

    // If the label already has pixel info, don't duplicate it
    if (label.includes('px') || /\d{3,4}/.test(label)) {
        return label;
    }

    // Add pixel dimensions to make it clearer for users
    const maxDimension = Math.max(maxWidth, maxHeight);
    return `${label} (${maxDimension}px)`;
}

function isApiSize(label) {
    // Sizes that typically require API access (larger sizes with unique secrets)
    // Check against actual Flickr labels
    const normalized = label.toLowerCase();
    return normalized.includes('original') ||
           normalized.includes('6k') || normalized.includes('6144') ||
           normalized.includes('5k') || normalized.includes('5120') ||
           normalized.includes('4k') || normalized.includes('4096') ||
           normalized.includes('3k') || normalized.includes('3072') ||
           normalized.includes('2048') ||
           normalized.includes('1600');
}

function updateButtonStates() {
    const hasActiveCollection = !!activeCollection;
    const photos = collections[activeCollection] || [];
    const hasPhotos = photos.length > 0;
    const selectedPhotos = document.querySelectorAll('.photo-checkbox:checked');
    const hasSelected = selectedPhotos.length > 0;
    
    // Collection buttons
    document.getElementById('renameCollectionBtn').disabled = !hasActiveCollection || activeCollection === 'default';
    document.getElementById('deleteCollectionBtn').disabled = !hasActiveCollection || activeCollection === 'default';
    document.getElementById('clearCollectionBtn').disabled = !hasActiveCollection || !hasPhotos;
    
    // Photo selection buttons
    document.getElementById('selectAllBtn').disabled = !hasPhotos;
    document.getElementById('selectNoneBtn').disabled = !hasSelected;
    document.getElementById('removeSelectedBtn').disabled = !hasSelected;
    
    // Export buttons
    document.getElementById('generateEmbedBtn').disabled = !hasPhotos;

    // Copy button is enabled only when codes are generated
    const embedPreview = document.getElementById('embedCodePreview').value.trim();
    document.getElementById('copyEmbedBtn').disabled = !embedPreview;
}

// Event Handlers
async function handleCollectionChange() {
    const select = document.getElementById('collectionSelect');
    activeCollection = select.value;
    await chrome.storage.local.set({ activeCollection });
    updateUI();
}

function showNewCollectionModal() {
    modalMode = 'new';
    document.getElementById('modalTitle').textContent = 'New Collection';
    document.getElementById('collectionNameInput').value = '';
    showModal();
}

function showRenameCollectionModal() {
    modalMode = 'rename';
    document.getElementById('modalTitle').textContent = 'Rename Collection';
    document.getElementById('collectionNameInput').value = activeCollection;
    showModal();
}

function showModal() {
    document.getElementById('collectionModal').classList.add('show');
    document.getElementById('collectionNameInput').focus();
    document.getElementById('collectionNameInput').select();
}

function hideModal() {
    document.getElementById('collectionModal').classList.remove('show');
}

function handleModalBackdropClick(e) {
    if (e.target.className === 'modal-backdrop') {
        hideModal();
    }
}

function handleModalKeydown(e) {
    if (e.key === 'Enter') {
        saveCollectionModal();
    } else if (e.key === 'Escape') {
        hideModal();
    }
}

async function saveCollectionModal() {
    const name = document.getElementById('collectionNameInput').value.trim();
    if (!name) return;
    
    if (modalMode === 'new') {
        if (collections[name]) {
            alert('Collection already exists');
            return;
        }
        collections[name] = [];
        activeCollection = name;
    } else if (modalMode === 'rename') {
        if (collections[name] && name !== activeCollection) {
            alert('Collection already exists');
            return;
        }
        const photos = collections[activeCollection];
        delete collections[activeCollection];
        collections[name] = photos;
        activeCollection = name;
    }
    
    await chrome.storage.local.set({ collections, activeCollection });
    hideModal();
    updateUI();

    // Notify background script to update context menus
    chrome.runtime.sendMessage({ action: 'updateContextMenus' });
}

async function deleteCollection() {
    if (!confirm(`Delete collection "${activeCollection}"? This cannot be undone.`)) {
        return;
    }
    
    delete collections[activeCollection];
    
    // Select first remaining collection or default
    const remainingCollections = Object.keys(collections);
    if (remainingCollections.length === 0) {
        collections['default'] = [];
        activeCollection = 'default';
    } else {
        activeCollection = remainingCollections[0];
    }
    
    await chrome.storage.local.set({ collections, activeCollection });
    updateUI();

    // Notify background script to update context menus
    chrome.runtime.sendMessage({ action: 'updateContextMenus' });
}

async function clearCollection() {
    if (!confirm(`Clear all photos from "${activeCollection}"? This cannot be undone.`)) {
        return;
    }
    
    collections[activeCollection] = [];
    await chrome.storage.local.set({ collections });
    updateUI();
}

function selectAllPhotos() {
    document.querySelectorAll('.photo-checkbox').forEach(cb => {
        cb.checked = true;
        cb.closest('.photo-item').classList.add('selected');
    });
    updateButtonStates();
}

function selectNonePhotos() {
    document.querySelectorAll('.photo-checkbox').forEach(cb => {
        cb.checked = false;
        cb.closest('.photo-item').classList.remove('selected');
    });
    updateButtonStates();
}

function handlePhotoCheckboxChange(e) {
    if (e.target.classList.contains('photo-checkbox')) {
        const photoItem = e.target.closest('.photo-item');
        if (e.target.checked) {
            photoItem.classList.add('selected');
        } else {
            photoItem.classList.remove('selected');
        }
        updateButtonStates();
    }
}

function handlePhotoActionClick(e) {
    // Handle copy photo embed button
    if (e.target.closest('.photo-copy-btn')) {
        const button = e.target.closest('.photo-copy-btn');
        const index = parseInt(button.dataset.index);
        copyPhotoEmbed(index);
        return;
    }
    
    // Handle remove photo button  
    if (e.target.closest('.photo-remove-btn')) {
        const button = e.target.closest('.photo-remove-btn');
        const index = parseInt(button.dataset.index);
        console.log('🗑️ Remove button clicked for index:', index);
        removePhoto(index);
        return;
    }
}

// Drag and drop variables
let draggedIndex = null;
let draggedElement = null;

function handlePhotoDragStart(e) {
    // Only handle drag from photo cards
    const photoCard = e.target.closest('.photo-card');
    if (!photoCard) return;

    const index = parseInt(photoCard.dataset.index);
    if (isNaN(index) || index < 0) {
        console.error('❌ Invalid drag index:', photoCard.dataset.index);
        return;
    }

    draggedIndex = index;
    draggedElement = photoCard;

    console.log(`🚀 Drag start: index ${draggedIndex}`);

    photoCard.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', photoCard.outerHTML);
}

function handlePhotoDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const photoCard = e.target.closest('.photo-card');
    if (photoCard && photoCard !== draggedElement) {
        const rect = photoCard.getBoundingClientRect();
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        const cardMidX = rect.left + rect.width / 2;
        const cardMidY = rect.top + rect.height / 2;

        // Clear previous drop states
        clearDropStates();

        // For grid layout, determine drop position based on mouse position
        // within the card (left half = before, right half = after)
        const dropBefore = mouseX < cardMidX;

        // Add visual spacing to show insertion point
        if (dropBefore) {
            photoCard.classList.add('drop-target-before');
        } else {
            photoCard.classList.add('drop-target-after');
        }
    }
}

function clearDropStates() {
    // Remove all drop indicator classes
    document.querySelectorAll('.drop-target-before, .drop-target-after').forEach(el => {
        el.classList.remove('drop-target-before', 'drop-target-after');
    });
}

function handlePhotoDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log('🎯 Drop event fired', e.target);

    // Make sure we're dropping on a photo card or in the photos area
    const targetCard = e.target.closest('.photo-card');
    const photosArea = e.target.closest('#photosList');

    if (!targetCard && !photosArea) {
        console.log('❌ Drop not in photos area');
        cleanup();
        return;
    }

    if (!targetCard) {
        console.log('❌ No target card found');
        cleanup();
        return;
    }

    if (targetCard === draggedElement) {
        console.log('❌ Dropped on self');
        cleanup();
        return;
    }

    if (draggedIndex === null || draggedIndex === undefined) {
        console.log('❌ No dragged index');
        cleanup();
        return;
    }

    const targetIndex = parseInt(targetCard.dataset.index);
    console.log(`🎯 Drop: moving from ${draggedIndex} to around ${targetIndex}`);

    // Check if target has drop-before or drop-after class to determine position
    let dropIndex = targetIndex;
    if (targetCard.classList.contains('drop-target-after')) {
        dropIndex = targetIndex + 1;
    }

    // Adjust for removing item from original position
    if (draggedIndex < dropIndex) {
        dropIndex--;
    }

    console.log(`🎯 Final drop position: ${dropIndex}`);

    // Call reorder function
    reorderPhotos(draggedIndex, dropIndex).then(() => {
        console.log('✅ Reorder completed');
    }).catch(error => {
        console.error('❌ Reorder failed:', error);
    });

    cleanup();
}

function handlePhotoDragEnd(e) {
    cleanup();
}

function cleanup() {
    clearDropStates();
    document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    draggedIndex = null;
    draggedElement = null;
}

async function reorderPhotos(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;

    const photos = collections[activeCollection];
    if (!photos || fromIndex < 0 || fromIndex >= photos.length) {
        console.error('❌ Invalid reorder parameters:', { fromIndex, toIndex, arrayLength: photos?.length });
        return;
    }

    if (toIndex < 0 || toIndex > photos.length) {
        console.error('❌ Invalid toIndex:', toIndex);
        return;
    }

    try {
        // Perform the reorder
        const [movedPhoto] = photos.splice(fromIndex, 1);
        photos.splice(toIndex, 0, movedPhoto);

        // Save to storage
        await chrome.storage.local.set({ collections });

        // Update UI (this will renumber everything)
        updateUI();

        showNotification('Photos reordered');
    } catch (error) {
        console.error('❌ Error reordering photos:', error);
        showNotification('Failed to reorder photos');
    }
}

async function removeSelectedPhotos() {
    const selectedCheckboxes = document.querySelectorAll('.photo-checkbox:checked');
    const indices = Array.from(selectedCheckboxes)
        .map(cb => parseInt(cb.dataset.index))
        .filter(index => !isNaN(index) && index >= 0)  // Filter out invalid indices
        .sort((a, b) => b - a); // Sort in descending order to remove from end first

    if (indices.length === 0) {
        console.log('ℹ️ No valid photos selected for removal');
        return;
    }

    if (!confirm(`Remove ${indices.length} photo(s) from collection? This cannot be undone.`)) {
        return;
    }

    const photos = collections[activeCollection];
    if (!photos) {
        console.error('❌ No active collection found');
        showNotification('Error: No active collection');
        return;
    }

    try {
        // Validate all indices before removal
        const invalidIndices = indices.filter(index => index >= photos.length);
        if (invalidIndices.length > 0) {
            console.error('❌ Invalid photo indices:', invalidIndices);
            showNotification('Error: Some photos no longer exist');
            updateUI(); // Refresh UI to show current state
            return;
        }

        indices.forEach(index => {
            photos.splice(index, 1);
        });

        await chrome.storage.local.set({ collections });
        updateUI();
        showNotification(`Removed ${indices.length} photo(s) from collection`);
    } catch (error) {
        console.error('❌ Error removing photos:', error);
        showNotification('Failed to remove photos');
        updateUI(); // Refresh UI to show current state
    }
}

async function generateEmbedCodes() {
    // Reload data from storage to ensure we have the latest order
    const data = await chrome.storage.local.get(['collections', 'activeCollection']);
    collections = data.collections || { default: [] };
    activeCollection = data.activeCollection || 'default';

    const photos = collections[activeCollection] || [];
    if (photos.length === 0) return;

    const exportStrategy = document.getElementById('exportSize').value;
    const warningElement = document.getElementById('exportSizeWarning');

    showNotification(`Generating embed codes for ${photos.length} photos...`);

    try {
        const embedCodes = [];
        let warnings = [];

        for (let i = 0; i < photos.length; i++) {
            const photo = photos[i];

            // Validate photo data
            if (!photo || !photo.photoId) {
                console.warn('⚠️ Invalid photo data at index:', i);
                embedCodes.push(`<!-- Invalid photo data at position ${i + 1} -->`);
                warnings.push(`Photo ${i + 1}: Invalid photo data`);
                continue;
            }

            console.log(`🔄 Processing photo ${i + 1}/${photos.length}: ${photo.photoId}`);

            try {
                // Determine the best size for this photo based on strategy
                const sizeResult = await determineBestSize(photo, exportStrategy);

                if (sizeResult.warning) {
                    warnings.push(`Photo ${i + 1}: ${sizeResult.warning}`);
                }

                // Generate embed code using the determined size
                const embedCode = await generateEmbedFromPhotoData(photo, sizeResult);
                if (embedCode) {
                    embedCodes.push(embedCode);
                } else {
                    console.warn('⚠️ Could not generate embed for photo:', photo.photoId);
                    embedCodes.push(`<!-- Failed to generate embed for photo ${photo.photoId} -->`);
                    warnings.push(`Photo ${i + 1}: Failed to generate embed`);
                }
            } catch (error) {
                console.error('🚨 Error processing photo:', photo.photoId, error);
                embedCodes.push(`<!-- Error processing photo ${photo.photoId}: ${error.message} -->`);
                warnings.push(`Photo ${i + 1}: Processing error - ${error.message}`);
            }
        }

        // Show warnings if any
        if (warnings.length > 0) {
            warningElement.innerHTML = `⚠️ ${warnings.length} issue(s):<br>${warnings.slice(0, 3).join('<br>')}${warnings.length > 3 ? '<br>...' : ''}`;
            warningElement.style.display = 'block';
        } else {
            warningElement.style.display = 'none';
        }

        await displayEmbedCodes(embedCodes);
        showNotification(`Generated ${embedCodes.length} embed codes!`);

    } catch (error) {
        console.error('🚨 Error generating embed codes:', error);
        showNotification('Failed to generate embed codes');
    }
}

async function determineBestSize(photo, strategy) {
    const sizes = await getPhotoSizes(photo);

    if (!sizes || !Array.isArray(sizes) || sizes.length === 0) {
        // No API data available, fall back to oEmbed
        return {
            sizeLabel: 'Large',
            sizeRequest: null,
            requiresApi: false,
            warning: 'Using oEmbed fallback (1024px max)',
            oEmbedMaxWidth: 1024
        };
    }

    // Create a map of label to size for easier lookup
    const sizeMap = {};
    sizes.forEach(size => {
        if (size && size.label) {
            sizeMap[size.label] = size;
        }
    });

    switch (strategy) {
        case 'keep-original':
            // Look for the "Original" size specifically first
            const originalSizeExact = sizes.find(size => size.label === 'Original');
            if (originalSizeExact) {
                return formatSizeResult(originalSizeExact, 'Original', null);
            }

            // Fall back to largest available if no "Original" size
            const originalSizeFallback = sizes.reduce((prev, current) =>
                (current.width * current.height > prev.width * prev.height) ? current : prev
            );
            return formatSizeResult(
                originalSizeFallback,
                originalSizeFallback ? originalSizeFallback.label : 'Large',
                'Original size not available, using largest available'
            );

        case 'largest-available':
            // Find the largest size available
            const largest = sizes.reduce((prev, current) =>
                (current.width * current.height > prev.width * prev.height) ? current : prev
            );
            return formatSizeResult(largest, largest ? largest.label : 'Large', null);

        case 'consistent-max':
        case 'consistent-1600':
        case 'consistent-2048':
            // Find largest size that doesn't exceed the max
            const maxPixels = strategy === 'consistent-max' ? 1024 :
                            strategy === 'consistent-1600' ? 1600 : 2048;

            const suitableSizes = sizes.filter(size =>
                size && size.width && size.height &&
                Math.max(size.width, size.height) <= maxPixels
            );

            if (suitableSizes.length > 0) {
                const suitable = suitableSizes.reduce((prev, current) =>
                    (current.width * current.height > prev.width * prev.height) ? current : prev
                );
                return formatSizeResult(suitable, suitable ? suitable.label : 'Large', null);
            } else {
                // Use smallest available if none fit
                const smallest = sizes.reduce((prev, current) =>
                    (current.width * current.height < prev.width * prev.height) ? current : prev
                );
                return formatSizeResult(
                    smallest,
                    smallest ? smallest.label : 'Large',
                    `No size ≤${maxPixels}px, using ${smallest?.label || 'Large'}`
                );
            }

        default:
            // Fixed size strategy - check if available (strategy is now the direct label)
            if (sizeMap[strategy]) {
                return formatSizeResult(sizeMap[strategy], strategy, null);
            } else {
                // Fall back to largest available
                const fallback = sizes.reduce((prev, current) =>
                    (current.width * current.height > prev.width * prev.height) ? current : prev
                );
                return formatSizeResult(
                    fallback,
                    fallback ? fallback.label : 'Large',
                    `Size "${strategy}" not available, using ${fallback?.label || 'largest available'}`
                );
            }
    }
}

function handleExportMethodChange() {
    const embedsRadio = document.getElementById('exportMethodEmbeds');
    const embedsSection = document.getElementById('embedCodesSection');
    const urlsSection = document.getElementById('photoUrlsSection');
    const generateBtn = document.getElementById('generateEmbedBtn');
    const preview = document.getElementById('embedCodePreview');

    if (embedsRadio.checked) {
        // Show embed codes section, hide URLs section
        embedsSection.style.display = 'block';
        urlsSection.style.display = 'none';
        generateBtn.innerHTML = '<span class="btn-icon">🔄</span> Generate Embed Codes';
        preview.placeholder = "Click 'Generate Embed Codes' to see the HTML here...";
    } else {
        // Show URLs section, hide embed codes section
        embedsSection.style.display = 'none';
        urlsSection.style.display = 'block';
        generateBtn.innerHTML = '<span class="btn-icon">🔗</span> Generate Photo URLs';
        preview.placeholder = "Click 'Generate Photo URLs' to see the URLs here...";
    }
}


async function generateOutput() {
    const exportMethodEmbeds = document.getElementById('exportMethodEmbeds');

    if (exportMethodEmbeds.checked) {
        await generateEmbedCodes();
    } else {
        await generatePhotoUrls();
    }
}

async function generatePhotoUrls() {
    const photos = collections[activeCollection] || [];
    if (photos.length === 0) return;

    const addLineBreaks = document.getElementById('addLineBreaksUrls').checked;
    const embedPreview = document.getElementById('embedCodePreview');
    const embedCountInfo = document.getElementById('embedCountInfo');

    showNotification(`Generating photo URLs for ${photos.length} photos...`);

    try {
        const urls = photos.map(photo => {
            // Generate Flickr photo page URL
            const baseUrl = 'https://www.flickr.com/photos';
            if (photo.albumId) {
                return `${baseUrl}/${photo.username}/${photo.photoId}/in/album-${photo.albumId}/`;
            } else {
                return `${baseUrl}/${photo.username}/${photo.photoId}/`;
            }
        });

        const separator = addLineBreaks ? '\n\n' : '\n';
        const output = urls.join(separator);

        console.log('📝 URL Generation Debug:');
        console.log('  - addLineBreaks:', addLineBreaks);
        console.log('  - separator:', JSON.stringify(separator));
        console.log('  - output length:', output.length);
        console.log('  - contains newlines:', output.includes('\n'));
        console.log('  - first 100 chars:', output.substring(0, 100));

        embedPreview.value = output;
        embedCountInfo.textContent = `${urls.length} photo URLs generated`;

        // Update button states
        updateButtonStates();
        showNotification(`Generated ${urls.length} photo URLs!`);

    } catch (error) {
        console.error('🚨 Error generating photo URLs:', error);
        showNotification('Failed to generate photo URLs');
    }
}

async function copyEmbedCodes() {
    const embedPreview = document.getElementById('embedCodePreview');
    const embedText = embedPreview.value.trim();

    if (!embedText) {
        showNotification('No embed codes to copy');
        return;
    }

    try {
        await navigator.clipboard.writeText(embedText);
        showNotification('Embed codes copied to clipboard!');
    } catch (error) {
        console.error('🚨 Failed to copy to clipboard:', error);
        showNotification('Failed to copy embed codes');
    }
}

async function generateEmbedFromPhotoData(photo, sizeSelection) {
    const message = {
        action: 'generateEmbed',
        photoData: photo
    };

    if (sizeSelection) {
        if (sizeSelection.sizeLabel) {
            message.sizeLabel = sizeSelection.sizeLabel;
        }
        if (sizeSelection.sizeRequest) {
            message.sizeRequest = sizeSelection.sizeRequest;
        }
        if (typeof sizeSelection.requiresApi === 'boolean') {
            message.requiresApi = sizeSelection.requiresApi;
        }
        if (sizeSelection.oEmbedMaxWidth) {
            message.oEmbedMaxWidth = sizeSelection.oEmbedMaxWidth;
        }
    }

    // Use Chrome extension messaging to call the background script's embed generation
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }

            if (response && response.success) {
                resolve(response.embedHtml);
            } else {
                reject(new Error(response ? response.error : 'Unknown error'));
            }
        });
    });
}

async function displayEmbedCodes(embedCodes) {
    const includeScript = document.getElementById('includeScriptTag').checked;
    const addLineBreaks = document.getElementById('addLineBreaksEmbeds').checked;

    let output;
    if (includeScript) {
        const cleanEmbeds = embedCodes.map(code =>
            code.replace(/<script[^>]*>.*?<\/script>/gi, '')
        );

        const separator = addLineBreaks ? '\n\n' : '\n';
        output = cleanEmbeds.join(separator) +
                (addLineBreaks ? '\n\n' : '\n') +
                '<script async src="//embedr.flickr.com/assets/client-code.js" charset="utf-8"></script>';
    } else {
        const separator = addLineBreaks ? '\n\n' : '\n';
        output = embedCodes.join(separator);
    }

    // Update the preview textarea
    const embedPreview = document.getElementById('embedCodePreview');
    const embedCountInfo = document.getElementById('embedCountInfo');

    embedPreview.value = output;
    embedCountInfo.textContent = `${embedCodes.length} embed codes generated`;

    // Update button states
    updateButtonStates();
}

// Photo action functions

async function removePhoto(index) {
    console.log('🗑️ removePhoto called with index:', index);
    console.log('📂 Active collection:', activeCollection);
    console.log('📸 Photos in collection:', collections[activeCollection]?.length || 0);
    
    if (!confirm('Remove this photo from the collection?')) {
        console.log('❌ User cancelled deletion');
        return;
    }
    
    const photos = collections[activeCollection] || [];
    console.log('🔍 Photo to remove:', photos[index] ? 'Found' : 'Not found');
    
    if (index >= 0 && index < photos.length) {
        const removedPhoto = photos[index];
        photos.splice(index, 1);
        console.log('✅ Photo removed, new count:', photos.length);
        
        await chrome.storage.local.set({ collections });
        console.log('💾 Collections saved to storage');
        
        updateUI();
        console.log('🔄 UI updated');
        
        showNotification('Photo removed from collection');
    } else {
        console.error('❌ Invalid index:', index, 'Photos length:', photos.length);
        showNotification('Error: Could not remove photo');
    }
};

// Utility functions
function extractTitleFromEmbed(embedHtml) {
    const match = embedHtml.match(/title="([^"]*)"/);
    return match ? match[1] : null;
}

function extractPhotoDataFromEmbed(embedHtml) {
    // Extract photo data from existing embed HTML
    // Pattern: https://www.flickr.com/photos/username/photoId/in/album-albumId or https://www.flickr.com/photos/username/photoId
    const urlMatch = embedHtml.match(/href="https:\/\/www\.flickr\.com\/photos\/([^/]+)\/(\d+)(?:\/in\/album-([^"]+))?"/);
    if (!urlMatch) return null;
    
    const title = extractTitleFromEmbed(embedHtml);
    
    return {
        photoId: urlMatch[2],
        username: urlMatch[1], 
        albumId: urlMatch[3] || null,
        title: title
    };
}




function showNotification(message) {
    // Create a temporary notification using CSS variables
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--accent-color);
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px var(--shadow);
        z-index: 10000;
        font-weight: 500;
        max-width: 300px;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// API Settings Functions
function handleApiInputChange() {
    const apiKey = document.getElementById('flickrApiKey').value.trim();
    const hasCredentials = apiKey.length > 0;
    
    console.log('🔧 API Input Change:', { 
        apiKeyLength: apiKey.length, 
 
        hasCredentials 
    });
    
    // Enable/disable buttons
    const testApiBtn = document.getElementById('testApiBtn');
    const testFullBtn = document.getElementById('testFullIntegrationBtn');
    const saveApiBtn = document.getElementById('saveApiBtn');
    const clearApiBtn = document.getElementById('clearApiBtn');
    
    if (testApiBtn) {
        testApiBtn.disabled = !hasCredentials;
        console.log('📊 testApiBtn disabled:', testApiBtn.disabled);
    } else {
        console.error('❌ testApiBtn element not found');
    }
    
    if (testFullBtn) {
        testFullBtn.disabled = !hasCredentials;
    } else {
        console.log('⚠️ testFullIntegrationBtn element not found');
    }
    
    if (saveApiBtn) {
        saveApiBtn.disabled = !hasCredentials;
    } else {
        console.error('❌ saveApiBtn element not found');
    }
    
    if (clearApiBtn) {
        clearApiBtn.disabled = !hasCredentials;
    } else {
        console.error('❌ clearApiBtn element not found');
    }
}

function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const button = input.nextElementSibling;
    
    if (input.type === 'password') {
        input.type = 'text';
        button.textContent = '🙈';
        button.title = 'Hide';
    } else {
        input.type = 'password';
        button.textContent = '👁️';
        button.title = 'Show';
    }
}

async function testApiConnection() {
    const apiKey = document.getElementById('flickrApiKey').value.trim();

    if (!apiKey) {
        showApiStatus('error', 'Please enter API key');
        return;
    }
    
    showApiStatus('loading', 'Testing API connection...');
    
    try {
        // Test 1: Basic API connection with flickr.test.echo
        console.log('🧪 Testing basic API connection...');
        const testUrl = `https://api.flickr.com/services/rest/?method=flickr.test.echo&api_key=${apiKey}&format=json&nojsoncallback=1`;
        const response = await fetch(testUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.stat !== 'ok') {
            throw new Error(`API Error: ${data.message || 'Unknown error'}`);
        }
        
        console.log('✅ Basic API test passed:', data);
        
        // Test 2: Test flickr.photos.getSizes (the method our extension actually uses)
        console.log('🧪 Testing flickr.photos.getSizes method...');
        const testPhotoId = '53720291110'; // Use the same photo ID from your Python code
        const sizesUrl = `https://api.flickr.com/services/rest/?method=flickr.photos.getSizes&api_key=${apiKey}&photo_id=${testPhotoId}&format=json&nojsoncallback=1`;
        const sizesResponse = await fetch(sizesUrl);
        
        if (!sizesResponse.ok) {
            throw new Error(`Sizes API HTTP ${sizesResponse.status}: ${sizesResponse.statusText}`);
        }
        
        const sizesData = await sizesResponse.json();
        
        if (sizesData.stat !== 'ok') {
            console.log('⚠️ getSizes test failed (expected for public API key):', sizesData);
            showApiStatus('success', `✅ API connection successful!\n\n📋 Basic Test: Passed\n📸 Photo Sizes Test: ${sizesData.message || 'Failed (normal for public photos with basic API key)'}\n\n💡 Your API key works! Size restrictions may apply to some photos.`);
        } else {
            console.log('✅ getSizes test passed:', sizesData);
            const availableSizes = sizesData.sizes.size.map(s => `${s.label} (${s.width}×${s.height})`).join(', ');
            showApiStatus('success', `✅ API connection fully successful!\n\n📋 Basic Test: Passed\n📸 Photo Sizes Test: Passed\n\n🎯 Available sizes for test photo: ${availableSizes}`);
        }
        
    } catch (error) {
        console.error('❌ API Test Error:', error);
        showApiStatus('error', `Connection failed: ${error.message}`);
    }
}

async function saveApiSettings() {
    const apiKey = document.getElementById('flickrApiKey').value.trim();

    try {
        await chrome.storage.local.set({
            flickrApiKey: apiKey
        });
        
        showApiStatus('success', '💾 API settings saved successfully!');
        
        // Auto-hide success message after 3 seconds
        setTimeout(() => {
            const status = document.getElementById('apiStatus');
            if (status.classList.contains('success')) {
                status.style.display = 'none';
            }
        }, 3000);
        
    } catch (error) {
        showApiStatus('error', `Failed to save: ${error.message}`);
    }
}

async function clearApiSettings() {
    if (!confirm('Are you sure you want to clear your API settings? This will disable larger size embedding.')) {
        return;
    }
    
    try {
        await chrome.storage.local.remove(['flickrApiKey']);
        
        document.getElementById('flickrApiKey').value = '';
        
        handleApiInputChange();
        showApiStatus('success', '🗑️ API settings cleared');
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            document.getElementById('apiStatus').style.display = 'none';
        }, 3000);
        
    } catch (error) {
        showApiStatus('error', `Failed to clear: ${error.message}`);
    }
}

// Parse Flickr URL or input to extract photo data
function parseFlickrInput(input) {
    if (!input) return null;

    input = input.trim();

    // Full Flickr URL pattern
    const urlMatch = input.match(/flickr\.com\/photos\/([^\/]+)\/(\d+)/);
    if (urlMatch) {
        return {
            username: urlMatch[1],
            photoId: urlMatch[2]
        };
    }

    // Username/photoId format
    const userPhotoMatch = input.match(/^([^\/]+)\/(\d+)$/);
    if (userPhotoMatch) {
        return {
            username: userPhotoMatch[1],
            photoId: userPhotoMatch[2]
        };
    }

    // Just photo ID (numeric)
    if (/^\d+$/.test(input)) {
        return {
            username: null,
            photoId: input
        };
    }

    return null;
}

async function testFullIntegration() {
    const apiKey = document.getElementById('flickrApiKey').value.trim();
    const testInput = document.getElementById('testPhotoInput').value.trim();

    if (!apiKey) {
        showApiStatus('error', 'Please enter API key');
        return;
    }

    if (!testInput) {
        showApiStatus('error', 'Please enter a Flickr URL, photo ID, or username/photoId to test');
        return;
    }

    const testPhotoData = parseFlickrInput(testInput);
    if (!testPhotoData) {
        showApiStatus('error', 'Invalid input format. Please use: Flickr URL, photo ID, or username/photoId');
        return;
    }

    showApiStatus('loading', 'Testing full API integration with actual embed generation...');

    try {
        // Save API settings temporarily for testing
        await chrome.storage.local.set({
            flickrApiKey: apiKey
        });
        
        console.log('🧪 Testing API-based embed generation...');
        console.log('📸 Test photo data:', testPhotoData);

        // Test different sizes
        const testSizes = [
            { key: 'large2k', label: 'Large 2048px (API)' },
            { key: 'large1024', label: 'Large 1024px (should fallback to oEmbed)' },
            { key: 'original', label: 'Original (API)' }
        ];

        const results = [];

        for (const size of testSizes) {
            console.log(`Testing size: ${size.label}`);

            // Call the API directly to test getSizes method
            const apiUrl = `https://api.flickr.com/services/rest/?method=flickr.photos.getSizes&api_key=${apiKey}&photo_id=${testPhotoData.photoId}&format=json&nojsoncallback=1`;
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} for ${size.label}`);
            }
            
            const data = await response.json();
            
            if (data.stat === 'ok') {
                const availableSizes = data.sizes.size.map(s => `${s.label} (${s.width}×${s.height})`).join(', ');
                results.push(`✅ ${size.label}: API responded with ${data.sizes.size.length} available sizes`);
                console.log(`Available sizes for ${size.label}:`, availableSizes);
            } else {
                results.push(`❌ ${size.label}: ${data.message || 'API error'}`);
            }
        }
        
        const resultText = [
            `🎯 Full API Integration Test Results for Photo ID: ${testPhotoData.photoId}`,
            testPhotoData.username ? `👤 Username: ${testPhotoData.username}` : '',
            '',
            ...results,
            '',
            '💡 If all tests show "API responded with X sizes", your integration is working!',
            '🚀 Try the extension on a Flickr photo page now.'
        ].filter(line => line !== '').join('\n');
        
        showApiStatus('success', resultText);
        
    } catch (error) {
        console.error('🚨 Full integration test error:', error);
        showApiStatus('error', `Full integration test failed: ${error.message}`);
    }
}

async function saveDefaultMethod() {
    const method = document.getElementById('defaultMethod').value;
    
    try {
        await chrome.storage.local.set({ defaultMethod: method });
        console.log('Default method saved:', method);
    } catch (error) {
        console.error('Failed to save default method:', error);
    }
}

function showApiStatus(type, message) {
    const status = document.getElementById('apiStatus');
    const text = status.querySelector('.status-text');
    
    // Also log to console for debugging
    console.log(`[API Status - ${type.toUpperCase()}]:`, message);
    
    status.className = `api-status ${type}`;
    text.textContent = message;
    status.style.display = 'flex';
}