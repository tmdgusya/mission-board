/**
 * Test preload — loaded automatically before every test via bunfig.toml.
 *
 * Enforces test isolation by setting DATABASE_PATH and PORT
 * so that no test can ever touch the production database or server.
 */
import { TEST_PORT } from "./test-config";

// Force test database — this runs BEFORE any module imports connection.ts
process.env.DATABASE_PATH = "./data/test.db";

// Force test port — prevents accidentally binding to production port
process.env.PORT = TEST_PORT;
