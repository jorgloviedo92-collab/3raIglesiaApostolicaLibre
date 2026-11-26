# Sincroniza la carpeta del proyecto con GitHub (rama main), en ambos sentidos.
#
#   cambios en la carpeta  -> pruebas -> commit -> push
#   cambios en GitHub      -> se traen a la carpeta (rebase; nunca se pisa nada)
#
# Se ejecuta de dos formas:
#   -Modo hook   al terminar cada respuesta de Claude (hook Stop de .claude/settings.json)
#   -Modo tarea  cada 2 min desde la tarea de Windows "EcclesiaSoft Sincronizar GitHub"
#                (vía sincronizar-oculto.vbs). Espera si algún archivo cambió hace menos de 60 s.
#
# -SinSubir: simulacro. Revisa y muestra qué haría, sin hacer commit ni push.
# Seguridad: no usa force; si hay conflicto o fallan las pruebas, no publica y lo deja en sincronizacion.log.
param(
  [ValidateSet('hook', 'tarea')][string]$Modo = 'tarea',
  [switch]$SinSubir
)

$ErrorActionPreference = 'Continue'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$log = Join-Path $PSScriptRoot 'sincronizacion.log'
Set-Location $repo

function Escribir-Log([string]$msg) {
  $linea = '{0}  [{1}]  {2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Modo, $msg
  Add-Content -Path $log -Value $linea -Encoding utf8
  if ((Get-Item $log).Length -gt 200KB) { (Get-Content $log -Tail 300) | Set-Content $log -Encoding utf8 }
}
# Ejecuta git y devuelve su salida; el código de salida queda en $script:rc
function G { $out = & git @args 2>&1 | ForEach-Object { "$_" }; $script:rc = $LASTEXITCODE; return $out }
# En modo hook, un aviso visible para el usuario; en modo tarea solo queda en el log
function Avisar([string]$msg) {
  Escribir-Log $msg
  if ($Modo -eq 'hook') { Write-Output (ConvertTo-Json @{ systemMessage = "Sincronización GitHub: $msg" } -Compress) }
}

# Una sola sincronización a la vez (hook y tarea pueden coincidir)
$mutex = New-Object System.Threading.Mutex($false, 'Global\EcclesiaSoftSincronizarGitHub')
if (-not $mutex.WaitOne(0)) { exit 0 }
try {
  $rama = (G rev-parse --abbrev-ref HEAD) -join ''
  if ($rama -ne 'main') { Escribir-Log "Omitido: la carpeta está en la rama '$rama', no en main."; exit 0 }
  $gitDir = (G rev-parse --git-dir) -join ''
  foreach ($m in 'rebase-merge', 'rebase-apply', 'MERGE_HEAD') {
    if (Test-Path (Join-Path $gitDir $m)) { Avisar "Hay una operación de git a medias ($m); no se sincroniza hasta resolverla."; exit 0 }
  }

  # ── 1. Cambios locales ─────────────────────────────────────────────
  $estado = @(G status --porcelain)
  if ($estado.Count -gt 0) {
    if ($Modo -eq 'tarea') {
      $reciente = $estado | ForEach-Object {
        $ruta = $_.Substring(3).Trim('"')
        $arch = Join-Path $repo $ruta
        if (Test-Path $arch -PathType Leaf) { Get-Item $arch }
      } | Where-Object { ((Get-Date) - $_.LastWriteTime).TotalSeconds -lt 60 }
      if ($reciente) { exit 0 }   # se está editando: la próxima vuelta lo toma
    }

    # Sintaxis de todos los .js y pruebas automáticas antes de publicar
    $fallos = @()
    $scripts = @(Get-ChildItem -Path (Join-Path $repo 'js') -Filter *.js -Recurse)
    $sw = Join-Path $repo 'sw.js'
    if (Test-Path $sw) { $scripts += Get-Item $sw }
    $scripts | ForEach-Object {
      $r = & node --check $_.FullName 2>&1
      if ($LASTEXITCODE -ne 0) { $fallos += "Sintaxis: $($_.FullName.Substring($repo.Length + 1)): $(($r | Select-Object -First 1))" }
    }
    if (-not $fallos) {
      $pruebas = & npm test 2>&1
      if ($LASTEXITCODE -ne 0) { $fallos += 'Fallan las pruebas (npm test): ' + (($pruebas | Select-String '✖|fail' | Select-Object -First 3) -join ' | ') }
    }
    if ($fallos) { Avisar ('NO se publicó. ' + ($fallos -join ' / ')); exit 0 }

    if ($SinSubir) {
      Escribir-Log ("Simulacro: se haría commit de {0} archivo(s):`n    {1}" -f $estado.Count, ($estado -join "`n    "))
    } else {
      G add -A | Out-Null
      $resumen = (G diff --cached --name-only | Select-Object -First 3) -join ', '
      $msg = "Actualización automática ($(Get-Date -Format 'yyyy-MM-dd HH:mm')): $resumen"
      G commit -q -m $msg | Out-Null
      if ($script:rc -ne 0) { Avisar 'No se pudo hacer commit.'; exit 0 }
      Escribir-Log "Commit: $msg"
    }
  }

  # ── 2. Traer lo de GitHub ──────────────────────────────────────────
  G fetch origin main | Out-Null
  if ($script:rc -ne 0) { Escribir-Log 'Sin conexión con GitHub; se reintenta luego.'; exit 0 }
  $atras = [int]((G rev-list --count 'HEAD..origin/main') -join '')
  if ($atras -gt 0 -and -not $SinSubir) {
    $r = G rebase origin/main
    if ($script:rc -ne 0) {
      G rebase --abort | Out-Null
      Avisar "CONFLICTO: tus cambios y los de GitHub tocan lo mismo. No se publicó nada; hay que unirlos a mano. ($($r | Select-Object -Last 1))"
      exit 0
    }
    Escribir-Log "Se trajeron $atras commit(s) de GitHub."
  } elseif ($atras -gt 0) { Escribir-Log "Simulacro: se traerían $atras commit(s) de GitHub." }

  # ── 3. Subir ───────────────────────────────────────────────────────
  $adelante = [int]((G rev-list --count 'origin/main..HEAD') -join '')
  if ($adelante -gt 0) {
    if ($SinSubir) { Escribir-Log "Simulacro: se subirían $adelante commit(s)."; exit 0 }
    $r = G push origin main
    if ($script:rc -ne 0) { Avisar "No se pudo subir a GitHub: $($r | Select-Object -Last 1)"; exit 0 }
    Escribir-Log "Subido a GitHub ($adelante commit(s))."
    if ($Modo -eq 'hook') { Write-Output (ConvertTo-Json @{ systemMessage = "Sincronización GitHub: cambios subidos ($adelante commit)." } -Compress) }
  }
}
finally { $mutex.ReleaseMutex() }
