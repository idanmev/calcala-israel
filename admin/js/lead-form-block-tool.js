/**
 * Lead Form Block Tool for Editor.js
 * Allows editors to insert a Lead Capture Form anywhere within the article body.
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
            title: data.title !== undefined ? data.title : 'התעניינתם?',
            subtitle: data.subtitle !== undefined ? data.subtitle : 'השאירו פרטים ויענו לכם על כל השאלות.',
            buttonText: data.buttonText !== undefined ? data.buttonText : 'שלח פרטים'
        };
        this.wrapper = null;
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
        header.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 20px;';
        header.innerHTML = `
            <span style="font-size: 24px;">💬</span>
            <span style="font-size: 16px; font-weight: 700; color: #991b1b;">טופס לידים במאמר</span>
        `;
        this.wrapper.appendChild(header);

        // Inputs Container
        const grid = document.createElement('div');
        grid.style.cssText = 'display: flex; flex-direction: column; gap: 12px; max-width: 400px; margin: 0 auto; text-align: right;';

        const createInput = (labelText, key) => {
            const wrap = document.createElement('div');
            
            const label = document.createElement('label');
            label.textContent = labelText;
            label.style.cssText = 'display: block; font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 4px;';
            
            const input = document.createElement('input');
            input.type = 'text';
            input.value = this.data[key];
            input.style.cssText = `
                width: 100%; box-sizing: border-box; padding: 8px 12px; 
                border: 1px solid #d1d5db; border-radius: 6px; 
                font-size: 14px; font-family: inherit; direction: rtl;
            `;

            input.addEventListener('input', (e) => {
                this.data[key] = e.target.value;
            });

            wrap.appendChild(label);
            wrap.appendChild(input);
            return wrap;
        };

        grid.appendChild(createInput('כותרת הטופס', 'title'));
        grid.appendChild(createInput('כותרת משנה', 'subtitle'));
        grid.appendChild(createInput('טקסט כפתור', 'buttonText'));
        
        this.wrapper.appendChild(grid);

        return this.wrapper;
    }

    save(blockContent) {
        return {
            title: this.data.title,
            subtitle: this.data.subtitle,
            buttonText: this.data.buttonText
        };
    }

    validate(savedData) {
        return !!savedData.title.trim();
    }

    static get sanitize() {
        return {
            title: false,
            subtitle: false,
            buttonText: false
        };
    }

    static get contentless() {
        return true;
    }
}

// Expose globally for EditorJS
window.LeadFormBlock = LeadFormBlock;
