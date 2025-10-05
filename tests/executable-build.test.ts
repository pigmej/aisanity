describe('Executable Build System', () => {
  test('pkg configuration validation', () => {
    const packageJson = require('../package.json');
    
    // Verify pkg config exists
    expect(packageJson.pkg).toBeDefined();
    
    // Verify scripts configuration
    expect(packageJson.pkg.scripts).toBe('dist/**/*.js');
    
    // Verify assets configuration
    expect(Array.isArray(packageJson.pkg.assets)).toBe(true);
    expect(packageJson.pkg.assets).toContain('src/**/*.yaml');
    expect(packageJson.pkg.assets).toContain('src/**/*.yml');
    expect(packageJson.pkg.assets).toContain('examples/**/*');
    
    // Verify targets configuration
    expect(Array.isArray(packageJson.pkg.targets)).toBe(true);
    expect(packageJson.pkg.targets).toContain('node24-macos-arm64');
    expect(packageJson.pkg.targets).toContain('node24-linux-x64');
    expect(packageJson.pkg.targets).toContain('node24-win-x64');
    
    // Verify output path
    expect(packageJson.pkg.outputPath).toBe('dist/executables');
  });
  
  test('package scripts validation', () => {
    const packageJson = require('../package.json');
    
    // Verify package scripts exist
    expect(packageJson.scripts.package).toBeDefined();
    expect(packageJson.scripts['package:macos']).toBeDefined();
    expect(packageJson.scripts['package:linux']).toBeDefined();
    expect(packageJson.scripts['package:windows']).toBeDefined();
    
    // Verify script commands contain correct targets
    expect(packageJson.scripts.package).toContain('node24-macos-arm64');
    expect(packageJson.scripts.package).toContain('node24-linux-x64');
    expect(packageJson.scripts.package).toContain('node24-win-x64');
    expect(packageJson.scripts.package).toContain('dist/executables');
    
    expect(packageJson.scripts['package:macos']).toContain('node24-macos-arm64');
    expect(packageJson.scripts['package:linux']).toContain('node24-linux-x64');
    expect(packageJson.scripts['package:windows']).toContain('node24-win-x64');
  });
  
  test('asset bundling configuration', () => {
    const packageJson = require('../package.json');
    
    // Verify all necessary assets are configured
    const assets = packageJson.pkg.assets;
    
    // Check for YAML configuration files
    expect(assets.some((asset: string) => asset.includes('*.yaml'))).toBe(true);
    expect(assets.some((asset: string) => asset.includes('*.yml'))).toBe(true);
    
    // Check for example files
    expect(assets.some((asset: string) => asset.includes('examples'))).toBe(true);
    
    // Check for template files if they exist
    expect(assets.some((asset: string) => asset.includes('templates'))).toBe(true);
  });
});