# WebStat Native Messaging Host — Windows Installer
# Usage:
#   .\install.ps1                              # Install (update extension ID later)
#   .\install.ps1 -ExtensionId <id>            # Install with extension ID
#   .\install.ps1 -Uninstall                   # Remove
#
# Run from the native-host directory.

param(
    [string]$ExtensionId = "",
    [switch]$Uninstall
)

$HostName = "com.webstat.host"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$HostPath = Join-Path $ScriptDir "host.js"

# Find node.exe
$NodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $NodePath) {
    Write-Host "Error: Node.js not found. Install it from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# We need a wrapper batch file because Chrome launches the path directly
# and host.js needs node to run it
$WrapperPath = Join-Path $ScriptDir "host.bat"

# Registry paths
$ChromeRegKey = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName"
$EdgeRegKey = "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$HostName"
$ManifestPath = Join-Path $ScriptDir "$HostName.json"

if ($Uninstall) {
    Write-Host "Uninstalling $HostName..."
    Remove-Item -Path $ChromeRegKey -ErrorAction SilentlyContinue
    Remove-Item -Path $EdgeRegKey -ErrorAction SilentlyContinue
    Remove-Item -Path $ManifestPath -ErrorAction SilentlyContinue
    Remove-Item -Path $WrapperPath -ErrorAction SilentlyContinue
    Write-Host "Done." -ForegroundColor Green
    exit 0
}

# Build allowed_origins
$Origins = @()
if ($ExtensionId) {
    $Origins += "chrome-extension://$ExtensionId/"
}

# Create the wrapper batch file (Chrome needs an executable, not a .js)
$WrapperContent = "@echo off`r`n`"$NodePath`" `"$HostPath`" %*"
Set-Content -Path $WrapperPath -Value $WrapperContent -Encoding ASCII

# Create native messaging manifest
$Manifest = @{
    name = $HostName
    description = "WebStat system monitoring native host"
    path = $WrapperPath
    type = "stdio"
    allowed_origins = $Origins
} | ConvertTo-Json -Depth 3

Set-Content -Path $ManifestPath -Value $Manifest -Encoding UTF8

# Register in registry for Chrome
$ParentKey = Split-Path $ChromeRegKey -Parent
if (-not (Test-Path $ParentKey)) {
    New-Item -Path $ParentKey -Force | Out-Null
}
New-Item -Path $ChromeRegKey -Force | Out-Null
Set-ItemProperty -Path $ChromeRegKey -Name "(Default)" -Value $ManifestPath

Write-Host "Installed for Chrome: $ChromeRegKey" -ForegroundColor Green

# Also register for Edge (same Chromium base)
$EdgeParent = Split-Path $EdgeRegKey -Parent
if (-not (Test-Path $EdgeParent)) {
    New-Item -Path $EdgeParent -Force | Out-Null
}
New-Item -Path $EdgeRegKey -Force | Out-Null
Set-ItemProperty -Path $EdgeRegKey -Name "(Default)" -Value $ManifestPath

Write-Host "Installed for Edge:   $EdgeRegKey" -ForegroundColor Green

Write-Host ""
if (-not $ExtensionId) {
    Write-Host "Warning: No extension ID provided." -ForegroundColor Yellow
    Write-Host "After loading the extension, run:" -ForegroundColor Yellow
    Write-Host "  .\install.ps1 -ExtensionId <your-extension-id>" -ForegroundColor Cyan
} else {
    Write-Host "Configured for extension ID: $ExtensionId" -ForegroundColor Green
    Write-Host "Restart Chrome/Edge for changes to take effect."
}
