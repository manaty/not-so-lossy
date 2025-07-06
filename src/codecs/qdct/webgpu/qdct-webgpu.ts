import { ImageData } from '../../types';
import { QDCTCompressedImage, QDCTCompressedBlock } from '../qdct-types';
import { QDCTStrategyGenerator } from '../qdct-strategy';

export class QDCTWebGPU {
  private device: GPUDevice | null = null;
  private dctPipeline: GPUComputePipeline | null = null;
  private quantizePipeline: GPUComputePipeline | null = null;
  private idctPipeline: GPUComputePipeline | null = null;
  private dequantizePipeline: GPUComputePipeline | null = null;
  
  async initialize(): Promise<boolean> {
    console.log('Initializing WebGPU...');
    
    // Check for WebGPU support
    if (!navigator.gpu) {
      console.warn('WebGPU not supported');
      return false;
    }
    
    try {
      console.log('Requesting WebGPU adapter...');
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        console.warn('No WebGPU adapter found');
        return false;
      }
      
      console.log('Requesting GPU device...');
      this.device = await adapter.requestDevice();
      console.log('GPU device acquired');
      
      // Log device limits
      console.log('GPU Device Limits:', {
        maxBufferSize: this.device.limits.maxBufferSize,
        maxStorageBufferBindingSize: this.device.limits.maxStorageBufferBindingSize,
        maxComputeWorkgroupSizeX: this.device.limits.maxComputeWorkgroupSizeX,
        maxComputeWorkgroupSizeY: this.device.limits.maxComputeWorkgroupSizeY,
        maxComputeWorkgroupsPerDimension: this.device.limits.maxComputeWorkgroupsPerDimension
      });
      
      // Create compute pipelines
      console.log('Creating compute pipelines...');
      await this.createPipelines();
      console.log('WebGPU initialization complete');
      
      return true;
    } catch (error) {
      console.error('Failed to initialize WebGPU:', error);
      return false;
    }
  }
  
  private async createPipelines() {
    if (!this.device) {
      console.error('No device available for pipeline creation');
      return;
    }
    
    try {
      console.log('Creating DCT shader module...');
      // DCT compute shader
      const dctShaderModule = this.device.createShaderModule({
      label: 'DCT Compute Shader',
      code: `
        struct Block {
          data: array<f32, 64>
        }
        
        @group(0) @binding(0) var<storage, read> inputBlocks: array<Block>;
        @group(0) @binding(1) var<storage, read_write> outputBlocks: array<Block>;
        @group(0) @binding(2) var<uniform> params: vec4<u32>; // width, height, blocksPerRow, totalBlocks
        
        const PI: f32 = 3.14159265359;
        
        fn dct1d(input: array<f32, 8>, output: ptr<function, array<f32, 8>>, u: u32) {
          var sum: f32 = 0.0;
          let cu = select(1.0 / sqrt(2.0), 1.0, u > 0u);
          
          for (var x: u32 = 0u; x < 8u; x = x + 1u) {
            sum = sum + input[x] * cos(((2.0 * f32(x) + 1.0) * f32(u) * PI) / 16.0);
          }
          
          (*output)[u] = cu * sum * 0.5;
        }
        
        @compute @workgroup_size(8, 8, 1)
        fn dct2d(@builtin(global_invocation_id) global_id: vec3<u32>) {
          let blockIdx = global_id.x + global_id.y * params.z;
          if (blockIdx >= params.w) {
            return;
          }
          
          // Load block data
          let block = inputBlocks[blockIdx];
          var temp: array<f32, 64>;
          var output: array<f32, 64>;
          
          // Apply DCT to rows
          for (var row: u32 = 0u; row < 8u; row = row + 1u) {
            var rowData: array<f32, 8>;
            var rowDCT: array<f32, 8>;
            
            for (var col: u32 = 0u; col < 8u; col = col + 1u) {
              rowData[col] = block.data[row * 8u + col];
            }
            
            // Compute DCT for the entire row
            for (var u: u32 = 0u; u < 8u; u = u + 1u) {
              var sum: f32 = 0.0;
              let cu = select(1.0 / sqrt(2.0), 1.0, u > 0u);
              
              for (var x: u32 = 0u; x < 8u; x = x + 1u) {
                sum = sum + rowData[x] * cos(((2.0 * f32(x) + 1.0) * f32(u) * PI) / 16.0);
              }
              
              temp[row * 8u + u] = cu * sum * 0.5;
            }
          }
          
          // Apply DCT to columns
          for (var col: u32 = 0u; col < 8u; col = col + 1u) {
            var colData: array<f32, 8>;
            var colDCT: array<f32, 8>;
            
            for (var row: u32 = 0u; row < 8u; row = row + 1u) {
              colData[row] = temp[row * 8u + col];
            }
            
            // Compute DCT for the entire column
            for (var v: u32 = 0u; v < 8u; v = v + 1u) {
              var sum: f32 = 0.0;
              let cv = select(1.0 / sqrt(2.0), 1.0, v > 0u);
              
              for (var y: u32 = 0u; y < 8u; y = y + 1u) {
                sum = sum + colData[y] * cos(((2.0 * f32(y) + 1.0) * f32(v) * PI) / 16.0);
              }
              
              output[v * 8u + col] = cv * sum * 0.5;
            }
          }
          
          // Store result
          outputBlocks[blockIdx].data = output;
        }
      `
    });
    
    console.log('Creating Quantize shader module...');
    // Quantization compute shader
    const quantizeShaderModule = this.device.createShaderModule({
      label: 'Quantize Compute Shader',
      code: `
        struct Block {
          data: array<f32, 64>
        }
        
        @group(0) @binding(0) var<storage, read> dctBlocks: array<Block>;
        @group(0) @binding(1) var<storage, read_write> quantizedBlocks: array<Block>;
        @group(0) @binding(2) var<storage, read> quantMatrix: array<f32, 64>;
        @group(0) @binding(3) var<uniform> params: vec4<u32>;
        
        @compute @workgroup_size(8, 8, 1)
        fn quantize(@builtin(global_invocation_id) global_id: vec3<u32>) {
          let blockIdx = global_id.x + global_id.y * params.z;
          if (blockIdx >= params.w) {
            return;
          }
          
          let block = dctBlocks[blockIdx];
          var output: array<f32, 64>;
          
          for (var i: u32 = 0u; i < 64u; i = i + 1u) {
            output[i] = round(block.data[i] / quantMatrix[i]);
          }
          
          quantizedBlocks[blockIdx].data = output;
        }
      `
    });
    
    // Create pipelines
    console.log('Creating DCT compute pipeline...');
    this.dctPipeline = this.device.createComputePipeline({
      label: 'DCT Pipeline',
      layout: 'auto',
      compute: {
        module: dctShaderModule,
        entryPoint: 'dct2d'
      }
    });
    
    console.log('Creating Quantize compute pipeline...');
    this.quantizePipeline = this.device.createComputePipeline({
      label: 'Quantize Pipeline',
      layout: 'auto',
      compute: {
        module: quantizeShaderModule,
        entryPoint: 'quantize'
      }
    });
    
    console.log('Creating IDCT shader module...');
    // Inverse DCT compute shader
    const idctShaderModule = this.device.createShaderModule({
      label: 'IDCT Compute Shader',
      code: `
        struct Block {
          data: array<f32, 64>
        }
        
        @group(0) @binding(0) var<storage, read> inputBlocks: array<Block>;
        @group(0) @binding(1) var<storage, read_write> outputBlocks: array<Block>;
        @group(0) @binding(2) var<uniform> params: vec4<u32>;
        
        const PI: f32 = 3.14159265359;
        
        fn idct1d(input: array<f32, 8>, output: ptr<function, array<f32, 8>>, x: u32) {
          var sum: f32 = 0.0;
          
          for (var u: u32 = 0u; u < 8u; u = u + 1u) {
            let cu = select(1.0 / sqrt(2.0), 1.0, u > 0u);
            sum = sum + cu * input[u] * cos(((2.0 * f32(x) + 1.0) * f32(u) * PI) / 16.0);
          }
          
          (*output)[x] = sum * 0.5;
        }
        
        @compute @workgroup_size(8, 8, 1)
        fn idct2d(@builtin(global_invocation_id) global_id: vec3<u32>) {
          let blockIdx = global_id.x + global_id.y * params.z;
          if (blockIdx >= params.w) {
            return;
          }
          
          let block = inputBlocks[blockIdx];
          var temp: array<f32, 64>;
          var output: array<f32, 64>;
          
          // Apply IDCT to rows
          for (var row: u32 = 0u; row < 8u; row = row + 1u) {
            var rowData: array<f32, 8>;
            var rowIDCT: array<f32, 8>;
            
            for (var col: u32 = 0u; col < 8u; col = col + 1u) {
              rowData[col] = block.data[row * 8u + col];
            }
            
            // Compute IDCT for the entire row
            for (var x: u32 = 0u; x < 8u; x = x + 1u) {
              var sum: f32 = 0.0;
              for (var u: u32 = 0u; u < 8u; u = u + 1u) {
                let cu = select(1.0 / sqrt(2.0), 1.0, u > 0u);
                sum = sum + cu * rowData[u] * cos(((2.0 * f32(x) + 1.0) * f32(u) * PI) / 16.0);
              }
              temp[row * 8u + x] = sum * 0.5;
            }
          }
          
          // Apply IDCT to columns
          for (var col: u32 = 0u; col < 8u; col = col + 1u) {
            var colData: array<f32, 8>;
            var colIDCT: array<f32, 8>;
            
            for (var row: u32 = 0u; row < 8u; row = row + 1u) {
              colData[row] = temp[row * 8u + col];
            }
            
            // Compute IDCT for the entire column
            for (var x: u32 = 0u; x < 8u; x = x + 1u) {
              var sum: f32 = 0.0;
              for (var u: u32 = 0u; u < 8u; u = u + 1u) {
                let cu = select(1.0 / sqrt(2.0), 1.0, u > 0u);
                sum = sum + cu * colData[u] * cos(((2.0 * f32(x) + 1.0) * f32(u) * PI) / 16.0);
              }
              output[x * 8u + col] = sum * 0.5;
            }
          }
          
          outputBlocks[blockIdx].data = output;
        }
      `
    });
    
    console.log('Creating Dequantize shader module...');
    // Dequantization compute shader
    const dequantizeShaderModule = this.device.createShaderModule({
      label: 'Dequantize Compute Shader',
      code: `
        struct Block {
          data: array<f32, 64>
        }
        
        @group(0) @binding(0) var<storage, read> quantizedBlocks: array<Block>;
        @group(0) @binding(1) var<storage, read_write> dequantizedBlocks: array<Block>;
        @group(0) @binding(2) var<storage, read> quantMatrix: array<f32, 64>;
        @group(0) @binding(3) var<uniform> params: vec4<u32>;
        
        @compute @workgroup_size(8, 8, 1)
        fn dequantize(@builtin(global_invocation_id) global_id: vec3<u32>) {
          let blockIdx = global_id.x + global_id.y * params.z;
          if (blockIdx >= params.w) {
            return;
          }
          
          let block = quantizedBlocks[blockIdx];
          var output: array<f32, 64>;
          
          for (var i: u32 = 0u; i < 64u; i = i + 1u) {
            output[i] = block.data[i] * quantMatrix[i];
          }
          
          dequantizedBlocks[blockIdx].data = output;
        }
      `
    });
    
    // Create decompression pipelines
    console.log('Creating IDCT compute pipeline...');
    this.idctPipeline = this.device.createComputePipeline({
      label: 'IDCT Pipeline',
      layout: 'auto',
      compute: {
        module: idctShaderModule,
        entryPoint: 'idct2d'
      }
    });
    
    console.log('Creating Dequantize compute pipeline...');
    this.dequantizePipeline = this.device.createComputePipeline({
      label: 'Dequantize Pipeline',
      layout: 'auto',
      compute: {
        module: dequantizeShaderModule,
        entryPoint: 'dequantize'
      }
    });
    
    console.log('All pipelines created successfully');
    } catch (error) {
      console.error('Failed to create pipelines:', error);
      throw error;
    }
  }
  
  async compressImage(
    imageData: ImageData,
    deviceId: string,
    compressionLevel: number
  ): Promise<QDCTCompressedImage | null> {
    console.log('WebGPU compression started');
    console.time('WebGPU Total Time');
    
    if (!this.device || !this.dctPipeline || !this.quantizePipeline) {
      console.error('WebGPU not initialized');
      return null;
    }
    
    const { width, height, data } = imageData;
    const blocksPerRow = Math.ceil(width / 8);
    const blocksPerCol = Math.ceil(height / 8);
    const totalBlocks = blocksPerRow * blocksPerCol;
    
    console.log(`Image: ${width}x${height}, Blocks: ${blocksPerRow}x${blocksPerCol} = ${totalBlocks} total`);
    
    // Generate quantization matrix
    const strategy = QDCTStrategyGenerator.generateStrategy(deviceId);
    const baseMatrix = QDCTStrategyGenerator.getStandardMatrix();
    const quantMatrix = QDCTStrategyGenerator.applyProgressiveQuantization(
      baseMatrix,
      strategy,
      compressionLevel
    );
    
    // Flatten quantization matrix
    const quantArray = new Float32Array(64);
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        quantArray[i * 8 + j] = quantMatrix[i][j];
      }
    }
    
    // Convert image to YCbCr and create blocks
    console.log('Converting image to YCbCr blocks...');
    console.time('RGB to YCbCr conversion');
    
    const yBlocks = new Float32Array(totalBlocks * 64);
    const cbBlocks = new Float32Array(totalBlocks * 64);
    const crBlocks = new Float32Array(totalBlocks * 64);
    
    for (let blockY = 0; blockY < blocksPerCol; blockY++) {
      for (let blockX = 0; blockX < blocksPerRow; blockX++) {
        const blockIdx = blockY * blocksPerRow + blockX;
        const baseIdx = blockIdx * 64;
        
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            const pixelX = blockX * 8 + x;
            const pixelY = blockY * 8 + y;
            const localIdx = y * 8 + x;
            
            if (pixelX < width && pixelY < height) {
              const idx = (pixelY * width + pixelX) * 4;
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];
              
              // Convert to YCbCr
              yBlocks[baseIdx + localIdx] = 0.299 * r + 0.587 * g + 0.114 * b;
              cbBlocks[baseIdx + localIdx] = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
              crBlocks[baseIdx + localIdx] = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
            } else {
              // Pad with zeros
              yBlocks[baseIdx + localIdx] = 0;
              cbBlocks[baseIdx + localIdx] = 128;
              crBlocks[baseIdx + localIdx] = 128;
            }
          }
        }
      }
    }
    
    console.timeEnd('RGB to YCbCr conversion');
    
    // Process each channel
    console.log('Processing channels on GPU...');
    console.time('GPU Processing Y channel');
    const processedY = await this.processChannel(yBlocks, quantArray, totalBlocks, blocksPerRow);
    console.timeEnd('GPU Processing Y channel');
    
    console.time('GPU Processing Cb channel');
    const processedCb = await this.processChannel(cbBlocks, quantArray, totalBlocks, blocksPerRow);
    console.timeEnd('GPU Processing Cb channel');
    
    console.time('GPU Processing Cr channel');
    const processedCr = await this.processChannel(crBlocks, quantArray, totalBlocks, blocksPerRow);
    console.timeEnd('GPU Processing Cr channel');
    
    if (!processedY || !processedCb || !processedCr) {
      console.error('Failed to process channels');
      return null;
    }
    
    // Convert to compressed blocks
    console.log('Converting GPU results to compressed format...');
    console.time('Post-processing');
    
    const blocks: QDCTCompressedBlock[] = [];
    for (let blockY = 0; blockY < blocksPerCol; blockY++) {
      for (let blockX = 0; blockX < blocksPerRow; blockX++) {
        const blockIdx = blockY * blocksPerRow + blockX;
        const baseIdx = blockIdx * 64;
        
        // Extract and zigzag order the coefficients
        const yData = this.zigzagOrder(processedY.slice(baseIdx, baseIdx + 64));
        const cbData = this.zigzagOrder(processedCb.slice(baseIdx, baseIdx + 64));
        const crData = this.zigzagOrder(processedCr.slice(baseIdx, baseIdx + 64));
        
        blocks.push({
          position: { x: blockX * 8, y: blockY * 8 },
          yData,
          cbData,
          crData
        });
      }
    }
    
    console.timeEnd('Post-processing');
    console.timeEnd('WebGPU Total Time');
    console.log(`WebGPU compression complete: ${blocks.length} blocks processed`);
    
    return {
      width,
      height,
      blocks,
      deviceId,
      compressionLevel
    };
  }
  
  private async processChannel(
    blocks: Float32Array,
    quantMatrix: Float32Array,
    totalBlocks: number,
    blocksPerRow: number
  ): Promise<Float32Array | null> {
    console.log(`Processing channel with ${totalBlocks} blocks...`);
    
    if (!this.device || !this.dctPipeline || !this.quantizePipeline) {
      console.error('Device or pipelines not available');
      return null;
    }
    
    const blockSize = 64 * 4; // 64 floats
    const bufferSize = totalBlocks * blockSize;
    console.log(`Buffer size: ${bufferSize} bytes (${(bufferSize / 1024 / 1024).toFixed(2)} MB)`);
    
    // Create buffers
    const inputBuffer = this.device.createBuffer({
      label: 'Input Blocks Buffer',
      size: bufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    
    const dctBuffer = this.device.createBuffer({
      label: 'DCT Blocks Buffer',
      size: bufferSize,
      usage: GPUBufferUsage.STORAGE
    });
    
    const quantBuffer = this.device.createBuffer({
      label: 'Quantized Blocks Buffer',
      size: bufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });
    
    const quantMatrixBuffer = this.device.createBuffer({
      label: 'Quantization Matrix Buffer',
      size: 64 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    
    const paramsBuffer = this.device.createBuffer({
      label: 'Parameters Buffer',
      size: 16, // 4 u32 values
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    
    // Write data to buffers
    console.log('Writing data to GPU buffers...');
    this.device.queue.writeBuffer(inputBuffer, 0, blocks);
    this.device.queue.writeBuffer(quantMatrixBuffer, 0, quantMatrix);
    this.device.queue.writeBuffer(paramsBuffer, 0, new Uint32Array([
      0, 0, blocksPerRow, totalBlocks
    ]));
    
    // Create bind groups
    console.log('Creating bind groups...');
    const dctBindGroup = this.device.createBindGroup({
      layout: this.dctPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inputBuffer } },
        { binding: 1, resource: { buffer: dctBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    });
    
    const quantBindGroup = this.device.createBindGroup({
      layout: this.quantizePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: dctBuffer } },
        { binding: 1, resource: { buffer: quantBuffer } },
        { binding: 2, resource: { buffer: quantMatrixBuffer } },
        { binding: 3, resource: { buffer: paramsBuffer } }
      ]
    });
    
    // Encode commands
    console.log('Encoding GPU commands...');
    const commandEncoder = this.device.createCommandEncoder();
    
    // DCT pass
    console.log('Setting up DCT pass...');
    const dctPass = commandEncoder.beginComputePass();
    dctPass.setPipeline(this.dctPipeline);
    dctPass.setBindGroup(0, dctBindGroup);
    const workgroupsX = Math.ceil(blocksPerRow / 8);
    const workgroupsY = Math.ceil(totalBlocks / blocksPerRow / 8);
    console.log(`DCT workgroups: ${workgroupsX} x ${workgroupsY}`);
    dctPass.dispatchWorkgroups(workgroupsX, workgroupsY, 1);
    dctPass.end();
    
    // Quantization pass
    console.log('Setting up Quantization pass...');
    const quantPass = commandEncoder.beginComputePass();
    quantPass.setPipeline(this.quantizePipeline);
    quantPass.setBindGroup(0, quantBindGroup);
    quantPass.dispatchWorkgroups(workgroupsX, workgroupsY, 1);
    quantPass.end();
    
    // Read back results
    const readBuffer = this.device.createBuffer({
      label: 'Read Buffer',
      size: bufferSize,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });
    
    commandEncoder.copyBufferToBuffer(quantBuffer, 0, readBuffer, 0, bufferSize);
    
    // Submit commands
    console.log('Submitting GPU commands...');
    this.device.queue.submit([commandEncoder.finish()]);
    
    // Wait for results
    console.log('Waiting for GPU results...');
    await readBuffer.mapAsync(GPUMapMode.READ);
    console.log('GPU computation complete, reading results...');
    const result = new Float32Array(readBuffer.getMappedRange().slice(0));
    readBuffer.unmap();
    
    // Cleanup
    console.log('Cleaning up GPU buffers...');
    inputBuffer.destroy();
    dctBuffer.destroy();
    quantBuffer.destroy();
    quantMatrixBuffer.destroy();
    paramsBuffer.destroy();
    readBuffer.destroy();
    
    console.log('Channel processing complete');
    return result;
  }
  
  private zigzagOrder(block: Float32Array): number[] {
    const zigzag = [
      0,  1,  8, 16,  9,  2,  3, 10,
      17, 24, 32, 25, 18, 11,  4,  5,
      12, 19, 26, 33, 40, 48, 41, 34,
      27, 20, 13,  6,  7, 14, 21, 28,
      35, 42, 49, 56, 57, 50, 43, 36,
      29, 22, 15, 23, 30, 37, 44, 51,
      58, 59, 52, 45, 38, 31, 39, 46,
      53, 60, 61, 54, 47, 55, 62, 63
    ];
    
    const result: number[] = new Array(64);
    for (let i = 0; i < 64; i++) {
      result[i] = Math.round(block[zigzag[i]]);
    }
    return result;
  }
  
  async decompressImage(compressed: QDCTCompressedImage): Promise<ImageData | null> {
    console.log('WebGPU decompression started');
    console.time('WebGPU Decompression Total Time');
    
    if (!this.device || !this.dequantizePipeline || !this.idctPipeline) {
      console.error('WebGPU not initialized for decompression');
      return null;
    }
    
    const { width, height, blocks, deviceId, compressionLevel } = compressed;
    const totalBlocks = blocks.length;
    console.log(`Decompressing: ${width}x${height}, ${totalBlocks} blocks`);
    
    // Generate quantization matrix
    const strategy = QDCTStrategyGenerator.generateStrategy(deviceId);
    const baseMatrix = QDCTStrategyGenerator.getStandardMatrix();
    const quantMatrix = QDCTStrategyGenerator.applyProgressiveQuantization(
      baseMatrix,
      strategy,
      compressionLevel
    );
    
    // Flatten quantization matrix
    const quantArray = new Float32Array(64);
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        quantArray[i * 8 + j] = quantMatrix[i][j];
      }
    }
    
    // Convert compressed blocks to GPU format
    console.log('Converting compressed blocks to GPU format...');
    console.time('Block conversion');
    
    const blocksPerRow = Math.ceil(width / 8);
    const yBlocks = new Float32Array(totalBlocks * 64);
    const cbBlocks = new Float32Array(totalBlocks * 64);
    const crBlocks = new Float32Array(totalBlocks * 64);
    
    blocks.forEach((block, blockIdx) => {
      const baseIdx = blockIdx * 64;
      
      // Inverse zigzag and store
      const yData = this.inverseZigzag(block.yData || []);
      const cbData = this.inverseZigzag(block.cbData || []);
      const crData = this.inverseZigzag(block.crData || []);
      
      for (let i = 0; i < 64; i++) {
        yBlocks[baseIdx + i] = yData[i];
        cbBlocks[baseIdx + i] = cbData[i];
        crBlocks[baseIdx + i] = crData[i];
      }
    });
    
    console.timeEnd('Block conversion');
    
    // Process each channel through dequantization and IDCT
    console.log('Processing channels on GPU...');
    console.time('GPU Processing Y channel');
    console.log(`Processing Y channel: ${totalBlocks} blocks`);
    const processedY = await this.processChannelDecompression(yBlocks, quantArray, totalBlocks, blocksPerRow);
    console.timeEnd('GPU Processing Y channel');
    
    if (!processedY) {
      console.error('Y channel processing failed');
      return null;
    }
    
    console.time('GPU Processing Cb channel');
    const processedCb = await this.processChannelDecompression(cbBlocks, quantArray, totalBlocks, blocksPerRow);
    console.timeEnd('GPU Processing Cb channel');
    
    if (!processedCb) {
      console.error('Cb channel processing failed');
      return null;
    }
    
    console.time('GPU Processing Cr channel');
    const processedCr = await this.processChannelDecompression(crBlocks, quantArray, totalBlocks, blocksPerRow);
    console.timeEnd('GPU Processing Cr channel');
    
    if (!processedY || !processedCb || !processedCr) {
      console.error('Failed to process channels');
      return null;
    }
    
    // Convert YCbCr back to RGB
    console.log('Converting YCbCr to RGB...');
    console.time('YCbCr to RGB conversion');
    
    const result = new Uint8ClampedArray(width * height * 4);
    
    blocks.forEach((block, blockIdx) => {
      const baseIdx = blockIdx * 64;
      const { x: bx, y: by } = block.position;
      
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const pixelX = bx + x;
          const pixelY = by + y;
          
          if (pixelX < width && pixelY < height) {
            const localIdx = y * 8 + x;
            const idx = (pixelY * width + pixelX) * 4;
            
            // Get YCbCr values
            const yVal = processedY[baseIdx + localIdx] + 128;
            const cbVal = processedCb[baseIdx + localIdx] + 128;
            const crVal = processedCr[baseIdx + localIdx] + 128;
            
            // Convert to RGB
            const r = yVal + 1.402 * (crVal - 128);
            const g = yVal - 0.344136 * (cbVal - 128) - 0.714136 * (crVal - 128);
            const b = yVal + 1.772 * (cbVal - 128);
            
            result[idx] = Math.max(0, Math.min(255, Math.round(r)));
            result[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
            result[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
            result[idx + 3] = 255;
          }
        }
      }
    });
    
    console.timeEnd('YCbCr to RGB conversion');
    console.timeEnd('WebGPU Decompression Total Time');
    console.log('WebGPU decompression complete');
    
    return { data: result, width, height };
  }
  
  private async processChannelDecompression(
    blocks: Float32Array,
    quantMatrix: Float32Array,
    totalBlocks: number,
    blocksPerRow: number
  ): Promise<Float32Array | null> {
    if (!this.device || !this.dequantizePipeline || !this.idctPipeline) return null;
    
    console.log(`processChannelDecompression: ${totalBlocks} blocks, bufferSize calculation...`);
    const blockSize = 64 * 4;
    const bufferSize = totalBlocks * blockSize;
    console.log(`Buffer size: ${bufferSize} bytes (${(bufferSize / 1024 / 1024).toFixed(2)} MB)`);
    
    // Create buffers
    console.time('Creating buffers');
    const inputBuffer = this.device.createBuffer({
      label: 'Quantized Blocks Buffer',
      size: bufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    
    const dequantBuffer = this.device.createBuffer({
      label: 'Dequantized Blocks Buffer',
      size: bufferSize,
      usage: GPUBufferUsage.STORAGE
    });
    
    const idctBuffer = this.device.createBuffer({
      label: 'IDCT Output Buffer',
      size: bufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });
    
    const quantMatrixBuffer = this.device.createBuffer({
      label: 'Quantization Matrix Buffer',
      size: 64 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    
    const paramsBuffer = this.device.createBuffer({
      label: 'Parameters Buffer',
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    console.timeEnd('Creating buffers');
    
    // Write data to buffers
    console.time('Writing data to GPU');
    this.device.queue.writeBuffer(inputBuffer, 0, blocks);
    this.device.queue.writeBuffer(quantMatrixBuffer, 0, quantMatrix);
    this.device.queue.writeBuffer(paramsBuffer, 0, new Uint32Array([
      0, 0, blocksPerRow, totalBlocks
    ]));
    console.timeEnd('Writing data to GPU');
    
    // Create bind groups
    console.time('Creating bind groups');
    const dequantBindGroup = this.device.createBindGroup({
      layout: this.dequantizePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inputBuffer } },
        { binding: 1, resource: { buffer: dequantBuffer } },
        { binding: 2, resource: { buffer: quantMatrixBuffer } },
        { binding: 3, resource: { buffer: paramsBuffer } }
      ]
    });
    
    const idctBindGroup = this.device.createBindGroup({
      layout: this.idctPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: dequantBuffer } },
        { binding: 1, resource: { buffer: idctBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    });
    console.timeEnd('Creating bind groups');
    
    // Encode commands
    console.time('Encoding GPU commands');
    const commandEncoder = this.device.createCommandEncoder();
    
    // Dequantization pass
    const dequantPass = commandEncoder.beginComputePass();
    dequantPass.setPipeline(this.dequantizePipeline);
    dequantPass.setBindGroup(0, dequantBindGroup);
    const workgroupsX = Math.ceil(blocksPerRow / 8);
    const workgroupsY = Math.ceil(totalBlocks / blocksPerRow / 8);
    dequantPass.dispatchWorkgroups(workgroupsX, workgroupsY, 1);
    dequantPass.end();
    
    // IDCT pass
    const idctPass = commandEncoder.beginComputePass();
    idctPass.setPipeline(this.idctPipeline);
    idctPass.setBindGroup(0, idctBindGroup);
    idctPass.dispatchWorkgroups(workgroupsX, workgroupsY, 1);
    idctPass.end();
    
    // Read back results
    const readBuffer = this.device.createBuffer({
      label: 'Read Buffer',
      size: bufferSize,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });
    
    commandEncoder.copyBufferToBuffer(idctBuffer, 0, readBuffer, 0, bufferSize);
    console.timeEnd('Encoding GPU commands');
    
    // Submit commands
    console.time('GPU execution');
    console.log('Submitting GPU commands...');
    this.device.queue.submit([commandEncoder.finish()]);
    
    // Wait for results
    console.log('Waiting for GPU results...');
    await readBuffer.mapAsync(GPUMapMode.READ);
    console.timeEnd('GPU execution');
    
    console.time('Reading results');
    console.log('GPU computation complete, reading results...');
    const result = new Float32Array(readBuffer.getMappedRange().slice(0));
    readBuffer.unmap();
    console.timeEnd('Reading results');
    
    // Cleanup
    inputBuffer.destroy();
    dequantBuffer.destroy();
    idctBuffer.destroy();
    quantMatrixBuffer.destroy();
    paramsBuffer.destroy();
    readBuffer.destroy();
    
    return result;
  }
  
  private inverseZigzag(data: number[]): Float32Array {
    const zigzag = [
      0,  1,  8, 16,  9,  2,  3, 10,
      17, 24, 32, 25, 18, 11,  4,  5,
      12, 19, 26, 33, 40, 48, 41, 34,
      27, 20, 13,  6,  7, 14, 21, 28,
      35, 42, 49, 56, 57, 50, 43, 36,
      29, 22, 15, 23, 30, 37, 44, 51,
      58, 59, 52, 45, 38, 31, 39, 46,
      53, 60, 61, 54, 47, 55, 62, 63
    ];
    
    const result = new Float32Array(64);
    for (let i = 0; i < Math.min(64, data.length); i++) {
      result[zigzag[i]] = data[i];
    }
    return result;
  }
  
  cleanup() {
    this.device = null;
    this.dctPipeline = null;
    this.quantizePipeline = null;
    this.idctPipeline = null;
    this.dequantizePipeline = null;
  }
}

// Singleton instance
export const qdctWebGPU = new QDCTWebGPU();