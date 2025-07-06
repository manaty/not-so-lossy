import { QDCTCompressedImage } from './qdct-types';

// NSL file format constants
const NSL_MAGIC = 0x4E534C00; // 'NSL\0' in hex
const NSL_VERSION = 1;

export interface NSLFileHeader {
  magic: number;
  version: number;
  deviceId: string;
  compressionLevel: number;
  width: number;
  height: number;
  timestamp: number;
  originalSize: number; // Original uncompressed size
}

/**
 * Export a QDCT compressed image to NSL format
 */
export function exportToNSL(compressed: QDCTCompressedImage): Blob {
  console.log('Exporting to NSL:', {
    deviceId: compressed.deviceId,
    width: compressed.width,
    height: compressed.height,
    compressionLevel: compressed.compressionLevel,
    blocksCount: compressed.blocks.length
  });
  
  const encoder = new TextEncoder();
  
  // Calculate sizes
  const deviceIdBytes = encoder.encode(compressed.deviceId);
  const headerSize = 32 + deviceIdBytes.length; // Fixed header + device ID
  const dataSize = estimateCompressedDataSize(compressed);
  const totalSize = headerSize + dataSize;
  
  console.log('Export sizes:', {
    deviceIdLength: deviceIdBytes.length,
    headerSize,
    dataSize,
    totalSize
  });
  
  // Create buffer
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  let offset = 0;
  
  // Write header
  view.setUint32(offset, NSL_MAGIC, false); offset += 4;
  view.setUint32(offset, NSL_VERSION, false); offset += 4;
  
  console.log('Written magic:', NSL_MAGIC.toString(16));
  view.setUint32(offset, compressed.width, false); offset += 4;
  view.setUint32(offset, compressed.height, false); offset += 4;
  view.setUint32(offset, compressed.compressionLevel, false); offset += 4;
  view.setUint32(offset, Date.now(), false); offset += 4;
  view.setUint32(offset, compressed.width * compressed.height * 3, false); offset += 4; // Original size
  view.setUint32(offset, deviceIdBytes.length, false); offset += 4;
  
  // Write device ID
  new Uint8Array(buffer, offset, deviceIdBytes.length).set(deviceIdBytes);
  offset += deviceIdBytes.length;
  
  // Write compressed blocks
  view.setUint32(offset, compressed.blocks.length, false); offset += 4;
  
  compressed.blocks.forEach(block => {
    // Position
    view.setUint16(offset, block.position.x, false); offset += 2;
    view.setUint16(offset, block.position.y, false); offset += 2;
    
    // Y channel data
    if (block.yData) {
      const nonZero = block.yData.map((v, i) => ({ idx: i, val: v })).filter(x => x.val !== 0);
      view.setUint16(offset, nonZero.length, false); offset += 2;
      nonZero.forEach(({ idx, val }) => {
        view.setUint8(offset++, idx);
        view.setInt16(offset, val, false); offset += 2;
      });
    } else {
      view.setUint16(offset, 0, false); offset += 2;
    }
    
    // Cb channel data
    if (block.cbData) {
      const nonZero = block.cbData.map((v, i) => ({ idx: i, val: v })).filter(x => x.val !== 0);
      view.setUint16(offset, nonZero.length, false); offset += 2;
      nonZero.forEach(({ idx, val }) => {
        view.setUint8(offset++, idx);
        view.setInt16(offset, val, false); offset += 2;
      });
    } else {
      view.setUint16(offset, 0, false); offset += 2;
    }
    
    // Cr channel data
    if (block.crData) {
      const nonZero = block.crData.map((v, i) => ({ idx: i, val: v })).filter(x => x.val !== 0);
      view.setUint16(offset, nonZero.length, false); offset += 2;
      nonZero.forEach(({ idx, val }) => {
        view.setUint8(offset++, idx);
        view.setInt16(offset, val, false); offset += 2;
      });
    } else {
      view.setUint16(offset, 0, false); offset += 2;
    }
  });
  
  console.log('Export complete. Final offset:', offset, 'Buffer size:', totalSize);
  
  // Create blob
  const blob = new Blob([buffer.slice(0, offset)], { type: 'application/octet-stream' });
  console.log('Created blob size:', blob.size);
  
  return blob;
}

/**
 * Import a QDCT compressed image from NSL format
 */
