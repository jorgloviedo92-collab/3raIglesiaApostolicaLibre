# EcclesiaSoft Pro

Sistema de gestión eclesiástica (miembros, aportes, caja, eventos y reportes). Aplicación web estática: se abre `index.html` desde un servidor web o directamente desde el navegador. El backend es un Google Apps Script que se configura en la pantalla de acceso.

## Estructura

```
index.html                  Marcado HTML y orden de carga
tests/                      Pruebas automáticas de las validaciones
css/
  base.css                  Tipografía y estilos generales
  login.css                 Pantalla de acceso
  tailwind.css              Tailwind generado (no editar a mano)
  glassy-sidebar.css        Barra lateral
  events-agenda.css         Agenda de eventos
  pro-layer.css             Capa de refinamiento visual
js/
  core/      validators.js (reglas de validación, funciones puras) · state.js (estado global) · utils.js (fechas, montos, escape) · ui.js (diálogos, avisos) · api.js (login, fetchAPI, sincronización)
  members/   form-logic.js · save.js (guardado y validación de fichas) · trash.js (papelera) · expediente.js
  finance/   finance.js (aportes y caja)
  views/     directory.js (directorio) · dashboard.js (resumen y gráficos)
  reports/   reports.js
  modules/   reports-certificates.js · person-search.js · events-agenda.js
  ui/        login-ui.js · glassy-sidebar.js
  main.js    Arranque: eventos de la página
```

## Validaciones

Todas las reglas están en `js/core/validators.js` como funciones puras (sin DOM, sin red y sin reloj: la fecha de hoy llega por parámetro). Los formularios solo leen los campos, llaman a `validate*` y muestran los mensajes. Para cambiar una regla se edita ese archivo y su prueba.

```
npm test        # Node 18+, sin dependencias
```

## Importante

- Son scripts clásicos (no módulos ES) que comparten el ámbito global: **el orden de los `<script>` en `index.html` importa**. `core/validators.js` va primero (los demás archivos usan sus funciones) y `main.js` al final de ese bloque.
- Funciona igual abierto con `file://` y desde un servidor web.
