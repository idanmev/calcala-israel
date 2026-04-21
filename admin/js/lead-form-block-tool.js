/**
 * Lead Form Block Tool for Editor.js
 * Allows editors to insert a Lead Capture Form anywhere within the article body.
 * Supports selecting from saved templates in lead_form_templates table.
 */
class LeadFormBlock {
    static get toolbox() {
        return {
            title: 'טופס לידים',
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>'
        };
    }

    constructor({ data, api, config }) {
        this.api = api;
        this.config = config || {};
        this.data = {
            templateId:  data.templateId  !== undefined ? data.templateId  : null,
            title:       data.title       !== undefined ? data.title       : 'התעניינתם?',
            subtitle:    data.subtitle    !== undefined ? data.subtitle    : 'השאירו פרטים ויענו לכם על כל השאלות.',
            buttonText:  data.buttonText  !== undefined ? data.buttonText  : 'שלח פרטים'
        };
        this.wrapper   = null;
        this._templates = [];
    }

    async _loadTemplates() {
        try {
            if (!window.supabaseClient) return;
            const { data } = await window.supabaseClient
                .from('lead_form_templates')
                .select('id, name, title, subtitle, button_text, is_default')
                .order('created_at', { ascending: true });
            this._templates = data || [];

            // If no templateId set yet and there's a default, apply it
            if (!this.data.templateId && this._templates.length > 0) {
                const def = this._templates.find(t => t.is_default) || this._templates[0];
                this._applyTemplate(def, false);
            }
        } catch (e) {
            console.warn('LeadFormBlock: could not load templates', e);
        }
    }

    _applyTemplate(tpl, updateInputs = true) {
        this.data.templateId = tpl.id;
        this.data.title      = tpl.title;
        this.data.subtitle   = tpl.subtitle || '';
        this.data.buttonText = tpl.button_text;

        if (updateInputs && this.wrapper) {
            this.wrapper.querySelector('[data-key="title"]').value      = this.data.title;
            this.wrapper.querySelector('[data-key="subtitle"]').value   = this.data.subtitle;
            this.wrapper.querySelector('[data-key="buttonText"]').value = this.data.buttonText;
        }
    }

    _buildTemplateSelector() {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'margin-bottom: 12px; text-align: right;';

        const label = document.createElement('label');
        label.textContent = 'תבנית: ';
        label.style.cssText = 'font-size: 12px; font-weight: 600; color: #374151; margin-left: 6px;';

        const select = document.createElement('select');
        select.style.cssText = 'font-size: 13px; padding: 4px 8px; border: 1px solid #d1d5db; border-radius: 6px; font-family: inherit;';
        select.innerHTML = '<option value="">— בחר תבנית —</option>' +
            this._templates.map(t =>
                `<option value="${t.id}" ${this.data.templateId === t.id ? 'selected' : ''}>${t.name}${t.is_default ? ' (ברירת מחדל)' : ''}</option>`
            ).join('');

        select.addEventListener('change', () => {
            const tpl = this._templates.find(t => t.id === select.value);
            if (tpl) this._applyTemplate(tpl);
        });

        wrap.appendChild(label);
        wrap.appendChild(select);
        return wrap;
    }

    render() {
        this.wrapper = document.createElement('div');
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

        const header = document.createElement('div');
        header.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 16px;';
        header.innerHTML = `
            <span style="font-size: 24px;">💬</span>
            <span style="font-size: 16px; font-weight: 700; color: #991b1b;">טופס לידים במאמר</span>
        `;
        this.wrapper.appendChild(header);

        // Template selector placeholder — will be populated after async load
        const selectorPlaceholder = document.createElement('div');
        selectorPlaceholder.id = 'tpl-selector-placeholder';
        this.wrapper.appendChild(selectorPlaceholder);

        // Inputs
        const grid = document.createElement('div');
        grid.style.cssText = 'display: flex; flex-direction: column; gap: 12px; max-width: 400px; margin: 0 auto; text-align: right;';

        const createInput = (labelText, key) => {
            const wrap = document.createElement('div');
            const label = document.createElement('label');
            label.textContent = labelText;
            label.style.cssText = 'display: block; font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 4px;';
            const input = document.createElement('input');
            input.type = 'text';
            input.dataset.key = key;
            input.value = this.data[key];
            input.style.cssText = `
                width: 100%; box-sizing: border-box; padding: 8px 12px;
                border: 1px solid #d1d5db; border-radius: 6px;
                font-size: 14px; font-family: inherit; direction: rtl;
            `;
            input.addEventListener('input', (e) => {
                this.data[key] = e.target.value;
                this.data.templateId = null; // manual edit detaches from template
            });
            wrap.appendChild(label);
            wrap.appendChild(input);
            return wrap;
        };

        grid.appendChild(createInput('כותרת הטופס', 'title'));
        grid.appendChild(createInput('כותרת משנה', 'subtitle'));
        grid.appendChild(createInput('טקסט כפתור', 'buttonText'));
        this.wrapper.appendChild(grid);

        // Load templates async and inject selector
        this._loadTemplates().then(() => {
            if (this._templates.length > 0) {
                const selector = this._buildTemplateSelector();
                selectorPlaceholder.replaceWith(selector);
                // Re-sync inputs after template applied
                this.wrapper.querySelector('[data-key="title"]').value      = this.data.title;
                this.wrapper.querySelector('[data-key="subtitle"]').value   = this.data.subtitle;
                this.wrapper.querySelector('[data-key="buttonText"]').value = this.data.buttonText;
            }
        });

        return this.wrapper;
    }

    save() {
        return {
            templateId: this.data.templateId,
            title:      this.data.title,
            subtitle:   this.data.subtitle,
            buttonText: this.data.buttonText
        };
    }

    validate(savedData) {
        return !!savedData.title && !!savedData.title.trim();
    }

    static get sanitize() {
        return { templateId: false, title: false, subtitle: false, buttonText: false };
    }

    static get contentless() {
        return true;
    }
}

window.LeadFormBlock = LeadFormBlock;
