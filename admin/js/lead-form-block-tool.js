/**
 * Lead Form Block Tool for Editor.js
 * Renders a realistic preview of the lead form as it appears to readers.
 * Title/subtitle/button are editable inline. Template picker at the top.
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
            templateId: data.templateId !== undefined ? data.templateId : null,
            title:      data.title      !== undefined ? data.title      : 'התעניינתם?',
            subtitle:   data.subtitle   !== undefined ? data.subtitle   : 'השאירו פרטים ויענו לכם על כל השאלות.',
            buttonText: data.buttonText !== undefined ? data.buttonText : 'שלח פרטים'
        };
        this._templates = [];
        this._titleEl = null;
        this._subtitleEl = null;
        this._btnEl = null;
    }

    async _loadTemplates() {
        try {
            if (!window.supabaseClient) return;
            const { data } = await window.supabaseClient
                .from('lead_form_templates')
                .select('id, name, title, subtitle, button_text, is_default')
                .order('created_at', { ascending: true });
            this._templates = data || [];

            if (!this.data.templateId && this._templates.length > 0) {
                const def = this._templates.find(t => t.is_default) || this._templates[0];
                this._applyTemplate(def, false);
            }
        } catch (e) {
            console.warn('LeadFormBlock: could not load templates', e);
        }
    }

    _applyTemplate(tpl, updateDom = true) {
        this.data.templateId = tpl.id;
        this.data.title      = tpl.title;
        this.data.subtitle   = tpl.subtitle || '';
        this.data.buttonText = tpl.button_text;

        if (updateDom) {
            if (this._titleEl)    this._titleEl.textContent    = this.data.title;
            if (this._subtitleEl) this._subtitleEl.textContent = this.data.subtitle;
            if (this._btnEl)      this._btnEl.textContent      = this.data.buttonText;
        }
    }

    render() {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = `
            background: linear-gradient(135deg, #fff7f7 0%, #fff9f5 100%);
            border: 2px solid #ef4444;
            border-radius: 16px;
            padding: 28px 24px;
            direction: rtl;
            margin: 12px 0;
            font-family: 'Heebo', 'Rubik', sans-serif;
        `;

        // ── Template selector (top bar) ──
        const topBar = document.createElement('div');
        topBar.style.cssText = 'display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; padding-bottom:12px; border-bottom:1px solid #fecaca;';

        const badge = document.createElement('span');
        badge.textContent = '💬 טופס לידים';
        badge.style.cssText = 'font-size:13px; font-weight:700; color:#991b1b; background:#fee2e2; padding:3px 10px; border-radius:20px;';

        const selectorWrap = document.createElement('div');
        selectorWrap.style.cssText = 'display:flex; align-items:center; gap:6px;';

        const selectorLabel = document.createElement('span');
        selectorLabel.textContent = 'תבנית:';
        selectorLabel.style.cssText = 'font-size:12px; color:#6b7280;';

        const select = document.createElement('select');
        select.style.cssText = 'font-size:12px; padding:3px 8px; border:1px solid #d1d5db; border-radius:6px; font-family:inherit; background:white; cursor:pointer;';
        select.innerHTML = '<option value="">— בחר תבנית —</option>';

        selectorWrap.appendChild(selectorLabel);
        selectorWrap.appendChild(select);
        topBar.appendChild(badge);
        topBar.appendChild(selectorWrap);
        wrapper.appendChild(topBar);

        // ── Form preview ──
        const formPreview = document.createElement('div');
        formPreview.style.cssText = 'max-width:460px; margin:0 auto; text-align:center;';

        // Title (editable)
        this._titleEl = document.createElement('div');
        this._titleEl.contentEditable = 'true';
        this._titleEl.textContent = this.data.title;
        this._titleEl.style.cssText = 'font-size:22px; font-weight:700; color:#1f2937; margin-bottom:8px; outline:none; border-bottom:1px dashed transparent; cursor:text;';
        this._titleEl.setAttribute('data-placeholder', 'כותרת הטופס');
        this._titleEl.addEventListener('input', () => {
            this.data.title = this._titleEl.textContent;
            this.data.templateId = null;
        });
        this._titleEl.addEventListener('focus', () => this._titleEl.style.borderBottomColor = '#ef4444');
        this._titleEl.addEventListener('blur',  () => this._titleEl.style.borderBottomColor = 'transparent');

        // Subtitle (editable)
        this._subtitleEl = document.createElement('div');
        this._subtitleEl.contentEditable = 'true';
        this._subtitleEl.textContent = this.data.subtitle;
        this._subtitleEl.style.cssText = 'font-size:14px; color:#6b7280; margin-bottom:20px; outline:none; border-bottom:1px dashed transparent; cursor:text;';
        this._subtitleEl.addEventListener('input', () => {
            this.data.subtitle = this._subtitleEl.textContent;
            this.data.templateId = null;
        });
        this._subtitleEl.addEventListener('focus', () => this._subtitleEl.style.borderBottomColor = '#ef4444');
        this._subtitleEl.addEventListener('blur',  () => this._subtitleEl.style.borderBottomColor = 'transparent');

        // Fields row (visual only)
        const fieldsRow = document.createElement('div');
        fieldsRow.style.cssText = 'display:flex; gap:10px; margin-bottom:12px; flex-wrap:wrap; justify-content:center;';

        const makeField = (placeholder) => {
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.placeholder = placeholder;
            inp.disabled = true;
            inp.style.cssText = 'flex:1; min-width:120px; padding:10px 14px; border:1.5px solid #d1d5db; border-radius:8px; font-size:14px; font-family:inherit; background:white; color:#9ca3af; direction:rtl;';
            return inp;
        };
        fieldsRow.appendChild(makeField('שם מלא'));
        fieldsRow.appendChild(makeField('05X-XXXXXXX'));

        // Submit button (editable text)
        const btnWrap = document.createElement('div');
        this._btnEl = document.createElement('div');
        this._btnEl.contentEditable = 'true';
        this._btnEl.textContent = this.data.buttonText;
        this._btnEl.style.cssText = `
            display:inline-block; background:#dc2626; color:white; font-size:15px;
            font-weight:700; padding:12px 40px; border-radius:8px; cursor:text;
            outline:none; min-width:140px; margin-top:4px;
        `;
        this._btnEl.addEventListener('input', () => {
            this.data.buttonText = this._btnEl.textContent;
            this.data.templateId = null;
        });

        btnWrap.appendChild(this._btnEl);

        formPreview.appendChild(this._titleEl);
        formPreview.appendChild(this._subtitleEl);
        formPreview.appendChild(fieldsRow);
        formPreview.appendChild(btnWrap);
        wrapper.appendChild(formPreview);

        // ── Load templates async ──
        this._loadTemplates().then(() => {
            if (this._templates.length === 0) return;
            select.innerHTML = '<option value="">— בחר תבנית —</option>' +
                this._templates.map(t =>
                    `<option value="${t.id}" ${this.data.templateId === t.id ? 'selected' : ''}>${t.name}${t.is_default ? ' (ברירת מחדל)' : ''}</option>`
                ).join('');
            select.addEventListener('change', () => {
                const tpl = this._templates.find(t => t.id === select.value);
                if (tpl) this._applyTemplate(tpl, true);
            });
            // Sync DOM after template applied on init
            if (this._titleEl)    this._titleEl.textContent    = this.data.title;
            if (this._subtitleEl) this._subtitleEl.textContent = this.data.subtitle;
            if (this._btnEl)      this._btnEl.textContent      = this.data.buttonText;
        });

        return wrapper;
    }

    save() {
        return {
            templateId: this.data.templateId,
            title:      this._titleEl    ? this._titleEl.textContent.trim()    : this.data.title,
            subtitle:   this._subtitleEl ? this._subtitleEl.textContent.trim() : this.data.subtitle,
            buttonText: this._btnEl      ? this._btnEl.textContent.trim()      : this.data.buttonText
        };
    }

    validate(savedData) {
        return !!(savedData.title && savedData.title.trim());
    }

    static get sanitize() {
        return { templateId: false, title: false, subtitle: false, buttonText: false };
    }

    static get contentless() {
        return true;
    }
}

window.LeadFormBlock = LeadFormBlock;
