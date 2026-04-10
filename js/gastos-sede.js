// ===== VARIABLES GLOBALES =====
let gastos = [];
let sedes = [];
let filtroActivo = 'todos';
let sedeSeleccionada = '';
let calMes = new Date().getMonth();
let calAnio = new Date().getFullYear();

// ===== UTILIDADES =====
function esperarPywebview() {
    return new Promise(resolve => {
        if (typeof pywebview !== 'undefined' && pywebview.api) resolve();
        else window.addEventListener('pywebviewready', resolve);
    });
}

function formatearMilesGasto(input) {
    let v = input.value.replace(/\D/g, '');
    if (!v) { input.value = ''; return; }
    input.value = parseInt(v).toLocaleString('en-US');
}

function obtenerValorMonto() {
    return parseInt((document.getElementById('gastoMonto').value || '0').replace(/,/g, '')) || 0;
}

function formatearMoneda(n) {
    return '$' + parseInt(n || 0).toLocaleString('en-US');
}

function mostrarNotificacion(msg, tipo = 'success') {
    const n = document.createElement('div');
    n.className = `notificacion notificacion-${tipo}`;
    const iconos = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle' };
    n.innerHTML = `<i class="fas ${iconos[tipo] || 'fa-info-circle'}"></i><span>${msg}</span>`;
    document.body.appendChild(n);
    setTimeout(() => n.classList.add('mostrar'), 10);
    setTimeout(() => { n.classList.remove('mostrar'); setTimeout(() => n.remove(), 400); }, 3000);
}

