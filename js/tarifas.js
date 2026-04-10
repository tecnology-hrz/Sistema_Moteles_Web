let todasLasTarifas = [];
let todasLasSedes = [];
let filtroEstadoTarifa = 'todas';

function formatearPrecioTarifa(input) {
    let valor = input.value.replace(/\D/g, '');
    if (valor === '') { input.value = ''; return; }
    input.value = parseInt(valor).toLocaleString('en-US');
}

function obtenerValorPrecioTarifa(inputId) {
    const el = document.getElementById(inputId);
    return parseInt((el.value || '0').replace(/,/g, '')) || 0;
}

function formatearNumeroTarifa(n) {
    return '$' + (parseInt(n) || 0).toLocaleString('es-CO');
}

function esperarPywebview() {
    return new Promise(resolve => {
        if (typeof pywebview !== 'undefined' && pywebview.api) resolve();
        else {
            const check = setInterval(() => {
                if (typeof pywebview !== 'undefined' && pywebview.api) {
                    clearInterval(check);
                    resolve();
                }
            }, 50);
        }
    });
}

// Inicialización
window.addEventListener('DOMContentLoaded', async () => {
    await esperarPywebview();
    try {
        const sesion = await pywebview.api.cargar_sesion();
        if (sesion) {
            document.getElementById('userName').textContent = sesion.username;
            const userRoleEl = document.querySelector('.user-role');
            if (userRoleEl) userRoleEl.textContent = sesion.rol === 'admin' ? 'Administrador' : 'Empleado';
            localStorage.setItem('sesionActiva', JSON.stringify(sesion));

            if (sesion.rol !== 'admin' && sesion.permisos && !sesion.permisos.ver_tarifas) {
                window.location.href = 'dasboard-admin.html';
                return;
            }

            if (typeof inicializarPermisos === 'function') inicializarPermisos();

            await cargarSedes();
            await cargarTarifas();
        } else {
            window.location.href = 'login.html';
        }
    } catch (e) {
        console.error('Error al verificar sesión:', e);
        window.location.href = 'login.html';
    }
});

async function cargarSedes() {
    try {
        const res = await pywebview.api.obtener_sedes();
        if (res.success) {
            todasLasSedes = res.sedes;
            const sedeFilter = document.getElementById('sedeFilter');
            const sedeTarifa = document.getElementById('sedeTarifa');
            sedeFilter.innerHTML = '<option value="">Todas las sedes</option>';
            sedeTarifa.innerHTML = '<option value="TODAS">Todas las sedes</option>';
            todasLasSedes.forEach(s => {
                sedeFilter.innerHTML += `<option value="${s._id}">${s.nombre} - ${s.ciudad}</option>`;
                sedeTarifa.innerHTML += `<option value="${s._id}">${s.nombre} - ${s.ciudad}</option>`;
            });
        }
    } catch (e) { console.error('Error al cargar sedes:', e); }
}

async function cargarTarifas() {
    try {
        const res = await pywebview.api.obtener_tarifas();
        if (res.success) {
            todasLasTarifas = res.tarifas;
            renderizarTarifas();
        }
    } catch (e) { console.error('Error al cargar tarifas:', e); }
}

