$ErrorActionPreference = "Stop"

param(
    [string]$MongoUri = "mongodb://127.0.0.1:27017",
    [string]$Database = "accountantos",
    [string]$BackupRoot = ".\backups",
    [string]$MongoDumpPath = "mongodump"
)

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$targetDir = Join-Path $BackupRoot $timestamp

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

& $MongoDumpPath --uri=$MongoUri --db=$Database --out=$targetDir

Write-Host "MongoDB backup completed: $targetDir"