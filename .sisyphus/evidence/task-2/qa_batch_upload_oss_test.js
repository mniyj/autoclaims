// QA test for batch OSS batch-upload-oss endpoint (no network calls made during unit test)
// This script imports the API handler and invokes the batch endpoint with a mocked request/response.
(async () => {
  const { handleApiRequest } = await import('./../../.claude/worktrees/offline-import-optimization-1772720681/server/apiHandler.js');

  // Setup dummy OSS credentials for test (non-production)
  process.env.ALIYUN_OSS_REGION = "oss-cn-beijing";
  process.env.ALIYUN_OSS_BUCKET = "test-bucket";
  process.env.ALIYUN_OSS_ACCESS_KEY_ID = "TESTID";
  process.env.ALIYUN_OSS_ACCESS_KEY_SECRET = "TESTSECRET";

  // Mock req/res
  const req = {
    method: 'POST',
    url: '/api/batch-upload-oss',
    headers: { host: 'localhost' },
    body: {
      files: [ { name: 'test1.jpg' }, { name: 'test2.pdf' } ],
      expires: 600
    }
  };

  let response = '';
  const res = {
    statusCode: 200,
    headers: {},
    setHeader: (k, v) => { res.headers[k] = v; },
    end: (chunk) => { response = typeof chunk === 'string' ? chunk : JSON.stringify(chunk); }
  };

  // Bind little helper to convert Buffer or string to string if needed
  await handleApiRequest(req, res);

  console.log('StatusCode:', res.statusCode);
  console.log('Response body:', response);
})();
