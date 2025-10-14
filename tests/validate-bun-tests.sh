#!/bin/bash
# Validation script for Bun test implementation (Task 70)

echo "=== Validating Bun Test Implementation ==="
echo ""

# Count test files
echo "Test Files:"
echo "  config.test.ts:                 $(grep -c 'test(' tests/config.test.ts) test() cases"
echo "  devcontainer-templates.test.ts: $(grep -c 'it(' tests/devcontainer-templates.test.ts) it() cases"
echo "  bun-integration.test.ts:        $(grep -c 'test(' tests/bun-integration.test.ts) test() cases"
echo "  bun-performance.test.ts:        $(grep -c 'test(' tests/bun-performance.test.ts) test() cases"
echo ""

# Check for critical tests
echo "Critical Tests Present:"
grep -q "prioritizes Bun over Node.js" tests/config.test.ts && echo "  ✅ Bun priority test in config.test.ts" || echo "  ❌ Missing Bun priority test"
grep -q "Bun devcontainer" tests/devcontainer-templates.test.ts && echo "  ✅ Bun template test in devcontainer-templates.test.ts" || echo "  ❌ Missing Bun template test"
grep -q "Bun Integration Tests" tests/bun-integration.test.ts && echo "  ✅ Integration test suite exists" || echo "  ❌ Missing integration tests"
grep -q "Bun Performance Benchmarks" tests/bun-performance.test.ts && echo "  ✅ Performance benchmark suite exists" || echo "  ❌ Missing performance tests"
echo ""

# Check documentation
echo "Documentation:"
[ -f tests/BUN_TEST_SUMMARY.md ] && echo "  ✅ BUN_TEST_SUMMARY.md exists" || echo "  ❌ Missing BUN_TEST_SUMMARY.md"
grep -q "Bun-Specific Tests" tests/README.md && echo "  ✅ README.md updated with Bun tests" || echo "  ❌ README.md not updated"
echo ""

# Check test structure
echo "Test Structure:"
grep -q "import.*bun:test" tests/config.test.ts && echo "  ✅ config.test.ts uses Bun test imports" || echo "  ❌ config.test.ts missing Bun imports"
grep -q "import.*bun:test" tests/bun-integration.test.ts && echo "  ✅ bun-integration.test.ts uses Bun test imports" || echo "  ❌ bun-integration.test.ts missing Bun imports"
grep -q "import.*bun:test" tests/bun-performance.test.ts && echo "  ✅ bun-performance.test.ts uses Bun test imports" || echo "  ❌ bun-performance.test.ts missing Bun imports"
echo ""

# Check for key test patterns
echo "Key Test Patterns:"
grep -q "detectProjectType(tempDir)" tests/config.test.ts && echo "  ✅ Project type detection tests present" || echo "  ❌ Missing detection tests"
grep -q "getDevContainerTemplate('bun')" tests/devcontainer-templates.test.ts && echo "  ✅ Template generation tests present" || echo "  ❌ Missing template tests"
grep -q "performance.now()" tests/bun-performance.test.ts && echo "  ✅ Performance measurement present" || echo "  ❌ Missing performance measurement"
grep -q "bun-typescript-api" tests/bun-integration.test.ts && echo "  ✅ Example validation tests present" || echo "  ❌ Missing example validation"
echo ""

echo "=== Validation Complete ==="
echo ""
echo "Total test cases: $(( $(grep -c 'test(' tests/config.test.ts) + $(grep -c 'it(' tests/devcontainer-templates.test.ts) + $(grep -c 'test(' tests/bun-integration.test.ts) + $(grep -c 'test(' tests/bun-performance.test.ts) ))"
echo ""
echo "To run tests:"
echo "  npm test tests/config.test.ts"
echo "  npm test tests/devcontainer-templates.test.ts"
echo "  npm test tests/bun-integration.test.ts"
echo "  npm test tests/bun-performance.test.ts"
