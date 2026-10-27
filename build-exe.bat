@echo off
rem Rebuilds the portable exe. Can be double-clicked; the first run installs the build tools.
cd /d "%~dp0"
if not exist node_modules\electron-builder call npm install --no-audit --no-fund
call npx electron-builder --win portable
if errorlevel 1 (
  echo Build failed.
  pause
  exit /b 1
)
copy /y "dist\OpenSci-Calculator-Portable.exe" "OpenSci-Calculator-Portable.exe" >nul
echo.
echo Built: %~dp0OpenSci-Calculator-Portable.exe
pause
