// Esperar a que pywebview esté listo
function esperarPywebview() {
    return new Promise((resolve) => {
        if (typeof pywebview !== 'undefined' && pywebview.api) {
            resolve();
        } else {
            window.addEventListener('pywebviewready', () => resolve());
        }
    });
}

// Verificar sesión al cargar el dashboard
window.addEventListener('DOMContentLoaded', async () => {
    await esperarPywebview();
    try {
        const sesion = await pywebview.api.cargar_sesion();
        if (sesion) {
            const userNameElement = document.getElementById('userName');
            if (userNameElement) userNameElement.textContent = sesion.username;
            // Actualizar rol mostrado
            const userRoleElement = document.querySelector('.user-role');
            if (userRoleElement) userRoleElement.textContent = sesion.rol === 'admin' ? 'Administrador' : 'Empleado';
            // Guardar sesión con permisos en localStorage
            localStorage.setItem('sesionActiva', JSON.stringify(sesion));
            
            // Verificar si tiene permiso para ver turnos
            if (sesion.rol !== 'admin' && sesion.permisos && !sesion.permisos.ver_turnos) {
                // Redirigir a la primera página que tenga permiso
                if (sesion.permisos.ver_habitaciones) {
                    window.location.href = 'habitaciones.html';
                } else if (sesion.permisos.ver_reservaciones) {
                    window.location.href = 'reservaciones.html';
                } else if (sesion.permisos.ver_facturacion) {
                    window.location.href = 'facturacion.html';
                } else if (sesion.permisos.ver_productos) {
                    window.location.href = 'gestion-productos.html';
                } else if (sesion.permisos.ver_gastos) {
                    window.location.href = 'gastos-sede.html';
                } else {
                    // Si no tiene ningún permiso de visualización, cerrar sesión
                    window.location.href = 'index.html';
                }
                return;
            }
            
            // Aplicar permisos a la navegación
            aplicarPermisosNavegacion(sesion.permisos || {}, sesion.rol);
            return;
        }
    } catch (error) {
        console.error('Error al verificar sesión desde Python:', error);
    }
    window.location.href = 'index.html';
});

// Sistema de permisos - aplicar a navegación del sidebar
function aplicarPermisosNavegacion(permisos, rol) {
    if (rol === 'admin') return; // Admin ve todo
    var mapeoNavPermisos = {
        'dasboard-admin.html': 'ver_turnos',
        'habitaciones.html': 'ver_habitaciones',
        'reservaciones.html': 'ver_reservaciones',
        'facturacion.html': 'ver_facturacion',
        'gestion-productos.html': 'ver_productos',
        'gestion-sedes.html': 'ver_sedes',
        'gestion-usuarios.html': 'ver_usuarios',
        'gastos-sede.html': 'ver_gastos'
    };
    document.querySelectorAll('.nav-item').forEach(function(item) {
        var href = item.getAttribute('href') || '';
        for (var pagina in mapeoNavPermisos) {
            if (href.includes(pagina) && !permisos[mapeoNavPermisos[pagina]]) {
                item.style.display = 'none';
            }
        }
    });
}

// Función global para verificar un permiso
function tienePermiso(permiso) {
    try {
        var sesion = JSON.parse(localStorage.getItem('sesionActiva') || '{}');
        if (sesion.rol === 'admin') return true;
        return !!(sesion.permisos && sesion.permisos[permiso]);
    } catch (e) { return false; }
}

// Función global para obtener todos los permisos
function obtenerPermisos() {
    try {
        var sesion = JSON.parse(localStorage.getItem('sesionActiva') || '{}');
        return sesion.permisos || {};
    } catch (e) { return {}; }
}

// Hacer funciones globales
window.tienePermiso = tienePermiso;
window.obtenerPermisos = obtenerPermisos;
window.aplicarPermisosNavegacion = aplicarPermisosNavegacion;

function cambiarSeccion(seccion) {
    document.querySelectorAll('.nav-item').forEach(function(item) { item.classList.remove('active'); });
    event.target.closest('.nav-item').classList.add('active');
    var titulos = {
        'dashboard': 'Dashboard', 'habitaciones': 'Habitaciones',
        'reservaciones': 'Reservaciones', 'facturacion': 'Facturación',
        'productos': 'Productos', 'limpieza': 'Limpieza',
        'reportes': 'Reportes', 'usuarios': 'Gestión de Usuarios'
    };
    document.getElementById('pageTitle').textContent = titulos[seccion] || 'Dashboard';
}

