// Formatear precio con separador de miles
function formatearPrecio(input) {
    // Remover todo excepto números
    let valor = input.value.replace(/\D/g, '');
    
    // Si está vacío, dejar vacío
    if (valor === '') {
        input.value = '';
        return;
    }
    
    // Convertir a número y formatear con comas
    let numero = parseInt(valor);
    input.value = numero.toLocaleString('en-US');
}

// Obtener valor numérico del precio formateado
function obtenerValorPrecio() {
    const precioInput = document.getElementById('precio');
    return parseInt(precioInput.value.replace(/,/g, '') || '0');
}

// Formatear número con separador de miles
function formatearNumero(numero) {
    return parseInt(numero).toLocaleString('en-US');
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
let productos = [];
let sedes = [];
let filtroActual = 'todos';
let mostrarDesactivados = false;

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
            
            if (sesion.rol !== 'admin' && sesion.permisos && !sesion.permisos.ver_productos) {
                window.location.href = 'dasboard-admin.html';
                return;
            }
            
            if (typeof inicializarPermisos === 'function') inicializarPermisos();
            
            // Ocultar botones según permisos
            if (!tienePermiso('crear_productos')) {
                document.querySelectorAll('[onclick*="abrirModalNuevoProducto"]').forEach(function(el) { el.style.display = 'none'; });
            }
            if (!tienePermiso('descargar_pdf_productos')) {
                document.querySelectorAll('[onclick*="abrirModalImprimirReporte"]').forEach(function(el) { el.style.display = 'none'; });
            }
            if (!tienePermiso('imprimir_tirilla_productos')) {
                document.querySelectorAll('[onclick*="abrirModalImprimirTirilla"]').forEach(function(el) { el.style.display = 'none'; });
            }
            
            // Cargar sedes y productos
            await cargarSedes();
            
            // Si es empleado, forzar filtro a su sede
            if (sesion.rol !== 'admin') {
                await forzarSedeEmpleado();
            }
            
            cargarProductos();
        } else {
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error('Error al verificar sesión:', error);
        window.location.href = 'index.html';
    }
});

