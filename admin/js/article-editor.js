/**
 * Article Editor JavaScript
 * Handles article creation and editing with Quill.js
 */

const _edt = (s) => window.CalcalaSanitize ? window.CalcalaSanitize.escapeHtml(s) : String(s || '');

// EditorJS tool aliases — CDN builds sometimes export under different global names
if (typeof List === 'undefined' && typeof EditorjsList !== 'undefined') {
    window.List = EditorjsList;
}
if (typeof ImageTool === 'undefined' && typeof ImageEditor !== 'undefined') {
    window.ImageTool = ImageEditor;
}
if (typeof RawTool === 'undefined' && typeof RawHTML !== 'undefined') {
    window.RawTool = RawHTML;
}

// Check authentication
// Get article ID from URL
const urlParams = new URLSearchParams(window.location.search);
const articleId = urlParams.get('id');
// isNewArticle is true when there is no id param (null), it's empty, or explicitly 'new'
const isNewArticle = !articleId || articleId === '' || articleId === 'new';

// Handle Editor Image Upload
async function handleEditorImageUpload(file) {
    try {
        const options = {
            maxSizeMB: 0.5,
            maxWidthOrHeight: 1200,
            useWebWorker: true,
            fileType: 'image/jpeg'
        };
        let fileToUpload = file;
        try {
            if (window.imageCompression) {
                fileToUpload = await imageCompression(file, options);
            }
        } catch (e) {
            console.warn('Compression failed for editor image', e);
        }

        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 8);
        const fileExt = fileToUpload.name ? fileToUpload.name.split('.').pop() : 'jpg';
        const fileName = `article-block-${timestamp}-${randomString}.${fileExt}`;

        const { error } = await supabaseClient.storage
            .from('article-images')
            .upload(fileName, fileToUpload, { cacheControl: '3600', upsert: false });

        if (error) throw error;

        const { data: { publicUrl } } = supabaseClient.storage.from('article-images').getPublicUrl(fileName);

        return {
            success: 1,
            file: { url: publicUrl }
        };
    } catch (err) {
        console.error('Editor image upload failed', err);
        window.authUtils?.showError('שגיאה בהעלאת תמונה לעורך');
        return { success: 0 };
    }
}

// Initialize Editor.js
const editor = new EditorJS({
    holder: 'editor',
    placeholder: 'התחל לכתוב את המאמר...',
    tools: {
        header: {
            class: Header,
            config: { levels: [2, 3, 4], defaultLevel: 2 }
        },
        list: {
            class: List,
            inlineToolbar: true,
        },
        image: {
            class: ImageTool,
            config: {
                uploader: {
                    uploadByFile(file) {
                        return handleEditorImageUpload(file);
                    },
                    uploadByUrl(url) {
                        return new Promise((resolve) => {
                            resolve({ success: 1, file: { url } });
                        });
                    }
                }
            }
        },
        quote: Quote,
        marker: Marker,
        embed: Embed,
        raw: RawTool,
        quiz: {
            class: QuizBlock,
            shortcut: 'CMD+SHIFT+Q'
        },
        leadForm: {
            class: LeadFormBlock,
            shortcut: 'CMD+SHIFT+L'
        }
    },
    i18n: {
        direction: 'rtl',
    }
});

// State
let currentArticle = null;
let categories = [];
let tags = [];
let selectedTags = [];
let autoSaveInterval = null;

// DOM Elements
const hamburgerBtn = document.getElementById('hamburgerBtn');
const sidebar = document.getElementById('sidebar');
const pageTitle = document.getElementById('pageTitle');
const articleForm = document.getElementById('articleForm');
const titleInput = document.getElementById('title');
const slugInput = document.getElementById('slug');
const uploadZone = document.getElementById('uploadZone');
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const previewImg = document.getElementById('previewImg');
const uploadProgress = document.getElementById('uploadProgress');
const uploadProgressFill = document.getElementById('uploadProgressFill');
const featuredImageUrl = document.getElementById('featuredImageUrl');
const categorySelect = document.getElementById('category');
const tagsSelect = document.getElementById('tags');
const selectedTagsContainer = document.getElementById('selectedTags');
const metaDescription = document.getElementById('metaDescription');
const charCounter = document.getElementById('charCounter');
const statusToggle = document.getElementById('statusToggle');
const statusLabel = document.getElementById('statusLabel');
const publishBtn = document.getElementById('publishBtn');
const publishBtnText = document.getElementById('publishBtnText');
const publishSpinner = document.getElementById('publishSpinner');
const autoSaveIndicator = document.getElementById('autoSaveIndicator');

