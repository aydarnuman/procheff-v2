#!/usr/bin/env node

/**
 * Worker starter for development
 * Usage: node scripts/start-worker.js
 */

// For TypeScript files, we need to use tsx or ts-node
// This script assumes worker.ts is compiled or we use tsx

const path = require('path');

// Check if we're in dev mode with tsx
try {
  // Try to import using tsx/ts-node for TypeScript support
  require('tsx/cjs');
  const { startWorkerLoop } = require('../src/lib/analysis/worker.ts');
  
  console.log('🚀 Starting analysis worker loop...');
  startWorkerLoop({ interval: 1500 });
  
  console.log('✅ Worker started - processing queued analyses');
  console.log('📊 Checking for jobs every 1.5 seconds');
  console.log('🛑 Press Ctrl+C to stop');
  
  // Keep process alive
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping worker...');
    process.exit(0);
  });
  
} catch (err) {
  console.error('❌ Error starting worker:', err);
  console.log('\n💡 Make sure to run: npm install tsx --save-dev');
  console.log('💡 Or build the project first: npm run build');
  process.exit(1);
}
