// Content script for Flickr Embed Helper
// Enhanced photo detection for various Flickr page types

// Photo Data Model
class PhotoData {
    constructor(data = {}) {
        this.photoId = data.photoId || null;
        this.username = data.username || null;
        this.title = data.title || '';
        this.albumId = data.albumId || null;
        this.imageSecret = data.imageSecret || null;
        this.serverId = data.serverId || null;
        this.url = data.url || null;
        // Basic dimension data for debugging (not used in suffix-only embeds)
        this.detectedImageWidth = data.detectedImageWidth || null;
        this.detectedImageHeight = data.detectedImageHeight || null;
        this.detectedImageSize = data.detectedImageSize || null;
    }

    isValid() {
        return !!(this.photoId && this.username);
    }

    generateUrl() {
        if (!this.isValid()) return null;
        
        if (this.albumId) {
            return `https://www.flickr.com/photos/${this.username}/${this.photoId}/in/album-${this.albumId}/`;
        }
        return `https://www.flickr.com/photos/${this.username}/${this.photoId}/`;
    }

    hasImageData() {
        return !!(this.imageSecret && this.serverId);
    }
}

// Utility class for parsing Flickr image URLs
class FlickrImageParser {
    static parseImageUrl(src) {
        if (!src || !src.includes('staticflickr.com')) return null;
        
        const match = src.match(/staticflickr\.com\/(\d+)\/(\d+)_([a-zA-Z0-9]+)(?:_([a-z0-9k]+))?\.jpg/);
        if (!match) return null;
        
        const sizeSuffix = match[4] || 'medium';
        const sizeKey = this.suffixToSizeKey(sizeSuffix);
        
        return {
            serverId: match[1],
            photoId: match[2],
            secret: match[3],
            sizeSuffix: sizeSuffix,
            sizeKey: sizeKey,
            originalSrc: src
        };
    }

    static suffixToSizeKey(suffix) {
        const suffixMap = {
            'o': 'original',
            '6k': 'large6k',  // Changed: 6k is not original, it's just very large
            '5k': 'large5k',
            '4k': 'large4k', 
            '3k': 'large3k',
            'k': 'large2k',
            'h': 'large1600',
            'b': 'large1024',
            'c': 'medium800',
            'z': 'medium640',
            '': 'small500',
            'medium': 'small500',
            't': 'thumbnail',
            'q': 'square'
        };
        return suffixMap[suffix] || 'large1024';
    }

    static isFlickrImage(element) {
        return element.tagName === 'IMG' && element.src && element.src.includes('staticflickr.com');
    }

    static extractDimensionsFromImage(img) {
        if (!img) return null;
        
        // Try multiple ways to get dimensions
        const width = img.naturalWidth || img.width || parseInt(img.getAttribute('width')) || null;
        const height = img.naturalHeight || img.height || parseInt(img.getAttribute('height')) || null;
        
        if (width && height) {
            const imageData = this.parseImageUrl(img.src);
            return {
                width: width,
                height: height,
                sizeKey: imageData?.sizeKey || 'large1024'
            };
        }
        
        return null;
    }
}

// Utility class for extracting Flickr's JSON data
class FlickrDataExtractor {
    static extractPhotoSizes(photoId) {
        try {
            // Search through all script tags for photoModel data
            const scripts = document.querySelectorAll('script');
            for (const script of scripts) {
                const content = script.innerHTML;
                
                // Look for the pattern containing photoModel and the specific photo ID
                if (content.includes('photoModel') && content.includes(photoId)) {
                    // Extract JSON data from Y.ClientApp.init() or similar patterns
                    const match = content.match(/"photoModel":\s*({[^}]*"sizes":[^}]*}[^}]*})/);
                    if (match) {
                        try {
                            // Parse the photoModel JSON
                            const photoModelStr = match[1];
                            const photoModel = JSON.parse(photoModelStr);
                            
                            if (photoModel.sizes) {
                                console.log('📋 Extracted Flickr size data:', photoModel.sizes);
                                return photoModel.sizes;
                            }
                        } catch (parseError) {
                            console.warn('Failed to parse photoModel JSON:', parseError);
                        }
                    }
                    
