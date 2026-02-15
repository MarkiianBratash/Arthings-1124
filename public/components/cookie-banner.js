/**
 * Cookie Consent Banner
 */
class CookieBanner {
    constructor() {
        this.STORAGE_KEY = 'arthings-cookie-consent';
        this.init();
    }

    init() {
        if (localStorage.getItem(this.STORAGE_KEY)) {
            return;
        }

        // Wait for DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.render());
        } else {
            this.render();
        }
    }

    render() {
        // Wait for i18n to be initialized
        const getText = (key, fallback) => {
            if (typeof i18n !== 'undefined' && typeof i18n.t === 'function') {
                const text = i18n.t(key);
                return text !== key ? text : fallback;
            }
            return fallback;
        };

        const banner = document.createElement('div');
        banner.className = 'cookie-banner';
        banner.innerHTML = `
            <div class="cookie-content">
                <p data-i18n="legal.cookieText" data-i18n-html="true">
                    ${getText('legal.cookieText', 'We use cookies to improve your experience. By continuing to use this site, you agree to our use of cookies.')}
                </p>
            </div>
            <div class="cookie-actions">
                <button class="btn btn-primary" id="cookie-accept" data-i18n="legal.accept">${getText('legal.accept', 'Accept')}</button>
            </div>
        `;

        document.body.appendChild(banner);

        // Animate in
        requestAnimationFrame(() => {
            banner.classList.add('active');
        });

        // Event listeners
        const acceptBtn = banner.querySelector('#cookie-accept');
        acceptBtn.addEventListener('click', () => {
            this.accept(banner);
        });
    }

    accept(banner) {
        localStorage.setItem(this.STORAGE_KEY, 'true');
        banner.classList.remove('active');
        setTimeout(() => banner.remove(), 300);

        // Optional: Record to backend
        this.recordConsent();
    }

    async recordConsent() {
        try {
            await api.post('/api/legal/consent', {
                documentType: 'cookie-consent',
                documentVersion: '1.0'
            });
        } catch (e) {
            // Ignore if fails (e.g. not logged in)
            console.log('Cookie consent backend record skipped');
        }
    }
}

// Init
new CookieBanner();
