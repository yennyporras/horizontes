# Arranque en Windows · Horizontes · rondas 100 % autónomas

Todo se escribe en **Windows PowerShell**, una línea a la vez (en PowerShell 5.1 no existe `&&`).

## 0. Requisitos (una vez)
```powershell
git --version
claude --version
```
- Si `claude` no existe: `irm https://claude.ai/install.ps1 | iex`, cierra y abre PowerShell, escribe `claude`, inicia sesión con la cuenta del equipo y sal con `/exit`.
- Identidad de git (si nunca la configuraste):
```powershell
git config --global user.name "Paola Porras"
git config --global user.email "tu-correo@estratek.com.co"
git config --global core.autocrlf false
```

## 1. Crear el repo
```powershell
cd $HOME
git clone <URL-del-repo-IRMI> irmi
Expand-Archive "$HOME\Downloads\horizontes-kit-v3.zip" -DestinationPath "$HOME\horizontes"
cd $HOME\horizontes
Get-ChildItem -Recurse | Unblock-File
git init -b main
git add -A
git commit -m "Kit de arranque Horizontes"
```

## 2. Secretos
```powershell
@"
SUPERADMIN_USUARIO=paola
SUPERADMIN_CLAVE=CAMBIA_ESTA_CLAVE
POLITICA_PRIVACIDAD_URL=https://URL-politica-datos-estratek
BASE_URL=https://staging-horizontes.estratek.com.co
"@ | Set-Content -Encoding ASCII .env
notepad .env
```
En el bloc de notas completa la clave, la URL de la política y agrega los datos de BD y acceso SSH/FTP de Hostinger que use el IRMI. Guarda y cierra. Pide en Hostinger los subdominios `horizontes` y `staging-horizontes` con SSL.

## 3. Preparar las 4 terminales
```powershell
powershell -ExecutionPolicy Bypass -File .\tools\preparar.ps1
```

## 4. Lanzar cada bloque
```powershell
powershell -ExecutionPolicy Bypass -File .\tools\lanzar.ps1 -Rondas R0,R1
```
Se abren 4 ventanas (T1 a T4) y una de integración. No las cierres; puedes minimizarlas. Cuando la de integración muestre el reporte, lanzas el siguiente bloque: `-Rondas R2`, luego `-Rondas R3`, luego `-Rondas R4`.

## 5. Control
```powershell
powershell -ExecutionPolicy Bypass -File .\tools\estado.ps1 -R R1
powershell -ExecutionPolicy Bypass -File .\tools\parar.ps1
```
El computador debe quedar encendido y sin suspensión durante cada bloque (Configuración > Sistema > Inicio/apagado y suspensión > Nunca).
