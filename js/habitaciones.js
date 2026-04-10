// Formatear precio con separador de miles
function formatearPrecio(input) {
    let valor = input.value.replace(/\D/g, '');
    if (valor === '') {
        input.value = '';
        return;
    }
    let numero = parseInt(valor);
    input.value = numero.toLocaleString('en-US');
}

function obtenerValorPrecio(inputId) {
    const precioInput = document.getElementById(inputId);
    return parseInt(precioInput.value.replace(/,/g, '') || '0');
}

function formatearNumero(numero) {
    return parseInt(numero).toLocaleString('en-US');
}

/** Precio para mostrar en tarjetas (formato tipo $45.000) */
function formatearPrecioTarjeta(numero) {
    const n = parseInt(numero, 10) || 0;
    return '$' + n.toLocaleString('es-CO');
}

// Esperar a que pywebview esté listo
function esperarPywebview() {
    return new Promise((resolve) => {
        if (typeof pywebview !== 'undefined' && pywebview.api) {
            resolve();
        } else {
            window.addEventListener('pywebviewready', () => {
                resolve();
            });
        }
    });
}

// Variables globales
let habitaciones = [];
let sedes = [];
let filtroEstado = 'todos';
let intervaloActualizacion = null;
/** Habitación mostrada en el modal de detalles (para imprimir tirilla). */
let habitacionEnDetalle = null;

