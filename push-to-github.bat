@echo off
echo Pushing fixed code to GitHub...
echo.

REM Add all changes
git add -A

REM Commit with descriptive message
git commit -m "Fix: Convert reportController exports to proper format - resolves handler must be a function error"

REM Push to GitHub (you may need to change 'main' to 'master' depending on your branch)
git push origin main

echo.
echo Done! Check Render dashboard for automatic redeployment.
echo If push failed, make sure to set remote origin first:
echo git remote add origin YOUR_GITHUB_URL
pause
