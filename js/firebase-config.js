/**
 * Firebase Configuration & API Layer
 * Reemplaza pywebview.api con llamadas directas a Firebase Firestore
 * Sistema de Moteles - Versión Web (Administrador)
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, doc, getDoc, getDocs, updateDoc, deleteDoc, query, where, setDoc }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCzOkLdbQQMBECL7xovhO4HnkgdOyCqFBE",
    authDomain: "sistemamoteleshrz.firebaseapp.com",
    projectId: "sistemamoteleshrz",
    storageBucket: "sistemamoteleshrz.firebasestorage.app",
    messagingSenderId: "1013873278188",
    appId: "1:1013873278188:web:dcef1fba1beffca27879c9",
    measurementId: "G-JRGN9CQ7DS"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ── Helpers ──
// Zona horaria de Colombia: America/Bogota (UTC-5)
const TIMEZONE_COLOMBIA = 'America/Bogota';

/**
 * Genera un ISO string en hora de Colombia (sin Z, sin offset),
 * compatible con el formato que produce Python: datetime.now().isoformat()
 * Ejemplo: "2026-04-07T15:25:00.123"
 */
function now() {
    const d = new Date();
    // Obtener componentes en zona horaria de Colombia
    const parts = d.toLocaleString('sv-SE', { timeZone: TIMEZONE_COLOMBIA, hour12: false }).replace(',', '');
    // parts = "2026-04-07 15:25:00"
    const [fecha, hora] = parts.split(' ');
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${fecha}T${hora}.${ms}`;
}

/**
 * Convierte cualquier fecha (string ISO o Date) a un objeto Date ajustado a Colombia.
 * Útil para formatear en pantalla: siempre muestra hora de Colombia sin importar
 * la zona del navegador del usuario.
 */
function fechaColombia(fecha) {
    let d;
    if (!fecha && fecha !== 0) {
        d = new Date();
    } else if (typeof fecha === 'number') {
        d = new Date(fecha);
    } else if (fecha instanceof Date) {
        d = fecha;
    } else {
        // String ISO - si no tiene Z ni offset, es hora local (compatible con Python)
        const s = String(fecha);
        if (!s.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(s)) {
            // Fecha sin zona → interpretar como hora Colombia directa
            const parsed = new Date(s);
            if (!isNaN(parsed)) return parsed;
        }
        d = new Date(s);
    }
    if (isNaN(d)) return new Date();
    // toLocaleString con zona Colombia nos da los componentes correctos
    const str = d.toLocaleString('en-US', { timeZone: TIMEZONE_COLOMBIA, hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit' });
    // str = "04/07/2026, 15:25:00"
    const m = str.match(/(\d+)\/(\d+)\/(\d+),?\s*(\d+):(\d+):(\d+)/);
    if (!m) return d;
    return new Date(+m[3], +m[1] - 1, +m[2], +m[4] === 24 ? 0 : +m[4], +m[5], +m[6], d.getMilliseconds());
}

// Exponer globalmente para que otros scripts la usen
window.fechaColombia = fechaColombia;
window.TIMEZONE_COLOMBIA = TIMEZONE_COLOMBIA;

/** Genera un ID compatible con MongoDB ObjectId (24 hex chars) para documentos nuevos */
function generarObjectId() {
    const ts = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
    const rand = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    return ts + rand;
}

/** Crea un documento en Firebase con ID compatible con MongoDB ObjectId */
async function crearDocumento(coleccionNombre, datos) {
    const id = generarObjectId();
    datos._id = id;
    datos._sync_timestamp = now();
    await setDoc(doc(db, coleccionNombre, id), datos);
    return id;
}

function serializarDoc(docSnap) {
    if (!docSnap.exists()) return null;
    const data = docSnap.data();
    data._id = docSnap.id;
    return data;
}

function serializarDocs(querySnap) {
    return querySnap.docs.map(d => { const data = d.data(); data._id = d.id; return data; });
}

// Permisos por defecto
function obtenerPermisosDefecto(rol) {
    const todos = {
        ver_turnos: true, ver_habitaciones: true, ver_reservaciones: true,
        ver_facturacion: true, ver_productos: true, ver_sedes: true,
        ver_usuarios: true, crear_habitaciones: true, editar_habitaciones: true,
        eliminar_habitaciones: true, config_tiempo_limpieza: true,
        ocupar_habitaciones: true, cambiar_habitaciones: true, reparar_habitaciones: true,
        crear_reservaciones: true, activar_reservaciones: true, cancelar_reservaciones: true,
        realizar_checkout: true, ver_historial_facturas: true,
        descargar_pdf_facturas: true, imprimir_tirilla_facturas: true,
        crear_productos: true, editar_productos: true, eliminar_productos: true,
        desactivar_productos: true, copiar_productos: true,
        descargar_pdf_productos: true, imprimir_tirilla_productos: true,
        crear_sedes: true, editar_sedes: true,
        crear_usuarios: true, editar_usuarios: true, eliminar_usuarios: true,
        cambiar_estado_usuarios: true, config_turnos: true, iniciar_turno: true,
        cerrar_turno: true, descargar_pdf_turnos: true, imprimir_tirilla_turnos: true,
        agregar_consumos: true, quitar_consumos: true,
        ver_gastos: true, crear_gastos: true, editar_gastos: true, eliminar_gastos: true,
    };
    if (rol === 'admin') return todos;
    const basicos = { ...todos };
    basicos.ver_sedes = false; basicos.ver_usuarios = false;
    basicos.crear_habitaciones = false; basicos.editar_habitaciones = false;
    basicos.eliminar_habitaciones = false; basicos.config_tiempo_limpieza = false;
    basicos.crear_sedes = false; basicos.editar_sedes = false;
    basicos.crear_usuarios = false; basicos.editar_usuarios = false;
    basicos.eliminar_usuarios = false; basicos.cambiar_estado_usuarios = false;
    basicos.crear_productos = false; basicos.editar_productos = false;
    basicos.eliminar_productos = false; basicos.copiar_productos = false;
    basicos.config_turnos = false;
    basicos.descargar_pdf_facturas = false; basicos.imprimir_tirilla_facturas = false;
    basicos.descargar_pdf_productos = false; basicos.imprimir_tirilla_productos = false;
    basicos.descargar_pdf_turnos = false; basicos.imprimir_tirilla_turnos = false;
    basicos.crear_gastos = false; basicos.editar_gastos = false; basicos.eliminar_gastos = false;
    return basicos;
}

function _etiquetaHabitacion(doc) {
    let num = doc.numero; let nom = doc.nombre || '';
    if (num == null) num = doc.habitacion_numero;
    if (nom == null) nom = doc.habitacion_nombre || '';
    let nf = String(num || '').trim();
    if (/^\d+$/.test(nf)) nf = nf.padStart(2, '0');
    if (nf && nom) return `${nf} - ${nom}`;
    return nom || nf || 'Habitación';
}

function _nombreOperador() {
    try {
        const s = JSON.parse(localStorage.getItem('sesionActiva') || '{}');
        return s.username || '—';
    } catch { return '—'; }
}


// ══════════════════════════════════════════════════════════════
// API OBJECT — mirrors pywebview.api
// ══════════════════════════════════════════════════════════════
const api = {

    // ── SESIÓN ──
    async cargar_sesion() {
        try {
            const s = localStorage.getItem('sesionActiva');
            return s ? JSON.parse(s) : null;
        } catch { return null; }
    },

    guardar_sesion(username, rol, permisos) {
        const sesion = { username, rol, permisos, timestamp: now() };
        localStorage.setItem('sesionActiva', JSON.stringify(sesion));
    },

    async cerrar_sesion() {
        localStorage.removeItem('sesionActiva');
        return { success: true, message: "Sesión cerrada" };
    },

    // ── LOGIN ──
    async login(username, password, _rol) {
        try {
            username = username.toUpperCase();
            const q1 = query(collection(db, 'usuarios'), where('username', '==', username), where('password', '==', password));
            const snap = await getDocs(q1);
            if (snap.empty) return { success: false, message: "Usuario o contraseña incorrectos" };
            const usuario = serializarDoc(snap.docs[0]);

            // Verificar sede configurada
            const sedeActualId = localStorage.getItem('sede_configurada_id');
            const sedesUsuario = usuario.sedes || [];
            if (usuario.rol !== 'admin' && sedeActualId) {
                const tieneAcceso = sedesUsuario.includes('TODAS') || sedesUsuario.includes(sedeActualId);
                if (!tieneAcceso) return { success: false, message: "No tienes acceso a esta sede" };
            }

            const permisos = usuario.rol === 'admin' ? obtenerPermisosDefecto('admin') : (usuario.permisos || obtenerPermisosDefecto(usuario.rol));
            api.guardar_sesion(usuario.username, usuario.rol, permisos);
            return { success: true, message: "Login exitoso", rol: usuario.rol, username: usuario.username, permisos };
        } catch (e) {
            console.error('Error login:', e);
            return { success: false, message: "Error al iniciar sesión" };
        }
    },

    // ── REGISTRO ──
    async registro(username, password, rol) {
        try {
            username = username.toUpperCase();
            const q1 = query(collection(db, 'usuarios'), where('username', '==', username));
            const snap = await getDocs(q1);
            if (!snap.empty) return { success: false, message: "El usuario ya existe" };

            const sedeId = localStorage.getItem('sede_configurada_id');
            const nuevo = {
                username, password, rol: rol || 'empleado',
                fecha_registro: now(), activo: true,
                permisos: obtenerPermisosDefecto(rol || 'empleado'),
                sedes: sedeId ? [sedeId] : [],
                _sync_timestamp: now()
            };
            await crearDocumento('usuarios', nuevo);
            return { success: true, message: "Usuario registrado exitosamente" };
        } catch (e) {
            console.error('Error registro:', e);
            return { success: false, message: "Error al registrar usuario" };
        }
    },

    // ── SEDES ──
    async obtener_sedes() {
        try {
            const snap = await getDocs(collection(db, 'sedes'));
            const sedes = serializarDocs(snap);
            const sedeActualId = localStorage.getItem('sede_configurada_id');
            return { success: true, sedes, sede_actual_id: sedeActualId };
        } catch (e) {
            console.error('Error sedes:', e);
            return { success: false, sedes: [], sede_actual_id: null };
        }
    },

    async obtener_sede(sede_id) {
        try {
            const d = await getDoc(doc(db, 'sedes', sede_id));
            return serializarDoc(d);
        } catch { return null; }
    },

    async obtener_sede_actual() {
        try {
            const sedeId = localStorage.getItem('sede_configurada_id');
            if (!sedeId) return { success: false, message: "No hay sede configurada" };
            const d = await getDoc(doc(db, 'sedes', sedeId));
            if (!d.exists()) return { success: false, message: "Sede no encontrada" };
            const sede = serializarDoc(d);
            return { success: true, sede };
        } catch (e) {
            return { success: false, message: "Error al obtener la sede actual" };
        }
    },

    async configurar_sede_sistema(sede_id) {
        try {
            const d = await getDoc(doc(db, 'sedes', sede_id));
            if (!d.exists()) return { success: false, message: "La sede no existe" };
            localStorage.setItem('sede_configurada_id', sede_id);
            localStorage.setItem('sede_configurada_nombre', d.data().nombre || '');
            return { success: true, message: "Sede configurada correctamente" };
        } catch (e) {
            return { success: false, message: "Error al configurar la sede" };
        }
    },

    async crear_sede(nombre, ciudad) {
        try {
            const q1 = query(collection(db, 'sedes'), where('nombre', '==', nombre), where('ciudad', '==', ciudad));
            const snap = await getDocs(q1);
            if (!snap.empty) return { success: false, message: "Ya existe una sede con ese nombre en esa ciudad" };
            await crearDocumento('sedes', { nombre, ciudad, fecha_creacion: now(), activa: true });
            return { success: true, message: "Sede creada correctamente" };
        } catch (e) {
            return { success: false, message: "Error al crear la sede" };
        }
    },

    async actualizar_sede(sede_id, nombre, ciudad) {
        try {
            await updateDoc(doc(db, 'sedes', sede_id), { nombre, ciudad, _sync_timestamp: now() });
            return { success: true, message: "Sede actualizada correctamente" };
        } catch (e) {
            return { success: false, message: "Error al actualizar la sede" };
        }
    },

    async obtener_sede_empleado() {
        const sedeId = localStorage.getItem('sede_configurada_id');
        if (!sedeId) return { success: false, message: "No hay sede configurada en el sistema" };
        const d = await getDoc(doc(db, 'sedes', sedeId));
        if (!d.exists()) return { success: false, message: "Sede no encontrada" };
        return { success: true, sede: serializarDoc(d) };
    },

    // ── USUARIOS ──
    async obtener_usuarios() {
        try {
            const snap = await getDocs(collection(db, 'usuarios'));
            const usuarios = serializarDocs(snap);
            // Resolver sedes_info
            const sedesSnap = await getDocs(collection(db, 'sedes'));
            const sedesMap = {};
            sedesSnap.docs.forEach(d => { sedesMap[d.id] = d.data(); });

            return usuarios.map(u => {
                const sedesRaw = u.sedes || [];
                let sedes_info = [];
                let sedes_ids = [];
                if (sedesRaw.includes('TODAS')) {
                    sedes_info = [{ id: 'TODAS', nombre: 'Todas las sedes', ciudad: '' }];
                    sedes_ids = ['TODAS'];
                } else {
                    sedesRaw.forEach(sid => {
                        const s = sedesMap[sid];
                        if (s) { sedes_info.push({ id: sid, nombre: s.nombre || '', ciudad: s.ciudad || '' }); sedes_ids.push(sid); }
                    });
                }
                return { ...u, sedes: sedes_ids, sedes_info, permisos: u.permisos || obtenerPermisosDefecto(u.rol || 'empleado') };
            });
        } catch (e) {
            console.error('Error usuarios:', e);
            return [];
        }
    },

    async obtener_usuario(user_id) {
        try {
            const d = await getDoc(doc(db, 'usuarios', user_id));
            if (!d.exists()) return null;
            const u = serializarDoc(d);
            u.sedes = u.sedes || [];
            u.permisos = u.permisos || obtenerPermisosDefecto(u.rol || 'empleado');
            return u;
        } catch { return null; }
    },

    async crear_usuario_admin(username, password, rol, sedes, permisos) {
        try {
            username = username.toUpperCase();
            const q1 = query(collection(db, 'usuarios'), where('username', '==', username));
            const snap = await getDocs(q1);
            if (!snap.empty) return { success: false, message: "El usuario ya existe" };
            const nuevo = {
                username, password, rol, fecha_registro: now(), activo: true,
                sedes: sedes || [], permisos: rol === 'admin' ? obtenerPermisosDefecto('admin') : (permisos || obtenerPermisosDefecto(rol)),
                _sync_timestamp: now()
            };
            await crearDocumento('usuarios', nuevo);
            return { success: true, message: "Usuario creado exitosamente" };
        } catch (e) {
            return { success: false, message: "Error al crear usuario" };
        }
    },

    async actualizar_usuario(user_id, username, password, rol, sedes, permisos) {
        try {
            username = username.toUpperCase();
            const datos = { username, password, rol, sedes: sedes || [], _sync_timestamp: now() };
            if (rol === 'admin') datos.permisos = obtenerPermisosDefecto('admin');
            else if (permisos) datos.permisos = permisos;
            await updateDoc(doc(db, 'usuarios', user_id), datos);
            return { success: true, message: "Usuario actualizado correctamente" };
        } catch (e) {
            return { success: false, message: "Error al actualizar el usuario" };
        }
    },

    async cambiar_estado_usuario(user_id, nuevo_estado) {
        try {
            await updateDoc(doc(db, 'usuarios', user_id), { activo: nuevo_estado, _sync_timestamp: now() });
            return { success: true, message: "Estado actualizado correctamente" };
        } catch (e) {
            return { success: false, message: "Error al cambiar el estado" };
        }
    },

    async eliminar_usuario(user_id) {
        try {
            await deleteDoc(doc(db, 'usuarios', user_id));
            return { success: true, message: "Usuario eliminado correctamente" };
        } catch (e) {
            return { success: false, message: "Error al eliminar el usuario" };
        }
    },

    async obtener_permisos_por_rol(rol) {
        return obtenerPermisosDefecto(rol);
    },


    // ── PRODUCTOS ──
    async obtener_productos() {
        try {
            const snap = await getDocs(collection(db, 'productos'));
            const productos = serializarDocs(snap);
            const sedesSnap = await getDocs(collection(db, 'sedes'));
            const sedesMap = {};
            sedesSnap.docs.forEach(d => { sedesMap[d.id] = d.data(); });
            const result = productos.map(p => {
                const s = p.sede_id ? sedesMap[p.sede_id] : null;
                return { ...p, sede_nombre: s ? s.nombre : null, sede_ciudad: s ? s.ciudad : null, activo: p.activo !== false };
            });
            return { success: true, productos: result };
        } catch (e) {
            console.error('Error productos:', e);
            return { success: false, productos: [] };
        }
    },

    async obtener_siguiente_codigo() {
        try {
            const snap = await getDocs(collection(db, 'productos'));
            let max = 0;
            snap.docs.forEach(d => { try { const n = parseInt(d.data().codigo); if (n > max) max = n; } catch {} });
            const sig = max + 1;
            return { success: true, codigo: sig < 10 ? `0${sig}` : String(sig) };
        } catch { return { success: false, codigo: "01" }; }
    },

    async crear_producto(datos) {
        try {
            if (datos.sede_id === 'TODAS') {
                const sedesSnap = await getDocs(collection(db, 'sedes'));
                if (sedesSnap.empty) return { success: false, message: "No hay sedes disponibles" };
                let creados = 0;
                for (const s of sedesSnap.docs) {
                    const nuevo = { ...datos, sede_id: s.id, activo: true, fecha_creacion: now(), _sync_timestamp: now() };
                    delete nuevo._id;
                    await crearDocumento('productos', nuevo);
                    creados++;
                }
                return { success: true, message: `Producto creado en ${creados} sede(s)` };
            }
            const nuevo = { ...datos, activo: true, fecha_creacion: now(), _sync_timestamp: now() };
            delete nuevo._id;
            await crearDocumento('productos', nuevo);
            return { success: true, message: "Producto creado correctamente" };
        } catch (e) {
            return { success: false, message: `Error al crear el producto: ${e.message}` };
        }
    },

    async actualizar_producto(producto_id, datos) {
        try {
            const upd = { ...datos, _sync_timestamp: now() };
            delete upd._id;
            await updateDoc(doc(db, 'productos', producto_id), upd);
            return { success: true, message: "Producto actualizado correctamente" };
        } catch (e) {
            return { success: false, message: `Error al actualizar el producto: ${e.message}` };
        }
    },

    async eliminar_producto(producto_id) {
        try {
            await deleteDoc(doc(db, 'productos', producto_id));
            return { success: true, message: "Producto eliminado correctamente" };
        } catch (e) {
            return { success: false, message: "Error al eliminar el producto" };
        }
    },

    async desactivar_producto(producto_id) {
        try {
            await updateDoc(doc(db, 'productos', producto_id), { activo: false, _sync_timestamp: now() });
            return { success: true, message: "Producto desactivado correctamente" };
        } catch (e) {
            return { success: false, message: "Error al desactivar el producto" };
        }
    },

    async reactivar_producto(producto_id) {
        try {
            await updateDoc(doc(db, 'productos', producto_id), { activo: true, _sync_timestamp: now() });
            return { success: true, message: "Producto reactivado correctamente" };
        } catch (e) {
            return { success: false, message: "Error al reactivar el producto" };
        }
    },

    async desactivar_productos_multiples(ids) {
        try {
            let n = 0;
            for (const id of ids) { await updateDoc(doc(db, 'productos', id), { activo: false, _sync_timestamp: now() }); n++; }
            return { success: true, message: `Se desactivaron ${n} producto(s)` };
        } catch (e) { return { success: false, message: "Error al desactivar los productos" }; }
    },

    async reactivar_productos_multiples(ids) {
        try {
            let n = 0;
            for (const id of ids) { await updateDoc(doc(db, 'productos', id), { activo: true, _sync_timestamp: now() }); n++; }
            return { success: true, message: `Se reactivaron ${n} producto(s)` };
        } catch (e) { return { success: false, message: "Error al reactivar los productos" }; }
    },

    async eliminar_productos_multiples(ids) {
        try {
            let n = 0;
            for (const id of ids) { await deleteDoc(doc(db, 'productos', id)); n++; }
            return { success: true, message: `Se eliminaron ${n} producto(s)` };
        } catch (e) { return { success: false, message: "Error al eliminar los productos" }; }
    },

    async copiar_producto_multiples_sedes(producto_id, sedes_destino) {
        try {
            const d = await getDoc(doc(db, 'productos', producto_id));
            if (!d.exists()) return { success: false, message: "Producto no encontrado" };
            const orig = d.data();
            let copiados = 0;
            for (const sid of sedes_destino) {
                const nuevo = { ...orig, sede_id: sid, fecha_creacion: now(), _sync_timestamp: now() };
                delete nuevo._id;
                await crearDocumento('productos', nuevo);
                copiados++;
            }
            return { success: true, message: `Producto copiado a ${copiados} sede(s)` };
        } catch (e) {
            return { success: false, message: "Error al copiar el producto" };
        }
    },

    async obtener_productos_por_sede(sede_id) {
        try {
            const q1 = query(collection(db, 'productos'), where('sede_id', '==', sede_id));
            const snap = await getDocs(q1);
            return { success: true, productos: serializarDocs(snap) };
        } catch (e) {
            return { success: false, productos: [] };
        }
    },


    // ── HABITACIONES ──
    async obtener_siguiente_numero_habitacion(sede_id) {
        try {
            const snap = await getDocs(collection(db, 'habitaciones'));
            let max = 0;
            snap.docs.forEach(d => {
                const data = d.data();
                if (sede_id && data.sede_id !== sede_id) return;
                try { const n = parseInt(data.numero); if (n > max) max = n; } catch {}
            });
            const sig = max + 1;
            return { success: true, numero: sig < 10 ? `0${sig}` : String(sig) };
        } catch { return { success: false, numero: "01" }; }
    },

    async crear_habitacion(datos) {
        try {
            if (datos.sede_id === 'TODAS' || !datos.sede_id) {
                const sedesSnap = await getDocs(collection(db, 'sedes'));
                if (sedesSnap.empty) return { success: false, message: "No hay sedes disponibles" };
                let creados = 0;
                for (const s of sedesSnap.docs) {
                    const nuevo = { ...datos, sede_id: s.id, estado: 'disponible', placa: null, color: null, fecha_creacion: now(), _sync_timestamp: now() };
                    delete nuevo._id;
                    await crearDocumento('habitaciones', nuevo);
                    creados++;
                }
                return { success: true, message: `Habitación creada en ${creados} sede(s)` };
            }
            const nuevo = { ...datos, estado: 'disponible', placa: null, color: null, fecha_creacion: now(), _sync_timestamp: now() };
            delete nuevo._id;
            const newId = await crearDocumento('habitaciones', nuevo);
            return { success: true, message: "Habitación creada correctamente", id: newId };
        } catch (e) {
            return { success: false, message: `Error al crear la habitación: ${e.message}` };
        }
    },

    /** Verifica habitaciones en limpieza y las cambia a disponible si pasó el tiempo */
    async _verificar_limpieza(habitaciones, sedesMap) {
        const ahora = new Date();
        // Agrupar por sede
        const porSede = {};
        habitaciones.filter(h => h.estado === 'limpieza').forEach(h => {
            const key = h.sede_id || '__sin_sede__';
            if (!porSede[key]) porSede[key] = [];
            porSede[key].push(h);
        });

        for (const [sedeKey, habs] of Object.entries(porSede)) {
            // Obtener tiempo de limpieza de la sede
            let minutosBase = 15;
            if (sedeKey !== '__sin_sede__' && sedesMap[sedeKey]) {
                const tl = sedesMap[sedeKey].tiempo_limpieza;
                if (tl != null) minutosBase = parseInt(tl);
            }

            // Ordenar por fecha_limpieza (cola)
            habs.sort((a, b) => (a.fecha_limpieza || '').localeCompare(b.fecha_limpieza || ''));

            for (let idx = 0; idx < habs.length; idx++) {
                const h = habs[idx];
                if (!h.fecha_limpieza) continue;
                const inicio = new Date(h.fecha_limpieza);
                const tiempoLimite = minutosBase * (idx + 1) * 60 * 1000;
                const transcurrido = ahora - inicio;

                if (transcurrido >= tiempoLimite) {
                    // Cambiar a disponible en Firebase
                    try {
                        await updateDoc(doc(db, 'habitaciones', h._id), {
                            estado: 'disponible', fecha_limpieza: null, _sync_timestamp: now()
                        });
                        h.estado = 'disponible';
                        h.fecha_limpieza = null;
                    } catch (e) {
                        console.error('Error al cambiar limpieza a disponible:', e);
                    }
                }
            }
        }
    },

    async obtener_habitaciones() {
        try {
            const snap = await getDocs(collection(db, 'habitaciones'));
            const habitaciones = [];
            const sedesSnap = await getDocs(collection(db, 'sedes'));
            const sedesMap = {};
            sedesSnap.docs.forEach(d => { sedesMap[d.id] = d.data(); });

            snap.docs.forEach(d => {
                const h = d.data(); h._id = d.id;
                const s = h.sede_id ? sedesMap[h.sede_id] : null;
                h.sede_nombre = s ? s.nombre : null;
                h.sede_ciudad = s ? s.ciudad : null;
                h.consumos_ocupacion = h.consumos_ocupacion || [];
                h.movimientos_cuenta = h.movimientos_cuenta || [];
                habitaciones.push(h);
            });

            // Auto-cambiar habitaciones en limpieza completada a disponible
            await api._verificar_limpieza(habitaciones, sedesMap);

            return { success: true, habitaciones };
        } catch (e) {
            console.error('Error habitaciones:', e);
            return { success: false, habitaciones: [] };
        }
    },

    async obtener_habitaciones_por_sede(sede_id) {
        try {
            const q1 = query(collection(db, 'habitaciones'), where('sede_id', '==', sede_id));
            const snap = await getDocs(q1);
            const sedeDoc = await getDoc(doc(db, 'sedes', sede_id));
            const sedeData = sedeDoc.exists() ? sedeDoc.data() : {};
            const sedesMap = { [sede_id]: sedeData };
            const habitaciones = snap.docs.map(d => {
                const h = d.data(); h._id = d.id;
                h.sede_nombre = sedeData.nombre || null;
                h.sede_ciudad = sedeData.ciudad || null;
                h.consumos_ocupacion = h.consumos_ocupacion || [];
                h.movimientos_cuenta = h.movimientos_cuenta || [];
                return h;
            });

            // Auto-cambiar habitaciones en limpieza completada a disponible
            await api._verificar_limpieza(habitaciones, sedesMap);

            return { success: true, habitaciones };
        } catch (e) {
            return { success: false, habitaciones: [] };
        }
    },

    async actualizar_habitacion(habitacion_id, datos) {
        try {
            const upd = { ...datos, _sync_timestamp: now() };
            delete upd._id;
            await updateDoc(doc(db, 'habitaciones', habitacion_id), upd);
            return { success: true, message: "Habitación actualizada correctamente" };
        } catch (e) {
            return { success: false, message: `Error al actualizar la habitación: ${e.message}` };
        }
    },

    async eliminar_habitacion(habitacion_id) {
        try {
            const d = await getDoc(doc(db, 'habitaciones', habitacion_id));
            if (!d.exists()) return { success: false, message: "La habitación no existe" };
            if (d.data().estado === 'ocupada') return { success: false, message: "No se puede eliminar una habitación ocupada" };
            await deleteDoc(doc(db, 'habitaciones', habitacion_id));
            return { success: true, message: "Habitación eliminada correctamente" };
        } catch (e) {
            return { success: false, message: `Error al eliminar la habitación: ${e.message}` };
        }
    },

    async cambiar_estado_habitacion(habitacion_id, nuevo_estado) {
        try {
            const datos = { estado: nuevo_estado, _sync_timestamp: now() };
            if (nuevo_estado === 'disponible') {
                datos.placa = null; datos.color = null; datos.descripcion = null;
                datos.consumos_ocupacion = []; datos.movimientos_cuenta = [];
                datos.usuario_ocupacion = null;
            }
            await updateDoc(doc(db, 'habitaciones', habitacion_id), datos);
            return { success: true, message: "Estado actualizado correctamente" };
        } catch (e) {
            return { success: false, message: `Error al cambiar el estado: ${e.message}` };
        }
    },

    async marcar_en_reparacion(habitacion_id, motivo) {
        try {
            await updateDoc(doc(db, 'habitaciones', habitacion_id), {
                estado: 'reparacion', motivo_reparacion: motivo || 'Sin especificar',
                fecha_reparacion: now(), _sync_timestamp: now()
            });
            return { success: true, message: "Habitación marcada en reparación" };
        } catch (e) { return { success: false, message: `Error: ${e.message}` }; }
    },

    async marcar_reparada(habitacion_id) {
        try {
            await updateDoc(doc(db, 'habitaciones', habitacion_id), {
                estado: 'disponible', motivo_reparacion: null, fecha_reparacion: null, _sync_timestamp: now()
            });
            return { success: true, message: "Habitación reparada — ahora disponible" };
        } catch (e) { return { success: false, message: `Error: ${e.message}` }; }
    },

    async ocupar_habitacion(habitacion_id, datos) {
        try {
            const d = await getDoc(doc(db, 'habitaciones', habitacion_id));
            if (!d.exists()) return { success: false, message: "La habitación no existe" };
            const hab = d.data();
            const operador = _nombreOperador();
            const ahora = now();
            const precio_mov = parseInt(datos.precio_acordado || hab.precio_horas || 0);
            const movimiento = { fecha: ahora, descripcion: _etiquetaHabitacion(hab), valor: precio_mov, usuario: operador };

            await updateDoc(doc(db, 'habitaciones', habitacion_id), {
                estado: 'ocupada', tipo_vehiculo: datos.tipo_vehiculo || 'carro',
                placa: datos.placa || null, color: datos.color || null,
                color_vehiculo: datos.color_vehiculo || null,
                descripcion: datos.descripcion || '', fecha_ingreso: ahora,
                consumos_ocupacion: [], usuario_ocupacion: operador,
                movimientos_cuenta: [movimiento],
                tipo_ocupacion: datos.tipo_ocupacion || 'horas',
                precio_acordado: datos.precio_acordado || hab.precio_horas || 0,
                duracion_horas: datos.duracion_horas || hab.horas_base || 4,
                dias_personalizados: datos.dias_personalizados || null,
                _sync_timestamp: now()
            });
            return { success: true, message: "Habitación ocupada correctamente" };
        } catch (e) {
            return { success: false, message: `Error al ocupar la habitación: ${e.message}` };
        }
    },

    async obtener_habitaciones_ocupadas() {
        try {
            const q1 = query(collection(db, 'habitaciones'), where('estado', '==', 'ocupada'));
            const snap = await getDocs(q1);
            const sedesSnap = await getDocs(collection(db, 'sedes'));
            const sedesMap = {};
            sedesSnap.docs.forEach(d => { sedesMap[d.id] = d.data(); });
            const habitaciones = snap.docs.map(d => {
                const h = d.data(); h._id = d.id;
                const s = h.sede_id ? sedesMap[h.sede_id] : null;
                h.sede_nombre = s ? s.nombre : null;
                h.sede_ciudad = s ? s.ciudad : null;
                h.consumos_ocupacion = h.consumos_ocupacion || [];
                h.movimientos_cuenta = h.movimientos_cuenta || [];
                return h;
            });
            return { success: true, habitaciones };
        } catch (e) {
            return { success: false, habitaciones: [] };
        }
    },

    async obtener_habitaciones_disponibles_para_cambio(sede_id) {
        try {
            let q1;
            if (sede_id) q1 = query(collection(db, 'habitaciones'), where('estado', '==', 'disponible'), where('sede_id', '==', sede_id));
            else q1 = query(collection(db, 'habitaciones'), where('estado', '==', 'disponible'));
            const snap = await getDocs(q1);
            const sedesSnap = await getDocs(collection(db, 'sedes'));
            const sedesMap = {};
            sedesSnap.docs.forEach(d => { sedesMap[d.id] = d.data(); });
            const habitaciones = snap.docs.map(d => {
                const h = d.data(); h._id = d.id;
                const s = h.sede_id ? sedesMap[h.sede_id] : null;
                h.sede_nombre = s ? s.nombre : ''; h.sede_ciudad = s ? s.ciudad : '';
                return h;
            });
            return { success: true, habitaciones };
        } catch (e) { return { success: false, habitaciones: [], message: e.message }; }
    },

    async cambiar_habitacion(origen_id, destino_id) {
        try {
            const origenDoc = await getDoc(doc(db, 'habitaciones', origen_id));
            const destinoDoc = await getDoc(doc(db, 'habitaciones', destino_id));
            if (!origenDoc.exists() || !destinoDoc.exists()) return { success: false, message: "Habitación no encontrada" };
            const origen = origenDoc.data();
            const destino = destinoDoc.data();
            if (origen.estado !== 'ocupada') return { success: false, message: "La habitación de origen no está ocupada" };
            if (destino.estado !== 'disponible') return { success: false, message: "La habitación de destino no está disponible" };

            const operador = _nombreOperador();
            const movimientos = [...(origen.movimientos_cuenta || [])];
            movimientos.push({ fecha: now(), descripcion: `${origen.numero}Habt → ${destino.numero}Habt`, valor: 0, usuario: operador });

            // Copiar ocupación al destino
            await updateDoc(doc(db, 'habitaciones', destino_id), {
                estado: 'ocupada', tipo_vehiculo: origen.tipo_vehiculo, placa: origen.placa,
                color: origen.color, color_vehiculo: origen.color_vehiculo,
                descripcion: origen.descripcion, fecha_ingreso: origen.fecha_ingreso,
                consumos_ocupacion: origen.consumos_ocupacion || [],
                usuario_ocupacion: origen.usuario_ocupacion,
                movimientos_cuenta: movimientos,
                tipo_ocupacion: origen.tipo_ocupacion, precio_acordado: origen.precio_acordado,
                duracion_horas: origen.duracion_horas, dias_personalizados: origen.dias_personalizados,
                pago_anticipado: origen.pago_anticipado || false, monto_anticipado: origen.monto_anticipado || 0,
                _sync_timestamp: now()
            });

            // Limpiar origen
            await updateDoc(doc(db, 'habitaciones', origen_id), {
                estado: 'disponible', tipo_vehiculo: null, placa: null, color: null, color_vehiculo: null,
                descripcion: null, fecha_ingreso: null, consumos_ocupacion: [], usuario_ocupacion: null,
                movimientos_cuenta: [], tipo_ocupacion: null, precio_acordado: null,
                duracion_horas: null, dias_personalizados: null, pago_anticipado: null, monto_anticipado: null,
                _sync_timestamp: now()
            });

            return { success: true, message: `Huésped trasladado de ${_etiquetaHabitacion(origen)} a ${_etiquetaHabitacion(destino)}` };
        } catch (e) {
            return { success: false, message: `Error al cambiar habitación: ${e.message}` };
        }
    },


    // ── CONSUMOS ──
    async agregar_consumo_habitacion(habitacion_id, producto_id, cantidad) {
        try {
            cantidad = parseInt(cantidad);
            const habDoc = await getDoc(doc(db, 'habitaciones', habitacion_id));
            const prodDoc = await getDoc(doc(db, 'productos', producto_id));
            if (!habDoc.exists()) return { success: false, message: "La habitación no existe" };
            if (!prodDoc.exists()) return { success: false, message: "El producto no existe" };
            const hab = habDoc.data();
            const prod = prodDoc.data();
            const disponible = parseInt(prod.cantidad || 0);
            if (disponible < cantidad) return { success: false, message: `Cantidad insuficiente (disponible: ${disponible})` };

            const precio = parseFloat(prod.precio || 0);
            const operador = _nombreOperador();
            const ahora = now();
            const consumos = [...(hab.consumos_ocupacion || [])];
            const movimientos = [...(hab.movimientos_cuenta || [])];
            const pid = producto_id;
            let encontrado = false;
            for (const c of consumos) {
                if (c.producto_id === pid) {
                    c.cantidad = (parseInt(c.cantidad) || 0) + cantidad;
                    c.subtotal = Math.round(c.cantidad * (parseFloat(c.precio_unitario) || precio));
                    c.usuario_registro = operador; c.fecha_registro = ahora;
                    encontrado = true; break;
                }
            }
            if (!encontrado) {
                consumos.push({ producto_id: pid, codigo: prod.codigo || '', nombre: prod.nombre || '',
                    precio_unitario: precio, cantidad, subtotal: Math.round(cantidad * precio),
                    usuario_registro: operador, fecha_registro: ahora });
            }
            movimientos.push({ fecha: ahora, descripcion: `${prod.nombre} x ${cantidad}`, valor: Math.round(cantidad * precio), usuario: operador });

            await updateDoc(doc(db, 'productos', producto_id), { cantidad: disponible - cantidad, _sync_timestamp: now() });
            await updateDoc(doc(db, 'habitaciones', habitacion_id), { consumos_ocupacion: consumos, movimientos_cuenta: movimientos, _sync_timestamp: now() });

            const total_consumos = consumos.reduce((s, c) => s + (parseFloat(c.subtotal) || 0), 0);
            return { success: true, message: "Producto agregado a la habitación", consumos_ocupacion: consumos, total_consumos };
        } catch (e) {
            return { success: false, message: `Error al agregar el consumo: ${e.message}` };
        }
    },

    async agregar_producto_unico(habitacion_id, nombre, precio, cantidad) {
        try {
            nombre = String(nombre).trim();
            precio = parseFloat(precio); cantidad = parseInt(cantidad);
            if (!nombre) return { success: false, message: "El nombre del producto es obligatorio" };
            if (precio <= 0) return { success: false, message: "El precio debe ser mayor a 0" };

            const habDoc = await getDoc(doc(db, 'habitaciones', habitacion_id));
            if (!habDoc.exists()) return { success: false, message: "La habitación no existe" };
            const hab = habDoc.data();
            const operador = _nombreOperador();
            const ahora = now();
            const subtotal = Math.round(cantidad * precio);
            const pid = `unico_${Date.now().toString(36)}`;
            const consumos = [...(hab.consumos_ocupacion || [])];
            const movimientos = [...(hab.movimientos_cuenta || [])];
            consumos.push({ producto_id: pid, codigo: '', nombre, precio_unitario: precio, cantidad, subtotal, usuario_registro: operador, fecha_registro: ahora, es_producto_unico: true });
            movimientos.push({ fecha: ahora, descripcion: `${nombre} x ${cantidad} (externo)`, valor: subtotal, usuario: operador });

            await updateDoc(doc(db, 'habitaciones', habitacion_id), { consumos_ocupacion: consumos, movimientos_cuenta: movimientos, _sync_timestamp: now() });
            const total_consumos = consumos.reduce((s, c) => s + (parseFloat(c.subtotal) || 0), 0);
            return { success: true, message: `Producto único «${nombre}» agregado`, consumos_ocupacion: consumos, total_consumos };
        } catch (e) {
            return { success: false, message: `Error al agregar producto único: ${e.message}` };
        }
    },

    async editar_producto_externo(habitacion_id, producto_id, nombre, precio, cantidad) {
        try {
            const habDoc = await getDoc(doc(db, 'habitaciones', habitacion_id));
            if (!habDoc.exists()) return { success: false, message: "La habitación no existe" };
            const hab = habDoc.data();
            const consumos = [...(hab.consumos_ocupacion || [])];
            const movimientos = [...(hab.movimientos_cuenta || [])];
            const linea = consumos.find(c => c.producto_id === producto_id && c.es_producto_unico);
            if (!linea) return { success: false, message: "Producto externo no encontrado" };

            const operador = _nombreOperador();
            const ahora = now();
            precio = parseFloat(precio); cantidad = parseInt(cantidad);
            const subAnterior = parseInt(linea.subtotal || 0);
            const subNuevo = Math.round(cantidad * precio);
            linea.nombre = nombre; linea.precio_unitario = precio; linea.cantidad = cantidad;
            linea.subtotal = subNuevo; linea.usuario_registro = operador; linea.fecha_registro = ahora;
            const diff = subNuevo - subAnterior;
            if (diff !== 0) movimientos.push({ fecha: ahora, descripcion: `Editado: ${nombre} (externo)`, valor: diff, usuario: operador });

            await updateDoc(doc(db, 'habitaciones', habitacion_id), { consumos_ocupacion: consumos, movimientos_cuenta: movimientos, _sync_timestamp: now() });
            const total_consumos = consumos.reduce((s, c) => s + (parseFloat(c.subtotal) || 0), 0);
            return { success: true, message: `Producto externo «${nombre}» actualizado`, consumos_ocupacion: consumos, total_consumos };
        } catch (e) {
            return { success: false, message: `Error: ${e.message}` };
        }
    },

    async quitar_consumo_habitacion(habitacion_id, producto_id, cantidad) {
        try {
            cantidad = parseInt(cantidad);
            const habDoc = await getDoc(doc(db, 'habitaciones', habitacion_id));
            if (!habDoc.exists()) return { success: false, message: "La habitación no existe" };
            const hab = habDoc.data();
            let consumos = [...(hab.consumos_ocupacion || [])];
            const movimientos = [...(hab.movimientos_cuenta || [])];
            const linea = consumos.find(c => c.producto_id === producto_id);
            if (!linea) return { success: false, message: "Ese producto no está en los consumos" };

            const cantActual = parseInt(linea.cantidad || 0);
            if (cantidad > cantActual) return { success: false, message: `Solo hay ${cantActual} unidad(es)` };
            const operador = _nombreOperador();
            const ahora = now();
            const pu = parseFloat(linea.precio_unitario || 0);
            const nombre = linea.nombre || 'Producto';
            const esUnico = linea.es_producto_unico === true;

            const nueva = cantActual - cantidad;
            if (nueva <= 0) consumos = consumos.filter(c => c.producto_id !== producto_id);
            else { linea.cantidad = nueva; linea.subtotal = Math.round(nueva * pu); linea.usuario_registro = operador; linea.fecha_registro = ahora; }

            // Devolver al inventario si no es único
            if (!esUnico) {
                const prodDoc = await getDoc(doc(db, 'productos', producto_id));
                if (prodDoc.exists()) {
                    const cantProd = parseInt(prodDoc.data().cantidad || 0);
                    await updateDoc(doc(db, 'productos', producto_id), { cantidad: cantProd + cantidad, _sync_timestamp: now() });
                }
            }
            movimientos.push({ fecha: ahora, descripcion: `Devuelto: ${nombre} x ${cantidad}`, valor: -Math.round(cantidad * pu), usuario: operador });
            await updateDoc(doc(db, 'habitaciones', habitacion_id), { consumos_ocupacion: consumos, movimientos_cuenta: movimientos, _sync_timestamp: now() });
            const total_consumos = consumos.reduce((s, c) => s + (parseFloat(c.subtotal) || 0), 0);
            return { success: true, message: `Se quitó ${cantidad} unidad(es) de ${nombre}`, consumos_ocupacion: consumos, total_consumos };
        } catch (e) {
            return { success: false, message: `Error al quitar el consumo: ${e.message}` };
        }
    },

    // ── RESERVACIONES ──
    async reservar_habitacion(habitacion_id, datos) {
        try {
            const d = await getDoc(doc(db, 'habitaciones', habitacion_id));
            if (!d.exists()) return { success: false, message: "La habitación no existe" };
            const hab = d.data();
            const operador = _nombreOperador();
            const ahora = now();
            let fecha_reserva = ahora;
            if (datos.fecha_reserva && datos.hora_reserva) {
                fecha_reserva = `${datos.fecha_reserva}T${datos.hora_reserva}:00`;
            }
            const precio_mov = parseInt(datos.precio_acordado || hab.precio_horas || 0);
            const movimiento = { fecha: ahora, descripcion: _etiquetaHabitacion(hab), valor: precio_mov, usuario: operador };

            await updateDoc(doc(db, 'habitaciones', habitacion_id), {
                estado: 'reservada', tipo_vehiculo: datos.tipo_vehiculo || 'carro',
                placa: datos.placa || null, color: datos.color || null, color_vehiculo: datos.color_vehiculo || null,
                descripcion: datos.descripcion || '', fecha_ingreso: ahora, fecha_reserva,
                consumos_ocupacion: [], usuario_ocupacion: operador, movimientos_cuenta: [movimiento],
                tipo_ocupacion: datos.tipo_ocupacion || 'horas',
                precio_acordado: datos.precio_acordado || hab.precio_horas || 0,
                duracion_horas: datos.duracion_horas || hab.horas_base || 4,
                dias_personalizados: datos.dias_personalizados || null,
                pago_anticipado: true, monto_anticipado: precio_mov,
                _sync_timestamp: now()
            });
            return { success: true, message: "Habitación reservada correctamente" };
        } catch (e) {
            return { success: false, message: `Error al reservar: ${e.message}` };
        }
    },

    async activar_reserva(habitacion_id) {
        try {
            await updateDoc(doc(db, 'habitaciones', habitacion_id), { estado: 'ocupada', fecha_ingreso: now(), _sync_timestamp: now() });
            return { success: true, message: "Habitación ahora ocupada" };
        } catch (e) { return { success: false, message: `Error: ${e.message}` }; }
    },

    async cancelar_reserva(habitacion_id) {
        try {
            await updateDoc(doc(db, 'habitaciones', habitacion_id), {
                estado: 'disponible', placa: null, color: null, color_vehiculo: null,
                descripcion: null, tipo_vehiculo: null, fecha_ingreso: null, fecha_reserva: null,
                consumos_ocupacion: [], movimientos_cuenta: [], usuario_ocupacion: null,
                tipo_ocupacion: null, precio_acordado: null, duracion_horas: null, dias_personalizados: null,
                _sync_timestamp: now()
            });
            return { success: true, message: "Reserva cancelada — habitación disponible" };
        } catch (e) { return { success: false, message: `Error: ${e.message}` }; }
    },

    async obtener_reservas() {
        try {
            const q1 = query(collection(db, 'habitaciones'), where('estado', '==', 'reservada'));
            const snap = await getDocs(q1);
            const sedesSnap = await getDocs(collection(db, 'sedes'));
            const sedesMap = {};
            sedesSnap.docs.forEach(d => { sedesMap[d.id] = d.data(); });
            const reservas = snap.docs.map(d => {
                const h = d.data(); h._id = d.id;
                const s = h.sede_id ? sedesMap[h.sede_id] : null;
                h.sede_nombre = s ? s.nombre : null; h.sede_ciudad = s ? s.ciudad : null;
                return h;
            });
            return { success: true, reservas };
        } catch (e) { return { success: false, reservas: [] }; }
    },


    // ── CHECKOUT / FACTURACIÓN ──
    async realizar_checkout(habitacion_id, datos_factura) {
        try {
            const habDoc = await getDoc(doc(db, 'habitaciones', habitacion_id));
            if (!habDoc.exists()) return { success: false, message: "La habitación no existe" };
            const hab = habDoc.data();
            if (hab.estado !== 'ocupada') return { success: false, message: "La habitación no está ocupada" };

            let sede_nombre = '', sede_ciudad = '';
            if (hab.sede_id) {
                const sedeDoc = await getDoc(doc(db, 'sedes', hab.sede_id));
                if (sedeDoc.exists()) { sede_nombre = sedeDoc.data().nombre || ''; sede_ciudad = sedeDoc.data().ciudad || ''; }
            }

            const operador = _nombreOperador();
            // Generar código de factura
            const facturasSnap = await getDocs(collection(db, 'facturas'));
            let maxSeq = 0;
            facturasSnap.docs.forEach(d => {
                const ns = d.data().numero_factura_secuencial;
                if (ns != null) { const v = parseInt(ns); if (v > maxSeq) maxSeq = v; }
            });
            const numSeq = maxSeq + 1;
            const codFac = `REF-${(100000 + numSeq).toString().padStart(6, '0')}`;

            const factura = {
                habitacion_id, habitacion_nombre: hab.nombre, habitacion_numero: hab.numero,
                sede_id: hab.sede_id || null, sede_nombre, sede_ciudad,
                tipo_vehiculo: hab.tipo_vehiculo, tipo_ocupacion: datos_factura.tipo_ocupacion,
                placa: hab.placa, color: hab.color, descripcion: hab.descripcion || '',
                fecha_ingreso: hab.fecha_ingreso, fecha_salida: now(),
                modalidad: datos_factura.modalidad, dias: datos_factura.dias || 1,
                total: datos_factura.total, metodo_pago: datos_factura.metodo_pago || 'efectivo',
                referencia_pago: datos_factura.referencia_pago || '',
                monto_recibido: datos_factura.monto_recibido, cambio: datos_factura.cambio,
                tiempo_total: datos_factura.tiempo_total, tiempo_extra: datos_factura.tiempo_extra,
                consumos_ocupacion: hab.consumos_ocupacion || [],
                fecha_registro: now(), usuario_facturo: operador,
                usuario_ocupacion: hab.usuario_ocupacion,
                movimientos_cuenta: hab.movimientos_cuenta || [],
                pago_anticipado: hab.pago_anticipado || false, monto_anticipado: hab.monto_anticipado || 0,
                numero_factura_secuencial: numSeq, codigo_factura: codFac,
                _sync_timestamp: now()
            };
            await crearDocumento('facturas', factura);

            // Cambiar habitación a limpieza
            await updateDoc(doc(db, 'habitaciones', habitacion_id), {
                estado: 'limpieza', placa: null, color: null, descripcion: null,
                fecha_ingreso: null, fecha_limpieza: now(),
                consumos_ocupacion: [], movimientos_cuenta: [], usuario_ocupacion: null,
                tipo_ocupacion: null, precio_acordado: null, duracion_horas: null,
                dias_personalizados: null, pago_anticipado: null, monto_anticipado: null,
                fecha_reserva: null, _sync_timestamp: now()
            });

            return { success: true, message: "Check-out realizado correctamente" };
        } catch (e) {
            return { success: false, message: `Error al realizar check-out: ${e.message}` };
        }
    },

    async obtener_historial_facturas(fecha_desde, fecha_hasta, sede_nombre) {
        try {
            if (!fecha_desde || !fecha_hasta) return { success: false, message: 'Indique fecha desde y hasta', facturas: [] };
            const d0 = fecha_desde + 'T00:00:00';
            const d1 = fecha_hasta + 'T23:59:59';
            const snap = await getDocs(collection(db, 'facturas'));
            let facturas = [];
            snap.docs.forEach(d => {
                const f = d.data(); f._id = d.id;
                const fr = f.fecha_registro || '';
                if (fr >= d0 && fr <= d1) {
                    if (!sede_nombre || f.sede_nombre === sede_nombre) {
                        f.consumos_ocupacion = f.consumos_ocupacion || [];
                        f.movimientos_cuenta = f.movimientos_cuenta || [];
                        f.total = parseInt(f.total || 0);
                        const total_consumos = f.consumos_ocupacion.reduce((s, c) => s + parseInt(c.subtotal || 0), 0);
                        f.total_consumos = total_consumos;
                        facturas.push(f);
                    }
                }
            });
            facturas.sort((a, b) => (b.fecha_registro || '').localeCompare(a.fecha_registro || ''));
            return { success: true, facturas, total_registros: facturas.length };
        } catch (e) {
            return { success: false, message: `Error al cargar historial: ${e.message}`, facturas: [] };
        }
    },

    // ── TURNOS ──
    async registrar_inicio_turno() {
        try {
            const sesion = JSON.parse(localStorage.getItem('sesionActiva') || '{}');
            if (!sesion.username) return { success: false, mensaje: "No hay sesión activa" };
            // Verificar turno activo
            const q1 = query(collection(db, 'turnos'), where('usuario', '==', sesion.username), where('activo', '==', true));
            const snap = await getDocs(q1);
            if (!snap.empty) return { success: false, mensaje: "Ya tienes un turno activo" };
            const sedeId = localStorage.getItem('sede_configurada_id');
            await crearDocumento('turnos', {
                usuario: sesion.username, fecha_ingreso: now(), fecha_salida: null,
                dinero_base: 0, total_facturado: 0, sede_id: sedeId || null, activo: true
            });
            return { success: true, mensaje: "Turno iniciado correctamente" };
        } catch (e) { return { success: false, mensaje: `Error: ${e.message}` }; }
    },

    async registrar_salida_turno() {
        try {
            const sesion = JSON.parse(localStorage.getItem('sesionActiva') || '{}');
            if (!sesion.username) return { success: false, mensaje: "No hay sesión activa" };
            const q1 = query(collection(db, 'turnos'), where('usuario', '==', sesion.username), where('activo', '==', true));
            const snap = await getDocs(q1);
            if (snap.empty) return { success: false, mensaje: "No hay turno activo" };
            const turnoDoc = snap.docs[0];
            const turno = turnoDoc.data();

            // Calcular total facturado
            const facturasSnap = await getDocs(collection(db, 'facturas'));
            let total = 0;
            facturasSnap.docs.forEach(d => {
                const f = d.data();
                if (f.fecha_registro >= turno.fecha_ingreso) {
                    if (!turno.sede_id || f.sede_id === turno.sede_id) total += parseInt(f.total || 0);
                }
            });

            await updateDoc(doc(db, 'turnos', turnoDoc.id), { fecha_salida: now(), total_facturado: total, activo: false, _sync_timestamp: now() });
            return { success: true, mensaje: "Salida de turno registrada correctamente" };
        } catch (e) { return { success: false, mensaje: `Error: ${e.message}` }; }
    },

    async verificar_turno_activo() {
        try {
            const sesion = JSON.parse(localStorage.getItem('sesionActiva') || '{}');
            if (!sesion.username) return { activo: false };
            const q1 = query(collection(db, 'turnos'), where('usuario', '==', sesion.username), where('activo', '==', true));
            const snap = await getDocs(q1);
            if (snap.empty) return { activo: false };
            const t = snap.docs[0].data();
            return { activo: true, usuario: t.usuario, fecha_ingreso: t.fecha_ingreso };
        } catch { return { activo: false }; }
    },

    async obtener_registro_turnos(sede_id) {
        try {
            const snap = await getDocs(collection(db, 'turnos'));
            let turnos = serializarDocs(snap);
            if (sede_id) turnos = turnos.filter(t => t.sede_id === sede_id);
            turnos.sort((a, b) => (b.fecha_ingreso || '').localeCompare(a.fecha_ingreso || ''));
            turnos = turnos.slice(0, 50);

            // Leer dinero base de config
            const configSnap = await getDocs(collection(db, 'config'));
            const configMap = {};
            configSnap.docs.forEach(d => { const c = d.data(); configMap[`${c.clave}_${c.sede_id}`] = c.valor; });

            return turnos.map(t => {
                const db_val = parseFloat(configMap[`turno_dinero_base_${t.sede_id}`] || 0);
                const tf = parseFloat(t.total_facturado || 0);
                return { ...t, dinero_base: db_val, total_facturado: tf, total_caja: db_val + tf };
            });
        } catch (e) { console.error(e); return []; }
    },

    async obtener_balance_caja() {
        try {
            const sesion = JSON.parse(localStorage.getItem('sesionActiva') || '{}');
            const sedeId = localStorage.getItem('sede_configurada_id');

            // Leer dinero base
            const configSnap = await getDocs(collection(db, 'config'));
            let dineroBase = 0;
            configSnap.docs.forEach(d => {
                const c = d.data();
                if (c.clave === 'turno_dinero_base' && c.sede_id === sedeId) dineroBase = parseFloat(c.valor || 0);
            });

            if (!sesion.username) return { dinero_base: dineroBase, dinero_facturado: 0, total_caja: dineroBase };

            // Buscar turno activo
            const q1 = query(collection(db, 'turnos'), where('usuario', '==', sesion.username), where('activo', '==', true));
            const snap = await getDocs(q1);
            if (!snap.empty) {
                const turno = snap.docs[0].data();
                const facturasSnap = await getDocs(collection(db, 'facturas'));
                let total = 0;
                facturasSnap.docs.forEach(d => {
                    const f = d.data();
                    if (f.fecha_registro >= turno.fecha_ingreso) {
                        if (!turno.sede_id || f.sede_id === turno.sede_id) total += parseInt(f.total || 0);
                    }
                });
                return { dinero_base: dineroBase, dinero_facturado: total, total_caja: dineroBase + total };
            }

            // Último turno cerrado
            const allTurnos = await getDocs(collection(db, 'turnos'));
            let ultimo = null;
            allTurnos.docs.forEach(d => {
                const t = d.data();
                if (t.usuario === sesion.username && !t.activo) {
                    if (!ultimo || (t.fecha_ingreso || '') > (ultimo.fecha_ingreso || '')) ultimo = t;
                }
            });
            if (ultimo) {
                const tf = parseFloat(ultimo.total_facturado || 0);
                return { dinero_base: dineroBase, dinero_facturado: tf, total_caja: dineroBase + tf };
            }
            return { dinero_base: dineroBase, dinero_facturado: 0, total_caja: dineroBase };
        } catch (e) {
            console.error(e);
            return { dinero_base: 0, dinero_facturado: 0, total_caja: 0 };
        }
    },

    async obtener_config_turno() {
        const sedeId = localStorage.getItem('sede_configurada_id');
        if (!sedeId) return { dinero_base: 0, hora_inicio: "07:00", hora_fin: "07:00" };
        return api.obtener_config_turno_sede(sedeId);
    },

    async obtener_config_turno_sede(sede_id) {
        try {
            const snap = await getDocs(collection(db, 'config'));
            let dinero_base = 0, hora_inicio = '07:00', hora_fin = '07:00';
            let sede_nombre = '', sede_ciudad = '';
            snap.docs.forEach(d => {
                const c = d.data();
                if (c.sede_id === sede_id) {
                    if (c.clave === 'turno_dinero_base') dinero_base = parseFloat(c.valor || 0);
                    if (c.clave === 'turno_hora_inicio') hora_inicio = c.valor || '07:00';
                    if (c.clave === 'turno_hora_fin') hora_fin = c.valor || '07:00';
                }
            });
            try {
                const sedeDoc = await getDoc(doc(db, 'sedes', sede_id));
                if (sedeDoc.exists()) { sede_nombre = sedeDoc.data().nombre || ''; sede_ciudad = sedeDoc.data().ciudad || ''; }
            } catch {}
            return { dinero_base, hora_inicio, hora_fin, sede_nombre, sede_ciudad };
        } catch { return { dinero_base: 0, hora_inicio: "07:00", hora_fin: "07:00", sede_nombre: "", sede_ciudad: "" }; }
    },

    async guardar_config_turno(datos) {
        const sedeId = localStorage.getItem('sede_configurada_id');
        if (!sedeId) return { success: false, mensaje: "No hay sede configurada" };
        return api.guardar_config_turno_sede(sedeId, datos);
    },

    async guardar_config_turno_sede(sede_id, datos) {
        try {
            const claves = {
                turno_dinero_base: parseFloat(datos.dinero_base || 0),
                turno_hora_inicio: datos.hora_inicio || '07:00',
                turno_hora_fin: datos.hora_fin || '07:00'
            };
            const snap = await getDocs(collection(db, 'config'));
            for (const [clave, valor] of Object.entries(claves)) {
                const existente = snap.docs.find(d => d.data().clave === clave && d.data().sede_id === sede_id);
                if (existente) {
                    await updateDoc(doc(db, 'config', existente.id), { valor, _sync_timestamp: now() });
                } else {
                    await crearDocumento('config', { clave, sede_id, valor });
                }
            }
            return { success: true, mensaje: "Configuración guardada" };
        } catch (e) { return { success: false, mensaje: e.message }; }
    },

    async obtener_datos_turno_impresion(turno_id) {
        try {
            const sesion = JSON.parse(localStorage.getItem('sesionActiva') || '{}');
            if (!sesion.username) return { success: false, mensaje: "Sin sesión" };

            let turno = null;
            if (turno_id) {
                const d = await getDoc(doc(db, 'turnos', turno_id));
                if (d.exists()) turno = { ...d.data(), _id: d.id };
            } else {
                const q1 = query(collection(db, 'turnos'), where('usuario', '==', sesion.username), where('activo', '==', true));
                const snap = await getDocs(q1);
                if (!snap.empty) turno = { ...snap.docs[0].data(), _id: snap.docs[0].id };
                else {
                    const allSnap = await getDocs(collection(db, 'turnos'));
                    let best = null;
                    allSnap.docs.forEach(d => {
                        const t = d.data();
                        if (t.usuario === sesion.username && (!best || (t.fecha_ingreso || '') > (best.fecha_ingreso || ''))) best = { ...t, _id: d.id };
                    });
                    turno = best;
                }
            }
            if (!turno) return { success: false, mensaje: "No hay turno disponible" };

            const sedeId = turno.sede_id;
            let sede_nombre = '', sede_ciudad = '';
            if (sedeId) {
                const sedeDoc = await getDoc(doc(db, 'sedes', sedeId));
                if (sedeDoc.exists()) { sede_nombre = sedeDoc.data().nombre || ''; sede_ciudad = sedeDoc.data().ciudad || ''; }
            }

            // Dinero base
            let dinero_base = 0;
            const configSnap = await getDocs(collection(db, 'config'));
            configSnap.docs.forEach(d => {
                const c = d.data();
                if (c.clave === 'turno_dinero_base' && c.sede_id === sedeId) dinero_base = parseFloat(c.valor || 0);
            });

            // Facturas del turno
            const facturasSnap = await getDocs(collection(db, 'facturas'));
            const facturas = [];
            let total_facturado = 0;
            facturasSnap.docs.forEach(d => {
                const f = d.data();
                if (f.fecha_registro >= turno.fecha_ingreso) {
                    if (turno.fecha_salida && f.fecha_registro > turno.fecha_salida) return;
                    if (sedeId && f.sede_id !== sedeId) return;
                    total_facturado += parseInt(f.total || 0);
                    facturas.push({
                        codigo: f.codigo_factura || '', habitacion_nombre: f.habitacion_nombre || '',
                        habitacion_numero: String(f.habitacion_numero || ''), tipo_ocupacion: f.tipo_ocupacion || '',
                        total: f.total || 0, metodo_pago: f.metodo_pago || '', referencia_pago: f.referencia_pago || '',
                        fecha_registro: f.fecha_registro, fecha_ingreso_hab: f.fecha_ingreso,
                        fecha_salida_hab: f.fecha_salida, usuario_facturo: f.usuario_facturo || '',
                        usuario_ocupacion: f.usuario_ocupacion || '', sede_nombre: f.sede_nombre || '',
                        sede_ciudad: f.sede_ciudad || '', movimientos: f.movimientos_cuenta || []
                    });
                }
            });

            return {
                success: true, usuario: turno.usuario, sede_nombre, sede_ciudad,
                fecha_ingreso: turno.fecha_ingreso, fecha_salida: turno.fecha_salida,
                activo: turno.activo || false, dinero_base, total_facturado,
                total_caja: dinero_base + total_facturado, facturas
            };
        } catch (e) { return { success: false, mensaje: e.message }; }
    },

    // ── GASTOS POR SEDE ──
    async obtener_gastos_sede(sede_id) {
        try {
            const snap = await getDocs(collection(db, 'gastos_sede'));
            let gastos = serializarDocs(snap);
            if (sede_id) gastos = gastos.filter(g => g.sede_id === sede_id);
            const sedesSnap = await getDocs(collection(db, 'sedes'));
            const sedesMap = {};
            sedesSnap.docs.forEach(d => { sedesMap[d.id] = d.data(); });
            gastos = gastos.map(g => {
                const s = g.sede_id ? sedesMap[g.sede_id] : null;
                g.sede_nombre = s ? `${s.nombre} - ${s.ciudad}` : 'Todas las sedes';
                return g;
            });
            gastos.sort((a, b) => (b.fecha_registro || '').localeCompare(a.fecha_registro || ''));
            return { success: true, gastos };
        } catch (e) { return { success: false, gastos: [], message: e.message }; }
    },

    async crear_gasto_sede(datos) {
        try {
            if (!datos.descripcion || !datos.monto) return { success: false, message: 'Faltan campos requeridos' };
            const base = {
                descripcion: datos.descripcion, monto: parseFloat(datos.monto),
                tipo: datos.tipo || 'unico', categoria: datos.categoria || 'otro',
                notas: datos.notas || '', dia_pago: datos.dia_pago ? parseInt(datos.dia_pago) : null,
                fecha_unico: datos.fecha_unico || null, fecha_registro: now(),
                usuario: _nombreOperador(), _sync_timestamp: now()
            };
            if (datos.sede_id === 'TODAS' || !datos.sede_id) {
                const sedesSnap = await getDocs(collection(db, 'sedes'));
                if (sedesSnap.empty) {
                    await crearDocumento('gastos_sede', { ...base, sede_id: null });
                } else {
                    for (const s of sedesSnap.docs) await crearDocumento('gastos_sede', { ...base, sede_id: s.id });
                }
                return { success: true, message: 'Gasto registrado en todas las sedes' };
            }
            await crearDocumento('gastos_sede', { ...base, sede_id: datos.sede_id });
            return { success: true, message: 'Gasto registrado correctamente' };
        } catch (e) { return { success: false, message: e.message }; }
    },

    async actualizar_gasto_sede(gasto_id, datos) {
        try {
            await updateDoc(doc(db, 'gastos_sede', gasto_id), {
                descripcion: datos.descripcion, monto: parseFloat(datos.monto),
                tipo: datos.tipo || 'unico', sede_id: datos.sede_id,
                categoria: datos.categoria || 'otro', notas: datos.notas || '',
                dia_pago: datos.dia_pago ? parseInt(datos.dia_pago) : null,
                fecha_unico: datos.fecha_unico || null, _sync_timestamp: now()
            });
            return { success: true, message: 'Gasto actualizado correctamente' };
        } catch (e) { return { success: false, message: e.message }; }
    },

    async eliminar_gasto_sede(gasto_id) {
        try {
            await deleteDoc(doc(db, 'gastos_sede', gasto_id));
            return { success: true, message: 'Gasto eliminado correctamente' };
        } catch (e) { return { success: false, message: e.message }; }
    },

    // ── TIEMPO LIMPIEZA ──
    async obtener_tiempo_limpieza(sede_id) {
        try {
            if (sede_id) {
                const d = await getDoc(doc(db, 'sedes', sede_id));
                if (d.exists() && d.data().tiempo_limpieza != null) return { success: true, minutos: parseInt(d.data().tiempo_limpieza) };
            }
            return { success: true, minutos: 15 };
        } catch { return { success: true, minutos: 15 }; }
    },

    async guardar_tiempo_limpieza(minutos, sede_id) {
        try {
            minutos = parseInt(minutos);
            if (minutos < 1) return { success: false, message: "El tiempo debe ser al menos 1 minuto" };
            if (sede_id) await updateDoc(doc(db, 'sedes', sede_id), { tiempo_limpieza: minutos, _sync_timestamp: now() });
            return { success: true, message: `Tiempo de limpieza actualizado a ${minutos} minutos` };
        } catch (e) { return { success: false, message: e.message }; }
    },

    // ── TARIFAS ──
    async obtener_tarifas() {
        try {
            const snap = await getDocs(collection(db, 'tarifas'));
            const tarifas = serializarDocs(snap);
            const sedesSnap = await getDocs(collection(db, 'sedes'));
            const sedesMap = {};
            sedesSnap.docs.forEach(d => { sedesMap[d.id] = d.data(); });
            const result = tarifas.map(t => {
                const s = t.sede_id && t.sede_id !== 'TODAS' ? sedesMap[t.sede_id] : null;
                return { ...t, sede_nombre: s ? `${s.nombre} - ${s.ciudad}` : 'Todas las sedes' };
            });
            return { success: true, tarifas: result };
        } catch (e) {
            console.error('Error tarifas:', e);
            return { success: false, tarifas: [] };
        }
    },

    async crear_tarifa(datos) {
        try {
            const nuevo = { ...datos, activa: true, fecha_creacion: now(), _sync_timestamp: now() };
            delete nuevo._id;
            await crearDocumento('tarifas', nuevo);
            return { success: true, message: "Tarifa creada correctamente" };
        } catch (e) {
            return { success: false, message: `Error al crear la tarifa: ${e.message}` };
        }
    },

    async actualizar_tarifa(tarifa_id, datos) {
        try {
            const upd = { ...datos, _sync_timestamp: now() };
            delete upd._id;
            await updateDoc(doc(db, 'tarifas', tarifa_id), upd);
            return { success: true, message: "Tarifa actualizada correctamente" };
        } catch (e) {
            return { success: false, message: `Error al actualizar la tarifa: ${e.message}` };
        }
    },

    async eliminar_tarifa(tarifa_id) {
        try {
            await deleteDoc(doc(db, 'tarifas', tarifa_id));
            return { success: true, message: "Tarifa eliminada correctamente" };
        } catch (e) {
            return { success: false, message: "Error al eliminar la tarifa" };
        }
    },

    async toggle_tarifa(tarifa_id, activar) {
        try {
            await updateDoc(doc(db, 'tarifas', tarifa_id), { activa: activar, _sync_timestamp: now() });
            return { success: true, message: activar ? "Tarifa activada" : "Tarifa desactivada" };
        } catch (e) {
            return { success: false, message: "Error al cambiar estado de la tarifa" };
        }
    },

    // ── ZOOM (localStorage) ──
    guardar_zoom(nivel) { localStorage.setItem('zoom_config', JSON.stringify({ zoom: nivel })); },
    async cargar_zoom() {
        try { const d = JSON.parse(localStorage.getItem('zoom_config') || '{}'); return d.zoom || 1; } catch { return 1; }
    },
};

// ══════════════════════════════════════════════════════════════
// Expose API globally + pywebview compatibility shim
// ══════════════════════════════════════════════════════════════
window.api = api;
window.pywebview = { api };
window.__firebaseReady = true;

// Dispatch pywebviewready so existing code that waits for it works
setTimeout(() => {
    window.dispatchEvent(new Event('pywebviewready'));
}, 0);

export { api, db };
