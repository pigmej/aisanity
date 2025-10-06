import { expect, test, describe } from 'bun:test';
import packageJson from '../package.json' with { type: 'json' };

describe('Executable Build System', () => {
  test('package.json has required build scripts', () => {
    // Verify build scripts exist
    expect(packageJson.scripts.build).toBeDefined();
    expect(packageJson.scripts.package).toBeDefined();
    
    // Verify build script uses Bun
    expect(packageJson.scripts.build).toContain('bun build');
    
    // Verify package script uses Bun compile
    expect(packageJson.scripts.package).toBe('bun build ./src/index.ts --compile --outfile ./dist/aisanity');
  });
  
  test('package.json has correct engines configuration', () => {
    // Verify Bun engine requirement
    expect(packageJson.engines.bun).toBeDefined();
    expect(packageJson.engines.bun).toBe('>=1.0.0');
  });

  test('package.json has correct main and bin fields', () => {
    // Verify main entry point
    expect(packageJson.main).toBe('src/index.ts');
    
    // Verify bin configuration
    expect(packageJson.bin.aisanity).toBe('src/index.ts');
  });
});