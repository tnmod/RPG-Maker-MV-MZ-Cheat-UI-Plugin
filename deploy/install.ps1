$ErrorActionPreference = 'Stop'
$release = Split-Path -Parent $PSScriptRoot
$game = Split-Path -Parent $release
$mvCore = Join-Path $game 'www\js\rpg_core.js'
$mzCore = Join-Path $game 'js\rmmz_core.js'
$isMV = Test-Path -LiteralPath $mvCore -PathType Leaf
$isMZ = Test-Path -LiteralPath $mzCore -PathType Leaf
if ($isMV -eq $isMZ) {
    throw 'Cannot identify a single RPG Maker engine. Put the release folder directly inside the game folder.'
}
$engine = if ($isMV) { 'MV' } else { 'MZ' }
$root = if ($isMV) { Join-Path $game 'www' } else { $game }
$core = if ($isMV) { $mvCore } else { $mzCore }
$version = [regex]::Match([IO.File]::ReadAllText($core), 'RPGMAKER_VERSION\s*=\s*["'']([^"'']+)').Groups[1].Value
if (!$version) { $version = 'unknown' }
$name = Split-Path -Leaf $game
$index = Join-Path $root 'index.html'
if (Test-Path -LiteralPath $index -PathType Leaf) {
    $title = [regex]::Match([IO.File]::ReadAllText($index), '(?is)<title[^>]*>(.*?)</title>').Groups[1].Value.Trim()
    if ($title) { $name = [Net.WebUtility]::HtmlDecode($title) }
}
$packages = @(Get-ChildItem -LiteralPath $PSScriptRoot -Directory -Filter "rpg-$engine-cheat-*-core")
if ($packages.Count -ne 1) { throw "Missing or ambiguous $engine payload." }
$payload = if ($isMV) { Join-Path $packages[0].FullName 'www' } else { $packages[0].FullName }
$releaseVersionFile = Join-Path $payload 'cheat-version-description.json'
$releaseVersion = [string](Get-Content -LiteralPath $releaseVersionFile -Raw | ConvertFrom-Json).version
$main = Join-Path $root 'js\main.js'
$backup = "$main.rpg-cheat.bak"
$indexBackup = "$index.rpg-cheat.bak"
$cheat = Join-Path $root 'cheat'
$marker = Join-Path $cheat '.rpg-cheat-installed'
$mods = Join-Path $root 'mods'
$modFolder = Join-Path $mods 'RpgMakerCheatUI'
$modMarker = Join-Path $modFolder '.rpg-cheat-installed'
$modLoader = Join-Path $mods '_loader\core.js'
$modBootstrap = Join-Path $PSScriptRoot 'ModLoaderBootstrap.js'
function Test-NativeLoader {
    if (!$isMZ -or !(Test-Path -LiteralPath $main -PathType Leaf) -or
        !(Test-Path -LiteralPath $modLoader -PathType Leaf) -or
        !(Test-Path -LiteralPath $modBootstrap -PathType Leaf)) { return $false }
    $loader = [IO.File]::ReadAllText($modLoader)
    return [IO.File]::ReadAllText($main) -match '\bloadMods\s*\(' -and
        $loader.Contains('function modPlugins(mod)') -and $loader.Contains('PluginManager.makeUrl = function')
}
$nativeLoader = Test-NativeLoader
$encoding = [Text.Encoding]::GetEncoding(28591)
$hook = @'
<!-- rpg-cheat-ui:start -->
<script>
window.addEventListener('load', function () {
    var deadline = Date.now() + 300000;
    var timer = setInterval(function () {
        if (Date.now() >= deadline) { clearInterval(timer); return; }
        if (typeof SceneManager === 'undefined' || !SceneManager._scene) return;
        clearInterval(timer);
        var script = document.createElement('script');
        script.src = 'cheat/init/import.js';
        document.body.appendChild(script);
    }, 100);
});
</script>
<!-- rpg-cheat-ui:end -->
'@
$hook = $hook.Replace("`r`n", "`n") + "`n"

function Get-RegularEntry($path, [bool]$directory = $false) {
    $entry = Get-Item -LiteralPath $path -Force
    if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $entry.PSIsContainer -ne $directory) {
        throw "Unexpected file type or linked path: $path"
    }
    return $entry
}