// Verificar sesión al cargar
window.addEventListener('DOMContentLoaded', async () => {
    await esperarPywebview();

    try {
        const sesion = await pywebview.api.cargar_sesion();

        if (sesion) {
            document.getElementById('userName').textContent = sesion.username;
            // Actualizar rol en sidebar
            const userRoleEl = document.querySelector('.user-role');
            if (userRoleEl) userRoleEl.textContent = sesion.rol === 'admin' ? 'Administrador' : 'Empleado';
            localStorage.setItem('sesionActiva', JSON.stringify(sesion));

            // Verificar permiso de ver habitaciones
            if (sesion.rol !== 'admin' && sesion.permisos && !sesion.permisos.ver_habitaciones) {
                window.location.href = 'dasboard-admin.html';
                return;
            }

            // Aplicar permisos de navegación
            if (typeof inicializarPermisos === 'function') inicializarPermisos();

            // Aplicar permisos específicos de habitaciones
            aplicarPermisosHabitaciones(sesion);

            await cargarSedes();
            await cargarConfigLimpieza();

            // Si es empleado, forzar filtro a su sede
            if (sesion.rol !== 'admin') {
                await forzarSedeEmpleadoHabitaciones();
                await cargarHabitaciones();
            } else {
                await cargarTodasHabitaciones();
            }
        } else {
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error('Error al verificar sesión:', error);
        window.location.href = 'index.html';
    }
});

function aplicarPermisosHabitaciones(sesion) {
    if (sesion.rol === 'admin') return;
    var p = sesion.permisos || {};
    // Ocultar botón de nueva habitación
    if (!p.crear_habitaciones) {
        document.querySelectorAll('[onclick*="abrirModalNuevaHabitacion"]').forEach(function (el) { el.style.display = 'none'; });
    }
    // Ocultar botón de config limpieza
    if (!p.config_tiempo_limpieza) {
        document.querySelectorAll('[onclick*="abrirModalConfigLimpieza"]').forEach(function (el) { el.style.display = 'none'; });
    }
}

// Forzar filtro de sede para empleados en habitaciones
async function forzarSedeEmpleadoHabitaciones() {
    try {
        const resultado = await pywebview.api.obtener_sede_empleado();
        if (resultado.success && resultado.sede) {
            const sedeFilter = document.getElementById('sedeFilter');
            sedeFilter.value = resultado.sede._id;
            // Ocultar el selector de sedes para empleados
            const sedeFilterContainer = sedeFilter.closest('.sede-filter') || sedeFilter.parentElement;
            if (sedeFilterContainer) sedeFilterContainer.style.display = 'none';
        }
    } catch (e) {
        console.error('Error al obtener sede del empleado:', e);
    }
}


// Cargar sedes
async function cargarSedes() {
    try {
        const resultado = await pywebview.api.obtener_sedes();

        if (resultado.success) {
            sedes = resultado.sedes;

            // Llenar select de filtro
            const sedeFilter = document.getElementById('sedeFilter');
            sedeFilter.innerHTML = '<option value="">Todas las sedes</option>';
            sedes.forEach(sede => {
                sedeFilter.innerHTML += `<option value="${sede._id}">${sede.nombre} - ${sede.ciudad}</option>`;
            });

            const sedeHabitacion = document.getElementById('sedeHabitacion');
            sedeHabitacion.innerHTML = '<option value="">Todas las sedes</option>';
            sedes.forEach(sede => {
                sedeHabitacion.innerHTML += `<option value="${sede._id}">${sede.nombre} - ${sede.ciudad}</option>`;
            });
        }
    } catch (error) {
        console.error('Error al cargar sedes:', error);
    }
}

// Cargar todas las habitaciones (al inicio)
async function cargarTodasHabitaciones() {
    try {
        const resultado = await pywebview.api.obtener_habitaciones();

        if (resultado.success) {
            habitaciones = resultado.habitaciones;
            actualizarEstadisticas(habitaciones);
            renderizarHabitaciones();
        } else {
            mostrarModalConfirmacion('Error al cargar habitaciones', null, true);
        }
    } catch (error) {
        console.error('Error al cargar habitaciones:', error);
        mostrarModalConfirmacion('Error al cargar habitaciones', null, true);
    }
}

// Cargar habitaciones (cuando se selecciona una sede)
async function cargarHabitaciones() {
    const sedeId = document.getElementById('sedeFilter').value;
    await cargarConfigLimpieza();

    if (!sedeId) {
        // Si no hay sede seleccionada, mostrar todas
        await cargarTodasHabitaciones();
        return;
    }

    try {
        const resultado = await pywebview.api.obtener_habitaciones_por_sede(sedeId);

        if (resultado.success) {
            habitaciones = resultado.habitaciones;
            actualizarEstadisticas(habitaciones);
            renderizarHabitaciones();

        } else {
            mostrarModalConfirmacion('Error al cargar habitaciones', null, true);
        }
    } catch (error) {
        console.error('Error al cargar habitaciones:', error);
        mostrarModalConfirmacion('Error al cargar habitaciones', null, true);
    }
}

// Actualizar estadísticas
function actualizarEstadisticas(habitaciones) {
    const total = habitaciones.length;
    const ocupadas = habitaciones.filter(h => h.estado === 'ocupada').length;
    const disponibles = habitaciones.filter(h => h.estado === 'disponible').length;
    const limpieza = habitaciones.filter(h => h.estado === 'limpieza').length;
    const reservadas = habitaciones.filter(h => h.estado === 'reservada').length;
    const reparacion = habitaciones.filter(h => h.estado === 'reparacion').length;

    document.getElementById('statOcupadas').textContent = ocupadas;
    document.getElementById('statDisponibles').textContent = disponibles;
    document.getElementById('statLimpieza').textContent = limpieza;
    document.getElementById('statReservadas').textContent = reservadas;
    document.getElementById('statReparacion').textContent = reparacion;

    document.querySelectorAll('[id^="totalHabitaciones"]').forEach(el => {
        el.textContent = total;
    });

    if (total > 0) {
        const porcOcupadas = Math.round((ocupadas / total) * 100);
        const porcDisponibles = Math.round((disponibles / total) * 100);
        const porcLimpieza = Math.round((limpieza / total) * 100);
        const porcReservadas = Math.round((reservadas / total) * 100);
        const porcReparacion = Math.round((reparacion / total) * 100);

        document.getElementById('barOcupadas').style.width = porcOcupadas + '%';
        document.getElementById('barDisponibles').style.width = porcDisponibles + '%';
        document.getElementById('barLimpieza').style.width = porcLimpieza + '%';
        document.getElementById('barReservadas').style.width = porcReservadas + '%';
        document.getElementById('barReparacion').style.width = porcReparacion + '%';

        document.getElementById('porcentajeOcupadas').textContent = porcOcupadas + '% de ocupación';
        document.getElementById('porcentajeDisponibles').textContent = porcDisponibles + '% disponible';
        document.getElementById('porcentajeLimpieza').textContent = porcLimpieza + '% en proceso';
        document.getElementById('porcentajeReservadas').textContent = porcReservadas + '% próximas llegadas';
        document.getElementById('porcentajeReparacion').textContent = porcReparacion + '% en reparación';
    } else {
        document.querySelectorAll('.stat-bar-fill').forEach(bar => bar.style.width = '0%');
        document.getElementById('porcentajeOcupadas').textContent = '0% de ocupación';
        document.getElementById('porcentajeDisponibles').textContent = '0% disponible';
        document.getElementById('porcentajeLimpieza').textContent = '0% en proceso';
        document.getElementById('porcentajeReservadas').textContent = '0% próximas llegadas';
        document.getElementById('porcentajeReparacion').textContent = '0% en reparación';
    }
}


// Calcular tiempo de limpieza
function calcularTiempoLimpieza(fechaLimpieza, posicionCola = 0, sedeId = null) {
    const minutosBase = _minutosParaSede(sedeId);
    const minutosTotal = minutosBase * (posicionCola + 1);
    if (!fechaLimpieza) {
        return { transcurrido: '0min', restante: `${minutosTotal}min` };
    }

    const ahora = typeof fechaColombia === 'function' ? fechaColombia() : new Date();
    const inicio = typeof fechaColombia === 'function' ? fechaColombia(fechaLimpieza) : new Date(fechaLimpieza);
    const tiempoFin = new Date(inicio.getTime() + minutosTotal * 60 * 1000);
    const transcurridoMs = ahora - inicio;
    const restanteMs = tiempoFin - ahora;

    const minutosTranscurridos = Math.floor(transcurridoMs / (1000 * 60));
    const segundosTranscurridos = Math.floor((transcurridoMs % (1000 * 60)) / 1000);
    const minutosRestantes = Math.max(0, Math.floor(restanteMs / (1000 * 60)));
    const segundosRestantes = Math.max(0, Math.floor((restanteMs % (1000 * 60)) / 1000));

    return {
        transcurrido: `${minutosTranscurridos}min ${segundosTranscurridos}seg`,
        restante: minutosRestantes > 0 || segundosRestantes > 0
            ? `${minutosRestantes}min ${segundosRestantes}seg`
            : 'Completado'
    };
}

// Actualizar contadores de limpieza en tiempo real
function actualizarContadoresLimpieza() {
    const habitacionesEnLimpieza = document.querySelectorAll('.habitacion-campo-estado--limpieza');

    habitacionesEnLimpieza.forEach(elemento => {
        const habitacionId = elemento.getAttribute('data-habitacion-id');
        const fechaLimpieza = elemento.getAttribute('data-fecha-limpieza');
        const posicionCola = parseInt(elemento.getAttribute('data-posicion-cola') || '0', 10);
        const sedeId = elemento.getAttribute('data-sede-id') || null;

        if (fechaLimpieza) {
            const tiempos = calcularTiempoLimpieza(fechaLimpieza, posicionCola, sedeId);
            const elementoRestante = document.getElementById(`tiempo-restante-${habitacionId}`);

            if (elementoRestante) {
                elementoRestante.textContent = tiempos.restante;

                if (tiempos.restante === 'Completado') {
                    const sedeFilter = document.getElementById('sedeFilter').value;
                    if (sedeFilter) {
                        cargarHabitaciones();
                    } else {
                        cargarTodasHabitaciones();
                    }
                }
            }
        }
    });
}

// Renderizar habitaciones
function renderizarHabitaciones() {
    const grid = document.getElementById('habitacionesGrid');

    console.log('Renderizando habitaciones:', habitaciones.length);
    if (habitaciones.length > 0) {
        console.log('Primera habitación:', habitaciones[0]);
    }

    // Limpiar intervalo anterior si existe
    if (intervaloActualizacion) {
        clearInterval(intervaloActualizacion);
    }

    if (habitaciones.length === 0) {
        const sedeSeleccionada = document.getElementById('sedeFilter').value;
        const mensaje = sedeSeleccionada ?
            'No hay habitaciones registradas en esta sede' :
            'No hay habitaciones registradas en ninguna sede';

        grid.innerHTML = `
            <div class="loading-message">
                <i class="fas fa-door-open"></i> ${mensaje}
            </div>
        `;
        return;
    }

    let habitacionesFiltradas = habitaciones;

    if (filtroEstado !== 'todos') {
        habitacionesFiltradas = habitaciones.filter(h => h.estado === filtroEstado);
    }

    if (habitacionesFiltradas.length === 0) {
        grid.innerHTML = `
            <div class="loading-message">
                <i class="fas fa-filter"></i> No hay habitaciones con este estado
            </div>
        `;
        return;
    }

    const sedeFiltroActual = document.getElementById('sedeFilter').value;

    // Calcular posición de cola para habitaciones en limpieza (por sede, ordenadas por fecha_limpieza)
    const colaLimpieza = habitacionesFiltradas
        .filter(h => h.estado === 'limpieza')
        .sort((a, b) => new Date(a.fecha_limpieza || 0) - new Date(b.fecha_limpieza || 0));
    const posicionColaMap = {};
    // Agrupar por sede para que la cola sea independiente por sede
    const contadorPorSede = {};
    colaLimpieza.forEach((h) => {
        const sedeKey = h.sede_id || '__sin_sede__';
        if (contadorPorSede[sedeKey] === undefined) contadorPorSede[sedeKey] = 0;
        posicionColaMap[h._id] = contadorPorSede[sedeKey];
        contadorPorSede[sedeKey]++;
    });

    grid.innerHTML = habitacionesFiltradas.map(h => {
        const estadoTexto = {
            'disponible': 'DISPONIBLE',
            'ocupada': 'OCUPADA',
            'limpieza': 'LIMPIEZA',
            'reservada': 'RESERVADA',
            'reparacion': 'REPARACIÓN'
        }[h.estado] || 'DISPONIBLE';

        const iconoEtiquetaEstado = {
            'disponible': 'fa-check-circle',
            'ocupada': 'fa-user',
            'limpieza': 'fa-broom',
            'reservada': 'fa-lock',
            'reparacion': 'fa-tools'
        }[h.estado] || 'fa-check-circle';

        let campoEstadoHTML = '';
        if (h.estado === 'ocupada' && h.placa) {
            // Determinar icono según tipo de vehículo
            let iconoVehiculo = 'fa-car';
            let textoVehiculo = h.placa;
            let mostrarColor = true;
            let colorVehiculo = h.color_vehiculo || h.color || '#CCCCCC';

            if (h.tipo_vehiculo === 'moto') {
                iconoVehiculo = 'fa-motorcycle';
            } else if (h.tipo_vehiculo === 'taxi') {
                iconoVehiculo = 'fa-taxi';
                textoVehiculo = 'Taxi';
                colorVehiculo = '#FFD700'; // Amarillo para taxi
            } else if (h.tipo_vehiculo === 'otro') {
                iconoVehiculo = 'fa-question';
                textoVehiculo = 'Otro';
                mostrarColor = false;
            }

            campoEstadoHTML = `
            <div class="habitacion-campo-estado habitacion-campo-estado--ocupada">
                <i class="fas ${iconoVehiculo}"></i>
                <span>${textoVehiculo}</span>
                ${mostrarColor ? `<div class="vehiculo-color-circle" style="background: ${colorVehiculo};" title="${h.color || colorVehiculo}"></div>` : ''}
            </div>`;
        } else if (h.estado === 'ocupada') {
            campoEstadoHTML = `
            <div class="habitacion-campo-estado habitacion-campo-estado--ocupada">
                <i class="fas fa-car"></i>
                <span>Sin placa registrada</span>
            </div>`;
        } else if (h.estado === 'disponible') {
            campoEstadoHTML = `
            <div class="habitacion-campo-estado habitacion-campo-estado--muted">
                <i class="fas fa-door-closed"></i>
                <span>Sin huésped</span>
            </div>`;
        } else if (h.estado === 'limpieza') {
            // Calcular tiempo de limpieza con posición en cola
            const posCol = posicionColaMap[h._id] || 0;
            const tiempoLimpieza = calcularTiempoLimpieza(h.fecha_limpieza, posCol, h.sede_id);
            campoEstadoHTML = `
            <div class="habitacion-campo-estado habitacion-campo-estado--limpieza" data-habitacion-id="${h._id}" data-fecha-limpieza="${h.fecha_limpieza || ''}" data-posicion-cola="${posCol}" data-sede-id="${h.sede_id || ''}">
                <i class="fas fa-broom"></i>
                <span class="limpieza-valor" id="tiempo-restante-${h._id}">${tiempoLimpieza.restante}</span>
            </div>`;
        } else if (h.estado === 'reservada') {
            campoEstadoHTML = `
            <div class="habitacion-campo-estado habitacion-campo-estado--muted">
                <i class="fas fa-lock"></i>
                <span>Reservada</span>
            </div>`;
        } else if (h.estado === 'reparacion') {
            campoEstadoHTML = `
            <div class="habitacion-campo-estado habitacion-campo-estado--reparacion">
                <i class="fas fa-tools"></i>
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${h.motivo_reparacion || 'En reparación'}</span>
            </div>`;
        }

        const textoSedeCompleto = [h.sede_nombre, h.sede_ciudad].filter(Boolean).join(' ').trim();
        const mostrarChipSede = !sedeFiltroActual && textoSedeCompleto;

        const accionesHTML = (() => {
            if (h.estado === 'disponible') {
                return `
                        <button type="button" class="habitacion-btn-acciones" onclick="abrirMenuAcciones('${h._id}', 'disponible')">
                            <i class="fas fa-ellipsis-h"></i> Acciones
                        </button>`;
            }
            if (h.estado === 'ocupada') {
                return `
                        <button type="button" class="habitacion-btn-acciones" onclick="abrirMenuAcciones('${h._id}', 'ocupada')">
                            <i class="fas fa-ellipsis-h"></i> Acciones
                        </button>`;
            }
            if (h.estado === 'limpieza') {
                return `
                        <button type="button" class="habitacion-btn btn-marcar-disponible" onclick="marcarDisponible('${h._id}')">
                            <i class="fas fa-check"></i> Marcar Disponible
                        </button>`;
            }
            if (h.estado === 'reparacion') {
                return `
                        <button type="button" class="habitacion-btn-acciones" onclick="abrirMenuAcciones('${h._id}', 'reparacion')">
                            <i class="fas fa-ellipsis-h"></i> Acciones
                        </button>`;
            }
            return `
                        <button type="button" class="habitacion-btn btn-detalles" onclick="verDetalles('${h._id}')">
                            <i class="fas fa-eye"></i> Detalles
                        </button>
                        <button type="button" class="habitacion-btn btn-reservar" onclick="reservarHabitacion('${h._id}')">
                            <i class="fas fa-calendar-alt"></i> Reservar
                        </button>`;
        })();

        return `
            <div class="habitacion-card ${h.estado}">
                <div class="habitacion-zona habitacion-zona-cabecera">
                    <div class="habitacion-header">
                        <div class="habitacion-numero-badge">
                            <i class="fas fa-door-closed"></i>
                            <span>${h.numero}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div class="habitacion-estado-etiqueta">
                                <i class="fas ${iconoEtiquetaEstado}"></i>
                                <span>${estadoTexto}</span>
                            </div>
                            <button type="button" class="habitacion-btn-icon" onclick="editarHabitacion('${h._id}')" title="Editar habitación" style="background: transparent; border: none; color: #666; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: all 0.2s;${tienePermiso('editar_habitaciones') ? '' : ' display:none;'}">
                                <i class="fas fa-edit" style="font-size: 14px;"></i>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="habitacion-zona habitacion-zona-info">
                    <div class="habitacion-cuerpo">
                        <div class="habitacion-fila-titulo">
                            <h3 class="habitacion-titulo">${h.nombre}</h3>
                            ${mostrarChipSede ? `<span class="habitacion-sede-chip">${textoSedeCompleto}</span>` : ''}
                        </div>
                        <div class="habitacion-fila-meta">
                            <div class="habitacion-capacidad">
                                <i class="fas fa-user-friends"></i>
                                <span>${h.capacidad}</span>
                            </div>
                            <div class="habitacion-precio">
                                <div style="font-weight: 600; margin-bottom: 4px;">${formatearPrecioTarjeta(h.precio_horas || h.precio_base || h.precio || 0)} x ${h.horas_base || 4}h</div>
                                <div style="font-size: 11px; color: #666; line-height: 1.4;">
                                    <div><strong>Noche (12h):</strong> ${formatearPrecioTarjeta(h.precio_noche || 0)}</div>
                                    <div><strong>Día (24h):</strong> ${formatearPrecioTarjeta(h.precio_dia || 0)}</div>
                                </div>
                            </div>
                        </div>
                        ${campoEstadoHTML}
                    </div>
                </div>
                <div class="habitacion-zona habitacion-zona-acciones">
                    <div class="habitacion-acciones ${h.estado === 'limpieza' ? 'habitacion-acciones--una' : ''}">
                        ${accionesHTML}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Iniciar actualización de contadores cada segundo si hay habitaciones en limpieza
    const hayHabitacionesEnLimpieza = habitacionesFiltradas.some(h => h.estado === 'limpieza');
    if (hayHabitacionesEnLimpieza) {
        intervaloActualizacion = setInterval(actualizarContadoresLimpieza, 1000);
    }
}

// Filtrar por estado
function filtrarPorEstado(estado) {
    filtroEstado = estado;

    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    document.querySelector(`[data-estado="${estado}"]`).classList.add('active');

    renderizarHabitaciones();
}

function toggleFiltros() {
    // Placeholder para futura funcionalidad de filtros avanzados
}


// Abrir modal para nueva habitación
async function abrirModalNuevaHabitacion() {
    const sedeId = document.getElementById('sedeFilter').value;

    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-door-closed"></i> Nueva Habitación';
    document.getElementById('formHabitacion').reset();
    document.getElementById('habitacionId').value = '';

    // Cambiar texto del botón guardar
    const btnGuardar = document.querySelector('#formHabitacion button[type="submit"]');
    if (btnGuardar) {
        btnGuardar.innerHTML = '<i class="fas fa-save"></i> Guardar';
    }

    // Ocultar botón de eliminar en modo creación
    const btnEliminar = document.getElementById('btnEliminarHabitacion');
    if (btnEliminar) {
        btnEliminar.style.display = 'none';
    }

    // Si hay una sede seleccionada, pre-seleccionarla en el formulario
    if (sedeId) {
        document.getElementById('sedeHabitacion').value = sedeId;
    }

    // Generar número consecutivo automático basado en la sede
    await generarNumeroConsecutivo(sedeId);

    // Establecer valores por defecto
    document.getElementById('precioHoras').value = '30,000';
    document.getElementById('horasBase').value = '4';
    document.getElementById('precioHoraExtra').value = '5,000';
    document.getElementById('precioNoche').value = '';
    document.getElementById('precioDia').value = '';

    document.getElementById('modalHabitacion').classList.add('active');
}

// Generar número consecutivo automático
async function generarNumeroConsecutivo(sedeId = null) {
    try {
        const resultado = await pywebview.api.obtener_siguiente_numero_habitacion(sedeId);
        if (resultado.success) {
            document.getElementById('numero').value = resultado.numero;
            // Hacer el campo de solo lectura para nuevas habitaciones
            document.getElementById('numero').readOnly = true;

            // Auto-generar nombre sugerido
            document.getElementById('nombre').value = `Cabaña ${resultado.numero}`;
        }
    } catch (error) {
        console.error('Error al generar número:', error);
    }
}

// Actualizar número cuando cambia la sede en el modal
async function actualizarNumeroSegunSede() {
    // Solo actualizar si no estamos editando (habitacionId vacío)
    const habitacionId = document.getElementById('habitacionId').value;
    if (!habitacionId) {
        const sedeId = document.getElementById('sedeHabitacion').value;
        await generarNumeroConsecutivo(sedeId);
    }
}

// Editar habitación
async function editarHabitacion(id) {
    const habitacion = habitaciones.find(h => h._id === id);

    if (habitacion) {
        document.getElementById('modalTitle').innerHTML = '<i class="fas fa-edit"></i> Editar Habitación';
        document.getElementById('habitacionId').value = habitacion._id;
        document.getElementById('numero').value = habitacion.numero;
        document.getElementById('numero').readOnly = false; // Permitir editar número en habitaciones existentes
        document.getElementById('nombre').value = habitacion.nombre;
        const cap = Math.min(5, Math.max(1, parseInt(habitacion.capacidad, 10) || 2));
        document.getElementById('capacidad').value = String(cap);
        document.getElementById('precioHoras').value = formatearNumero(habitacion.precio_horas || habitacion.precio_base || habitacion.precio || 0);
        document.getElementById('horasBase').value = habitacion.horas_base || 4;
        document.getElementById('precioHoraExtra').value = formatearNumero(habitacion.precio_hora_extra || 0);
        document.getElementById('precioNoche').value = formatearNumero(habitacion.precio_noche || 0);
        document.getElementById('precioDia').value = formatearNumero(habitacion.precio_dia || 0);
        document.getElementById('sedeHabitacion').value = habitacion.sede_id;
        document.getElementById('descripcion').value = habitacion.descripcion || '';

        // Cambiar texto del botón guardar
        const btnGuardar = document.querySelector('#formHabitacion button[type="submit"]');
        if (btnGuardar) {
            btnGuardar.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
        }

        // Mostrar/ocultar botón de eliminar según permisos
        const btnEliminar = document.getElementById('btnEliminarHabitacion');
        if (btnEliminar) {
            if (tienePermiso('eliminar_habitaciones')) {
                btnEliminar.style.display = 'inline-flex';
                btnEliminar.onclick = () => eliminarHabitacionDesdeModal(id);
            } else {
                btnEliminar.style.display = 'none';
            }
        }

        document.getElementById('modalHabitacion').classList.add('active');
    }
}

// Guardar habitación
async function guardarHabitacion(event) {
    event.preventDefault();

    const habitacionId = document.getElementById('habitacionId').value;
    const sedeSeleccionada = document.getElementById('sedeHabitacion').value;

    const capRaw = parseInt(document.getElementById('capacidad').value, 10);
    const capacidad = Math.min(5, Math.max(1, Number.isFinite(capRaw) ? capRaw : 2));

    const datos = {
        numero: document.getElementById('numero').value,
        nombre: document.getElementById('nombre').value,
        capacidad,
        precio_horas: obtenerValorPrecio('precioHoras'),
        horas_base: parseInt(document.getElementById('horasBase').value) || 4,
        precio_hora_extra: obtenerValorPrecio('precioHoraExtra'),
        precio_noche: obtenerValorPrecio('precioNoche'),
        precio_dia: obtenerValorPrecio('precioDia'),
        sede_id: sedeSeleccionada || 'TODAS',
        descripcion: document.getElementById('descripcion').value || '',
        estado: 'disponible'
    };

    console.log('Datos a guardar:', datos);

    try {
        let resultado;

        if (habitacionId) {
            // Al editar, no permitir cambiar a "TODAS"
            if (datos.sede_id === 'TODAS') {
                mostrarModalConfirmacion('No puedes cambiar una habitación existente a "Todas las sedes"', null, true);
                return;
            }
            console.log('Actualizando habitación:', habitacionId);
            resultado = await pywebview.api.actualizar_habitacion(habitacionId, datos);
        } else {
            console.log('Creando nueva habitación');
            resultado = await pywebview.api.crear_habitacion(datos);
        }

        console.log('Resultado:', resultado);

        if (resultado.success) {
            mostrarModalConfirmacion(resultado.message, null, true);
            cerrarModal();

            // Recargar según el filtro actual
            const sedeFilter = document.getElementById('sedeFilter').value;
            if (sedeFilter) {
                await cargarHabitaciones();
            } else {
                await cargarTodasHabitaciones();
            }
        } else {
            mostrarModalConfirmacion(resultado.message, null, true);
        }
    } catch (error) {
        console.error('Error al guardar habitación:', error);
        mostrarModalConfirmacion('Error al guardar la habitación', null, true);
    }
}

// Ver detalles
function verDetalles(id) {
    const habitacion = habitaciones.find(h => h._id === id);

    if (!habitacion) return;
    habitacionEnDetalle = habitacion;

    const estadoTexto = {
        'disponible': 'Disponible',
        'ocupada': 'Ocupada',
        'limpieza': 'En Limpieza',
        'reservada': 'Reservada'
    }[habitacion.estado] || 'Disponible';

    const contenido = `
        <div class="detalle-section">
            <h3><i class="fas fa-door-closed"></i> Información General</h3>
            <div class="detalle-row">
                <span class="detalle-label">Número:</span>
                <span class="detalle-valor">${habitacion.numero}</span>
            </div>
            <div class="detalle-row">
                <span class="detalle-label">Nombre:</span>
                <span class="detalle-valor">${habitacion.nombre}</span>
            </div>
            <div class="detalle-row">
                <span class="detalle-label">Capacidad:</span>
                <span class="detalle-valor">${habitacion.capacidad} personas</span>
            </div>
            <div class="detalle-row">
                <span class="detalle-label">Estado:</span>
                <span class="detalle-valor">${estadoTexto}</span>
            </div>
            ${habitacion.estado === 'ocupada' && habitacion.usuario_ocupacion ? `
            <div class="detalle-row">
                <span class="detalle-label">Registrñ la ocupación:</span>
                <span class="detalle-valor">${habitacion.usuario_ocupacion}</span>
            </div>
            ` : ''}
        </div>
        
        <div class="detalle-section">
            <h3><i class="fas fa-dollar-sign"></i> Tarifa seleccionada</h3>
            ${(() => {
            const tipo = habitacion.tipo_ocupacion || 'horas';
            const precioAcordado = habitacion.precio_acordado;
            const precioHoraExtra = habitacion.precio_hora_extra || 0;

            let labelTipo = '';
            let precioBase = 0;

            if (tipo === 'varios_dias') {
                const dias = habitacion.dias_personalizados || 2;
                labelTipo = `Varios días (${dias} días)`;
                precioBase = precioAcordado || (habitacion.precio_dia || 0) * dias;
            } else if (tipo === 'dia') {
                labelTipo = 'Día (24h)';
                precioBase = precioAcordado || habitacion.precio_dia || 0;
            } else if (tipo === 'noche') {
                labelTipo = 'Noche (12h)';
                precioBase = precioAcordado || habitacion.precio_noche || 0;
            } else {
                labelTipo = `Estándar (${habitacion.horas_base || 4}h)`;
                precioBase = precioAcordado || habitacion.precio_horas || habitacion.precio_base || habitacion.precio || 0;
            }

            return `
                <div class="detalle-row">
                    <span class="detalle-label">Tipo:</span>
                    <span class="detalle-valor">${labelTipo}</span>
                </div>
                <div class="detalle-row">
                    <span class="detalle-label">Precio acordado:</span>
                    <span class="detalle-valor">$${formatearNumero(precioBase)}</span>
                </div>
                <div class="detalle-row">
                    <span class="detalle-label">Hora extra:</span>
                    <span class="detalle-valor">$${formatearNumero(precioHoraExtra)}</span>
                </div>`;
        })()}
        </div>
        
        <div class="detalle-section">
            <h3><i class="fas fa-map-marker-alt"></i> Ubicación</h3>
            <div class="detalle-row">
                <span class="detalle-label">Sede:</span>
                <span class="detalle-valor">${habitacion.sede_nombre || 'Sin sede'}</span>
            </div>
        </div>
        
        ${habitacion.estado === 'ocupada' && habitacion.consumos_ocupacion && habitacion.consumos_ocupacion.length ? `
        <div class="detalle-section">
            <h3><i class="fas fa-box-open"></i> Consumos en habitación</h3>
            ${habitacion.consumos_ocupacion.map(c => `
            <div class="detalle-row">
                <span class="detalle-label">${c.nombre} (${c.cantidad} u.)${c.usuario_registro ? ` ñ ${c.usuario_registro}` : ''}</span>
                <span class="detalle-valor">$${formatearNumero(Math.round(Number(c.subtotal) || 0))}</span>
            </div>
            `).join('')}
            <div class="detalle-row">
                <span class="detalle-label"><strong>Total consumos</strong></span>
                <span class="detalle-valor"><strong>$${formatearNumero(Math.round(totalConsumosHabitacion(habitacion)))}</strong></span>
            </div>
        </div>
        ` : ''}
        ${habitacion.placa ? `
        <div class="detalle-section">
            <h3><i class="fas fa-car"></i> Vehículo</h3>
            <div class="detalle-row">
                <span class="detalle-label">Placa:</span>
                <span class="detalle-valor">${habitacion.placa}</span>
            </div>
            <div class="detalle-row">
                <span class="detalle-label">Color:</span>
                <span class="detalle-valor">${habitacion.color || 'N/A'}</span>
            </div>
            ${habitacion.descripcion ? `
            <div class="detalle-row">
                <span class="detalle-label">Descripción:</span>
                <span class="detalle-valor">${habitacion.descripcion}</span>
            </div>
            ` : ''}
        </div>
        ` : ''}
    `;

    document.getElementById('detallesContainer').innerHTML = contenido;
    document.getElementById('modalDetalles').classList.add('active');
}

// ----- Tirilla cuenta habitación (mismo enfoque que gestión de productos: iframe 80mm + print) -----
function textoMovimientoBitacoraHabitacion(desc) {
    if (desc == null || desc === '') return '';
    let s = String(desc);
    s = s.replace(/^Consumo\s*:\s*/i, '');
    s = s.replace(/ñ/g, 'x');
    s = s.replace(/\)+\s*$/g, ')');
    return s.trim();
}

function escaparTextoTirilla(texto) {
    if (texto == null || texto === '') return '';
    return String(texto)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function tirillaCalcularTiempoTranscurrido(fechaIngreso) {
    const ahora = typeof fechaColombia === 'function' ? fechaColombia() : new Date();
    const ingreso = typeof fechaColombia === 'function' ? fechaColombia(fechaIngreso) : new Date(fechaIngreso);
    const diff = ahora - ingreso;
    const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
    const horas = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    let texto = '';
    if (dias > 0) texto += `${dias}d `;
    if (horas > 0 || dias > 0) texto += `${horas}h `;
    texto += `${minutos}m`;
    return {
        dias,
        horas: horas + dias * 24,
        minutos,
        texto: texto.trim(),
        totalHoras: dias * 24 + horas + minutos / 60,
    };
}

function tirillaFormatearFecha(fecha) {
    const d = typeof fechaColombia === 'function' ? fechaColombia(fecha) : new Date(fecha);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const año = d.getFullYear();
    let horas = d.getHours();
    const minutos = String(d.getMinutes()).padStart(2, '0');
    const ampm = horas >= 12 ? 'pm' : 'am';
    horas = horas % 12;
    horas = horas ? horas : 12;
    const horaFormateada = String(horas).padStart(2, '0');
    return `${dia}/${mes}/${año} ${horaFormateada}:${minutos} ${ampm}`;
}

function tirillaCalcularSalidaEsperada(habitacion) {
    const ingreso = typeof fechaColombia === 'function' ? fechaColombia(habitacion.fecha_ingreso) : new Date(habitacion.fecha_ingreso);
    const tipoOcupacion = habitacion.tipo_ocupacion || 'horas';
    let horasEsperadas;
    if (tipoOcupacion === 'varios_dias') {
        horasEsperadas = (habitacion.dias_personalizados || 2) * 24;
    } else if (tipoOcupacion === 'dia') {
        horasEsperadas = 24;
    } else if (tipoOcupacion === 'noche') {
        horasEsperadas = 12;
    } else {
        horasEsperadas = habitacion.horas_base || 4;
    }
    return new Date(ingreso.getTime() + horasEsperadas * 60 * 60 * 1000);
}

function tirillaCalcularCostoEstimado(habitacion, tiempo) {
    const totalHoras = tiempo.totalHoras;
    const tipoOcupacion = habitacion.tipo_ocupacion || 'horas';
    if (tipoOcupacion === 'varios_dias') {
        const precioAcordado = habitacion.precio_acordado || 0;
        const diasPersonalizados = habitacion.dias_personalizados || 2;
        const duracionEsperada = diasPersonalizados * 24;
        if (totalHoras > duracionEsperada) {
            const horasExtras = Math.ceil(totalHoras - duracionEsperada);
            const precioHoraExtra = habitacion.precio_hora_extra || 5000;
            return precioAcordado + horasExtras * precioHoraExtra;
        }
        return precioAcordado;
    }
    if (tipoOcupacion === 'dia') {
        const precioDia = habitacion.precio_acordado || habitacion.precio_dia || 100000;
        if (totalHoras > 24) {
            const horasExtras = Math.ceil(totalHoras - 24);
            const precioHoraExtra = habitacion.precio_hora_extra || 5000;
            return precioDia + horasExtras * precioHoraExtra;
        }
        return precioDia;
    }
    if (tipoOcupacion === 'noche') {
        const precioNoche = habitacion.precio_acordado || habitacion.precio_noche || 80000;
        if (totalHoras > 12) {
            const horasExtras = Math.ceil(totalHoras - 12);
            const precioHoraExtra = habitacion.precio_hora_extra || 5000;
            return precioNoche + horasExtras * precioHoraExtra;
        }
        return precioNoche;
    }
    const horasBase = habitacion.horas_base || 4;
    const precioBase = habitacion.precio_acordado || habitacion.precio_horas || habitacion.precio_base || habitacion.precio || 30000;
    const precioHoraExtra = habitacion.precio_hora_extra || 5000;
    if (totalHoras <= horasBase) {
        return precioBase;
    }
    const horasExtras = Math.ceil(totalHoras - horasBase);
    return precioBase + horasExtras * precioHoraExtra;
}

function tirillaTextoTipoOcupacion(habitacion) {
    const tipoOcupacion = habitacion.tipo_ocupacion || 'horas';
    if (tipoOcupacion === 'varios_dias') {
        const dias = habitacion.dias_personalizados || 2;
        return `Varios días (${dias} días)`;
    }
    if (tipoOcupacion === 'dia') return 'Día (24h)';
    if (tipoOcupacion === 'noche') return 'Noche (12h)';
    const horasBase = habitacion.horas_base || 4;
    return `Estándar (${horasBase}h)`;
}

function imprimirTirillaCuentaHabitacion() {
    if (!habitacionEnDetalle) {
        mostrarModalConfirmacion('Abrñ primero los detalles de una habitación.', null, true);
        return;
    }
    const h = habitacionEnDetalle;
    const sedeMeta = sedes.find((s) => String(s._id) === String(h.sede_id));
    const nombreSede = escaparTextoTirilla(h.sede_nombre || sedeMeta?.nombre || 'Sede');
    const ciudadSede = escaparTextoTirilla(sedeMeta?.ciudad || '');
    const nombreHab = escaparTextoTirilla(h.nombre || 'Habitación');
    const numHab = escaparTextoTirilla(String(h.numero ?? '—'));

    function armarBloqueVehiculoNota() {
        if (h.placa) {
            let v =
                '<div class="recibo-divisor"></div>' +
                '<div class="recibo-subtitulo-seccion">VEHÍCULO:</div>' +
                '<div class="recibo-linea"><span>Placa</span><span>' +
                escaparTextoTirilla(h.placa) +
                '</span></div>' +
                '<div class="recibo-linea"><span>Color</span><span>' +
                escaparTextoTirilla(h.color || '—') +
                '</span></div>';
            if (h.descripcion) {
                v +=
                    '<div class="recibo-linea recibo-linea--nota"><span>Nota</span></div>' +
                    '<div class="recibo-texto-nota">' +
                    escaparTextoTirilla(h.descripcion) +
                    '</div>';
            }
            return v;
        }
        if (h.descripcion) {
            return (
                '<div class="recibo-divisor"></div>' +
                '<div class="recibo-seccion-fila">' +
                '<span class="recibo-seccion-titulo">NOTA:</span>' +
                '<span class="recibo-seccion-valor">ñ</span></div>' +
                '<div class="recibo-texto-nota">' +
                escaparTextoTirilla(h.descripcion) +
                '</div>'
            );
        }
        return '';
    }

    let reciboHtml = '';
    if (h.estado === 'ocupada' && h.fecha_ingreso) {
        const tiempo = tirillaCalcularTiempoTranscurrido(h.fecha_ingreso);
        const salidaPrev = tirillaCalcularSalidaEsperada(h);
        const subHosp = tirillaCalcularCostoEstimado(h, tiempo);
        const subCons = totalConsumosHabitacion(h);
        const totalEst = subHosp + subCons;
        const consumos = h.consumos_ocupacion || [];
        const tipoElegido = escaparTextoTirilla(tirillaTextoTipoOcupacion(h));
        const precioHoraExtra = Math.round(Number(h.precio_hora_extra) || 0);

        // Calcular descuento si existe precio personalizado
        const tipoOcupacion = h.tipo_ocupacion || 'horas';
        let precioEstandar = 0;
        let precioAcordado = 0;
        let tieneDescuento = false;

        if (tipoOcupacion === 'varios_dias') {
            const dias = h.dias_personalizados || 2;
            precioEstandar = (h.precio_dia || 100000) * dias;
            precioAcordado = h.precio_acordado || precioEstandar;
            tieneDescuento = precioAcordado < precioEstandar;
        } else if (tipoOcupacion === 'dia') {
            precioEstandar = h.precio_dia || 100000;
            precioAcordado = h.precio_acordado || precioEstandar;
            tieneDescuento = precioAcordado < precioEstandar;
        } else if (tipoOcupacion === 'noche') {
            precioEstandar = h.precio_noche || 80000;
            precioAcordado = h.precio_acordado || precioEstandar;
            tieneDescuento = precioAcordado < precioEstandar;
        } else {
            precioEstandar = h.precio_horas || h.precio_base || h.precio || 30000;
            precioAcordado = h.precio_acordado || precioEstandar;
            tieneDescuento = precioAcordado < precioEstandar;
        }

        const descuento = tieneDescuento ? precioEstandar - precioAcordado : 0;
        const textoConsumosDer =
            consumos.length === 0
                ? 'Sin productos'
                : consumos.length === 1
                    ? '1 producto'
                    : `${consumos.length} productos`;
        let consumosLineas = '';
        consumos.forEach((c) => {
            const nombre = escaparTextoTirilla(c.nombre || 'ñtem');
            const sub = Math.round(Number(c.subtotal) || 0);
            const cant = Number(c.cantidad) || 0;
            const por = c.usuario_registro ? ' <span style="font-size:8px">(' + escaparTextoTirilla(c.usuario_registro) + ')</span>' : '';
            consumosLineas +=
                '<div class="recibo-linea recibo-linea--item"><span>' +
                nombre +
                ' ñ' +
                cant +
                por +
                '</span><span>$' +
                formatearNumero(sub) +
                '</span></div>';
        });
        const movs = h.movimientos_cuenta || [];
        let movimientosLineas = '';
        movs.forEach((m) => {
            let fh = '—';
            if (m.fecha) {
                try {
                    fh = tirillaFormatearFecha(m.fecha);
                } catch (e) {
                    fh = String(m.fecha);
                }
            }
            movimientosLineas +=
                '<div class="recibo-linea recibo-linea--item"><span><strong>' +
                escaparTextoTirilla(fh) +
                '</strong><br>' +
                escaparTextoTirilla(textoMovimientoBitacoraHabitacion(m.descripcion)) +
                '<br><span style="font-size:8px">' +
                escaparTextoTirilla(m.usuario || '—') +
                '</span></span><span>$' +
                formatearNumero(Math.round(Number(m.valor) || 0)) +
                '</span></div>';
        });
        reciboHtml =
            '<div class="recibo-unico">' +
            '<div class="recibo-linea"><span>Nombre</span><span>' +
            nombreHab +
            '</span></div>' +
            '<div class="recibo-linea"><span>Nñ habitación</span><span>' +
            numHab +
            '</span></div>' +
            '<div class="recibo-linea"><span>Fecha entrada</span><span>' +
            tirillaFormatearFecha(h.fecha_ingreso) +
            '</span></div>' +
            '<div class="recibo-linea"><span>Registrñ ocupación</span><span>' +
            escaparTextoTirilla(h.usuario_ocupacion || '—') +
            '</span></div>' +
            '<div class="recibo-linea"><span>Fecha salida (prevista)</span><span>' +
            tirillaFormatearFecha(salidaPrev) +
            '</span></div>' +
            '<div class="recibo-linea"><span>Hora extra (cada hora)</span><span>$' +
            formatearNumero(precioHoraExtra) +
            '</span></div>' +
            '<div class="recibo-divisor"></div>' +
            '<div class="recibo-seccion-fila">' +
            '<span class="recibo-seccion-titulo">HOSPEDAJE:</span>' +
            '<span class="recibo-seccion-valor">' +
            tipoElegido +
            '</span></div>' +
            (tieneDescuento ?
                '<div class="recibo-linea"><span>Precio estándar</span><span>$' +
                formatearNumero(Math.round(precioEstandar)) +
                '</span></div>' +
                '<div class="recibo-linea"><span>Descuento aplicado</span><span>-$' +
                formatearNumero(Math.round(descuento)) +
                '</span></div>' +
                '<div class="recibo-linea"><span>Precio acordado</span><span>$' +
                formatearNumero(Math.round(precioAcordado)) +
                '</span></div>'
                : '') +
            (function () {
                var _t = tirillaCalcularTiempoTranscurrido(h.fecha_ingreso);
                var _tipoOc = h.tipo_ocupacion || 'horas';
                var _horasEsp = _tipoOc === 'varios_dias' ? (h.dias_personalizados || 2) * 24 : _tipoOc === 'dia' ? 24 : _tipoOc === 'noche' ? 12 : (h.horas_base || 4);
                var _hExtras = _t.totalHoras > _horasEsp ? Math.ceil(_t.totalHoras - _horasEsp) : 0;
                var _costoHE = _hExtras * precioHoraExtra;
                return '<div class="recibo-linea"><span>Costo horas extra</span><span>$' + formatearNumero(Math.round(_costoHE)) + '</span></div>';
            })() +
            '<div class="recibo-linea"><span>Subtotal hospedaje</span><span>$' +
            formatearNumero(Math.round(subHosp)) +
            '</span></div>' +
            '<div class="recibo-divisor"></div>' +
            '<div class="recibo-seccion-fila">' +
            '<span class="recibo-seccion-titulo">CONSUMOS:</span>' +
            '<span class="recibo-seccion-valor">' +
            escaparTextoTirilla(textoConsumosDer) +
            '</span></div>' +
            (consumos.length
                ? consumosLineas +
                '<div class="recibo-linea recibo-linea--sub"><span>Subtotal consumos</span><span>$' +
                formatearNumero(Math.round(subCons)) +
                '</span></div>'
                : '<div class="recibo-sin-items">Sin productos registrados</div>') +
            '<div class="recibo-divisor recibo-divisor--grueso"></div>' +
            '<div class="recibo-total"><span>TOTAL A PAGAR</span><span>$' +
            formatearNumero(Math.round(totalEst)) +
            '</span></div>' +
            '<p class="recibo-legal">Referencia hasta facturar en caja. Hospedaje estimado según tiempo transcurrido.</p>' +
            armarBloqueVehiculoNota() +
            '</div>';
    } else {
        reciboHtml =
            '<div class="recibo-unico">' +
            '<div class="recibo-linea"><span>Nombre</span><span>' +
            nombreHab +
            '</span></div>' +
            '<div class="recibo-linea"><span>Nñ habitación</span><span>' +
            numHab +
            '</span></div>' +
            '<p class="recibo-msg-vacio">Con la habitación ocupada se imprime precio, consumos y total.</p>' +
            armarBloqueVehiculoNota() +
            '</div>';
    }

    const contenidoHTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Detalle habitación ñ ${nombreHab}</title>
<style>
@page { size: 80mm auto; margin: 0; }
body { font-family: 'Courier New', Consolas, monospace; margin: 0; padding: 12px; width: 80mm; font-size: 11px; color: #000; background: #fff; }
.header { text-align: center; margin-bottom: 10px; border-bottom: 2px solid #000; padding-bottom: 8px; }
.header h1 { margin: 0 0 4px 0; font-size: 15px; font-weight: 700; letter-spacing: 0.02em; }
.header h2 { margin: 2px 0; font-size: 12px; font-weight: 700; }
.header .subtitulo { margin: 4px 0 0 0; font-size: 10px; color: #333; }
.recibo-unico { border: 2px solid #000; padding: 10px 10px 12px; margin: 0 0 12px 0; background: #fff; }
.recibo-linea { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 10px; margin-bottom: 5px; }
.recibo-linea span:first-child { font-weight: 600; color: #222; flex-shrink: 0; }
.recibo-linea span:last-child { text-align: right; font-weight: 600; }
.recibo-linea--item span:first-child { font-weight: 500; text-align: left; flex: 1; }
.recibo-linea--item span:last-child { font-weight: 600; }
.recibo-linea--sub { margin-top: 6px; padding-top: 6px; border-top: 1px solid #ccc; font-weight: 700; }
.recibo-linea--sub span:last-child { font-weight: 700; }
.recibo-linea--nota { margin-bottom: 2px; }
.recibo-seccion-fila { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin: 8px 0 6px 0; }
.recibo-seccion-titulo { font-size: 9px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #000; flex-shrink: 0; }
.recibo-seccion-valor { font-size: 9px; font-weight: 600; color: #333; text-align: right; flex: 1; min-width: 0; word-break: break-word; }
.recibo-subtitulo-seccion { font-size: 9px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #000; margin: 8px 0 5px 0; }
.recibo-divisor { border: 0; border-top: 1px solid #bbb; margin: 8px 0; }
.recibo-divisor--grueso { border-top: 2px solid #000; margin: 10px 0 8px; opacity: 1; }
.recibo-total { display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 700; padding: 2px 0; }
.recibo-total span:last-child { font-size: 14px; font-weight: 700; }
.recibo-legal { font-size: 7px; color: #444; margin: 8px 0 0; line-height: 1.35; text-align: center; }
.recibo-sin-items { font-size: 9px; color: #555; font-style: italic; text-align: center; padding: 6px 4px; }
.recibo-texto-nota { font-size: 9px; line-height: 1.35; white-space: pre-wrap; word-break: break-word; margin-top: 2px; }
.recibo-msg-vacio { font-size: 9px; color: #444; text-align: center; margin: 10px 0 4px; line-height: 1.35; }
.footer { margin-top: 10px; text-align: center; font-size: 9px; border-top: 1px solid #000; padding-top: 8px; }
.footer-line { margin: 2px 0; }
@media print { body { padding: 8px; } }
</style>
</head>
<body>
<div class="header">
<h1>DETALLE DE HABITACIÓN</h1>
<h2>${nombreSede}</h2>
${ciudadSede ? `<div class="subtitulo">${ciudadSede}</div>` : ''}
</div>
${reciboHtml}
<div class="footer">
<div class="footer-line">Sistema de gestión de moteles</div>
<div class="footer-line">${nombreSede}</div>
</div>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    iframe.contentDocument.open();
    iframe.contentDocument.write(contenidoHTML);
    iframe.contentDocument.close();
    setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => {
            document.body.removeChild(iframe);
        }, 1000);
    }, 500);
}

// Eliminar habitación desde el modal de edición
async function eliminarHabitacionDesdeModal(id) {
    const habitacion = habitaciones.find(h => h._id === id);

    if (!habitacion) return;

    if (habitacion.estado === 'ocupada') {
        mostrarModalConfirmacion('No puedes eliminar una habitación ocupada', null, true);
        return;
    }

    cerrarModal();

    mostrarModalConfirmacion(
        `¿Estás seguro de que deseas eliminar la habitación "${habitacion.nombre}"?`,
        async () => {
            try {
                const resultado = await pywebview.api.eliminar_habitacion(id);

                if (resultado.success) {
                    mostrarModalConfirmacion(resultado.message, null, true);

                    // Recargar según el filtro actual
                    const sedeFilter = document.getElementById('sedeFilter').value;
                    if (sedeFilter) {
                        await cargarHabitaciones();
                    } else {
                        await cargarTodasHabitaciones();
                    }
                } else {
                    mostrarModalConfirmacion(resultado.message, null, true);
                }
            } catch (error) {
                console.error('Error al eliminar habitación:', error);
                mostrarModalConfirmacion('Error al eliminar la habitación', null, true);
            }
        }
    );
}

// Eliminar habitación
async function eliminarHabitacion(id) {
    if (!tienePermiso('eliminar_habitaciones')) {
        mostrarModalConfirmacion('No tienes permiso para eliminar habitaciones', null, true);
        return;
    }
    const habitacion = habitaciones.find(h => h._id === id);

    if (habitacion.estado === 'ocupada') {
        mostrarModalConfirmacion('No puedes eliminar una habitación ocupada', null, true);
        return;
    }

    mostrarModalConfirmacion(
        `¿Estás seguro de que deseas eliminar la habitación "${habitacion.nombre}"?`,
        async () => {
            try {
                const resultado = await pywebview.api.eliminar_habitacion(id);

                if (resultado.success) {
                    mostrarModalConfirmacion(resultado.message, null, true);

                    // Recargar según el filtro actual
                    const sedeFilter = document.getElementById('sedeFilter').value;
                    if (sedeFilter) {
                        await cargarHabitaciones();
                    } else {
                        await cargarTodasHabitaciones();
                    }
                } else {
                    mostrarModalConfirmacion(resultado.message, null, true);
                }
            } catch (error) {
                console.error('Error al eliminar habitación:', error);
                mostrarModalConfirmacion('Error al eliminar la habitación', null, true);
            }
        }
    );
}

// Cerrar modales
function cerrarModal() {
    document.getElementById('modalHabitacion').classList.remove('active');
}

function cerrarModalDetalles() {
    habitacionEnDetalle = null;
    document.getElementById('modalDetalles').classList.remove('active');
}

// -- Configuración tiempo de limpieza --
let _minutosLimpiezaConfig = 15;
// Mapa de minutos por sede_id
let _minutosPorSede = {};

async function cargarConfigLimpieza() {
    try {
        const sedeId = document.getElementById('sedeFilter').value || null;
        if (sedeId) {
            const res = await pywebview.api.obtener_tiempo_limpieza(sedeId);
            if (res && res.success) {
                _minutosLimpiezaConfig = res.minutos;
                _minutosPorSede[sedeId] = res.minutos;
            }
        } else {
            // Cargar tiempos de todas las sedes
            for (const sede of sedes) {
                const res = await pywebview.api.obtener_tiempo_limpieza(sede._id);
                if (res && res.success) _minutosPorSede[sede._id] = res.minutos;
            }
            _minutosLimpiezaConfig = 15;
        }
    } catch (e) { }
}

function _minutosParaSede(sedeId) {
    if (sedeId && _minutosPorSede[sedeId] !== undefined) return _minutosPorSede[sedeId];
    return _minutosLimpiezaConfig;
}

function abrirModalConfigLimpieza() {
    const sedeId = document.getElementById('sedeFilter').value;
    const sedeSel = sedes.find(s => s._id === sedeId);
    const nombreSede = sedeSel ? sedeSel.nombre : 'todas las sedes';

    const opcionesSedes = sedes.map(s =>
        `<option value="${s._id}" ${s._id === sedeId ? 'selected' : ''}>${s.nombre}${s.ciudad ? ' - ' + s.ciudad : ''}</option>`
    ).join('');

    const modalHTML = `
        <div class="modal-overlay active" id="modalConfigLimpieza" style="z-index:30000;">
            <div class="modal-container" style="max-width:380px;">
                <div class="modal-header">
                    <h2><i class="fas fa-cog"></i> Tiempo de limpieza</h2>
                    <button class="modal-close" onclick="cerrarModalConfigLimpieza()"><i class="fas fa-times"></i></button>
                </div>
                <div class="modal-body" style="display:flex;flex-direction:column;gap:14px;">
                    <div class="form-group" style="margin:0;">
                        <label>Sede</label>
                        <select id="configLimpieza_sede" onchange="actualizarMinutosConfigLimpieza()" style="width:100%;padding:10px;border-radius:8px;border:1.5px solid #ccc;font-size:14px;">
                            ${opcionesSedes}
                        </select>
                    </div>
                    <div class="form-group" style="margin:0;">
                        <label>Minutos por habitación</label>
                        <input type="number" id="inputMinutosLimpieza" min="1" max="120" value="${_minutosLimpiezaConfig}"
                            style="width:100%;padding:10px;border-radius:8px;border:1.5px solid #ccc;font-size:16px;text-align:center;">
                    </div>
                    <p style="font-size:12px;color:#888;margin:0;" id="configLimpiezaEjemplo">Ejemplo con ${_minutosLimpiezaConfig} min: 1ª = ${_minutosLimpiezaConfig}min · 2ª = ${_minutosLimpiezaConfig * 2}min · 3ª = ${_minutosLimpiezaConfig * 3}min</p>
                    <p style="font-size:12px;color:#666;margin:0;">Si hay varias en limpieza se aplica en cola: 1ñ = 1ñ, 2ñ = 2ñ, 3ñ = 3ׅ</p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="cerrarModalConfigLimpieza()">Cancelar</button>
                    <button type="button" class="btn-primary" onclick="guardarConfigLimpieza()">
                        <i class="fas fa-save"></i> Guardar
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Actualizar el input al cambiar de sede
    document.getElementById('inputMinutosLimpieza').addEventListener('input', () => {
        const v = parseInt(document.getElementById('inputMinutosLimpieza').value) || 0;
        const ej = document.getElementById('configLimpiezaEjemplo');
        if (ej && v > 0) ej.textContent = `Ejemplo con ${v} min: 1ª = ${v}min · 2ª = ${v * 2}min · 3ª = ${v * 3}min`;
    });
}

function cerrarModalConfigLimpieza() {
    const m = document.getElementById('modalConfigLimpieza');
    if (m) m.remove();
}

async function actualizarMinutosConfigLimpieza() {
    const sedeId = document.getElementById('configLimpieza_sede').value;
    try {
        const res = await pywebview.api.obtener_tiempo_limpieza(sedeId || null);
        if (res && res.success) {
            document.getElementById('inputMinutosLimpieza').value = res.minutos;
            const ej = document.getElementById('configLimpiezaEjemplo');
            if (ej) ej.textContent = `Ejemplo con ${res.minutos} min: 1ñ = ${res.minutos}min ñ 2ñ = ${res.minutos * 2}min ñ 3ñ = ${res.minutos * 3}min`;
        }
    } catch (e) { }
}

async function guardarConfigLimpieza() {
    const sedeId = document.getElementById('configLimpieza_sede').value;
    const val = parseInt(document.getElementById('inputMinutosLimpieza').value);
    if (!val || val < 1) {
        mostrarModalConfirmacion('Ingresñ un valor válido (mínimo 1 minuto)', null, true);
        return;
    }
    try {
        const res = await pywebview.api.guardar_tiempo_limpieza(val, sedeId || null);
        if (res && res.success) {
            _minutosLimpiezaConfig = val;
            cerrarModalConfigLimpieza();
            mostrarModalConfirmacion(res.message, null, true);
        } else {
            mostrarModalConfirmacion((res && res.message) || 'Error al guardar', null, true);
        }
    } catch (e) {
        mostrarModalConfirmacion('Error de conexión', null, true);
    }
}

// Cerrar sesión
function cerrarSesion() {
    mostrarModalConfirmacion(
        '¿Estás seguro de que deseas cerrar sesión?',
        () => {
            localStorage.removeItem('sesionActiva');

            if (typeof pywebview !== 'undefined' && pywebview.api) {
                pywebview.api.cerrar_sesion().then(() => {
                    window.location.href = 'index.html';
                });
            } else {
                window.location.href = 'index.html';
            }
        }
    );
}

// Modal de confirmación
function mostrarModalConfirmacion(mensaje, onConfirm, soloInfo = false) {
    const iconos = {
        'confirmacion': 'fa-question-circle',
        'success': 'fa-check-circle',
        'error': 'fa-exclamation-circle',
        'warning': 'fa-exclamation-triangle',
        'info': 'fa-info-circle'
    };

    const colores = {
        'confirmacion': '#856404',
        'success': '#155724',
        'error': '#721c24',
        'warning': '#856404',
        'info': '#004085'
    };

    const fondos = {
        'confirmacion': '#fff3cd',
        'success': '#d4edda',
        'error': '#f8d7da',
        'warning': '#fff3cd',
        'info': '#d1ecf1'
    };

    const tipoModal = soloInfo ? (mensaje.toLowerCase().includes('error') ? 'error' :
        mensaje.toLowerCase().includes('correctamente') || mensaje.toLowerCase().includes('exitosamente') ? 'success' :
            mensaje.toLowerCase().includes('advertencia') ? 'warning' : 'info') : 'confirmacion';

    const modalHTML = `
        <div class="modal-overlay-confirm" id="confirmModal" style="display: flex; z-index: 30000;">
            <div class="modal-content-confirm">
                <div class="modal-icon-confirm" style="background: ${fondos[tipoModal]};">
                    <i class="fas ${iconos[tipoModal]}" style="color: ${colores[tipoModal]};"></i>
                </div>
                <h2 class="modal-title-confirm">${soloInfo ? (tipoModal === 'success' ? 'Éxito' : tipoModal === 'error' ? 'Error' : tipoModal === 'warning' ? 'Advertencia' : 'Información') : 'Confirmación'}</h2>
                <p class="modal-message-confirm">${mensaje}</p>
                <div class="modal-buttons-confirm">
                    ${soloInfo ?
            '<button class="btn-confirm" onclick="cerrarModalConfirmacion()" style="width: 100%;">Aceptar</button>' :
            '<button class="btn-cancel-confirm" onclick="cerrarModalConfirmacion()">Cancelar</button><button class="btn-confirm" onclick="confirmarAccion()">Aceptar</button>'
        }
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    window.accionConfirmada = onConfirm;
}

function cerrarModalConfirmacion() {
    const modal = document.getElementById('confirmModal');
    if (modal) {
        modal.remove();
    }
    window.accionConfirmada = null;
}

async function confirmarAccion() {
    if (window.accionConfirmada) {
        await window.accionConfirmada();
    }
    cerrarModalConfirmacion();
}

// Menñ de acciones como ventana emergente
function abrirMenuAcciones(id, estado) {
    const habitacion = habitaciones.find(h => h._id === id);
    if (!habitacion) return;

    let opciones = '';
    if (estado === 'disponible') {
        opciones = '';
        if (tienePermiso('ocupar_habitaciones')) {
            opciones += `<button class="menu-accion-btn menu-accion-ocupar" onclick="cerrarMenuAcciones();ocuparHabitacion('${id}')">
                <i class="fas fa-user"></i> Ocupar habitación
            </button>`;
        }
        if (tienePermiso('crear_reservaciones')) {
            opciones += `<button class="menu-accion-btn menu-accion-reservar" onclick="cerrarMenuAcciones();reservarHabitacion('${id}')">
                <i class="fas fa-calendar-alt"></i> Reservar habitación
            </button>`;
        }
        if (tienePermiso('reparar_habitaciones')) {
            opciones += `<button class="menu-accion-btn menu-accion-reparar" onclick="cerrarMenuAcciones();abrirModalReparacion('${id}')">
                <i class="fas fa-tools"></i> Poner en reparación
            </button>`;
        }
    } else if (estado === 'ocupada') {
        opciones = `
            <button class="menu-accion-btn menu-accion-detalles" onclick="cerrarMenuAcciones();verDetalles('${id}')">
                <i class="fas fa-eye"></i> Ver detalles
            </button>`;
        if (tienePermiso('agregar_consumos')) {
            opciones += `<button class="menu-accion-btn menu-accion-producto" onclick="cerrarMenuAcciones();gestionarProductos('${id}')">
                <i class="fas fa-plus-circle"></i> Agregar productos
            </button>`;
        }
        if (tienePermiso('cambiar_habitaciones')) {
            opciones += `<button class="menu-accion-btn menu-accion-cambiar" onclick="cerrarMenuAcciones();abrirModalCambiarHabitacion('${id}')">
                <i class="fas fa-exchange-alt"></i> Cambiar de habitación
            </button>`;
        }
    } else if (estado === 'reparacion') {
        opciones = '';
        if (tienePermiso('reparar_habitaciones')) {
            opciones += `<button class="menu-accion-btn menu-accion-disponible" onclick="cerrarMenuAcciones();marcarReparada('${id}')">
                <i class="fas fa-check-circle"></i> Marcar disponible
            </button>`;
        }
        opciones += `<button class="menu-accion-btn menu-accion-ver-razon" onclick="cerrarMenuAcciones();verRazonReparacion('${id}')">
                <i class="fas fa-info-circle"></i> Ver razón
            </button>`;
    }

    const modal = document.createElement('div');
    modal.id = 'menuAccionesModal';
    modal.className = 'modal-overlay active';
    modal.style.zIndex = '25000';
    modal.innerHTML = `
        <div class="modal-container" style="max-width:520px;">
            <div class="modal-header" style="padding:16px 20px;">
                <h2 style="font-size:17px;"><i class="fas fa-th-list"></i> ${habitacion.nombre}</h2>
                <button class="modal-close" onclick="cerrarMenuAcciones()"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body" style="padding:20px;">
                <div class="menu-acciones-lista">
                    ${opciones}
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) cerrarMenuAcciones(); });
}

