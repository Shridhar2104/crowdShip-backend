import runMatchingTests from './tests/matchingAlgorithmTest';

console.log('Starting CrowdShip AI Matching Algorithm Test...\n');

runMatchingTests()
  .then(() => {
    console.log('\nTest completed successfully!');
    process.exit(0);
  })
  .catch((error: any) => {
    console.error('\nTest failed with error:', error);
    process.exit(1);
  });