function Confirm-GamePaths {
    Get-RegularEntry $game $true | Out-Null
    Get-RegularEntry $root $true | Out-Null
    Get-RegularEntry $release $true | Out-Null
    Get-RegularEntry $PSScriptRoot $true | Out-Null
}

function Replace-File($path, [byte[]]$bytes, $recovery) {
    $pending = Join-Path (Split-Path -Parent $path) ('.rpg-cheat-' + [guid]::NewGuid().ToString('N') + '.tmp')
    try {
        [IO.File]::WriteAllBytes($pending, $bytes)
        [IO.File]::Replace($pending, $path, $recovery)
    } finally {
        if ([IO.File]::Exists($pending)) { [IO.File]::Delete($pending) }
    }
}

function Move-CheatAside($destination) {
    $entry = Get-RegularEntry $cheat $true
    if ((Split-Path -Parent $entry.FullName) -ne (Get-Item -LiteralPath $root).FullName -or
        (Split-Path -Parent $destination) -ne (Get-Item -LiteralPath $release).FullName) {
        throw 'Cheat folder or archive is outside the expected directory.'
    }
    [IO.Directory]::Move($entry.FullName, $destination)
}

function New-ModLoaderPayload {
    Get-RegularEntry $mods $true | Out-Null
    Get-RegularEntry (Join-Path $mods '_loader') $true | Out-Null
    Get-RegularEntry $modLoader | Out-Null
    Get-RegularEntry $modBootstrap | Out-Null
    $sourceCheat = Join-Path $payload 'cheat'
    foreach ($file in @('init\import.js', 'init\setup.js', 'css\main.css', 'libs\vue.js', 'libs\vuetify.js')) {
        Get-RegularEntry (Join-Path $sourceCheat $file) | Out-Null
    }
    $metadata = @{
        id = 'RpgMakerCheatUI'
        name = 'RPG Maker Cheat UI'
        type = 'mod'
        version = $releaseVersion -replace '^v', ''
        plugins = @(@{ file = 'js/CheatUIBootstrap.js' })
    }
    $staged = Join-Path $release ('.pending-mod-' + [guid]::NewGuid().ToString('N'))
    $plugins = Join-Path $staged 'js'
    [IO.Directory]::CreateDirectory($plugins) | Out-Null
    Copy-Item -LiteralPath $sourceCheat -Destination (Join-Path $staged 'cheat') -Recurse
    Copy-Item -LiteralPath $modBootstrap -Destination (Join-Path $plugins 'CheatUIBootstrap.js')
    [IO.File]::WriteAllText((Join-Path $staged 'mod.json'), ($metadata | ConvertTo-Json -Depth 4))
    Set-Content -LiteralPath (Join-Path $staged '.rpg-cheat-installed') -Value 'RPG Maker Cheat UI (ModLoader)'
    return $staged
}

function Complete-Deployment($message) {
    $script:closeAfterSuccess = $true
    return $message
}

function Install-ModLoaderCheat {
    $staged = New-ModLoaderPayload
    [IO.Directory]::Move($staged, $modFolder)
    return Complete-Deployment 'Installed as a ModLoader mod. Enable RPG Maker Cheat UI in the Mod Manager if it is disabled.'
}

function Get-VersionParts($text) {
    $match = [regex]::Match($text, '^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([A-Za-z0-9.-]+))?$')
    if (!$match.Success) { return $null }
    return @{
        number = [version]::new([int]$match.Groups[1].Value, [int]$match.Groups[2].Value, [int]$match.Groups[3].Value)
        suffix = $match.Groups[4].Value
    }
}

function Test-NewerVersion($installed) {
    $old = Get-VersionParts $installed
    $new = Get-VersionParts $releaseVersion
    if (!$old -or !$new) { return $false }
    if ($new.number -ne $old.number) { return $new.number -gt $old.number }
    if (!$old.suffix) { return $false }
    if (!$new.suffix) { return $true }
    $oldParts = $old.suffix.Split('.')
    $newParts = $new.suffix.Split('.')
    for ($i = 0; $i -lt [Math]::Min($oldParts.Count, $newParts.Count); $i++) {
        $a = $oldParts[$i]
        $b = $newParts[$i]
        if ($a -ceq $b) { continue }
        if ($a -match '^\d+$' -and $b -match '^\d+$') { return [decimal]$b -gt [decimal]$a }
        if ($a -match '^\d+$') { return $true }
        if ($b -match '^\d+$') { return $false }
        return [string]::CompareOrdinal($b, $a) -gt 0
    }
    return $newParts.Count -gt $oldParts.Count
}

