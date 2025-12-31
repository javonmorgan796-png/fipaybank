@echo off
echo ========================================
echo     SETUP FRONTEND FOR RENDER
echo ========================================
echo.

cd /d "C:\Users\DELL\Desktop\fipay"

echo 📍 Working in: %CD%
echo.

echo 1. Removing .env.production from server folder...
del server\.env.production 2>nul

echo 2. Creating .node-version in ROOT...
echo 18.18.0 > .node-version

echo 3. Creating .env.production in ROOT...
echo VITE_API_URL=https://fipaybank.onrender.com > .env.production

echo 4. Updating .gitignore...
echo .env.production >> .gitignore
echo .node-version >> .gitignore

echo 5. Checking package.json for axios...
powershell -Command "
  \$pkg = Get-Content package.json -Raw | ConvertFrom-Json
  if (-not \$pkg.dependencies.axios) {
    \$pkg.dependencies | Add-Member -NotePropertyName 'axios' -NotePropertyValue '^1.6.2' -Force
    \$pkg | ConvertTo-Json -Depth 10 | Set-Content package.json -Encoding UTF8
    echo 'Added axios to package.json'
  } else {
    echo 'axios already in package.json'
  }
"

echo 6. Installing dependencies...
npm install

echo 7. Testing build...
npm run build

echo.
if %ERRORLEVEL% EQU 0 (
  echo ✅ BUILD SUCCESSFUL!
  echo.
  echo 8. Pushing to GitHub...
  git add .
  git commit -m "Setup frontend for Render: .node-version, .env.production"
  git push origin main
  echo.
  echo 🚀 Frontend ready! Render will deploy correctly.
) else (
  echo ❌ Build failed. Check errors above.
)

echo.
pause