                    // Alternative: Look for complete sizes object
                    const sizesMatch = content.match(/"sizes":\s*({[^}]*"o":[^}]*})/);
                    if (sizesMatch) {
                        try {
                            const sizes = JSON.parse(sizesMatch[1]);
                            console.log('📋 Extracted Flickr size data (alt method):', sizes);
                            return sizes;
                        } catch (parseError) {
                            console.warn('Failed to parse sizes JSON:', parseError);
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('Error extracting Flickr data:', error);
        }
        
        return null;
    }

    static getSizeInfo(sizes, requestedSizeKey) {
        if (!sizes) return null;
        
        // Map our size keys to Flickr's size keys
        const sizeKeyMap = {
            'original': 'o',
            'large6k': '6k',
            'large5k': '5k', 
            'large4k': '4k',
            'large3k': '3k',
            'large2k': 'k',
            'large1600': 'h',
            'large1024': 'l',  // Note: Flickr uses 'l' for 1024px, not 'b'
            'medium800': 'c',
            'medium640': 'z',
            'small500': 'm',
            'thumbnail': 't',
            'square': 'q'
        };

        const flickrKey = sizeKeyMap[requestedSizeKey];
        if (!flickrKey || !sizes[flickrKey]) {
            // Try to find the largest available size as fallback
            const availableSizes = ['o', '6k', '5k', '4k', '3k', 'k', 'h', 'l', 'c', 'z', 'm'];
            for (const size of availableSizes) {
                if (sizes[size]) {
                    console.log(`📸 Size ${requestedSizeKey} not available, using ${size} instead`);
                    return sizes[size];
                }
            }
            return null;
        }

        return sizes[flickrKey];
    }
}

// Base class for photo detection strategies
class PhotoDetectionStrategy {
    constructor(name) {
        this.name = name;
    }

    detect(element) {
        throw new Error('detect() must be implemented by subclass');
    }

    log(message, data = {}) {
        console.log(`🔍 [${this.name}] ${message}`, data);
    }
}

// Strategy for detecting photos from direct photo pages
class DirectPhotoPageDetector extends PhotoDetectionStrategy {
    constructor() {
        super('DirectPhotoPage');
    }

    detect(element) {
        const url = window.location.href;
        const pathname = window.location.pathname;
        
        // Single photo page: /photos/username/photoId or /photos/username/photoId/in/album-albumId
        const singlePhotoMatch = pathname.match(/\/photos\/([^\/]+)\/(\d+)/);
        if (!singlePhotoMatch) return null;

        const [, username, photoId] = singlePhotoMatch;
        const albumMatch = url.match(/\/album-(\d+)/);
        const albumId = albumMatch ? albumMatch[1] : null;

        // Get title from page metadata
        let title = this.extractTitle();
        
        // Try to get image data from page
        const imageData = this.findImageDataOnPage(photoId);
        
        // Try to get dimensions from the best available image
        const allImageData = this.findAllImageDataOnPage(photoId);
        let dimensionData = null;
        
        if (allImageData && allImageData.length > 0) {
            // Use the highest quality image for dimension calculation
            const bestImage = allImageData[0]; // Already sorted by quality
            dimensionData = {
                width: bestImage.detectedWidth || bestImage.element.naturalWidth,
                height: bestImage.detectedHeight || bestImage.element.naturalHeight,
                sizeKey: bestImage.sizeKey
            };
            console.log('🎯 Using best image for dimensions:', {
                src: bestImage.originalSrc,
                sizeKey: bestImage.sizeKey,
                dimensions: `${dimensionData.width}x${dimensionData.height}`
            });
        } else {
            // Fallback to main photo selector
            const mainPhoto = document.querySelector('.main-photo, img[class*="main"]');
            dimensionData = mainPhoto ? FlickrImageParser.extractDimensionsFromImage(mainPhoto) : null;
        }
        
        const photoData = new PhotoData({
            photoId,
            username,
            albumId,
            title,
            imageSecret: imageData?.secret,
            serverId: imageData?.serverId,
            detectedImageWidth: dimensionData?.width,
            detectedImageHeight: dimensionData?.height,
            detectedImageSize: dimensionData?.sizeKey
        });

        photoData.url = photoData.generateUrl();
        
        this.log('Detected photo from direct page', photoData);
        return photoData;
    }

