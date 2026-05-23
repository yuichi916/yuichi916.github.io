@echo off
REM Local HTTP server for previewing niwa.html (and other GLB-dependent pages).
REM Open http://localhost:8000/niwa.html after this starts.
cd /d %~dp0
echo === Serving from: %CD%
if not exist niwa.html (
  echo [ERROR] niwa.html not found in %CD%
  echo Make sure serve.bat is in the same folder as niwa.html
  pause
  exit /b 1
)
echo niwa.html: OK. Open http://localhost:8000/niwa.html in your browser.
python -m http.server 8000
pause
