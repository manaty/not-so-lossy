#!/usr/bin/env python3
"""
Example Python script to plot the compression analysis data
Can be used to generate figures for the scientific article
"""

import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

# Set style for publication-quality figures
plt.style.use('seaborn-v0_8-paper')
plt.rcParams['font.size'] = 10
plt.rcParams['axes.labelsize'] = 12
plt.rcParams['axes.titlesize'] = 14
plt.rcParams['xtick.labelsize'] = 10
plt.rcParams['ytick.labelsize'] = 10
plt.rcParams['legend.fontsize'] = 10
plt.rcParams['figure.dpi'] = 300

# 1. Plot Compression Level vs Average Quantization
df_compression = pd.read_csv('compression_level_analysis.csv')

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))

# Average quantization progression
ax1.plot(df_compression['level'], df_compression['avg_quantization'], 'b-', linewidth=2)
ax1.fill_between(df_compression['level'], 
                 df_compression['min_quantization'], 
                 df_compression['max_quantization'], 
                 alpha=0.2, color='blue')
ax1.set_xlabel('Compression Level')
ax1.set_ylabel('Quantization Value')
ax1.set_title('Quantization Value Progression')
ax1.grid(True, alpha=0.3)
ax1.set_xlim(0, 150)

# Theoretical compression ratio
df_model = pd.read_csv('theoretical_model.csv')
ax2.plot(df_model['level'], df_model['theoretical_ratio'], 'r-', linewidth=2)
ax2.set_xlabel('Compression Level')
ax2.set_ylabel('Compression Ratio')
ax2.set_title('Theoretical Compression Ratio Model')
ax2.grid(True, alpha=0.3)
ax2.set_xlim(0, 150)

plt.tight_layout()
plt.savefig('compression_analysis.png', dpi=300, bbox_inches='tight')
plt.close()

# 2. Device Comparison Heatmap
df_order = pd.read_csv('coefficient_selection_order.csv')

fig, axes = plt.subplots(1, 3, figsize=(15, 5))

for i, device in enumerate(['DEVICE-001', 'DEVICE-002', 'DEVICE-003']):
    device_data = df_order[df_order['device'] == device].head(32)
    
    # Create 8x8 grid showing order
    grid = np.zeros((8, 8))
    for _, row in device_data.iterrows():
        grid[int(row['row']), int(row['col'])] = row['order_index'] + 1
    
    im = axes[i].imshow(grid, cmap='viridis', aspect='equal')
    axes[i].set_title(f'{device} Selection Order')
    axes[i].set_xlabel('Column')
    axes[i].set_ylabel('Row')
    
    # Add colorbar
    cbar = plt.colorbar(im, ax=axes[i], fraction=0.046, pad=0.04)
    cbar.set_label('Selection Order')

plt.tight_layout()
plt.savefig('device_selection_patterns.png', dpi=300, bbox_inches='tight')
plt.close()

# 3. Quantization Matrix Evolution
df_evolution = pd.read_csv('quantization_matrix_evolution.csv')

fig, axes = plt.subplots(2, 3, figsize=(15, 10))
levels = [0, 10, 20, 40, 64, 100]

for i, level in enumerate(levels):
    ax = axes[i // 3, i % 3]
    level_data = df_evolution[df_evolution['level'] == level]
    
    # Create 8x8 grid
    grid = np.zeros((8, 8))
    for _, row in level_data.iterrows():
        grid[int(row['row']), int(row['col'])] = row['value']
    
    im = ax.imshow(grid, cmap='hot', aspect='equal', vmin=1, vmax=50)
    ax.set_title(f'Level {level}')
    ax.set_xlabel('Column')
    ax.set_ylabel('Row')
    
    # Add text annotations for values
    for row in range(8):
        for col in range(8):
            val = int(grid[row, col])
            color = 'white' if val > 25 else 'black'
            ax.text(col, row, str(val), ha='center', va='center', 
                   color=color, fontsize=8)

plt.suptitle('Quantization Matrix Evolution', fontsize=16)
plt.tight_layout()
plt.savefig('matrix_evolution.png', dpi=300, bbox_inches='tight')
plt.close()

print("Plots saved:")
print("- compression_analysis.png")
print("- device_selection_patterns.png")
print("- matrix_evolution.png")