param(
  [string]$PicocDir = ".\third_party\picoc"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $PicocDir)) {
  throw "PicoC source directory not found: $PicocDir"
}

$Runner = ".\wasm\picoc_runner.c"
if (-not (Test-Path $Runner)) {
  throw "Bridge entry file not found: $Runner"
}

$OutputDir = ".\public\wasm"
if (-not (Test-Path $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$PicocSources = @(
  "table.c",
  "lex.c",
  "parse.c",
  "expression.c",
  "heap.c",
  "type.c",
  "variable.c",
  "clibrary.c",
  "platform.c",
  "include.c",
  "debug.c",
  "platform/platform_unix.c",
  "platform/library_unix.c",
  "cstdlib/stdio.c",
  "cstdlib/math.c",
  "cstdlib/string.c",
  "cstdlib/stdlib.c",
  "cstdlib/time.c",
  "cstdlib/errno.c",
  "cstdlib/ctype.c",
  "cstdlib/stdbool.c"
) | ForEach-Object { Join-Path $PicocDir $_ }

if (-not $PicocSources.Count) {
  throw "No PicoC source files were found."
}

$MissingSources = $PicocSources | Where-Object { -not (Test-Path $_) }
if ($MissingSources.Count) {
  throw "Missing PicoC source files:`n$($MissingSources -join "`n")"
}

$Output = Join-Path $OutputDir "picoc.js"

$EmccArgs = @(
  $Runner
)
$EmccArgs += $PicocSources
$EmccArgs += @(
  "-I", $PicocDir,
  "-DUNIX_HOST",
  "-D__EMSCRIPTEN__",
  "-O2",
  "-s", "WASM=1",
  "-s", "MODULARIZE=1",
  "-s", "EXPORT_ES6=1",
  "-s", "EXPORT_NAME=createPicoCModule",
  "-s", "ENVIRONMENT=web",
  "-s", "ASYNCIFY",
  "-s", "ALLOW_MEMORY_GROWTH=1",
  "-s", "NO_EXIT_RUNTIME=1",
  "-s", "EXPORTED_FUNCTIONS=['_run_source','_run_source_debug']",
  "-s", "EXPORTED_RUNTIME_METHODS=['ccall','cwrap','FS']",
  "-o", $Output
)

& emcc @EmccArgs

if ($LASTEXITCODE -ne 0) {
  throw "emcc failed to build PicoC."
}

Write-Host "PicoC WASM written to $Output"
