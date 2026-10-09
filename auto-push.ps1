$repo = 'C:\Users\user\Desktop\aisite'
$branch = 'main'

function Write-Status($msg) {
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Write-Host "[$timestamp] $msg"
}

Write-Status "Auto-sync started for $repo"

while ($true) {
    try {
        $status = git -C $repo status --porcelain
        if ($status) {
            git -C $repo add .
            $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
            git -C $repo commit -m "Auto-commit $stamp" --no-verify

            if ($LASTEXITCODE -eq 0) {
                git -C $repo push origin $branch
                if ($LASTEXITCODE -eq 0) {
                    Write-Status 'Changes pushed to GitHub'
                }
                else {
                    Write-Status 'Push failed. Will retry next cycle.'
                }
            }
            else {
                Write-Status 'Commit failed or no changes to commit.'
            }
        }
    }
    catch {
        Write-Status "Error: $($_.Exception.Message)"
    }

    Start-Sleep -Seconds 10
}
