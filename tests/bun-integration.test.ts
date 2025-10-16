import { expect, test, describe, beforeEach, afterEach } from "bun:test";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
import { detectProjectType } from "../src/utils/config";
import { getDevContainerTemplate } from "../src/utils/devcontainer-templates";

describe("Bun Integration Tests", () => {
  let tempDir: string;
  let bunProjectDir: string;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `bun-integration-${Date.now()}-${Math.random()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    // Create a test Bun project structure
    bunProjectDir = path.join(tempDir, "test-bun-project");
    fs.mkdirSync(bunProjectDir, { recursive: true });
    fs.mkdirSync(path.join(bunProjectDir, "src"), { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("Bun Project Detection", () => {
    test("detects Bun project with complete structure", () => {
      // Create typical Bun project files
      fs.writeFileSync(path.join(bunProjectDir, "bun.lockb"), "");
      fs.writeFileSync(
        path.join(bunProjectDir, "package.json"),
        JSON.stringify(
          {
            name: "test-bun-api",
            type: "module",
            scripts: {
              dev: "bun run --watch src/index.ts",
              start: "bun run src/index.ts",
            },
          },
          null,
          2,
        ),
      );
      fs.writeFileSync(
        path.join(bunProjectDir, "tsconfig.json"),
        JSON.stringify(
          {
            compilerOptions: {
              moduleResolution: "bundler",
              noEmit: true,
              target: "esnext",
              module: "esnext",
            },
          },
          null,
          2,
        ),
      );
      fs.writeFileSync(
        path.join(bunProjectDir, "src", "index.ts"),
        `
        const server = Bun.serve({
          port: 3000,
          fetch(req) {
            return Response.json({ message: 'Hello from Bun!' });
          }
        });
      `,
      );

      const projectType = detectProjectType(bunProjectDir);
      expect(projectType).toBe("bun");
    });

    test("detects Bun project even with package.json present", () => {
      // This test ensures Bun detection takes priority over Node.js
      fs.writeFileSync(path.join(bunProjectDir, "bun.lockb"), "");
      fs.writeFileSync(path.join(bunProjectDir, "package.json"), "{}");

      const projectType = detectProjectType(bunProjectDir);
      expect(projectType).toBe("bun");
    });
  });

  describe("Bun DevContainer Template Generation", () => {
    test("generates correct devcontainer configuration for Bun project", () => {
      fs.writeFileSync(path.join(bunProjectDir, "bun.lockb"), "");

      const projectType = detectProjectType(bunProjectDir);
      const template = getDevContainerTemplate(projectType);

      expect(template).toBeDefined();
      expect(template?.devcontainerJson).toBeDefined();

      const config = JSON.parse(template!.devcontainerJson);

      // Verify Bun-specific image
      expect(config.image).toBe("mcr.microsoft.com/devcontainers/base:ubuntu");

      // Verify name
      expect(config.name).toBe("Bun Development");

      // Verify user
      expect(config.remoteUser).toBe("vscode");
    });

    test("Bun devcontainer includes proper TypeScript support", () => {
      const template = getDevContainerTemplate("bun");
      const config = JSON.parse(template!.devcontainerJson);

      // Verify TypeScript extensions
      expect(config.customizations.vscode.extensions).toContain("ms-vscode.vscode-typescript-next");
      expect(config.customizations.vscode.extensions).toContain("ms-vscode.vscode-json");
    });

    test("Bun devcontainer has correct port forwarding", () => {
      const template = getDevContainerTemplate("bun");
      const config = JSON.parse(template!.devcontainerJson);

      // Common web dev ports
      expect(config.forwardPorts).toContain(3000);
      expect(config.forwardPorts).toContain(3001);
    });
  });

  describe("Bun Example Project Validation", () => {
    test("example Bun project exists with required files", () => {
      const examplePath = path.join(process.cwd(), "examples", "bun-typescript-api");

      // Verify example directory exists
      expect(fs.existsSync(examplePath)).toBe(true);

      // Verify required files
      expect(fs.existsSync(path.join(examplePath, "package.json"))).toBe(true);
      expect(fs.existsSync(path.join(examplePath, "bun.lockb"))).toBe(true);
      expect(fs.existsSync(path.join(examplePath, "tsconfig.json"))).toBe(true);
      expect(fs.existsSync(path.join(examplePath, "README.md"))).toBe(true);
      expect(fs.existsSync(path.join(examplePath, "src", "index.ts"))).toBe(true);
    });

    test("example Bun project is detected correctly", () => {
      const examplePath = path.join(process.cwd(), "examples", "bun-typescript-api");

      if (fs.existsSync(examplePath)) {
        const projectType = detectProjectType(examplePath);
        expect(projectType).toBe("bun");
      }
    });

    test("example Bun project uses Bun.serve API", () => {
      const examplePath = path.join(process.cwd(), "examples", "bun-typescript-api");
      const indexPath = path.join(examplePath, "src", "index.ts");

      if (fs.existsSync(indexPath)) {
        const content = fs.readFileSync(indexPath, "utf8");

        // Verify it uses Bun.serve (not Express or other frameworks)
        expect(content).toContain("Bun.serve");
        expect(content).toContain("fetch(req)");

        // Should not use Express
        expect(content).not.toContain("express()");
        expect(content).not.toContain("app.listen");
      }
    });

    test("example Bun project has Bun-specific scripts", () => {
      const examplePath = path.join(process.cwd(), "examples", "bun-typescript-api");
      const packagePath = path.join(examplePath, "package.json");

      if (fs.existsSync(packagePath)) {
        const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));

        // Verify Bun-specific scripts
        expect(pkg.scripts.start).toContain("bun run");
        expect(pkg.scripts.dev).toContain("bun run");
        expect(pkg.scripts.dev).toContain("--watch");
      }
    });

    test("example Bun project tsconfig uses bundler module resolution", () => {
      const examplePath = path.join(process.cwd(), "examples", "bun-typescript-api");
      const tsconfigPath = path.join(examplePath, "tsconfig.json");

      if (fs.existsSync(tsconfigPath)) {
        const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf8"));

        // Verify Bun-specific TypeScript settings
        expect(tsconfig.compilerOptions.moduleResolution).toBe("bundler");
        expect(tsconfig.compilerOptions.noEmit).toBe(true);
      }
    });
  });

  describe("Bun vs Node.js Priority", () => {
    test("Bun detection runs before Node.js detection", () => {
      // Create a project with both Bun and Node.js indicators
      const mixedProjectDir = path.join(tempDir, "mixed-project");
      fs.mkdirSync(mixedProjectDir, { recursive: true });

      // Add both Bun and Node.js files
      fs.writeFileSync(path.join(mixedProjectDir, "bun.lockb"), "");
      fs.writeFileSync(
        path.join(mixedProjectDir, "package.json"),
        JSON.stringify(
          {
            name: "mixed-project",
            dependencies: {
              express: "^4.18.0",
            },
          },
          null,
          2,
        ),
      );

      // Should detect as Bun, not Node.js
      const projectType = detectProjectType(mixedProjectDir);
      expect(projectType).toBe("bun");
    });

    test("Node.js detection works when no Bun lockfile present", () => {
      const nodeProjectDir = path.join(tempDir, "node-project");
      fs.mkdirSync(nodeProjectDir, { recursive: true });

      // Only package.json, no bun.lockb
      fs.writeFileSync(path.join(nodeProjectDir, "package.json"), "{}");

      const projectType = detectProjectType(nodeProjectDir);
      expect(projectType).toBe("nodejs");
    });
  });
});
