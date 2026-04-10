let todasLasSedes = [];

// Ciudades y municipios de Colombia (enfoque en Valle del Cauca)
const ciudadesColombia = [
    // Capitales y ciudades principales
    'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Cúcuta', 'Bucaramanga',
    'Pereira', 'Santa Marta', 'Ibagué', 'Pasto', 'Manizales', 'Neiva', 'Villavicencio',
    'Armenia', 'Valledupar', 'Montería', 'Sincelejo', 'Popayán', 'Tunja',
    // Valle del Cauca - Todos los municipios
    'Alcalá', 'Andalucía', 'Ansermanuevo', 'Argelia', 'Bolívar', 'Buenaventura', 'Buga',
    'Bugalagrande', 'Caicedonia', 'Calima', 'Candelaria', 'Cartago', 'Dagua', 'El Águila',
    'El Cairo', 'El Cerrito', 'El Dovio', 'Florida', 'Ginebra', 'Guacarí', 'Guadalajara de Buga',
    'Jamundí', 'La Cumbre', 'La Unión', 'La Victoria', 'Obando', 'Palmira', 'Pradera',
    'Restrepo', 'Riofrío', 'Roldanillo', 'San Pedro', 'Sevilla', 'Toro', 'Trujillo',
    'Tuluá', 'Ulloa', 'Versalles', 'Vijes', 'Yotoco', 'Yumbo', 'Zarzal',
    // Otras ciudades importantes
    'Apartadó', 'Barrancabermeja', 'Bello', 'Chía', 'Dosquebradas', 'Duitama', 'Envigado',
    'Facatativá', 'Floridablanca', 'Fusagasugá', 'Girardot', 'Girón', 'Itagüí',
    'Maicao', 'Magangué', 'Malambo', 'Piedecuesta', 'Pitalito', 'Rionegro',
    'Sabanalarga', 'Sahagún', 'Soacha', 'Sogamoso', 'Soledad', 'Tumaco', 'Turbo',
    'Uribia', 'Zipaquirá'
].sort();

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

// Cargar sedes al iniciar
window.addEventListener('DOMContentLoaded', async () => {
    await esperarPywebview();
    
    try {
        const sesion = await pywebview.api.cargar_sesion();
        if (sesion) {
            const userRoleEl = document.querySelector('.user-role');
            if (userRoleEl) userRoleEl.textContent = sesion.rol === 'admin' ? 'Administrador' : 'Empleado';
            localStorage.setItem('sesionActiva', JSON.stringify(sesion));
            
            if (sesion.rol !== 'admin' && sesion.permisos && !sesion.permisos.ver_sedes) {
                window.location.href = 'dasboard-admin.html';
                return;
            }
            
            if (typeof inicializarPermisos === 'function') inicializarPermisos();
            
            if (!tienePermiso('crear_sedes')) {
                document.querySelectorAll('[onclick*="abrirModalNuevaSede"]').forEach(function(el) { el.style.display = 'none'; });
            }
            
            // Ocultar búsqueda para empleados (solo ven su sede)
            if (sesion.rol !== 'admin') {
                var searchBox = document.querySelector('.search-box');
                if (searchBox) searchBox.style.display = 'none';
            }
        }
    } catch (e) { console.error(e); }
    
    cargarSedes();
});

async function cargarSedes() {
    try {
        const resultado = await pywebview.api.obtener_sedes();
        const sedes = resultado.sedes || [];
        todasLasSedes = sedes;
        mostrarSedes(sedes);
    } catch (error) {
        console.error('Error al cargar sedes:', error);
        mostrarModal('error', 'Error', 'Error al cargar las sedes');
    }
}

function mostrarSedes(sedes) {
    const grid = document.getElementById('sedesGrid');
    
    if (!sedes || sedes.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-map-marked-alt"></i>
                <p>No hay sedes registradas</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = sedes.map(sede => {
        // Estado de internet
        const estadoInternet = sede.tiene_internet 
            ? '<span class="internet-status online"><i class="fas fa-wifi"></i> En línea</span>'
            : `<span class="internet-status offline"><i class="fas fa-wifi-slash"></i> Sin conexión${sede.tiempo_sin_internet ? ' (' + sede.tiempo_sin_internet + ')' : ''}</span>`;
        
        return `
            <div class="sede-card">
                <div class="sede-header">
                    <div class="sede-icon">
                        <i class="fas fa-building"></i>
                    </div>
                    <div class="sede-actions">
                        <button class="action-btn edit" onclick="editarSede('${sede._id}')" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </div>
                <h3 class="sede-nombre">${sede.nombre}</h3>
                <div class="sede-ubicacion">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${sede.ciudad}, Colombia</span>
                </div>
                <div class="sede-internet">
                    ${estadoInternet}
                </div>
            </div>
        `;
    }).join('');
}

function filtrarSedes() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    const sedesFiltradas = todasLasSedes.filter(sede => {
        return sede.nombre.toLowerCase().includes(searchTerm) || 
               sede.ciudad.toLowerCase().includes(searchTerm);
    });
    
    mostrarSedes(sedesFiltradas);
}