function Get-AvailableUpdate {
    try {
        if (Test-Path -LiteralPath $modFolder) {
            Get-RegularEntry $mods $true | Out-Null
            Get-RegularEntry $modFolder $true | Out-Null
            Get-RegularEntry $modMarker | Out-Null
            if ([IO.File]::ReadAllText($modMarker).Trim() -ne 'RPG Maker Cheat UI (ModLoader)') { return }
            $file = Join-Path $modFolder 'mod.json'
            Get-RegularEntry $file | Out-Null
            $installed = [string](Get-Content -LiteralPath $file -Raw | ConvertFrom-Json).version
            if (Test-NewerVersion $installed) {
                return @{ folder = $modFolder; version = $installed; native = $true }
            }
        } elseif (Test-Path -LiteralPath $cheat) {
            Get-RegularEntry $cheat $true | Out-Null
            Get-RegularEntry $marker | Out-Null
            if ([IO.File]::ReadAllText($marker).Trim() -ne 'RPG Maker Cheat UI (HTML hook)') { return }
            $file = Join-Path $cheat 'cheat-version-description.json'
            Get-RegularEntry $file | Out-Null
            $installed = [string](Get-Content -LiteralPath $file -Raw | ConvertFrom-Json).version
            if (Test-NewerVersion $installed) {
                return @{ folder = $cheat; version = $installed; native = $false }
            }
        }
    } catch {
        # Unknown installs can still use the explicit replacement workflow.
    }
}

