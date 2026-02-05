const { app, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Get the default save directory based on user preference.
 * Now tries OUTPUT folder in project directory first, then Downloads, then Desktop, then home directory.
 */
function getDefaultSaveDir(preferred = 'downloads', customDestination = null) {
  // If user has set a custom destination, use it
  if (customDestination && fs.existsSync(customDestination)) {
    return customDestination;
  }

  // Try OUTPUT folder in project directory first
  const projectOutputDir = path.join(process.cwd(), 'OUTPUT');
  const home = os.homedir();

  let candidates;

  if (preferred === 'desktop') {
    candidates = [
      projectOutputDir, // Try project OUTPUT folder first
      path.join(home, 'Desktop'),
      path.join(home, 'Downloads'),
      home,
    ];
  } else if (preferred === 'downloads') {
    candidates = [
      projectOutputDir, // Try project OUTPUT folder first
      path.join(home, 'Downloads'),
      path.join(home, 'Desktop'),
      home,
    ];
  } else {
    // Default to Downloads folder
    candidates = [
      projectOutputDir, // Try project OUTPUT folder first
      path.join(home, 'Downloads'),
      path.join(home, 'Desktop'),
      home,
    ];
  }

  for (const candidate of candidates) {
    try {
      // Create OUTPUT folder if it doesn't exist (only for project directory)
      if (candidate === projectOutputDir && !fs.existsSync(candidate)) {
        fs.mkdirSync(candidate, { recursive: true });
        console.log(`[DownloadHandler] Created OUTPUT folder at: ${candidate}`);
      }

      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
    } catch (error) {
      // Continue to next candidate
      console.warn(`Failed to access directory ${candidate}:`, error.message);
    }
  }

  return home;
}

/**
 * Convert a data URL to a buffer
 * @param {string} dataUrl - The data URL to convert
 * @returns {Object} - Object containing buffer and extension
 */
function dataUrlToBuffer(dataUrl) {
  try {
    // Parse the data URL
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid data URL format');
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Determine file extension from MIME type
    const extensionMap = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
    };

    const extension = extensionMap[mimeType] || '.png';

    return { buffer, extension, mimeType };
  } catch (error) {
    throw new Error(`Failed to parse data URL: ${error.message}`);
  }
}

/**
 * Download a single image from a data URL
 * @param {string} dataUrl - The data URL of the image
 * @param {string} filename - The desired filename (without extension)
 * @param {string} preferredLocation - Preferred save location ('downloads' or 'desktop')
 * @param {string} customDestination - Custom destination path from user settings
 * @returns {Promise<Object>} - Result object with success status and file path
 */
async function downloadImage(dataUrl, filename, preferredLocation = 'downloads', customDestination = null) {
  try {
    // Convert data URL to buffer
    const { buffer, extension } = dataUrlToBuffer(dataUrl);

    // Get save directory
    const saveDir = getDefaultSaveDir(preferredLocation, customDestination);

    // Ensure filename has no invalid characters
    const sanitizedFilename = filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fullFilename = `${sanitizedFilename}${extension}`;
    const filePath = path.join(saveDir, fullFilename);

    // Handle duplicate filenames
    let finalPath = filePath;
    let counter = 1;
    while (fs.existsSync(finalPath)) {
      finalPath = path.join(saveDir, `${sanitizedFilename}_${counter}${extension}`);
      counter++;
    }

    // Write the file
    fs.writeFileSync(finalPath, buffer);

    return {
      success: true,
      filePath: finalPath,
      filename: path.basename(finalPath),
      message: `Image saved to ${finalPath}`
    };
  } catch (error) {
    console.error('Error downloading image:', error);
    return {
      success: false,
      error: error.message,
      message: `Failed to download image: ${error.message}`
    };
  }
}

/**
 * Create a ZIP file containing multiple images
 * @param {Array<Object>} images - Array of image objects with dataUrl and filename
 * @param {string} zipFilename - The desired ZIP filename (without extension)
 * @param {string} preferredLocation - Preferred save location ('downloads' or 'desktop')
 * @param {Function} progressCallback - Optional callback for progress updates
 * @param {string} customDestination - Custom destination path from user settings
 * @returns {Promise<Object>} - Result object with success status and ZIP file path
 */
