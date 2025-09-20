# Flickr Embed Helper Browser Extension

A browser extension that makes it easy to generate HTML embed codes for Flickr photos and manage photo collections. Perfect for bloggers, web developers, and content creators who frequently embed Flickr photos.

## Features

### 🖼️ Quick Photo Embedding
- **Right-click context menu** on any Flickr photo to instantly generate embed HTML
- **Multiple size options** including Original, 2048px, 1600px, 1024px, and more
- **Smart size detection** - automatically uses the largest available size for each photo
- **Two embedding methods**:
  - **API mode**: Access to larger sizes (requires free Flickr API key)
  - **oEmbed mode**: Fallback method (limited to 1024px max)

### 📚 Collection Management
- **Create multiple collections** to organize your favorite Flickr photos
- **Drag & drop reordering** within collections
- **Bulk operations**: select multiple photos for batch removal
- **Export options**: Generate embed codes or photo URLs for entire collections
- **Persistent storage**: Collections are saved locally in your browser

### ⚙️ Advanced Options
- **Flexible export formats**: Choose between individual embed codes or consolidated HTML with shared script
- **Line break control**: Customize spacing in exported code
- **Default method selection**: Set your preferred embedding approach
- **API integration**: Optional Flickr API key for access to larger image sizes

### 🔧 Developer-Friendly
- **Clean HTML output** with proper Flickr attribution
- **Responsive embed codes** that work across devices
- **No external dependencies** beyond Flickr's embed script
- **Lightweight and fast** - minimal impact on browsing

## Installation

### For Users
1. **Chrome Web Store**: *Coming soon*
2. **Manual Installation** (Developer mode):
   - Download or clone this repository
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the extension folder

### For Developers
```bash
git clone https://github.com/radialmonster/flicker-embed-helper-browser-extension.git
cd flicker-embed-helper-browser-extension
```

## Quick Start

### Basic Usage (No API Key Required)
1. **Install the extension**
2. **Visit any Flickr photo page**
3. **Right-click on a photo** and select "Add to Flickr Collection" or "Generate Embed Code"
4. **Access your collections** by clicking the extension icon and selecting "Manage Collections"

### Advanced Usage (With API Key)
1. **Get a free Flickr API key**:
   - Go to [Flickr App Garden](https://www.flickr.com/services/apps/create/apply)
   - Choose "Non-Commercial" if using personally
   - Copy your API Key (Secret is not needed)

2. **Configure the extension**:
   - Click the extension icon → "Manage Collections"
   - Enter your API key in the settings
   - Click "Test Connection" to verify

3. **Enjoy larger embed sizes** up to Original resolution!

## File Structure

```
flicker-embed-helper-browser-extension/
├── manifest.json           # Extension configuration
├── background.js           # Service worker for embed generation
├── content.js             # Content script for Flickr page interaction
├── options.html           # Settings and collection management UI
├── options.js             # Options page functionality
├── options.css            # Styling for options page
├── icons/                 # Extension icons (if present)
└── README.md             # This file
```

## Core Components

### `manifest.json`
- **Version**: 0.2.4
- **Manifest Version**: 3 (Chrome Extensions MV3)
- **Permissions**: Context menus, storage, active tab, scripting
- **Host Permissions**: Flickr domains and API access

### `background.js` (~29KB)
- Service worker that handles:
  - Context menu creation and management
  - Embed code generation via Flickr API and oEmbed
  - Message passing between content scripts and options page
  - Size mapping and optimization logic

### `content.js` (~27KB)
- Runs on Flickr pages to:
  - Detect and extract photo metadata (ID, username, album info)
  - Provide right-click context menu functionality
  - Handle photo addition to collections
  - Support both individual photos and album pages

### `options.html` + `options.js` (~57KB total)
- Comprehensive management interface featuring:
  - **Collection Management**: Create, rename, delete, and organize collections
  - **Photo Management**: View thumbnails, reorder photos, bulk operations
  - **Export Tools**: Generate HTML embed codes or photo URL lists
  - **API Configuration**: Settings for Flickr API integration
  - **Testing Tools**: Verify API connectivity and test embed generation

### `options.css` (~17KB)
- Modern, responsive styling with:
  - CSS custom properties for theming
  - Grid and flexbox layouts
  - Smooth animations and transitions
  - Dark/light theme considerations

## API Integration

The extension supports two embedding methods:

### 1. Flickr API Method (Recommended)
- **Requires**: Free Flickr API key
- **Benefits**: Access to all available photo sizes including Original
- **API Endpoint**: `flickr.photos.getSizes`
- **No secret required**: Only the API key is needed for public photo access

### 2. oEmbed Fallback Method
- **Requires**: No API key
- **Limitation**: Maximum size of 1024px
- **API Endpoint**: Flickr's oEmbed service
- **Automatic**: Used when no API key is configured

## Privacy & Data

- **Local Storage Only**: All collections and settings are stored locally in your browser
- **No Data Collection**: The extension doesn't collect or transmit personal data
- **API Key Security**: Your Flickr API key is stored locally and only used for Flickr API calls
- **Minimal Permissions**: Only requests necessary permissions for core functionality

## Browser Support

- **Chrome**: Full support (Manifest V3)
- **Edge**: Full support (Chromium-based)
- **Firefox**: Not currently supported (MV3 differences)
- **Safari**: Not currently supported

## Development

### Prerequisites
- Chrome or Chromium-based browser
- Basic understanding of JavaScript and browser extensions

### Local Development
1. Clone the repository
2. Load as unpacked extension in Chrome
3. Make changes and reload the extension
4. Test on various Flickr photo pages

### Key Development Notes
- Uses Chrome Extensions Manifest V3
- Service worker architecture (no persistent background page)
- Async/await throughout for better performance
- Comprehensive error handling and user feedback
- Modular code organization with clear separation of concerns

## Contributing

Contributions are welcome! Please feel free to:
- Report bugs via GitHub Issues
- Suggest new features
- Submit pull requests
- Improve documentation

## License

This project is open source. Please check the repository for specific license terms.

## Changelog

### v0.2.4
- Removed API secret requirement (only API key needed)
- Improved error handling and user feedback
- Enhanced collection management features
- Performance optimizations

---

**Made with ❤️ for the Flickr community**

*This extension is not affiliated with Yahoo or Flickr. Flickr is a trademark of Yahoo Inc.*