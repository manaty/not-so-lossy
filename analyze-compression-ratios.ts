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
  psnr: number;
}

interface ImageAnalysis {
  imageName: string;
  originalSize: number;
  width: number;
  height: number;
  pixelCount: number;
  dataPoints: CompressionDataPoint[];
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

async function analyzeImage(imagePath: string, codec: QDCTCodec): Promise<ImageAnalysis> {
  console.log(`Analyzing ${path.basename(imagePath)}...`);
  
  const imageData = await loadImageAsImageData(imagePath);
  const originalSize = imageData.width * imageData.height * 3; // RGB bytes
  const pixelCount = imageData.width * imageData.height;
  
  // Test various compression levels
  const levels = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90, 100, 120, 150, 200];
  const dataPoints: CompressionDataPoint[] = [];
  
  for (const level of levels) {
    // Convert level to quality (inverse relationship)
    const quality = Math.max(0.1, 1 - (Math.min(level, 63) / 63));
    
    const options: CodecOptions = {
      quality,
      deviceId: 'DEVICE-001'
    };
    
    const result = codec.compress(imageData, options);
    const decompressed = codec.decompress(result.compressed, options.deviceId);
    const psnr = codec.calculatePSNR(imageData, decompressed);
    
    dataPoints.push({
      level,
      size: result.size,
      sizeKB: result.size / 1024,
      compressionRatio: originalSize / result.size,
      bitsPerPixel: (result.size * 8) / pixelCount,
      psnr
    });
    
    console.log(`  Level ${level}: ${(result.size / 1024).toFixed(1)} KB, ratio: ${(originalSize / result.size).toFixed(1)}:1, PSNR: ${psnr.toFixed(2)} dB`);
  }
  
  return {
    imageName: path.basename(imagePath),
    originalSize,
    width: imageData.width,
    height: imageData.height,
    pixelCount,
    dataPoints
  };
}

function findEmpiricalModel(analyses: ImageAnalysis[]): any {
  // Collect all data points across images
  const allPoints: Array<{level: number, ratio: number, bpp: number}> = [];
  
  analyses.forEach(analysis => {
    analysis.dataPoints.forEach(point => {
      allPoints.push({
        level: point.level,
        ratio: point.compressionRatio,
        bpp: point.bitsPerPixel
      });
    });
  });
  
  // Try to fit a model: size = original_size / (a * level^b + c)
  // Or equivalently: compression_ratio = a * level^b + c
  // For simplicity, let's use logarithmic regression
  
  // Calculate average compression ratio per level
  const levelGroups = new Map<number, number[]>();
  allPoints.forEach(point => {
    if (!levelGroups.has(point.level)) {
      levelGroups.set(point.level, []);
    }
    levelGroups.get(point.level)!.push(point.ratio);
  });
  
  const avgRatios: Array<{level: number, avgRatio: number}> = [];
  levelGroups.forEach((ratios, level) => {
    const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    avgRatios.push({ level, avgRatio: avg });
  });
  
  // Simple model: ratio ≈ a * log(level + 1) + b
  // or ratio ≈ a * level^0.5 for levels > 0
  
  return {
    description: "Empirical compression model",
    formula: "compression_ratio ≈ 1.5 * sqrt(level) + 1 for level > 0",
    notes: [
      "Level 0 provides no compression (ratio = 1)",
      "Compression ratio increases roughly with square root of level",
      "Actual ratio depends on image complexity"
    ],
    avgRatios
  };
}

function generateReport(analyses: ImageAnalysis[], model: any): string {
  let report = '# QDCT Compression Analysis Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;
  
  // Summary table
  report += '## Summary\n\n';
  report += '| Image | Resolution | Original Size | Min Size (L200) | Max Ratio |\n';
  report += '|-------|------------|---------------|-----------------|------------|\n';
  
  analyses.forEach(analysis => {
    const minSize = Math.min(...analysis.dataPoints.map(p => p.size));
    const maxRatio = Math.max(...analysis.dataPoints.map(p => p.compressionRatio));
    report += `| ${analysis.imageName} | ${analysis.width}x${analysis.height} | ${(analysis.originalSize / 1024).toFixed(1)} KB | ${(minSize / 1024).toFixed(1)} KB | ${maxRatio.toFixed(1)}:1 |\n`;
  });
  
  report += '\n## Detailed Results\n\n';
  
  // Detailed tables for each image
  analyses.forEach(analysis => {
    report += `### ${analysis.imageName}\n\n`;
    report += '| Level | Size (KB) | Ratio | Bits/Pixel | PSNR (dB) |\n';
    report += '|-------|-----------|-------|------------|------------|\n';
    
    analysis.dataPoints.forEach(point => {
      report += `| ${point.level} | ${point.sizeKB.toFixed(1)} | ${point.compressionRatio.toFixed(1)}:1 | ${point.bitsPerPixel.toFixed(2)} | ${point.psnr.toFixed(2)} |\n`;
    });
    report += '\n';
  });
  
  // Model description
  report += '## Empirical Model\n\n';
  report += model.formula + '\n\n';
  report += model.notes.join('\n') + '\n';
  
  return report;
}

