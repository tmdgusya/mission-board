/**
 * Single source of truth for ALL test environment configuration.
 *
 * Every test file must import from here — never hardcode ports,
 * database paths, or API URLs in individual test files.
 */

/** Port the test API server runs on (never 3200, which is production) */
export const TEST_PORT = "3299";

/** Base URL for all API test requests */
export const API_BASE_URL = `http://localhost:${TEST_PORT}`;