function renderizarTarifas() {
    const tbody = document.getElementById('tarifasTableBody');
    let tarifas = [...todasLasTarifas];

    const busqueda = (document.getElementById('searchInput').value || '').toLowerCase();
    if (busqueda) {
        tarifas = tarifas.filter(t => t.nombre.toLowerCase().includes(busqueda));
    }

    const sedeId = document.getElementById('sedeFilter').value;
    if (sedeId) {
        tarifas = tarifas.filter(t => t.sede_id === sedeId || !t.sede_id || t.sede_id === 'TODAS');
    }

    tarifas = tarifas.filter(t => t.activa !== false);

    if (tarifas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay tarifas registradas</td></tr>';
        return;
    }

    tbody.innerHTML = tarifas.map(t => {
        const sedeNombre = t.sede_nombre || 'Todas las sedes';
        const btnEditar = tienePermiso('editar_tarifas')
            ? `<button class="btn-icon btn-edit" onclick="editarTarifa('${t._id}')"><i class="fas fa-edit"></i> Editar</button>` : '';
        const btnEliminar = tienePermiso('eliminar_tarifas')
            ? `<button class="btn-icon btn-delete" onclick="confirmarEliminarTarifa('${t._id}', '${t.nombre}')"><i class="fas fa-trash"></i> Eliminar</button>` : '';

        return `
            <tr>
                <td><strong>${t.nombre}</strong></td>
                <td class="text-center">${t.horas || 0}h</td>
                <td class="text-center"><i class="fas fa-user-friends" style="font-size:11px;margin-right:4px;color:#666;"></i>${t.capacidad || 2}</td>
                <td>${formatearNumeroTarifa(t.precio)}</td>
                <td>${formatearNumeroTarifa(t.precio_hora_extra || 0)}</td>
                <td>${sedeNombre}</td>
                <td>
                    <div class="action-buttons">
                        ${btnEditar}${btnEliminar}
                    </div>
                </td>
            </tr>`;
    }).join('');
}

function filtrarTarifas() {
    renderizarTarifas();
}

function filtrarPorEstado(estado) {
    filtroEstadoTarifa = estado;
    var btnTodas = document.getElementById('btnTodas');
    var btnDesact = document.getElementById('btnDesactivadas');
    if (btnTodas) btnTodas.classList.toggle('active', estado === 'todas');
    if (btnDesact) btnDesact.classList.toggle('active', estado === 'desactivadas');
    renderizarTarifas();
}

function abrirModalNuevaTarifa() {
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-tags"></i> Nueva Tarifa';
    document.getElementById('formTarifa').reset();
    document.getElementById('tarifaId').value = '';
    document.getElementById('horasTarifa').value = '4';
    document.getElementById('capacidadTarifa').value = '2';
    document.getElementById('btnSubmitTarifa').innerHTML = '<i class="fas fa-plus"></i> Crear Tarifa';
    document.getElementById('modalTarifa').classList.add('active');
}

function editarTarifa(id) {
    const tarifa = todasLasTarifas.find(t => t._id === id);
    if (!tarifa) return;

    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-edit"></i> Editar Tarifa';
    document.getElementById('btnSubmitTarifa').innerHTML = '<i class="fas fa-save"></i> Guardar';
    document.getElementById('tarifaId').value = tarifa._id;
    document.getElementById('nombreTarifa').value = tarifa.nombre;
    document.getElementById('horasTarifa').value = tarifa.horas || 4;
    document.getElementById('capacidadTarifa').value = tarifa.capacidad || 2;
    document.getElementById('precioTarifa').value = (tarifa.precio || 0).toLocaleString('en-US');
    document.getElementById('precioHoraExtraTarifa').value = (tarifa.precio_hora_extra || 0).toLocaleString('en-US');
    document.getElementById('sedeTarifa').value = tarifa.sede_id || 'TODAS';
    document.getElementById('descripcionTarifa').value = tarifa.descripcion || '';
    document.getElementById('modalTarifa').classList.add('active');
}

function cerrarModalTarifa() {
    document.getElementById('modalTarifa').classList.remove('active');
}

async function guardarTarifa(event) {
    event.preventDefault();
    const id = document.getElementById('tarifaId').value;
    const datos = {
        nombre: document.getElementById('nombreTarifa').value.trim(),
        horas: parseInt(document.getElementById('horasTarifa').value) || 4,
        capacidad: parseInt(document.getElementById('capacidadTarifa').value) || 2,
        precio: obtenerValorPrecioTarifa('precioTarifa'),
        precio_hora_extra: obtenerValorPrecioTarifa('precioHoraExtraTarifa'),
        sede_id: document.getElementById('sedeTarifa').value || 'TODAS',
        descripcion: document.getElementById('descripcionTarifa').value.trim()
    };

    if (!datos.nombre) {
        mostrarModalConfirmacion('Por favor ingresa un nombre para la tarifa', null, true);
        return;
    }

    try {
        let res;
        if (id) {
            res = await pywebview.api.actualizar_tarifa(id, datos);
        } else {
            res = await pywebview.api.crear_tarifa(datos);
        }
        if (res.success) {
            cerrarModalTarifa();
            mostrarModalConfirmacion(res.message, null, true);
            await cargarTarifas();
        } else {
            mostrarModalConfirmacion(res.message, null, true);
        }
    } catch (e) {
        console.error('Error al guardar tarifa:', e);
        mostrarModalConfirmacion('Error al guardar la tarifa', null, true);
    }
}