function cerrarMenuAcciones() {
    const m = document.getElementById('menuAccionesModal');
    if (m) m.remove();
}

// Ocupar habitación - Usar modal mejorado
function ocuparHabitacion(id) {
    const habitacion = habitaciones.find(h => h._id === id);
    if (habitacion) {
        abrirModalOcuparMejorado(habitacion);
    }
}

// Gestionar productos de habitación ocupada
function gestionarProductos(id) {
    const habitacion = habitaciones.find(h => h._id === id);
    if (!habitacion) return;
    abrirModalAgregarConsumos({
        habitacionId: id,
        obtenerHabitacion: (hid) => habitaciones.find(h => h._id === hid),
        recargar: async () => {
            const sedeFilter = document.getElementById('sedeFilter').value;
            if (sedeFilter) {
                await cargarHabitaciones();
            } else {
                await cargarTodasHabitaciones();
            }
        }
    });
}

// Reservar habitación - Usa el mismo modal de ocupar con campos de fecha/hora
function reservarHabitacion(id) {
    const habitacion = habitaciones.find(h => h._id === id);
    if (habitacion) {
        abrirModalOcuparMejorado(habitacion, true);
    }
}

// Marcar habitación en limpieza como disponible
async function marcarDisponible(id) {
    const habitacion = habitaciones.find(h => h._id === id);
    if (!habitacion || habitacion.estado !== 'limpieza') return;

    mostrarModalConfirmacion(
        `ñMarcar "${habitacion.nombre}" como disponible?`,
        async () => {
            try {
                const resultado = await pywebview.api.cambiar_estado_habitacion(id, 'disponible');
                if (resultado.success) {
                    mostrarModalConfirmacion(resultado.message, null, true);
                    const sedeFiltro = document.getElementById('sedeFilter').value;
                    if (sedeFiltro) {
                        await cargarHabitaciones();
                    } else {
                        await cargarTodasHabitaciones();
                    }
                } else {
                    mostrarModalConfirmacion(resultado.message, null, true);
                }
            } catch (error) {
                console.error('Error al marcar disponible:', error);
                mostrarModalConfirmacion('No se pudo actualizar el estado', null, true);
            }
        }
    );
}

