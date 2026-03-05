Task 1 Evidence - OSS Signed URL Utilities

Summary:
- Implemented getSignedUrlWithRetry(objectKey, expires) with in-memory cache and automatic refresh when expired.
- Implemented refreshSignedUrls(ossKeys) for batch URL refresh.
- Exported both utilities from services/ossService.ts for reuse across the app.

How to QA (describe steps and expected results):
- Scenario 1: Get signed URL and verify non-expiring behavior
  1) Call getSignedUrlWithRetry('claims/test.jpg', 3600)
  2) Expect a URL string containing OSSAccessKeyId and Signature parameters
  3) curl the URL and expect HTTP 200
  Expected: Signed URL returned, accessible.

- Scenario 2: URL expiration triggers refresh
  1) Call getSignedUrlWithRetry('claims/test.jpg', 5) to get a short-lived URL
  2) sleep 6 seconds
  3) Call getSignedUrlWithRetry('claims/test.jpg', 5) again
  4) Confirm new URL differs from the previous one
  Expected: After expiry, a fresh URL is returned.

- Scenario 3: Batch refresh
  1) Call refreshSignedUrls(['claims/test1.jpg', 'claims/test2.jpg'])
  2) Verify the response is a mapping of keys to URL strings
  3) The cache for each key should be updated with new URLs

Evidence:
- See commit: feat(oss): add signed URL refresh utilities
- Current status: OSS URL utilities are exported and usable by other modules.