async function createImageZip(images, zipFilename, preferredLocation = 'downloads', progressCallback = null, customDestination = null) {
  try {
    // Get save directory
    const saveDir = getDefaultSaveDir(preferredLocation, customDestination);

    // Create a temporary directory for the images
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storyboard-zip-'));

    // Process each image
    const imageFiles = [];
    for (let i = 0; i < images.length; i++) {
      const image = images[i];

      try {
        // Convert data URL to buffer
        const { buffer, extension } = dataUrlToBuffer(image.dataUrl);

        // Sanitize filename
        const sanitizedFilename = image.filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const fullFilename = `${sanitizedFilename}${extension}`;
        const imagePath = path.join(tempDir, fullFilename);

        // Write the image to temp directory
        fs.writeFileSync(imagePath, buffer);
        imageFiles.push({ path: imagePath, name: fullFilename });

        // Report progress
        if (progressCallback) {
          const progress = ((i + 1) / images.length) * 100;
          progressCallback({
            progress,
            message: `Processing image ${i + 1} of ${images.length}`
          });
        }
      } catch (error) {
        console.error(`Error processing image ${i}:`, error);
        // Continue with other images
      }
    }

    if (imageFiles.length === 0) {
      throw new Error('No valid images to zip');
    }

    // Create ZIP file
    const sanitizedZipFilename = zipFilename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const zipFilePath = path.join(saveDir, `${sanitizedZipFilename}.zip`);

    await createZipFile(tempDir, zipFilePath);

    // Cleanup temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });

    return {
      success: true,
      filePath: zipFilePath,
      filename: path.basename(zipFilePath),
      imageCount: imageFiles.length,
      message: `ZIP file created with ${imageFiles.length} images`
    };
  } catch (error) {
    console.error('Error creating ZIP:', error);
    return {
      success: false,
      error: error.message,
      message: `Failed to create ZIP: ${error.message}`
    };
  }
}

/**
 * Create a ZIP file from a directory (simple implementation)
 * @param {string} sourceDir - Source directory path
 * @param {string} zipPath - Destination ZIP file path
 */