// -- Reparación --
function abrirModalReparacion(id) {
    const habitacion = habitaciones.find(h => h._id === id);
    if (!habitacion) return;
    const modalHTML = `
        <div class="modal-overlay active" id="modalReparacion">
            <div class="modal-container" style="max-width:450px;">
                <div class="modal-header">
                    <h2><i class="fas fa-tools"></i> Marcar en Reparación</h2>
                    <button class="modal-close" onclick="cerrarModalReparacion()"><i class="fas fa-times"></i></button>
                </div>
                <div class="modal-body">
                    <p style="margin-bottom:12px;">Habitación: <strong>${habitacion.nombre}</strong></p>
                    <div class="form-group">
                        <label for="motivoReparacion">Motivo de la reparación</label>
                        <textarea id="motivoReparacion" rows="3" placeholder="Describe quñ hay que reparar..." style="width:100%;"></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="cerrarModalReparacion()">Cancelar</button>
                    <button type="button" class="btn-primary" onclick="confirmarReparacion('${id}')">
                        <i class="fas fa-tools"></i> Confirmar
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function cerrarModalReparacion() {
    const m = document.getElementById('modalReparacion');
    if (m) m.remove();
}

async function confirmarReparacion(id) {
    const motivo = document.getElementById('motivoReparacion').value.trim();
    if (!motivo) {
        mostrarModalConfirmacion('Por favor escribe el motivo de la reparación', null, true);
        return;
    }
    cerrarModalReparacion();
    try {
        const res = await pywebview.api.marcar_en_reparacion(id, motivo);
        mostrarModalConfirmacion(res.message, null, true);
        const sf = document.getElementById('sedeFilter').value;
        if (sf) { await cargarHabitaciones(); } else { await cargarTodasHabitaciones(); }
    } catch (e) {
        mostrarModalConfirmacion('Error al marcar en reparación', null, true);
    }
}

async function marcarReparada(id) {
    const habitacion = habitaciones.find(h => h._id === id);
    if (!habitacion) return;
    mostrarModalConfirmacion(
        `ñMarcar "${habitacion.nombre}" como reparada? Quedarñ disponible.`,
        async () => {
            try {
                const res = await pywebview.api.marcar_reparada(id);
                mostrarModalConfirmacion(res.message, null, true);
                const sf = document.getElementById('sedeFilter').value;
                if (sf) { await cargarHabitaciones(); } else { await cargarTodasHabitaciones(); }
            } catch (e) {
                mostrarModalConfirmacion('Error al marcar como reparada', null, true);
            }
        }
    );
}

function verRazonReparacion(id) {
    const habitacion = habitaciones.find(h => h._id === id);
    if (!habitacion) return;
    mostrarModalConfirmacion(
        `Razón de reparación de "${habitacion.nombre}":\n\n${habitacion.motivo_reparacion || 'Sin especificar'}`,
        null, true
    );
}



// -- Cambiar de habitación --
async function abrirModalCambiarHabitacion(origenId) {
    const habitacion = habitaciones.find(h => h._id === origenId);
    if (!habitacion || habitacion.estado !== 'ocupada') return;

    let disponibles = [];
    try {
        const res = await pywebview.api.obtener_habitaciones_disponibles_para_cambio(habitacion.sede_id || null);
        if (res.success) disponibles = res.habitaciones;
    } catch (e) {
        console.error('Error al obtener disponibles:', e);
    }

    if (disponibles.length === 0) {
        mostrarModalConfirmacion('No hay habitaciones disponibles para hacer el cambio.', null, true);
        return;
    }

    // Renderizar tarjetas igual que en la pantalla principal
    const tarjetasHTML = disponibles.map(d => {
        const textoSedeCompleto = [d.sede_nombre, d.sede_ciudad].filter(Boolean).join(' ').trim();
        return `
            <div class="habitacion-card disponible cambio-destino-card" data-id="${d._id}"
                onclick="seleccionarDestinoHabitacion('${d._id}', this)"
                style="cursor:pointer;transition:box-shadow 0.15s,outline 0.15s;">
                <div class="habitacion-zona habitacion-zona-cabecera">
                    <div class="habitacion-header">
                        <div class="habitacion-numero-badge">
                            <i class="fas fa-door-closed"></i>
                            <span>${d.numero}</span>
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
                            <h3 class="habitacion-titulo">${d.nombre}</h3>
                            ${textoSedeCompleto ? `<span class="habitacion-sede-chip">${textoSedeCompleto}</span>` : ''}
                        </div>
                        <div class="habitacion-fila-meta">
                            <div class="habitacion-capacidad">
                                <i class="fas fa-user-friends"></i>
                                <span>${d.capacidad}</span>
                            </div>
                            <div class="habitacion-precio">
                                <div style="font-weight:600;margin-bottom:4px;">${formatearPrecioTarjeta(d.precio_horas || d.precio_base || d.precio || 0)} x ${d.horas_base || 4}h</div>
                                <div style="font-size:11px;color:#666;line-height:1.4;">
                                    <div><strong>Noche (12h):</strong> ${formatearPrecioTarjeta(d.precio_noche || 0)}</div>
                                    <div><strong>Día (24h):</strong> ${formatearPrecioTarjeta(d.precio_dia || 0)}</div>
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
    modal.id = 'modalCambiarHabitacion';
    modal.className = 'modal-overlay active';
    modal.style.zIndex = '25000';
    modal.innerHTML = `
        <div class="modal-container" style="max-width:700px;width:95vw;">
            <div class="modal-header">
                <h2><i class="fas fa-exchange-alt"></i> Cambiar de Habitación</h2>
                <button class="modal-close" onclick="cerrarModalCambiarHabitacion()"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
                <p style="margin-bottom:4px;font-size:13px;color:#555;">Desde: <strong>${habitacion.nombre}</strong></p>
                <p style="margin-bottom:16px;font-size:12px;color:#888;">Tocñ una habitación para seleccionarla como destino.</p>
                <div class="habitaciones-grid" style="max-height:55vh;overflow-y:auto;padding:4px 2px;">
                    ${tarjetasHTML}
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn-secondary" onclick="cerrarModalCambiarHabitacion()">Cancelar</button>
                <button type="button" class="btn-primary" id="btnConfirmarCambio" onclick="confirmarCambioHabitacion('${origenId}')" disabled>
                    <i class="fas fa-exchange-alt"></i> Confirmar Cambio
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModalCambiarHabitacion(); });
}

function seleccionarDestinoHabitacion(id, el) {
    document.querySelectorAll('.cambio-destino-card').forEach(c => {
        c.style.outline = '';
        c.style.boxShadow = '';
        const badge = c.querySelector('.cambio-seleccion-badge');
        if (badge) badge.remove();
    });
    el.style.outline = '3px solid #000';
    el.style.boxShadow = '0 0 0 3px rgba(0,0,0,0.15)';
    // Agregar badge de check encima
    const badge = document.createElement('div');
    badge.className = 'cambio-seleccion-badge';
    badge.innerHTML = '<i class="fas fa-check"></i>';
    el.style.position = 'relative';
    el.appendChild(badge);

    const nombre = el.querySelector('.habitacion-titulo')?.textContent || '';
    const btn = document.getElementById('btnConfirmarCambio');
    if (btn) {
        btn.disabled = false;
        btn.dataset.destino = id;
        btn.innerHTML = `<i class="fas fa-exchange-alt"></i> Cambiar a ${nombre}`;
    }
}

function cerrarModalCambiarHabitacion() {
    const m = document.getElementById('modalCambiarHabitacion');
    if (m) m.remove();
}

async function confirmarCambioHabitacion(origenId) {
    const btn = document.getElementById('btnConfirmarCambio');
    const destinoId = btn ? btn.dataset.destino : null;
    if (!destinoId) {
        mostrarModalConfirmacion('Seleccionñ una habitación destino.', null, true);
        return;
    }
    cerrarModalCambiarHabitacion();

    mostrarModalConfirmacion(
        '¿Confirmas el cambio de habitación? Se moverán todos los datos de ocupación.',
        async () => {
            try {
                const res = await pywebview.api.cambiar_habitacion(origenId, destinoId);
                mostrarModalConfirmacion(res.message, null, true);
                if (res.success) {
                    const sf = document.getElementById('sedeFilter').value;
                    if (sf) { await cargarHabitaciones(); } else { await cargarTodasHabitaciones(); }
                }
            } catch (e) {
                console.error('Error al cambiar habitación:', e);
                mostrarModalConfirmacion('Error al cambiar de habitación', null, true);
            }
        }
    );
}
