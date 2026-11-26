# EcclesiaSoft Pro

Sistema de gestión eclesiástica (miembros, aportes, caja, eventos y reportes). Aplicación web estática: se abre `index.html` desde un servidor web o directamente desde el navegador. El backend es un Google Apps Script que se configura en la pantalla de acceso.

## Estructura

```
index.html                  Marcado HTML y orden de carga
css/
  base.css                  Tipografía y estilos generales
  login.css                 Pantalla de acceso
  tailwind.css              Tailwind generado (no editar a mano)
  glassy-sidebar.css        Barra lateral
  events-agenda.css         Agenda de eventos
  pro-layer.css             Capa de refinamiento visual
js/
  core/      state.js (estado global) · utils.js (fechas, montos, escape) · ui.js (diálogos, avisos) · api.js (login, fetchAPI, sincronización)
  members/   form-logic.js · save.js (guardado y validación de fichas) · trash.js (papelera) · expediente.js
  finance/   finance.js (aportes y caja)
  views/     directory.js (directorio) · dashboard.js (resumen y gráficos)
  reports/   reports.js
  modules/   reports-certificates.js · person-search.js · events-agenda.js
  ui/        login-ui.js · glassy-sidebar.js
  main.js    Arranque: eventos de la página
```

## Importante

- Son scripts clásicos (no módulos ES) que comparten el ámbito global: **el orden de los `<script>` en `index.html` importa**. `core/` va primero y `main.js` al final de ese bloque.
- Funciona igual abierto con `file://` y desde un servidor web.
