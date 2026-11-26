    // ────────────────────────────────────────────────────────────────────
    // CONFIGURACIÓN DEL SISTEMA
    //
    // FIXED_SERVER_URL: dirección oficial del servidor (Apps Script, termina en /exec).
    //   · Vacía ('')  → el usuario escribe la dirección en el login. Si ya había una guardada y
    //                   escribe otra, el sistema pide confirmación antes de enviar el PIN.
    //   · Con valor   → el sistema SOLO se conecta a esa dirección: el campo del login queda
    //                   bloqueado y cualquier otra dirección se rechaza. Es la opción recomendada:
    //                   evita que alguien engañe a un usuario para que entregue su PIN a otro servidor.
    //
    // Ejemplo: const FIXED_SERVER_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
    // ────────────────────────────────────────────────────────────────────
    const FIXED_SERVER_URL = '';