// Hamburger menu toggle
hamburgerBtn.addEventListener('click', () => {
    sidebar.classList.toggle('show-mobile');
});

// Auto-generate slug from title
titleInput.addEventListener('blur', () => {
    // Rely completely on whether the slug is empty and manually edited
    if (!slugInput.dataset.manuallyEdited && titleInput.value && !slugInput.value) {
        const slug = generateSlug(titleInput.value);
        slugInput.value = slug;
    }
});

// Mark slug as manually edited
slugInput.addEventListener('input', () => {
    if (slugInput.value.trim() !== '') {
        slugInput.dataset.manuallyEdited = 'true';
    } else {
        slugInput.dataset.manuallyEdited = ''; // Reset if they clear it
    }
});

// Upload zone handlers for Featured Image
uploadZone.addEventListener('click', (e) => {
    // Prevent triggering if clicked on the remove button or preview
    if (e.target.closest('#imagePreview')) return;
    imageInput.click();
});

uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
});

uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
});

uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        handleImageUpload(file);
    }
});

imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleImageUpload(file);
    }
});

// Character counter for meta description
metaDescription.addEventListener('input', () => {
    const count = metaDescription.value.length;
    charCounter.textContent = `${count} / 160`;

    if (count > 160) {
        charCounter.classList.add('error');
    } else if (count > 140) {
        charCounter.classList.add('warning');
        charCounter.classList.remove('error');
    } else {
        charCounter.classList.remove('warning', 'error');
    }
});

// Status toggle
statusToggle.addEventListener('change', () => {
    statusLabel.textContent = statusToggle.checked ? 'פורסם' : 'טיוטה';
    publishBtnText.textContent = statusToggle.checked ? 'פרסם' : 'שמור טיוטה';
});

// Tags selection
tagsSelect.addEventListener('change', () => {
    const selectedOptions = Array.from(tagsSelect.selectedOptions);
    selectedTags = selectedOptions.map(opt => ({
        id: opt.value,
        name: opt.textContent
    }));
    renderSelectedTags();
});

// Form submission
articleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveArticle(true);
});

// Generate slug from title
function generateSlug(title) {
    if (!title) return '';

    // Hebrew transliteration map (simplified)
    const hebrewToLatin = {
        'א': 'a', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h', 'ו': 'v', 'ז': 'z',
        'ח': 'ch', 'ט': 't', 'י': 'y', 'כ': 'k', 'ך': 'k', 'ל': 'l', 'ם': 'm',
        'מ': 'm', 'ן': 'n', 'נ': 'n', 'ס': 's', 'ע': 'a', 'ף': 'p', 'פ': 'p',
        'ץ': 'tz', 'צ': 'tz', 'ק': 'k', 'ר': 'r', 'ש': 'sh', 'ת': 't'
    };

    let slug = title
        .toLowerCase()
        .split('')
        .map(char => hebrewToLatin[char] || char)
        .join('')
        .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
        .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
        .substring(0, 60); // Limit length

    // Add timestamp to ensure uniqueness
    const timestamp = Date.now().toString().slice(-6);
    slug = `${slug}-${timestamp}`;

    return slug;
}

// Handle image upload
async function handleImageUpload(file) {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        window.authUtils.showError('נא להעלות קובץ תמונה בלבד (JPG, PNG, או WebP)');
        return;
    }

    // Validate file size (max 10MB before compression)
    if (file.size > 10 * 1024 * 1024) {
        window.authUtils.showError('הקובץ גדול מדי. גודל מקסימלי: 10MB');
        return;
    }

    try {
        console.log('Original file size:', (file.size / 1024 / 1024).toFixed(2), 'MB');

        // Show progress
        uploadProgress.classList.remove('hidden');
        uploadProgressFill.style.width = '10%'; // Starting

        // Compress image before upload
        const options = {
            maxSizeMB: 0.5,           // Target: 500KB or less
            maxWidthOrHeight: 1200,   // Max dimension: 1200px
            useWebWorker: true,
            fileType: 'image/jpeg'    // Convert all to JPEG for consistency
        };

        let fileToUpload = file;
        try {
            const compressedFile = await imageCompression(file, options);
            console.log('Compressed file size:', (compressedFile.size / 1024 / 1024).toFixed(2), 'MB');
            fileToUpload = compressedFile;
        } catch (compressionError) {
            console.warn('Compression failed, uploading original:', compressionError);
        }

        uploadProgressFill.style.width = '40%'; // Compression done

        // Generate unique filename
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 8);
        const fileExt = fileToUpload.name ? fileToUpload.name.split('.').pop() : 'jpg';
        const fileName = `article-${timestamp}-${randomString}.${fileExt}`;

        console.log('Uploading image:', fileName);

        // Upload to Supabase Storage
        const { data, error } = await supabaseClient.storage
            .from('article-images')
            .upload(fileName, fileToUpload, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('Upload error:', error);
            window.authUtils.showError('שגיאה בהעלאת התמונה: ' + error.message);
            uploadProgress.classList.add('hidden');
            return;
        }

        uploadProgressFill.style.width = '80%'; // Uploaded

        // Get public URL
        const { data: { publicUrl } } = supabaseClient.storage
            .from('article-images')
            .getPublicUrl(fileName);

        console.log('Image uploaded successfully:', publicUrl);

        // Update UI
        uploadProgressFill.style.width = '100%';
        setTimeout(() => {
            uploadProgress.classList.add('hidden');
            uploadZone.classList.add('hidden');
            imagePreview.classList.remove('hidden');
            previewImg.src = publicUrl;
            featuredImageUrl.value = publicUrl;
        }, 500);

    } catch (error) {
        console.error('Upload exception:', error);
        window.authUtils.showError('שגיאה בהעלאת התמונה');
        uploadProgress.classList.add('hidden');
    }
}

