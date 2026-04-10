let reservas = [];
// Variables que necesita ocupar-habitacion-profesional.js
let habitaciones = [];
let sedes = [];

// Aliases para que ocupar-habitacion-profesional.js recargue correctamente
async function cargarHabitaciones() { await cargarReservas(); }
async function cargarTodasHabitaciones() { await cargarReservas(); }

function formatearPrecioTarjeta(numero) {
    const n = parseInt(numero, 10) || 0;
    return '$' + n.toLocaleString('es-CO');
}
function formatearNumero(numero) {
    return parseInt(numero).toLocaleString('en-US');
}

function formatearPrecioReserva(n) {
    return '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');
}

function formatearFechaReserva(iso) {
    if (!iso) return '—';
    const d = typeof fechaColombia === 'function' ? fechaColombia(iso) : new Date(iso);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const año = d.getFullYear();
    let h = d.getHours();
    const min = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
    return `${dia}/${mes}/${año} ${String(h).padStart(2,'0')}:${min} ${ampm}`;
}

function tipoOcupacionTexto(r) {
    const t = r.tipo_ocupacion || 'horas';
    if (t === 'varios_dias') return `Varios días (${r.dias_personalizados || 2}d)`;
    if (t === 'dia') return 'Día (24h)';
    if (t === 'noche') return 'Noche (12h)';
    return `Estándar (${r.duracion_horas || 4}h)`;
}

function esperarPywebview() {
    return new Promise((resolve) => {
        if (window.pywebview && window.pywebview.api) { resolve(); return; }
        window.addEventListener('pywebviewready', resolve, { once: true });
    });
}

// Inicializar reservaciones con verificación de sesión y permisos
window.addEventListener('DOMContentLoaded', async () => {
    await esperarPywebview();
    try {
        const sesion = await pywebview.api.cargar_sesion();
        if (sesion) {
            const userNameEl = document.getElementById('userName');
            if (userNameEl) userNameEl.textContent = sesion.username;
            const userRoleEl = document.querySelector('.user-role');
            if (userRoleEl) userRoleEl.textContent = sesion.rol === 'admin' ? 'Administrador' : 'Empleado';
            localStorage.setItem('sesionActiva', JSON.stringify(sesion));
            
            if (sesion.rol !== 'admin' && sesion.permisos && !sesion.permisos.ver_reservaciones) {
                window.location.href = 'dasboard-admin.html';
                return;
            }
            
            if (typeof inicializarPermisos === 'function') inicializarPermisos();
            
            if (!tienePermiso('crear_reservaciones')) {
                document.querySelectorAll('[onclick*="abrirSelectorHabitacionReserva"]').forEach(function(el) { el.style.display = 'none'; });
            }
            
            await cargarReservas();
        } else {
            window.location.href = 'index.html';
        }
    } catch (e) {
        console.error(e);
        window.location.href = 'index.html';
    }
});

async function cargarReservas() {
    try {
        const res = await pywebview.api.obtener_reservas();
        reservas = (res && res.success) ? (res.reservas || []) : [];
    } catch (e) {
        console.error(e);
        reservas = [];
    }
    renderizar();
}

function renderizar() {
    const grid = document.getElementById('reservasGrid');
    const vacio = document.getElementById('reservasVacio');

    if (!reservas.length) {
        vacio.style.display = '';
        grid.innerHTML = '';
        return;
    }
    vacio.style.display = 'none';

    grid.innerHTML = reservas.map(r => {
        const nombre = r.nombre || r.numero || 'Habitación';
        const sede = r.sede_nombre || '';
        const ciudad = r.sede_ciudad || '';
        const tieneVehiculo = r.placa && r.placa !== 'N/A';

        return `
        <div class="reserva-card">
            <div class="reserva-card-header">
                <div class="reserva-card-header-info">
                    <h3>${nombre}</h3>
                    <div class="reserva-sede">${sede}</div>
                    ${ciudad ? `<div class="reserva-ciudad"><i class="fas fa-map-marker-alt"></i> ${ciudad}</div>` : ''}
                </div>
                <i class="fas fa-calendar-check reserva-card-header-icon"></i>
            </div>
            <div class="reserva-card-body">
                <div class="reserva-llegada-destacada">
                    <span class="label"><i class="fas fa-clock"></i> Llegada</span>
                    <span class="value">${formatearFechaReserva(r.fecha_reserva)}</span>
                </div>
                <div class="reserva-info-row">
                    <span class="label"><i class="fas fa-tag"></i> Tipo</span>
                    <span class="value">${tipoOcupacionTexto(r)}</span>
                </div>
                <div class="reserva-info-row">
                    <span class="label"><i class="fas fa-dollar-sign"></i> Precio</span>
                    <span class="value">${formatearPrecioReserva(r.precio_acordado)}</span>
                </div>
                ${tieneVehiculo ? `
                <div class="reserva-info-row">
                    <span class="label"><i class="fas fa-car"></i> Vehículo</span>
                    <span class="value">${r.placa}${r.color && r.color !== 'N/A' ? ' · ' + r.color : ''}</span>
                </div>` : ''}
                <div class="reserva-info-row">
                    <span class="label"><i class="fas fa-user"></i> Registró</span>
                    <span class="value">${r.usuario_ocupacion || '—'}</span>
                </div>
                <div class="reserva-info-row">
                    <span class="label"><i class="fas fa-calendar-plus"></i> Creada</span>
                    <span class="value">${formatearFechaReserva(r.fecha_ingreso)}</span>
                </div>
                ${r.descripcion ? `
                <div class="reserva-info-row">
                    <span class="label"><i class="fas fa-comment"></i> Nota</span>
                    <span class="value">${r.descripcion}</span>
                </div>` : ''}
            </div>
            <div class="reserva-card-actions">
                <button class="reserva-btn reserva-btn-activar" onclick="activarReserva('${r._id}', '${nombre.replace(/'/g, "\\'")}')" style="flex:1">
                    <i class="fas fa-door-open"></i> Ocupar habitación
                </button>
            </div>
        </div>`;
    }).join('');
}

