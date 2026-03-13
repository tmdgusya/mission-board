import { describe, it, expect } from "bun:test";

// Test configuration
const API_BASE_URL = "http://localhost:3200";

describe("Hono Server Setup", () => {
  describe("CORS Configuration", () => {
    it("should allow requests from dashboard origin (localhost:3201)", async () => {
      const response = await fetch(`${API_BASE_URL}/api/health`, {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:3201",
          "Access-Control-Request-Method": "POST",
        },
      });

      expect(response.status).toBe(204);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost:3201"
      );
    });

    it("should allow requests from dashboard origin (127.0.0.1:3201)", async () => {
      const response = await fetch(`${API_BASE_URL}/api/health`, {
        method: "OPTIONS",
        headers: {
          Origin: "http://127.0.0.1:3201",
          "Access-Control-Request-Method": "GET",
        },
      });

      expect(response.status).toBe(204);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://127.0.0.1:3201"
      );
    });

    it("should include allowed methods in CORS headers", async () => {
      const response = await fetch(`${API_BASE_URL}/api/health`, {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:3201",
          "Access-Control-Request-Method": "POST",
        },
      });

      const allowMethods = response.headers.get("Access-Control-Allow-Methods");
      expect(allowMethods).toContain("GET");
      expect(allowMethods).toContain("POST");
      expect(allowMethods).toContain("PUT");
      expect(allowMethods).toContain("PATCH");
      expect(allowMethods).toContain("DELETE");
      expect(allowMethods).toContain("OPTIONS");
    });

    it("should include allowed headers in CORS headers", async () => {
      const response = await fetch(`${API_BASE_URL}/api/health`, {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:3201",
          "Access-Control-Request-Method": "POST",
        },
      });

      const allowHeaders = response.headers.get("Access-Control-Allow-Headers");
      expect(allowHeaders).toContain("Content-Type");
    });
  });

  describe("JSON Body Parsing", () => {
    it("should parse JSON request bodies", async () => {
      const projectData = {
        name: "Test Project JSON Parsing",
        description: "Testing that JSON body parsing works correctly",
      };

      const response = await fetch(`${API_BASE_URL}/api/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(projectData),
      });

      expect(response.status).toBe(201);
      const data = (await response.json()) as { name: string; description: string };
      expect(data.name).toBe(projectData.name);
      expect(data.description).toBe(projectData.description);
    });

    it("should return 400 for invalid JSON", async () => {
      const response = await fetch(`${API_BASE_URL}/api/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "not valid json",
      });

      // Hono returns 400 for invalid JSON
      expect(response.status).toBe(400);
    });
  });

  describe("Global Error Handler", () => {
    it("should return JSON error for 404 not found", async () => {
      const response = await fetch(`${API_BASE_URL}/api/nonexistent-route`);

      expect(response.status).toBe(404);
      const contentType = response.headers.get("Content-Type");
      expect(contentType).toContain("application/json");

      const data = (await response.json()) as { error: string };
      expect(data.error).toBeDefined();
    });

    it("should return JSON error for invalid route", async () => {
      const response = await fetch(`${API_BASE_URL}/invalid-path`);

      expect(response.status).toBe(404);
      const data = (await response.json()) as { error: string };
      expect(data.error).toBe("Not found");
    });

    it("should return JSON format for validation errors", async () => {
      // Send a request with missing required field
      const response = await fetch(`${API_BASE_URL}/api/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}), // Missing required 'name' field
      });

      expect(response.status).toBe(400);
      const contentType = response.headers.get("Content-Type");
      expect(contentType).toContain("application/json");

      const data = (await response.json()) as { error: string };
      expect(data.error).toBeDefined();
    });
  });

  describe("Server Configuration", () => {
    it("should respond on the configured port", async () => {
      const response = await fetch(`${API_BASE_URL}/api/health`);
      expect(response.status).toBe(200);
    });

    it("should return correct Content-Type for JSON responses", async () => {
      const response = await fetch(`${API_BASE_URL}/api/health`);
      const contentType = response.headers.get("Content-Type");
      expect(contentType).toContain("application/json");
    });
  });
});