function abrirModalNuevaSede() {
    const opcionesCiudades = ciudadesColombia.map(ciudad => 
        `<option value="${ciudad}">`
    ).join('');
    
    const modalHTML = `
        <div class="modal-overlay-sede" id="sedeModal" style="display: flex;">
            <div class="modal-content-sede">
                <div class="modal-header-sede">
                    <h2><i class="fas fa-plus-circle"></i> Nueva Sede</h2>
                    <button class="modal-close-sede" type="button" onclick="cerrarModalSede()">&times;</button>
                </div>
                <form id="sedeForm">
                    <div class="form-group-sede">
                        <label>Nombre de la Sede</label>
                        <input type="text" id="sedeNombre" required placeholder="Ej: Sede Principal">
                    </div>
                    <div class="form-group-sede">
                        <label>Ciudad</label>
                        <input type="text" id="sedeCiudad" list="ciudadesList" required placeholder="Buscar ciudad...">
                        <datalist id="ciudadesList">
                            ${opcionesCiudades}
                        </datalist>
                    </div>
                    <div class="modal-actions-sede">
                        <button type="button" class="btn-cancel-sede" onclick="cerrarModalSede()">Cancelar</button>
                        <button type="button" class="btn-save-sede" onclick="guardarNuevaSede()">Crear Sede</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

async function guardarNuevaSede() {
    const nombre = document.getElementById('sedeNombre').value.trim();
    const ciudad = document.getElementById('sedeCiudad').value;
    
    if (!nombre || !ciudad) {
        mostrarModal('error', 'Error', 'Por favor complete todos los campos');
        return;
    }
    
    try {
        const resultado = await pywebview.api.crear_sede(nombre, ciudad);
        
        if (resultado.success) {
            cerrarModalSede();
            mostrarModal('success', '¡Éxito!', 'Sede creada correctamente');
            setTimeout(() => {
                cargarSedes();
            }, 1000);
        } else {
            mostrarModal('error', 'Error', resultado.message || 'Error al crear la sede');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarModal('error', 'Error', 'Error al crear la sede');
    }
}

async function editarSede(sedeId) {
    try {
        const sede = await pywebview.api.obtener_sede(sedeId);
        
        if (!sede) {
            mostrarModal('error', 'Error', 'Sede no encontrada');
            return;
        }
        
        const opcionesCiudades = ciudadesColombia.map(ciudad => 
            `<option value="${ciudad}">`
        ).join('');
        
        const modalHTML = `
            <div class="modal-overlay-sede" id="sedeModal" style="display: flex;">
                <div class="modal-content-sede">
                    <div class="modal-header-sede">
                        <h2><i class="fas fa-edit"></i> Editar Sede</h2>
                        <button class="modal-close-sede" type="button" onclick="cerrarModalSede()">&times;</button>
                    </div>
                    <form id="sedeForm">
                        <div class="form-group-sede">
                            <label>Nombre de la Sede</label>
                            <input type="text" id="sedeNombre" value="${sede.nombre}" required>
                        </div>
                        <div class="form-group-sede">
                            <label>Ciudad</label>
                            <input type="text" id="sedeCiudad" list="ciudadesList" value="${sede.ciudad}" required placeholder="Buscar ciudad...">
                            <datalist id="ciudadesList">
                                ${opcionesCiudades}
                            </datalist>
                        </div>
                        <div class="modal-actions-sede">
                            <button type="button" class="btn-cancel-sede" onclick="cerrarModalSede()">Cancelar</button>
                            <button type="button" class="btn-save-sede" onclick="guardarEdicionSede('${sedeId}')">Guardar Cambios</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    } catch (error) {
        console.error('Error:', error);
        mostrarModal('error', 'Error', 'Error al cargar datos de la sede');
    }
}

async function guardarEdicionSede(sedeId) {
    const nombre = document.getElementById('sedeNombre').value.trim();
    const ciudad = document.getElementById('sedeCiudad').value;
    
    if (!nombre || !ciudad) {
        mostrarModal('error', 'Error', 'Por favor complete todos los campos');
        return;
    }
    
    try {
        const resultado = await pywebview.api.actualizar_sede(sedeId, nombre, ciudad);
        
        if (resultado.success) {
            cerrarModalSede();
            mostrarModal('success', '¡Éxito!', 'Sede actualizada correctamente');
            setTimeout(() => {
                cargarSedes();
            }, 1000);
        } else {
            mostrarModal('error', 'Error', resultado.message || 'Error al actualizar la sede');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarModal('error', 'Error', 'Error al actualizar la sede');
    }
}

function cerrarModalSede() {
    const modal = document.getElementById('sedeModal');
    if (modal) {
        modal.remove();
    }
}

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

function mostrarModalConfirmacion(mensaje, onConfirm) {
    const modalHTML = `
        <div class="modal-overlay-confirm" id="confirmModal" style="display: flex;">
            <div class="modal-content-confirm">
                <div class="modal-icon-confirm">
                    <i class="fas fa-question-circle"></i>
                </div>
                <h2 class="modal-title-confirm">Confirmación</h2>
                <p class="modal-message-confirm">${mensaje}</p>
                <div class="modal-buttons-confirm">
                    <button class="btn-cancel-confirm" onclick="cerrarModalConfirmacion()">Cancelar</button>
                    <button class="btn-confirm" onclick="confirmarAccion()">Aceptar</button>
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