    extractTitle() {
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle && ogTitle.content) {
            return ogTitle.content.replace(/\s*\|\s*Flickr$/, '').trim();
        }
        return document.title.replace(/\s*\|\s*Flickr$/, '').trim();
    }

    findImageDataOnPage(targetPhotoId) {
        const images = document.querySelectorAll('img[src*="staticflickr.com"]');
        let bestMatch = null;
        let bestSize = 0;
        
        // Find all matching images and prefer the largest/highest quality
        for (const img of images) {
            const parsed = FlickrImageParser.parseImageUrl(img.src);
            if (parsed && parsed.photoId === targetPhotoId) {
                // Priority order for size selection (higher is better)
                const sizePriority = {
                    'original': 1000,
                    'large6k': 900, 'large5k': 800, 'large4k': 700, 'large3k': 600, 'large2k': 500,
                    'large1600': 400, 'large1024': 300, 'medium800': 200, 'medium640': 100,
                    'small500': 50, 'thumbnail': 10, 'square': 5
                };
                
                const priority = sizePriority[parsed.sizeKey] || 0;
                if (priority > bestSize) {
                    bestMatch = parsed;
                    bestSize = priority;
                }
            }
        }
        return bestMatch;
    }

    findAllImageDataOnPage(targetPhotoId) {
        const images = document.querySelectorAll('img[src*="staticflickr.com"]');
        const matches = [];
        
        for (const img of images) {
            const parsed = FlickrImageParser.parseImageUrl(img.src);
            if (parsed && parsed.photoId === targetPhotoId) {
                const dimensions = FlickrImageParser.extractDimensionsFromImage(img);
                matches.push({
                    ...parsed,
                    detectedWidth: dimensions?.width,
                    detectedHeight: dimensions?.height,
                    element: img
                });
            }
        }
        
        return matches.sort((a, b) => {
            const sizePriority = {
                'original': 1000, 'large6k': 900, 'large5k': 800, 'large4k': 700, 
                'large3k': 600, 'large2k': 500, 'large1600': 400, 'large1024': 300, 
                'medium800': 200, 'medium640': 100, 'small500': 50, 'thumbnail': 10, 'square': 5
            };
            return (sizePriority[b.sizeKey] || 0) - (sizePriority[a.sizeKey] || 0);
        });
    }
}

// Strategy for detecting photos from thumbnail elements (albums, photostreams)
class ThumbnailPhotoDetector extends PhotoDetectionStrategy {
    constructor() {
        super('ThumbnailPhoto');
    }

    detect(element) {
        // Look for photo link (works for thumbnails in albums)
        const photoLink = element.closest('a[href*="/photos/"]');
        if (!photoLink) return null;

        const href = photoLink.href;
        const match = href.match(/\/photos\/([^\/]+)\/(\d+)/);
        if (!match) return null;

        const [, username, photoId] = match;
        
        // Extract title from multiple sources
        let title = this.extractTitleFromLink(photoLink);
        
        // Find associated image and extract data
        const img = this.findAssociatedImage(photoLink, element);
        const imageData = img ? FlickrImageParser.parseImageUrl(img.src) : null;
        
        // Extract dimensions from thumbnail
        const dimensionData = img ? FlickrImageParser.extractDimensionsFromImage(img) : null;
        
        // Get title from image if not found in link
        if (!title && img) {
            title = img.alt || img.title || '';
        }
        
        // Try to find title in nearby elements (photostream specific)
        if (!title) {
            title = this.findTitleInContainer(photoLink);
        }
        
        // Check for album context
        const albumId = this.extractAlbumId(href);
        
        const photoData = new PhotoData({
            photoId,
            username,
            title,
            albumId,
            imageSecret: imageData?.secret,
            serverId: imageData?.serverId,
            detectedImageWidth: dimensionData?.width,
            detectedImageHeight: dimensionData?.height,
            detectedImageSize: dimensionData?.sizeKey
        });

        photoData.url = photoData.generateUrl();
        
        this.log('Detected photo from thumbnail', { 
            photoId, 
            href,
            hasImage: !!img,
            imageData,
            title 
        });
        
        return photoData;
    }

    extractTitleFromLink(photoLink) {
        let title = photoLink.title || photoLink.getAttribute('aria-label') || '';
        
        // Clean up aria-label (photostreams use this)
        if (title && photoLink.getAttribute('aria-label')) {
            title = title.replace(/ by .+!?$/, '').trim();
        }
        
        return title;
    }