function cerrarSesion() {
    mostrarModalConfirmacion('¿Estás seguro de que deseas cerrar sesión?', function() {
        localStorage.removeItem('sesionActiva');
        if (typeof pywebview !== 'undefined' && pywebview.api) {
            pywebview.api.cerrar_sesion().then(function() { window.location.href = 'index.html'; });
        } else {
            window.location.href = 'index.html';
        }
    });
}

function mostrarModalConfirmacion(mensaje, onConfirm) {
    var modalHTML = '<div class="modal-overlay-confirm" id="confirmModal" style="display: flex;">' +
        '<div class="modal-content-confirm">' +
        '<div class="modal-icon-confirm"><i class="fas fa-question-circle"></i></div>' +
        '<h2 class="modal-title-confirm">Confirmación</h2>' +
        '<p class="modal-message-confirm">' + mensaje + '</p>' +
        '<div class="modal-buttons-confirm">' +
        '<button class="btn-cancel-confirm" onclick="cerrarModalConfirmacion()">Cancelar</button>' +
        '<button class="btn-confirm" onclick="confirmarAccion()">Aceptar</button>' +
        '</div></div></div>';
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    window.accionConfirmada = onConfirm;
}

function cerrarModalConfirmacion() {
    var modal = document.getElementById('confirmModal');
    if (modal) modal.remove();
    window.accionConfirmada = null;
}

async function confirmarAccion() {
    if (window.accionConfirmada) await window.accionConfirmada();
    cerrarModalConfirmacion();
}

