#!/usr/bin/env node
/**
 * Image Processing Script
 * 
 * This script watches the /src/assets/upload folder for new images,
 * removes white backgrounds, smooths edges, and moves them to /src/assets/processed.
 * 
 * Usage:
 *   node scripts/process-uploads.js        # Process once
 *   node scripts/process-uploads.js --watch  # Watch for new files
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const UPLOAD_DIR = path.join(__dirname, '../src/assets/upload');
const PROCESSED_DIR = path.join(__dirname, '../src/assets/processed');

// Ensure directories exist
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(PROCESSED_DIR)) fs.mkdirSync(PROCESSED_DIR, { recursive: true });

/**
 * Remove white background and smooth edges
 * @param {string} inputPath - Path to input image
 * @param {string} outputPath - Path to save processed image
 */
async function processImage(inputPath, outputPath) {
    const filename = path.basename(inputPath);
    console.log(`🖼️  Processing: ${filename}`);

    try {
        // Read the image
        const image = sharp(inputPath);
        const metadata = await image.metadata();

        // Get raw pixel data
        const { data, info } = await image
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const { width, height, channels } = info;

        // Process pixels: make white/near-white pixels transparent
        const WHITE_THRESHOLD = 240; // Pixels with R,G,B all above this become transparent
        const EDGE_THRESHOLD = 200; // For edge detection/smoothing

        for (let i = 0; i < data.length; i += channels) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Check if pixel is white or near-white
            if (r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD) {
                data[i + 3] = 0; // Set alpha to 0 (transparent)
            }
            // Smooth edges: semi-transparent for near-white pixels
            else if (r >= EDGE_THRESHOLD && g >= EDGE_THRESHOLD && b >= EDGE_THRESHOLD) {
                // Calculate how "white" this pixel is (0-1)
                const whiteness = Math.min(r, g, b) / 255;
                const edgeFactor = (whiteness - (EDGE_THRESHOLD / 255)) / ((WHITE_THRESHOLD - EDGE_THRESHOLD) / 255);
                if (edgeFactor > 0) {
                    // Gradually reduce alpha based on whiteness
                    const newAlpha = Math.round(data[i + 3] * (1 - edgeFactor * 0.8));
                    data[i + 3] = newAlpha;
                }
            }
        }

        // Create output image with processed data
        await sharp(data, { raw: { width, height, channels } })
            .png({ quality: 100, compressionLevel: 9 })
            // Apply slight blur to smooth harsh edges, then sharpen to restore details
            .blur(0.5)
            .sharpen({ sigma: 0.5, m1: 0, m2: 1 })
            .toFile(outputPath);

        console.log(`✅ Saved: ${path.basename(outputPath)}`);
        return true;
    } catch (error) {
        console.error(`❌ Error processing ${filename}:`, error.message);
        return false;
    }
}

/**
 * Process all images in the upload folder
 */
async function processAllUploads() {
    const files = fs.readdirSync(UPLOAD_DIR);
    const imageFiles = files.filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));

    if (imageFiles.length === 0) {
        console.log('📂 No images found in upload folder.');
        return;
    }

    console.log(`\n🚀 Found ${imageFiles.length} image(s) to process...\n`);

    let successCount = 0;
    for (const file of imageFiles) {
        const inputPath = path.join(UPLOAD_DIR, file);
        const outputFilename = file.replace(/\.(jpg|jpeg|webp)$/i, '.png'); // Always output as PNG for transparency
        const outputPath = path.join(PROCESSED_DIR, outputFilename);

        const success = await processImage(inputPath, outputPath);
        if (success) {
            successCount++;
            // Remove original file after successful processing
            fs.unlinkSync(inputPath);
            console.log(`🗑️  Removed original: ${file}\n`);
        }
    }

    console.log(`\n🎉 Done! Processed ${successCount}/${imageFiles.length} images.`);
    console.log(`📁 Output folder: ${PROCESSED_DIR}\n`);
}

/**
 * Watch mode: monitor upload folder for new files
 */
function watchMode() {
    console.log('👀 Watching for new uploads...');
    console.log(`📁 Upload folder: ${UPLOAD_DIR}\n`);

    // Debounce to avoid processing the same file multiple times
    const processing = new Set();

    fs.watch(UPLOAD_DIR, async (eventType, filename) => {
        if (!filename || !/\.(png|jpg|jpeg|webp)$/i.test(filename)) return;
        if (processing.has(filename)) return;

        processing.add(filename);

        // Wait a bit for file to finish writing
        await new Promise(resolve => setTimeout(resolve, 500));

        const inputPath = path.join(UPLOAD_DIR, filename);
        if (!fs.existsSync(inputPath)) {
            processing.delete(filename);
            return;
        }

        const outputFilename = filename.replace(/\.(jpg|jpeg|webp)$/i, '.png');
        const outputPath = path.join(PROCESSED_DIR, outputFilename);

        const success = await processImage(inputPath, outputPath);
        if (success) {
            fs.unlinkSync(inputPath);
            console.log(`🗑️  Removed original: ${filename}\n`);
        }

        processing.delete(filename);
    });
}

// Main execution
const args = process.argv.slice(2);
if (args.includes('--watch') || args.includes('-w')) {
    // First process any existing files
    processAllUploads().then(() => {
        watchMode();
    });
} else {
    processAllUploads();
}
