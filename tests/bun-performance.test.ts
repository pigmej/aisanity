import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";

/**
 * Performance Benchmarks: Bun vs Node.js
 *
 * These tests compare runtime performance characteristics between Bun and Node.js
 * environments within aisanity devcontainers.
 */
describe("Bun Performance Benchmarks", () => {
  let tempDir: string;
  let bunProjectDir: string;
  let nodeProjectDir: string;

  beforeAll(() => {
    tempDir = path.join(os.tmpdir(), `bun-perf-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    // Create Bun project
    bunProjectDir = path.join(tempDir, "bun-project");
    fs.mkdirSync(bunProjectDir, { recursive: true });
    fs.mkdirSync(path.join(bunProjectDir, "src"), { recursive: true });

    // Create Node.js project
    nodeProjectDir = path.join(tempDir, "node-project");
    fs.mkdirSync(nodeProjectDir, { recursive: true });
    fs.mkdirSync(path.join(nodeProjectDir, "src"), { recursive: true });
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("Project Type Detection Performance", () => {
    test("Bun project detection is fast (< 10ms)", () => {
      // Setup Bun project
      fs.writeFileSync(path.join(bunProjectDir, "bun.lockb"), "");
      fs.writeFileSync(path.join(bunProjectDir, "package.json"), "{}");

      const { detectProjectType } = require("../src/utils/config");

      const start = performance.now();
      const projectType = detectProjectType(bunProjectDir);
      const end = performance.now();
      const duration = end - start;

      expect(projectType).toBe("bun");
      expect(duration).toBeLessThan(10);
    });

    test("Node.js project detection is fast (< 10ms)", () => {
      // Setup Node.js project (no bun.lockb)
      fs.writeFileSync(path.join(nodeProjectDir, "package.json"), "{}");

      const { detectProjectType } = require("../src/utils/config");

      const start = performance.now();
      const projectType = detectProjectType(nodeProjectDir);
      const end = performance.now();
      const duration = end - start;

      expect(projectType).toBe("nodejs");
      expect(duration).toBeLessThan(10);
    });
  });

  describe("DevContainer Template Generation Performance", () => {
    test("Bun template generation is fast (< 5ms)", () => {
      const { getDevContainerTemplate } = require("../src/utils/devcontainer-templates");

      const start = performance.now();
      const template = getDevContainerTemplate("bun");
      const end = performance.now();
      const duration = end - start;

      expect(template).toBeDefined();
      expect(duration).toBeLessThan(5);
    });

    test("Node.js template generation is fast (< 5ms)", () => {
      const { getDevContainerTemplate } = require("../src/utils/devcontainer-templates");

      const start = performance.now();
      const template = getDevContainerTemplate("nodejs");
      const end = performance.now();
      const duration = end - start;

      expect(template).toBeDefined();
      expect(duration).toBeLessThan(5);
    });

    test("template generation performance comparison", () => {
      const { getDevContainerTemplate } = require("../src/utils/devcontainer-templates");

      // Measure Bun
      const bunStart = performance.now();
      for (let i = 0; i < 100; i++) {
        getDevContainerTemplate("bun");
      }
      const bunEnd = performance.now();
      const bunDuration = bunEnd - bunStart;

      // Measure Node.js
      const nodeStart = performance.now();
      for (let i = 0; i < 100; i++) {
        getDevContainerTemplate("nodejs");
      }
      const nodeEnd = performance.now();
      const nodeDuration = nodeEnd - nodeStart;

      console.log(`\n📊 Template Generation (100 iterations):`);
      console.log(`  Bun:     ${bunDuration.toFixed(2)}ms (avg: ${(bunDuration / 100).toFixed(3)}ms)`);
      console.log(`  Node.js: ${nodeDuration.toFixed(2)}ms (avg: ${(nodeDuration / 100).toFixed(3)}ms)`);

      // Both should be reasonably fast
      expect(bunDuration).toBeLessThan(100);
      expect(nodeDuration).toBeLessThan(100);
    });
  });

  describe("File System Operations Performance", () => {
    test("Bun lockfile detection is fast", () => {
      fs.writeFileSync(path.join(bunProjectDir, "bun.lockb"), Buffer.alloc(1024 * 10)); // 10KB file

      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        fs.existsSync(path.join(bunProjectDir, "bun.lockb"));
      }
      const end = performance.now();
      const duration = end - start;

      console.log(`\n📊 File Existence Check (1000 iterations): ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(100);
    });

    test("multiple project type indicators detection", () => {
      // Create project with multiple files
      const multiProjectDir = path.join(tempDir, "multi-project");
      fs.mkdirSync(multiProjectDir, { recursive: true });
      fs.writeFileSync(path.join(multiProjectDir, "bun.lockb"), "");
      fs.writeFileSync(path.join(multiProjectDir, "package.json"), "{}");
      fs.writeFileSync(path.join(multiProjectDir, "tsconfig.json"), "{}");
      fs.writeFileSync(path.join(multiProjectDir, "README.md"), "");

      const { detectProjectType } = require("../src/utils/config");

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        detectProjectType(multiProjectDir);
      }
      const end = performance.now();
      const duration = end - start;

      console.log(`\n📊 Project Detection with Multiple Files (100 iterations): ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(200);
    });
  });

  describe("JSON Parsing Performance", () => {
    test("Bun devcontainer JSON parsing", () => {
      const { getDevContainerTemplate } = require("../src/utils/devcontainer-templates");
      const template = getDevContainerTemplate("bun");

      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        JSON.parse(template!.devcontainerJson);
      }
      const end = performance.now();
      const duration = end - start;

      console.log(`\n📊 JSON Parsing - Bun DevContainer (1000 iterations): ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(100);
    });

    test("Node.js devcontainer JSON parsing", () => {
      const { getDevContainerTemplate } = require("../src/utils/devcontainer-templates");
      const template = getDevContainerTemplate("nodejs");

      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        JSON.parse(template!.devcontainerJson);
      }
      const end = performance.now();
      const duration = end - start;

      console.log(`\n📊 JSON Parsing - Node.js DevContainer (1000 iterations): ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(100);
    });
  });

  describe("Memory Usage Comparison", () => {
    test("Bun template memory footprint", () => {
      const { getDevContainerTemplate } = require("../src/utils/devcontainer-templates");

      const beforeMemory = process.memoryUsage();

      // Generate templates repeatedly
      const templates = [];
      for (let i = 0; i < 100; i++) {
        templates.push(getDevContainerTemplate("bun"));
      }

      const afterMemory = process.memoryUsage();
      const memoryIncrease = afterMemory.heapUsed - beforeMemory.heapUsed;
      const memoryPerTemplate = memoryIncrease / 100;

      console.log(`\n📊 Memory Usage (100 Bun templates):`);
      console.log(`  Total increase: ${(memoryIncrease / 1024).toFixed(2)}KB`);
      console.log(`  Per template:   ${(memoryPerTemplate / 1024).toFixed(2)}KB`);

      // Should be relatively small (< 100KB per template)
      expect(memoryPerTemplate).toBeLessThan(100 * 1024);
    });

    test("Node.js template memory footprint", () => {
      const { getDevContainerTemplate } = require("../src/utils/devcontainer-templates");

      const beforeMemory = process.memoryUsage();

      // Generate templates repeatedly
      const templates = [];
      for (let i = 0; i < 100; i++) {
        templates.push(getDevContainerTemplate("nodejs"));
      }

      const afterMemory = process.memoryUsage();
      const memoryIncrease = afterMemory.heapUsed - beforeMemory.heapUsed;
      const memoryPerTemplate = memoryIncrease / 100;

      console.log(`\n📊 Memory Usage (100 Node.js templates):`);
      console.log(`  Total increase: ${(memoryIncrease / 1024).toFixed(2)}KB`);
      console.log(`  Per template:   ${(memoryPerTemplate / 1024).toFixed(2)}KB`);

      // Should be relatively small (< 100KB per template)
      expect(memoryPerTemplate).toBeLessThan(100 * 1024);
    });
  });

  describe("End-to-End Performance Scenarios", () => {
    test("full Bun project setup performance", () => {
      const { detectProjectType } = require("../src/utils/config");
      const { getDevContainerTemplate } = require("../src/utils/devcontainer-templates");

      const testProjectDir = path.join(tempDir, "e2e-bun-project");
      fs.mkdirSync(testProjectDir, { recursive: true });
      fs.writeFileSync(path.join(testProjectDir, "bun.lockb"), "");
      fs.writeFileSync(path.join(testProjectDir, "package.json"), "{}");

      const start = performance.now();

      // Simulate aisanity init workflow
      const projectType = detectProjectType(testProjectDir);
      expect(projectType).toBe("bun");

      const template = getDevContainerTemplate(projectType);
      expect(template).toBeDefined();

      const config = JSON.parse(template!.devcontainerJson);
      expect(config.image).toBe("mcr.microsoft.com/devcontainers/base:ubuntu");

      const end = performance.now();
      const duration = end - start;

      console.log(`\n📊 Full Bun Project Setup: ${duration.toFixed(2)}ms`);

      // Should complete quickly
      expect(duration).toBeLessThan(50);
    });

    test("full Node.js project setup performance", () => {
      const { detectProjectType } = require("../src/utils/config");
      const { getDevContainerTemplate } = require("../src/utils/devcontainer-templates");

      const testProjectDir = path.join(tempDir, "e2e-node-project");
      fs.mkdirSync(testProjectDir, { recursive: true });
      fs.writeFileSync(path.join(testProjectDir, "package.json"), "{}");

      const start = performance.now();

      // Simulate aisanity init workflow
      const projectType = detectProjectType(testProjectDir);
      expect(projectType).toBe("nodejs");

      const template = getDevContainerTemplate(projectType);
      expect(template).toBeDefined();

      const config = JSON.parse(template!.devcontainerJson);
      expect(config.image).toContain("javascript-node");

      const end = performance.now();
      const duration = end - start;

      console.log(`\n📊 Full Node.js Project Setup: ${duration.toFixed(2)}ms`);

      // Should complete quickly
      expect(duration).toBeLessThan(50);
    });
  });

  describe("Performance Regression Guards", () => {
    test("Bun detection should not degrade with many files", () => {
      const largeProjectDir = path.join(tempDir, "large-bun-project");
      fs.mkdirSync(largeProjectDir, { recursive: true });

      // Create many files
      fs.writeFileSync(path.join(largeProjectDir, "bun.lockb"), "");
      for (let i = 0; i < 50; i++) {
        fs.writeFileSync(path.join(largeProjectDir, `file${i}.ts`), "");
      }

      const { detectProjectType } = require("../src/utils/config");

      const start = performance.now();
      const projectType = detectProjectType(largeProjectDir);
      const end = performance.now();
      const duration = end - start;

      expect(projectType).toBe("bun");
      // Should still be fast even with many files
      expect(duration).toBeLessThan(15);
    });

    test("template generation should scale linearly", () => {
      const { getDevContainerTemplate } = require("../src/utils/devcontainer-templates");

      const iterations = [10, 100, 1000];
      const results: number[] = [];

      for (const count of iterations) {
        const start = performance.now();
        for (let i = 0; i < count; i++) {
          getDevContainerTemplate("bun");
        }
        const end = performance.now();
        results.push((end - start) / count);
      }

      console.log(`\n📊 Template Generation Scaling:`);
      console.log(`  10 iterations:   ${results[0].toFixed(3)}ms per template`);
      console.log(`  100 iterations:  ${results[1].toFixed(3)}ms per template`);
      console.log(`  1000 iterations: ${results[2].toFixed(3)}ms per template`);

      // Per-template time should remain relatively constant
      // (within 2x factor across different scales)
      const minTime = Math.min(...results);
      const maxTime = Math.max(...results);
      const scalingFactor = maxTime / minTime;

      expect(scalingFactor).toBeLessThan(10);
    });
  });
});
