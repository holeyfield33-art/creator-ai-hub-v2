// Test setup
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  process.env.AI_API_KEY = 'mock';
});

afterAll(() => {
  // Cleanup
});
