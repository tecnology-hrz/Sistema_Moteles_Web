// Formatear precio
function formatearPrecio(numero) {
    return '$' + parseInt(numero).toLocaleString('es-CO');
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
let habitacionesOcupadas = [];
let habitacionActual = null;
let historialFacturasLista = [];
let historialFacturacionPendienteConsulta = true;
let vistaFacturacionActiva = 'por_facturar';
let temporizadorActualizacion = null;
let temporizadorModal = null;

/** La ocupación guarda placa "N/A" para taxi/otro; eso no es una placa real. */
function placaEsRegistroReal(placa) {
    if (placa == null) return false;
    const p = String(placa).trim();
    if (!p) return false;
    const u = p.toUpperCase();
    return u !== 'N/A' && u !== 'S/N' && u !== '-' && u !== 'NA';
}

function tienePlacaVehiculoReal(h) {
    return placaEsRegistroReal(h && h.placa);
}

function colorVehiculoEsReal(c) {
    if (c == null || c === '') return false;
    const s = String(c).trim();
    return s.toUpperCase() !== 'N/A';
}

const COLOR_INDICADOR_TAXI = '#FFD700';

/** Sin placa: solo cómo llegó (taxi, otro, etc.), sin color ni placa. */
function etiquetaMedioTransporte(h) {
    const tipo = (h && h.tipo_vehiculo ? String(h.tipo_vehiculo) : '').toLowerCase().trim();
    if (tipo === 'taxi') return 'TAXI';
    if (tipo === 'otro') return 'OTRO';
    if (tipo === 'moto') return 'MOTO';
    if (tipo === 'carro') return 'CARRO';
    return 'OTRO';
}

function esTipoVehiculoTaxi(h) {
    return (h && h.tipo_vehiculo ? String(h.tipo_vehiculo) : '').toLowerCase().trim() === 'taxi';
}

/** Celda tabla: taxi con círculo amarillo (misma idea que habitaciones). */
function htmlCeldaVehiculoSinPlaca(h) {
    const etiqueta = etiquetaMedioTransporte(h);
    if (esTipoVehiculoTaxi(h)) {
        return `
                    <div class="table-vehiculo">
                        <div class="table-vehiculo-color" style="background-color: ${COLOR_INDICADOR_TAXI};" title="Taxi"></div>
                        <div class="table-vehiculo-info">
                            <div class="table-vehiculo-placa">${etiqueta}</div>
                        </div>
                    </div>`;
    }
    return `<span style="color: #666; font-weight: 500;">${etiqueta}</span>`;
}

function htmlValorMedioTransporteModal(h) {
    const etiqueta = etiquetaMedioTransporte(h);
    if (esTipoVehiculoTaxi(h)) {
        return `<span style="display:inline-flex;align-items:center;gap:0.5rem;"><span style="width:14px;height:14px;border-radius:50%;background:${COLOR_INDICADOR_TAXI};flex-shrink:0;border:1px solid rgba(0,0,0,0.12);" title="Taxi"></span>${etiqueta}</span>`;
    }
    return etiqueta;
}

/** Modal: fila de vehículo sin placa solo si hay tipo o registro guardado como N/A. */
function debeMostrarMedioTransporteEnFactura(h) {
    if (!h || tienePlacaVehiculoReal(h)) return false;
    const tipo = (h.tipo_vehiculo || '').toString().trim();
    if (tipo && tipo.toUpperCase() !== 'N/A') return true;
    const p = h.placa != null ? String(h.placa).trim().toUpperCase() : '';
    return p === 'N/A' || p === 'NA';
}

// Verificar sesión al cargar
window.addEventListener('DOMContentLoaded', async () => {
    await esperarPywebview();
    
    try {
        const sesion = await pywebview.api.cargar_sesion();
        
        if (sesion) {
            document.getElementById('userName').textContent = sesion.username;
            const userRoleEl = document.querySelector('.user-role');
            if (userRoleEl) userRoleEl.textContent = sesion.rol === 'admin' ? 'Administrador' : 'Empleado';
            localStorage.setItem('sesionActiva', JSON.stringify(sesion));
            
            if (sesion.rol !== 'admin' && sesion.permisos && !sesion.permisos.ver_facturacion) {
                window.location.href = 'dasboard-admin.html';
                return;
            }
            
            if (typeof inicializarPermisos === 'function') inicializarPermisos();
            
            await cargarSedes();
            
            // Si es empleado, forzar filtro a su sede
            if (sesion.rol !== 'admin') {
                await forzarSedeEmpleadoFacturacion();
            }
            
            // Ocultar botones según permisos
            if (!tienePermiso('descargar_pdf_facturas')) {
                document.querySelectorAll('[onclick*="imprimirHistorialFacturacionPDF"]').forEach(function(el) { el.style.display = 'none'; });
            }
            if (!tienePermiso('imprimir_tirilla_facturas')) {
                document.querySelectorAll('[onclick*="imprimirHistorialFacturacionTirilla"]').forEach(function(el) { el.style.display = 'none'; });
            }
            
            await cargarHabitacionesOcupadas();
        } else {
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error('Error al verificar sesión:', error);
        window.location.href = 'index.html';
    }
});

// Cargar sedes (un solo desplegable: «Todas las sedes» + cada sede)
async function cargarSedes() {
    try {
        const resultado = await pywebview.api.obtener_sedes();
        
        if (resultado && resultado.success) {
            const sedes = resultado.sedes || [];
            const sedeFilter = document.getElementById('sedeFilter');
            
            sedeFilter.innerHTML = '';
            const optTodas = document.createElement('option');
            optTodas.value = '';
            optTodas.textContent = 'Todas las sedes';
            sedeFilter.appendChild(optTodas);
            
            sedes.forEach((sede) => {
                const option = document.createElement('option');
                option.value = sede.nombre;
                option.textContent = sede.ciudad ? `${sede.nombre} - ${sede.ciudad}` : sede.nombre;
                sedeFilter.appendChild(option);
            });
            
            if (sedes.length > 0) {
                sedeFilter.selectedIndex = 1;
            }
        }
    } catch (error) {
        console.error('Error al cargar sedes:', error);
    }
}

// Forzar filtro de sede para empleados en facturación
async function forzarSedeEmpleadoFacturacion() {
    try {
        const resultado = await pywebview.api.obtener_sede_empleado();
        if (resultado.success && resultado.sede) {
            const sedeFilter = document.getElementById('sedeFilter');
            // Buscar la opción que coincida con el nombre de la sede
            for (let i = 0; i < sedeFilter.options.length; i++) {
                if (sedeFilter.options[i].value === resultado.sede.nombre) {
                    sedeFilter.selectedIndex = i;
                    break;
                }
            }
            // Ocultar el selector de sedes para empleados
            const sedeFilterContainer = sedeFilter.closest('.sede-filter') || sedeFilter.parentElement;
            if (sedeFilterContainer) sedeFilterContainer.style.display = 'none';
        }
    } catch (e) {
        console.error('Error al obtener sede del empleado:', e);
    }
}

// Cargar habitaciones ocupadas
async function cargarHabitacionesOcupadas() {
    try {
        const resultado = await pywebview.api.obtener_habitaciones_ocupadas();
        
        if (resultado && resultado.success) {
            let habitaciones = resultado.habitaciones || [];
            const sedeSeleccionada = document.getElementById('sedeFilter').value;
            if (sedeSeleccionada) {
                habitaciones = habitaciones.filter((h) => h.sede_nombre === sedeSeleccionada);
            }
            
            habitacionesOcupadas = habitaciones;
            renderizarTabla();
            
            // Iniciar actualización automática cada segundo
            iniciarActualizacionAutomatica();
        } else {
            habitacionesOcupadas = [];
            renderizarTabla();
            detenerActualizacionAutomatica();
        }
    } catch (error) {
        console.error('Error:', error);
        habitacionesOcupadas = [];
        renderizarTabla();
        detenerActualizacionAutomatica();
    }
}

// Renderizar tabla
function renderizarTabla() {
    const tbody = document.getElementById('facturasTableBody');
    const sedeSeleccionada = document.getElementById('sedeFilter').value;
    const msgVacias = sedeSeleccionada
        ? '<i class="fas fa-door-open"></i> No hay habitaciones ocupadas en esta sede'
        : '<i class="fas fa-door-open"></i> No hay habitaciones ocupadas en ninguna sede';

    if (habitacionesOcupadas.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center">
                    ${msgVacias}
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = habitacionesOcupadas.map(h => {
        const tiempoTranscurrido = calcularTiempoTranscurrido(h.fecha_ingreso);
        const salidaEsperada = calcularSalidaEsperada(h);
        const tiempoExtra = calcularTiempoExtra(h, tiempoTranscurrido);
        const costoEstimado = calcularCostoEstimado(h, tiempoTranscurrido) + totalConsumosHabitacion(h);
        
        // Agregar clase si tiene tiempo extra (similar a productos con bajo stock)
        const claseFilaExtra = tiempoExtra.tiene ? 'fila-tiempo-extra' : '';
        
        return `
            <tr class="${claseFilaExtra}">
                <td>
                    <div class="table-habitacion">${h.numero}</div>
                </td>
                <td>
                    <div class="table-habitacion">${h.nombre}</div>
                </td>
                <td>
                    ${tienePlacaVehiculoReal(h) ? `
                    <div class="table-vehiculo">
                        ${(colorVehiculoEsReal(h.color_vehiculo) || colorVehiculoEsReal(h.color)) ? `
                        <div class="table-vehiculo-color" style="background-color: ${h.color_vehiculo || h.color};"></div>
                        ` : ''}
                        <div class="table-vehiculo-info">
                            <div class="table-vehiculo-placa">${h.placa}</div>
                        </div>
                    </div>
                    ` : htmlCeldaVehiculoSinPlaca(h)}
                </td>
                <td>
                    <div class="table-fecha">${formatearFecha(h.fecha_ingreso)}</div>
                </td>
                <td>
                    <div class="table-fecha">${formatearFecha(salidaEsperada)}</div>
                </td>
                <td>
                    <div class="table-tiempo">${tiempoTranscurrido.texto}</div>
                </td>
                <td>
                    <div class="table-tiempo-extra ${tiempoExtra.tiene ? 'con-extra' : 'sin-extra'}">
                        <i class="fas fa-${tiempoExtra.tiene ? 'exclamation-triangle' : 'check-circle'}"></i>
                        ${tiempoExtra.texto}
                    </div>
                </td>
                <td>
                    <div class="table-total">${formatearPrecio(costoEstimado)}</div>
                </td>
                <td>
                    <div class="table-acciones">
                        <button type="button" class="btn-icon btn-productos-ocupacion" onclick="abrirProductosDesdeFacturacion('${h._id}')" title="Agregar productos">
                            <i class="fas fa-box-open"></i>
                            Productos
                        </button>
                        <button type="button" class="btn-icon btn-facturar" onclick="abrirModalFacturacion('${h._id}')">
                            <i class="fas fa-file-invoice-dollar"></i>
                            Facturar
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Iniciar actualización automática del tiempo cada segundo
function iniciarActualizacionAutomatica() {
    // Limpiar temporizador anterior si existe
    if (temporizadorActualizacion) {
        clearInterval(temporizadorActualizacion);
    }
    
    // Actualizar cada segundo solo si estamos en la vista "por facturar"
    temporizadorActualizacion = setInterval(() => {
        if (vistaFacturacionActiva === 'por_facturar' && habitacionesOcupadas.length > 0) {
            renderizarTabla();
        }
    }, 1000);
}

// Detener actualización automática
function detenerActualizacionAutomatica() {
    if (temporizadorActualizacion) {
        clearInterval(temporizadorActualizacion);
        temporizadorActualizacion = null;
    }
}

// Calcular tiempo transcurrido (usa hora Colombia)
function calcularTiempoTranscurrido(fechaIngreso) {
    const ahora = typeof fechaColombia === 'function' ? fechaColombia() : new Date();
    const ingreso = typeof fechaColombia === 'function' ? fechaColombia(fechaIngreso) : new Date(fechaIngreso);
    const diff = ahora - ingreso;
    
    const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
    const horas = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const segundos = Math.floor((diff % (1000 * 60)) / 1000);
    
    let texto = '';
    if (dias > 0) texto += `${dias}d `;
    if (horas > 0 || dias > 0) texto += `${horas}h `;
    texto += `${minutos}m `;
    texto += `${segundos}s`;
    
    return {
        dias,
        horas: horas + (dias * 24),
        minutos,
        segundos,
        texto: texto.trim(),
        totalHoras: dias * 24 + horas + (minutos / 60) + (segundos / 3600)
    };
}

// Calcular tiempo esperado de salida (usa hora Colombia)
function calcularSalidaEsperada(habitacion) {
    const ingreso = typeof fechaColombia === 'function' ? fechaColombia(habitacion.fecha_ingreso) : new Date(habitacion.fecha_ingreso);
    const tipoOcupacion = habitacion.tipo_ocupacion || 'horas';
    let horasEsperadas;
    
    if (tipoOcupacion === 'varios_dias') {
        const diasPersonalizados = habitacion.dias_personalizados || 2;
        horasEsperadas = diasPersonalizados * 24;
    } else if (tipoOcupacion === 'dia') {
        horasEsperadas = 24;
    } else if (tipoOcupacion === 'noche') {
        horasEsperadas = 12;
    } else {
        horasEsperadas = habitacion.horas_base || 4;
    }
    
    const salidaEsperada = new Date(ingreso.getTime() + (horasEsperadas * 60 * 60 * 1000));
    return salidaEsperada;
}

// Calcular tiempo extra
function calcularTiempoExtra(habitacion, tiempo) {
    const tipoOcupacion = habitacion.tipo_ocupacion || 'horas';
    const totalHoras = tiempo.totalHoras;
    let horasEsperadas;
    
    if (tipoOcupacion === 'varios_dias') {
        const diasPersonalizados = habitacion.dias_personalizados || 2;
        horasEsperadas = diasPersonalizados * 24;
    } else if (tipoOcupacion === 'dia') {
        horasEsperadas = 24;
    } else if (tipoOcupacion === 'noche') {
        horasEsperadas = 12;
    } else {
        horasEsperadas = habitacion.horas_base || 4;
    }
    
    if (totalHoras <= horasEsperadas) {
        return {
            tiene: false,
            horas: 0,
            texto: 'Sin tiempo extra'
        };
    }
    
    const horasExtras = totalHoras - horasEsperadas;
    const horasEnteras = Math.floor(horasExtras);
    const minutosExtras = Math.round((horasExtras - horasEnteras) * 60);
    
    let texto = '';
    if (horasEnteras > 0) texto += `${horasEnteras}h `;
    if (minutosExtras > 0) texto += `${minutosExtras}m`;
    
    return {
        tiene: true,
        horas: horasExtras,
        texto: texto.trim() || '0m'
    };
}

// Calcular costo estimado
function calcularCostoEstimado(habitacion, tiempo) {
    const totalHoras = tiempo.totalHoras;
    const tipoOcupacion = habitacion.tipo_ocupacion || 'horas';
    
    // Si se seleccionó varios días, usar el precio acordado
    if (tipoOcupacion === 'varios_dias') {
        const precioAcordado = habitacion.precio_acordado || 0;
        const diasPersonalizados = habitacion.dias_personalizados || 2;
        const duracionEsperada = diasPersonalizados * 24;
        
        // Si excede el tiempo acordado, cobrar horas extras
        if (totalHoras > duracionEsperada) {
            const horasExtras = Math.ceil(totalHoras - duracionEsperada);
            const precioHoraExtra = habitacion.precio_hora_extra || 5000;
            return precioAcordado + (horasExtras * precioHoraExtra);
        }
        
        return precioAcordado;
    }
    
    // Si se seleccionó día (24h), usar precio acordado o precio de día
    if (tipoOcupacion === 'dia') {
        const precioDia = habitacion.precio_acordado || habitacion.precio_dia || 100000;
        
        // Si excede las 24 horas, cobrar horas extras
        if (totalHoras > 24) {
            const horasExtras = Math.ceil(totalHoras - 24);
            const precioHoraExtra = habitacion.precio_hora_extra || 5000;
            return precioDia + (horasExtras * precioHoraExtra);
        }
        
        return precioDia;
    }
    
    // Si se seleccionó noche (12h), usar precio acordado o precio de noche
    if (tipoOcupacion === 'noche') {
        const precioNoche = habitacion.precio_acordado || habitacion.precio_noche || 80000;
        
        // Si excede las 12 horas, cobrar horas extras
        if (totalHoras > 12) {
            const horasExtras = Math.ceil(totalHoras - 12);
            const precioHoraExtra = habitacion.precio_hora_extra || 5000;
            return precioNoche + (horasExtras * precioHoraExtra);
        }
        
        return precioNoche;
    }
    
    // Calcular por horas (estándar) - usar precio acordado si existe
    const horasBase = habitacion.horas_base || 4;
    const precioBase = habitacion.precio_acordado || habitacion.precio_horas || habitacion.precio_base || 30000;
    const precioHoraExtra = habitacion.precio_hora_extra || 5000;
    
    if (totalHoras <= horasBase) {
        return precioBase;
    }
    
    const horasExtras = Math.ceil(totalHoras - horasBase);
    return precioBase + (horasExtras * precioHoraExtra);
}

// Obtener el costo base del tipo de ocupación seleccionado
function obtenerCostoTipoOcupacion(habitacion) {
    const tipoOcupacion = habitacion.tipo_ocupacion || 'horas';
    
    if (tipoOcupacion === 'varios_dias') {
        return habitacion.precio_acordado || 0;
    }
    
    if (tipoOcupacion === 'dia') {
        return habitacion.precio_dia || 100000;
    }
    
    if (tipoOcupacion === 'noche') {
        return habitacion.precio_noche || 80000;
    }
    
    // Tipo horas (estándar)
    return habitacion.precio_horas || habitacion.precio_base || 30000;
}

// Formatear fecha (usa hora Colombia)
function formatearFecha(fecha) {
    const d = typeof fechaColombia === 'function' ? fechaColombia(fecha) : new Date(fecha);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const año = d.getFullYear();
    
    // Convertir a formato de 12 horas
    let horas = d.getHours();
    const minutos = String(d.getMinutes()).padStart(2, '0');
    const ampm = horas >= 12 ? 'pm' : 'am';
    
    horas = horas % 12;
    horas = horas ? horas : 12; // Si es 0, mostrar 12
    const horaFormateada = String(horas).padStart(2, '0');
    
    return `${dia}/${mes}/${año} ${horaFormateada}:${minutos} ${ampm}`;
}

// Abrir modal de facturación
function abrirModalFacturacion(habitacionId) {
    habitacionActual = habitacionesOcupadas.find(h => h._id === habitacionId);
    if (!habitacionActual) return;
    
    window.metodoPagoSeleccionado = 'efectivo';
    
    actualizarDetallesFactura();
    document.getElementById('modalFacturacion').classList.add('active');
    
    // NO iniciar actualización automática en el modal para evitar conflictos con los campos de entrada
}

// Iniciar actualización automática del modal
function iniciarActualizacionModal() {
    // Limpiar temporizador anterior si existe
    if (temporizadorModal) {
        clearInterval(temporizadorModal);
    }
    
    // Actualizar cada segundo
    temporizadorModal = setInterval(() => {
        if (habitacionActual) {
            actualizarDetallesFactura();
        }
    }, 1000);
}

// Detener actualización automática del modal
function detenerActualizacionModal() {
    if (temporizadorModal) {
        clearInterval(temporizadorModal);
        temporizadorModal = null;
    }
}

// Actualizar detalles de factura
function actualizarDetallesFactura() {
    const tiempo = calcularTiempoTranscurrido(habitacionActual.fecha_ingreso);
    const salidaEsperada = calcularSalidaEsperada(habitacionActual);
    const tiempoExtra = calcularTiempoExtra(habitacionActual, tiempo);
    const ahora = typeof fechaColombia === 'function' ? fechaColombia() : new Date();
    const total = calcularTotal();
    const totalACobrar = calcularTotalACobrar();
    
    // Obtener el tipo de ocupación
    const tipoOcupacion = habitacionActual.tipo_ocupacion || 'horas';
    let tipoOcupacionTexto = '';
    
    if (tipoOcupacion === 'varios_dias') {
        const dias = habitacionActual.dias_personalizados || 2;
        tipoOcupacionTexto = `Varios Días (${dias} días)`;
    } else if (tipoOcupacion === 'dia') {
        tipoOcupacionTexto = 'Día (24h)';
    } else if (tipoOcupacion === 'noche') {
        tipoOcupacionTexto = 'Noche (12h)';
    } else {
        const horasBase = habitacionActual.horas_base || 4;
        tipoOcupacionTexto = `Estándar (${horasBase}h)`;
    }
    
    // Calcular descuento si existe precio personalizado
    let precioEstandar = 0;
    let precioAcordado = 0;
    let tieneDescuento = false;
    
    if (tipoOcupacion === 'varios_dias') {
        const dias = habitacionActual.dias_personalizados || 2;
        precioEstandar = (habitacionActual.precio_dia || 100000) * dias;
        precioAcordado = habitacionActual.precio_acordado || precioEstandar;
        tieneDescuento = precioAcordado < precioEstandar;
    } else if (tipoOcupacion === 'dia') {
        precioEstandar = habitacionActual.precio_dia || 100000;
        precioAcordado = habitacionActual.precio_acordado || precioEstandar;
        tieneDescuento = precioAcordado < precioEstandar;
    } else if (tipoOcupacion === 'noche') {
        precioEstandar = habitacionActual.precio_noche || 80000;
        precioAcordado = habitacionActual.precio_acordado || precioEstandar;
        tieneDescuento = precioAcordado < precioEstandar;
    } else {
        precioEstandar = habitacionActual.precio_horas || habitacionActual.precio_base || habitacionActual.precio || 30000;
        precioAcordado = habitacionActual.precio_acordado || precioEstandar;
        tieneDescuento = precioAcordado < precioEstandar;
    }
    
    const descuento = tieneDescuento ? precioEstandar - precioAcordado : 0;
    
    let contenido = `
        <div class="factura-dos-columnas">
            <div class="factura-columna-izquierda">
                <div class="factura-detalle-section">
                    <div class="factura-detalle-titulo">
                        <i class="fas fa-door-closed"></i>
                        ${habitacionActual.nombre}
                    </div>
                    <div class="factura-detalle-row">
                        <span class="factura-detalle-label">Tipo de ocupación</span>
                        <span class="factura-detalle-valor">${tipoOcupacionTexto}</span>
                    </div>
                    ${habitacionActual.pago_anticipado ? `
                    <div class="factura-detalle-row" style="color: #2e7d32; font-weight: 600;">
                        <span class="factura-detalle-label">Habitación</span>
                        <span class="factura-detalle-valor"><i class="fas fa-check-circle"></i> Pagada por anticipado (${formatearPrecio(habitacionActual.monto_anticipado || precioEstandar)})</span>
                    </div>
                    ` : `
                    <div class="factura-detalle-row">
                        <span class="factura-detalle-label">Precio estándar</span>
                        <span class="factura-detalle-valor">${formatearPrecio(precioEstandar)}</span>
                    </div>
                    ${tieneDescuento ? `
                    <div class="factura-detalle-row" style="color: #d32f2f;">
                        <span class="factura-detalle-label">Descuento aplicado</span>
                        <span class="factura-detalle-valor">-${formatearPrecio(descuento)}</span>
                    </div>
                    <div class="factura-detalle-row" style="color: #2e7d32; font-weight: 600;">
                        <span class="factura-detalle-label">Precio acordado</span>
                        <span class="factura-detalle-valor">${formatearPrecio(precioAcordado)}</span>
                    </div>
                    ` : ''}
                    `}
                    <div class="factura-detalle-row">
                        <span class="factura-detalle-label">Costo hora extra</span>
                        <span class="factura-detalle-valor" style="color: #856404;">${formatearPrecio(habitacionActual.precio_hora_extra || 5000)}/hora</span>
                    </div>
                    <div class="factura-detalle-row">
                        <span class="factura-detalle-label">Precio horas extra</span>
                        <span class="factura-detalle-valor">${tiempoExtra.tiene ? formatearPrecio(Math.ceil(tiempoExtra.horas) * (habitacionActual.precio_hora_extra || 5000)) : '$0'}</span>
                    </div>
                    ${tienePlacaVehiculoReal(habitacionActual) ? `
                    <div class="factura-detalle-row">
                        <span class="factura-detalle-label">Vehículo</span>
                        <span class="factura-detalle-valor">
                            ${colorVehiculoEsReal(habitacionActual.color_vehiculo || habitacionActual.color) ? `
                            <span style="display:inline-flex;align-items:center;gap:0.5rem;">
                                <span style="width:14px;height:14px;border-radius:50%;background:${habitacionActual.color_vehiculo || habitacionActual.color};flex-shrink:0;border:1px solid rgba(0,0,0,0.12);"></span>
                                ${habitacionActual.placa}
                            </span>
                            ` : habitacionActual.placa}
                        </span>
                    </div>
                    ` : debeMostrarMedioTransporteEnFactura(habitacionActual) ? `
                    <div class="factura-detalle-row">
                        <span class="factura-detalle-label">Vehículo</span>
                        <span class="factura-detalle-valor">${htmlValorMedioTransporteModal(habitacionActual)}</span>
                    </div>
                    ` : ''}
                    ${habitacionActual.descripcion ? `
                    <div class="factura-detalle-row">
                        <span class="factura-detalle-label">Descripción</span>
                        <span class="factura-detalle-valor">${habitacionActual.descripcion}</span>
                    </div>
                    ` : ''}
                    <div class="factura-detalle-row">
                        <span class="factura-detalle-label">Ingreso</span>
                        <span class="factura-detalle-valor">${formatearFecha(habitacionActual.fecha_ingreso)}</span>
                    </div>
                    <div class="factura-detalle-row">
                        <span class="factura-detalle-label">Salida esperada</span>
                        <span class="factura-detalle-valor">${formatearFecha(salidaEsperada)}</span>
                    </div>
                    <div class="factura-detalle-row">
                        <span class="factura-detalle-label">Salida actual</span>
                        <span class="factura-detalle-valor">${formatearFecha(ahora)}</span>
                    </div>
                    <div class="factura-detalle-row">
                        <span class="factura-detalle-label">Tiempo total</span>
                        <span class="factura-detalle-valor">${tiempo.texto}</span>
                    </div>
                    <div class="factura-detalle-row">
                        <span class="factura-detalle-label">Tiempo extra</span>
                        <span class="factura-detalle-valor" style="color: ${tiempoExtra.tiene ? '#856404' : '#2e7d32'};">
                            <i class="fas fa-${tiempoExtra.tiene ? 'exclamation-triangle' : 'check-circle'}"></i>
                            ${tiempoExtra.texto}
                        </span>
                    </div>
                    <div class="factura-detalle-row">
                        <span class="factura-detalle-label">Subtotal habitación</span>
                        <span class="factura-detalle-valor">${formatearPrecio(calcularCostoEstimado(habitacionActual, tiempo))}</span>
                    </div>
                    ${
                        habitacionActual.consumos_ocupacion && habitacionActual.consumos_ocupacion.length
                            ? `
                    <div class="factura-detalle-subsection">
                        <div class="factura-detalle-titulo" style="font-size: 14px; margin-top: 8px;">
                            <i class="fas fa-shopping-basket"></i> Productos / consumos
                        </div>
                        ${habitacionActual.consumos_ocupacion
                            .map(
                                (c) => `
                        <div class="factura-detalle-row factura-detalle-row--compacto">
                            <span class="factura-detalle-label">${c.nombre} × ${c.cantidad}</span>
                            <span class="factura-detalle-valor">${formatearPrecio(Math.round(Number(c.subtotal) || 0))}</span>
                        </div>`
                            )
                            .join('')}
                        <div class="factura-detalle-row">
                            <span class="factura-detalle-label">Subtotal consumos</span>
                            <span class="factura-detalle-valor">${formatearPrecio(totalConsumosHabitacion(habitacionActual))}</span>
                        </div>
                    </div>
                    `
                            : ''
                    }
                </div>
            </div>
            
            <div class="factura-columna-derecha">
                <div class="factura-detalle-section">
                    <div class="factura-detalle-titulo">
                        <i class="fas fa-credit-card"></i>
                        Método de pago
                    </div>
                    
                    <div class="form-row-pago">
                        <div class="form-group-pago">
                            <label class="form-label">Método de pago</label>
                            <select class="form-select" id="metodoPagoSelect" onchange="cambiarMetodoPago()">
                                <option value="efectivo">Efectivo</option>
                                <option value="nequi">Nequi</option>
                                <option value="bancolombia">Bancolombia</option>
                                <option value="daviplata">Daviplata</option>
                                <option value="breb">Bre-B</option>
                                <option value="tarjeta">Tarjeta</option>
                            </select>
                        </div>
                        <div class="form-group-pago" id="wrapBtnMontoCompleto">
                            <label class="form-label">Pago justo</label>
                            <button type="button" class="btn-monto-completo-modal" id="btnMontoCompleto" onclick="aplicarMontoCompletoFacturacion()" title="Rellenar con el total a pagar">
                                <i class="fas fa-equals"></i> Completo
                            </button>
                        </div>
                    </div>
                    
                    <div id="camposReferenciaPago" class="form-row-pago" style="display:none">
                        <div class="form-group-pago" style="flex:1">
                            <label class="form-label">Referencia / N° aprobación <span style="color:#e74c3c">*</span></label>
                            <input type="text" class="form-input" id="referenciaPago" placeholder="Ej: M1234567890" autocomplete="off" style="text-transform:uppercase;" oninput="this.value=this.value.toUpperCase()">
                        </div>
                    </div>

                    <div id="camposEfectivo" class="form-row-pago">
                        <div class="form-group-pago">
                            <label class="form-label">Monto recibido</label>
                            <input type="text" class="form-input" id="montoRecibido" placeholder="Ingrese el monto" oninput="formatearMontoRecibido(this)">
                        </div>
                        <div class="form-group-pago">
                            <label class="form-label">Cambio a devolver</label>
                            <input type="text" class="form-input" id="cambioDevolver" readonly placeholder="$0" style="background: #f5f5f5;">
                        </div>
                    </div>
                    
                    <div class="factura-detalle-total">
                        <div class="factura-detalle-total-row">
                            <span class="factura-detalle-total-label">TOTAL A PAGAR</span>
                            <span class="factura-detalle-total-valor">${formatearPrecio(totalACobrar)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('facturaDetalles').innerHTML = contenido;

    window.metodoPagoSeleccionado = 'efectivo';
    const selMetodo = document.getElementById('metodoPagoSelect');
    if (selMetodo) selMetodo.value = 'efectivo';
    cambiarMetodoPago();
}

// Cambiar método de pago
function cambiarMetodoPago() {
    const metodoPago = document.getElementById('metodoPagoSelect').value;
    window.metodoPagoSeleccionado = metodoPago;
    
    const camposEfectivo = document.getElementById('camposEfectivo');
    const wrapBtnMontoCompleto = document.getElementById('wrapBtnMontoCompleto');
    const camposRef = document.getElementById('camposReferenciaPago');
    const metodosPagoConRef = ['nequi', 'bancolombia', 'daviplata', 'breb'];

    if (metodoPago === 'efectivo') {
        camposEfectivo.style.display = 'flex';
        if (wrapBtnMontoCompleto) wrapBtnMontoCompleto.style.display = '';
        if (camposRef) camposRef.style.display = 'none';
    } else {
        camposEfectivo.style.display = 'none';
        if (wrapBtnMontoCompleto) wrapBtnMontoCompleto.style.display = 'none';
        if (camposRef) camposRef.style.display = metodosPagoConRef.includes(metodoPago) ? 'flex' : 'none';
    }
}

/** Rellena «Monto recibido» con el total (pago exacto, sin teclear). */
function aplicarMontoCompletoFacturacion() {
    const input = document.getElementById('montoRecibido');
    if (!input) return;
    const total = calcularTotalACobrar();
    if (total <= 0) return;
    input.value = total.toLocaleString('en-US');
    calcularCambio();
}

// Formatear monto recibido con separador de miles
function formatearMontoRecibido(input) {
    let valor = input.value.replace(/\D/g, '');
    if (valor === '') {
        input.value = '';
        calcularCambio();
        return;
    }
    let numero = parseInt(valor);
    input.value = numero.toLocaleString('en-US');
    calcularCambio();
}

// Obtener valor numérico del monto recibido
function obtenerValorMontoRecibido() {
    const montoInput = document.getElementById('montoRecibido');
    if (!montoInput) return 0;
    return parseInt(montoInput.value.replace(/,/g, '') || '0');
}

// Calcular cambio
function calcularCambio() {
    const total = calcularTotalACobrar();
    const montoRecibido = obtenerValorMontoRecibido();
    const cambio = montoRecibido - total;
    
    const cambioDevolver = document.getElementById('cambioDevolver');
    
    if (montoRecibido >= total && montoRecibido > 0) {
        cambioDevolver.value = formatearPrecio(cambio);
        cambioDevolver.style.color = cambio >= 0 ? '#2e7d32' : '#d32f2f';
        cambioDevolver.style.fontWeight = '700';
    } else {
        cambioDevolver.value = '$0';
        cambioDevolver.style.color = '#666';
    }
}

// Calcular total (habitación + consumos)
function calcularTotal() {
    const tiempo = calcularTiempoTranscurrido(habitacionActual.fecha_ingreso);
    return calcularCostoEstimado(habitacionActual, tiempo) + totalConsumosHabitacion(habitacionActual);
}

// Lo que realmente se cobra (descontando pago anticipado)
function calcularTotalACobrar() {
    const total = calcularTotal();
    if (habitacionActual.pago_anticipado) {
        const anticipado = Number(habitacionActual.monto_anticipado) || 0;
        return Math.max(0, total - anticipado);
    }
    return total;
}

function abrirProductosDesdeFacturacion(habitacionId) {
    abrirModalAgregarConsumos({
        habitacionId,
        obtenerHabitacion: (hid) => habitacionesOcupadas.find((h) => h._id === hid),
        recargar: async () => {
            await cargarHabitacionesOcupadas();
            if (habitacionActual && habitacionActual._id === habitacionId) {
                const actualizado = habitacionesOcupadas.find((h) => h._id === habitacionId);
                if (actualizado) {
                    habitacionActual = actualizado;
                }
                const modalFact = document.getElementById('modalFacturacion');
                if (modalFact && modalFact.classList.contains('active')) {
                    actualizarDetallesFactura();
                    calcularCambio();
                }
            }
        }
    });
}

// Confirmar checkout
async function confirmarCheckout() {
    if (!habitacionActual) return;
    
    if (!tienePermiso('realizar_checkout')) {
        mostrarError('No tienes permiso para realizar checkout');
        return;
    }
    
    const totalCompleto = calcularTotal();
    const total = calcularTotalACobrar();
    const metodoPago = window.metodoPagoSeleccionado || 'efectivo';
    
    // Validar pago en efectivo
    if (metodoPago === 'efectivo' && total > 0) {
        const montoRecibido = obtenerValorMontoRecibido();
        
        if (montoRecibido <= 0) {
            mostrarError('Por favor ingrese el monto recibido');
            return;
        }
        
        if (montoRecibido < total) {
            mostrarError('El monto recibido es menor al total a pagar');
            return;
        }
    }
    
    // Validar referencia para métodos digitales
    const metodosPagoConRef = ['nequi', 'bancolombia', 'daviplata', 'breb'];
    let referenciaPago = '';
    if (metodosPagoConRef.includes(metodoPago)) {
        const inpRef = document.getElementById('referenciaPago');
        referenciaPago = (inpRef ? inpRef.value.trim() : '');
        if (!referenciaPago) {
            mostrarError('La referencia / N° de aprobación es obligatoria para este método de pago');
            return;
        }
    }
    
    const tiempo = calcularTiempoTranscurrido(habitacionActual.fecha_ingreso);
    const tiempoExtra = calcularTiempoExtra(habitacionActual, tiempo);
    const tipoOcupacion = habitacionActual.tipo_ocupacion || 'horas';
    
    // Determinar modalidad y días según el tipo de ocupación
    let modalidad, dias;
    
    if (tipoOcupacion === 'varios_dias') {
        modalidad = 'varios_dias';
        dias = habitacionActual.dias_personalizados || 2;
    } else if (tipoOcupacion === 'dia') {
        modalidad = 'dia';
        dias = 1;
    } else if (tipoOcupacion === 'noche') {
        modalidad = 'noche';
        dias = 1;
    } else {
        modalidad = 'horas';
        dias = 1;
    }
    
    const datosCheckout = {
        modalidad: modalidad,
        dias: dias,
        total: totalCompleto,
        total_cobrado: total,
        fecha_salida: (function() {
            // Generar fecha en hora Colombia (sin Z)
            if (typeof fechaColombia === 'function') {
                var dc = fechaColombia();
                var yy = dc.getFullYear(), mm = String(dc.getMonth()+1).padStart(2,'0'), dd = String(dc.getDate()).padStart(2,'0');
                var hh = String(dc.getHours()).padStart(2,'0'), mi = String(dc.getMinutes()).padStart(2,'0'), ss = String(dc.getSeconds()).padStart(2,'0');
                return yy+'-'+mm+'-'+dd+'T'+hh+':'+mi+':'+ss;
            }
            return new Date().toISOString();
        })(),
        tiempo_total: tiempo.texto,
        tiempo_extra: tiempoExtra.texto,
        tiene_tiempo_extra: tiempoExtra.tiene,
        metodo_pago: metodoPago,
        tipo_ocupacion: tipoOcupacion
    };
    
    // Agregar datos de efectivo si aplica
    if (metodoPago === 'efectivo') {
        const montoRecibido = obtenerValorMontoRecibido();
        datosCheckout.monto_recibido = montoRecibido;
        datosCheckout.cambio = montoRecibido - total;
    }
    
    // Agregar referencia si aplica
    if (referenciaPago) {
        datosCheckout.referencia_pago = referenciaPago;
    }
    
    try {
        const resultado = await pywebview.api.realizar_checkout(habitacionActual._id, datosCheckout);
        
        if (resultado.success) {
            cerrarModalFacturacion();
            mostrarMensaje(resultado.message || 'Pago realizado exitosamente');
            await cambiarVistaFacturacion('historial');
        } else {
            mostrarError(resultado.message || 'Error al realizar el pago');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error al realizar el pago');
    }
}

// Cerrar modal de confirmación
function cerrarModalConfirmacion() {
    const modal = document.getElementById('modalConfirmacion');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Cerrar modal
function cerrarModalFacturacion() {
    document.getElementById('modalFacturacion').classList.remove('active');
    habitacionActual = null;
    
    // Detener actualización automática del modal
    detenerActualizacionModal();
}

// ----- Historial de facturación (check-outs guardados en BD) -----

function fechaLocalYYYYMMDD(fecha) {
    const d = typeof fechaColombia === 'function' ? fechaColombia(fecha) : (fecha instanceof Date ? fecha : new Date(fecha));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function escaparTextoHistorial(texto) {
    if (texto == null || texto === '') return '';
    return String(texto)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function textoVehiculoHistorial(f) {
    const h = { placa: f.placa, tipo_vehiculo: f.tipo_vehiculo };
    if (tienePlacaVehiculoReal(h)) return String(f.placa);
    return etiquetaMedioTransporte(h);
}

function alCambiarSedeFacturacion() {
    if (vistaFacturacionActiva === 'por_facturar') {
        cargarHabitacionesOcupadas();
    } else {
        void consultarHistorialFacturacion();
    }
}

function alCambiarFechasHistorial() {
    if (vistaFacturacionActiva === 'historial') {
        void consultarHistorialFacturacion();
    }
}

async function cambiarVistaFacturacion(vista) {
    vistaFacturacionActiva = vista;
    const panelPor = document.getElementById('panelPorFacturar');
    const panelHist = document.getElementById('panelHistorialFacturado');
    const tabPor = document.getElementById('tabPorFacturar');
    const tabHist = document.getElementById('tabHistorialFacturado');

    if (vista === 'por_facturar') {
        if (panelPor) panelPor.hidden = false;
        if (panelHist) panelHist.hidden = true;
        if (tabPor) {
            tabPor.classList.add('active');
            tabPor.setAttribute('aria-selected', 'true');
        }
        if (tabHist) {
            tabHist.classList.remove('active');
            tabHist.setAttribute('aria-selected', 'false');
        }
        cargarHabitacionesOcupadas();
    } else {
        // Detener actualización automática al cambiar al historial
        detenerActualizacionAutomatica();
        
        if (panelPor) panelPor.hidden = true;
        if (panelHist) panelHist.hidden = false;
        if (tabPor) {
            tabPor.classList.remove('active');
            tabPor.setAttribute('aria-selected', 'false');
        }
        if (tabHist) {
            tabHist.classList.add('active');
            tabHist.setAttribute('aria-selected', 'true');
        }
        await inicializarPanelHistorialFacturacion();
    }
}

/** Al abrir historial: rango amplio y carga automática (respeta sede elegida arriba). */
async function inicializarPanelHistorialFacturacion() {
    aplicarRangoHistorialFacturacion('todo');
    cargarMesesDisponibles();
    const tbody = document.getElementById('historialFacturacionTableBody');
    if (tbody) {
        tbody.innerHTML =
            '<tr><td colspan="11" class="text-center"><i class="fas fa-spinner fa-spin"></i> Cargando facturas…</td></tr>';
    }
    await consultarHistorialFacturacion();
}

/** Cargar solo los meses que ya han pasado del año actual */
function cargarMesesDisponibles() {
    const selectorMes = document.getElementById('historialSelectorMes');
    if (!selectorMes) return;
    
    const hoy = new Date();
    const mesActual = hoy.getMonth(); // 0 = Enero, 1 = Febrero, etc.
    
    const nombresMeses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    
    // Limpiar opciones existentes excepto la primera
    selectorMes.innerHTML = '<option value="">Seleccionar mes...</option>';
    
    // Agregar solo los meses que ya pasaron (no incluir el mes actual)
    for (let i = 0; i < mesActual; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = nombresMeses[i];
        selectorMes.appendChild(option);
    }
}

async function aplicarRangoYConsultarHistorial(tipo) {
    aplicarRangoHistorialFacturacion(tipo);
    await consultarHistorialFacturacion();
}

function aplicarRangoHistorialFacturacion(tipo) {
    const hoy = new Date();
    const hasta = document.getElementById('historialFechaHasta');
    const desde = document.getElementById('historialFechaDesde');
    const selectorMes = document.getElementById('historialSelectorMes');
    
    // Limpiar selector de mes cuando se usa un botón de rango
    if (selectorMes) {
        selectorMes.value = '';
    }
    
    hasta.value = fechaLocalYYYYMMDD(hoy);
    if (tipo === 'hoy') {
        desde.value = fechaLocalYYYYMMDD(hoy);
    } else if (tipo === '7d') {
        const d = new Date(hoy);
        d.setDate(d.getDate() - 6);
        desde.value = fechaLocalYYYYMMDD(d);
    } else if (tipo === 'mes') {
        const d = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        desde.value = fechaLocalYYYYMMDD(d);
    } else if (tipo === 'todo') {
        // Iniciar desde el 1 de enero del año actual
        const d = new Date(hoy.getFullYear(), 0, 1);
        desde.value = fechaLocalYYYYMMDD(d);
    }
}

/** Aplicar mes seleccionado del año actual y consultar */
async function aplicarMesSeleccionadoYConsultar() {
    const selectorMes = document.getElementById('historialSelectorMes');
    const mesValue = selectorMes.value;
    
    if (mesValue === '') {
        return;
    }
    
    const mesIndex = parseInt(mesValue);
    const anioActual = new Date().getFullYear();
    
    // Primer día del mes seleccionado
    const primerDia = new Date(anioActual, mesIndex, 1);
    
    // Último día del mes seleccionado
    const ultimoDia = new Date(anioActual, mesIndex + 1, 0);
    
    const desde = document.getElementById('historialFechaDesde');
    const hasta = document.getElementById('historialFechaHasta');
    
    desde.value = fechaLocalYYYYMMDD(primerDia);
    hasta.value = fechaLocalYYYYMMDD(ultimoDia);
    
    await consultarHistorialFacturacion();
}

async function consultarHistorialFacturacion() {
    const fd = document.getElementById('historialFechaDesde').value;
    const fh = document.getElementById('historialFechaHasta').value;
    const sede = document.getElementById('sedeFilter').value;
    if (!fd || !fh) {
        mostrarError('Seleccione fecha desde y hasta.');
        return;
    }
    const tbody = document.getElementById('historialFacturacionTableBody');
    if (tbody && vistaFacturacionActiva === 'historial') {
        tbody.innerHTML =
            '<tr><td colspan="11" class="text-center"><i class="fas fa-spinner fa-spin"></i> Cargando…</td></tr>';
    }
    try {
        await esperarPywebview();
        const res = await pywebview.api.obtener_historial_facturas(fd, fh, sede);
        if (!res || !res.success) {
            mostrarError(res && res.message ? res.message : 'No se pudo cargar el historial');
            historialFacturasLista = [];
            historialFacturacionPendienteConsulta = false;
            renderizarTablaHistorialFacturacion();
            return;
        }
        historialFacturasLista = res.facturas || [];
        historialFacturacionPendienteConsulta = false;
        renderizarTablaHistorialFacturacion();
    } catch (e) {
        console.error(e);
        mostrarError('Error al consultar el historial');
    }
}

function formatearFechaHoraHistorial(iso) {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        return d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Bogota' });
    } catch (e) {
        return String(iso);
    }
}

function formatearSoloFechaHistorial(iso) {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'America/Bogota' });
    } catch (e) {
        return String(iso);
    }
}

/** Una sola línea: 05:48 am / 02:30 pm (sin «a. m.» de locale). */
function formatearSoloHoraHistorial(iso) {
    if (!iso) return '—';
    try {
        const d = typeof fechaColombia === 'function' ? fechaColombia(iso) : new Date(iso);
        const hh24 = d.getHours();
        const min = d.getMinutes();
        const ampm = hh24 < 12 ? 'am' : 'pm';
        const h12 = hh24 % 12;
        const hDisp = h12 === 0 ? 12 : h12;
        const hh = String(hDisp).padStart(2, '0');
        const mm = String(min).padStart(2, '0');
        return `${hh}:${mm} ${ampm}`;
    } catch (e) {
        return String(iso);
    }
}

/** Hora para tirilla: 12 h con am/pm pegado (ej. 9:30am, 2:00pm) para ocupar poco ancho. */
function formatearSoloHoraTirilla(iso) {
    if (!iso) return '—';
    try {
        const d = typeof fechaColombia === 'function' ? fechaColombia(iso) : new Date(iso);
        const hh24 = d.getHours();
        const min = d.getMinutes();
        const ampm = hh24 < 12 ? 'am' : 'pm';
        const h12 = hh24 % 12;
        const hDisp = h12 === 0 ? 12 : h12;
        const mm = String(min).padStart(2, '0');
        return `${hDisp}:${mm}${ampm}`;
    } catch (e) {
        return String(iso);
    }
}

/** Igual que el desplegable: «Sede 1 - Sevilla»; si falta ciudad, solo el nombre de sede. */
function textoLugarSedeHistorial(f) {
    const nombre = (f.sede_nombre || '').toString().trim();
    const ciudad = (f.sede_ciudad || '').toString().trim();
    if (nombre && ciudad) return `${nombre} - ${ciudad}`;
    if (nombre) return nombre;
    if (ciudad) return ciudad;
    return '—';
}

/** Ej. 03 - Suite Premium (número y nombre de habitación). */
function etiquetaHabitacionTipo(f) {
    const rawNum = f.habitacion_numero;
    const numStr = rawNum != null && String(rawNum).trim() !== '' ? String(rawNum).trim() : '';
    const nom = (f.habitacion_nombre || '').toString().trim();
    const numFmt = numStr && /^\d+$/.test(numStr) ? numStr.padStart(2, '0') : numStr;
    if (numFmt && nom) return `${numFmt} - ${nom}`;
    if (nom) return nom;
    if (numFmt) return numFmt;
    return '—';
}

/** Pie de impresión sin «a. m.» del sistema. */
function fechaHoraPieGenerada() {
    const d = typeof fechaColombia === 'function' ? fechaColombia() : new Date();
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const anio = String(d.getFullYear()).slice(-2);
    return `${dia}/${mes}/${anio} ${formatearSoloHoraHistorial(d.getTime())}`;
}

/** Pie en tirillas térmicas: misma fecha, hora en 24 h (sin am/pm). */
function fechaHoraPieGeneradaTirilla() {
    const d = typeof fechaColombia === 'function' ? fechaColombia() : new Date();
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const anio = String(d.getFullYear()).slice(-2);
    return `${dia}/${mes}/${anio} ${formatearSoloHoraTirilla(d.getTime())}`;
}

/**
 * Referencia consecutiva REF-100001, REF-100002… (mismo contador que en servidor).
 * Facturas antiguas FACT-00001 se muestran como REF-100001; sin datos: REF- + id.
 */
function codigoFacturaParaMostrar(f) {
    const n = f.numero_factura_secuencial;
    if (n != null && n !== '' && !Number.isNaN(Number(n))) {
        return `REF-${String(100000 + Number(n)).padStart(6, '0')}`;
    }
    const c = (f.codigo_factura || '').toString().trim();
    if (c) {
        const mFact = c.match(/^FACT-(\d+)$/i);
        if (mFact) {
            return `REF-${String(100000 + parseInt(mFact[1], 10)).padStart(6, '0')}`;
        }
        if (/^REF-\d{6,}$/i.test(c)) return c.toUpperCase();
        return c;
    }
    const id = (f._id || '').toString();
    if (id.length >= 8) return `REF-${id.slice(-8).toUpperCase()}`;
    return id || '—';
}

function movimientosFactura(f) {
    const movs = Array.isArray(f.movimientos_cuenta) ? f.movimientos_cuenta : [];
    return movs.filter(m => !String(m.descripcion || '').startsWith('Devuelto:'));
}

function calcularDescuentoFactura(f) {
    const tipoOcupacion = f.tipo_ocupacion || 'horas';
    let precioEstandar = 0;
    let precioAcordado = 0;
    
    if (tipoOcupacion === 'varios_dias') {
        const dias = f.dias_personalizados || 2;
        precioEstandar = (f.precio_dia || 100000) * dias;
        precioAcordado = f.precio_acordado || precioEstandar;
    } else if (tipoOcupacion === 'dia') {
        precioEstandar = f.precio_dia || 100000;
        precioAcordado = f.precio_acordado || precioEstandar;
    } else if (tipoOcupacion === 'noche') {
        precioEstandar = f.precio_noche || 80000;
        precioAcordado = f.precio_acordado || precioEstandar;
    } else {
        precioEstandar = f.precio_horas || f.precio_base || f.precio || 30000;
        precioAcordado = f.precio_acordado || precioEstandar;
    }
    
    const tieneDescuento = precioAcordado < precioEstandar;
    const descuento = tieneDescuento ? precioEstandar - precioAcordado : 0;
    
    return {
        tieneDescuento,
        precioEstandar,
        precioAcordado,
        descuento
    };
}

/** Texto en columna descripción: solo tipo/horas; quita textos viejos y precios. */
function descripcionMovimientoParaReporte(texto) {
    if (texto == null || texto === '') return '';
    let s = String(texto);
    if (/^Ocupaci[oó]n\s+habitaci[oó]n\s*\(/i.test(s)) {
        s = s.replace(/^Ocupaci[oó]n\s+habitaci[oó]n\s*\(/i, '');
        if (s.endsWith(')')) s = s.slice(0, -1).trim();
    } else if (/^Ocupaci[oó]n\s*\/\s*hospedaje\s*\(/i.test(s)) {
        s = s.replace(/^Ocupaci[oó]n\s*\/\s*hospedaje\s*\(/i, '');
        if (s.endsWith(')')) s = s.slice(0, -1).trim();
    }
    s = s.replace(/,?\s*valor\s+acordado\s*:\s*\$[\d.,]+\s*$/i, '');
    s = s.replace(/\s*,\s*valor\s+estimado\s+al\s+cierre\s*/gi, '');
    s = s.replace(/\(\s*tipo:\s*([^,)]+)\s*,\s*valor\s+estimado\s+al\s+cierre\s*\)/gi, '($1)');
    s = s.replace(/^Consumo\s*:\s*/i, '');
    s = s.replace(/×/g, 'x');
    s = s.replace(/\)+\s*$/g, ')');
    return s.trim();
}

function esTextoTipoOcupacionLegado(desc) {
    const t = (desc || '').trim();
    if (!t) return false;
    return /^(Estándar|Estandar|Noche|D[ií]a\s*\(|Varios)/i.test(t);
}

/**
 * Quita el sufijo « x N » del final (consumos) y devuelve cantidad para columna CANT.
 * Sin sufijo → «—»; la fila 0 (habitación) se corrige a «1» en filasMovimientosTablaPos.
 */
function separarDescripcionYCantidadPos(descReporte) {
    const s = (descReporte || '').trim();
    // Soporta: "nombre x 7", "nombre x 7 (externo)", "nombre x 7 (único)"
    const m = s.match(/\s+x\s+(\d+)\s*(?:\([^)]*\))?\s*$/i);
    if (m) {
        return { descripcion: s.slice(0, m.index).trim(), cantidad: m[1] };
    }
    return { descripcion: s, cantidad: '—' };
}

function cssTablasMovimientosProfesional() {
    return `
    .wrap-mov-tbl { width: 100%; margin-top: 8px; }
    table.tbl-mov-prof { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9px; }
    table.tbl-mov-prof th, table.tbl-mov-prof td {
        border: 1px solid #000;
        padding: 6px 5px;
        vertical-align: top;
        background: #fff;
        color: #000;
    }
    table.tbl-mov-prof thead th {
        background: #fff;
        color: #000;
        font-weight: 700;
        font-size: 8px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        border-bottom: 2px solid #000;
    }
    table.tbl-mov-prof tbody tr:nth-child(even) { background: #fff; }
    table.tbl-mov-prof .c-fecha { width: 14%; white-space: nowrap; }
    table.tbl-mov-prof .c-hora { width: 13%; white-space: nowrap; }
    table.tbl-mov-prof .c-valor { width: 17%; text-align: right; white-space: nowrap; }
    table.tbl-mov-prof .c-usuario { width: 17%; word-break: break-word; }
    table.tbl-mov-prof .c-desc { word-break: break-word; overflow-wrap: anywhere; }
    .mov-sin { font-size: 10px; color: #666; margin: 8px 0; }`;
}

/**
 * Tirilla 80 mm: 6 columnas (incluye CANT); equilibrado: descripción moderada, usuario legible.
 */
function cssColumnasTablaMovimientosPos() {
    return `
    table.tbl-mov-pos thead th { font-size: 6.5px; letter-spacing: 0.02em; padding: 4px 2px; }
    table.tbl-mov-pos .c-fecha { width: 12%; white-space: nowrap; }
    table.tbl-mov-pos .c-hora { width: 10%; white-space: nowrap; }
    table.tbl-mov-pos .c-desc { width: 28%; word-break: break-word; overflow-wrap: anywhere; }
    table.tbl-mov-pos .c-cant { width: 8%; text-align: center; white-space: nowrap; }
    table.tbl-mov-pos .c-valor { width: 14%; text-align: right; white-space: nowrap; }
    table.tbl-mov-pos .c-usuario { width: 20%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }`;
}

function filasMovimientosTablaProfesional(movs, facturaOpt) {
    const esc = escaparTextoHistorial;
    return movs
        .map((m, idx) => {
            const fechaIso = m.fecha || '';
            let desc = descripcionMovimientoParaReporte(m.descripcion || '');
            if (facturaOpt && idx === 0 && esTextoTipoOcupacionLegado(desc)) {
                desc = etiquetaHabitacionTipo(facturaOpt);
            }
            return `<tr>
            <td class="c-fecha">${esc(formatearSoloFechaHistorial(fechaIso))}</td>
            <td class="c-hora">${esc(formatearSoloHoraHistorial(fechaIso))}</td>
            <td class="c-desc">${esc(desc)}</td>
            <td class="c-valor">${formatearPrecio(Number(m.valor) || 0)}</td>
            <td class="c-usuario">${esc(m.usuario || '—')}</td>
        </tr>`;
        })
        .join('');
}

function filasMovimientosTablaPos(movs, facturaOpt) {
    const esc = escaparTextoHistorial;
    return movs
        .map((m, idx) => {
            const fechaIso = m.fecha || '';
            let desc = descripcionMovimientoParaReporte(m.descripcion || '');
            if (facturaOpt && idx === 0 && esTextoTipoOcupacionLegado(desc)) {
                desc = etiquetaHabitacionTipo(facturaOpt);
            }
            let { descripcion: descCol, cantidad: cantCol } = separarDescripcionYCantidadPos(desc);
            if (idx === 0 && cantCol === '—') {
                cantCol = '1';
            }
            // Preservar etiqueta (externo) o (único) en la descripción de la tirilla
            const sufijo = (m.descripcion || '').match(/\((externo|único)\)\s*$/i);
            if (sufijo) descCol = descCol + ' (' + sufijo[1] + ')';
            return `<tr>
            <td class="c-fecha">${esc(formatearSoloFechaHistorial(fechaIso))}</td>
            <td class="c-hora">${esc(formatearSoloHoraTirilla(fechaIso))}</td>
            <td class="c-desc">${esc(descCol)}</td>
            <td class="c-cant">${esc(cantCol)}</td>
            <td class="c-valor">${formatearPrecio(Number(m.valor) || 0)}</td>
            <td class="c-usuario">${esc(m.usuario || '—')}</td>
        </tr>`;
        })
        .join('');
}

function htmlTablaMovimientosPos(movs, facturaOpt) {
    const lista = movs && movs.length ? movs : [];
    if (!lista.length) {
        return '<p class="mov-sin">Sin movimientos</p>';
    }
    const filas = filasMovimientosTablaPos(lista, facturaOpt);
    return `<div class="wrap-mov-tbl"><table class="tbl-mov-prof tbl-mov-pos"><thead><tr>
        <th class="c-fecha">Fecha</th><th class="c-hora">Hora</th><th class="c-desc">Descripción</th><th class="c-cant">Cant</th><th class="c-valor">Valor</th><th class="c-usuario">Usuario</th>
    </tr></thead><tbody>${filas}</tbody></table></div>`;
}

function htmlTablaMovimientosFactura(f) {
    const movs = movimientosFactura(f);
    if (!movs.length) {
        return '<p style="font-size:11px;color:#666;margin:6px 0">Sin líneas de bitácora.</p>';
    }
    const filas = filasMovimientosTablaProfesional(movs, f);
    return `<div class="wrap-mov-tbl"><table class="tbl-mov-prof"><thead><tr>
        <th class="c-fecha">Fecha</th><th class="c-hora">Hora</th><th class="c-desc">Descripción</th><th class="c-valor">Valor</th><th class="c-usuario">Usuario</th>
    </tr></thead><tbody>${filas}</tbody></table></div>`;
}

function htmlBloqueDetalleFacturaPdf(f) {
    const refF = f.fecha_registro || f.fecha_salida;
    const codFac = escaparTextoHistorial(codigoFacturaParaMostrar(f));
    const habEtq = escaparTextoHistorial(etiquetaHabitacionTipo(f));
    const sedeTxt = escaparTextoHistorial(textoLugarSedeHistorial(f));
    const facturo = escaparTextoHistorial(f.usuario_facturo || '—');
    const ocup = (f.usuario_ocupacion || '').toString().trim();
    
    // Calcular descuento si existe
    const infoDescuento = calcularDescuentoFactura(f);
    let bloqueDescuento = '';
    if (infoDescuento.tieneDescuento) {
        bloqueDescuento = `<p style="font-size:11px;margin:4px 0;line-height:1.5;color:#000">
            <strong>Precio estándar:</strong> ${formatearPrecio(Math.round(infoDescuento.precioEstandar))} · 
            <strong style="color:#d32f2f">Descuento:</strong> <span style="color:#d32f2f">-${formatearPrecio(Math.round(infoDescuento.descuento))}</span> · 
            <strong style="color:#2e7d32">Precio acordado:</strong> <span style="color:#2e7d32">${formatearPrecio(Math.round(infoDescuento.precioAcordado))}</span>
        </p>`;
    }
    
    const partesMeta = [
        `<strong>Cobro:</strong> ${escaparTextoHistorial(formatearSoloFechaHistorial(refF))} ${escaparTextoHistorial(formatearSoloHoraHistorial(refF))}`,
        `<strong>Pago:</strong> ${escaparTextoHistorial((f.metodo_pago || '').replace(/^\w/, c => c.toUpperCase()))}${f.referencia_pago ? ' - ' + escaparTextoHistorial(f.referencia_pago) : ''}`,
        `<strong>Facturó:</strong> ${facturo}`,
    ];
    if (ocup) {
        partesMeta.push(`<strong>Registró ocupación:</strong> ${escaparTextoHistorial(ocup)}`);
    }
    const bloqueMeta = `<p style="font-size:11px;margin:8px 0 4px;line-height:1.5;color:#000">${partesMeta.join(' · ')}</p>`;
    const totalBajoTabla = `<p style="margin:12px 0 0;font-size:12px;font-weight:700;color:#000">Total cobrado: ${formatearPrecio(Number(f.total) || 0)}</p>`;
    return `<div class="bloque-detalle-factura" style="margin-top:18px;page-break-inside:avoid">
        <p style="margin:0 0 2px;font-size:11px;font-weight:600;color:#000;border-bottom:2px solid #000;padding-bottom:5px">${codFac}</p>
        <p style="margin:6px 0 8px;font-size:14px;font-weight:700;color:#000">${habEtq}</p>
        <p style="font-size:11px;margin:2px 0;color:#000">${sedeTxt}</p>
        ${bloqueMeta}
        ${bloqueDescuento}
        ${htmlTablaMovimientosFactura(f)}
        ${totalBajoTabla}
    </div>`;
}

function imprimirDetalleFacturaIndividualPorIndice(indice) {
    const f = historialFacturasLista[indice];
    if (!f) {
        mostrarError('Factura no encontrada.');
        return;
    }
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:absolute;width:0;height:0;border:none';
    document.body.appendChild(iframe);
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Detalle factura</title>
    <style>
    @page { size: letter; margin: 1cm; }
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #000; }
    h1 { font-size: 20px; margin-top: 0; color: #000; }
    ${cssTablasMovimientosProfesional()}
    </style></head><body>
    <h1>DETALLE DE FACTURA</h1>
    ${htmlBloqueDetalleFacturaPdf(f)}
    <p style="margin-top:16px;font-size:11px;color:#000">Generado: ${escaparTextoHistorial(fechaHoraPieGenerada())}</p>
    </body></html>`;
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 400);
}

function imprimirTirillaFacturaIndividualPorIndice(indice) {
    const f = historialFacturasLista[indice];
    if (!f) {
        mostrarError('Factura no encontrada.');
        return;
    }
    const refF = f.fecha_registro || f.fecha_salida;
    const movs = movimientosFactura(f);
    
    // Calcular descuento si existe
    const infoDescuento = calcularDescuentoFactura(f);
    let bloqueDescuento = '';
    if (infoDescuento.tieneDescuento) {
        bloqueDescuento = `<div class="meta-line" style="margin-top:6px;padding-top:6px;border-top:1px dashed #ccc">
            <strong>Precio estándar:</strong> ${formatearPrecio(Math.round(infoDescuento.precioEstandar))}<br>
            <strong style="color:#d32f2f">Descuento:</strong> <span style="color:#d32f2f">-${formatearPrecio(Math.round(infoDescuento.descuento))}</span><br>
            <strong style="color:#2e7d32">Precio acordado:</strong> <span style="color:#2e7d32">${formatearPrecio(Math.round(infoDescuento.precioAcordado))}</span>
        </div>`;
    }
    
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:absolute;width:0;height:0;border:none';
    document.body.appendChild(iframe);
    const codFac = escaparTextoHistorial(codigoFacturaParaMostrar(f));
    const habEtq = escaparTextoHistorial(etiquetaHabitacionTipo(f));
    const sedeTxt = escaparTextoHistorial(textoLugarSedeHistorial(f));
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Tirilla factura</title>
    <style>
    /* Ancho 80 mm: estándar en impresoras térmicas POS (rollo 80 mm). Para rollo 58 mm cambiar a 58mm. */
    @page { size: 80mm auto; margin: 0; }
    body { font-family: Arial, 'Helvetica Neue', sans-serif; width: 80mm; max-width: 80mm; margin: 0; padding: 8px 6px; box-sizing: border-box; font-size: 9px; color: #000; background: #fff; }
    .cab { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px; }
    .cab .tit { font-size: 11px; font-weight: 700; letter-spacing: 0.05em; color: #000; }
    .cab .cod { font-size: 10px; font-weight: 600; margin-top: 5px; color: #000; letter-spacing: 0.03em; }
    .cab .hab { font-size: 12px; font-weight: 700; margin-top: 5px; color: #000; }
    .cab .cab-sub { font-size: 9px; color: #000; margin-top: 6px; }
    .meta-line { margin: 3px 0; font-size: 9px; }
    .mov-tit { margin: 6px 0 4px; font-weight: 700; font-size: 9px; letter-spacing: 0.06em; color: #000; }
    .pie-fac { margin-top: 8px; padding-top: 4px; }
    .pie-fac .tot { margin-top: 10px; font-weight: bold; text-align: center; font-size: 11px; }
    ${cssTablasMovimientosProfesional()}
    ${cssColumnasTablaMovimientosPos()}
    table.tbl-mov-prof { font-size: 7.5px; }
    table.tbl-mov-prof th, table.tbl-mov-prof td { padding: 4px 3px; }
    </style></head><body>
    <div class="cab"><div class="tit">DETALLE DE FACTURA</div><div class="cod">${codFac}</div><div class="hab">${habEtq}</div><div class="cab-sub">${escaparTextoHistorial(formatearSoloFechaHistorial(refF))} ${escaparTextoHistorial(formatearSoloHoraTirilla(refF))} · ${sedeTxt}</div></div>
    ${bloqueDescuento}
    <div class="mov-tit">MOVIMIENTOS</div>
    ${htmlTablaMovimientosPos(movs, f)}
    <div class="pie-fac">
    <div class="meta-line">Facturó: ${escaparTextoHistorial(f.usuario_facturo || '—')}${(f.usuario_ocupacion || '').toString().trim() ? ` · Registró ocupación: ${escaparTextoHistorial(f.usuario_ocupacion)}` : ''}</div>
    <div class="tot">TOTAL ${formatearPrecio(Number(f.total) || 0)}<br><span style="font-weight:normal">${escaparTextoHistorial((f.metodo_pago || '').replace(/^\w/, c => c.toUpperCase()))}${f.referencia_pago ? ' - ' + escaparTextoHistorial(f.referencia_pago) : ''}</span></div>
    </div>
    <p style="text-align:center;font-size:8px;margin-top:8px">${escaparTextoHistorial(fechaHoraPieGeneradaTirilla())}</p>
    </body></html>`;
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 400);
}

function renderizarTablaHistorialFacturacion() {
    const tbody = document.getElementById('historialFacturacionTableBody');
    if (!tbody) return;
    if (!historialFacturasLista.length) {
        const msg = historialFacturacionPendienteConsulta
            ? 'Cargando o sin datos aún.'
            : 'No hay facturas en el periodo y sede seleccionados.';
        tbody.innerHTML = `<tr><td colspan="11" class="text-center">${msg}</td></tr>`;
        return;
    }
    const ref = (f) => f.fecha_registro || f.fecha_salida;
    tbody.innerHTML = historialFacturasLista.map((f, indice) => {
        const nombreHab = escaparTextoHistorial(f.habitacion_nombre || '');
        const numHab = escaparTextoHistorial(String(f.habitacion_numero ?? ''));
        const lugarTxt = escaparTextoHistorial(textoLugarSedeHistorial(f));
        const veh = escaparTextoHistorial(textoVehiculoHistorial(f));
        const pago = escaparTextoHistorial(f.metodo_pago || '');
        const facturo = escaparTextoHistorial(f.usuario_facturo || '—');
        const codFac = escaparTextoHistorial(codigoFacturaParaMostrar(f));
        return `<tr>
            <td class="historial-col-codfac"><strong>${codFac}</strong></td>
            <td class="historial-col-fecha">${escaparTextoHistorial(formatearSoloFechaHistorial(ref(f)))}</td>
            <td class="historial-col-hora">${escaparTextoHistorial(formatearSoloHoraHistorial(ref(f)))}</td>
            <td class="historial-col-lugar">${lugarTxt}</td>
            <td class="historial-col-num">${numHab}</td>
            <td>${nombreHab}</td>
            <td>${veh}</td>
            <td>${formatearPrecio(Number(f.total) || 0)}</td>
            <td>${pago}</td>
            <td>${facturo}</td>
            <td class="historial-col-acciones" style="white-space:nowrap">
                <button type="button" class="btn-icon" onclick="imprimirDetalleFacturaIndividualPorIndice(${indice})" title="Imprimir detalle (carta)"><i class="fas fa-file-pdf"></i></button>
                <button type="button" class="btn-icon" onclick="imprimirTirillaFacturaIndividualPorIndice(${indice})" title="Imprimir tirilla"><i class="fas fa-receipt"></i></button>
            </td>
        </tr>`;
    }).join('');
}

function textoSedeSeleccionadaFacturacion() {
    const sel = document.getElementById('sedeFilter');
    if (!sel || sel.selectedIndex < 0) return '';
    return sel.options[sel.selectedIndex].text;
}

function imprimirHistorialFacturacionPDF() {
    if (!historialFacturasLista.length) {
        mostrarError('No hay datos en el listado actual. Ajuste fechas o sede.');
        return;
    }
    const fd = document.getElementById('historialFechaDesde').value;
    const fh = document.getElementById('historialFechaHasta').value;
    const sedeTexto = textoSedeSeleccionadaFacturacion();
    const suma = historialFacturasLista.reduce((a, f) => a + (Number(f.total) || 0), 0);

    const bloquesDetalle = historialFacturasLista.map((f) => htmlBloqueDetalleFacturaPdf(f)).join('');

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:absolute;width:0;height:0;border:none';
    document.body.appendChild(iframe);
    const tituloRango = `${fd} a ${fh}`;
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Historial facturación</title>
    <style>
    @page { size: letter; margin: 1cm; }
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #000; }
    h1 { margin: 0 0 8px 0; font-size: 22px; color: #000; }
    .meta { margin-bottom: 20px; font-size: 13px; color: #000; }
    .resumen-final { margin-top: 24px; padding: 12px; border: 2px solid #000; font-size: 14px; font-weight: 700; }
    ${cssTablasMovimientosProfesional()}
    </style></head><body>
    <h1>HISTORIAL DE FACTURACIÓN</h1>
    <div class="meta"><strong>Periodo:</strong> ${escaparTextoHistorial(tituloRango)}<br>
    <strong>Sede:</strong> ${escaparTextoHistorial(sedeTexto)}<br>
    <strong>Generado:</strong> ${escaparTextoHistorial(fechaHoraPieGenerada())}</div>
    <p style="font-size:13px;font-weight:600;margin:0 0 12px 0">Detalle por factura (tabla de movimientos y total debajo de cada una)</p>
    ${bloquesDetalle}
    <div class="resumen-final">Total facturado en el periodo: ${formatearPrecio(Math.round(suma))}</div>
    </body></html>`;
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 400);
}

function imprimirHistorialFacturacionTirilla() {
    if (!historialFacturasLista.length) {
        mostrarError('No hay datos en el listado actual. Ajuste fechas o sede.');
        return;
    }
    const fd = document.getElementById('historialFechaDesde').value;
    const fh = document.getElementById('historialFechaHasta').value;
    const sedeTexto = textoSedeSeleccionadaFacturacion();
    const suma = historialFacturasLista.reduce((a, f) => a + (Number(f.total) || 0), 0);
    const lineas = historialFacturasLista
        .map((f) => {
            const refF = f.fecha_registro || f.fecha_salida;
            const fStr = formatearSoloFechaHistorial(refF);
            const hTirilla = formatearSoloHoraTirilla(refF);
            const lugar = textoLugarSedeHistorial(f);
            const cod = codigoFacturaParaMostrar(f);
            const hab = etiquetaHabitacionTipo(f);
            const movs = movimientosFactura(f);
            
            // Calcular descuento si existe
            const infoDescuento = calcularDescuentoFactura(f);
            let bloqueDescuento = '';
            if (infoDescuento.tieneDescuento) {
                bloqueDescuento = `<div class="lf-descuento">
                    <div style="font-size:8px;margin:2px 0"><strong>Precio estándar:</strong> ${formatearPrecio(Math.round(infoDescuento.precioEstandar))}</div>
                    <div style="font-size:8px;margin:2px 0;color:#d32f2f"><strong>Descuento:</strong> -${formatearPrecio(Math.round(infoDescuento.descuento))}</div>
                    <div style="font-size:8px;margin:2px 0;color:#2e7d32"><strong>Precio acordado:</strong> ${formatearPrecio(Math.round(infoDescuento.precioAcordado))}</div>
                </div>`;
            }
            
            const bloqueMovs = movs.length
                ? `<div class="bloque-movs-pos"><div class="mov-tit">MOVIMIENTOS</div>${htmlTablaMovimientosPos(movs, f)}</div>`
                : '<p class="mov-sin" style="margin:6px 0;font-size:8px">Sin movimientos</p>';
            return `<div class="linea-fac">
                <div class="lf-cod">${escaparTextoHistorial(cod)}</div>
                <div class="lf-hab">${escaparTextoHistorial(hab)}</div>
                <div class="lf-meta lf-meta-cobro">${escaparTextoHistorial(fStr)} ${escaparTextoHistorial(hTirilla)} · ${escaparTextoHistorial(lugar)}</div>
                ${bloqueDescuento}
                ${bloqueMovs}
                <div class="lf-pie">
                <div class="lf-tot">${formatearPrecio(Number(f.total) || 0)} ${escaparTextoHistorial(f.metodo_pago || '')}</div>
                <div class="lf-fac">Facturó: ${escaparTextoHistorial(f.usuario_facturo || '—')}${(f.usuario_ocupacion || '').toString().trim() ? ` · Registró ocupación: ${escaparTextoHistorial(f.usuario_ocupacion)}` : ''}</div>
                </div></div>`;
        })
        .join('');

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:absolute;width:0;height:0;border:none';
    document.body.appendChild(iframe);
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Tirilla historial</title>
    <style>
    @page { size: 80mm auto; margin: 0; }
    body { font-family: Arial, 'Helvetica Neue', sans-serif; width: 80mm; max-width: 80mm; margin: 0; padding: 8px 6px; box-sizing: border-box; font-size: 9px; color: #000; background: #fff; }
    .cab { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px; }
    .linea-fac { border-bottom: 1px dashed #000; padding: 10px 0; }
    .lf-cod { font-weight: 700; font-size: 12px; color: #000; }
    .lf-hab { font-weight: 600; font-size: 10px; margin-top: 3px; color: #000; }
    .mov-tit { margin: 6px 0 4px; font-weight: 700; font-size: 8px; letter-spacing: 0.06em; color: #000; }
    .lf-meta { font-size: 8px; color: #000; margin-top: 4px; }
    .lf-meta-cobro { margin-top: 5px; margin-bottom: 2px; }
    .lf-descuento { margin-top: 5px; padding-top: 5px; border-top: 1px dashed #ccc; }
    .lf-tot { font-weight: 700; margin-top: 5px; font-size: 10px; color: #000; }
    .lf-fac { font-size: 8px; margin-top: 2px; color: #000; }
    .bloque-movs-pos { margin-top: 4px; padding-top: 0; border-top: none; }
    .lf-pie { margin-top: 8px; padding-top: 4px; }
    .lf-pie .lf-meta { margin-top: 0; }
    .lf-pie .lf-tot { margin-top: 6px; }
    .lf-pie .lf-fac { margin-top: 4px; }
    ${cssTablasMovimientosProfesional()}
    ${cssColumnasTablaMovimientosPos()}
    table.tbl-mov-prof { font-size: 7px; }
    table.tbl-mov-prof th, table.tbl-mov-prof td { padding: 3px 2px; }
    .tot { margin-top: 12px; font-weight: bold; text-align: center; font-size: 13px; }
    </style></head><body>
    <div class="cab"><strong>HISTORIAL FACTURACIÓN</strong><br>${escaparTextoHistorial(sedeTexto)}<br>${escaparTextoHistorial(fd)} → ${escaparTextoHistorial(fh)}</div>
    ${lineas}
    <div class="tot">TOTAL ${formatearPrecio(Math.round(suma))}</div>
    <p style="text-align:center;font-size:9px;margin-top:10px">${escaparTextoHistorial(fechaHoraPieGeneradaTirilla())}</p>
    </body></html>`;
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 400);
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

// Mostrar mensaje personalizado
function mostrarMensaje(mensaje, titulo = 'Información') {
    mostrarModalConfirmacion(mensaje, null, true);
}

// Mostrar error personalizado
function mostrarError(mensaje) {
    mostrarModalConfirmacion(mensaje, null, true);
}

// Modal de confirmación o información
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
                                  mensaje.toLowerCase().includes('advertencia') || mensaje.toLowerCase().includes('menor') ? 'warning' : 'info') : 'confirmacion';
    
    const modalHTML = `
        <div class="modal-overlay-confirm" id="confirmModal" style="display: flex; z-index: 20000;">
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
    
    // Guardar la función de confirmación
    window.accionConfirmada = onConfirm;
}

function cerrarModalConfirmacion() {
    const modal = document.getElementById('confirmModal');
    if (modal) {
        modal.remove();
    }
    window.accionConfirmada = null;
}

function confirmarAccion() {
    if (window.accionConfirmada && typeof window.accionConfirmada === 'function') {
        window.accionConfirmada();
    }
    cerrarModalConfirmacion();
}
