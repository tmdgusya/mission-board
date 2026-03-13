import { describe, it, expect } from "bun:test";

// Test configuration
const API_BASE_URL = "http://localhost:3200";

describe("GET /api/health - Health Check Endpoint", () => {
  it("should return 200 status code", async () => {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    expect(response.status).toBe(200);
  });

  it("should return JSON response with status: 'ok'", async () => {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({ status: "ok" });
  });

  it("should return Content-Type header as application/json", async () => {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    expect(response.status).toBe(200);

    const contentType = response.headers.get("Content-Type");
    expect(contentType).toContain("application/json");
  });
});