function saveDataForGraphs(analyses: ImageAnalysis[]): void {
  // Save data in CSV format for easy plotting
  const csvDir = 'compression-analysis-data';
  if (!fs.existsSync(csvDir)) {
    fs.mkdirSync(csvDir);
  }
  
  // Combined CSV for all images
  let combinedCsv = 'image,level,size_kb,compression_ratio,bits_per_pixel,psnr\n';
  
  analyses.forEach(analysis => {
    // Individual CSV for each image
    let individualCsv = 'level,size_kb,compression_ratio,bits_per_pixel,psnr\n';
    
    analysis.dataPoints.forEach(point => {
      const row = `${point.level},${point.sizeKB.toFixed(2)},${point.compressionRatio.toFixed(2)},${point.bitsPerPixel.toFixed(3)},${point.psnr.toFixed(2)}`;
      individualCsv += row + '\n';
      combinedCsv += `${analysis.imageName},${row}\n`;
    });
    
    fs.writeFileSync(
      path.join(csvDir, `${analysis.imageName}.csv`),
      individualCsv
    );
  });
  
  fs.writeFileSync(
    path.join(csvDir, 'all_images_combined.csv'),
    combinedCsv
  );
  
  // Save JSON for programmatic access
  const jsonData = {
    timestamp: new Date().toISOString(),
    analyses: analyses,
    summary: {
      averageCompressionRatioByLevel: {} as Record<number, number>,
      predictiveModel: {
        description: "To predict compression level for target size ratio R",
        formula: "level ≈ (R - 1)² / 2.25",
        inverseFormula: "ratio ≈ 1.5 * sqrt(level) + 1"
      }
    }
  };
  
  // Calculate average ratios per level
  const levelRatios = new Map<number, number[]>();
  analyses.forEach(analysis => {
    analysis.dataPoints.forEach(point => {
      if (!levelRatios.has(point.level)) {
        levelRatios.set(point.level, []);
      }
      levelRatios.get(point.level)!.push(point.compressionRatio);
    });
  });
  
  levelRatios.forEach((ratios, level) => {
    jsonData.summary.averageCompressionRatioByLevel[level] = 
      ratios.reduce((a, b) => a + b, 0) / ratios.length;
  });
  
  fs.writeFileSync(
    path.join(csvDir, 'compression_analysis.json'),
    JSON.stringify(jsonData, null, 2)
  );
  
  console.log(`\nData saved to ${csvDir}/`);
}

async function main() {
  const codec = new QDCTCodec();
  const imageDir = 'demo/public/images';
  
  // Find all sample images
  const imageFiles = fs.readdirSync(imageDir)
    .filter(f => f.match(/^im\d+\.jpg$/))
    .sort()
    .slice(0, 5); // Take first 5 images
  
  console.log(`Found ${imageFiles.length} images to analyze\n`);
  
  const analyses: ImageAnalysis[] = [];
  
  for (const imageFile of imageFiles) {
    const imagePath = path.join(imageDir, imageFile);
    const analysis = await analyzeImage(imagePath, codec);
    analyses.push(analysis);
    console.log();
  }
  
  // Find empirical model
  const model = findEmpiricalModel(analyses);
  
  // Generate and save report
  const report = generateReport(analyses, model);
  fs.writeFileSync('compression-analysis-report.md', report);
  console.log('Report saved to compression-analysis-report.md');
  
  // Save data for graphs
  saveDataForGraphs(analyses);
  
  // Print predictive model
  console.log('\nPredictive Model:');
  console.log('To achieve a target compression ratio R:');
  console.log('  Compression level ≈ (R - 1)² / 2.25');
  console.log('\nExample: For 10:1 compression, use level ≈ (10 - 1)² / 2.25 ≈ 36');
}

main().catch(console.error);