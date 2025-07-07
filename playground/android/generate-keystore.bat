@echo off
chcp 65001 >nul
echo Generating team shared Android keystore file...
echo.

REM Set variables
set KEYSTORE_PATH=app\keystore\team-release-key.jks
set KEY_ALIAS=team-release-key
set VALIDITY_DAYS=10000

REM Create keystore directory
if not exist "app\keystore" mkdir "app\keystore"

REM Generate keystore file
echo Please enter the following information as prompted:
echo 1. Enter keystore password (recommend using strong password)
echo 2. Confirm keystore password again
echo 3. Enter key password (recommend same as keystore password)
echo 4. Enter your name and organization information
echo.

keytool -genkey -v -keystore %KEYSTORE_PATH% -alias %KEY_ALIAS% -keyalg RSA -keysize 2048 -validity %VALIDITY_DAYS%

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] Keystore file generated successfully!
    echo [FILE] Location: %KEYSTORE_PATH%
    echo [ALIAS] Key alias: %KEY_ALIAS%
    echo.
    echo [IMPORTANT] Please remember:
    echo 1. Update passwords in app\keystore\team-keystore.properties
    echo 2. Keep keystore file and passwords safe
    echo 3. Backup keystore file to secure location
    echo 4. Do not commit passwords to version control
) else (
    echo [ERROR] Keystore generation failed, please check Java environment and permissions
)

echo.
pause