function Update-Cheat {
    Confirm-GamePaths
    $update = Get-AvailableUpdate
    if (!$update) { throw 'No older, versioned Cheat UI installation was found.' }
    if ($update.native) {
        $staged = New-ModLoaderPayload
    } else {
        $staged = New-HtmlPayload
    }
    $archive = Join-Path $release ('updated-cheat-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
    $entry = Get-RegularEntry $update.folder $true
    $parent = if ($update.native) { $mods } else { $root }
    if ((Split-Path -Parent $entry.FullName) -ne (Get-RegularEntry $parent $true).FullName -or
        (Split-Path -Parent $archive) -ne (Get-RegularEntry $release $true).FullName) {
        throw 'The installed folder or archive is outside the expected directory.'
    }
    [IO.Directory]::Move($entry.FullName, $archive)
    try {
        [IO.Directory]::Move($staged, $update.folder)
    } catch {
        if (!(Test-Path -LiteralPath $update.folder)) { [IO.Directory]::Move($archive, $update.folder) }
        throw
    }
    return Complete-Deployment "Updated $($update.version) to $releaseVersion. Previous version: $archive"
}

function New-HtmlPayload {
    $sourceCheat = Join-Path $payload 'cheat'
    foreach ($file in @('init\import.js', 'init\setup.js', 'css\main.css', 'libs\vue.js', 'libs\vuetify.js')) {
        Get-RegularEntry (Join-Path $sourceCheat $file) | Out-Null
    }
    $staged = Join-Path $release ('.pending-cheat-' + [guid]::NewGuid().ToString('N'))
    Copy-Item -LiteralPath $sourceCheat -Destination $staged -Recurse
    Copy-Item -LiteralPath $releaseVersionFile -Destination $staged
    Set-Content -LiteralPath (Join-Path $staged '.rpg-cheat-installed') -Value 'RPG Maker Cheat UI (HTML hook)'
    return $staged
}

function Read-MenuKey {
    if ([Console]::IsInputRedirected) { return [Console]::ReadLine() }
    return [string][Console]::ReadKey($true).KeyChar
}

function Read-InstallChoice($message, [bool]$canContinue, [bool]$canReplace, $update) {
    Write-Host ''
    Write-Host $message -ForegroundColor Yellow
    if ($canContinue) { Write-Host '1. Continue and keep old files' }
    if ($canReplace) { Write-Host '2. Archive old install and install new version' }
    Write-Host '3. Cancel'
    if ($update) { Write-Host "4. Update $($update.version) to $releaseVersion" }
    return Read-MenuKey
}

function Install-Cheat([bool]$afterReplace = $false) {
    Confirm-GamePaths
    $nativeInstall = Test-Path -LiteralPath $modFolder
    $legacyFiles = (Test-Path -LiteralPath $cheat) -or (Test-Path -LiteralPath $backup) -or
        (Test-Path -LiteralPath $indexBackup)
    if ($nativeInstall -or $legacyFiles) {
        $canContinue = !$nativeInstall -and ($nativeLoader -or
            (!(Test-Path -LiteralPath $cheat) -and !(Test-Path -LiteralPath $indexBackup)))
        $canReplace = Test-Path -LiteralPath $(if ($nativeInstall) { $modMarker } else { $marker }) -PathType Leaf
        if (!$canContinue -and !$canReplace) {
            throw 'Existing files use the same destination and have no installation marker. Move them aside first.'
        }
        if (!$afterReplace -or !$canContinue) {
            $update = Get-AvailableUpdate
            $message = 'Old Cheat UI files or backups were found.'
            if ($canContinue -and $nativeLoader -and $legacyFiles) {
                Get-RegularEntry $main | Out-Null
                Get-RegularEntry $index | Out-Null
                if ([IO.File]::ReadAllText($main) -match 'cheat[/\\]init[/\\]import\.js' -or
                    [IO.File]::ReadAllText($index) -match 'rpg-cheat-ui:|cheat/init/import\.js') {
                    $message += "`nIf you keep the old files, the previous launcher hook may load its Cheat UI first."
                }
            }
            $choice = Read-InstallChoice $message $canContinue $canReplace $update
            if ($choice -eq '4' -and $update) { return Update-Cheat }
            if ($choice -eq '2' -and $canReplace) {
                foreach ($file in @('init\import.js', 'init\setup.js', 'css\main.css', 'libs\vue.js', 'libs\vuetify.js')) {
                    Get-RegularEntry (Join-Path $payload "cheat\$file") | Out-Null
                }
                $removed = Uninstall-Cheat
                $script:nativeLoader = Test-NativeLoader
                try { return "$removed`n$(Install-Cheat $true)" }
                catch { throw "The old installation was archived. The new installation failed: $($_.Exception.Message)" }
            }
            if ($choice -ne '1' -or !$canContinue) {
                return 'Installation canceled.'
            }
        }
    }
    if ($nativeLoader) { return Install-ModLoaderCheat }
    Get-RegularEntry $index | Out-Null
    Get-RegularEntry (Join-Path $root 'js') $true | Out-Null
    Get-RegularEntry $main | Out-Null
    $html = $encoding.GetString([IO.File]::ReadAllBytes($index))
    if ($html -match 'rpg-cheat-ui:|cheat/init/import\.js' -or
        $html -notmatch '(?is)<script\b[^>]*\bsrc\s*=\s*["''](?:\./)?js/main\.js["'']' -or
        $html -notmatch '(?is)</body>\s*</html>\s*$') {
        throw 'This index.html already loads Cheat UI or does not have a supported RPG Maker entry point.'
    }
    $staged = New-HtmlPayload
    $moved = $false
    try {
        if ($encoding.GetString([IO.File]::ReadAllBytes($index)) -cne $html) {
            throw 'index.html changed during installation. Try again after closing the game.'
        }
        [IO.Directory]::Move($staged, $cheat)
        $moved = $true
        $body = [regex]::Match($html, '(?is)</body>\s*</html>\s*$')
        Replace-File $index ($encoding.GetBytes($html.Insert($body.Index, $hook))) $indexBackup
    } catch {
        if ($moved -and $encoding.GetString([IO.File]::ReadAllBytes($index)) -ceq $html) { Move-CheatAside $staged }
        throw
    }
    return Complete-Deployment "Installed through index.html. Backup: $indexBackup"
}

function Uninstall-Cheat {
    Confirm-GamePaths
    if (Test-Path -LiteralPath $modFolder) {
        Get-RegularEntry $mods $true | Out-Null
        $entry = Get-RegularEntry $modFolder $true
        Get-RegularEntry $modMarker | Out-Null
        if ((Split-Path -Parent $entry.FullName) -ne (Get-Item -LiteralPath $mods).FullName -or
            [IO.File]::ReadAllText($modMarker).Trim() -ne 'RPG Maker Cheat UI (ModLoader)') {
            throw 'The ModLoader folder does not belong to this installer.'
        }
        $archive = Join-Path (Get-Item -LiteralPath $release).FullName ('removed-cheat-' + [guid]::NewGuid().ToString('N'))
        [IO.Directory]::Move($entry.FullName, $archive)
        return 'Uninstalled the Cheat UI mod. Other mods were kept.'
    }
    Get-RegularEntry $cheat $true | Out-Null
    Get-RegularEntry $marker | Out-Null
    $installed = [IO.File]::ReadAllText($marker).Trim()
    $archive = Join-Path $release ('removed-cheat-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
    if ($installed -eq 'RPG Maker Cheat UI (HTML hook)') {
        Get-RegularEntry $index | Out-Null
        Get-RegularEntry $indexBackup | Out-Null
        $html = $encoding.GetString([IO.File]::ReadAllBytes($index))
        $start = $html.IndexOf($hook, [StringComparison]::Ordinal)
        if ($start -lt 0 -or $html.IndexOf($hook, $start + $hook.Length, [StringComparison]::Ordinal) -ge 0) {
            throw 'The installed HTML hook was edited. Review index.html and its backup before removing Cheat UI.'
        }
        $recovery = "$archive.index-before-uninstall.html"
        Replace-File $index ($encoding.GetBytes($html.Remove($start, $hook.Length))) $recovery
        try { Move-CheatAside $archive } catch {
            Replace-File $index ([IO.File]::ReadAllBytes($recovery)) "$archive.index-without-hook.html"
            throw
        }
        [IO.File]::Move($indexBackup, (Join-Path $archive 'index.original.html'))
        return 'Uninstalled. Other index.html edits were kept.'
    }
    if ($installed -eq 'RPG Maker Cheat UI') {
        Get-RegularEntry (Join-Path $root 'js') $true | Out-Null
        Get-RegularEntry $main | Out-Null
        Get-RegularEntry $backup | Out-Null
        $recovery = "$archive.main-before-uninstall.js"
        Replace-File $main ([IO.File]::ReadAllBytes($backup)) $recovery
        try { Move-CheatAside $archive } catch {
            Replace-File $main ([IO.File]::ReadAllBytes($recovery)) "$archive.main-restored.js"
            throw
        }
        [IO.File]::Move($backup, (Join-Path $archive 'main.original.js'))
        return 'Legacy installation removed. Original main.js restored.'
    }
    throw 'The cheat folder does not have a recognized installation marker.'
}

$notice = ''
$noticeColor = 'Green'
while ($true) {
    if (![Console]::IsOutputRedirected) { Clear-Host }
    Write-Host 'RPG Maker Cheat UI' -ForegroundColor Cyan
    Write-Host "Game: $name"
    Write-Host "Engine: RPG Maker $engine $version"
    if ($nativeLoader) { Write-Host 'Install method: ModLoader plugin' }
    else { Write-Host 'Install method: index.html hook' }
    if ($notice) {
        Write-Host ''
        Write-Host $notice -ForegroundColor $noticeColor
    }
    Write-Host ''
    Write-Host '1. Install'
    Write-Host '2. Uninstall'
    Write-Host '3. Exit'
    $availableUpdate = Get-AvailableUpdate
    if ($availableUpdate) { Write-Host "4. Update $($availableUpdate.version) to $releaseVersion" }
    if (![Console]::IsInputRedirected) {
        Write-Host 'Press a menu number. Close the game before applying changes.'
    }
    $choice = Read-MenuKey
    if ($null -eq $choice) { exit 0 }
    $noticeColor = 'Green'
    $closeAfterSuccess = $false
    try {
        switch ($choice) {
            '1' { $notice = Install-Cheat }
            '2' { $notice = Uninstall-Cheat }
            '3' { exit 0 }
            '4' { $notice = Update-Cheat }
            default {
                $notice = 'Choose 1, 2, or 3.'
                $noticeColor = 'Yellow'
            }
        }
    } catch {
        $notice = $_.Exception.Message
        $noticeColor = 'Red'
    }
    if ($closeAfterSuccess -and $noticeColor -eq 'Green') {
        Write-Host ''
        Write-Host $notice -ForegroundColor Green
        if (![Console]::IsInputRedirected -and ![Console]::IsOutputRedirected) {
            Write-Host 'Closing in 2 seconds...'
            Start-Sleep -Seconds 2
        }
        exit 0
    }
}
