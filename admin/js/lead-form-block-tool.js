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
            direction: rtl;
            margin: 8px 0;
            font-family: 'Heebo', 'Rubik', sans-serif;
        `;

        // ── Template selector (collapsed top bar) ──
        const topBar = document.createElement('div');
        topBar.style.cssText = 'display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;';

        const badge = document.createElement('span');
        badge.textContent = '✉ טופס לידים (בשורה)';
        badge.style.cssText = 'font-size:11px; font-weight:700; color:#6b7280; background:#f3f4f6; padding:2px 8px; border-radius:20px; letter-spacing:0.02em;';

        const selectorWrap = document.createElement('div');
        selectorWrap.style.cssText = 'display:flex; align-items:center; gap:6px;';

        const selectorLabel = document.createElement('span');
        selectorLabel.textContent = 'תבנית:';
        selectorLabel.style.cssText = 'font-size:11px; color:#9ca3af;';

        const select = document.createElement('select');
        select.style.cssText = 'font-size:11px; padding:2px 6px; border:1px solid #e5e7eb; border-radius:4px; font-family:inherit; background:white; cursor:pointer; color:#6b7280;';
        select.innerHTML = '<option value="">— בחר —</option>';

        selectorWrap.appendChild(selectorLabel);
        selectorWrap.appendChild(select);
        topBar.appendChild(badge);
        topBar.appendChild(selectorWrap);
        wrapper.appendChild(topBar);

        // ── Preview (matching article rendering) ──
        const formPreview = document.createElement('div');
        formPreview.style.cssText = 'border-right:3px solid #dc2626; padding:12px 14px 12px 0;';

        // Title (editable)
        this._titleEl = document.createElement('div');
        this._titleEl.contentEditable = 'true';
        this._titleEl.textContent = this.data.title;
        this._titleEl.style.cssText = 'font-size:14px; font-weight:700; color:#1f2937; margin-bottom:8px; outline:none; border-bottom:1px dashed transparent; cursor:text;';
        this._titleEl.setAttribute('data-placeholder', 'כותרת הטופס');
        this._titleEl.addEventListener('input', () => {
            this.data.title = this._titleEl.textContent;
            this.data.templateId = null;
        });
        this._titleEl.addEventListener('focus', () => this._titleEl.style.borderBottomColor = '#dc2626');
        this._titleEl.addEventListener('blur',  () => this._titleEl.style.borderBottomColor = 'transparent');

        // Subtitle (editable, optional)
        this._subtitleEl = document.createElement('div');
        this._subtitleEl.contentEditable = 'true';
        this._subtitleEl.textContent = this.data.subtitle;
        this._subtitleEl.style.cssText = 'font-size:12px; color:#6b7280; margin-bottom:8px; outline:none; border-bottom:1px dashed transparent; cursor:text;';
        this._subtitleEl.setAttribute('data-placeholder', 'תת-כותרת (אופציונלי)');
        this._subtitleEl.addEventListener('input', () => {
            this.data.subtitle = this._subtitleEl.textContent;
            this.data.templateId = null;
        });
        this._subtitleEl.addEventListener('focus', () => this._subtitleEl.style.borderBottomColor = '#dc2626');
        this._subtitleEl.addEventListener('blur',  () => this._subtitleEl.style.borderBottomColor = 'transparent');

        // Fields row (visual only — horizontal)
        const fieldsRow = document.createElement('div');
        fieldsRow.style.cssText = 'display:flex; gap:8px; flex-wrap:wrap; align-items:center;';

        const makeField = (placeholder, maxW) => {
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.placeholder = placeholder;
            inp.disabled = true;
            inp.style.cssText = `flex:1; min-width:100px; max-width:${maxW || 170}px; padding:7px 10px; border:1px solid #e5e7eb; border-radius:6px; font-size:12px; font-family:inherit; background:#f9fafb; color:#9ca3af; direction:rtl;`;
            return inp;
        };
        fieldsRow.appendChild(makeField('שם מלא', 160));
        fieldsRow.appendChild(makeField('מספר טלפון', 160));

        // Submit button (editable text, inline style)
        this._btnEl = document.createElement('div');
        this._btnEl.contentEditable = 'true';
        this._btnEl.textContent = this.data.buttonText;
        this._btnEl.style.cssText = `
            display:inline-block; background:#dc2626; color:white; font-size:12px;
            font-weight:700; padding:7px 16px; border-radius:6px; cursor:text;
            outline:none; white-space:nowrap; flex-shrink:0;
        `;
        this._btnEl.addEventListener('input', () => {
            this.data.buttonText = this._btnEl.textContent;
            this.data.templateId = null;
        });

        fieldsRow.appendChild(this._btnEl);

        formPreview.appendChild(this._titleEl);
        formPreview.appendChild(this._subtitleEl);
        formPreview.appendChild(fieldsRow);
        wrapper.appendChild(formPreview);

        // ── Load templates async ──
        this._loadTemplates().then(() => {
            if (this._templates.length === 0) return;
            select.innerHTML = '<option value="">— בחר —</option>' +
                this._templates.map(t =>
                    `<option value="${t.id}" ${this.data.templateId === t.id ? 'selected' : ''}>${t.name}${t.is_default ? ' ✓' : ''}</option>`
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
