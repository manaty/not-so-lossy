const https = require('https');
const fs = require('fs');
const path = require('path');

// Famous USC-SIPI test images
const testImages = [
  {
    name: 'lena.png',
    url: 'https://www.ece.rice.edu/~wakin/images/lena512color.png',
    description: 'Lena - Standard test image'
  },
  {
    name: 'barbara.png', 
    url: 'https://homepages.cae.wisc.edu/~ece533/images/barbara.png',
    description: 'Barbara - Good for testing high frequency patterns'
  },
  {
    name: 'cameraman.png',
    url: 'https://homepages.cae.wisc.edu/~ece533/images/cameraman.png',
    description: 'Cameraman - Classic grayscale test image'
  },
  {
    name: 'peppers.png',
    url: 'https://homepages.cae.wisc.edu/~ece533/images/peppers.png',
    description: 'Peppers - Color image with smooth regions'
  },
  {
    name: 'mandrill.png',
    url: 'https://homepages.cae.wisc.edu/~ece533/images/baboon.png',
    description: 'Mandrill (Baboon) - High texture content'
  }
];

// Create examples directory if it doesn't exist
const examplesDir = path.join(__dirname, '../examples');
if (!fs.existsSync(examplesDir)) {
  fs.mkdirSync(examplesDir, { recursive: true });
}

// Download each image
function downloadImage(imageInfo) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(examplesDir, imageInfo.name);
    const file = fs.createWriteStream(filePath);
    
    https.get(imageInfo.url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`Downloaded: ${imageInfo.name} - ${imageInfo.description}`);
          resolve();
        });
      } else {
        file.close();
        fs.unlinkSync(filePath);
        console.error(`Failed to download ${imageInfo.name}: ${response.statusCode}`);
        reject(new Error(`HTTP ${response.statusCode}`));
      }
    }).on('error', (err) => {
      file.close();
      fs.unlinkSync(filePath);
      console.error(`Error downloading ${imageInfo.name}:`, err.message);
      reject(err);
    });
  });
}

// Download all images
async function downloadAllImages() {
  console.log('Downloading USC-SIPI standard test images...\n');
  
  for (const image of testImages) {
    try {
      await downloadImage(image);
    } catch (err) {
      console.error(`Skipping ${image.name} due to error`);
    }
  }
  
  console.log('\nTest images downloaded to examples/ directory');
}

downloadAllImages().catch(console.error);