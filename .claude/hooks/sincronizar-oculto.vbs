' Lanza sincronizar.ps1 sin mostrar ventana (lo usa la tarea de Windows "EcclesiaSoft Sincronizar GitHub").
Set fso = CreateObject("Scripting.FileSystemObject")
carpeta = fso.GetParentFolderName(WScript.ScriptFullName)
CreateObject("WScript.Shell").Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & carpeta & "\sincronizar.ps1"" -Modo tarea", 0, False