function actualizarFechaHora() {
    var ahora = typeof fechaColombia === 'function' ? fechaColombia() : new Date();
    var currentDateElement = document.getElementById('currentDate');
    if (currentDateElement) {
        currentDateElement.textContent = ahora.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    actualizarTurnoActual(ahora);
}

function actualizarTurnoActual(ahora) {
    var turnoElement = document.getElementById('turnoActual');
    if (!turnoElement) return;
    var horaInicioStr = (window._configTurno && window._configTurno.hora_inicio) || '07:00';
    var horaFinStr = (window._configTurno && window._configTurno.hora_fin) || '07:00';
    var partsIni = horaInicioStr.split(':').map(Number);
    var partsFin = horaFinStr.split(':').map(Number);
    var hIni = partsIni[0], mIni = partsIni[1], hFin = partsFin[0], mFin = partsFin[1];
    var minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
    var minutosInicio = hIni * 60 + mIni;
    var inicioTurno, finTurno;
    if (minutosAhora >= minutosInicio) {
        inicioTurno = new Date(ahora); inicioTurno.setHours(hIni, mIni, 0, 0);
        finTurno = new Date(ahora);
        if (hFin * 60 + mFin <= minutosInicio) finTurno.setDate(finTurno.getDate() + 1);
        finTurno.setHours(hFin, mFin, 0, 0);
    } else {
        inicioTurno = new Date(ahora); inicioTurno.setDate(inicioTurno.getDate() - 1); inicioTurno.setHours(hIni, mIni, 0, 0);
        finTurno = new Date(ahora); finTurno.setHours(hFin, mFin, 0, 0);
    }
    function fmtT(d) {
        var h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
        var ampm = h >= 12 ? 'PM' : 'AM';
        var h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return h12 + ':' + m + ' ' + ampm + ' del ' + d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    }
    turnoElement.textContent = fmtT(inicioTurno) + ' - ' + fmtT(finTurno);
}

async function cargarBalanceCaja() {
    try {
        if (typeof pywebview !== 'undefined' && pywebview.api) {
            var balance = await pywebview.api.obtener_balance_caja();
            if (balance) {
                var elBase = document.getElementById('dineroBase');
                var elFact = document.getElementById('dineroFacturado');
                var elTotal = document.getElementById('totalCaja');
                if (elBase) elBase.textContent = '$' + balance.dinero_base.toLocaleString('es-CO');
                if (elFact) elFact.textContent = '$' + balance.dinero_facturado.toLocaleString('es-CO');
                if (elTotal) elTotal.textContent = '$' + balance.total_caja.toLocaleString('es-CO');
            }
        }
    } catch (error) {
        console.error('Error al cargar balance de caja:', error);
        var elBase = document.getElementById('dineroBase');
        var elFact = document.getElementById('dineroFacturado');
        var elTotal = document.getElementById('totalCaja');
        if (elBase) elBase.textContent = '$0';
        if (elFact) elFact.textContent = '$0';
        if (elTotal) elTotal.textContent = '$0';
    }
}

async function cargarUsuarioActivo() {
    try {
        var sesion = await pywebview.api.cargar_sesion();
        if (sesion) {
            var el = document.getElementById('activeUser');
            if (el) el.textContent = sesion.username;
        }
    } catch (error) { console.error('Error al cargar usuario:', error); }
}

async function cargarConfigTurnoEnMemoria() {
    try {
        var config = await pywebview.api.obtener_config_turno();
        window._configTurno = config;
    } catch (e) {
        window._configTurno = { hora_inicio: '07:00', hora_fin: '07:00', dinero_base: 0 };
    }
}

async function inicializarDashboard() {
    await esperarPywebview();
    await cargarUsuarioActivo();
    await cargarConfigTurnoEnMemoria();
    await cargarSedesTopBar();
    await verificarTurnoActivo();
    actualizarFechaHora();
    setInterval(actualizarFechaHora, 60000);
    await cargarBalanceCaja();
    setInterval(cargarBalanceCaja, 30000);
    await cargarRegistroTurnos();
    setInterval(cargarRegistroTurnos, 60000);
    
    // Aplicar permisos a botones del dashboard
    aplicarPermisosDashboard();
}

function aplicarPermisosDashboard() {
    var sesion = obtenerSesionActual ? obtenerSesionActual() : JSON.parse(localStorage.getItem('sesionActiva') || '{}');
    
    if (!tienePermiso('config_turnos')) {
        document.querySelectorAll('[onclick*="abrirConfigTurnos"]').forEach(function(el) { el.style.display = 'none'; });
    }
    if (!tienePermiso('iniciar_turno')) {
        var btn = document.getElementById('btnIniciarTurno');
        if (btn) btn.style.display = 'none';
    }
    if (!tienePermiso('cerrar_turno')) {
        var btn = document.getElementById('btnSalidaTurno');
        if (btn) btn.style.display = 'none';
    }
    if (!tienePermiso('descargar_pdf_turnos')) {
        var btn = document.getElementById('btnImprimirPDF');
        if (btn) btn.style.display = 'none';
    }
    if (!tienePermiso('imprimir_tirilla_turnos')) {
        var btn = document.getElementById('btnTirillaPOS');
        if (btn) btn.style.display = 'none';
    }
    // Ocultar selector de sedes para empleados
    if (sesion.rol !== 'admin') {
        var sedeSelector = document.getElementById('topBarSedeSelector');
        if (sedeSelector) sedeSelector.style.display = 'none';
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarDashboard);
} else {
    inicializarDashboard();
}

async function registrarInicioTurno() {
    try {
        if (typeof pywebview !== 'undefined' && pywebview.api) {
            var sesion = await pywebview.api.cargar_sesion();
            if (!sesion) return;
            var resultado = await pywebview.api.registrar_inicio_turno();
            if (resultado.success) {
                document.getElementById('turnoActual').textContent = 'Turno activo - ' + sesion.username;
                document.getElementById('btnIniciarTurno').disabled = true;
                document.getElementById('btnSalidaTurno').disabled = false;
                _setBotonesImpresion(false);
                await cargarBalanceCaja();
                await cargarRegistroTurnos();
            }
        }
    } catch (error) { console.error('Error al registrar inicio de turno:', error); }
}

async function registrarSalidaTurno() {
    mostrarModalConfirmacion('¿Estás seguro de que deseas registrar la salida del turno?', async function() {
        try {
            if (typeof pywebview !== 'undefined' && pywebview.api) {
                var resultado = await pywebview.api.registrar_salida_turno();
                if (resultado.success) {
                    document.getElementById('turnoActual').textContent = 'Sin turno activo';
                    document.getElementById('btnIniciarTurno').disabled = false;
                    document.getElementById('btnSalidaTurno').disabled = true;
                    _setBotonesImpresion(true);
                    await cargarBalanceCaja();
                    await cargarRegistroTurnos();
                }
            }
        } catch (error) { console.error('Error al registrar salida de turno:', error); }
    });
}

function mostrarNotificacion(mensaje, tipo) {
    tipo = tipo || 'info';
    var notificacion = document.createElement('div');
    notificacion.className = 'notificacion notificacion-' + tipo;
    var icono = tipo === 'success' ? 'fa-check-circle' : tipo === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
    notificacion.innerHTML = '<i class="fas ' + icono + '"></i><span>' + mensaje + '</span>';
    document.body.appendChild(notificacion);
    setTimeout(function() { notificacion.classList.add('mostrar'); }, 10);
    setTimeout(function() {
        notificacion.classList.remove('mostrar');
        setTimeout(function() { notificacion.remove(); }, 300);
    }, 3000);
}

// ─── Impresión de turno ───────────────────────────────────────────────────────

async function imprimirPDFTurno() {
    try {
        if (typeof pywebview === 'undefined' || !pywebview.api) return;
        var datos = await pywebview.api.obtener_datos_turno_impresion(null);
        if (!datos.success) { mostrarNotificacion('No hay turno disponible', 'error'); return; }
        _imprimirTurnoHTML(datos, 'pdf');
    } catch (error) { console.error('Error al imprimir PDF:', error); }
}

async function imprimirTirillaPOS() {
    try {
        if (typeof pywebview === 'undefined' || !pywebview.api) return;
        var datos = await pywebview.api.obtener_datos_turno_impresion(null);
        if (!datos.success) { mostrarNotificacion('No hay turno disponible', 'error'); return; }
        _imprimirTurnoHTML(datos, 'tirilla');
    } catch (error) { console.error('Error al imprimir tirilla POS:', error); }
}

function _fmtFecha(iso) {
    if (!iso) return '-';
    var d = typeof fechaColombia === 'function' ? fechaColombia(iso) : new Date(iso);
    return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getFullYear()).slice(-2);
}
function _fmtHoraTirilla(iso) {
    if (!iso) return '-';
    var d = typeof fechaColombia === 'function' ? fechaColombia(iso) : new Date(iso), hh = d.getHours(), mm = String(d.getMinutes()).padStart(2,'0');
    var ap = hh < 12 ? 'am' : 'pm', h12 = hh % 12; var hd = h12 === 0 ? 12 : h12;
    return hd + ':' + mm + ap;
}
function _fmtHoraPDF(iso) {
    if (!iso) return '-';
    var d = typeof fechaColombia === 'function' ? fechaColombia(iso) : new Date(iso); var h = d.getHours(), mm = String(d.getMinutes()).padStart(2,'0');
    var ap = h >= 12 ? 'PM' : 'AM'; if (h === 0) h = 12; else if (h > 12) h -= 12;
    return h + ':' + mm + ' ' + ap;
}
function _fmtFechaHora(iso) {
    if (!iso) return '-';
    return _fmtFecha(iso).replace(/(\d+)\/(\d+)\/(\d+)/, '$1/$2/20$3') + ' ' + _fmtHoraPDF(iso);
}
function _fmtP(n) { return '$' + (Number(n)||0).toLocaleString('es-CO'); }
function _e(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function _pie() {
    var d = typeof fechaColombia === 'function' ? fechaColombia() : new Date();
    return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getFullYear()).slice(-2) + ' ' + _fmtHoraTirilla(d.getTime());
}
function _etqHab(f) {
    var n = String(f.habitacion_numero||'').trim(), nom = String(f.habitacion_nombre||'').trim();
    var nf = n && /^\d+$/.test(n) ? n.padStart(2,'0') : n;
    if (nf && nom) return nf + ' - ' + nom; return nom || nf || '-';
}

