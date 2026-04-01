/**
 * Quiz Block Tool for Editor.js
 * Allows editors to insert a quiz CTA anywhere within the article body.
 * Stores { quizId, quizName } in the block data.
 */
class QuizBlock {
    /**
     * EditorJS toolbox configuration
     */
    static get toolbox() {
        return {
            title: 'חידון זכאות',
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
        };
    }

    /**
     * @param {object} params - EditorJS block constructor params
     */
    constructor({ data, api, config }) {
        this.api = api;
        this.config = config || {};
        this.data = {
            quizId: data.quizId || '',
            quizName: data.quizName || ''
        };

        this.wrapper = null;
        this.quizzes = [];
    }

    /**
     * Render the block UI in the editor
     */
    render() {
        this.wrapper = document.createElement('div');
        this.wrapper.classList.add('quiz-block-wrapper');
        this.wrapper.style.cssText = `
            background: linear-gradient(135deg, #fef2f2 0%, #fff7ed 100%);
            border: 2px dashed #ef4444;
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            direction: rtl;
            margin: 12px 0;
            position: relative;
        `;

        // Header
        const header = document.createElement('div');
        header.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 12px;';
        header.innerHTML = `
            <span style="font-size: 24px;">❓</span>
            <span style="font-size: 16px; font-weight: 700; color: #991b1b;">חידון זכאות</span>
        `;
        this.wrapper.appendChild(header);

        // Description
        const desc = document.createElement('p');
        desc.style.cssText = 'font-size: 13px; color: #6b7280; margin-bottom: 14px;';
        desc.textContent = 'בחר חידון שיופיע במיקום הזה בתוך המאמר';
        this.wrapper.appendChild(desc);

        // Select dropdown
        const select = document.createElement('select');
        select.id = 'quiz-block-select-' + Date.now();
        select.style.cssText = `
            width: 100%;
            max-width: 360px;
            padding: 10px 14px;
            border: 2px solid #d1d5db;
            border-radius: 8px;
            font-size: 14px;
            font-family: inherit;
            direction: rtl;
            background: white;
            cursor: pointer;
            appearance: auto;
        `;
        select.innerHTML = '<option value="">טוען חידונים...</option>';
        this.wrapper.appendChild(select);

        // Selected quiz display
        const selectedDisplay = document.createElement('div');
        selectedDisplay.style.cssText = `
            margin-top: 12px;
            padding: 10px 16px;
            background: #dcfce7;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            color: #166534;
            display: none;
        `;
        this.wrapper.appendChild(selectedDisplay);

        // Load quizzes and populate dropdown
        this._loadQuizzes(select, selectedDisplay);

        // Handle selection change
        select.addEventListener('change', () => {
            const selectedOption = select.options[select.selectedIndex];
            this.data.quizId = select.value;
            this.data.quizName = selectedOption ? selectedOption.textContent : '';

            if (select.value) {
                selectedDisplay.textContent = '✓ נבחר: ' + this.data.quizName;
                selectedDisplay.style.display = 'block';
            } else {
                selectedDisplay.style.display = 'none';
            }
        });

        return this.wrapper;
    }

    /**
     * Load quiz options from Supabase
     */
    async _loadQuizzes(select, selectedDisplay) {
        try {
            const { data, error } = await supabaseClient
                .from('quiz_configs')
                .select('id, display_name, vertical_name')
                .eq('is_active', true)
                .order('vertical_name');

            if (error || !data) {
                select.innerHTML = '<option value="">שגיאה בטעינת חידונים</option>';
                return;
            }

            this.quizzes = data;

            select.innerHTML = '<option value="">— בחר חידון —</option>';
            data.forEach(quiz => {
                const option = document.createElement('option');
                option.value = quiz.id;
                option.textContent = quiz.display_name || quiz.vertical_name;
                if (quiz.id === this.data.quizId) {
                    option.selected = true;
                }
                select.appendChild(option);
            });

            // If we have a pre-selected quiz, show the display
            if (this.data.quizId && this.data.quizName) {
                selectedDisplay.textContent = '✓ נבחר: ' + this.data.quizName;
                selectedDisplay.style.display = 'block';
            }
        } catch (err) {
            console.error('QuizBlock: Error loading quizzes', err);
            select.innerHTML = '<option value="">שגיאה בטעינת חידונים</option>';
        }
    }

    /**
     * Return block data for saving
     */
    save() {
        return {
            quizId: this.data.quizId,
            quizName: this.data.quizName
        };
    }

    /**
     * Validate block data — allow empty quiz (skip rendering) or valid selection
     */
    validate(savedData) {
        // Allow saving even without a quiz selected (it just won't render on frontend)
        return true;
    }

    /**
     * Sanitizer rules
     */
    static get sanitize() {
        return {
            quizId: false,
            quizName: false
        };
    }

    /**
     * This block is not content-editable
     */
    static get contentless() {
        return true;
    }
}

// Expose globally for EditorJS
window.QuizBlock = QuizBlock;