function activarReserva(id, nombre) {
    mostrarModalConfirmacion(
        `¿Ocupar "${nombre}"? Pasará a estado ocupada.`,
        async () => {
            try {
                const res = await pywebview.api.activar_reserva(id);
                mostrarModalConfirmacion(res.message || 'Habitación ocupada', null, true);
                await cargarReservas();
            } catch (e) {
                console.error(e);
                mostrarModalConfirmacion('Error al ocupar la habitación', null, true);
            }
        }
    );
}

function cerrarSesion() {
    mostrarModalConfirmacion('¿Cerrar sesión?', () => {
        localStorage.removeItem('sesionActiva');
        if (typeof pywebview !== 'undefined' && pywebview.api) {
            pywebview.api.cerrar_sesion().then(() => {
                window.location.href = 'index.html';
            });
        } else {
            window.location.href = 'index.html';
        }
    });
}

// ── Modal de confirmación (mismo estilo que habitaciones) ──
function mostrarModalConfirmacion(mensaje, onConfirm, soloInfo = false) {
    const tipoModal = soloInfo ? (mensaje.toLowerCase().includes('error') ? 'error' :
        mensaje.toLowerCase().includes('correctamente') || mensaje.toLowerCase().includes('ocupada') || mensaje.toLowerCase().includes('disponible') ? 'success' : 'info') : 'confirmacion';

    const iconos = { confirmacion:'fa-question-circle', success:'fa-check-circle', error:'fa-exclamation-circle', info:'fa-info-circle' };
    const colores = { confirmacion:'#856404', success:'#155724', error:'#721c24', info:'#004085' };
    const fondos = { confirmacion:'#fff3cd', success:'#d4edda', error:'#f8d7da', info:'#d1ecf1' };
    const titulos = { confirmacion:'Confirmación', success:'Éxito', error:'Error', info:'Información' };

    const html = `
        <div class="modal-overlay-confirm" id="confirmModal" style="display:flex;z-index:30000;">
            <div class="modal-content-confirm">
                <div class="modal-icon-confirm" style="background:${fondos[tipoModal]};"><i class="fas ${iconos[tipoModal]}" style="color:${colores[tipoModal]};"></i></div>
                <h2 class="modal-title-confirm">${titulos[tipoModal]}</h2>
                <p class="modal-message-confirm">${mensaje}</p>
                <div class="modal-buttons-confirm">
                    ${soloInfo
                        ? '<button class="btn-confirm" onclick="cerrarModalConfirmacion()" style="width:100%;">Aceptar</button>'
                        : '<button class="btn-cancel-confirm" onclick="cerrarModalConfirmacion()">Cancelar</button><button class="btn-confirm" onclick="confirmarAccion()">Aceptar</button>'}
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    window.accionConfirmada = onConfirm;
}

function cerrarModalConfirmacion() {
    const m = document.getElementById('confirmModal');
    if (m) m.remove();
    window.accionConfirmada = null;
}

async function confirmarAccion() {
    if (window.accionConfirmada) await window.accionConfirmada();
    cerrarModalConfirmacion();
}

esperarPywebview().then(async () => {
    // Cargar sedes para el modal de ocupar
    try {
        const resSedes = await pywebview.api.obtener_sedes();
        if (resSedes && resSedes.success) sedes = resSedes.sedes || [];
    } catch (e) {}
    await cargarReservas();
    setInterval(cargarReservas, 30000);
});

async function abrirSelectorHabitacionReserva() {
    // Cargar habitaciones disponibles
    let disponibles = [];
    try {
        const res = await pywebview.api.obtener_habitaciones();
        if (res && res.success) {
            disponibles = (res.habitaciones || []).filter(h => h.estado === 'disponible');
            habitaciones = res.habitaciones || [];
        }
    } catch (e) {
        mostrarModalConfirmacion('Error al cargar habitaciones', null, true);
        return;
    }

    if (disponibles.length === 0) {
        mostrarModalConfirmacion('No hay habitaciones disponibles para reservar.', null, true);
        return;
    }

    const tarjetasHTML = disponibles.map(h => {
        const textoSede = [h.sede_nombre, h.sede_ciudad].filter(Boolean).join(' ').trim();
        return `
            <div class="habitacion-card disponible cambio-destino-card" data-id="${h._id}"
                onclick="seleccionarHabitacionParaReserva('${h._id}', this)"
                style="cursor:pointer;transition:box-shadow 0.15s,outline 0.15s;">
                <div class="habitacion-zona habitacion-zona-cabecera">
                    <div class="habitacion-header">
                        <div class="habitacion-numero-badge">
                            <i class="fas fa-door-closed"></i>
                            <span>${h.numero}</span>
                        </div>
                        <div class="habitacion-estado-etiqueta">
                            <i class="fas fa-check-circle"></i>
                            <span>DISPONIBLE</span>
                        </div>
                    </div>
                </div>
                <div class="habitacion-zona habitacion-zona-info">
                    <div class="habitacion-cuerpo">
                        <div class="habitacion-fila-titulo">
                            <h3 class="habitacion-titulo">${h.nombre}</h3>
                            ${textoSede ? `<span class="habitacion-sede-chip">${textoSede}</span>` : ''}
                        </div>
                        <div class="habitacion-fila-meta">
                            <div class="habitacion-capacidad">
                                <i class="fas fa-user-friends"></i>
                                <span>${h.capacidad}</span>
                            </div>
                            <div class="habitacion-precio">
                                <div style="font-weight:600;margin-bottom:4px;">${formatearPrecioTarjeta(h.precio_horas || 0)} x ${h.horas_base || 4}h</div>
                                <div style="font-size:11px;color:#666;line-height:1.4;">
                                    <div><strong>Noche (12h):</strong> ${formatearPrecioTarjeta(h.precio_noche || 0)}</div>
                                    <div><strong>Día (24h):</strong> ${formatearPrecioTarjeta(h.precio_dia || 0)}</div>
                                </div>
                            </div>
                        </div>
                        <div class="habitacion-campo-estado habitacion-campo-estado--muted">
                            <i class="fas fa-door-closed"></i>
                            <span>Sin huésped</span>
                        </div>
                    </div>
                </div>
            </div>`;
    }).join('');

    const modal = document.createElement('div');
    modal.id = 'modalSelectorReserva';
    modal.className = 'modal-overlay active';
    modal.style.zIndex = '25000';
    modal.innerHTML = `
        <div class="modal-container" style="max-width:700px;width:95vw;">
            <div class="modal-header">
                <h2><i class="fas fa-calendar-plus"></i> Nueva Reserva</h2>
                <button class="modal-close" onclick="cerrarSelectorReserva()"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
                <p style="margin-bottom:16px;font-size:13px;color:#666;">Seleccioná la habitación que querés reservar.</p>
                <div class="habitaciones-grid" style="max-height:55vh;overflow-y:auto;padding:4px 2px;">
                    ${tarjetasHTML}
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn-secondary" onclick="cerrarSelectorReserva()">Cancelar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) cerrarSelectorReserva(); });
}

function cerrarSelectorReserva() {
    const m = document.getElementById('modalSelectorReserva');
    if (m) m.remove();
}

function seleccionarHabitacionParaReserva(id, el) {
    // Marcar seleccionada
    document.querySelectorAll('.cambio-destino-card').forEach(c => {
        c.style.outline = '';
        c.style.boxShadow = '';
        const b = c.querySelector('.cambio-seleccion-badge');
        if (b) b.remove();
    });
    el.style.outline = '3px solid #000';
    el.style.boxShadow = '0 0 0 3px rgba(0,0,0,0.15)';
    el.style.position = 'relative';
    const badge = document.createElement('div');
    badge.className = 'cambio-seleccion-badge';
    badge.innerHTML = '<i class="fas fa-check"></i>';
    el.appendChild(badge);

    // Cerrar selector y abrir modal de reserva
    setTimeout(() => {
        cerrarSelectorReserva();
        const habitacion = habitaciones.find(h => h._id === id);
        if (habitacion) abrirModalOcuparMejorado(habitacion, true);
    }, 200);
}