function confirmarEliminarTarifa(id, nombre) {
    mostrarModalConfirmacion(
        `¿Estás seguro de eliminar la tarifa "${nombre}"?`,
        async () => {
            try {
                const res = await pywebview.api.eliminar_tarifa(id);
                if (res.success) {
                    mostrarModalConfirmacion(res.message, null, true);
                    await cargarTarifas();
                } else {
                    mostrarModalConfirmacion(res.message, null, true);
                }
            } catch (e) {
                mostrarModalConfirmacion('Error al eliminar la tarifa', null, true);
            }
        }
    );
}

async function toggleTarifa(id, activar) {
    try {
        const res = await pywebview.api.toggle_tarifa(id, activar);
        if (res.success) {
            mostrarModalConfirmacion(res.message, null, true);
            await cargarTarifas();
        } else {
            mostrarModalConfirmacion(res.message, null, true);
        }
    } catch (e) {
        mostrarModalConfirmacion('Error al cambiar estado de la tarifa', null, true);
    }
}

// Modal de confirmación
function mostrarModalConfirmacion(mensaje, onConfirm, soloInfo) {
    const existente = document.querySelector('.modal-overlay-confirm');
    if (existente) existente.remove();

    const html = `
        <div class="modal-overlay-confirm">
            <div class="modal-content-confirm">
                <div class="modal-icon-confirm">
                    <i class="fas ${soloInfo ? 'fa-info-circle' : 'fa-exclamation-triangle'}"></i>
                </div>
                <div class="modal-message-confirm">${mensaje}</div>
                <div class="modal-buttons-confirm">
                    ${soloInfo ? `
                        <button class="btn-confirm" onclick="this.closest('.modal-overlay-confirm').remove()">Aceptar</button>
                    ` : `
                        <button class="btn-cancel-confirm" onclick="this.closest('.modal-overlay-confirm').remove()">Cancelar</button>
                        <button class="btn-confirm" id="btnConfirmarAccion">Confirmar</button>
                    `}
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    if (!soloInfo && onConfirm) {
        document.getElementById('btnConfirmarAccion').addEventListener('click', () => {
            document.querySelector('.modal-overlay-confirm').remove();
            onConfirm();
        });
    }
}

function cerrarSesion() {
    if (typeof pywebview !== 'undefined' && pywebview.api) {
        pywebview.api.verificar_turno_activo().then(function(estado) {
            if (estado && estado.activo) {
                mostrarAlertaTurnoActivo();
                return;
            }
            localStorage.removeItem('sesionActiva');
            pywebview.api.cerrar_sesion().then(() => { window.location.href = 'login.html'; });
        }).catch(function() {
            localStorage.removeItem('sesionActiva');
            window.location.href = 'login.html';
        });
    } else {
        localStorage.removeItem('sesionActiva');
        window.location.href = 'login.html';
    }
}

function mostrarAlertaTurnoActivo() {
    var id = 'alertaTurnoActivo_' + Date.now();
    var html = '<div class="modal-overlay-confirm" id="' + id + '" style="display:flex;">' +
        '<div class="modal-content-confirm" style="max-width:380px;">' +
        '<div class="modal-icon-confirm" style="background:#fdecea;"><i class="fas fa-exclamation-circle" style="color:#e74c3c;"></i></div>' +
        '<h2 class="modal-title-confirm">Turno Activo</h2>' +
        '<p class="modal-message-confirm">No puedes cerrar sesión mientras tienes un turno activo. Registra la salida del turno primero.</p>' +
        '<div class="modal-buttons-confirm">' +
        '<button class="btn-confirm" style="width:100%;" onclick="document.getElementById(\'' + id + '\').remove()">Entendido</button>' +
        '</div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
}
