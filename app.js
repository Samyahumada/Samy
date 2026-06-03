/* app.js - Directorio Derecho con Motor PDF.js de Mozilla Incorporado */

const SUPABASE_URL = "https://xcvanscqhnmnjmdesprh.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjdmFuc2NxaG5tbmptZGVzcHJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNjQzMTQsImV4cCI6MjA5NTk0MDMxNH0.QJye5J92CbWDYF35D_o-AzyDOsqFLiOnWJX5hrg2AQY";

const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

let miSupabase = null; 
let listaSemestres = [];
let idSemestreActivo = null;
let usuarioLogueado = null;

// Callback en espera de respuesta para la ventana modal de confirmación
let resolverConfirmacionGlobal = null;

window.onload = async function() {
    
    try {
        miSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("Supabase conectado.");
    } catch (e) {
        console.error("Error al inicializar Supabase:", e);
        return;
    }

    // Nodos de la Interfaz
    const gatekeeper = document.getElementById("gatekeeper");
    const gatekeeperForm = document.getElementById("gatekeeperForm");
    const gatekeeperPassword = document.getElementById("gatekeeperPassword");
    const semestersContainer = document.getElementById("semesters-container");
    const accordionContainer = document.getElementById("subjects-accordion-container");
    const currentTitle = document.getElementById("current-selection-title");
    const searchBar = document.getElementById("searchBar");
    const loginBtn = document.getElementById("loginBtn");
    const adminNewSemesterBtn = document.getElementById("adminNewSemesterBtn");

    // Modales Administrativos
    const adminStructureModal = document.getElementById("adminStructureModal");
    const closeAdminStructBtn = document.getElementById("closeAdminStructBtn");
    const adminUploadModal = document.getElementById("adminUploadModal");
    const closeUploadModalBtn = document.getElementById("closeUploadModalBtn");
    const loginModal = document.getElementById("loginModal");
    const closeLoginModalBtn = document.getElementById("closeLoginModalBtn");
    const loginForm = document.getElementById("loginForm");
    const adminSemestersList = document.getElementById("admin-semesters-list");

    // Modal de Visualización Segura
    const viewModal = document.getElementById("viewModal");
    const closeViewModalBtn = document.getElementById("closeViewModalBtn");
    const pdfContainer = document.getElementById("pdfContainer");
    const iframeShield = document.getElementById("iframeShield");
    const modalTitle = document.getElementById("modal-title");

    // Modal de Confirmación Estilizado
    const confirmModal = document.getElementById("confirmModal");
    const confirmModalMessage = document.getElementById("confirmModalMessage");
    const confirmCancelBtn = document.getElementById("confirmCancelBtn");
    const confirmAcceptBtn = document.getElementById("confirmAcceptBtn");

    // Formularios
    const addSemesterForm = document.getElementById("addSemesterForm");
    const addSubjectForm = document.getElementById("addSubjectForm");
    const uploadForm = document.getElementById("uploadForm");
    const changeAccessPasswordForm = document.getElementById("changeAccessPasswordForm");
    const selectSemesterForSubject = document.getElementById("selectSemesterForSubject");
    const selectSubjectForFile = document.getElementById("selectSubjectForFile");
    
    const inputFile = document.getElementById("inputFile");
    const fileNameDisplay = document.getElementById("file-name-display");

    // ==========================================
    // 🔒 MOTOR DE CONFIRMACIÓN ESTILIZADO (MÓDULO NUEVO)
    // ==========================================
    function solicitarConfirmacionVisual(mensaje) {
        confirmModalMessage.textContent = mensaje;
        confirmModal.style.display = "flex";
        
        return new Promise((resolve) => {
            resolverConfirmacionGlobal = resolve;
        });
    }

    confirmCancelBtn.onclick = function() {
        confirmModal.style.display = "none";
        if (resolverConfirmacionGlobal) resolverConfirmacionGlobal(false);
    };

    confirmAcceptBtn.onclick = function() {
        confirmModal.style.display = "none";
        if (resolverConfirmacionGlobal) resolverConfirmacionGlobal(true);
    };

    // ==========================================
    // 🔒 GATEKEEPER DE ENTRADA
    // ==========================================
    if (sessionStorage.getItem("unidocs_permitido") === "true") {
        gatekeeper.style.display = "none"; 
    }

    gatekeeperForm.onsubmit = async function(e) {
        e.preventDefault();
        const inputClave = gatekeeperPassword.value.trim();
        const btnEntrar = gatekeeperForm.querySelector("button");
        const txtError = document.getElementById("gatekeeperError");

        txtError.style.display = "none";
        btnEntrar.textContent = "Verificando...";
        btnEntrar.disabled = true;

        try {
            const { data, error } = await miSupabase
                .from('acceso_sistema')
                .select('password_general')
                .eq('id', 'config_global');

            if (error) throw error;

            if (data && data.length > 0 && inputClave === data[0].password_general) {
                sessionStorage.setItem("unidocs_permitido", "true");
                gatekeeper.style.display = "none";
            } else {
                txtError.style.display = "block";
            }
        } catch (err) {
            console.error("Error perimetral:", err.message);
            alert("Error de comunicación con el servidor.");
        } finally {
            btnEntrar.textContent = "Entrar al Repositorio";
            btnEntrar.disabled = false;
        }
    };

    // Aperturas básicas
    adminNewSemesterBtn.onclick = () => {
        adminStructureModal.style.display = "flex";
        renderizarListaSemestresAdmin();
    };
    closeAdminStructBtn.onclick = () => adminStructureModal.style.display = "none";
    
    closeUploadModalBtn.onclick = () => {
        adminUploadModal.style.display = "none";
        uploadForm.reset();
        if (fileNameDisplay) fileNameDisplay.textContent = "";
    };
    
    closeViewModalBtn.onclick = () => { 
        viewModal.style.display = "none"; 
        pdfContainer.innerHTML = ""; 
    };

    if (inputFile && fileNameDisplay) {
        inputFile.onchange = function() {
            if (inputFile.files.length > 0) {
                fileNameDisplay.textContent = `Seleccionado: ${inputFile.files[0].name}`;
            } else {
                fileNameDisplay.textContent = "";
            }
        };
    }

    iframeShield.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', function(e) {
        if (viewModal.style.display === "flex") {
            if ((e.ctrlKey && (e.key === 's' || e.key === 'p' || e.key === 'u')) || e.key === 'F12') {
                e.preventDefault();
            }
        }
    });

    // ==========================================
    // 🔄 CONTROL DE FLUJO Y RENDER
    // ==========================================
    async function inicializarEstructura() {
        if (!miSupabase) return;
        try {
            const { data: semestres, error } = await miSupabase.from('semestres').select('*').order('nombre', { ascending: true });
            if (error) throw error;

            listaSemestres = semestres || [];
            semestersContainer.innerHTML = "";
            selectSemesterForSubject.innerHTML = '<option value="">-- Selecciona el Semestre --</option>';

            if (listaSemestres.length > 0) {
                if (!idSemestreActivo || !listaSemestres.some(s => s.id === idSemestreActivo)) {
                    idSemestreActivo = listaSemestres[0].id;
                }

                listaSemestres.forEach((sem) => {
                    const boton = document.createElement("button");
                    boton.className = `semester-btn ${sem.id === idSemestreActivo ? 'active' : ''}`;
                    boton.textContent = sem.nombre;
                    boton.onclick = () => {
                        document.querySelectorAll(".semester-btn").forEach(b => b.classList.remove("active"));
                        boton.classList.add("active");
                        idSemestreActivo = sem.id;
                        cargarMateriasYArchivos();
                    };
                    semestersContainer.appendChild(boton);
                    selectSemesterForSubject.innerHTML += `<option value="${sem.id}">${sem.nombre}</option>`;
                });
            } else {
                idSemestreActivo = null;
            }
            cargarMateriasYArchivos();
        } catch (err) { console.error(err.message); }
    }

    function renderizarListaSemestresAdmin() {
        if (!adminSemestersList) return;
        adminSemestersList.innerHTML = "";
        if (listaSemestres.length === 0) {
            adminSemestersList.innerHTML = "<p style='font-size:12px; opacity:0.5; color: var(--bisque);'>No hay semestres registrados.</p>";
            return;
        }
        listaSemestres.forEach(sem => {
            const item = document.createElement("div");
            item.style = "display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:8px 12px; border-radius:6px; font-size:13px; margin-bottom: 4px; border: 1px solid rgba(149, 118, 98, 0.15);";
            item.innerHTML = `
                <span style="color: var(--text-light); font-weight: 500;">${sem.nombre}</span>
                <span class="delete-semester-trigger" data-id="${sem.id}" data-name="${sem.nombre}" style="cursor:pointer;" title="Eliminar semestre">🗑️</span>
            `;
            adminSemestersList.appendChild(item);
        });

        adminSemestersList.querySelectorAll(".delete-semester-trigger").forEach(btn => {
            btn.onclick = (e) => borrarSemestre(e.target.getAttribute("data-id"), e.target.getAttribute("data-name"));
        });
    }

    async function cargarMateriasYArchivos() {
        if (!idSemestreActivo || !miSupabase) {
            accordionContainer.innerHTML = "<p style='opacity:0.6;'>Selecciona o crea un semestre para desplegar materias.</p>";
            currentTitle.textContent = "Materias";
            return;
        }

        const semSeleccionado = listaSemestres.find(s => s.id === idSemestreActivo);
        currentTitle.textContent = semSeleccionado ? `Asignaturas: ${semSeleccionado.nombre}` : "Materias";
        accordionContainer.innerHTML = "<p style='color: var(--chambray);'>Consultando repositorio...</p>";

        try {
            const { data: materias, error: errMat } = await miSupabase.from('materias').select('*').eq('semestre_id', idSemestreActivo);
            if (errMat) throw errMat;

            if (!materias || materias.length === 0) {
                accordionContainer.innerHTML = "<p style='opacity:0.6;'>No hay asignaturas en este bloque.</p>";
                return;
            }

            const { data: todosLosArchivos, error: errDocs } = await miSupabase.from('documentos').select('*');
            if (errDocs) throw errDocs;

            accordionContainer.innerHTML = "";

            for (const mat of materias) {
                const archivos = todosLosArchivos ? todosLosArchivos.filter(f => f.materia_id === mat.id) : [];

                const accionesMateriaAdmin = usuarioLogueado 
                    ? `<div style="display:flex; gap:12px; align-items:center;">
                        <label for="inputFile" class="admin-action-btn open-upload-trigger" data-matid="${mat.id}" style="font-size:11px; padding:4px 8px; cursor:pointer; display:inline-block;">➕ Archivo</label>
                        <span class="delete-subject-trigger" data-id="${mat.id}" data-name="${mat.nombre}" style="cursor:pointer; font-size:15px;" title="Eliminar Materia">🗑️</span>
                       </div>`
                    : '';

                const tarjetaMateria = document.createElement("div");
                tarjetaMateria.className = "subject-card";
                tarjetaMateria.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(149, 118, 98, 0.15); padding-bottom:5px;">
                        <h3>${mat.nombre}</h3>
                        ${accionesMateriaAdmin}
                    </div>`;

                const listaPdf = document.createElement("ul");
                listaPdf.className = "pdf-list";

                if (archivos && archivos.length > 0) {
                    archivos.forEach(file => {
                        const accionesAdmin = usuarioLogueado 
                            ? `<a href="${file.url_archivo}" download="${file.nombre_archivo}" target="_blank" class="view-link" style="background-color: var(--clay); color: white; text-decoration: none; margin-right: 5px;">Descargar</a>
                               <span class="delete-btn" data-id="${file.id}" data-name="${file.nombre_archivo}" data-url="${file.url_archivo}" title="Eliminar respaldo">🗑️</span>` 
                            : '';

                        listaPdf.innerHTML += `
                            <li class="pdf-item">
                                <span>📄 ${file.nombre_archivo}</span>
                                <div style="display: flex; align-items: center;">
                                    <span class="view-link view-pdf-trigger" data-url="${file.url_archivo}" data-nom="${file.nombre_archivo}">Ver</span>
                                    ${accionesAdmin}
                                </div>
                            </li>`;
                    });
                } else {
                    listaPdf.innerHTML = "<li class='pdf-item' style='font-style: italic; opacity: 0.6; border:none;'>Sin archivos adjuntos</li>";
                }

                tarjetaMateria.appendChild(listaPdf);
                accordionContainer.appendChild(tarjetaMateria);
            }

            if (usuarioLogueado) {
                accordionContainer.querySelectorAll(".open-upload-trigger").forEach(labelTrigger => {
                    labelTrigger.onclick = (e) => {
                        selectSubjectForFile.value = e.target.getAttribute("data-matid");
                        if (fileNameDisplay) fileNameDisplay.textContent = "";
                        adminUploadModal.style.display = "flex";
                    };
                });
                accordionContainer.querySelectorAll(".delete-subject-trigger").forEach(btn => {
                    btn.onclick = (e) => borrarMateria(e.target.getAttribute("data-id"), e.target.getAttribute("data-name"));
                });
            }

            // ==================================================================
            // 🔥 DETONADOR DEL MOTOR RENDEREADOR CANVAS
            // ==================================================================
            accordionContainer.querySelectorAll(".view-pdf-trigger").forEach(lnk => {
                lnk.onclick = async (e) => {
                    const urlArchivo = e.target.getAttribute("data-url");
                    const nombreArchivo = e.target.getAttribute("data-nom");

                    modalTitle.textContent = nombreArchivo;
                    pdfContainer.innerHTML = "<p style='color:white; padding:20px; font-weight:bold;'>Abriendo canal seguro y procesando páginas...</p>";
                    viewModal.style.display = "flex";

                    const modalBody = document.querySelector("#viewModal .modal-body");
                    if (modalBody) modalBody.scrollTop = 0;

                    try {
                        const loadingTask = pdfjsLib.getDocument(urlArchivo);
                        const pdf = await loadingTask.promise;
                        
                        pdfContainer.innerHTML = ""; 

                        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                            const page = await pdf.getPage(pageNum);
                            const viewport = page.getViewport({ scale: 1.5 });

                            const canvas = document.createElement('canvas');
                            const context = canvas.getContext('2d');
                            canvas.height = viewport.height;
                            canvas.width = viewport.width;

                            const renderContext = {
                                canvasContext: context,
                                viewport: viewport
                            };

                            pdfContainer.appendChild(canvas);
                            await page.render(renderContext).promise;
                        }
                    } catch (pdfError) {
                        console.error("Error al procesar el PDF con Canvas:", pdfError);
                        pdfContainer.innerHTML = "<p style='color:#ff5c5c; padding:20px;'>Error: El archivo no es compatible o el servidor bloqueó el origen (CORS).</p>";
                    }
                };
            });

            accordionContainer.querySelectorAll(".delete-btn").forEach(btn => {
                btn.onclick = (e) => borrarDocumento(e.target.getAttribute("data-id"), e.target.getAttribute("data-name"), e.target.getAttribute("data-url"));
            });

        } catch (err) { console.error(err); }
    }

    async function actualizarSelectoresAdmin() {
        if (!usuarioLogueado || !miSupabase) return;
        try {
            const { data: todasLasMaterias } = await miSupabase.from('materias').select('*').order('nombre', { ascending: true });
            selectSubjectForFile.innerHTML = '<option value="">-- Selecciona la materia --</option>';
            if (todasLasMaterias) {
                todasLasMaterias.forEach(m => {
                    selectSubjectForFile.innerHTML += `<option value="${m.id}">${m.nombre}</option>`;
                });
            }
        } catch (e) { console.log(e); }
    }

    // Formularios de Creación
    addSemesterForm.onsubmit = async function(e) {
        e.preventDefault();
        const nom = document.getElementById("newSemesterName").value.trim();
        try {
            const { error } = await miSupabase.from('semestres').insert([{ nombre: nom }]);
            if (error) throw error;
            addSemesterForm.reset();
            await inicializarEstructura();
            renderizarListaSemestresAdmin();
        } catch (err) { alert(err.message); }
    };

    addSubjectForm.onsubmit = async function(e) {
        e.preventDefault();
        const semId = selectSemesterForSubject.value;
        const nombreMat = document.getElementById("newSubjectName").value.trim();
        try {
            const { error } = await miSupabase.from('materias').insert([{ nombre: nombreMat, semestre_id: semId }]);
            if (error) throw error;
            addSubjectForm.reset();
            adminStructureModal.style.display = "none";
            await cargarMateriasYArchivos();
            await actualizarSelectoresAdmin();
        } catch (err) { alert(err.message); }
    };

    uploadForm.onsubmit = async function(e) {
        e.preventDefault();
        const matId = selectSubjectForFile.value;
        const file = inputFile.files[0];
        const btn = document.getElementById("submitUploadBtn");

        if (!file) return;
        btn.textContent = "Subiendo archivo...";
        btn.disabled = true;

        try {
            const nombreSeguro = file.name
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "") 
                .replace(/[^a-zA-Z0-9._-]/g, "_"); 

            const pathLimpio = `${Date.now()}_${nombreSeguro}`;
            
            const { error: storageErr } = await miSupabase.storage.from('pdfs-universidad').upload(pathLimpio, file);
            if (storageErr) throw storageErr;

            const { data: urlData } = miSupabase.storage.from('pdfs-universidad').getPublicUrl(pathLimpio);
            
            const { error: dbErr } = await miSupabase.from('documentos').insert([{
                nombre_archivo: file.name,
                url_archivo: urlData.publicUrl,
                materia_id: matId
            }]);
            if (dbErr) throw dbErr;

            uploadForm.reset();
            if (fileNameDisplay) fileNameDisplay.textContent = "";
            adminUploadModal.style.display = "none";
            await cargarMateriasYArchivos();
            alert("¡Documento guardado!");
        } catch (err) { alert("Error de Transferencia: " + err.message); } 
        finally { btn.textContent = "Subir a la Nube"; btn.disabled = false; }
    };

    changeAccessPasswordForm.onsubmit = async function(e) {
        e.preventDefault();
        const nuevaClave = document.getElementById("newAccessPassword").value.trim();
        const btnPass = document.getElementById("submitChangePassBtn");
        btnPass.textContent = "Actualizando...";
        try {
            const { error } = await miSupabase.from('acceso_sistema').update({ password_general: nuevaClave }).eq('id', 'config_global');
            if (error) throw error;
            alert("Contraseña modificada.");
            changeAccessPasswordForm.reset();
            adminStructureModal.style.display = "none";
        } catch(err) { alert(err.message); } 
        finally { btnPass.textContent = "Actualizar Clave"; }
    };

    // Buscador
    searchBar.oninput = function(e) {
        const query = e.target.value.toLowerCase().trim();
        const tarjetas = accordionContainer.querySelectorAll(".subject-card");
        tarjetas.forEach(tarjeta => {
            const nombreMateria = tarjeta.querySelector("h3").textContent.toLowerCase();
            const itemsArchivo = tarjeta.querySelectorAll(".pdf-item");
            let algunaCoincidencia = nombreMateria.includes(query);

            itemsArchivo.forEach(item => {
                const nombreArchivo = item.querySelector("span").textContent.toLowerCase();
                if (nombreArchivo.includes(query)) {
                    item.style.display = "flex";
                    algunaCoincidencia = true;
                } else { item.style.display = "none"; }
            });
            tarjeta.style.display = algunaCoincidencia ? "flex" : "none";
        });
    };

    // ==========================================
    // 🗑️ FUNCIONES DE ELIMINACIÓN CON CONFIRMACIÓN
    // ==========================================
    async function borrarSemestre(id, nombre) {
    const confirmado = await solicitarConfirmacionVisual(`¿Estás completamente seguro de eliminar el "${nombre}"? Esta acción removerá todas sus materias y documentos en cascada.`);
    if (!confirmado) return;

    try {
        const { error } = await miSupabase.from('semestres').delete().eq('id', id);
        if (error) throw error; // <--- Importante para saltar al catch si Supabase lo rechaza
        
        if (idSemestreActivo === id) idSemestreActivo = null;
        
        await inicializarEstructura();
        renderizarListaSemestresAdmin();
        alert(`Semestre "${nombre}" eliminado con éxito.`);
    } catch (err) { 
        console.error(err);
        alert("No se pudo borrar el semestre: " + err.message); 
    }
}

    async function borrarMateria(id, nombre) {
    const confirmado = await solicitarConfirmacionVisual(`¿Deseas eliminar permanentemente la materia "${nombre}" y todos sus respaldos adjuntos?`);
    if (!confirmado) return;

    try {
        // Añadimos { count: 'exact' } para ver cuántas filas se borraron en verdad
        const { data, error, count } = await miSupabase
            .from('materias')
            .delete({ count: 'exact' }) 
            .eq('id', id);
        
        if (error) throw error;

        console.log("Filas afectadas:", count);

        if (count === 0) {
            alert(`La base de datos rechazó el borrado. Esto suele ser por políticas RLS activadas en Supabase o porque el ID (${id}) no existe.`);
            return;
        }
        
        await cargarMateriasYArchivos();
        await actualizarSelectoresAdmin();
        alert(`Materia "${nombre}" eliminada con éxito.`);
    } catch (err) { 
        console.error("Error capturado:", err);
        alert("Error al borrar materia: " + err.message); 
    }
}

    async function borrarDocumento(id, nombre, url) {
        const confirmado = await solicitarConfirmacionVisual(`¿Eliminar el archivo "${nombre}" de la base de datos y del almacenamiento físico en la nube?`);
        if (!confirmado) return;

        try {
            const nombreEnStorage = url.split('/').pop();
            await miSupabase.storage.from('pdfs-universidad').remove([nombreEnStorage]);
            await miSupabase.from('documentos').delete().eq('id', id);
            await cargarMateriasYArchivos();
        } catch (err) { console.error(err); }
    }

    // Auth Admin
    loginBtn.onclick = async function() {
        if (usuarioLogueado) {
            if (miSupabase) await miSupabase.auth.signOut();
            usuarioLogueado = null;
            loginBtn.textContent = "Iniciar Sesión (Admin)";
            adminNewSemesterBtn.style.display = "none";
            await cargarMateriasYArchivos();
            alert("Sesión cerrada.");
        } else { loginModal.style.display = "flex"; }
    };

    loginForm.onsubmit = async function(e) {
        e.preventDefault();
        const email = document.getElementById("loginEmail").value;
        const password = document.getElementById("loginPassword").value;
        try {
            const { data, error } = await miSupabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            usuarioLogueado = data.user;
            loginBtn.textContent = "Cerrar Sesión";
            adminNewSemesterBtn.style.display = "block";
            loginModal.style.display = "none";
            loginForm.reset();
            await cargarMateriasYArchivos();
            await actualizarSelectoresAdmin();
        } catch (err) { alert("Error: " + err.message); }
    };

    async function validarPersistencia() {
        if (!miSupabase) return;
        const { data: { session } } = await miSupabase.auth.getSession();
        if (session?.user) {
            usuarioLogueado = session.user;
            loginBtn.textContent = "Cerrar Sesión";
            adminNewSemesterBtn.style.display = "block";
            await actualizarSelectoresAdmin();
        }
    }

    closeLoginModalBtn.onclick = () => loginModal.style.display = "none";
    window.onclick = (e) => {
        if (e.target === loginModal) loginModal.style.display = "none";
        if (e.target === adminStructureModal) adminStructureModal.style.display = "none";
        if (e.target === adminUploadModal) {
            adminUploadModal.style.display = "none";
            uploadForm.reset();
            if (fileNameDisplay) fileNameDisplay.textContent = "";
        }
        if (e.target === viewModal) { viewModal.style.display = "none"; pdfContainer.innerHTML = ""; }
    };

    await validarPersistencia();
    await inicializarEstructura();
};