// Agrupa todos los movimientos de todas las facturas del turno en una sola lista consolidada.
function _consolidarMovimientos(facturas) {
    var mapa = {};
    var orden = [];

    facturas.forEach(function(f) {
        var he = f.fecha_ingreso_hab || f.fecha_registro || '';
        var hs = f.fecha_salida_hab || f.fecha_registro || '';

        (f.movimientos || []).forEach(function(m) {
            var desc = (m.descripcion || '-').trim();
            var descBase = desc.replace(/\s+x\s*\d+\s*$/i, '').trim();
            var matchCant = desc.match(/\s+x\s*(\d+)\s*$/i);
            var cantMov = matchCant ? parseInt(matchCant[1], 10) : 1;

            var key = descBase.toLowerCase();
            if (mapa[key]) {
                mapa[key].cantidad += cantMov;
                mapa[key].valor_total += Number(m.valor) || 0;
                // HE = la más antigua entre todas las facturas que tienen este ítem
                if (he && (!mapa[key].fecha_he || he < mapa[key].fecha_he)) {
                    mapa[key].fecha_he = he;
                }
                // HS = la más reciente
                if (hs && (!mapa[key].fecha_hs || hs > mapa[key].fecha_hs)) {
                    mapa[key].fecha_hs = hs;
                    mapa[key].usuario = m.usuario || '-';
                }
            } else {
                mapa[key] = {
                    descripcion: descBase,
                    cantidad: cantMov,
                    valor_total: Number(m.valor) || 0,
                    fecha_he: he,
                    fecha_hs: hs,
                    usuario: m.usuario || '-'
                };
                orden.push(key);
            }
        });
    });

    return orden.map(function(k) { return mapa[k]; });
}

