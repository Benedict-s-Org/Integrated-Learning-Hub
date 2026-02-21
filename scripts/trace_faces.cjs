const potrace = require('potrace');
const fs = require('fs');
const path = require('path');

const inputDir = '/Users/mba/.gemini/antigravity/brain/149ed5a7-4817-4206-888c-15453a4a5ebe';
const outputDir = process.cwd();

// The 3 face contours provided by the user
const images = [
    'media__1771608541834.jpg',
    'media__1771608541860.jpg',
    'media__1771608541867.jpg'
];

async function traceImage(filename, index) {
    return new Promise((resolve, reject) => {
        const inputPath = path.join(inputDir, filename);
        const outputPath = path.join(outputDir, `outline_${index + 1}.svg`);

        // Using default potrace options, but tweaking turnpolicy and turdsize to get a cleaner outline
        const params = {
            turnpolicy: potrace.Potrace.TURNPOLICY_MINORITY,
            turdsize: 100,
            optcurve: true,
            alphamax: 1,
            opttolerance: 0.2
        };

        potrace.trace(inputPath, params, function (err, svg) {
            if (err) {
                console.error(`Error tracing ${filename}:`, err);
                return reject(err);
            }
            fs.writeFileSync(outputPath, svg);
            console.log(`Generated SVG: ${outputPath}`);
            resolve();
        });
    });
}

async function run() {
    for (let i = 0; i < images.length; i++) {
        await traceImage(images[i], i);
    }
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
