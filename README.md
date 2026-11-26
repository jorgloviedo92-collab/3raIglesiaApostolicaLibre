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
  ui/        login-ui.js · glassy-sidebar.js · inline-handlers.js (acciones de botones: data-on-click/change/input)
  main.js    Arranque: eventos de la página
```

## Validaciones

Todas las reglas están en `js/core/validators.js` como funciones puras (sin DOM, sin red y sin reloj: la fecha de hoy llega por parámetro). Los formularios solo leen los campos, llaman a `validate*` y muestran los mensajes. Para cambiar una regla se edita ese archivo y su prueba.

```
npm test        # Node 18+, sin dependencias
```

## Seguridad

- La política de seguridad (CSP) de `index.html` **no permite scripts incrustados** (`'unsafe-inline'` solo se mantiene para estilos). Por eso no se usan atributos `onclick="..."` en el HTML: se escribe `data-on-click="nombre"` y se registra la acción en `js/ui/inline-handlers.js`.
- Todo texto que viene de los datos se inserta con `escapeHtml(...)` al armar HTML.

## Backend (Code.js)

`Code.js` es el backend de Google Apps Script. Puede estar en esta carpeta, pero **no se sube al repositorio** (está en `.gitignore`): se pega a mano en Apps Script y se crea una nueva versión de la implementación. `tests/backend.test.js` lo prueba con servicios de Google simulados y se omite si el archivo no está.

## Importante

- Son scripts clásicos (no módulos ES) que comparten el ámbito global: **el orden de los `<script>` en `index.html` importa**. `core/validators.js` va primero (los demás archivos usan sus funciones) y `main.js` al final de ese bloque.
- Funciona igual abierto con `file://` y desde un servidor web.