function _filasGlobales(items, esTirilla) {
    if (!items || !items.length) return '<tr><td colspan="6" style="text-align:center;color:#888;font-style:italic">Sin movimientos</td></tr>';
    return items.map(function(item) {
        var he = esTirilla ? _fmtHoraTirilla(item.fecha_he) : _fmtHoraPDF(item.fecha_he);
        var hs = esTirilla ? _fmtHoraTirilla(item.fecha_hs) : _fmtHoraPDF(item.fecha_hs);
        // Mostrar HS siempre (puede ser igual a HE si fue instantáneo)
        var hsCol = hs || '-';
        return '<tr>' +
            '<td class="c-he">' + _e(he) + '</td>' +
            '<td class="c-hs">' + _e(hsCol) + '</td>' +
            '<td class="c-desc">' + _e(item.descripcion) + '</td>' +
            '<td class="c-cant">' + item.cantidad + '</td>' +
            '<td class="c-valor">' + _fmtP(item.valor_total) + '</td>' +
            '<td class="c-usuario">' + _e(item.usuario) + '</td>' +
            '</tr>';
    }).join('');
}

function _imprimirTurnoHTML(datos, modo) {
    var esTirilla = modo === 'tirilla';
    var sede = [datos.sede_nombre, datos.sede_ciudad].filter(Boolean).join(' - ');
    var estado = datos.activo ? 'TURNO ACTIVO' : 'TURNO CERRADO';
    var facturas = datos.facturas || [];
    var items = _consolidarMovimientos(facturas);

    // CSS tirilla 80mm — ahora con columna CANT
    var cssTirilla = '@page{size:80mm auto;margin:0}' +
        'body{font-family:Arial,sans-serif;width:80mm;max-width:80mm;margin:0;padding:8px 6px;box-sizing:border-box;font-size:9px;color:#000;background:#fff}' +
        '.cab{text-align:center;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:8px}' +
        '.cab .tit{font-size:12px;font-weight:700;letter-spacing:.05em}' +
        '.cab .sub{font-size:9px;margin-top:3px}' +
        '.cab .est{font-size:8px;font-weight:700;margin-top:4px;background:#000;color:#fff;display:inline-block;padding:2px 7px;border-radius:2px}' +
        '.inf{margin:6px 0;font-size:8.5px}' +
        '.inf .r{display:flex;justify-content:space-between;margin:2px 0}' +
        '.sec{font-weight:700;font-size:8.5px;letter-spacing:.06em;border-top:1px dashed #000;border-bottom:1px dashed #000;padding:3px 0;margin:7px 0 4px}' +
        'table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:7.5px}' +
        'th{font-size:6.5px;font-weight:700;text-transform:uppercase;letter-spacing:.02em;border-bottom:1px solid #000;padding:3px 2px;text-align:left}' +
        'td{padding:3px 2px;border-bottom:1px dotted #ccc;vertical-align:middle;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
        '.c-he{width:11%}.c-hs{width:11%}' +
        '.c-desc{width:30%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
        '.c-cant{width:7%;text-align:center}' +
        '.c-valor{width:16%;text-align:right}.c-usuario{width:17%;overflow:hidden;text-overflow:ellipsis}' +
        '.tots{margin-top:8px;border-top:2px solid #000;padding-top:5px;font-size:9px}' +
        '.tots .r{display:flex;justify-content:space-between;margin:2px 0}' +
        '.tots .g{font-size:11px;font-weight:700;margin-top:5px}' +
        '.pie{text-align:center;font-size:8px;margin-top:8px;color:#555}';

    // CSS PDF A4 — con columna CANT
    var cssPDF = '@page{size:A4;margin:18mm 15mm}' +
        'body{font-family:Arial,sans-serif;margin:0;padding:0;font-size:11px;color:#000;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
        '.cab{text-align:center;border-bottom:3px solid #000;padding-bottom:12px;margin-bottom:14px}' +
        '.cab .tit{font-size:20px;font-weight:700;letter-spacing:.06em}' +
        '.cab .sub{font-size:12px;margin-top:5px;color:#333}' +
        '.cab .est{font-size:10px;font-weight:700;margin-top:6px;background:#000;color:#fff;display:inline-block;padding:3px 14px;border-radius:3px;letter-spacing:.05em;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
        '.inf{margin:12px 0;display:grid;grid-template-columns:1fr 1fr;gap:4px 20px;font-size:11px;border:1px solid #ddd;padding:10px 14px;border-radius:4px;background:#fafafa;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
        '.inf .r{display:flex;gap:6px}.inf .r .lb{font-weight:700;min-width:110px}' +
        '.sec{font-weight:700;font-size:12px;letter-spacing:.06em;text-transform:uppercase;border-top:2px solid #000;border-bottom:1px solid #000;padding:5px 0;margin:14px 0 6px}' +
        'table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9.5px}' +
        'th{background:#000 !important;color:#fff !important;font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:.04em;border:1px solid #000;padding:6px 5px;text-align:left;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
        'td{border:1px solid #ccc;padding:6px 5px;vertical-align:top}' +
        'tbody tr:nth-child(even) td{background:#f9f9f9;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
        '.c-he{width:10%;white-space:nowrap}.c-hs{width:9%;white-space:nowrap}' +
        '.c-desc{word-break:break-word;overflow-wrap:anywhere}' +
        '.c-cant{width:6%;text-align:center;white-space:nowrap}' +
        '.c-valor{width:13%;text-align:right;white-space:nowrap}.c-usuario{width:12%;word-break:break-word}' +
        '.tots{margin-top:18px;border-top:3px solid #000;padding-top:10px}' +
        '.tots .r{display:flex;justify-content:space-between;margin:4px 0;font-size:12px}' +
        '.tots .g{font-size:16px;font-weight:700;margin-top:8px;border-top:1px solid #000;padding-top:6px}' +
        '.pie{text-align:center;font-size:9px;margin-top:16px;color:#777;border-top:1px solid #ddd;padding-top:8px}';

    var theadTirilla = '<thead><tr>' +
        '<th class="c-he">HE</th><th class="c-hs">HS</th>' +
        '<th class="c-desc">Descripción</th><th class="c-cant">Cant</th>' +
        '<th class="c-valor">Valor</th><th class="c-usuario">Usuario</th>' +
        '</tr></thead>';

    var theadPDF = '<thead><tr>' +
        '<th class="c-he">H. Entrada</th><th class="c-hs">H. Salida</th>' +
        '<th class="c-desc">Descripción</th><th class="c-cant">Cant</th>' +
        '<th class="c-valor">Valor</th><th class="c-usuario">Usuario</th>' +
        '</tr></thead>';

    var thead = esTirilla ? theadTirilla : theadPDF;

    var tablaGlobal = items.length
        ? '<table>' + thead + '<tbody>' + _filasGlobales(items, esTirilla) + '</tbody></table>'
        : '<p style="color:#888;text-align:center;' + (esTirilla ? 'font-size:8.5px' : 'margin:20px 0') + '">Sin movimientos en este turno</p>';

    // Info bloque
    var infoHTML;
    if (esTirilla) {
        infoHTML = '<div class="inf">' +
            '<div class="r"><span>Usuario:</span><span>' + _e(datos.usuario) + '</span></div>' +
            '<div class="r"><span>Inicio:</span><span>' + _e(_fmtFechaHora(datos.fecha_ingreso)) + '</span></div>' +
            '<div class="r"><span>Salida:</span><span>' + (datos.fecha_salida ? _e(_fmtFechaHora(datos.fecha_salida)) : '-') + '</span></div>' +
            '<div class="r"><span>Facturas:</span><span>' + facturas.length + '</span></div></div>';
    } else {
        infoHTML = '<div class="inf">' +
            '<div class="r"><span class="lb">Usuario:</span><span>' + _e(datos.usuario) + '</span></div>' +
            '<div class="r"><span class="lb">Inicio turno:</span><span>' + _e(_fmtFechaHora(datos.fecha_ingreso)) + '</span></div>' +
            '<div class="r"><span class="lb">Salida turno:</span><span>' + (datos.fecha_salida ? _e(_fmtFechaHora(datos.fecha_salida)) : '-') + '</span></div>' +
            '<div class="r"><span class="lb">Total facturas:</span><span>' + facturas.length + '</span></div></div>';
    }

    var html = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Cuadre de Turno</title>' +
        '<style>' + (esTirilla ? cssTirilla : cssPDF) + '</style></head><body>' +
        '<div class="cab"><div class="tit">CUADRE DE TURNO</div>' +
        (sede ? '<div class="sub">' + _e(sede) + '</div>' : '') +
        '<div class="est">' + _e(estado) + '</div></div>' +
        infoHTML +
        '<div class="sec">MOVIMIENTOS DEL TURNO</div>' +
        tablaGlobal +
        '<div class="tots">' +
        '<div class="r"><span>Dinero Base:</span><span>' + _fmtP(datos.dinero_base) + '</span></div>' +
        '<div class="r"><span>Total en Caja:</span><span>' + _fmtP(datos.total_caja) + '</span></div>' +
        '<div class="r g"><span>Total Facturado:</span><span>' + _fmtP(datos.total_facturado) + '</span></div></div>' +
        '<p class="pie">' + _e(_pie()) + '</p>' +
        '</body></html>';

    var iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:absolute;width:0;height:0;border:none';
    document.body.appendChild(iframe);
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    setTimeout(function() {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(function() { document.body.removeChild(iframe); }, 1000);
    }, 400);
}

