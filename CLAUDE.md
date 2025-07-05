# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a research project developing a novel distributed lossy image compression system where multiple devices compress the same image differently, preserving various aspects (edges, colors, textures, frequencies) to enable collective high-quality reconstruction. The key innovation is that information loss is strategically distributed rather than uniform.

**Core Innovation - Deterministic Compression:**
- Each device's compression strategy is deterministically derived from its unique ID (e.g., MAC address)
- No coordination or communication needed between devices
- The reconstruction algorithm knows exactly what each device preserved based on its ID
- Zero metadata overhead - compression parameters are implicit in the device ID

**Project Goals:**
- Develop proof-of-concept compression/recovery algorithms with deterministic strategies
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

The project has been implemented with:
- TypeScript-based compression algorithms using DCT transforms
- Interactive web demo with Vite
- Comprehensive test suite (50+ tests, >95% coverage)
- Sample test images for benchmarking
- Complete documentation in `docs/research/`

### Key Implementation Files
- `src/core/deterministic-strategy.ts` - Device ID to strategy mapping
- `src/compression/image-compressor.ts` - Main compression/decompression logic
- `src/utils/dct.ts` - DCT transform utilities
- `demo/main.ts` - Interactive demo application

## Development Notes

Since this is an image compression project, key considerations include:
- Image format support (JPEG, PNG, etc.)
- Compression algorithm implementation
- Detail recovery mechanisms from multiple sources
- Quality vs. file size trade-offs
- Social network integration for recovery point discovery
- Metadata tracking for reconstruction from distributed sources
- Privacy considerations for social recovery features

## Testing Requirements

This project follows strict testing practices to ensure code quality and reliability:

### Test Structure
- **Unit Tests**: Located in `tests/unit/` - Test individual functions in isolation
- **Integration Tests**: Located in `tests/integration/` - Test composite functionality
- **E2E Tests**: Located in `tests/e2e/` - Test complete workflows and demo functionality
- **Test Fixtures**: Located in `tests/fixtures/` - Shared test data and utilities

### Current Test Coverage
- 74 tests total across unit, integration, and e2e
- >98% code coverage
- E2E tests verify demo UI structure and compression workflows

### Testing Rules
1. **Every function must have unit tests** covering all code paths
2. **Tests must be updated** when functions are modified
3. **Tests must be removed** when functions are deleted
4. **External services** require:
   - Mocked tests for isolation
   - Integration tests with test environments (when available)
   - Complete interface documentation in `external-services/` directory
5. **Development tasks are not complete** until all tests pass

### Test Commands
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate coverage report
- `npm run test:unit` - Run only unit tests
- `npm run test:integration` - Run only integration tests
- `npm run test:e2e` - Run only end-to-end tests

### Coverage Requirements
- Maintain >80% code coverage for unit tests
- All critical paths must be tested
- Use `npm run test:coverage` to verify coverage

## Common Development Commands

```bash
# Development
npm run dev          # Watch TypeScript compilation
npm run demo         # Start demo server
npm run build        # Build TypeScript
npm run build-demo   # Build demo for production

# Testing
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Check test coverage

# Utilities
node scripts/generate-test-image.js  # Generate test images
```

## Demo Deployment

To deploy the demo to GitHub Pages:
1. Run `npm run build-demo`
2. The `dist-demo` directory contains static files ready for deployment
3. Configure GitHub Pages to serve from the appropriate branch/directory