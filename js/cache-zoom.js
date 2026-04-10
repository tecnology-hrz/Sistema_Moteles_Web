/**
 * cache-zoom.js — Persistencia de zoom usando la API de Python (pywebview).
 * Guarda el nivel de zoom en un archivo JSON en disco, así persiste
 * aunque se cierre y reabra la app.
 */
(function () {
    'use strict';

    var zoomNivel = 1;
    var listo = false;

    function aplicarZoom(nivel) {
        document.body.style.zoom = nivel;
        document.body.style.height = (100 / nivel) + 'vh';
        document.body.style.width = (100 / nivel) + 'vw';
    }

    function guardarZoomEnBackend(nivel) {
        if (window.pywebview && window.pywebview.api && window.pywebview.api.guardar_zoom) {
            window.pywebview.api.guardar_zoom(nivel);
        }
    }

    function cargarZoomDesdeBackend() {
        if (window.pywebview && window.pywebview.api && window.pywebview.api.cargar_zoom) {
            window.pywebview.api.cargar_zoom().then(function (nivel) {
                if (nivel && typeof nivel === 'number' && nivel >= 0.3 && nivel <= 3) {
                    zoomNivel = nivel;
                }
                aplicarZoom(zoomNivel);
                listo = true;
            }).catch(function () {
                aplicarZoom(zoomNivel);
                listo = true;
            });
        } else {
            aplicarZoom(zoomNivel);
            listo = true;
        }
    }

    // Esperar a que pywebview esté listo
    if (window.pywebview && window.pywebview.api) {
        cargarZoomDesdeBackend();
    } else {
        window.addEventListener('pywebviewready', function () {
            cargarZoomDesdeBackend();
        });
        // Fallback si el evento no llega
        setTimeout(function () {
            if (!listo) cargarZoomDesdeBackend();
        }, 1500);
    }

    // Ctrl + / Ctrl - / Ctrl 0
    document.addEventListener('keydown', function (e) {
        if (!e.ctrlKey && !e.metaKey) return;

        var cambio = 0;
        if (e.key === '+' || e.key === '=') cambio = 0.1;
        else if (e.key === '-') cambio = -0.1;
        else if (e.key === '0') { zoomNivel = 1; cambio = 0; }
        else return;

        e.preventDefault();
        zoomNivel = Math.round((zoomNivel + cambio) * 100) / 100;
        if (zoomNivel < 0.3) zoomNivel = 0.3;
        if (zoomNivel > 3) zoomNivel = 3;

        aplicarZoom(zoomNivel);
        guardarZoomEnBackend(zoomNivel);
    });

    // Ctrl + rueda del mouse
    document.addEventListener('wheel', function (e) {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();

        var cambio = e.deltaY < 0 ? 0.1 : -0.1;
        zoomNivel = Math.round((zoomNivel + cambio) * 100) / 100;
        if (zoomNivel < 0.3) zoomNivel = 0.3;
        if (zoomNivel > 3) zoomNivel = 3;

        aplicarZoom(zoomNivel);
        guardarZoomEnBackend(zoomNivel);
    }, { passive: false });
})();