// Cargar registro de turnos
async function cargarRegistroTurnos(sedeId) {
    try {
        if (typeof pywebview !== 'undefined' && pywebview.api) {
            var registros = await pywebview.api.obtener_registro_turnos(sedeId || null);
            var tbody = document.getElementById('registroTurnosBody');
            if (!tbody) return;
            if (registros && registros.length > 0) {
                tbody.innerHTML = '';
                registros.forEach(function(registro) {
                    var tr = document.createElement('tr');
                    function fmtFechaReg(fechaISO) {
                        if (!fechaISO) return '-';
                        var fecha = typeof fechaColombia === 'function' ? fechaColombia(fechaISO) : new Date(fechaISO);
                        var dia = String(fecha.getDate()).padStart(2,'0'), mes = String(fecha.getMonth()+1).padStart(2,'0'), anio = fecha.getFullYear();
                        var horas = fecha.getHours(), minutos = String(fecha.getMinutes()).padStart(2,'0');
                        var ampm = horas >= 12 ? 'PM' : 'AM';
                        if (horas === 0) horas = 12; else if (horas > 12) horas -= 12;
                        return dia+'/'+mes+'/'+anio+', '+horas+':'+minutos+' '+ampm;
                    }
                    var db = registro.dinero_base !== undefined ? '$'+registro.dinero_base.toLocaleString('es-CO') : '$0';
                    var tf = registro.total_facturado ? '$'+registro.total_facturado.toLocaleString('es-CO') : '$0';
                    var tc = registro.total_caja !== undefined ? '$'+registro.total_caja.toLocaleString('es-CO') : '$0';
                    tr.innerHTML = '<td>'+registro.usuario+'</td><td>'+fmtFechaReg(registro.fecha_ingreso)+'</td><td>'+fmtFechaReg(registro.fecha_salida)+'</td><td>'+db+'</td><td>'+tc+'</td><td style="font-weight:700">'+tf+'</td>';
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="6" class="no-data">No hay registros de turnos</td></tr>';
            }
        }
    } catch (error) {
        console.error('Error al cargar registro de turnos:', error);
        var tbodyErr = document.getElementById('registroTurnosBody');
        if (tbodyErr) tbodyErr.innerHTML = '<tr><td colspan="6" class="no-data">No hay registros de turnos</td></tr>';
    }
}

async function verificarTurnoActivo() {
    try {
        if (typeof pywebview !== 'undefined' && pywebview.api) {
            var turnoActivo = await pywebview.api.verificar_turno_activo();
            var turnoEl = document.getElementById('turnoActual');
            var btnIniciar = document.getElementById('btnIniciarTurno');
            var btnSalida = document.getElementById('btnSalidaTurno');
            if (turnoActivo && turnoActivo.activo) {
                if (turnoEl) turnoEl.textContent = 'Turno activo - ' + turnoActivo.usuario;
                if (btnIniciar) btnIniciar.disabled = true;
                if (btnSalida) btnSalida.disabled = false;
                _setBotonesImpresion(false);
            } else {
                if (turnoEl) turnoEl.textContent = 'Sin turno activo';
                if (btnIniciar) btnIniciar.disabled = false;
                if (btnSalida) btnSalida.disabled = true;
                _setBotonesImpresion(true);
            }
        }
    } catch (error) { console.error('Error al verificar turno activo:', error); }
}

function _setBotonesImpresion(habilitado) {
    var btnPdf = document.getElementById('btnImprimirPDF');
    var btnPos = document.getElementById('btnTirillaPOS');
    if (btnPdf) btnPdf.disabled = !habilitado;
    if (btnPos) btnPos.disabled = !habilitado;
}

// ─── Selector de sede en top-bar ─────────────────────────────────────────────

async function cargarSedesTopBar() {
    try {
        var resultado = await pywebview.api.obtener_sedes();
        var sedes = resultado.sedes || [], sedeActualId = resultado.sede_actual_id;
        var select = document.getElementById('topBarSedeSelector');
        if (!select) return;
        select.innerHTML = '<option value="">Todas las sedes</option>';
        sedes.forEach(function(s) {
            var opt = document.createElement('option');
            opt.value = s._id; opt.textContent = s.nombre;
            if (s._id === sedeActualId) opt.selected = true;
            select.appendChild(opt);
        });
    } catch (e) { console.error('Error cargando sedes top-bar:', e); }
}

async function cambiarSedeDashboard(sedeId) {
    await cargarRegistroTurnos(sedeId || null);
}

// ─── Configuración de Turno ───────────────────────────────────────────────────

function formatearMiles(input) {
    var raw = input.value.replace(/\./g,'').replace(/,/g,'').replace(/[^0-9]/g,'');
    var num = parseInt(raw, 10);
    input.value = !isNaN(num) ? num.toLocaleString('es-CO') : '';
}

function parsearMiles(valor) {
    return parseFloat(String(valor).replace(/\./g,'').replace(/,/g,'')) || 0;
}

async function abrirConfigTurnos() {
    try {
        var resultado = await pywebview.api.obtener_sedes();
        var sedes = resultado.sedes || [], sedeActualId = resultado.sede_actual_id;
        var select = document.getElementById('configSedeSelector');
        select.innerHTML = '';
        sedes.forEach(function(s) {
            var opt = document.createElement('option');
            opt.value = s._id; opt.textContent = s.nombre + ' — ' + s.ciudad;
            if (s._id === sedeActualId) opt.selected = true;
            select.appendChild(opt);
        });
        if (select.value) await cargarConfigTurnoPorSede(select.value);
        document.getElementById('modalConfigTurnos').style.display = 'flex';
    } catch (error) { console.error('Error al abrir configuración de turno:', error); }
}

async function cargarConfigTurnoPorSede(sedeId) {
    if (!sedeId) return;
    try {
        var config = await pywebview.api.obtener_config_turno_sede(sedeId);
        var val = config.dinero_base || 0;
        document.getElementById('configDineroBase').value = val > 0 ? val.toLocaleString('es-CO') : '';
        document.getElementById('configHoraInicio').value = config.hora_inicio || '07:00';
        document.getElementById('configHoraFin').value = config.hora_fin || '07:00';
        var infoEl = document.getElementById('configSedeInfo');
        if (infoEl && config.sede_nombre) {
            infoEl.textContent = config.sede_ciudad ? config.sede_nombre + ' — ' + config.sede_ciudad : config.sede_nombre;
        }
    } catch (error) { console.error('Error al cargar config de sede:', error); }
}

function cerrarConfigTurnos() {
    document.getElementById('modalConfigTurnos').style.display = 'none';
}

async function guardarConfigTurnos() {
    var sedeId = document.getElementById('configSedeSelector').value;
    if (!sedeId) { mostrarNotificacion('Selecciona una sede', 'error'); return; }
    var dineroBase = parsearMiles(document.getElementById('configDineroBase').value);
    var horaInicio = document.getElementById('configHoraInicio').value || '07:00';
    var horaFin = document.getElementById('configHoraFin').value || '07:00';
    try {
        var resultado = await pywebview.api.guardar_config_turno_sede(sedeId, {
            dinero_base: dineroBase, hora_inicio: horaInicio, hora_fin: horaFin
        });
        if (resultado.success) {
            cerrarConfigTurnos();
            mostrarNotificacion('Configuración guardada correctamente', 'success');
            await cargarConfigTurnoEnMemoria();
            await cargarBalanceCaja();
            actualizarFechaHora();
        } else {
            mostrarNotificacion(resultado.mensaje || 'Error al guardar', 'error');
        }
    } catch (error) {
        console.error('Error al guardar configuración:', error);
        mostrarNotificacion('Error al guardar configuración', 'error');
    }
}