// Remove image
function removeImage() {
    uploadZone.classList.remove('hidden');
    imagePreview.classList.add('hidden');
    previewImg.src = '';
    featuredImageUrl.value = '';
    imageInput.value = '';
}

// Render selected tags
function renderSelectedTags() {
    selectedTagsContainer.innerHTML = selectedTags.map(tag => `
    <div class="tag-chip">
      ${_edt(tag.name)}
      <span class="tag-chip-remove" data-tag-id="${_edt(tag.id)}">×</span>
    </div>
  `).join('');

    // Event delegation for tag removal
    selectedTagsContainer.querySelectorAll('.tag-chip-remove').forEach(el => {
        el.addEventListener('click', () => removeTag(el.dataset.tagId));
    });
}

// Remove tag
function removeTag(tagId) {
    selectedTags = selectedTags.filter(tag => tag.id !== tagId);

    // Update select
    Array.from(tagsSelect.options).forEach(opt => {
        if (opt.value === tagId) {
            opt.selected = false;
        }
    });

    renderSelectedTags();
}

// Load categories
async function loadCategories() {
    try {
        const { data, error } = await supabaseClient
            .from('categories')
            .select('id, name')
            .order('display_order', { ascending: true });

        if (error) throw error;

        categories = data || [];

        categorySelect.innerHTML = '<option value="">בחר קטגוריה</option>' +
            categories.map(cat => `<option value="${_edt(cat.id)}">${_edt(cat.name)}</option>`).join('');

    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// Load quiz options
async function loadQuizOptions() {
    try {
        const { data, error } = await supabaseClient
            .from('quiz_configs')
            .select('id, display_name, vertical_name')
            .eq('is_active', true)
            .order('vertical_name');

        if (error || !data) return;

        const select = document.getElementById('article-quiz-id');
        if (!select) return;

        data.forEach(quiz => {
            const option = document.createElement('option');
            option.value = quiz.id;
            option.textContent = quiz.display_name || quiz.vertical_name;
            select.appendChild(option);
        });
    } catch (err) {
        console.error('Error loading quiz options:', err);
    }
}

// Load tags
async function loadTags() {
    try {
        const { data, error } = await supabaseClient
            .from('tags')
            .select('id, name')
            .order('name', { ascending: true });

        if (error) throw error;

        tags = data || [];

        tagsSelect.innerHTML = tags.map(tag =>
            `<option value="${tag.id}">${tag.name}</option>`
        ).join('');

    } catch (error) {
        console.error('Error loading tags:', error);
    }
}

// Load article (if editing)
async function loadArticle() {
    if (isNewArticle) {
        pageTitle.textContent = 'מאמר חדש';
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('articles')
            .select(`
        *,
        article_tags (
          tag_id,
          tags (
            id,
            name
          )
        )
      `)
            .eq('id', articleId)
            .single();

        if (error) throw error;

        currentArticle = data;
        pageTitle.textContent = 'עריכת מאמר';

        // Populate form
        titleInput.value = data.title || '';
        slugInput.value = data.slug || '';
        slugInput.dataset.manuallyEdited = 'true';
        document.getElementById('author').value = data.author || 'צוות כלכליסט';
        categorySelect.value = data.category_id || '';
        document.getElementById('article-quiz-id').value = data.quiz_id || '';
        metaDescription.value = data.meta_description || '';
        document.getElementById('disclaimer').value = data.disclaimer || '';

        await editor.isReady;
        if (data.body) {
            try {
                const parsedBody = JSON.parse(data.body);
                if (parsedBody && parsedBody.blocks) {
                    await editor.render(parsedBody);
                } else throw new Error();
            } catch (e) {
                await editor.render({ blocks: [{ type: 'raw', data: { html: data.body } }] });
            }
        } else {
            await editor.clear();
        }

        statusToggle.checked = data.status === 'published';
        statusLabel.textContent = data.status === 'published' ? 'פורסם' : 'טיוטה';
        document.getElementById('isFeatured').checked = data.is_featured || false;

        if (data.publish_date) {
            const date = new Date(data.publish_date);
            document.getElementById('publishDate').value = date.toISOString().slice(0, 16);
        }

        if (data.featured_image_url) {
            uploadZone.classList.add('hidden');
            imagePreview.classList.remove('hidden');
            previewImg.src = data.featured_image_url;
            featuredImageUrl.value = data.featured_image_url;
        }

        // Load tags
        if (data.article_tags && data.article_tags.length > 0) {
            selectedTags = data.article_tags.map(at => ({
                id: at.tags.id,
                name: at.tags.name
            }));

            // Select in dropdown
            selectedTags.forEach(tag => {
                Array.from(tagsSelect.options).forEach(opt => {
                    if (opt.value === tag.id) {
                        opt.selected = true;
                    }
                });
            });

            renderSelectedTags();
        }

        // Update char counter
        charCounter.textContent = `${metaDescription.value.length} / 160`;

    } catch (error) {
        console.error('Error loading article:', error, 'articleId:', articleId);
        window.authUtils.showError('שגיאה בטעינת המאמר');
        // Show persistent error so user doesn't see a blank form
        const form = document.getElementById('articleForm');
        if (form) {
            const banner = document.createElement('div');
            banner.className = 'bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded mb-4';
            banner.textContent = 'שגיאה בטעינת המאמר: ' + (error.message || 'בדוק את הקונסול');
            form.prepend(banner);
        }
    }
}

// Validate form
async function validateForm() {
    let isValid = true;

    // Title
    if (!titleInput.value.trim()) {
        document.getElementById('titleError').textContent = 'כותרת היא שדה חובה';
        document.getElementById('titleError').classList.remove('hidden');
        titleInput.classList.add('error');
        isValid = false;
    } else {
        document.getElementById('titleError').classList.add('hidden');
        titleInput.classList.remove('error');
    }

    // Slug
    if (!slugInput.value.trim()) {
        document.getElementById('slugError').textContent = 'Slug הוא שדה חובה';
        document.getElementById('slugError').classList.remove('hidden');
        slugInput.classList.add('error');
        isValid = false;
    } else {
        document.getElementById('slugError').classList.add('hidden');
        slugInput.classList.remove('error');
    }

    // Body
    try {
        const editorData = await editor.save();
        if (!editorData.blocks || editorData.blocks.length === 0) {
            document.getElementById('bodyError').textContent = 'תוכן המאמר הוא שדה חובה';
            document.getElementById('bodyError').classList.remove('hidden');
            isValid = false;
        } else {
            document.getElementById('bodyError').classList.add('hidden');
        }
    } catch (e) {
        isValid = false;
    }

    return isValid;
}

// Save article
async function saveArticle(isPublish = false) {
    const isValid = await validateForm();
    if (!isValid) {
        window.authUtils.showError('יש למלא את כל השדות החובה');
        return;
    }

    // If clicking the Publish button, force status to published and sync the toggle UI
    if (isPublish) {
        statusToggle.checked = true;
        statusLabel.textContent = 'פורסם';
    }

    // Show loading
    publishBtn.disabled = true;
    publishBtnText.classList.add('hidden');
    publishSpinner.classList.remove('hidden');

    try {
        // Sanitize UUID fields: empty string must become null, never pass '' to a UUID column
        const rawCategoryId = categorySelect.value;
        const rawQuizId = document.getElementById('article-quiz-id')?.value;

        const articleData = {
            title: titleInput.value.trim(),
            slug: slugInput.value.trim(),
            author: document.getElementById('author').value.trim(),
            category_id: (rawCategoryId && rawCategoryId !== 'null') ? rawCategoryId : null,
            quiz_id: (rawQuizId && rawQuizId !== 'null') ? rawQuizId : null,
            body: JSON.stringify(await editor.save()),
            meta_description: metaDescription.value.trim(),
            disclaimer: document.getElementById('disclaimer').value.trim() || null,
            status: isPublish ? 'published' : 'draft',
            is_featured: document.getElementById('isFeatured').checked,
            featured_image_url: featuredImageUrl.value || null,
            publish_date: document.getElementById('publishDate').value || null,
            updated_at: new Date().toISOString()
        };

        let savedArticleId = articleId;

        if (isNewArticle) {
            // Insert new article — do NOT include 'id'; Supabase auto-generates the UUID
            articleData.created_at = new Date().toISOString();
            articleData.view_count = 0;

            // DEBUG: article insert payload
            console.log('DEBUG: article insert payload', JSON.parse(JSON.stringify(articleData)));

            const { data, error } = await supabaseClient
                .from('articles')
                .insert([articleData])
                .select()
                .single();

            if (error) {
                if (error.message.includes('duplicate key')) {
                    throw new Error('Slug כבר קיים במערכת');
                }
                throw error;
            }

            savedArticleId = data.id;

        } else {
            // Update existing article
            const { error } = await supabaseClient
                .from('articles')
                .update(articleData)
                .eq('id', articleId);

            if (error) {
                if (error.message.includes('duplicate key')) {
                    throw new Error('Slug כבר קיים במערכת');
                }
                throw error;
            }
        }

        // Save tags
        if (savedArticleId) {
            // Delete existing tags
            await supabaseClient
                .from('article_tags')
                .delete()
                .eq('article_id', savedArticleId);

            // Insert new tags
            if (selectedTags.length > 0) {
                const tagData = selectedTags.map(tag => ({
                    article_id: savedArticleId,
                    tag_id: tag.id
                }));

                await supabaseClient
                    .from('article_tags')
                    .insert(tagData);
            }
        }

        window.authUtils.showSuccess(
            articleData.status === 'published' ? 'המאמר פורסם בהצלחה' : 'המאמר נשמר כטיוטה'
        );

        // Clear auto-save
        localStorage.removeItem('article-autosave');

        // Redirect to dashboard
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1000);

    } catch (error) {
        console.error('Save error:', error);
        window.authUtils.showError(error.message || 'שגיאה בשמירת המאמר');

        // Reset button
        publishBtn.disabled = false;
        publishBtnText.classList.remove('hidden');
        publishSpinner.classList.add('hidden');
    }
}

// Save draft
async function saveDraft() {
    statusToggle.checked = false;
    statusLabel.textContent = 'טיוטה';
    await saveArticle(false);
}

// Auto-save to localStorage
async function autoSave() {
    try {
        const bodyData = await editor.save();
        const data = {
            title: titleInput.value,
            slug: slugInput.value,
            author: document.getElementById('author').value,
            category_id: categorySelect.value,
            body: JSON.stringify(bodyData),
            meta_description: metaDescription.value,
            disclaimer: document.getElementById('disclaimer').value,
            timestamp: Date.now()
        };

        localStorage.setItem('article-autosave', JSON.stringify(data));

        // Show indicator
        autoSaveIndicator.classList.remove('hidden');
        setTimeout(() => {
            autoSaveIndicator.classList.add('hidden');
        }, 2000);
    } catch (e) {
        console.error('AutoSave failed:', e);
    }
}

// Restore from auto-save
async function restoreAutoSave() {
    if (!isNewArticle) return;

    const saved = localStorage.getItem('article-autosave');
    if (!saved) return;

    const data = JSON.parse(saved);
    const age = Date.now() - data.timestamp;

    // Only restore if less than 1 hour old
    if (age < 3600000) {
        if (confirm('נמצאה טיוטה שמורה. האם לשחזר?')) {
            titleInput.value = data.title || '';
            slugInput.value = data.slug || '';
            document.getElementById('author').value = data.author || '';
            categorySelect.value = data.category_id || '';
            metaDescription.value = data.meta_description || '';

            await editor.isReady;
            if (data.body) {
                try {
                    const parsed = JSON.parse(data.body);
                    if (parsed && parsed.blocks) await editor.render(parsed);
                } catch (e) {
                    await editor.render({ blocks: [{ type: 'raw', data: { html: data.body } }] });
                }
            }
        }
    }
}

// Initialize
(async () => {
    const isAuth = await window.authUtils.checkAuth();
    if (!isAuth) return; // checkAuth already redirects to login

    await loadCategories();
    await loadQuizOptions();
    await loadTags();
    await loadArticle();
    await restoreAutoSave();

    // Start auto-save every 2 minutes
    autoSaveInterval = setInterval(autoSave, 120000);
})();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
    }
});
