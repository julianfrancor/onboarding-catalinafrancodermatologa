// ============================================================
// CONFIGURACIÓN - Reemplazar con la URL de tu Google Apps Script
// ============================================================
const APPS_SCRIPT_URL = 'TU_URL_DE_APPS_SCRIPT_AQUI';
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('onboardingForm');
    const submitBtn = document.getElementById('submitBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');

    const uploadedFiles = { fotos: [], documentos: [] };

    // --- File Upload ---
    setupFileUpload('fotos', 'fotosUploadArea', 'fotosPreview', 5);
    setupFileUpload('documentos', 'documentosUploadArea', 'documentosPreview', 10);

    function setupFileUpload(inputId, areaId, previewId, maxFiles) {
        const input = document.getElementById(inputId);
        const area = document.getElementById(areaId);
        const preview = document.getElementById(previewId);

        area.addEventListener('dragover', (e) => {
            e.preventDefault();
            area.classList.add('dragover');
        });

        area.addEventListener('dragleave', () => {
            area.classList.remove('dragover');
        });

        area.addEventListener('drop', (e) => {
            e.preventDefault();
            area.classList.remove('dragover');
            handleFiles(e.dataTransfer.files, inputId, preview, maxFiles);
        });

        input.addEventListener('change', () => {
            handleFiles(input.files, inputId, preview, maxFiles);
            input.value = '';
        });
    }

    function handleFiles(fileList, type, previewContainer, maxFiles) {
        const files = Array.from(fileList);

        for (const file of files) {
            if (uploadedFiles[type].length >= maxFiles) {
                alert(`Máximo ${maxFiles} archivos permitidos.`);
                break;
            }
            if (file.size > 10 * 1024 * 1024) {
                alert(`"${file.name}" excede el límite de 10MB.`);
                continue;
            }
            uploadedFiles[type].push(file);
            addPreviewItem(file, type, previewContainer);
        }
    }

    function addPreviewItem(file, type, container) {
        const item = document.createElement('div');
        item.className = 'file-preview-item';
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        const icon = file.type.startsWith('image/') ? '🖼️' : '📄';

        item.innerHTML = `
            ${icon}
            <span class="file-name" title="${file.name}">${file.name}</span>
            <span class="file-size">${sizeMB}MB</span>
            <button type="button" class="remove-file" title="Eliminar">×</button>
        `;

        item.querySelector('.remove-file').addEventListener('click', () => {
            const idx = uploadedFiles[type].indexOf(file);
            if (idx > -1) uploadedFiles[type].splice(idx, 1);
            item.remove();
        });

        container.appendChild(item);
    }

    // --- Helpers ---
    function filesToBase64(files) {
        return Promise.all(files.map(file => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve({
                    name: file.name,
                    type: file.type,
                    data: reader.result.split(',')[1]
                });
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }));
    }

    function setLoading(loading) {
        submitBtn.disabled = loading;
        btnText.style.display = loading ? 'none' : 'inline';
        btnLoading.style.display = loading ? 'inline-flex' : 'none';
    }

    // --- Validation ---
    function validateForm() {
        let valid = true;
        const required = form.querySelectorAll('[required]');

        required.forEach(field => {
            field.classList.remove('invalid');
            if (field.type === 'checkbox') {
                const box = field.closest('.consent-box');
                if (!field.checked) {
                    valid = false;
                    box.style.outline = '2px solid var(--error)';
                    box.style.outlineOffset = '4px';
                } else {
                    box.style.outline = 'none';
                }
            } else if (!field.value.trim()) {
                valid = false;
                field.classList.add('invalid');
            }
        });

        const email = document.getElementById('email');
        if (email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
            email.classList.add('invalid');
            valid = false;
        }

        if (!valid) {
            const firstInvalid = form.querySelector('.invalid, .consent-box[style*="outline: 2px"]');
            if (firstInvalid) {
                firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        return valid;
    }

    // --- Submit ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        setLoading(true);

        try {
            const fields = [
                'tipoDocumento', 'numeroDocumento', 'nombres', 'apellidos',
                'fechaNacimiento', 'genero', 'telefono', 'email',
                'direccion', 'ciudad', 'eps', 'motivoConsulta',
                'antecedentes', 'antecedentesFamiliares'
            ];

            const data = {};
            fields.forEach(f => { data[f] = document.getElementById(f).value.trim(); });
            data.fotos = await filesToBase64(uploadedFiles.fotos);
            data.documentos = await filesToBase64(uploadedFiles.documentos);

            const response = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify(data),
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                redirect: 'follow',
            });

            let result;
            try {
                result = await response.json();
            } catch {
                if (response.ok) {
                    result = { status: 'success' };
                } else {
                    throw new Error('Error en la respuesta del servidor');
                }
            }

            if (result.status === 'success' || result.result === 'success') {
                document.getElementById('successModal').style.display = 'flex';
                form.reset();
                uploadedFiles.fotos = [];
                uploadedFiles.documentos = [];
                document.getElementById('fotosPreview').innerHTML = '';
                document.getElementById('documentosPreview').innerHTML = '';
            } else {
                throw new Error(result.message || 'Error al procesar el formulario');
            }
        } catch (error) {
            console.error('Error:', error);
            document.getElementById('errorMessage').textContent =
                error.message || 'Hubo un problema al enviar. Por favor intente nuevamente.';
            document.getElementById('errorModal').style.display = 'flex';
        } finally {
            setLoading(false);
        }
    });
});
