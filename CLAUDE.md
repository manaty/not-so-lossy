# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a research project developing a novel distributed lossy image compression system where multiple devices compress the same image differently, preserving various aspects (edges, colors, textures, frequencies) to enable collective high-quality reconstruction. The key innovation is that information loss is strategically distributed rather than uniform.

**Project Goals:**
- Develop proof-of-concept compression/recovery algorithms
- Create a static web demo hosted on GitHub Pages
- Publish findings in a peer-reviewed academic paper
- Focus on algorithm correctness over performance optimization

## Task Management System

The project uses a file-based task management system with the following structure:
- `PROJECT_TODO.md` - Master task list organized by phases (P1, P2, etc.)
- `.todo/` directory - Contains detailed subtask breakdowns
- `.todo/WORKFLOW.md` - Explains the task management workflow
- `.todo/TASK_TEMPLATE.md` - Template for creating new task files

**IMPORTANT**: Before starting any task from PROJECT_TODO.md:
1. Check if a detailed subtask file exists in the `.todo/` directory
2. If no subtask file exists, create one using the template at `.todo/TASK_TEMPLATE.md`
3. **PAUSE implementation** and wait for user validation of the subtask breakdown
4. Only proceed with implementation after subtasks are approved

## Project Status

This is a newly initialized repository with minimal structure. When implementing the lossy compression algorithm, consider:

- Setting up appropriate project structure based on the chosen implementation language
- Adding build configuration files as needed
- Implementing test infrastructure for compression/decompression validation
- Adding performance benchmarks for compression ratios and processing speed

## Development Notes

Since this is an image compression project, key considerations include:
- Image format support (JPEG, PNG, etc.)
- Compression algorithm implementation
- Detail recovery mechanisms from multiple sources
- Quality vs. file size trade-offs
- Social network integration for recovery point discovery
- Metadata tracking for reconstruction from distributed sources
- Privacy considerations for social recovery features