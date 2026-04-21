/**
 * Lead Form Block Tool for Editor.js
 * Renders a preview matching the real article form design.
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
            title:      data.title      !== undefined ? data.title      : 'למידע נוסף והרשמה:',
            subtitle:   data.subtitle   !== undefined ? data.subtitle   : '',
            buttonText: data.buttonText !== undefined ? data.buttonText : 'שליחה'
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
        this.data.buttonText = tpl.button_text;

        if (updateDom) {
            if (this._titleEl)    this._titleEl.textContent    = this.data.title;
            if (this._subtitleEl) this._subtitleEl.textContent = this.data.subtitle;
            if (this._btnEl)      this._btnEl.textContent      = this.data.buttonText;
        }
    }

    render() {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'direction:rtl; margin:8px 0; font-family:Heebo,Rubik,sans-serif;';

        // ── Template selector bar ──
        const topBar = document.createElement('div');
        topBar.style.cssText = 'display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;';

        const badge = document.createElement('span');
        badge.textContent = '✉ טופס לידים';
        badge.style.cssText = 'font-size:11px; font-weight:700; color:#6b7280; background:#f3f4f6; padding:2px 8px; border-radius:20px;';

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

        // ── Form preview (matches real article design) ──
        const formPreview = document.createElement('div');
        formPreview.style.cssText = 'background:#f5f5f5; border-radius:12px; padding:22px 20px;';

        // Title (editable)
        this._titleEl = document.createElement('div');
        this._titleEl.contentEditable = 'true';
        this._titleEl.textContent = this.data.title;
        this._titleEl.style.cssText = 'font-size:15px; font-weight:600; color:#1a1a1a; margin-bottom:14px; text-align:right; outline:none; border-bottom:1px dashed transparent; cursor:text;';
        this._titleEl.addEventListener('input', () => { this.data.title = this._titleEl.textContent; this.data.templateId = null; });
        this._titleEl.addEventListener('focus', () => this._titleEl.style.borderBottomColor = '#dc2626');
        this._titleEl.addEventListener('blur',  () => this._titleEl.style.borderBottomColor = 'transparent');


        // Name field (visual only)
        const nameWrap = document.createElement('div');
        nameWrap.style.cssText = 'margin-bottom:14px;';
        nameWrap.innerHTML = '<label style="display:block; text-align:right; font-size:12px; color:#1a1a1a; margin-bottom:3px;">שם מלא</label>' +
            '<div style="border-bottom:2px solid #dc2626; padding-bottom:6px;"></div>';

        // Phone field (visual only)
        const phoneWrap = document.createElement('div');
        phoneWrap.style.cssText = 'margin-bottom:16px;';
        phoneWrap.innerHTML = '<label style="display:block; text-align:right; font-size:12px; color:#1a1a1a; margin-bottom:3px;">טלפון</label>' +
            '<div style="border-bottom:2px solid #dc2626; padding-bottom:6px;"><input type="tel" disabled maxlength="10" style="width:100%; border:none; background:transparent; font-size:12px; outline:none; direction:rtl;" placeholder="05XXXXXXXX"></div>';

        // Consent checkbox (visual, pre-checked)
        const consentRow = document.createElement('div');
        consentRow.style.cssText = 'display:flex; align-items:center; justify-content:center; gap:6px; margin-bottom:14px;';
        consentRow.innerHTML = '<input type="checkbox" checked disabled style="width:14px; height:14px; accent-color:#dc2626;" />' +
            '<span style="font-size:12px; color:#1a1a1a;">אני מאשר קבלת דיוור</span>';

        // Button (editable text)
        this._btnEl = document.createElement('div');
        this._btnEl.contentEditable = 'true';
        this._btnEl.textContent = this.data.buttonText;
        this._btnEl.style.cssText = 'width:100%; background:#dc2626; color:white; font-size:14px; font-weight:700; padding:11px; border-radius:50px; cursor:text; outline:none; text-align:center; box-sizing:border-box;';
        this._btnEl.addEventListener('input', () => { this.data.buttonText = this._btnEl.textContent; this.data.templateId = null; });

        formPreview.appendChild(this._titleEl);
        formPreview.appendChild(nameWrap);
        formPreview.appendChild(phoneWrap);
        formPreview.appendChild(consentRow);
        formPreview.appendChild(this._btnEl);
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