// Forzar filtro de sede para empleados
async function forzarSedeEmpleado() {
    try {
        const resultado = await pywebview.api.obtener_sede_empleado();
        if (resultado.success && resultado.sede) {
            const sedeFilter = document.getElementById('sedeFilter');
            sedeFilter.value = resultado.sede._id;
            // Ocultar el selector de sedes para empleados
            const sedeFilterContainer = sedeFilter.closest('.sede-filter');
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
        
        console.log('Resultado de obtener_sedes:', resultado);
        
        if (resultado.success) {
            sedes = resultado.sedes;
            
            console.log('Sedes cargadas:', sedes);
            
            // Llenar select de filtro
            const sedeFilter = document.getElementById('sedeFilter');
            sedeFilter.innerHTML = '<option value="">Todas las sedes</option>';
            sedes.forEach(sede => {
                sedeFilter.innerHTML += `<option value="${sede._id}">${sede.nombre} - ${sede.ciudad}</option>`;
            });
            
            // Llenar select del formulario
            const sedeProducto = document.getElementById('sedeProducto');
            sedeProducto.innerHTML = '<option value="TODAS">Todas las sedes</option>';
            sedes.forEach(sede => {
                sedeProducto.innerHTML += `<option value="${sede._id}">${sede.nombre} - ${sede.ciudad}</option>`;
            });
            
            // Llenar select de copiar
            const sedeDestino = document.getElementById('sedeDestino');
            sedeDestino.innerHTML = '<option value="">Seleccionar sede destino</option>';
            sedes.forEach(sede => {
                sedeDestino.innerHTML += `<option value="${sede._id}">${sede.nombre} - ${sede.ciudad}</option>`;
            });
        } else {
            console.error('Error al cargar sedes:', resultado);
        }
    } catch (error) {
        console.error('Error al cargar sedes:', error);
    }
}

// Cargar productos
async function cargarProductos() {
    try {
        const resultado = await pywebview.api.obtener_productos();
        
        if (resultado.success) {
            productos = resultado.productos;
            renderizarProductos();
        } else {
            mostrarModalConfirmacion('Error al cargar productos', null, true);
        }
    } catch (error) {
        console.error('Error al cargar productos:', error);
        mostrarModalConfirmacion('Error al cargar productos', null, true);
    }
}

// Renderizar productos en la tabla
// Renderizar productos en la tabla
function renderizarProductos() {
    const tbody = document.getElementById('productosTableBody');
    const thead = document.querySelector('.data-table thead tr');
    const table = document.querySelector('.data-table');

    if (productos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">No hay productos registrados</td></tr>';
        return;
    }

    // Filtrar productos según el filtro actual
    let productosFiltrados = productos;
    
    // Filtrar por estado activo/desactivado
    if (!mostrarDesactivados) {
        productosFiltrados = productosFiltrados.filter(p => p.activo !== false);
    } else {
        productosFiltrados = productosFiltrados.filter(p => p.activo === false);
    }

    if (filtroActual === 'bajo-stock') {
        productosFiltrados = productosFiltrados.filter(p => p.cantidad <= p.cantidad_minima);
    }

    // Filtrar por sede
    const sedeSeleccionada = document.getElementById('sedeFilter').value;
    const mostrarTodasSedes = !sedeSeleccionada;
    
    if (sedeSeleccionada) {
        productosFiltrados = productosFiltrados.filter(p => p.sede_id === sedeSeleccionada);
    }
    
    // Actualizar clase de la tabla según el filtro
    if (mostrarTodasSedes) {
        table.classList.add('vista-todas-sedes');
    } else {
        table.classList.remove('vista-todas-sedes');
    }
    
    // Actualizar encabezados de la tabla según el filtro
    if (mostrarTodasSedes) {
        thead.innerHTML = `
            <th>Código</th>
            <th>Nombre</th>
            <th>Precio</th>
            <th class="cantidad-col">Cantidad Total</th>
            <th>Proveedor</th>
            <th>Sedes</th>
            <th>Estado</th>
            <th>Acciones</th>
        `;
    } else {
        thead.innerHTML = `
            <th>Código</th>
            <th>Nombre</th>
            <th>Precio</th>
            <th class="cantidad-col">Cantidad</th>
            <th class="cantidad-col">Mínimo</th>
            <th class="cantidad-col">Máximo</th>
            <th>Proveedor</th>
            <th>Sede</th>
            <th>Estado</th>
            <th>Acciones</th>
        `;
    }

    // Aplicar búsqueda
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    if (searchTerm) {
        productosFiltrados = productosFiltrados.filter(p =>
            (p.codigo && p.codigo.toLowerCase().includes(searchTerm)) ||
            p.nombre.toLowerCase().includes(searchTerm) ||
            p.proveedor.toLowerCase().includes(searchTerm) ||
            (p.sede_nombre && p.sede_nombre.toLowerCase().includes(searchTerm))
        );
    }

    if (productosFiltrados.length === 0) {
        const colspan = mostrarTodasSedes ? '8' : '10';
        tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center">No se encontraron productos</td></tr>`;
        return;
    }

    // Agrupar productos por nombre
    const productosAgrupados = {};
    productosFiltrados.forEach(producto => {
        if (!productosAgrupados[producto.nombre]) {
            productosAgrupados[producto.nombre] = [];
        }
        productosAgrupados[producto.nombre].push(producto);
    });
    
    // Ordenar grupos por código del primer producto de cada grupo
    const nombresOrdenados = Object.keys(productosAgrupados).sort((a, b) => {
        const codigoA = parseInt(productosAgrupados[a][0].codigo) || 0;
        const codigoB = parseInt(productosAgrupados[b][0].codigo) || 0;
        return codigoA - codigoB;
    });

    // Renderizar productos agrupados
    tbody.innerHTML = nombresOrdenados.map(nombreProducto => {
        const grupo = productosAgrupados[nombreProducto];

        // Si hay múltiples sedes, mostrar todas juntas
        if (grupo.length > 1) {
            const primerProducto = grupo[0];
            const sedes = grupo.map(p => p.sede_nombre ? `${p.sede_nombre}` : 'Sin sede').join(', ');

            // CALCULAR TOTALES SUMADOS DE TODAS LAS SEDES
            const cantidadTotal = grupo.reduce((sum, p) => sum + p.cantidad, 0);
            const minimoMasBajo = Math.min(...grupo.map(p => p.cantidad_minima));

            // Calcular estado basado en la cantidad total vs el mínimo más bajo
            const estadoGlobal = obtenerEstadoStockGlobal(cantidadTotal, minimoMasBajo);

            // IDs de todos los productos del grupo
            const idsProductos = grupo.map(p => p._id).join(',');

            // Formato para vista de todas las sedes (sin columnas mínimo/máximo)
            if (mostrarTodasSedes) {
                const claseEstado = mostrarDesactivados ? 'desactivado' :
                                   estadoGlobal.clase === 'badge-warning' ? 'bajo-stock' : 
                                   estadoGlobal.clase === 'badge-danger' ? 'sin-stock' : '';
                
                // Botones de acción según el filtro
                const botonesAccion = generarBotonesAccionProducto(idsProductos, true, mostrarDesactivados);
                
                return `
                    <tr class="${claseEstado}">
                        <td><strong>${primerProducto.codigo || 'N/A'}</strong></td>
                        <td><strong>${primerProducto.nombre}</strong></td>
                        <td>${formatearNumero(primerProducto.precio)}</td>
                        <td class="cantidad-col">${cantidadTotal}</td>
                        <td>${primerProducto.proveedor}</td>
                        <td>${sedes}</td>
                        <td><span class="badge ${estadoGlobal.clase}">${estadoGlobal.texto}</span></td>
                        <td>
                            <div class="action-buttons">
                                ${botonesAccion}
                            </div>
                        </td>
                    </tr>
                `;
            } else {
                // Formato para vista de sede específica (con columnas mínimo/máximo)
                const maximoMasAlto = Math.max(...grupo.map(p => p.cantidad_maxima));
                const claseEstado = mostrarDesactivados ? 'desactivado' :
                                   estadoGlobal.clase === 'badge-warning' ? 'bajo-stock' : 
                                   estadoGlobal.clase === 'badge-danger' ? 'sin-stock' : '';
                
                // Botones de acción según el filtro
                const botonesAccion2 = generarBotonesAccionProducto(idsProductos, true, mostrarDesactivados);
                
                return `
                    <tr class="${claseEstado}">
                        <td><strong>${primerProducto.codigo || 'N/A'}</strong></td>
                        <td><strong>${primerProducto.nombre}</strong></td>
                        <td>${formatearNumero(primerProducto.precio)}</td>
                        <td class="cantidad-col">${cantidadTotal}</td>
                        <td class="cantidad-col">${minimoMasBajo}</td>
                        <td class="cantidad-col">${maximoMasAlto}</td>
                        <td>${primerProducto.proveedor}</td>
                        <td>${sedes}</td>
                        <td><span class="badge ${estadoGlobal.clase}">${estadoGlobal.texto}</span></td>
                        <td>
                            <div class="action-buttons">
                                ${botonesAccion2}
                            </div>
                        </td>
                    </tr>
                `;
            }
        } else {
            // Un solo producto
            const producto = grupo[0];
            const estado = obtenerEstadoStock(producto);
            const sedeInfo = producto.sede_nombre ? `${producto.sede_nombre} - ${producto.sede_ciudad}` : 'Sin sede';

            // Formato para vista de todas las sedes (sin columnas mínimo/máximo)
            if (mostrarTodasSedes) {
                const claseEstado = mostrarDesactivados ? 'desactivado' :
                                   estado.clase === 'badge-warning' ? 'bajo-stock' : 
                                   estado.clase === 'badge-danger' ? 'sin-stock' : '';
                
                // Botón de acción según permisos
                const botonAccion = generarBotonesAccionProducto(producto._id, false, mostrarDesactivados);
                
                return `
                    <tr class="${claseEstado}">
                        <td><strong>${producto.codigo || 'N/A'}</strong></td>
                        <td><strong>${producto.nombre}</strong></td>
                        <td>${formatearNumero(producto.precio)}</td>
                        <td class="cantidad-col">${producto.cantidad}</td>
                        <td>${producto.proveedor}</td>
                        <td>${sedeInfo}</td>
                        <td><span class="badge ${estado.clase}">${estado.texto}</span></td>
                        <td>
                            <div class="action-buttons">
                                ${botonAccion}
                            </div>
                        </td>
                    </tr>
                `;
            } else {
                // Formato para vista de sede específica (con columnas mínimo/máximo)
                const claseEstado = mostrarDesactivados ? 'desactivado' :
                                   estado.clase === 'badge-warning' ? 'bajo-stock' : 
                                   estado.clase === 'badge-danger' ? 'sin-stock' : '';
                
                // Botón de acción según permisos
                const botonAccion2 = generarBotonesAccionProducto(producto._id, false, mostrarDesactivados);
                
                return `
                    <tr class="${claseEstado}">
                        <td><strong>${producto.codigo || 'N/A'}</strong></td>
                        <td><strong>${producto.nombre}</strong></td>
                        <td>${formatearNumero(producto.precio)}</td>
                        <td class="cantidad-col">${producto.cantidad}</td>
                        <td class="cantidad-col">${producto.cantidad_minima}</td>
                        <td class="cantidad-col">${producto.cantidad_maxima}</td>
                        <td>${producto.proveedor}</td>
                        <td>${sedeInfo}</td>
                        <td><span class="badge ${estado.clase}">${estado.texto}</span></td>
                        <td>
                            <div class="action-buttons">
                                ${botonAccion2}
                            </div>
                        </td>
                    </tr>
                `;
            }
        }
    }).join('');
}


// Helper: generar botones de acción según permisos
function generarBotonesAccionProducto(ids, esMultiple, esDesactivado) {
    if (esDesactivado) {
        if (!tienePermiso('desactivar_productos')) return '';
        if (esMultiple) {
            return `<button class="btn-icon btn-reactivar" onclick="seleccionarSedeParaReactivar('${ids}')" title="Reactivar" style="background: #d4edda; color: #155724;">
                        <i class="fas fa-check-circle"></i>
                    </button>`;
        }
        return `<button class="btn-icon btn-reactivar" onclick="reactivarProducto('${ids}')" title="Reactivar" style="background: #d4edda; color: #155724;">
                    <i class="fas fa-check-circle"></i>
                </button>`;
    }
    let btns = '';
    if (tienePermiso('editar_productos')) {
        if (esMultiple) {
            btns += `<button class="btn-icon btn-edit" onclick="seleccionarSedeParaEditar('${ids}')" title="Editar"><i class="fas fa-edit"></i></button>`;
        } else {
            btns += `<button class="btn-icon btn-edit" onclick="editarProducto('${ids}')" title="Editar"><i class="fas fa-edit"></i></button>`;
        }
    }
    if (tienePermiso('copiar_productos')) {
        if (esMultiple) {
            btns += `<button class="btn-icon btn-copy" onclick="seleccionarSedeParaCopiar('${ids}')" title="Copiar a otra sede"><i class="fas fa-copy"></i></button>`;
        } else {
            btns += `<button class="btn-icon btn-copy" onclick="abrirModalCopiar('${ids}')" title="Copiar a otra sede"><i class="fas fa-copy"></i></button>`;
        }
    }
    if (tienePermiso('desactivar_productos')) {
        if (esMultiple) {
            btns += `<button class="btn-icon btn-desactivar" onclick="seleccionarSedeParaDesactivar('${ids}')" title="Desactivar"><i class="fas fa-ban"></i></button>`;
        } else {
            btns += `<button class="btn-icon btn-desactivar" onclick="desactivarProducto('${ids}')" title="Desactivar"><i class="fas fa-ban"></i></button>`;
        }
    }
    return btns;
}

// Obtener estado del stock
function obtenerEstadoStock(producto) {
    if (producto.cantidad === 0) {
        return { texto: 'Sin Cantidad', clase: 'badge-danger' };
    } else if (producto.cantidad <= producto.cantidad_minima) {
        return { texto: 'Baja Cantidad', clase: 'badge-warning' };
    } else {
        return { texto: 'Disponible', clase: 'badge-success' };
    }
}

// Obtener estado del stock global (para productos agrupados de múltiples sedes)
function obtenerEstadoStockGlobal(cantidadTotal, minimoMasBajo) {
    if (cantidadTotal === 0) {
        return { texto: 'Sin Cantidad', clase: 'badge-danger' };
    } else if (cantidadTotal <= minimoMasBajo) {
        return { texto: 'Baja Cantidad', clase: 'badge-warning' };
    } else {
        return { texto: 'Disponible', clase: 'badge-success' };
    }
}

// Filtrar productos
function filtrarProductos() {
    renderizarProductos();
}

function filtrarPorEstado(estado) {
    filtroActual = estado;
    
    // Actualizar variable de desactivados según el filtro
    if (estado === 'desactivados') {
        mostrarDesactivados = true;
    } else {
        mostrarDesactivados = false;
    }
    
    // Actualizar botones activos
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Activar el botón correspondiente
    if (estado === 'todos') {
        document.getElementById('btnTodos').classList.add('active');
    } else if (estado === 'bajo-stock') {
        document.getElementById('btnBajoStock').classList.add('active');
    } else if (estado === 'desactivados') {
        document.getElementById('btnDesactivados').classList.add('active');
    }
    
    renderizarProductos();
}

// Abrir modal para nuevo producto
function abrirModalNuevoProducto() {
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-box"></i> Nuevo Producto';
    document.getElementById('formProducto').reset();
    document.getElementById('productoId').value = '';
    
    // Generar código consecutivo automático
    generarCodigoConsecutivo();
    
    document.getElementById('modalProducto').classList.add('active');
}

// Generar código consecutivo automático
async function generarCodigoConsecutivo() {
    try {
        const resultado = await pywebview.api.obtener_siguiente_codigo();
        if (resultado.success) {
            document.getElementById('codigo').value = resultado.codigo;
            // Hacer el campo de solo lectura para nuevos productos
            document.getElementById('codigo').readOnly = true;
        }
    } catch (error) {
        console.error('Error al generar código:', error);
    }
}

// Seleccionar sede para editar (cuando hay múltiples sedes)
function seleccionarSedeParaEditar(idsString) {
    const ids = idsString.split(',');
    const productosGrupo = productos.filter(p => ids.includes(p._id));
    
    if (productosGrupo.length === 1) {
        editarProducto(productosGrupo[0]._id);
        return;
    }
    
    const opcionesSedes = productosGrupo.map(p => 
        `<option value="${p._id}">${p.sede_nombre || 'Sin sede'} - ${p.sede_ciudad || ''}</option>`
    ).join('');
    
    const modalHTML = `
        <div class="modal-overlay-confirm" id="selectSedeModal" style="display: flex; z-index: 20000;">
            <div class="modal-content-confirm">
                <div class="modal-icon-confirm" style="background: #d1ecf1;">
                    <i class="fas fa-edit" style="color: #004085;"></i>
                </div>
                <h2 class="modal-title-confirm">Seleccionar Sede</h2>
                <p class="modal-message-confirm">¿De qué sede deseas editar el producto?</p>
                <select id="sedeSeleccionada" style="width: 100%; padding: 10px; margin: 15px 0; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px;">
                    ${opcionesSedes}
                </select>
                <div class="modal-buttons-confirm">
                    <button class="btn-cancel-confirm" onclick="cerrarModalSeleccion()">Cancelar</button>
                    <button class="btn-confirm" onclick="confirmarEdicion()">Editar</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function confirmarEdicion() {
    const productoId = document.getElementById('sedeSeleccionada').value;
    cerrarModalSeleccion();
    editarProducto(productoId);
}

// Seleccionar sede para copiar (cuando hay múltiples sedes)
function seleccionarSedeParaCopiar(idsString) {
    const ids = idsString.split(',');
    const productosGrupo = productos.filter(p => ids.includes(p._id));
    
    if (productosGrupo.length === 1) {
        abrirModalCopiar(productosGrupo[0]._id);
        return;
    }
    
    // Si hay múltiples productos (múltiples sedes), abrir modal de copia múltiple
    abrirModalCopiarMultiple(productosGrupo);
}

// Abrir modal para copiar desde múltiples sedes
function abrirModalCopiarMultiple(productosGrupo) {
    const primerProducto = productosGrupo[0];
    
    // Verificar si hay sedes disponibles para copiar
    const sedesConProducto = productosGrupo.map(p => p.sede_id);
    const sedesDisponibles = sedes.filter(sede => !sedesConProducto.includes(sede._id));
    
    if (sedesDisponibles.length === 0) {
        mostrarModalConfirmacion('Este producto ya existe en todas las sedes disponibles', null, true);
        return;
    }
    
    document.getElementById('codigoProductoCopiarMultiple').value = primerProducto.codigo || 'N/A';
    document.getElementById('nombreProductoCopiarMultiple').value = primerProducto.nombre;
    
    // Crear checkboxes para sedes origen
    const containerOrigen = document.getElementById('sedesOrigenContainer');
    containerOrigen.innerHTML = '';
    
    productosGrupo.forEach(producto => {
        const checkboxDiv = document.createElement('div');
        checkboxDiv.style.cssText = 'padding: 8px; margin: 5px 0; border-radius: 5px; transition: background 0.2s;';
        checkboxDiv.onmouseover = function() { this.style.background = '#f5f5f5'; };
        checkboxDiv.onmouseout = function() { this.style.background = 'transparent'; };
        
        checkboxDiv.innerHTML = `
            <label style="display: flex; align-items: center; cursor: pointer; user-select: none;">
                <input type="checkbox" name="sedeOrigen" value="${producto._id}" style="margin-right: 10px; width: 18px; height: 18px; cursor: pointer;">
                <span style="font-size: 14px; color: #333;">${producto.sede_nombre || 'Sin sede'} - ${producto.sede_ciudad || ''}</span>
            </label>
        `;
        containerOrigen.appendChild(checkboxDiv);
    });
    
    // Crear checkboxes para sedes destino
    const containerDestino = document.getElementById('sedesDestinoContainerMultiple');
    containerDestino.innerHTML = '';
    
    sedesDisponibles.forEach(sede => {
        const checkboxDiv = document.createElement('div');
        checkboxDiv.style.cssText = 'padding: 8px; margin: 5px 0; border-radius: 5px; transition: background 0.2s;';
        checkboxDiv.onmouseover = function() { this.style.background = '#f5f5f5'; };
        checkboxDiv.onmouseout = function() { this.style.background = 'transparent'; };
        
        checkboxDiv.innerHTML = `
            <label style="display: flex; align-items: center; cursor: pointer; user-select: none;">
                <input type="checkbox" name="sedeDestinoMultiple" value="${sede._id}" style="margin-right: 10px; width: 18px; height: 18px; cursor: pointer;">
                <span style="font-size: 14px; color: #333;">${sede.nombre} - ${sede.ciudad}</span>
            </label>
        `;
        containerDestino.appendChild(checkboxDiv);
    });
    
    document.getElementById('modalCopiarMultiple').classList.add('active');
}

// Copiar producto desde múltiples sedes
async function copiarProductoMultiple(event) {
    event.preventDefault();
    
    // Obtener sede origen seleccionada (solo una)
    const checkboxOrigen = document.querySelector('input[name="sedeOrigen"]:checked');
    
    if (!checkboxOrigen) {
        mostrarModalConfirmacion('Debes seleccionar una sede de origen', null, true);
        return;
    }
    
    const productoId = checkboxOrigen.value;
    
    // Obtener todas las sedes destino seleccionadas
    const checkboxesDestino = document.querySelectorAll('input[name="sedeDestinoMultiple"]:checked');
    const sedesSeleccionadas = Array.from(checkboxesDestino).map(cb => cb.value);
    
    if (sedesSeleccionadas.length === 0) {
        mostrarModalConfirmacion('Debes seleccionar al menos una sede destino', null, true);
        return;
    }
    
    try {
        const resultado = await pywebview.api.copiar_producto_multiples_sedes(productoId, sedesSeleccionadas);
        
        if (resultado.success) {
            mostrarModalConfirmacion(resultado.message, null, true);
            cerrarModalCopiarMultiple();
            cargarProductos();
        } else {
            mostrarModalConfirmacion(resultado.message, null, true);
        }
    } catch (error) {
        console.error('Error al copiar producto:', error);
        mostrarModalConfirmacion('Error al copiar el producto', null, true);
    }
}

function cerrarModalCopiarMultiple() {
    document.getElementById('modalCopiarMultiple').classList.remove('active');
}

// Seleccionar sede para eliminar (cuando hay múltiples sedes)
function seleccionarSedeParaEliminar(idsString) {
    const ids = idsString.split(',');
    const productosGrupo = productos.filter(p => ids.includes(p._id));
    
    if (productosGrupo.length === 1) {
        eliminarProducto(productosGrupo[0]._id);
        return;
    }
    
    // Si hay múltiples productos (múltiples sedes), abrir modal de eliminación múltiple
    abrirModalEliminarMultiple(productosGrupo);
}

// Abrir modal para eliminar de múltiples sedes
function abrirModalEliminarMultiple(productosGrupo) {
    const primerProducto = productosGrupo[0];
    
    const containerSedes = document.getElementById('sedesEliminarContainer');
    containerSedes.innerHTML = '';
    
    productosGrupo.forEach(producto => {
        const checkboxDiv = document.createElement('div');
        checkboxDiv.style.cssText = 'padding: 8px; margin: 5px 0; border-radius: 5px; transition: background 0.2s;';
        checkboxDiv.onmouseover = function() { this.style.background = '#ffebee'; };
        checkboxDiv.onmouseout = function() { this.style.background = 'transparent'; };
        
        checkboxDiv.innerHTML = `
            <label style="display: flex; align-items: center; cursor: pointer; user-select: none;">
                <input type="checkbox" name="sedeEliminar" value="${producto._id}" style="margin-right: 10px; width: 18px; height: 18px; cursor: pointer;">
                <span style="font-size: 14px; color: #333;">${producto.sede_nombre || 'Sin sede'} - ${producto.sede_ciudad || ''}</span>
            </label>
        `;
        containerSedes.appendChild(checkboxDiv);
    });
    
    document.getElementById('nombreProductoEliminar').textContent = primerProducto.nombre;
    document.getElementById('codigoProductoEliminar').textContent = primerProducto.codigo || 'N/A';
    
    document.getElementById('modalEliminarMultiple').classList.add('active');
}

// Eliminar producto de múltiples sedes
async function eliminarProductoMultiple() {
    const checkboxes = document.querySelectorAll('input[name="sedeEliminar"]:checked');
    const productosIds = Array.from(checkboxes).map(cb => cb.value);
    
    if (productosIds.length === 0) {
        mostrarModalConfirmacion('Debes seleccionar al menos una sede', null, true);
        return;
    }
    
    try {
        const resultado = await pywebview.api.eliminar_productos_multiples(productosIds);
        
        if (resultado.success) {
            mostrarModalConfirmacion(resultado.message, null, true);
            cerrarModalEliminarMultiple();
            cargarProductos();
        } else {
            mostrarModalConfirmacion(resultado.message, null, true);
        }
    } catch (error) {
        console.error('Error al eliminar productos:', error);
        mostrarModalConfirmacion('Error al eliminar los productos', null, true);
    }
}

function cerrarModalEliminarMultiple() {
    document.getElementById('modalEliminarMultiple').classList.remove('active');
}

function cerrarModalSeleccion() {
    const modal = document.getElementById('selectSedeModal');
    if (modal) {
        modal.remove();
    }
}

// Editar producto
async function editarProducto(id) {
    const producto = productos.find(p => p._id === id);
    
    if (producto) {
        document.getElementById('modalTitle').innerHTML = '<i class="fas fa-edit"></i> Editar Producto';
        document.getElementById('productoId').value = producto._id;
        document.getElementById('codigo').value = producto.codigo || '';
        document.getElementById('codigo').readOnly = false; // Permitir editar código en productos existentes
        document.getElementById('nombre').value = producto.nombre;
        document.getElementById('precio').value = formatearNumero(producto.precio);
        document.getElementById('cantidad').value = producto.cantidad;
        document.getElementById('cantidadMinima').value = producto.cantidad_minima;
        document.getElementById('cantidadMaxima').value = producto.cantidad_maxima;
        document.getElementById('proveedor').value = producto.proveedor;
        document.getElementById('sedeProducto').value = producto.sede_id || '';
        document.getElementById('modalProducto').classList.add('active');
    }
}

// Guardar producto
async function guardarProducto(event) {
    event.preventDefault();
    
    const productoId = document.getElementById('productoId').value;
    const sedeValue = document.getElementById('sedeProducto').value;
    
    const datos = {
        codigo: document.getElementById('codigo').value,
        nombre: document.getElementById('nombre').value,
        precio: obtenerValorPrecio(),
        cantidad: parseInt(document.getElementById('cantidad').value),
        cantidad_minima: parseInt(document.getElementById('cantidadMinima').value),
        cantidad_maxima: parseInt(document.getElementById('cantidadMaxima').value),
        proveedor: document.getElementById('proveedor').value,
        sede_id: sedeValue || ''
    };
    
    // Validar que cantidad mínima sea menor que máxima
    if (datos.cantidad_minima >= datos.cantidad_maxima) {
        mostrarModalConfirmacion('La cantidad mínima debe ser menor que la máxima', null, true);
        return;
    }
    
    try {
        let resultado;
        
        if (productoId) {
            // Actualizar producto existente
            resultado = await pywebview.api.actualizar_producto(productoId, datos);
        } else {
            // Crear nuevo producto
            resultado = await pywebview.api.crear_producto(datos);
        }
        
        if (resultado.success) {
            mostrarModalConfirmacion(resultado.message, null, true);
            cerrarModal();
            cargarProductos();
        } else {
            mostrarModalConfirmacion(resultado.message, null, true);
        }
    } catch (error) {
        console.error('Error al guardar producto:', error);
        mostrarModalConfirmacion('Error al guardar el producto: ' + error, null, true);
    }
}

// Abrir modal para copiar producto
function abrirModalCopiar(id) {
    const producto = productos.find(p => p._id === id);
    
    if (producto) {
        document.getElementById('productoIdCopiar').value = producto._id;
        document.getElementById('codigoProductoCopiar').value = producto.codigo || 'N/A';
        document.getElementById('nombreProductoCopiar').value = producto.nombre;
        
        // Crear checkboxes para cada sede (excluyendo la sede actual del producto)
        const container = document.getElementById('sedesDestinoContainer');
        container.innerHTML = '';
        
        sedes.forEach(sede => {
            // Verificar si el producto ya existe en esta sede
            const productoEnSede = productos.find(p => 
                p.codigo === producto.codigo && 
                p.sede_id === sede._id
            );
            
            if (!productoEnSede) {
                const checkboxDiv = document.createElement('div');
                checkboxDiv.style.cssText = 'padding: 8px; margin: 5px 0; border-radius: 5px; transition: background 0.2s;';
                checkboxDiv.onmouseover = function() { this.style.background = '#f5f5f5'; };
                checkboxDiv.onmouseout = function() { this.style.background = 'transparent'; };
                
                checkboxDiv.innerHTML = `
                    <label style="display: flex; align-items: center; cursor: pointer; user-select: none;">
                        <input type="checkbox" name="sedeDestino" value="${sede._id}" style="margin-right: 10px; width: 18px; height: 18px; cursor: pointer;">
                        <span style="font-size: 14px; color: #333;">${sede.nombre} - ${sede.ciudad}</span>
                    </label>
                `;
                container.appendChild(checkboxDiv);
            }
        });
        
        if (container.children.length === 0) {
            container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">Este producto ya existe en todas las sedes disponibles</p>';
        }
        
        document.getElementById('modalCopiarProducto').classList.add('active');
    }
}

// Copiar producto
async function copiarProducto(event) {
    event.preventDefault();
    
    const productoId = document.getElementById('productoIdCopiar').value;
    
    // Obtener todas las sedes seleccionadas
    const checkboxes = document.querySelectorAll('input[name="sedeDestino"]:checked');
    const sedesSeleccionadas = Array.from(checkboxes).map(cb => cb.value);
    
    if (sedesSeleccionadas.length === 0) {
        mostrarModalConfirmacion('Debes seleccionar al menos una sede destino', null, true);
        return;
    }
    
    try {
        const resultado = await pywebview.api.copiar_producto_multiples_sedes(productoId, sedesSeleccionadas);
        
        if (resultado.success) {
            mostrarModalConfirmacion(resultado.message, null, true);
            cerrarModalCopiar();
            cargarProductos();
        } else {
            mostrarModalConfirmacion(resultado.message, null, true);
        }
    } catch (error) {
        console.error('Error al copiar producto:', error);
        mostrarModalConfirmacion('Error al copiar el producto', null, true);
    }
}

// Eliminar producto
async function eliminarProducto(id) {
    const producto = productos.find(p => p._id === id);
    
    mostrarModalConfirmacion(
        `¿Estás seguro de que deseas eliminar el producto "${producto.nombre}"?`,
        async () => {
            try {
                const resultado = await pywebview.api.eliminar_producto(id);
                
                if (resultado.success) {
                    mostrarModalConfirmacion(resultado.message, null, true);
                    cargarProductos();
                } else {
                    mostrarModalConfirmacion(resultado.message, null, true);
                }
            } catch (error) {
                console.error('Error al eliminar producto:', error);
                mostrarModalConfirmacion('Error al eliminar el producto', null, true);
            }
        }
    );
}

// Cerrar modales
function cerrarModal() {
    document.getElementById('modalProducto').classList.remove('active');
}

function cerrarModalCopiar() {
    document.getElementById('modalCopiarProducto').classList.remove('active');
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

async function confirmarAccion() {
    if (window.accionConfirmada) {
        await window.accionConfirmada();
    }
    cerrarModalConfirmacion();
}

// Mostrar mensajes (compatibilidad)
function mostrarMensaje(mensaje, tipo) {
    mostrarModalConfirmacion(mensaje, null, true);
}

// Función legacy - ya no se usa, el filtro de desactivados ahora funciona como los demás
function toggleProductosDesactivados() {
    filtrarPorEstado('desactivados');
}

// Seleccionar sede para desactivar (cuando hay múltiples sedes)
function seleccionarSedeParaDesactivar(idsString) {
    const ids = idsString.split(',');
    const productosGrupo = productos.filter(p => ids.includes(p._id));
    
    if (productosGrupo.length === 1) {
        desactivarProducto(productosGrupo[0]._id);
        return;
    }
    
    // Si hay múltiples productos (múltiples sedes), abrir modal de desactivación múltiple
    abrirModalDesactivarMultiple(productosGrupo);
}

// Seleccionar sede para reactivar (cuando hay múltiples sedes)
function seleccionarSedeParaReactivar(idsString) {
    const ids = idsString.split(',');
    const productosGrupo = productos.filter(p => ids.includes(p._id));
    
    if (productosGrupo.length === 1) {
        reactivarProducto(productosGrupo[0]._id);
        return;
    }
    
    // Si hay múltiples productos (múltiples sedes), abrir modal de reactivación múltiple
    abrirModalReactivarMultiple(productosGrupo);
}

// Abrir modal para desactivar de múltiples sedes
function abrirModalDesactivarMultiple(productosGrupo) {
    const primerProducto = productosGrupo[0];
    
    const containerSedes = document.getElementById('sedesDesactivarContainer');
    containerSedes.innerHTML = '';
    
    productosGrupo.forEach(producto => {
        const checkboxDiv = document.createElement('div');
        checkboxDiv.style.cssText = 'padding: 8px; margin: 5px 0; border-radius: 5px; transition: background 0.2s;';
        checkboxDiv.onmouseover = function() { this.style.background = '#ffebee'; };
        checkboxDiv.onmouseout = function() { this.style.background = 'transparent'; };
        
        checkboxDiv.innerHTML = `
            <label style="display: flex; align-items: center; cursor: pointer; user-select: none;">
                <input type="checkbox" name="sedeDesactivar" value="${producto._id}" style="margin-right: 10px; width: 18px; height: 18px; cursor: pointer;">
                <span style="font-size: 14px; color: #333;">${producto.sede_nombre || 'Sin sede'} - ${producto.sede_ciudad || ''}</span>
            </label>
        `;
        containerSedes.appendChild(checkboxDiv);
    });
    
    document.getElementById('nombreProductoDesactivar').textContent = primerProducto.nombre;
    document.getElementById('codigoProductoDesactivar').textContent = primerProducto.codigo || 'N/A';
    
    document.getElementById('modalDesactivarMultiple').classList.add('active');
}

// Desactivar producto de múltiples sedes
async function desactivarProductoMultiple() {
    const checkboxes = document.querySelectorAll('input[name="sedeDesactivar"]:checked');
    const productosIds = Array.from(checkboxes).map(cb => cb.value);
    
    if (productosIds.length === 0) {
        mostrarModalConfirmacion('Debes seleccionar al menos una sede', null, true);
        return;
    }
    
    try {
        const resultado = await pywebview.api.desactivar_productos_multiples(productosIds);
        
        if (resultado.success) {
            mostrarModalConfirmacion(resultado.message, null, true);
            cerrarModalDesactivarMultiple();
            cargarProductos();
        } else {
            mostrarModalConfirmacion(resultado.message, null, true);
        }
    } catch (error) {
        console.error('Error al desactivar productos:', error);
        mostrarModalConfirmacion('Error al desactivar los productos', null, true);
    }
}

function cerrarModalDesactivarMultiple() {
    document.getElementById('modalDesactivarMultiple').classList.remove('active');
}

// Desactivar producto individual
async function desactivarProducto(id) {
    const producto = productos.find(p => p._id === id);
    
    mostrarModalConfirmacion(
        `¿Estás seguro de que deseas desactivar el producto "${producto.nombre}"?`,
        async () => {
            try {
                const resultado = await pywebview.api.desactivar_producto(id);
                
                if (resultado.success) {
                    mostrarModalConfirmacion(resultado.message, null, true);
                    cargarProductos();
                } else {
                    mostrarModalConfirmacion(resultado.message, null, true);
                }
            } catch (error) {
                console.error('Error al desactivar producto:', error);
                mostrarModalConfirmacion('Error al desactivar el producto', null, true);
            }
        }
    );
}

// Reactivar producto
async function reactivarProducto(id) {
    const producto = productos.find(p => p._id === id);
    
    mostrarModalConfirmacion(
        `¿Deseas reactivar el producto "${producto.nombre}"?`,
        async () => {
            try {
                const resultado = await pywebview.api.reactivar_producto(id);
                
                if (resultado.success) {
                    mostrarModalConfirmacion(resultado.message, null, true);
                    cargarProductos();
                } else {
                    mostrarModalConfirmacion(resultado.message, null, true);
                }
            } catch (error) {
                console.error('Error al reactivar producto:', error);
                mostrarModalConfirmacion('Error al reactivar el producto', null, true);
            }
        }
    );
}


// Abrir modal para reactivar de múltiples sedes
function abrirModalReactivarMultiple(productosGrupo) {
    const primerProducto = productosGrupo[0];
    
    // Crear modal dinámicamente
    const modalHTML = `
        <div class="modal-overlay" id="modalReactivarMultiple" style="display: flex;">
            <div class="modal-container">
                <div class="modal-header" style="background: #e8f5e9;">
                    <h2 style="color: #2e7d32;"><i class="fas fa-check-circle"></i> Reactivar Producto</h2>
                    <button class="modal-close" onclick="cerrarModalReactivarMultiple()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <div style="font-size: 16px; color: #666; margin-bottom: 10px;">
                            <strong>Código:</strong> <span style="font-weight: bold; color: #000;">${primerProducto.codigo || 'N/A'}</span>
                        </div>
                        <div style="font-size: 18px; font-weight: bold; color: #000;">
                            ${primerProducto.nombre}
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label style="color: #2e7d32;">Selecciona de qué sedes deseas reactivar este producto</label>
                        <div id="sedesReactivarContainer" style="max-height: 250px; overflow-y: auto; border: 2px solid #e8f5e9; border-radius: 10px; padding: 10px; background: #fff;">
                            ${productosGrupo.map(producto => `
                                <div style="padding: 8px; margin: 5px 0; border-radius: 5px; transition: background 0.2s;" onmouseover="this.style.background='#f1f8e9'" onmouseout="this.style.background='transparent'">
                                    <label style="display: flex; align-items: center; cursor: pointer; user-select: none;">
                                        <input type="checkbox" name="sedeReactivar" value="${producto._id}" style="margin-right: 10px; width: 18px; height: 18px; cursor: pointer;">
                                        <span style="font-size: 14px; color: #333;">${producto.sede_nombre || 'Sin sede'} - ${producto.sede_ciudad || ''}</span>
                                    </label>
                                </div>
                            `).join('')}
                        </div>
                        <small style="color: #666;">Los productos reactivados volverán a mostrarse en la lista principal</small>
                    </div>
                    
                    <div class="modal-footer">
                        <button type="button" class="btn-secondary" onclick="cerrarModalReactivarMultiple()">Cancelar</button>
                        <button type="button" class="btn-primary" onclick="reactivarProductoMultiple()" style="background: #2e7d32;">
                            <i class="fas fa-check-circle"></i> Reactivar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Reactivar producto de múltiples sedes
async function reactivarProductoMultiple() {
    const checkboxes = document.querySelectorAll('input[name="sedeReactivar"]:checked');
    const productosIds = Array.from(checkboxes).map(cb => cb.value);
    
    if (productosIds.length === 0) {
        mostrarModalConfirmacion('Debes seleccionar al menos una sede', null, true);
        return;
    }
    
    try {
        const resultado = await pywebview.api.reactivar_productos_multiples(productosIds);
        
        if (resultado.success) {
            mostrarModalConfirmacion(resultado.message, null, true);
            cerrarModalReactivarMultiple();
            cargarProductos();
        } else {
            mostrarModalConfirmacion(resultado.message, null, true);
        }
    } catch (error) {
        console.error('Error al reactivar productos:', error);
        mostrarModalConfirmacion('Error al reactivar los productos', null, true);
    }
}

function cerrarModalReactivarMultiple() {
    const modal = document.getElementById('modalReactivarMultiple');
    if (modal) {
        modal.remove();
    }
}


// Funciones para modales de impresión
function abrirModalImprimirReporte() {
    document.getElementById('modalImprimirReporte').classList.add('active');
}

function cerrarModalImprimirReporte() {
    document.getElementById('modalImprimirReporte').classList.remove('active');
}

function abrirModalImprimirTirilla() {
    document.getElementById('modalImprimirTirilla').classList.add('active');
}

function cerrarModalImprimirTirilla() {
    document.getElementById('modalImprimirTirilla').classList.remove('active');
}

// Imprimir reporte PDF
function imprimirReportePDF(tipo) {
    cerrarModalImprimirReporte();
    
    // Obtener sede seleccionada
    const sedeSeleccionada = document.getElementById('sedeFilter').value;
    
    if (!sedeSeleccionada) {
        mostrarModalConfirmacion('Por favor selecciona una sede específica para imprimir el reporte', null, true);
        return;
    }
    
    // Obtener información de la sede
    const sedeInfo = sedes.find(s => s._id === sedeSeleccionada);
    
    if (!sedeInfo) {
        mostrarModalConfirmacion('Error al obtener información de la sede', null, true);
        return;
    }
    
    // Filtrar productos según el tipo y la sede
    let productosFiltrados = productos.filter(p => p.activo !== false && p.sede_id === sedeSeleccionada);
    
    if (tipo === 'bajo-stock') {
        productosFiltrados = productosFiltrados.filter(p => p.cantidad <= p.cantidad_minima);
    }
    
    if (productosFiltrados.length === 0) {
        mostrarModalConfirmacion('No hay productos para imprimir en la sede seleccionada', null, true);
        return;
    }
    
    // Crear iframe oculto para impresión
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    
    const contenidoHTML = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Reporte de Productos - ${sedeInfo.nombre}</title>
            <style>
                @page {
                    size: letter;
                    margin: 1cm;
                }
                
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                    color: #333;
                }
                
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 3px solid #000;
                    padding-bottom: 15px;
                }
                
                .header h1 {
                    margin: 0;
                    font-size: 24px;
                    color: #000;
                }
                
                .header h2 {
                    margin: 5px 0;
                    font-size: 18px;
                    color: #666;
                    font-weight: normal;
                }
                
                .info {
                    margin-bottom: 20px;
                    font-size: 14px;
                }
                
                .info strong {
                    color: #000;
                }
                
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                    font-size: 12px;
                }
                
                thead {
                    background: #f5f5f5;
                }
                
                th, td {
                    padding: 10px;
                    text-align: left;
                    border: 1px solid #ddd;
                }
                
                th {
                    font-weight: bold;
                    color: #000;
                }
                
                tbody tr:nth-child(even) {
                    background: #f9f9f9;
                }
                
                .bajo-stock {
                    background: #fff3cd !important;
                }
                
                .sin-stock {
                    background: #f8d7da !important;
                }
                
                .footer {
                    margin-top: 30px;
                    text-align: center;
                    font-size: 11px;
                    color: #666;
                    border-top: 1px solid #ddd;
                    padding-top: 10px;
                }
                
                .resumen {
                    margin-top: 20px;
                    padding: 15px;
                    background: #f5f5f5;
                    border-radius: 5px;
                }
                
                @media print {
                    body {
                        padding: 0;
                    }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>REPORTE DE PRODUCTOS</h1>
                <h2>${sedeInfo.nombre} - ${sedeInfo.ciudad}</h2>
            </div>
            
            <div class="info">
                <strong>Tipo de reporte:</strong> ${tipo === 'todos' ? 'Todos los productos' : 'Productos con baja cantidad'}<br>
                <strong>Fecha:</strong> ${(typeof fechaColombia === 'function' ? fechaColombia() : new Date()).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}<br>
                <strong>Total de productos:</strong> ${productosFiltrados.length}
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Código</th>
                        <th>Nombre</th>
                        <th>Precio</th>
                        <th>Cantidad</th>
                        <th>Mínimo</th>
                        <th>Máximo</th>
                        <th>Proveedor</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
                    ${productosFiltrados.map(p => {
                        const estado = obtenerEstadoStock(p);
                        const claseEstado = estado.clase === 'badge-warning' ? 'bajo-stock' : 
                                           estado.clase === 'badge-danger' ? 'sin-stock' : '';
                        return '<tr class="' + claseEstado + '">' +
                            '<td>' + (p.codigo || 'N/A') + '</td>' +
                            '<td><strong>' + p.nombre + '</strong></td>' +
                            '<td>' + formatearNumero(p.precio) + '</td>' +
                            '<td>' + p.cantidad + '</td>' +
                            '<td>' + p.cantidad_minima + '</td>' +
                            '<td>' + p.cantidad_maxima + '</td>' +
                            '<td>' + p.proveedor + '</td>' +
                            '<td>' + estado.texto + '</td>' +
                            '</tr>';
                    }).join('')}
                </tbody>
            </table>
            
            <div class="resumen">
                <strong>Resumen Estado Productos:</strong>
                
                <table style="margin-top: 15px; font-size: 11px;">
                    <tr>
                        ${tipo === 'todos' ? 
                        '<td style="background: #d4edda; padding: 8px; vertical-align: top; width: 33%;">' +
                            '<strong>Productos con cantidad disponible: ' + productosFiltrados.filter(p => p.cantidad > p.cantidad_minima).length + '</strong><br>' +
                            (productosFiltrados.filter(p => p.cantidad > p.cantidad_minima).length > 0 ? 
                                productosFiltrados.filter(p => p.cantidad > p.cantidad_minima).map(p => p.codigo || 'N/A').join(', ') : 
                                'Ninguno') +
                        '</td>' : ''}
                        <td style="background: #fff3cd; padding: 8px; vertical-align: top; width: ${tipo === 'todos' ? '33%' : '50%'};">
                            <strong>Productos con baja cantidad: ${productosFiltrados.filter(p => p.cantidad <= p.cantidad_minima && p.cantidad > 0).length}</strong><br>
                            ${productosFiltrados.filter(p => p.cantidad <= p.cantidad_minima && p.cantidad > 0).length > 0 ? 
                                productosFiltrados.filter(p => p.cantidad <= p.cantidad_minima && p.cantidad > 0).map(p => p.codigo || 'N/A').join(', ') : 
                                'Ninguno'}
                        </td>
                        <td style="background: #f8d7da; padding: 8px; vertical-align: top; width: ${tipo === 'todos' ? '33%' : '50%'};">
                            <strong>Productos sin cantidad: ${productosFiltrados.filter(p => p.cantidad === 0).length}</strong><br>
                            ${productosFiltrados.filter(p => p.cantidad === 0).length > 0 ? 
                                productosFiltrados.filter(p => p.cantidad === 0).map(p => p.codigo || 'N/A').join(', ') : 
                                'Ninguno'}
                        </td>
                    </tr>
                </table>
            </div>
            
            <div class="footer">
                Sistema de Gestión de Moteles - ${sedeInfo.nombre}<br>
                Generado el ${(typeof fechaColombia === 'function' ? fechaColombia() : new Date()).toLocaleString('es-ES')}
            </div>
        </body>
        </html>
    `;
    
    iframe.contentDocument.open();
    iframe.contentDocument.write(contenidoHTML);
    iframe.contentDocument.close();
    
    // Esperar a que cargue y luego imprimir
    setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        
        // Eliminar iframe después de imprimir
        setTimeout(() => {
            document.body.removeChild(iframe);
        }, 1000);
    }, 500);
}

// Imprimir tirilla POS
function imprimirTirilla(tipo) {
    cerrarModalImprimirTirilla();
    
    // Obtener sede seleccionada
    const sedeSeleccionada = document.getElementById('sedeFilter').value;
    
    if (!sedeSeleccionada) {
        mostrarModalConfirmacion('Por favor selecciona una sede específica para imprimir la tirilla', null, true);
        return;
    }
    
    // Obtener información de la sede
    const sedeInfo = sedes.find(s => s._id === sedeSeleccionada);
    
    if (!sedeInfo) {
        mostrarModalConfirmacion('Error al obtener información de la sede', null, true);
        return;
    }
    
    // Filtrar productos según el tipo y la sede
    let productosFiltrados = productos.filter(p => p.activo !== false && p.sede_id === sedeSeleccionada);
    
    if (tipo === 'bajo-stock') {
        productosFiltrados = productosFiltrados.filter(p => p.cantidad <= p.cantidad_minima);
    }
    
    if (productosFiltrados.length === 0) {
        mostrarModalConfirmacion('No hay productos para imprimir en la sede seleccionada', null, true);
        return;
    }
    
    // Crear iframe oculto para impresión
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    
    const contenidoHTML = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Tirilla - ${sedeInfo.nombre}</title>
            <style>
                @page {
                    size: 80mm auto;
                    margin: 0;
                }
                
                body {
                    font-family: 'Courier New', monospace;
                    margin: 0;
                    padding: 12px;
                    width: 80mm;
                    font-size: 11px;
                    color: #000;
                    background: #fff;
                }
                
                .header {
                    text-align: center;
                    margin-bottom: 12px;
                    border-bottom: 2px solid #000;
                    padding-bottom: 10px;
                }
                
                .header h1 {
                    margin: 0 0 5px 0;
                    font-size: 18px;
                    font-weight: bold;
                    letter-spacing: 1px;
                }
                
                .header h2 {
                    margin: 2px 0;
                    font-size: 13px;
                    font-weight: bold;
                }
                
                .header .subtitulo {
                    margin: 5px 0 0 0;
                    font-size: 11px;
                    font-weight: normal;
                    font-style: italic;
                }
                
                .info-box {
                    background: #f5f5f5;
                    padding: 8px;
                    margin-bottom: 12px;
                    border: 1px solid #000;
                    font-size: 10px;
                }
                
                .info-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 3px;
                }
                
                .info-label {
                    font-weight: bold;
                }
                
                .separador {
                    border-top: 1px dashed #000;
                    margin: 10px 0;
                }
                
                .producto {
                    margin-bottom: 10px;
                    padding: 8px;
                    background: #fff;
                    border: 2px solid #000;
                }
                
                .producto-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 5px;
                    padding-bottom: 5px;
                    border-bottom: 1px solid #eee;
                }
                
                .producto-codigo {
                    font-weight: bold;
                    font-size: 13px;
                    background: #000;
                    color: #fff;
                    padding: 2px 6px;
                }
                
                .producto-nombre {
                    font-weight: bold;
                    font-size: 12px;
                    margin-bottom: 5px;
                }
                
                .producto-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 3px;
                    font-size: 10px;
                    margin-top: 5px;
                }
                
                .producto-item {
                    display: flex;
                    justify-content: space-between;
                }
                
                .producto-label {
                    font-weight: bold;
                }
                
                .producto-proveedor {
                    margin-top: 5px;
                    padding-top: 5px;
                    border-top: 1px dotted #ccc;
                    font-size: 10px;
                }
                
                .badge-alerta {
                    background: #000;
                    color: #fff;
                    padding: 3px 8px;
                    font-weight: bold;
                    font-size: 10px;
                    display: inline-block;
                    margin-top: 5px;
                    text-align: center;
                    width: 100%;
                }
                
                .badge-sin-stock {
                    background: #000;
                }
                
                .badge-bajo-stock {
                    background: #666;
                }
                
                .resumen-box {
                    margin-top: 12px;
                    padding: 10px;
                    background: #f5f5f5;
                    border: 1px solid #000;
                }
                
                .resumen-title {
                    text-align: center;
                    font-weight: bold;
                    font-size: 12px;
                    margin-bottom: 8px;
                    text-decoration: underline;
                }
                
                .resumen-item {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 5px;
                    font-size: 11px;
                }
                
                .resumen-label {
                    font-weight: bold;
                }
                
                .resumen-valor {
                    background: #fff;
                    padding: 2px 8px;
                    border: 1px solid #000;
                    min-width: 30px;
                    text-align: center;
                    font-weight: bold;
                }
                
                .footer {
                    margin-top: 15px;
                    text-align: center;
                    font-size: 9px;
                    border-top: 2px solid #000;
                    padding-top: 10px;
                }
                
                .footer-line {
                    margin: 3px 0;
                }
                
                @media print {
                    body {
                        padding: 8px;
                    }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>═══ REPORTE PRODUCTOS ═══</h1>
                <h2>${sedeInfo.nombre}</h2>
                <div class="subtitulo">${sedeInfo.ciudad}</div>
            </div>
            
            <div class="info-box">
                <div class="info-row">
                    <span class="info-label">Tipo:</span>
                    <span style="font-weight: bold;">${tipo === 'todos' ? 'TODOS LOS PRODUCTOS' : 'PRODUCTOS BAJA CANT'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Fecha:</span>
                    <span>${(typeof fechaColombia === 'function' ? fechaColombia() : new Date()).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Hora:</span>
                    <span>${(typeof fechaColombia === 'function' ? fechaColombia() : new Date()).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Total:</span>
                    <span>${productosFiltrados.length} productos</span>
                </div>
            </div>
            
            <div class="separador"></div>
            
            ${productosFiltrados.map(p => {
                const estado = obtenerEstadoStock(p);
                const estadoTexto = p.cantidad === 0 ? 'SIN CANT' : 
                    p.cantidad <= p.cantidad_minima ? 'BAJA CANT' : '';
                
                return '<div class="producto">' +
                    '<div class="producto-nombre">' + (p.codigo || 'N/A') + ' - ' + p.nombre + (estadoTexto ? ' - <strong>' + estadoTexto + '</strong>' : '') + '</div>' +
                    '<div style="font-size:9px;margin-top:4px;white-space:nowrap;overflow:hidden;">' +
                        '<span><b>Precio:</b> ' + formatearNumero(p.precio) + '&nbsp;&nbsp;</span>' +
                        '<span><b>Cant:</b> ' + p.cantidad + '&nbsp;&nbsp;</span>' +
                        '<span><b>Mín:</b> ' + p.cantidad_minima + '&nbsp;&nbsp;</span>' +
                        '<span><b>Prov:</b> ' + p.proveedor + '</span>' +
                    '</div>' +
                '</div>';
            }).join('')}
            
            <div class="separador"></div>
            
            <div class="resumen-box">
                <div class="resumen-title">═══ RESUMEN ESTADO PRODUCTOS ═══</div>
                ${tipo === 'todos' ? 
                    '<div class="resumen-item">' +
                        '<span class="resumen-label">Cantidad disponible:</span>' +
                        '<span class="resumen-valor">' + productosFiltrados.filter(p => p.cantidad > p.cantidad_minima).length + '</span>' +
                    '</div>' : ''}
                <div class="resumen-item">
                    <span class="resumen-label">Baja cantidad:</span>
                    <span class="resumen-valor">${productosFiltrados.filter(p => p.cantidad <= p.cantidad_minima && p.cantidad > 0).length}</span>
                </div>
                <div class="resumen-item">
                    <span class="resumen-label">Sin cantidad:</span>
                    <span class="resumen-valor">${productosFiltrados.filter(p => p.cantidad === 0).length}</span>
                </div>
            </div>
            
            <div class="footer">
                <div class="footer-line">Sistema de Gestión de Moteles</div>
                <div class="footer-line">${sedeInfo.nombre}</div>
                <div class="footer-line">${(typeof fechaColombia === 'function' ? fechaColombia() : new Date()).toLocaleDateString('es-ES')} - ${(typeof fechaColombia === 'function' ? fechaColombia() : new Date()).toLocaleTimeString('es-ES')}</div>
            </div>
        </body>
        </html>
    `;
    
    iframe.contentDocument.open();
    iframe.contentDocument.write(contenidoHTML);
    iframe.contentDocument.close();
    
    // Esperar a que cargue y luego imprimir
    setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        
        // Eliminar iframe después de imprimir
        setTimeout(() => {
            document.body.removeChild(iframe);
        }, 1000);
    }, 500);
}