export async function importFromNSL(file: File): Promise<QDCTCompressedImage> {
  console.log('Importing NSL file:', {
    name: file.name,
    size: file.size,
    type: file.type
  });
  
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  const decoder = new TextDecoder();
  let offset = 0;
  
  console.log('Buffer size:', buffer.byteLength);
  
  // Check minimum file size
  if (buffer.byteLength < 32) {
    throw new Error('File too small to be a valid NSL file');
  }
  
  // Read and verify header
  const magic = view.getUint32(offset, false); offset += 4;
  console.log('Magic number:', magic.toString(16), 'Expected:', NSL_MAGIC.toString(16));
  
  if (magic !== NSL_MAGIC) {
    throw new Error(`Invalid NSL file: wrong magic number. Got 0x${magic.toString(16)}, expected 0x${NSL_MAGIC.toString(16)}`);
  }
  
  const version = view.getUint32(offset, false); offset += 4;
  if (version !== NSL_VERSION) {
    throw new Error(`Unsupported NSL version: ${version}`);
  }
  
  // Read header fields
  const width = view.getUint32(offset, false); offset += 4;
  const height = view.getUint32(offset, false); offset += 4;
  const compressionLevel = view.getUint32(offset, false); offset += 4;
  const timestamp = view.getUint32(offset, false); offset += 4;
  const originalSize = view.getUint32(offset, false); offset += 4;
  const deviceIdLength = view.getUint32(offset, false); offset += 4;
  
  // Validate device ID length
  if (deviceIdLength > 100 || deviceIdLength === 0) {
    throw new Error(`Invalid device ID length: ${deviceIdLength}`);
  }
  
  // Check bounds before reading device ID
  if (offset + deviceIdLength > buffer.byteLength) {
    throw new Error('File truncated: cannot read device ID');
  }
  
  // Read device ID
  const deviceIdBytes = new Uint8Array(buffer, offset, deviceIdLength);
  const deviceId = decoder.decode(deviceIdBytes);
  offset += deviceIdLength;
  
  console.log('Read header:', {
    width,
    height,
    compressionLevel,
    deviceId,
    deviceIdLength
  });
  
  // Check bounds before reading block count
  if (offset + 4 > buffer.byteLength) {
    throw new Error('File truncated: cannot read block count');
  }
  
  // Read compressed blocks
  const blockCount = view.getUint32(offset, false); offset += 4;
  console.log('Block count:', blockCount);
  
  const blocks = [];
  
  for (let i = 0; i < blockCount; i++) {
    // Check bounds before reading block
    if (offset + 4 > buffer.byteLength) {
      throw new Error(`File truncated at block ${i}: cannot read position`);
    }
    
    const x = view.getUint16(offset, false); offset += 2;
    const y = view.getUint16(offset, false); offset += 2;
    
    // Read Y channel
    if (offset + 2 > buffer.byteLength) {
      throw new Error(`File truncated at block ${i}: cannot read Y count`);
    }
    const yCount = view.getUint16(offset, false); offset += 2;
    const yData = new Array(64).fill(0);
    
    if (offset + yCount * 3 > buffer.byteLength) {
      throw new Error(`File truncated at block ${i}: cannot read Y data`);
    }
    for (let j = 0; j < yCount; j++) {
      const idx = view.getUint8(offset++);
      const val = view.getInt16(offset, false); offset += 2;
      yData[idx] = val;
    }
    
    // Read Cb channel
    if (offset + 2 > buffer.byteLength) {
      throw new Error(`File truncated at block ${i}: cannot read Cb count`);
    }
    const cbCount = view.getUint16(offset, false); offset += 2;
    const cbData = new Array(64).fill(0);
    
    if (offset + cbCount * 3 > buffer.byteLength) {
      throw new Error(`File truncated at block ${i}: cannot read Cb data`);
    }
    for (let j = 0; j < cbCount; j++) {
      const idx = view.getUint8(offset++);
      const val = view.getInt16(offset, false); offset += 2;
      cbData[idx] = val;
    }
    
    // Read Cr channel
    if (offset + 2 > buffer.byteLength) {
      throw new Error(`File truncated at block ${i}: cannot read Cr count`);
    }
    const crCount = view.getUint16(offset, false); offset += 2;
    const crData = new Array(64).fill(0);
    
    if (offset + crCount * 3 > buffer.byteLength) {
      throw new Error(`File truncated at block ${i}: cannot read Cr data`);
    }
    for (let j = 0; j < crCount; j++) {
      const idx = view.getUint8(offset++);
      const val = view.getInt16(offset, false); offset += 2;
      crData[idx] = val;
    }
    
    blocks.push({
      position: { x, y },
      yData,
      cbData,
      crData
    });
  }
  
  console.log('Import complete:', {
    deviceId,
    width,
    height,
    blocksCount: blocks.length,
    compressionLevel,
    finalOffset: offset,
    bufferSize: buffer.byteLength
  });
  
  return {
    deviceId,
    width,
    height,
    blocks,
    compressionLevel
  };
}

/**
 * Estimate compressed data size for buffer allocation
 */
function estimateCompressedDataSize(compressed: QDCTCompressedImage): number {
  let size = 4; // Block count
  
  compressed.blocks.forEach(block => {
    size += 4; // Position
    
    // Each channel: count + (index + value) * nonZeroCount
    const channels = [block.yData, block.cbData, block.crData];
    channels.forEach(data => {
      if (data) {
        const nonZeroCount = data.filter(v => v !== 0).length;
        size += 2 + nonZeroCount * 3; // count + (idx + value)
      } else {
        size += 2; // Just count
      }
    });
  });
  
  return size;
}

/**
 * Generate a filename for NSL export
 */
export function generateNSLFilename(deviceId: string, compressionLevel: number): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  return `${deviceId}_L${compressionLevel}_${timestamp}.nsl`;
}