function cerrarSesion() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay-confirm';
    overlay.id = 'confirmCerrarSesion';
    overlay.style.display = 'flex';
    overlay.innerHTML = `
        <div class="modal-content-confirm" style="max-width:380px;">
            <div class="modal-icon-confirm"><i class="fas fa-question-circle"></i></div>
            <h2 class="modal-title-confirm">Confirmación</h2>
            <p class="modal-message-confirm">¿Estás seguro de que deseas cerrar sesión?</p>
            <div class="modal-buttons-confirm">
                <button class="btn-cancel-confirm" onclick="document.getElementById('confirmCerrarSesion').remove()">Cancelar</button>
                <button class="btn-confirm" onclick="ejecutarCerrarSesion()">Aceptar</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
}

function ejecutarCerrarSesion() {
    localStorage.removeItem('sesionActiva');
    document.getElementById('confirmCerrarSesion')?.remove();
    if (typeof pywebview !== 'undefined' && pywebview.api) {
        pywebview.api.cerrar_sesion().then(() => { window.location.href = 'index.html'; });
    } else {
        window.location.href = 'index.html';
    }
}

// ===== INICIALIZACIÓN =====
window.addEventListener('DOMContentLoaded', async () => {
    await esperarPywebview();
    try {
        const sesion = await pywebview.api.cargar_sesion();
        if (!sesion) { window.location.href = 'index.html'; return; }
        document.getElementById('userName').textContent = sesion.username;
        const roleEl = document.querySelector('.user-role');
        if (roleEl) roleEl.textContent = sesion.rol === 'admin' ? 'Administrador' : 'Empleado';
        localStorage.setItem('sesionActiva', JSON.stringify(sesion));

        // Verificar permiso de acceso a la sección
        if (sesion.rol !== 'admin' && sesion.permisos && !sesion.permisos.ver_gastos) {
            window.location.href = 'dasboard-admin.html';
            return;
        }

        if (typeof inicializarPermisos === 'function') inicializarPermisos();

        // Ocultar botón registrar si no tiene permiso
        if (!tienePermiso('crear_gastos')) {
            document.querySelectorAll('[onclick*="abrirModalGasto"]').forEach(el => el.style.display = 'none');
        }

        await cargarSedes();
        await cargarGastos();
        renderizarCalendario();
    } catch (e) {
        console.error(e);
        window.location.href = 'index.html';
    }
});

// ===== CARGAR SEDES =====
async function cargarSedes() {
    try {
        const res = await pywebview.api.obtener_sedes();
        if (res.success) {
            sedes = res.sedes;
            const sel = document.getElementById('sedeSelector');
            const selForm = document.getElementById('gastoSede');
            sel.innerHTML = '<option value="">Todas las sedes</option>';
            selForm.innerHTML = '<option value="TODAS">Todas las sedes</option>';
            sedes.forEach(s => {
                sel.innerHTML += `<option value="${s._id}">${s.nombre} - ${s.ciudad}</option>`;
                selForm.innerHTML += `<option value="${s._id}">${s.nombre} - ${s.ciudad}</option>`;
            });
        }
    } catch (e) { console.error(e); }
}

// ===== CARGAR GASTOS =====
async function cargarGastos() {
    try {
        const res = await pywebview.api.obtener_gastos_sede(sedeSeleccionada || null);
        if (res.success) {
            gastos = res.gastos;
            renderizarGastos();
            actualizarResumen();
            renderizarVencimientos();
            renderizarCalendario();
        }
    } catch (e) { console.error(e); }
}

function cambiarSede(val) {
    sedeSeleccionada = val;
    cargarGastos();
}

// ===== RENDERIZAR GASTOS =====
function renderizarGastos() {
    const tbody = document.getElementById('gastosTableBody');
    const buscar = (document.getElementById('buscarGasto').value || '').toLowerCase();
    const hoy = new Date();

    let lista = [...gastos];

    // Filtro por tipo/periodo
    if (filtroActivo === 'semana') lista = lista.filter(g => g.tipo === 'semanal');
    else if (filtroActivo === 'mes') lista = lista.filter(g => g.tipo === 'mensual');
    else if (filtroActivo === 'unico') lista = lista.filter(g => g.tipo === 'unico');

    // Búsqueda
    if (buscar) lista = lista.filter(g =>
        g.descripcion.toLowerCase().includes(buscar) ||
        (g.sede_nombre || '').toLowerCase().includes(buscar) ||
        (g.categoria || '').toLowerCase().includes(buscar)
    );

    if (!lista.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="no-data">No hay gastos registrados</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map(g => {
        const badgeClase = { mensual: 'badge-mensual', semanal: 'badge-semanal', unico: 'badge-unico' }[g.tipo] || 'badge-unico';
        const tipoLabel = { mensual: 'Mensual', semanal: 'Semanal', unico: 'Único' }[g.tipo] || g.tipo;
        const diasInfo = calcularDiasRestantes(g, hoy);
        const sedeNombre = g.sede_nombre ? `${g.sede_nombre}` : '—';

        const acciones = [
            tienePermiso('editar_gastos') ? `<button class="btn-accion btn-accion-edit" onclick="editarGasto('${g._id}')" title="Editar"><i class="fas fa-edit"></i></button>` : '',
            tienePermiso('eliminar_gastos') ? `<button class="btn-accion btn-accion-del" onclick="confirmarEliminar('${g._id}')" title="Eliminar"><i class="fas fa-trash"></i></button>` : '',
        ].join('');

        return `<tr>
            <td>
                <div style="font-weight:600;color:#000;">${g.descripcion}</div>
                <div style="font-size:11px;color:#888;margin-top:2px;">${g.categoria || ''}</div>
            </td>
            <td style="font-weight:700;">${formatearMoneda(g.monto)}</td>
            <td><span class="badge-tipo ${badgeClase}">${tipoLabel}</span></td>
            <td>${diasInfo.html}</td>
            <td style="font-size:12px;">${sedeNombre}</td>
            <td>${acciones}</td>
        </tr>`;
    }).join('');
}

// ===== FORMATEAR FECHA LEGIBLE =====
function formatearFecha(fecha) {
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return `${fecha.getDate()} ${meses[fecha.getMonth()]} ${fecha.getFullYear()}`;
}

// ===== CALCULAR DÍAS RESTANTES =====
function calcularDiasRestantes(g, hoy) {
    if (g.tipo === 'unico') {
        if (!g.fecha_unico) return { dias: null, html: '<span style="color:#aaa;">—</span>' };
        const fecha = new Date(g.fecha_unico + 'T00:00:00');
        const diff = Math.ceil((fecha - hoy) / 86400000);
        const fechaStr = formatearFecha(fecha);
        if (diff < 0) return { dias: diff, html: `<div class="dias-restantes"><span class="dias-num dias-normal" style="color:#28a745;">✓ Pasado — ${fechaStr}</span></div>` };
        return buildDiasHtml(diff, fecha);
    }
    // Mensual o semanal
    const proxima = proximaFechaPago(g, hoy);
    if (!proxima) return { dias: null, html: '<span style="color:#aaa;">—</span>' };
    const diff = Math.ceil((proxima - hoy) / 86400000);
    return buildDiasHtml(diff, proxima);
}

function buildDiasHtml(diff, fecha) {
    let clase = 'dias-normal';
    let texto = `${diff} días`;
    if (diff === 0) { clase = 'dias-urgente'; texto = 'Hoy'; }
    else if (diff < 0) { clase = 'dias-vencido'; texto = 'Vencido'; }
    else if (diff <= 3) { clase = 'dias-urgente'; }
    else if (diff <= 7) { clase = 'dias-proximo'; }
    const fechaStr = fecha ? formatearFecha(fecha) : '';
    return {
        dias: diff,
        html: `<div class="dias-restantes"><span class="dias-num ${clase}">${texto}${fechaStr ? ` — ${fechaStr}` : ''}</span></div>`
    };
}

function proximaFechaPago(g, hoy) {
    const h = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    if (g.tipo === 'mensual' && g.dia_pago) {
        let d = new Date(h.getFullYear(), h.getMonth(), g.dia_pago);
        if (d < h) d = new Date(h.getFullYear(), h.getMonth() + 1, g.dia_pago);
        return d;
    }
    if (g.tipo === 'semanal' && g.dia_pago) {
        // dia_pago = 1-7 (lunes=1)
        const diaSemana = h.getDay() || 7; // 1=lun..7=dom
        let diff = g.dia_pago - diaSemana;
        if (diff <= 0) diff += 7;
        return new Date(h.getFullYear(), h.getMonth(), h.getDate() + diff);
    }
    return null;
}

// ===== RESUMEN =====
function actualizarResumen() {
    const hoy = new Date();
    const inicioSemana = new Date(hoy); inicioSemana.setDate(hoy.getDate() - hoy.getDay());
    const finSemana = new Date(inicioSemana); finSemana.setDate(inicioSemana.getDate() + 6);
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

    let totalSemana = 0, totalMes = 0, totalGeneral = 0;

    gastos.forEach(g => {
        totalGeneral += g.monto;
        const proxima = g.tipo === 'unico'
            ? (g.fecha_unico ? new Date(g.fecha_unico + 'T00:00:00') : null)
            : proximaFechaPago(g, hoy);
        if (proxima) {
            if (proxima >= inicioSemana && proxima <= finSemana) totalSemana += g.monto;
            if (proxima >= inicioMes && proxima <= finMes) totalMes += g.monto;
        }
    });

    document.getElementById('totalSemana').textContent = formatearMoneda(totalSemana);
    document.getElementById('totalMes').textContent = formatearMoneda(totalMes);
    document.getElementById('totalGeneral').textContent = formatearMoneda(totalGeneral);
}

// ===== VENCIMIENTOS =====
function renderizarVencimientos() {
    const lista = document.getElementById('vencimientosLista');
    const hoy = new Date();

    const items = gastos
        .map(g => {
            const proxima = g.tipo === 'unico'
                ? (g.fecha_unico ? new Date(g.fecha_unico + 'T00:00:00') : null)
                : proximaFechaPago(g, hoy);
            if (!proxima) return null;
            const diff = Math.ceil((proxima - hoy) / 86400000);
            return { ...g, diff, proxima };
        })
        .filter(g => g && g.diff >= -7 && g.diff <= 30)
        .sort((a, b) => a.diff - b.diff);

    if (!items.length) {
        lista.innerHTML = '<div class="no-vencimientos">Sin vencimientos en los próximos 30 días</div>';
        return;
    }

    lista.innerHTML = items.map(g => {
        let badgeClase = 'badge-normal';
        let diasTxt = `${g.diff}d`;
        if (g.diff < 0) { badgeClase = 'badge-vencido'; diasTxt = 'Venc.'; }
        else if (g.diff === 0) { badgeClase = 'badge-urgente'; diasTxt = 'Hoy'; }
        else if (g.diff <= 3) badgeClase = 'badge-urgente';
        else if (g.diff <= 7) badgeClase = 'badge-proximo';

        // Si ya pasó → verde (recordatorio pasado)
        if (g.diff < 0) badgeClase = 'badge-pasado';

        const fechaStr = formatearFecha(g.proxima);

        return `<div class="vencimiento-item">
            <div class="vencimiento-dias-badge ${badgeClase}">
                <span class="vencimiento-dias-num">${diasTxt}</span>
                <span class="vencimiento-dias-txt">${g.diff > 0 ? 'días' : g.diff === 0 ? '' : 'ok'}</span>
            </div>
            <div class="vencimiento-info">
                <div class="vencimiento-desc">${g.descripcion}</div>
                <div class="vencimiento-sede">${g.sede_nombre || '—'} · <strong>${fechaStr}</strong></div>
            </div>
            <div class="vencimiento-monto">${formatearMoneda(g.monto)}</div>
        </div>`;
    }).join('');
}

// ===== CALENDARIO =====
function renderizarCalendario() {
    const hoy = new Date();
    const grid = document.getElementById('calendarioGrid');
    const titulo = document.getElementById('calTitulo');

    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    titulo.textContent = `${meses[calMes]} ${calAnio}`;

    const primerDia = new Date(calAnio, calMes, 1).getDay();
    const diasEnMes = new Date(calAnio, calMes + 1, 0).getDate();

    // Mapear gastos a días del mes actual
    const gastosPorDia = {};
    gastos.forEach(g => {
        const proxima = g.tipo === 'unico'
            ? (g.fecha_unico ? new Date(g.fecha_unico + 'T00:00:00') : null)
            : proximaFechaPago(g, hoy);
        if (!proxima) return;
        if (proxima.getMonth() === calMes && proxima.getFullYear() === calAnio) {
            const d = proxima.getDate();
            if (!gastosPorDia[d]) gastosPorDia[d] = [];
            gastosPorDia[d].push(g);
        }
        // Para mensuales/semanales también mostrar ocurrencias anteriores del mes
        if (g.tipo === 'mensual' && g.dia_pago) {
            const d = g.dia_pago;
            if (d >= 1 && d <= diasEnMes) {
                if (!gastosPorDia[d]) gastosPorDia[d] = [];
                if (!gastosPorDia[d].find(x => x._id === g._id)) gastosPorDia[d].push(g);
            }
        }
    });

    let html = '';
    // Celdas vacías al inicio
    for (let i = 0; i < primerDia; i++) html += '<div class="cal-dia vacio"></div>';

    for (let d = 1; d <= diasEnMes; d++) {
        const esHoy = d === hoy.getDate() && calMes === hoy.getMonth() && calAnio === hoy.getFullYear();
        const tieneGasto = !!gastosPorDia[d];
        const diff = tieneGasto ? Math.ceil((new Date(calAnio, calMes, d) - hoy) / 86400000) : null;

        let clases = 'cal-dia';
        if (esHoy) clases += ' hoy';
        if (tieneGasto && !esHoy) {
            clases += ' tiene-gasto';
            if (diff < 0)       clases += ' gasto-pasado';
            else if (diff <= 3) clases += ' gasto-urgente';
            else if (diff <= 7) clases += ' gasto-proximo';
            else                clases += ' gasto-normal';
        }

        const onclick = tieneGasto ? `onclick="mostrarDiaDetalle(${d})"` : '';
        html += `<div class="${clases}" ${onclick}>${d}</div>`;
    }

    grid.innerHTML = html;
}

function navegarMes(dir) {
    calMes += dir;
    if (calMes > 11) { calMes = 0; calAnio++; }
    if (calMes < 0) { calMes = 11; calAnio--; }
    renderizarCalendario();
}

function mostrarDiaDetalle(dia) {
    const hoy = new Date();
    const diasEnMes = new Date(calAnio, calMes + 1, 0).getDate();
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

    document.getElementById('modalDiaTitulo').textContent = `Gastos — ${dia} de ${meses[calMes]} ${calAnio}`;

    const gastosDelDia = gastos.filter(g => {
        if (g.tipo === 'unico' && g.fecha_unico) {
            const f = new Date(g.fecha_unico + 'T00:00:00');
            return f.getDate() === dia && f.getMonth() === calMes && f.getFullYear() === calAnio;
        }
        if (g.tipo === 'mensual' && g.dia_pago) return g.dia_pago === dia;
        if (g.tipo === 'semanal' && g.dia_pago) {
            const proxima = proximaFechaPago(g, hoy);
            return proxima && proxima.getDate() === dia && proxima.getMonth() === calMes && proxima.getFullYear() === calAnio;
        }
        return false;
    });

    const contenido = document.getElementById('modalDiaContenido');
    if (!gastosDelDia.length) {
        contenido.innerHTML = '<p style="color:#aaa;text-align:center;padding:20px;">Sin gastos este día</p>';
    } else {
        contenido.innerHTML = gastosDelDia.map(g => `
            <div class="dia-gasto-item">
                <div>
                    <div class="dia-gasto-desc">${g.descripcion}</div>
                    <div class="dia-gasto-sede">${g.sede_nombre || '—'} · ${g.categoria || ''}</div>
                </div>
                <div class="dia-gasto-monto">${formatearMoneda(g.monto)}</div>
            </div>`).join('');
    }

    document.getElementById('modalDiaDetalle').style.display = 'flex';
}

function cerrarModalDia() {
    document.getElementById('modalDiaDetalle').style.display = 'none';
}

// ===== FILTROS =====
function filtrarPorPeriodo(tipo) {
    filtroActivo = tipo;
    document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
    const mapa = { todos: 'btnFiltroTodos', semana: 'btnFiltroSemana', mes: 'btnFiltroMes', unico: 'btnFiltroUnicos' };
    if (mapa[tipo]) document.getElementById(mapa[tipo]).classList.add('active');
    renderizarGastos();
}

// ===== MODAL GASTO =====
function abrirModalGasto() {
    document.getElementById('gastoId').value = '';
    document.getElementById('formGasto').reset();
    document.getElementById('modalGastoTitulo').textContent = 'Registrar Gasto';
    // Por defecto: Todas las sedes
    document.getElementById('gastoSede').value = 'TODAS';
    actualizarCamposFecha();
    document.getElementById('modalGasto').style.display = 'flex';
}

function cerrarModalGasto() {
    document.getElementById('modalGasto').style.display = 'none';
}

function actualizarCamposFecha() {
    const tipo = document.getElementById('gastoTipo').value;
    const campoPago = document.getElementById('campoFechaPago');
    const campoUnico = document.getElementById('campoFechaUnico');
    const labelPago = document.getElementById('labelFechaPago');
    const inputDia = document.getElementById('gastoDiaPago');

    if (tipo === 'unico') {
        campoPago.style.display = 'none';
        campoUnico.style.display = 'flex';
        inputDia.removeAttribute('required');
        document.getElementById('gastoFechaUnico').setAttribute('required', '');
    } else {
        campoPago.style.display = 'flex';
        campoUnico.style.display = 'none';
        document.getElementById('gastoFechaUnico').removeAttribute('required');
        inputDia.setAttribute('required', '');
        if (tipo === 'mensual') {
            labelPago.textContent = 'Día de pago (del mes) *';
            inputDia.min = 1; inputDia.max = 31;
            inputDia.placeholder = 'Ej: 15';
        } else {
            labelPago.textContent = 'Día de pago (1=Lun, 7=Dom) *';
            inputDia.min = 1; inputDia.max = 7;
            inputDia.placeholder = 'Ej: 5 (viernes)';
        }
    }
}

async function editarGasto(id) {
    const g = gastos.find(x => x._id === id);
    if (!g) return;
    document.getElementById('gastoId').value = g._id;
    document.getElementById('gastoDescripcion').value = g.descripcion;
    document.getElementById('gastoMonto').value = parseInt(g.monto).toLocaleString('en-US');
    document.getElementById('gastoTipo').value = g.tipo;
    document.getElementById('gastoSede').value = g.sede_id || 'TODAS';
    document.getElementById('gastoCategoria').value = g.categoria || 'otro';
    document.getElementById('gastoNotas').value = g.notas || '';
    actualizarCamposFecha();
    if (g.tipo === 'unico') {
        document.getElementById('gastoFechaUnico').value = g.fecha_unico || '';
    } else {
        document.getElementById('gastoDiaPago').value = g.dia_pago || '';
    }
    document.getElementById('modalGastoTitulo').textContent = 'Editar Gasto';
    document.getElementById('modalGasto').style.display = 'flex';
}

async function guardarGasto(e) {
    e.preventDefault();
    const id = document.getElementById('gastoId').value;
    const tipo = document.getElementById('gastoTipo').value;
    const datos = {
        descripcion: document.getElementById('gastoDescripcion').value.trim(),
        monto: obtenerValorMonto(),
        tipo,
        sede_id: document.getElementById('gastoSede').value,
        categoria: document.getElementById('gastoCategoria').value,
        notas: document.getElementById('gastoNotas').value.trim(),
        dia_pago: tipo !== 'unico' ? parseInt(document.getElementById('gastoDiaPago').value) || null : null,
        fecha_unico: tipo === 'unico' ? document.getElementById('gastoFechaUnico').value : null,
    };

    if (!datos.descripcion || !datos.monto) {
        mostrarNotificacion('Completa todos los campos requeridos', 'error');
        return;
    }

    try {
        let res;
        if (id) {
            res = await pywebview.api.actualizar_gasto_sede(id, datos);
        } else {
            res = await pywebview.api.crear_gasto_sede(datos);
        }
        if (res.success) {
            mostrarNotificacion(res.message || 'Gasto guardado', 'success');
            cerrarModalGasto();
            await cargarGastos();
        } else {
            mostrarNotificacion(res.message || 'Error al guardar', 'error');
        }
    } catch (err) {
        console.error(err);
        mostrarNotificacion('Error al guardar el gasto', 'error');
    }
}

async function confirmarEliminar(id) {
    const g = gastos.find(x => x._id === id);
    if (!g) return;
    // Reutilizar modal de confirmación del dashboard
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay-confirm';
    overlay.style.display = 'flex';
    overlay.innerHTML = `
        <div class="modal-content-confirm" style="max-width:400px;">
            <div class="modal-icon-confirm" style="background:#fdecea;"><i class="fas fa-trash" style="color:#dc3545;"></i></div>
            <h2 class="modal-title-confirm">Eliminar Gasto</h2>
            <p class="modal-message-confirm">¿Eliminar "<strong>${g.descripcion}</strong>"? Esta acción no se puede deshacer.</p>
            <div class="modal-buttons-confirm">
                <button class="btn-cancel-confirm" onclick="this.closest('.modal-overlay-confirm').remove()">Cancelar</button>
                <button class="btn-confirm" style="background:#dc3545;" onclick="eliminarGasto('${id}', this)">Eliminar</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
}

async function eliminarGasto(id, btn) {
    btn.closest('.modal-overlay-confirm').remove();
    try {
        const res = await pywebview.api.eliminar_gasto_sede(id);
        if (res.success) {
            mostrarNotificacion('Gasto eliminado', 'success');
            await cargarGastos();
        } else {
            mostrarNotificacion(res.message || 'Error al eliminar', 'error');
        }
    } catch (e) {
        mostrarNotificacion('Error al eliminar', 'error');
    }
}
