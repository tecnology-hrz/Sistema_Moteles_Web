/**
 * Sistema de Permisos Personalizados
 * Se incluye en todas las páginas para controlar acceso a secciones y acciones
 */

// Obtener sesión actual
function obtenerSesionActual() {
    try {
        return JSON.parse(localStorage.getItem('sesionActiva') || '{}');
    } catch (e) { return {}; }
}

// Verificar si tiene un permiso específico
function tienePermiso(permiso) {
    var sesion = obtenerSesionActual();
    if (sesion.rol === 'admin') return true;
    return !!(sesion.permisos && sesion.permisos[permiso]);
}

// Obtener todos los permisos
function obtenerPermisos() {
    var sesion = obtenerSesionActual();
    if (sesion.rol === 'admin') return sesion.permisos || {};
    return sesion.permisos || {};
}

// Aplicar permisos a la navegación del sidebar
function aplicarPermisosNavegacion(permisos, rol) {
    if (rol === 'admin') return;
    var mapeo = {
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
        for (var pagina in mapeo) {
            if (href.includes(pagina) && !permisos[mapeo[pagina]]) {
                item.style.display = 'none';
            }
        }
    });
}

// Ocultar elementos por permiso usando data-permiso attribute
function aplicarPermisosElementos() {
    document.querySelectorAll('[data-permiso]').forEach(function(el) {
        var permiso = el.getAttribute('data-permiso');
        if (!tienePermiso(permiso)) {
            el.style.display = 'none';
        }
    });
}

// Inicializar permisos en la página actual
function inicializarPermisos() {
    var sesion = obtenerSesionActual();
    if (!sesion.username) return;
    
    // Actualizar nombre y rol en sidebar
    var userNameEl = document.getElementById('userName');
    if (userNameEl) userNameEl.textContent = sesion.username;
    var userRoleEl = document.querySelector('.user-role');
    if (userRoleEl) userRoleEl.textContent = sesion.rol === 'admin' ? 'Administrador' : 'Empleado';
    
    // Aplicar permisos de navegación
    aplicarPermisosNavegacion(sesion.permisos || {}, sesion.rol);
    
    // Aplicar permisos a elementos con data-permiso
    aplicarPermisosElementos();
}

// Definición de todos los permisos para el modal
var DEFINICION_PERMISOS = {
    'Navegación / Secciones': {
        'ver_turnos': 'Ver Turnos',
        'ver_habitaciones': 'Ver Habitaciones',
        'ver_reservaciones': 'Ver Reservaciones',
        'ver_facturacion': 'Ver Facturación',
        'ver_productos': 'Ver Productos',
        'ver_sedes': 'Ver Sedes',
        'ver_usuarios': 'Ver Gestión de Usuarios',
        'ver_gastos': 'Ver Gastos por Sede'
    },
    'Habitaciones': {
        'crear_habitaciones': 'Crear habitaciones',
        'editar_habitaciones': 'Editar habitaciones',
        'eliminar_habitaciones': 'Eliminar habitaciones',
        'config_tiempo_limpieza': 'Configurar tiempo de limpieza',
        'ocupar_habitaciones': 'Ocupar habitaciones',
        'cambiar_habitaciones': 'Cambiar de habitación',
        'reparar_habitaciones': 'Marcar en reparación'
    },
    'Reservaciones': {
        'crear_reservaciones': 'Crear reservaciones',
        'activar_reservaciones': 'Activar reservaciones',
        'cancelar_reservaciones': 'Cancelar reservaciones'
    },
    'Facturación': {
        'realizar_checkout': 'Realizar checkout / cobrar',
        'ver_historial_facturas': 'Ver historial de facturas',
        'descargar_pdf_facturas': 'Descargar PDF de facturas',
        'imprimir_tirilla_facturas': 'Imprimir tirilla de facturas'
    },
    'Productos': {
        'crear_productos': 'Crear productos',
        'editar_productos': 'Editar productos',
        'eliminar_productos': 'Eliminar productos',
        'desactivar_productos': 'Desactivar/reactivar productos',
        'copiar_productos': 'Copiar productos entre sedes',
        'descargar_pdf_productos': 'Descargar PDF de productos',
        'imprimir_tirilla_productos': 'Imprimir tirilla de productos'
    },
    'Sedes': {
        'crear_sedes': 'Crear sedes',
        'editar_sedes': 'Editar sedes'
    },
    'Gestión de Usuarios': {
        'crear_usuarios': 'Crear usuarios',
        'editar_usuarios': 'Editar usuarios',
        'eliminar_usuarios': 'Eliminar usuarios',
        'cambiar_estado_usuarios': 'Activar/desactivar usuarios'
    },
    'Gastos por Sede': {
        'crear_gastos': 'Registrar gastos',
        'editar_gastos': 'Editar gastos',
        'eliminar_gastos': 'Eliminar gastos'
    },
    'Turnos': {
        'config_turnos': 'Configurar turnos',
        'iniciar_turno': 'Iniciar turno',
        'cerrar_turno': 'Cerrar turno',
        'descargar_pdf_turnos': 'Descargar PDF de turnos',
        'imprimir_tirilla_turnos': 'Imprimir tirilla POS de turnos'
    },
    'Consumos': {
        'agregar_consumos': 'Agregar consumos a habitación',
        'quitar_consumos': 'Quitar consumos de habitación'
    }
};

// Hacer funciones globales
window.tienePermiso = tienePermiso;
window.obtenerPermisos = obtenerPermisos;
window.aplicarPermisosNavegacion = aplicarPermisosNavegacion;
window.aplicarPermisosElementos = aplicarPermisosElementos;
window.inicializarPermisos = inicializarPermisos;
window.obtenerSesionActual = obtenerSesionActual;
window.DEFINICION_PERMISOS = DEFINICION_PERMISOS;
