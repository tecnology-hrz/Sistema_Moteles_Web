/**
 * Consumos de productos en habitaciones ocupadas (compartido: habitaciones + facturación).
 */

function totalConsumosHabitacion(habitacion) {
    if (!habitacion || !habitacion.consumos_ocupacion || !habitacion.consumos_ocupacion.length) {
        return 0;
    }
    return habitacion.consumos_ocupacion.reduce((suma, c) => suma + (Number(c.subtotal) || 0), 0);
}

function formatearPrecioConsumo(valor) {
    const n = Math.round(Number(valor) || 0);
    return '$' + n.toLocaleString('es-CO');
}

function escaparHtml(texto) {
    if (texto == null || texto === '') return '';
    const div = document.createElement('div');
    div.textContent = String(texto);
    return div.innerHTML;
}

function filtrarProductosDisponibles(productos, sedeIdHabitacion) {
    if (!productos || !productos.length) return [];
    return productos.filter((p) => {
        if (p.activo === false) return false;
        const inv = Number(p.cantidad);
        if (!Number.isFinite(inv) || inv <= 0) return false;
        if (!p.sede_id) return true;
        return String(p.sede_id) === String(sedeIdHabitacion);
    });
}

function totalPendientes(pendientes) {
    return pendientes.reduce((s, l) => s + Math.round(Number(l.precio) || 0) * (Number(l.cantidad) || 0), 0);
}

function cerrarModalSelectorProductosConsumo() {
    const el = document.getElementById('modalSelectorProductosConsumo');
    if (el) el.remove();
}