async function createZipFile(sourceDir, zipPath) {
  return new Promise((resolve, reject) => {
    try {
      const files = [];

      // Collect all files recursively
      function collectFiles(dir, baseDir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(baseDir, fullPath);

          if (entry.isDirectory()) {
            collectFiles(fullPath, baseDir);
          } else if (entry.isFile()) {
            files.push({ relativePath, fullPath });
          }
        }
      }

      collectFiles(sourceDir, sourceDir);

      if (files.length === 0) {
        reject(new Error('No files to zip'));
        return;
      }

      // Create ZIP archive
      const zipBuffer = createZipArchive(files);
      fs.writeFileSync(zipPath, zipBuffer);

      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Create a ZIP archive buffer from a list of files
 * Uses STORE method (no compression) for simplicity
 * @param {Array<Object>} files - Array of file objects with relativePath and fullPath
 * @returns {Buffer} - ZIP archive buffer
 */
function createZipArchive(files) {
  const parts = [];
  const centralDir = [];
  let offset = 0;

  for (const file of files) {
    const content = fs.readFileSync(file.fullPath);
    const filename = file.relativePath.replace(/\\/g, '/'); // Use forward slashes
    const filenameBuffer = Buffer.from(filename, 'utf-8');

    // Local file header
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // Local file header signature
    localHeader.writeUInt16LE(20, 4); // Version needed to extract (2.0)
    localHeader.writeUInt16LE(0, 6); // General purpose bit flag
    localHeader.writeUInt16LE(0, 8); // Compression method (0 = stored)
    localHeader.writeUInt16LE(0, 10); // File last modification time
    localHeader.writeUInt16LE(0, 12); // File last modification date
    localHeader.writeUInt32LE(crc32(content), 14); // CRC-32
    localHeader.writeUInt32LE(content.length, 18); // Compressed size
    localHeader.writeUInt32LE(content.length, 22); // Uncompressed size
    localHeader.writeUInt16LE(filenameBuffer.length, 26); // File name length
    localHeader.writeUInt16LE(0, 28); // Extra field length

    const localEntry = Buffer.concat([localHeader, filenameBuffer, content]);
    parts.push(localEntry);

    // Central directory entry
    const centralEntry = Buffer.alloc(46);
    centralEntry.writeUInt32LE(0x02014b50, 0); // Central directory signature
    centralEntry.writeUInt16LE(20, 4); // Version made by
    centralEntry.writeUInt16LE(20, 6); // Version needed to extract
    centralEntry.writeUInt16LE(0, 8); // General purpose bit flag
    centralEntry.writeUInt16LE(0, 10); // Compression method
    centralEntry.writeUInt16LE(0, 12); // File last modification time
    centralEntry.writeUInt16LE(0, 14); // File last modification date
    centralEntry.writeUInt32LE(crc32(content), 16); // CRC-32
    centralEntry.writeUInt32LE(content.length, 20); // Compressed size
    centralEntry.writeUInt32LE(content.length, 24); // Uncompressed size
    centralEntry.writeUInt16LE(filenameBuffer.length, 28); // File name length
    centralEntry.writeUInt16LE(0, 30); // Extra field length
    centralEntry.writeUInt16LE(0, 32); // File comment length
    centralEntry.writeUInt16LE(0, 34); // Disk number start
    centralEntry.writeUInt16LE(0, 36); // Internal file attributes
    centralEntry.writeUInt32LE(0, 38); // External file attributes
    centralEntry.writeUInt32LE(offset, 42); // Relative offset of local header

    centralDir.push(Buffer.concat([centralEntry, filenameBuffer]));
    offset += localEntry.length;
  }

  // Concatenate local entries
  const localEntries = Buffer.concat(parts);
  const centralDirBuffer = Buffer.concat(centralDir);
  const centralDirOffset = localEntries.length;

  // End of central directory record
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0); // End of central directory signature
  endRecord.writeUInt16LE(0, 4); // Number of this disk
  endRecord.writeUInt16LE(0, 6); // Disk where central directory starts
  endRecord.writeUInt16LE(files.length, 8); // Number of central directory records on this disk
  endRecord.writeUInt16LE(files.length, 10); // Total number of central directory records
  endRecord.writeUInt32LE(centralDirBuffer.length, 12); // Size of central directory
  endRecord.writeUInt32LE(centralDirOffset, 16); // Offset of start of central directory
  endRecord.writeUInt16LE(0, 20); // Comment length

  return Buffer.concat([localEntries, centralDirBuffer, endRecord]);
}

/**
 * Calculate CRC-32 checksum
 * @param {Buffer} data - Data to calculate CRC for
 * @returns {number} - CRC-32 checksum
 */
function crc32(data) {
  let crc = 0xffffffff;
  const table = getCrc32Table();

  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff];
  }

  return (crc ^ 0xffffffff) >>> 0;
}

// CRC-32 lookup table (lazily initialized)
let crc32Table = null;

function getCrc32Table() {
  if (crc32Table !== null) {
    return crc32Table;
  }

  crc32Table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crc32Table[i] = c >>> 0;
  }
  return crc32Table;
}

/**
 * Download the reference image
 * @param {string} dataUrl - The data URL of the reference image
 * @param {string} preferredLocation - Preferred save location
 * @param {string} customDestination - Custom destination path from user settings
 * @returns {Promise<Object>} - Result object
 */
async function downloadReferenceImage(dataUrl, preferredLocation = 'downloads', customDestination = null) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return downloadImage(dataUrl, `storyboard-reference-${timestamp}`, preferredLocation, customDestination);
}

module.exports = {
  downloadImage,
  createImageZip,
  downloadReferenceImage,
  getDefaultSaveDir
};