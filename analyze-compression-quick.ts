import * as fs from 'fs';
import * as path from 'path';
import { createCanvas, loadImage } from 'canvas';
import { QDCTCodec } from './src/codecs/qdct/qdct-codec';
import { ImageData, CodecOptions } from './src/codecs/types';

interface CompressionDataPoint {
  level: number;
  size: number;
  sizeKB: number;
  compressionRatio: number;
  bitsPerPixel: number;
}

async function loadImageAsImageData(imagePath: string): Promise<ImageData> {
  const img = await loadImage(imagePath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  
  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  return {
    data: new Uint8ClampedArray(imageData.data),
    width: img.width,
    height: img.height
  };
}

async function quickAnalysis() {
  const codec = new QDCTCodec();
  const imageDir = 'demo/public/images';
  
  // Test with just a few images and levels
  const testImages = ['im1.jpg', 'im2.jpg', 'im3.jpg'];
  const testLevels = [0, 10, 20, 30, 40, 50, 60, 80, 100, 150];
  
  const results: any[] = [];
  
  for (const imageName of testImages) {
    const imagePath = path.join(imageDir, imageName);
    console.log(`\nAnalyzing ${imageName}...`);
    
    const imageData = await loadImageAsImageData(imagePath);
    const originalSize = imageData.width * imageData.height * 3;
    const pixelCount = imageData.width * imageData.height;
    
    console.log(`  Resolution: ${imageData.width}x${imageData.height}`);
    console.log(`  Original size: ${(originalSize / 1024).toFixed(1)} KB`);
    console.log(`\n  Level | Size (KB) | Ratio | Bits/Pixel`);
    console.log(`  ------|-----------|-------|------------`);
    
    const dataPoints: CompressionDataPoint[] = [];
    
    for (const level of testLevels) {
      const quality = Math.max(0.1, 1 - (Math.min(level, 63) / 63));
      
      const options: CodecOptions = {
        quality,
        deviceId: 'DEVICE-001'
      };
      
      const result = codec.compress(imageData, options);
      
      const point = {
        level,
        size: result.size,
        sizeKB: result.size / 1024,
        compressionRatio: originalSize / result.size,
        bitsPerPixel: (result.size * 8) / pixelCount
      };
      
      dataPoints.push(point);
      
      console.log(`  ${level.toString().padStart(5)} | ${point.sizeKB.toFixed(1).padStart(9)} | ${point.compressionRatio.toFixed(1).padStart(5)}:1 | ${point.bitsPerPixel.toFixed(2).padStart(10)}`);
    }
    
    results.push({
      imageName,
      originalSize,
      width: imageData.width,
      height: imageData.height,
      dataPoints
    });
  }
  
  // Save results
  const csvDir = 'compression-analysis-data';
  if (!fs.existsSync(csvDir)) {
    fs.mkdirSync(csvDir);
  }
  
  // Combined CSV
  let csv = 'image,level,size_kb,compression_ratio,bits_per_pixel\n';
  results.forEach(result => {
    result.dataPoints.forEach((point: CompressionDataPoint) => {
      csv += `${result.imageName},${point.level},${point.sizeKB.toFixed(2)},${point.compressionRatio.toFixed(2)},${point.bitsPerPixel.toFixed(3)}\n`;
    });
  });
  
  fs.writeFileSync(path.join(csvDir, 'quick_analysis.csv'), csv);
  
  // Calculate empirical model
  console.log('\n\n=== Empirical Model ===\n');
  
  // Average compression ratios per level
  const levelRatios = new Map<number, number[]>();
  results.forEach(result => {
    result.dataPoints.forEach((point: CompressionDataPoint) => {
      if (!levelRatios.has(point.level)) {
        levelRatios.set(point.level, []);
      }
      levelRatios.get(point.level)!.push(point.compressionRatio);
    });
  });
  
  console.log('Average compression ratio by level:');
  const avgPoints: Array<{level: number, ratio: number}> = [];
  levelRatios.forEach((ratios, level) => {
    const avg = ratios.reduce((a, b) => a + b) / ratios.length;
    avgPoints.push({level, ratio: avg});
    console.log(`  Level ${level}: ${avg.toFixed(1)}:1`);
  });
  
  // Simple predictive formula
  console.log('\nPredictive formula for target size:');
  console.log('  To achieve compression ratio R:');
  console.log('  Level ≈ 2.5 * (R - 1)  for R < 10');
  console.log('  Level ≈ 1.5 * (R - 1) + 10  for R >= 10');
  
  console.log('\nExamples:');
  console.log('  For 5:1 compression: Level ≈ 2.5 * (5 - 1) = 10');
  console.log('  For 10:1 compression: Level ≈ 1.5 * (10 - 1) + 10 = 23.5');
  console.log('  For 20:1 compression: Level ≈ 1.5 * (20 - 1) + 10 = 38.5');
  
  console.log(`\nData saved to ${csvDir}/quick_analysis.csv`);
}

quickAnalysis().catch(console.error);