async function abrirModalAgregarConsumos(opciones) {
    const { habitacionId, obtenerHabitacion, recargar } = opciones;
    let habitacion = obtenerHabitacion(habitacionId);
    if (!habitacion) return;

    const overlayAnterior = document.getElementById('modalConsumosOcupacion');
    if (overlayAnterior) overlayAnterior.remove();

    let pendientes = [];
    let listaProductos = [];
    // Cambios locales en guardados: { producto_id: cantidadNueva }
    // null = sin cambio, 0 = quitar todo
    let cambiosGuardados = {};

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay consumos-modal-overlay active';
    overlay.id = 'modalConsumosOcupacion';
    overlay.innerHTML = `
        <div class="modal-container consumos-modal-container--amplio consumos-modal-layout">
            <div class="modal-header consumos-modal-header consumos-modal-header--compacto">
                <div>
                    <h2 class="consumos-modal-titulo-principal"><i class="fas fa-box-open"></i> Productos</h2>
                    <p class="consumos-modal-subtitulo"><span id="consumosModalTituloHab"></span></p>
                </div>
                <button type="button" class="modal-close consumos-modal-close" id="consumosModalCerrar" aria-label="Cerrar">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="consumos-modal-layout-cuerpo">
                <div class="modal-body consumos-modal-body consumos-modal-scroll">
                    <section class="consumos-modal-seccion consumos-modal-seccion--agregar">
                        <h3 class="consumos-modal-seccion-titulo"><i class="fas fa-plus-circle"></i> Agregar productos</h3>
                        <div class="consumos-modal-botones-agregar">
                            <button type="button" class="consumos-modal-btn-agregar" id="consumosModalAbrirSelector">
                                <i class="fas fa-plus"></i> Agregar producto
                            </button>
                            <button type="button" class="consumos-modal-btn-agregar consumos-modal-btn-unico" id="consumosModalAbrirUnico">
                                <i class="fas fa-truck"></i> Producto externo
                            </button>
                        </div>
                    </section>

                    <section class="consumos-modal-seccion" id="consumosModalSeccionLista">
                        <h3 class="consumos-modal-seccion-titulo"><i class="fas fa-shopping-basket"></i> Productos en la habitación</h3>
                        <p class="consumos-modal-ayuda" id="consumosModalAyudaVacia">Tocá «+ Agregar producto» para abrir la lista.</p>
                        <div id="consumosModalListaUnificada" class="consumos-pendientes-scroll"></div>
                        <div class="consumos-modal-total-fila consumos-modal-total-fila--destacado">
                            <span>Total consumos</span>
                            <strong id="consumosModalTotal">$0</strong>
                        </div>
                    </section>
                </div>
                <footer class="consumos-modal-pie-fijo">
                    <div class="consumos-modal-pie-dos-columnas">
                        <div id="consumosModalPieGuardar" class="consumos-modal-pie-col" style="display:none">
                            <button type="button" class="consumos-modal-btn-guardar-cambios" id="consumosModalGuardarCambios">
                                <i class="fas fa-save"></i> Guardar cambios
                            </button>
                            <div class="consumos-modal-pie-total-bajo">
                                Total restado: <strong id="consumosModalTotalRestado">$0</strong>
                            </div>
                        </div>
                        <div id="consumosModalPieAgregar" class="consumos-modal-pie-col" style="display:none">
                            <button type="button" class="consumos-modal-btn-confirmar" id="consumosModalConfirmarLote" disabled>
                                <i class="fas fa-check"></i> Agregar a la habitación
                            </button>
                            <div class="consumos-modal-pie-total-bajo">
                                Total a agregar: <strong id="consumosModalTotalLote">$0</strong>
                            </div>
                        </div>
                    </div>
                    <p class="consumos-modal-error" id="consumosModalError"></p>
                </footer>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const elTitulo = document.getElementById('consumosModalTituloHab');
    const elListaUnificada = document.getElementById('consumosModalListaUnificada');
    const elTotal = document.getElementById('consumosModalTotal');
    const elTotalLote = document.getElementById('consumosModalTotalLote');
    const elTotalRestado = document.getElementById('consumosModalTotalRestado');
    const elBtnConfirmar = document.getElementById('consumosModalConfirmarLote');
    const elBtnGuardar = document.getElementById('consumosModalGuardarCambios');
    const elPieGuardar = document.getElementById('consumosModalPieGuardar');
    const elPieAgregar = document.getElementById('consumosModalPieAgregar');
    const elError = document.getElementById('consumosModalError');
    const elAyudaVacia = document.getElementById('consumosModalAyudaVacia');
    const elSeccionLista = document.getElementById('consumosModalSeccionLista');

    function cantidadDisponibleEnCatalogo(productoId) {
        const p = listaProductos.find((x) => x._id === productoId);
        return p ? Math.max(0, Number(p.cantidad) || 0) : 0;
    }

    function cantidadPendienteDe(productoId, excluirIndice = -1) {
        return pendientes.reduce((s, l, i) => {
            if (i === excluirIndice) return s;
            if (l.producto_id === productoId) return s + (Number(l.cantidad) || 0);
            return s;
        }, 0);
    }

    function cupoRestante(productoId, indiceLinea = -1) {
        const max = cantidadDisponibleEnCatalogo(productoId);
        const usado = cantidadPendienteDe(productoId, indiceLinea);
        return Math.max(0, max - usado);
    }

    function cupoParaSelector(productoId) {
        return cupoRestante(productoId, -1);
    }

    function hayCambiosGuardados() {
        return Object.keys(cambiosGuardados).length > 0;
    }

    function cantidadVisibleGuardado(c) {
        const pid = c.producto_id;
        if (pid in cambiosGuardados) return cambiosGuardados[pid];
        return Number(c.cantidad) || 0;
    }

    function pintarListaUnificada() {
        habitacion = obtenerHabitacion(habitacionId);
        if (!habitacion) { cerrarModalConsumosOcupacion(); return; }
        elTitulo.textContent = habitacion.nombre || habitacion.numero || 'Habitación';

        const consumos = habitacion.consumos_ocupacion || [];

        // Limpiar pendientes inválidos
        pendientes = pendientes.filter((l) => (Number(l.cantidad) || 0) > 0);
        for (let idx = 0; idx < pendientes.length; idx++) {
            const l = pendientes[idx];
            if (l.es_externo) continue; // externos no tienen cupo de catálogo
            const mx = cupoRestante(l.producto_id, idx);
            if (mx < 1) { pendientes.splice(idx, 1); idx -= 1; continue; }
            l.cantidad = Math.min(Math.max(1, Number(l.cantidad) || 1), mx);
        }

        const consumosVisibles = consumos.filter(c => cantidadVisibleGuardado(c) > 0);
        const hayAlgo = consumosVisibles.length > 0 || pendientes.length > 0;
        elAyudaVacia.style.display = hayAlgo ? 'none' : '';
        elSeccionLista.classList.toggle('consumos-modal-seccion--con-items', hayAlgo);

        let html = '';

        // ── Productos guardados con +/- local ──
        if (consumosVisibles.length) {
            html += '<ul class="consumos-pendientes-lista">';
            consumosVisibles.forEach((c) => {
                const cantOriginal = Number(c.cantidad) || 0;
                const cantVisible = cantidadVisibleGuardado(c);
                const pu = Number(c.precio_unitario) || 0;
                const sub = Math.round(cantVisible * pu);
                const modificado = (c.producto_id in cambiosGuardados);
                const esUnico = c.es_producto_unico === true;
                const etiquetaUnico = esUnico ? ' <span class="consumos-badge-unico">externo</span>' : '';
                html += `
                    <li class="consumos-pendiente-fila consumos-guardado-fila${modificado ? ' consumos-guardado-modificado' : ''}${esUnico ? ' consumos-guardado-unico' : ''}" data-pid="${c.producto_id}">
                        <div class="consumos-pendiente-datos">
                            <span class="consumos-pendiente-nombre">${escaparHtml(c.nombre || 'Producto')}${etiquetaUnico}</span>
                            <span class="consumos-pendiente-pu">${formatearPrecioConsumo(pu)} c/u${modificado ? ' · modificado' : ''}</span>
                        </div>
                        <div class="consumo-contador-cantidad consumo-contador-cantidad--compacto">
                            <button type="button" class="consumo-btn-menos consumo-guardado-menos" data-pid="${c.producto_id}" aria-label="Quitar 1"${cantVisible <= 0 ? ' disabled' : ''}>−</button>
                            <span class="consumo-input-cantidad consumo-guardado-cant">${cantVisible}</span>
                            <button type="button" class="consumo-btn-mas consumo-guardado-mas" data-pid="${c.producto_id}" aria-label="Agregar 1"${esUnico ? ' disabled' : ''}>+</button>
                        </div>
                        <span class="consumos-pendiente-sub">${formatearPrecioConsumo(sub)}</span>
                        ${esUnico ? `<button type="button" class="consumos-externo-editar" data-pid="${c.producto_id}" title="Editar"><i class="fas fa-pen"></i></button>` : ''}
                    </li>`;
            });
            html += '</ul>';
        }

        // ── Pendientes (nuevos por agregar) ──
        if (pendientes.length) {
            html += '<div class="consumos-separador-pendientes"><span>Nuevos por agregar</span></div>';
            html += '<ul class="consumos-pendientes-lista">';
            pendientes.forEach((l, idx) => {
                const esExt = l.es_externo === true;
                const maxLin = esExt ? 99 : cupoRestante(l.producto_id, idx);
                const sub = Math.round(l.precio) * (Number(l.cantidad) || 0);
                const enTope = (Number(l.cantidad) || 0) >= maxLin;
                const badgeExt = esExt ? ' <span class="consumos-badge-unico">externo</span>' : '';
                const infoMax = esExt ? '' : ` · máx.: ${maxLin}`;
                html += `
                    <li class="consumos-pendiente-fila${esExt ? ' consumos-guardado-unico' : ''}" data-idx="${idx}">
                        <div class="consumos-pendiente-datos">
                            <span class="consumos-pendiente-nombre">${escaparHtml(l.nombre)}${badgeExt}</span>
                            <span class="consumos-pendiente-pu">${formatearPrecioConsumo(l.precio)} c/u${infoMax}</span>
                        </div>
                        <div class="consumo-contador-cantidad consumo-contador-cantidad--compacto">
                            <button type="button" class="consumo-btn-menos consumo-pend-menos" data-idx="${idx}" aria-label="Menos">−</button>
                            <input type="number" class="consumo-input-cantidad consumo-pend-input" data-idx="${idx}" min="1" max="${maxLin}" value="${l.cantidad}" inputmode="numeric">
                            <button type="button" class="consumo-btn-mas consumo-pend-mas" data-idx="${idx}" aria-label="Más" ${enTope ? 'disabled' : ''}>+</button>
                        </div>
                        <span class="consumos-pendiente-sub">${formatearPrecioConsumo(sub)}</span>
                        <button type="button" class="consumos-pendiente-quitar" data-quitar="${idx}" title="Quitar"><i class="fas fa-times"></i></button>
                    </li>`;
            });
            html += '</ul>';
        }

        elListaUnificada.innerHTML = html;

        // Totales
        let totalGuardadoVisible = 0;
        let totalRestado = 0;
        consumos.forEach(c => {
            const cv = cantidadVisibleGuardado(c);
            const cantOrig = Number(c.cantidad) || 0;
            const pu = Number(c.precio_unitario) || 0;
            totalGuardadoVisible += Math.round(cv * pu);
            if (c.producto_id in cambiosGuardados) {
                const diff = cantOrig - cv;
                if (diff > 0) totalRestado += Math.round(diff * pu);
            }
        });
        elTotal.textContent = formatearPrecioConsumo(totalGuardadoVisible);
        elTotalLote.textContent = formatearPrecioConsumo(totalPendientes(pendientes));
        elTotalRestado.textContent = formatearPrecioConsumo(totalRestado);
        elBtnConfirmar.disabled = pendientes.length === 0;

        // Mostrar/ocultar botones de pie
        const tieneModificaciones = hayCambiosGuardados();
        elPieGuardar.style.display = tieneModificaciones ? '' : 'none';
        elPieAgregar.style.display = pendientes.length > 0 ? '' : 'none';

        // ── Event listeners: guardados ──
        elListaUnificada.querySelectorAll('.consumo-guardado-menos').forEach((btn) => {
            btn.addEventListener('click', () => {
                const pid = btn.dataset.pid;
                const c = consumos.find(x => x.producto_id === pid);
                if (!c) return;
                const cantOrig = Number(c.cantidad) || 0;
                const cantActual = cantidadVisibleGuardado(c);
                const nueva = cantActual - 1;
                if (nueva <= 0) {
                    cambiosGuardados[pid] = 0;
                } else if (nueva === cantOrig) {
                    delete cambiosGuardados[pid];
                } else {
                    cambiosGuardados[pid] = nueva;
                }
                pintarListaUnificada();
            });
        });
        elListaUnificada.querySelectorAll('.consumo-guardado-mas').forEach((btn) => {
            btn.addEventListener('click', () => {
                const pid = btn.dataset.pid;
                const c = consumos.find(x => x.producto_id === pid);
                if (!c) return;
                const cantOrig = Number(c.cantidad) || 0;
                const cantActual = cantidadVisibleGuardado(c);
                const nueva = cantActual + 1;
                if (nueva === cantOrig) {
                    delete cambiosGuardados[pid];
                } else {
                    cambiosGuardados[pid] = nueva;
                }
                pintarListaUnificada();
            });
        });

        // ── Event listeners: editar producto externo ──
        elListaUnificada.querySelectorAll('.consumos-externo-editar').forEach((btn) => {
            btn.addEventListener('click', () => {
                const pid = btn.dataset.pid;
                const c = consumos.find(x => x.producto_id === pid);
                if (!c) return;
                abrirModalEditarExterno(c);
            });
        });

        // ── Event listeners: pendientes ──
        elListaUnificada.querySelectorAll('.consumo-pend-menos').forEach((btn) => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx, 10);
                if (pendientes[idx]) {
                    pendientes[idx].cantidad -= 1;
                    if (pendientes[idx].cantidad < 1) pendientes.splice(idx, 1);
                    pintarListaUnificada();
                }
            });
        });
        elListaUnificada.querySelectorAll('.consumo-pend-mas').forEach((btn) => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx, 10);
                const l = pendientes[idx];
                if (!l) return;
                const maxLin = l.es_externo ? 99 : cupoRestante(l.producto_id, idx);
                if (l.cantidad < maxLin) l.cantidad += 1;
                pintarListaUnificada();
            });
        });
        function ajustarCantidadDesdeInput(inp) {
            const idx = parseInt(inp.dataset.idx, 10);
            const l = pendientes[idx];
            if (!l) return;
            const maxLin = l.es_externo ? 99 : cupoRestante(l.producto_id, idx);
            let v = parseInt(String(inp.value).replace(/\D/g, ''), 10);
            if (!Number.isFinite(v) || v < 1) v = 1;
            v = Math.min(maxLin, v);
            l.cantidad = v;
            pintarListaUnificada();
        }
        elListaUnificada.querySelectorAll('.consumo-pend-input').forEach((inp) => {
            inp.addEventListener('input', () => {
                const idx = parseInt(inp.dataset.idx, 10);
                const l = pendientes[idx];
                if (!l) return;
                const maxLin = l.es_externo ? 99 : cupoRestante(l.producto_id, idx);
                const soloDigitos = String(inp.value).replace(/\D/g, '');
                if (soloDigitos === '') return;
                let v = parseInt(soloDigitos, 10);
                if (!Number.isFinite(v)) return;
                v = Math.min(Math.max(1, v), maxLin);
                l.cantidad = v;
                if (inp.value !== String(v)) inp.value = String(v);
                elTotalLote.textContent = formatearPrecioConsumo(totalPendientes(pendientes));
                const fila = inp.closest('.consumos-pendiente-fila');
                const subEl = fila && fila.querySelector('.consumos-pendiente-sub');
                if (subEl) subEl.textContent = formatearPrecioConsumo(Math.round(l.precio) * v);
                const btnMas = fila && fila.querySelector('.consumo-pend-mas');
                if (btnMas) btnMas.disabled = v >= maxLin;
            });
            inp.addEventListener('change', () => ajustarCantidadDesdeInput(inp));
            inp.addEventListener('blur', () => ajustarCantidadDesdeInput(inp));
        });
        elListaUnificada.querySelectorAll('[data-quitar]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.quitar, 10);
                pendientes.splice(idx, 1);
                pintarListaUnificada();
            });
        });
    }

    // ── Guardar cambios (restar productos) ──
    elBtnGuardar.addEventListener('click', async () => {
        elError.textContent = '';
        const consumos = habitacion.consumos_ocupacion || [];
        elBtnGuardar.disabled = true;
        try {
            for (const [pid, cantNueva] of Object.entries(cambiosGuardados)) {
                const c = consumos.find(x => x.producto_id === pid);
                if (!c) continue;
                const cantOrig = Number(c.cantidad) || 0;
                const diff = cantOrig - cantNueva;
                if (diff > 0) {
                    const res = await pywebview.api.quitar_consumo_habitacion(habitacionId, pid, diff);
                    if (!res || !res.success) {
                        elError.textContent = (res && res.message) || 'Error al quitar producto.';
                        elBtnGuardar.disabled = false;
                        return;
                    }
                } else if (diff < 0) {
                    const res = await pywebview.api.agregar_consumo_habitacion(habitacionId, pid, Math.abs(diff));
                    if (!res || !res.success) {
                        elError.textContent = (res && res.message) || 'Error al agregar producto.';
                        elBtnGuardar.disabled = false;
                        return;
                    }
                }
            }
            cambiosGuardados = {};
            if (typeof recargar === 'function') await recargar();
            await cargarCatalogo();
            pintarListaUnificada();
            elBtnGuardar.disabled = false;
        } catch (err) {
            console.error(err);
            elError.textContent = 'Error de conexión al guardar cambios.';
            elBtnGuardar.disabled = false;
        }
    });

    function anadirAPendientes(productoId) {
        const p = listaProductos.find((x) => x._id === productoId);
        if (!p) return;
        const cupo = cupoRestante(productoId);
        if (cupo <= 0) return;
        const existente = pendientes.find((l) => l.producto_id === productoId);
        if (existente) {
            existente.cantidad = Math.min(existente.cantidad + 1, cantidadDisponibleEnCatalogo(productoId));
        } else {
            pendientes.push({
                producto_id: productoId,
                nombre: p.nombre || 'Producto',
                precio: Number(p.precio) || 0,
                cantidad: 1,
            });
        }
        pintarListaUnificada();
    }

    function anadirVariosSeleccionados(idsUnicos) {
        for (const id of Array.from(idsUnicos)) {
            if (cupoParaSelector(id) <= 0) continue;
            anadirAPendientes(id);
        }
    }

    function abrirModalSelectorGrande() {
        cerrarModalSelectorProductosConsumo();
        let terminoSel = '';
        const seleccionados = new Set();

        const ov = document.createElement('div');
        ov.className = 'modal-overlay consumos-selector-overlay active';
        ov.id = 'modalSelectorProductosConsumo';
        ov.innerHTML = `
            <div class="consumos-selector-container" role="dialog" aria-labelledby="consumosSelectorTitulo">
                <div class="consumos-selector-header">
                    <div>
                        <h2 id="consumosSelectorTitulo" class="consumos-selector-titulo"><i class="fas fa-search"></i> Buscar productos</h2>
                        <p class="consumos-selector-sub">Marcá varios y añadilos a la lista (cantidad 1 cada uno; luego ajustás en la ventana principal).</p>
                    </div>
                    <button type="button" class="modal-close" id="consumosSelectorCerrar" aria-label="Cerrar"><i class="fas fa-times"></i></button>
                </div>
                <div class="consumos-selector-buscar-wrap">
                    <i class="fas fa-search consumos-selector-buscar-icono"></i>
                    <input type="search" id="consumosSelectorBuscar" class="consumos-selector-buscar-input" placeholder="Escribí para filtrar por nombre o código…" autocomplete="off">
                </div>
                <div class="consumos-selector-lista-wrap" id="consumosSelectorLista"></div>
                <footer class="consumos-selector-pie">
                    <span class="consumos-selector-contador" id="consumosSelectorContador">0 seleccionados</span>
                    <div class="consumos-selector-pie-botones">
                        <button type="button" class="consumos-selector-btn-secundario" id="consumosSelectorCancelar">Cancelar</button>
                        <button type="button" class="consumos-selector-btn-primario" id="consumosSelectorAnadir" disabled>
                            <i class="fas fa-arrow-down"></i> Añadir a la lista
                        </button>
                    </div>
                </footer>
            </div>
        `;
        document.body.appendChild(ov);

        const elListaSel = document.getElementById('consumosSelectorLista');
        const inpSel = document.getElementById('consumosSelectorBuscar');
        const elContador = document.getElementById('consumosSelectorContador');
        const btnAnadirSel = document.getElementById('consumosSelectorAnadir');

        function actualizarContadorSelector() {
            const n = seleccionados.size;
            elContador.textContent = n === 1 ? '1 seleccionado' : `${n} seleccionados`;
            btnAnadirSel.disabled = n === 0;
        }

        function pintarListaSelector() {
            const q = terminoSel.trim().toLowerCase();
            let items = listaProductos;
            if (q) {
                items = listaProductos.filter((p) => {
                    const nombre = (p.nombre || '').toLowerCase();
                    const codigo = (p.codigo || '').toLowerCase();
                    return nombre.includes(q) || codigo.includes(q);
                });
            }
            if (!items.length) {
                elListaSel.innerHTML = `<p class="consumos-selector-vacio">${q ? 'Sin resultados para esa búsqueda.' : 'No hay productos con cantidad disponible.'}</p>`;
                return;
            }
            elListaSel.innerHTML = `
                <div class="consumos-selector-grid">
                    ${items.map((p) => {
                        const cupo = cupoParaSelector(p._id);
                        const sinCupo = cupo <= 0;
                        const marcado = seleccionados.has(p._id);
                        const partesMeta = [formatearPrecioConsumo(p.precio), `Cantidad: ${p.cantidad}`];
                        if (p.codigo) partesMeta.unshift(escaparHtml(p.codigo));
                        return `
                        <label class="consumos-selector-item ${sinCupo ? 'consumos-selector-item--disabled' : ''} ${marcado ? 'consumos-selector-item--marcado' : ''}">
                            <input type="checkbox" class="consumos-selector-check" data-pid="${p._id}" ${marcado ? 'checked' : ''} ${sinCupo ? 'disabled' : ''}>
                            <span class="consumos-selector-item-cuerpo">
                                <span class="consumos-selector-item-nombre">${escaparHtml(p.nombre)}</span>
                                <span class="consumos-selector-item-meta">${partesMeta.join(' · ')}</span>
                            </span>
                        </label>`;
                    }).join('')}
                </div>`;
            elListaSel.querySelectorAll('.consumos-selector-check').forEach((chk) => {
                chk.addEventListener('change', () => {
                    const pid = chk.getAttribute('data-pid');
                    if (chk.checked) seleccionados.add(pid);
                    else seleccionados.delete(pid);
                    pintarListaSelector();
                    actualizarContadorSelector();
                });
            });
        }

        inpSel.addEventListener('input', () => {
            terminoSel = inpSel.value;
            pintarListaSelector();
            actualizarContadorSelector();
        });

        function cerrarSel() { cerrarModalSelectorProductosConsumo(); }
        document.getElementById('consumosSelectorCerrar').addEventListener('click', cerrarSel);
        document.getElementById('consumosSelectorCancelar').addEventListener('click', cerrarSel);
        ov.addEventListener('click', (e) => { if (e.target === ov) cerrarSel(); });

        document.getElementById('consumosSelectorAnadir').addEventListener('click', () => {
            if (seleccionados.size === 0) return;
            const copia = new Set(seleccionados);
            cerrarSel();
            anadirVariosSeleccionados(copia);
        });

        pintarListaSelector();
        actualizarContadorSelector();
        setTimeout(() => inpSel.focus(), 100);
    }

    // ── Modal editar producto externo ──
    function abrirModalEditarExterno(consumo) {
        const anteriorEdit = document.getElementById('modalEditarExterno');
        if (anteriorEdit) anteriorEdit.remove();

        const ovEdit = document.createElement('div');
        ovEdit.className = 'modal-overlay consumos-selector-overlay active';
        ovEdit.id = 'modalEditarExterno';
        ovEdit.style.zIndex = '30000';
        ovEdit.innerHTML = `
            <div class="modal-container" style="max-width:400px;border-radius:16px;" role="dialog" aria-labelledby="editarExternoTitulo">
                <div class="modal-header" style="padding:16px 20px;">
                    <h2 id="editarExternoTitulo" style="font-size:16px;margin:0;"><i class="fas fa-pen"></i> Editar producto externo</h2>
                    <button type="button" class="modal-close" id="editarExternoCerrar" aria-label="Cerrar"><i class="fas fa-times"></i></button>
                </div>
                <div style="padding:18px 20px;display:flex;flex-direction:column;gap:12px;">
                    <div>
                        <label style="font-weight:600;font-size:13px;margin-bottom:4px;display:block;">Nombre del producto</label>
                        <input type="text" id="editarExternoNombre" autocomplete="off" style="width:100%;padding:12px 14px;border:2px solid #ccc;border-radius:10px;font-size:15px;font-family:inherit;box-sizing:border-box;">
                    </div>
                    <div style="display:flex;gap:12px;">
                        <div style="flex:1;">
                            <label style="font-weight:600;font-size:13px;margin-bottom:4px;display:block;">Precio unitario</label>
                            <input type="text" id="editarExternoPrecio" inputmode="numeric" autocomplete="off" style="width:100%;padding:12px 14px;border:2px solid #ccc;border-radius:10px;font-size:15px;font-family:inherit;box-sizing:border-box;">
                        </div>
                        <div style="flex:1;">
                            <label style="font-weight:600;font-size:13px;margin-bottom:4px;display:block;">Cantidad</label>
                            <input type="number" id="editarExternoCantidad" min="1" max="99" inputmode="numeric" style="width:100%;padding:12px 14px;border:2px solid #ccc;border-radius:10px;font-size:15px;font-family:inherit;box-sizing:border-box;">
                        </div>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-size:14px;font-weight:600;" id="editarExternoSubtotal">Subtotal: $0</span>
                    </div>
                    <p class="consumos-modal-error" id="editarExternoError" style="margin:0;"></p>
                    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:4px;">
                        <button type="button" class="consumos-selector-btn-secundario" id="editarExternoCancelar">Cancelar</button>
                        <button type="button" class="consumos-selector-btn-primario" id="editarExternoGuardar">
                            <i class="fas fa-save"></i> Guardar
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(ovEdit);

        const inpNombreE = document.getElementById('editarExternoNombre');
        const inpPrecioE = document.getElementById('editarExternoPrecio');
        const inpCantidadE = document.getElementById('editarExternoCantidad');
        const elSubtotalE = document.getElementById('editarExternoSubtotal');
        const elErrorE = document.getElementById('editarExternoError');

        // Cargar valores actuales
        inpNombreE.value = consumo.nombre || '';
        inpCantidadE.value = consumo.cantidad || 1;

        let precioRealEdit = Math.round(Number(consumo.precio_unitario) || 0);
        function formatearNumeroMilesEdit(n) {
            return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        }
        inpPrecioE.value = precioRealEdit > 0 ? ('$' + formatearNumeroMilesEdit(precioRealEdit)) : '';

        function formatearInputPrecioEdit() {
            const soloDigitos = inpPrecioE.value.replace(/\D/g, '');
            precioRealEdit = parseInt(soloDigitos, 10) || 0;
            inpPrecioE.value = precioRealEdit > 0 ? ('$' + formatearNumeroMilesEdit(precioRealEdit)) : '';
        }
        function actualizarSubtotalEdit() {
            const c = parseInt(inpCantidadE.value) || 0;
            elSubtotalE.textContent = 'Subtotal: ' + formatearPrecioConsumo(Math.round(precioRealEdit * c));
        }
        inpPrecioE.addEventListener('input', () => { formatearInputPrecioEdit(); actualizarSubtotalEdit(); });
        inpCantidadE.addEventListener('input', actualizarSubtotalEdit);
        actualizarSubtotalEdit();

        function cerrarEdit() {
            const el = document.getElementById('modalEditarExterno');
            if (el) el.remove();
        }
        document.getElementById('editarExternoCerrar').addEventListener('click', cerrarEdit);
        document.getElementById('editarExternoCancelar').addEventListener('click', cerrarEdit);
        ovEdit.addEventListener('click', (e) => { if (e.target === ovEdit) cerrarEdit(); });

        document.getElementById('editarExternoGuardar').addEventListener('click', async () => {
            elErrorE.textContent = '';
            const nombre = inpNombreE.value.trim();
            const precio = precioRealEdit;
            const cantidad = parseInt(inpCantidadE.value);

            if (!nombre) { elErrorE.textContent = 'Escribí un nombre.'; return; }
            if (!precio || precio <= 0) { elErrorE.textContent = 'El precio debe ser mayor a 0.'; return; }
            if (!cantidad || cantidad < 1) { elErrorE.textContent = 'La cantidad debe ser al menos 1.'; return; }

            const btnGuardar = document.getElementById('editarExternoGuardar');
            btnGuardar.disabled = true;
            try {
                const res = await pywebview.api.editar_producto_externo(habitacionId, consumo.producto_id, nombre, precio, cantidad);
                if (!res || !res.success) {
                    elErrorE.textContent = (res && res.message) || 'Error al editar.';
                    btnGuardar.disabled = false;
                    return;
                }
                cerrarEdit();
                if (typeof recargar === 'function') await recargar();
                await cargarCatalogo();
                pintarListaUnificada();
            } catch (err) {
                console.error(err);
                elErrorE.textContent = 'Error de conexión.';
                btnGuardar.disabled = false;
            }
        });

        setTimeout(() => { inpNombreE.focus(); inpNombreE.setSelectionRange(inpNombreE.value.length, inpNombreE.value.length); }, 100);
    }

    async function cargarCatalogo() {
        try {
            const res = await pywebview.api.obtener_productos();
            if (!res || !res.success) { listaProductos = []; return; }
            listaProductos = filtrarProductosDisponibles(res.productos || [], habitacion.sede_id);
        } catch (e) {
            console.error(e);
            listaProductos = [];
        }
    }

    document.getElementById('consumosModalAbrirSelector').addEventListener('click', () => abrirModalSelectorGrande());

    // ── Modal Producto Único ──
    document.getElementById('consumosModalAbrirUnico').addEventListener('click', () => {
        const anteriorUnico = document.getElementById('modalProductoUnico');
        if (anteriorUnico) anteriorUnico.remove();

        const ovUnico = document.createElement('div');
        ovUnico.className = 'modal-overlay consumos-selector-overlay active';
        ovUnico.id = 'modalProductoUnico';
        ovUnico.style.zIndex = '30000';
        ovUnico.innerHTML = `
            <div class="modal-container" style="max-width:400px;border-radius:16px;" role="dialog" aria-labelledby="productoUnicoTitulo">
                <div class="modal-header" style="padding:16px 20px;">
                    <h2 id="productoUnicoTitulo" style="font-size:16px;margin:0;"><i class="fas fa-truck"></i> Producto externo</h2>
                    <button type="button" class="modal-close" id="productoUnicoCerrar" aria-label="Cerrar"><i class="fas fa-times"></i></button>
                </div>
                <div style="padding:18px 20px;display:flex;flex-direction:column;gap:12px;">
                    <div>
                        <label style="font-weight:600;font-size:13px;margin-bottom:4px;display:block;">Nombre del producto</label>
                        <input type="text" id="productoUnicoNombre" placeholder="Ej: Pizza, Domicilio..." autocomplete="off" style="width:100%;padding:12px 14px;border:2px solid #ccc;border-radius:10px;font-size:15px;font-family:inherit;box-sizing:border-box;">
                    </div>
                    <div style="display:flex;gap:12px;">
                        <div style="flex:1;">
                            <label style="font-weight:600;font-size:13px;margin-bottom:4px;display:block;">Precio unitario</label>
                            <input type="text" id="productoUnicoPrecio" placeholder="$0" inputmode="numeric" autocomplete="off" style="width:100%;padding:12px 14px;border:2px solid #ccc;border-radius:10px;font-size:15px;font-family:inherit;box-sizing:border-box;">
                        </div>
                        <div style="flex:1;">
                            <label style="font-weight:600;font-size:13px;margin-bottom:4px;display:block;">Cantidad</label>
                            <input type="number" id="productoUnicoCantidad" value="1" min="1" max="99" inputmode="numeric" style="width:100%;padding:12px 14px;border:2px solid #ccc;border-radius:10px;font-size:15px;font-family:inherit;box-sizing:border-box;">
                        </div>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-size:14px;font-weight:600;" id="productoUnicoSubtotal">Subtotal: $0</span>
                    </div>
                    <p class="consumos-modal-error" id="productoUnicoError" style="margin:0;"></p>
                    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:4px;">
                        <button type="button" class="consumos-selector-btn-secundario" id="productoUnicoCancelar">Cancelar</button>
                        <button type="button" class="consumos-selector-btn-primario" id="productoUnicoConfirmar">
                            <i class="fas fa-check"></i> Agregar
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(ovUnico);

        const inpNombre = document.getElementById('productoUnicoNombre');
        const inpPrecio = document.getElementById('productoUnicoPrecio');
        const inpCantidad = document.getElementById('productoUnicoCantidad');
        const elSubtotal = document.getElementById('productoUnicoSubtotal');
        const elErrorUnico = document.getElementById('productoUnicoError');

        // Precio con formato de miles
        let precioRealUnico = 0;
        function formatearNumeroMiles(n) {
            return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        }
        function formatearInputPrecio() {
            const soloDigitos = inpPrecio.value.replace(/\D/g, '');
            precioRealUnico = parseInt(soloDigitos, 10) || 0;
            inpPrecio.value = precioRealUnico > 0 ? ('$' + formatearNumeroMiles(precioRealUnico)) : '';
        }
        function actualizarSubtotal() {
            const c = parseInt(inpCantidad.value) || 0;
            elSubtotal.textContent = 'Subtotal: ' + formatearPrecioConsumo(Math.round(precioRealUnico * c));
        }
        inpPrecio.addEventListener('input', () => { formatearInputPrecio(); actualizarSubtotal(); });
        inpCantidad.addEventListener('input', actualizarSubtotal);

        function cerrarUnico() {
            const el = document.getElementById('modalProductoUnico');
            if (el) el.remove();
        }
        document.getElementById('productoUnicoCerrar').addEventListener('click', cerrarUnico);
        document.getElementById('productoUnicoCancelar').addEventListener('click', cerrarUnico);
        ovUnico.addEventListener('click', (e) => { if (e.target === ovUnico) cerrarUnico(); });

        document.getElementById('productoUnicoConfirmar').addEventListener('click', async () => {
            elErrorUnico.textContent = '';
            const nombre = inpNombre.value.trim();
            const precio = precioRealUnico;
            const cantidad = parseInt(inpCantidad.value);

            if (!nombre) { elErrorUnico.textContent = 'Escribí un nombre para el producto.'; return; }
            if (!precio || precio <= 0) { elErrorUnico.textContent = 'El precio debe ser mayor a 0.'; return; }
            if (!cantidad || cantidad < 1) { elErrorUnico.textContent = 'La cantidad debe ser al menos 1.'; return; }

            // Agregar a pendientes en vez de guardar directo
            pendientes.push({
                producto_id: '_externo_' + Date.now(),
                nombre: nombre,
                precio: precio,
                cantidad: cantidad,
                es_externo: true,
            });
            cerrarUnico();
            pintarListaUnificada();
        });

        setTimeout(() => { inpNombre.focus(); inpNombre.setSelectionRange(0, 0); }, 100);
    });

    document.getElementById('consumosModalCerrar').addEventListener('click', cerrarModalConsumosOcupacion);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrarModalConsumosOcupacion(); });

    elBtnConfirmar.addEventListener('click', async () => {
        elError.textContent = '';
        const lote = pendientes.filter((l) => (Number(l.cantidad) || 0) > 0);
        if (!lote.length) return;

        // Validar disponibilidad solo para productos normales (no externos)
        for (const linea of lote) {
            if (linea.es_externo) continue;
            const disp = cantidadDisponibleEnCatalogo(linea.producto_id);
            if (linea.cantidad > disp) {
                elError.textContent = `«${linea.nombre}»: la cantidad no puede ser mayor a ${disp} (disponible ahora).`;
                return;
            }
        }

        elBtnConfirmar.disabled = true;
        try {
            for (const linea of lote) {
                let resultado;
                if (linea.es_externo) {
                    resultado = await pywebview.api.agregar_producto_unico(
                        habitacionId, linea.nombre, linea.precio, linea.cantidad
                    );
                } else {
                    resultado = await pywebview.api.agregar_consumo_habitacion(
                        habitacionId, linea.producto_id, linea.cantidad
                    );
                }
                if (!resultado.success) {
                    elError.textContent = resultado.message || 'Error al agregar un producto.';
                    elBtnConfirmar.disabled = false;
                    if (typeof recargar === 'function') await recargar();
                    await cargarCatalogo();
                    pendientes = [];
                    pintarListaUnificada();
                    return;
                }
            }
            pendientes = [];
            if (typeof recargar === 'function') await recargar();
            await cargarCatalogo();
            pintarListaUnificada();
        } catch (err) {
            console.error(err);
            elError.textContent = 'Error de conexión al guardar.';
            elBtnConfirmar.disabled = pendientes.length === 0;
        }
    });

    pintarListaUnificada();
    await cargarCatalogo();
}

function cerrarModalConsumosOcupacion() {
    cerrarModalSelectorProductosConsumo();
    const el = document.getElementById('modalConsumosOcupacion');
    if (el) el.remove();
}