    findAssociatedImage(photoLink, clickedElement) {
        // Method A: Look for image inside the link
        let img = photoLink.querySelector('img');
        
        // Method B: Look for sibling image (album structure)
        if (!img) {
            const photoContainer = photoLink.closest('.photo, .photo-card-photo');
            if (photoContainer) {
                img = photoContainer.querySelector('img[src*="staticflickr.com"]');
            }
        }
        
        // Method C: Look for image in parent container
        if (!img) {
            const parentContainer = photoLink.closest('.photo-card, .view');
            if (parentContainer) {
                img = parentContainer.querySelector('img[src*="staticflickr.com"]');
            }
        }
        
        // Method D: Look for photostream structure
        if (!img) {
            const photostreamContainer = photoLink.closest('.photo-list-photo-view, .photo-list-photo-container');
            if (photostreamContainer) {
                img = photostreamContainer.querySelector('img[src*="staticflickr.com"]');
            }
        }
        
        // Method E: Handle photostream overlay links
        if (!img && photoLink.classList.contains('overlay')) {
            const photostreamParent = photoLink.closest('.photo-list-photo-view');
            if (photostreamParent) {
                img = photostreamParent.querySelector('img[src*="staticflickr.com"]');
            }
        }

        return img;
    }

    findTitleInContainer(photoLink) {
        const photoContainer = photoLink.closest('.photo-list-photo-view, .photo-card');
        if (photoContainer) {
            const titleLink = photoContainer.querySelector('a.title');
            if (titleLink) {
                return titleLink.textContent.trim();
            }
        }
        return '';
    }

    extractAlbumId(href) {
        const albumMatch = href.match(/\/album-(\d+)/);
        if (albumMatch) return albumMatch[1];
        
        // Try to get album from current page URL
        const currentAlbumMatch = window.location.pathname.match(/\/albums\/(\d+)/);
        return currentAlbumMatch ? currentAlbumMatch[1] : null;
    }
}

// Strategy for detecting photos from data attributes
class DataAttributePhotoDetector extends PhotoDetectionStrategy {
    constructor() {
        super('DataAttribute');
    }

    detect(element) {
        const photoContainer = element.closest('[data-photo-id]');
        if (!photoContainer) return null;

        const photoId = photoContainer.getAttribute('data-photo-id');
        
        // Get username from page URL
        const usernameMatch = window.location.pathname.match(/\/photos\/([^\/]+)/);
        const username = usernameMatch ? usernameMatch[1] : '';
        
        if (!photoId || !username) return null;

        const img = photoContainer.querySelector('img[src*="staticflickr.com"]');
        const title = img ? (img.alt || img.title || '') : '';
        
        // Extract image info from thumbnail if available
        const imageData = img ? FlickrImageParser.parseImageUrl(img.src) : null;
        
        // Only use image data if it matches our photo ID
        const validImageData = imageData && imageData.photoId === photoId ? imageData : null;
        
        // Check for album context
        const currentAlbumMatch = window.location.pathname.match(/\/albums\/(\d+)/);
        const albumId = currentAlbumMatch ? currentAlbumMatch[1] : null;
        
        const photoData = new PhotoData({
            photoId,
            username,
            title,
            albumId,
            imageSecret: validImageData?.secret,
            serverId: validImageData?.serverId
        });

        photoData.url = photoData.generateUrl();
        
        this.log('Detected photo from data attributes', photoData);
        return photoData;
    }
}

// Strategy for detecting photos from direct image elements
class DirectImageDetector extends PhotoDetectionStrategy {
    constructor() {
        super('DirectImage');
    }

    detect(element) {
        if (!FlickrImageParser.isFlickrImage(element)) return null;

        const imageData = FlickrImageParser.parseImageUrl(element.src);
        if (!imageData) return null;

        // Get username from page URL
        const usernameMatch = window.location.pathname.match(/\/photos\/([^\/]+)/);
        const username = usernameMatch ? usernameMatch[1] : '';
        
        if (!username) return null;

        const title = element.alt || element.title || '';
        
        // Check for album context
        const currentAlbumMatch = window.location.pathname.match(/\/albums\/(\d+)/);
        const albumId = currentAlbumMatch ? currentAlbumMatch[1] : null;
        
        const photoData = new PhotoData({
            photoId: imageData.photoId,
            username,
            title,
            albumId,
            imageSecret: imageData.secret,
            serverId: imageData.serverId
        });

        photoData.url = photoData.generateUrl();
        
        this.log('Detected photo from direct image', photoData);
        return photoData;
    }
}

