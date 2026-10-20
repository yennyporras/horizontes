# Migración del repo a la cuenta corporativa de GitHub (acta A11)

Hoy el código vive en `github.com/yennyporras/horizontes` (privado, rama `main`). Pasa a la organización de Estratek en GitHub. **Lo hace Paola.** Ningún secreto está en el repo: las claves viven en Coolify y en `deploy/.env.deploy` (que no se sube), así que no hay que mover claves por git.

Antes de empezar: avisa al equipo para que nadie publique en `main` durante el cambio (los scripts de `tools/` publican `main` en `origin`).

En los pasos, `<org>` es el nombre de la organización (por ejemplo `estratek`).

## 1. Organización
1. github.com → avatar → **Your organizations** → **New organization** → el plan aprobado → nombre `<org>`, correo de contacto corporativo, "My company: Estratek S.A.S.".
2. **People** → **Invite member**: Paola como **Owner**; el resto con el rol que corresponda. Nadie más necesita ser owner.

## 2. Mover el repo (elige una opción)

**Opción A · Transferir (recomendada).** Conserva historial, ramas y redirige la URL vieja.
1. `github.com/yennyporras/horizontes` → **Settings** → **General** → **Danger Zone** → **Transfer ownership**.
2. New owner: `<org>`. Escribe `yennyporras/horizontes` para confirmar → **I understand, transfer this repository**.

**Opción B · Espejar.** Deja el repo personal intacto (útil si se quiere conservar como respaldo).
1. En `<org>`: **New repository** → `horizontes`, **Private**, sin README ni .gitignore.
2. En tu equipo, en una carpeta temporal:
   ```sh
   git clone --mirror https://github.com/yennyporras/horizontes.git
   cd horizontes.git
   git push --mirror https://github.com/<org>/horizontes.git
   ```
3. Repo viejo → **Settings** → **Archive this repository**, para que nadie siga subiendo ahí.

## 3. Apuntar los clones al repo nuevo
En `C:\Users\ypaol\horizontes` (las copias de trabajo adicionales comparten su `.git`: basta una vez):
```sh
git remote set-url origin https://github.com/<org>/horizontes.git
git remote -v        # debe mostrar <org>/horizontes en fetch y push
git fetch origin
```
Repítelo en cualquier otro equipo que tenga un clon.

## 4. Coolify (GitHub App)
Coolify construye desde GitHub con la GitHub App `coolify-estratek`.
1. Coolify → **Sources** → `coolify-estratek`. Si la App pertenece a la cuenta personal y no puede instalarse en `<org>`, crea otra: **Sources** → **+ Add** → **GitHub App** → *Organization*: `<org>` → **Register** y sigue el asistente.
2. Instálala en la organización: desde esa misma pantalla, **Install Repositories on GitHub** (o en GitHub: `<org>` → **Settings** → **GitHub Apps** → la App → **Configure**) → **Only select repositories** → `horizontes` → **Save**.
3. En cada app de Horizontes (`horizontes-staging` y `horizontes-prod`) → **Configuration** → **General** → **Source**: la App de la organización y el repo `<org>/horizontes`, rama `main` → **Save**.
4. **Deploy** en staging y revisa el log del build: debe clonar desde `<org>/horizontes`.

## 5. Secretos y accesos
- Variables de Coolify (`SESSION_SECRET`, `SUPERADMIN_CLAVE`, `BASE_URL`…): no cambian, no están en GitHub.
- `deploy/.env.deploy` en tu equipo: no cambia (habla con Coolify, no con GitHub).
- GitHub Actions: el repo no usa (no hay carpeta `.github`). Si más adelante se agregan, sus secretos se crean en `<org>` → **Settings** → **Secrets and variables** → **Actions**.
- Repo nuevo → **Settings** → **Collaborators and teams**: da acceso por equipos de la organización, no por personas sueltas.
- Revoca los tokens personales de GitHub que se hayan usado para empujar a `yennyporras/horizontes` y crea uno nuevo (o usa la sesión de GitHub Desktop / `gh auth login`) con la cuenta que tenga acceso a `<org>`.

## 6. Proteger `main`
Desde la versión 1.0.0 todo cambio entra a `main` por pull request con la CI en verde (ver `README.md`, «Flujo de trabajo»).
1. Repo → **Settings** → **Rules** → **Rulesets** → **New branch ruleset**: nombre `main`, **Enforcement: Active**, *Target branches* → **Include default branch**.
2. Marca **Restrict deletions**, **Block force pushes** y **Require a pull request before merging** (1 aprobación).
3. **Bypass list**: agrega a Paola (Owner) solo si necesita publicar sin PR en una emergencia.
4. **Create**.

## 7. Verificar
1. Un cambio pequeño en una rama → PR → merge a `main` → staging despliega solo (Auto Deploy) desde `<org>/horizontes`.
2. `tools/deploy.sh diagnostico staging` en verde.
3. Actualiza la URL del repo en `docs/ENTREGA.md` y `deploy/README.md`.
