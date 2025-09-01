# PowerShell script to push fixed code to GitHub
Write-Host "Deploying Backend Fix to GitHub..." -ForegroundColor Green
Write-Host ""

# Check if git is initialized
if (!(Test-Path .git)) {
    Write-Host "Initializing git repository..." -ForegroundColor Yellow
    git init
}

# Add all changes
Write-Host "Adding all changes..." -ForegroundColor Yellow
git add -A

# Commit changes
Write-Host "Committing changes..." -ForegroundColor Yellow
git commit -m "CRITICAL FIX: Convert all reportController functions to exports.functionName format - fixes TypeError handler must be a function on Render deployment"

# Check if remote exists
$remotes = git remote
if (!$remotes) {
    Write-Host "" -ForegroundColor Red
    Write-Host "ERROR: No git remote configured!" -ForegroundColor Red
    Write-Host "" 
    Write-Host "Please run this command with your GitHub repository URL:" -ForegroundColor Yellow
    Write-Host "git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Then run: git push origin main" -ForegroundColor Cyan
} else {
    Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
    
    # Try to push to main branch
    git push origin main 2>$null
    if ($LASTEXITCODE -ne 0) {
        # If main fails, try master
        Write-Host "Trying master branch..." -ForegroundColor Yellow
        git push origin master
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "" -ForegroundColor Green
        Write-Host "SUCCESS! Code pushed to GitHub" -ForegroundColor Green
        Write-Host "Render will automatically redeploy in a few minutes" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
