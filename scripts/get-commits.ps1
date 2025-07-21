<#
.SYNOPSIS
    Gets git commit history and writes it to a file.
.DESCRIPTION
    This script retrieves the git log from a specific commit hash to the current HEAD,
    excluding merge commits. The output, including commit notes, is written to a local file.
#>

# --- Settings ---
# Replace 'your-commit-hash-here' with your starting commit hash
$StartCommitHash = '93442c2caa0d2053425d9ec0484dfa6afdf87579'
# Set the output file name
$OutputFile = "./scripts/commit_log.txt"
# --- End of settings ---

# Set the console's output encoding to UTF-8 to correctly handle characters from git
[System.Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "Generating commit log and writing to $OutputFile..."
Write-Host "-------------------------------------------------"

# Use splatting to pass arguments to the git command
$gitArgs = @(
    'log',
    '--no-merges',
    "$StartCommitHash^..HEAD",
    '--pretty=format:* %h %s (%an, %ar)%n%n%b%n==================================================%n'
)

# Execute the git command, redirecting all output streams (including errors) to the $output variable
$output = & git @gitArgs 2>&1

# Check if the command executed successfully
if ($LASTEXITCODE -eq 0) {
    # On success, write the captured output to the specified file using Set-Content for robust encoding.
    Set-Content -Path $OutputFile -Value $output -Encoding UTF8
    Write-Host "Successfully generated commit log at: $OutputFile" -ForegroundColor Green
}
else {
    # On failure, display an error message along with the output from git
    Write-Host ""
    Write-Host "ERROR: Git command failed. See details below." -ForegroundColor Red
    Write-Host "----------------- GIT OUTPUT -----------------"
    Write-Host $output
    Write-Host "----------------------------------------------"
}

Write-Host "-------------------------------------------------"
Write-Host "Done." 
