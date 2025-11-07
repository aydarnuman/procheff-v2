import { OrchestratorLogger } from './src/lib/ihale-scraper/logger/orchestrator-logger';

console.log('🧪 Testing OrchestratorLogger...\n');

const logger = new OrchestratorLogger('test-session');

logger.info('test', 'This is an info message', { foo: 'bar' });
logger.success('test', 'This is a success message');
logger.warn('test', 'This is a warning');
logger.error('test', 'This is an error', { code: 500 });

const startTime = Date.now();
setTimeout(() => {
  logger.timed('test', 'Timed operation completed', startTime);
  
  console.log('\n' + logger.generateSummary());
  console.log('\n✅ Test complete! Check:', logger.getLogPath());
  
  logger.close();
}, 1000);
