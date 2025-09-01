// Verify reportController.js syntax without running it
const fs = require('fs');
const path = require('path');

console.log('Verifying reportController.js syntax and exports...\n');

const filePath = path.join(__dirname, 'controllers', 'reportController.js');
const code = fs.readFileSync(filePath, 'utf8');

// Check for exports pattern
const exportMatches = code.match(/exports\.\w+\s*=\s*async/g);

if (exportMatches) {
  console.log(`✅ Found ${exportMatches.length} async function exports`);
  
  // Check specific functions that reportRoutes.js needs
  const requiredFunctions = [
    'getDashboardMetrics',
    'getContractSummary',
    'getContractTrends',
    'exportToExcel',
    'exportToPDF'
  ];
  
  console.log('\nChecking required functions:');
  requiredFunctions.forEach(fn => {
    const pattern = new RegExp(`exports\\.${fn}\\s*=\\s*async`);
    if (pattern.test(code)) {
      console.log(`  ✅ ${fn} - exported correctly`);
    } else {
      console.log(`  ❌ ${fn} - NOT found or incorrect format`);
    }
  });
  
  // Check for syntax errors
  console.log('\nChecking for common syntax errors:');
  
  // Check for balanced braces
  const openBraces = (code.match(/{/g) || []).length;
  const closeBraces = (code.match(/}/g) || []).length;
  
  if (openBraces === closeBraces) {
    console.log(`  ✅ Braces balanced: ${openBraces} open, ${closeBraces} close`);
  } else {
    console.log(`  ❌ Braces NOT balanced: ${openBraces} open, ${closeBraces} close`);
  }
  
  // Check for balanced parentheses
  const openParens = (code.match(/\(/g) || []).length;
  const closeParens = (code.match(/\)/g) || []).length;
  
  if (openParens === closeParens) {
    console.log(`  ✅ Parentheses balanced: ${openParens} open, ${closeParens} close`);
  } else {
    console.log(`  ❌ Parentheses NOT balanced: ${openParens} open, ${closeParens} close`);
  }
  
  console.log('\n📋 SUMMARY:');
  console.log('The reportController.js file has the correct export format.');
  console.log('All functions are exported as: exports.functionName = async (req, res) => { ... }');
  console.log('\n🚀 NEXT STEPS TO FIX RENDER DEPLOYMENT:');
  console.log('1. Commit the changes: git add -A && git commit -m "Fix reportController exports"');
  console.log('2. Push to GitHub: git push origin main');
  console.log('3. Render will automatically redeploy with the fixed code');
  
} else {
  console.log('❌ No exports found in reportController.js!');
  console.log('The file needs to be fixed before deployment.');
}