// Main detection manager that coordinates all strategies
class PhotoDetectionManager {
    constructor() {
        // Separate strategies for element-based detection (exclude DirectPhotoPageDetector)
        this.elementStrategies = [
            new ThumbnailPhotoDetector(), 
            new DataAttributePhotoDetector(),
            new DirectImageDetector()
        ];
        
        // Direct page detector for page-level detection
        this.pageDetector = new DirectPhotoPageDetector();
    }

    // Detect photo from current page (for direct photo pages)
    detectFromPage() {
        try {
            const result = this.pageDetector.detect(null);
            if (result && result.isValid()) {
                console.log(`✅ Page detection successful:`, result);
                return result;
            }
        } catch (error) {
            console.warn('❌ Page detection failed:', error);
        }
        return null;
    }

    // Detect photo from clicked element (for thumbnails, etc.)
    detectFromElement(element) {
        if (!element) return null;

        // Try each element strategy until one succeeds
        for (const strategy of this.elementStrategies) {
            try {
                const result = strategy.detect(element);
                if (result && result.isValid()) {
                    console.log(`✅ Successfully detected photo using ${strategy.name}:`, result);
                    return result;
                }
            } catch (error) {
                console.warn(`❌ ${strategy.name} detection failed:`, error);
            }
        }

        console.log('❌ No element detection strategy succeeded for element:', element);
        return null;
    }

    // Smart detection method - chooses appropriate strategy based on context
    detect(element = null) {
        // If we have an element to work with, prioritize element detection
        if (element) {
            const elementResult = this.detectFromElement(element);
            if (elementResult && elementResult.isValid()) {
                return elementResult;
            }
        }
        
        // Fallback to page detection (for direct photo pages or when element detection fails)
        const pageResult = this.detectFromPage();
        if (pageResult && pageResult.isValid()) {
            return pageResult;
        }

        return null;
    }
}

// Simplified: No dimension calculations needed with suffix-only approach

// Global detector instance
const photoDetector = new PhotoDetectionManager();

function extractPhotoDataFromPage() {
    return photoDetector.detectFromPage();
}

function extractPhotoFromElement(element) {
    return photoDetector.detectFromElement(element);
}

// Store current photo data for context menu  
let currentPhotoData = null;

// Enhanced context menu detection with error handling
document.addEventListener('contextmenu', (e) => {
    const target = e.target;
    
    try {
        // Reset current photo data
        currentPhotoData = null;
        
        // Use the unified detector
        currentPhotoData = photoDetector.detect(target);
        
        // Photo data is now ready for context menu use
        if (currentPhotoData && currentPhotoData.isValid()) {
            console.log('🔍 Photo data ready for context menu:', currentPhotoData);
        } else {
            console.log('🔍 No valid photo data detected for context menu');
        }
    } catch (error) {
        console.error('Error in context menu detection:', error);
        currentPhotoData = null;
    }
}, true);

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPhotoData') {
        try {
            // Return current photo data or try to detect from page
            let photoData = currentPhotoData;
            
            if (!photoData || !photoData.isValid()) {
                photoData = photoDetector.detectFromPage();
            }
            
            // Convert PhotoData instance to plain object for message passing
            if (photoData && photoData.isValid()) {
                sendResponse({
                    photoId: photoData.photoId,
                    username: photoData.username,
                    title: photoData.title,
                    albumId: photoData.albumId,
                    imageSecret: photoData.imageSecret,
                    serverId: photoData.serverId,
                    url: photoData.url || photoData.generateUrl(),
                    detectedImageWidth: photoData.detectedImageWidth,
                    detectedImageHeight: photoData.detectedImageHeight,
                    detectedImageSize: photoData.detectedImageSize
                });
            } else {
                sendResponse(null);
            }
        } catch (error) {
            console.error('Error getting photo data:', error);
            sendResponse(null);
        }
    }
    
    if (request.action === 'copyToClipboard') {
        // Copy embed code to clipboard
        navigator.clipboard.writeText(request.text).then(() => {
            showNotification('✅ Ready to paste!');
        }).catch(() => {
            // Fallback for clipboard access issues
            fallbackCopyToClipboard(request.text);
            showNotification('📋 Copied! Ready to paste!');
        });
    }
    
    if (request.action === 'showNotification') {
        showNotification(request.message);
    }
    
});

// Fallback clipboard copy for older browsers
function fallbackCopyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
}


// Show temporary notification
function showNotification(message) {
    // Remove any existing notifications first
    const existingNotification = document.querySelector('.flickr-embedder-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = 'flickr-embedder-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #0063dc;
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        border: none;
        transition: opacity 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 2700);
}