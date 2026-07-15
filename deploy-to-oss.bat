@echo off
chcp 65001 >nul
echo ================================================
echo Wenyan Platform - OSS Deployment Script
echo ================================================
echo.

cd /d e:\cpp_discipline\wenyan-platform

echo [%date% %time%] Starting deployment...
echo.

echo Step 1: Upload audio files
echo -------------------------------
"D:\ossutil-2.2.0-windows-amd64\ossutil-2.2.0-windows-amd64\ossutil.exe" cp dist\audio\ oss://classic-chinese/audio/ -rf -j 10 --retry-times 3 --output-dir=ossutil_output

echo.
echo Step 2: Upload video files
echo -------------------------------
"D:\ossutil-2.2.0-windows-amd64\ossutil-2.2.0-windows-amd64\ossutil.exe" cp dist\video\ oss://classic-chinese/video/ -rf -j 10 --retry-times 3 --output-dir=ossutil_output

echo.
echo Step 3: Upload other files (html, assets)
echo -------------------------------
"D:\ossutil-2.2.0-windows-amd64\ossutil-2.2.0-windows-amd64\ossutil.exe" cp dist\index.html oss://classic-chinese/ --output-dir=ossutil_output
"D:\ossutil-2.2.0-windows-amd64\ossutil-2.2.0-windows-amd64\ossutil.exe" cp dist\assets\ oss://classic-chinese/assets/ -rf -j 10 --retry-times 3 --output-dir=ossutil_output

echo.
echo ================================================
echo [%date% %time%] Deployment completed!
echo ================================================
echo.
echo Check reports in: ossutil_output\

pause