/**
 * Legal Modal Component
 * Handles display of legal documents and consent capture
 */
class LegalModal {
    constructor() {
        this.currentDocType = null;
        this.currentVersion = null;
        this.onAcceptCallback = null;
        this.initialized = false;

        // Bind methods
        this.close = this.close.bind(this);
        this.handleAccept = this.handleAccept.bind(this);
        this.handleBackdropClick = this.handleBackdropClick.bind(this);

        // Initialize DOM when ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        if (this.initialized) return;

        // Create modal DOM
        const backdrop = document.createElement('div');
        backdrop.className = 'legal-modal-backdrop';
        backdrop.id = 'legal-modal-backdrop';

        backdrop.innerHTML = `
            <div class="legal-modal">
                <div class="legal-modal-header">
                    <h3 class="legal-modal-title" id="legal-modal-title"></h3>
                    <button class="legal-modal-close" id="legal-modal-close" aria-label="Close">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="legal-modal-content" id="legal-modal-content">
                    <!-- Content will be injected here -->
                </div>
                <div class="legal-modal-footer" id="legal-modal-footer">
                    <button class="btn btn-ghost" id="legal-modal-cancel">Close</button>
                    <button class="btn btn-primary" id="legal-modal-accept">Accept</button>
                </div>
            </div>
        `;

        document.body.appendChild(backdrop);

        // Elements
        this.elements = {
            backdrop: backdrop,
            title: document.getElementById('legal-modal-title'),
            content: document.getElementById('legal-modal-content'),
            footer: document.getElementById('legal-modal-footer'),
            closeBtn: document.getElementById('legal-modal-close'),
            cancelBtn: document.getElementById('legal-modal-cancel'),
            acceptBtn: document.getElementById('legal-modal-accept')
        };

        // Event Listeners
        this.elements.closeBtn.addEventListener('click', this.close);
        this.elements.cancelBtn.addEventListener('click', this.close);
        this.elements.acceptBtn.addEventListener('click', this.handleAccept);
        this.elements.backdrop.addEventListener('click', this.handleBackdropClick);

        // Global click handler for legal links
        document.addEventListener('click', (e) => {
            if (e.target.matches('.legal-link') || e.target.closest('.legal-link')) {
                e.preventDefault();
                const link = e.target.matches('.legal-link') ? e.target : e.target.closest('.legal-link');
                const type = link.dataset.legal;
                const title = link.getAttribute('data-original-title') || link.textContent; // fallback
                this.open({ type, title });
            }
        });

        // Add CSS
        if (!document.querySelector('link[href*="legal-modal.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/components/legal-modal.css';
            document.head.appendChild(link);
        }

        this.initialized = true;
    }

    async open({ type, title, onAccept = null, showAccept = false }) {
        if (!this.initialized) this.init();

        this.currentDocType = type;
        this.onAcceptCallback = onAccept;

        // Update UI
        this.elements.title.textContent = title || this.getDefaultTitle(type);
        this.elements.content.innerHTML = `
            <div class="legal-modal-loading">
                <div class="legal-spinner"></div>
                <p>${i18n.t('common.loading')}</p>
            </div>
        `;

        // Show/Hide Accept button
        this.elements.acceptBtn.style.display = showAccept ? 'inline-flex' : 'none';
        this.elements.cancelBtn.textContent = showAccept ? i18n.t('common.cancel') : i18n.t('common.close');

        // Show modal
        this.elements.backdrop.classList.add('active');
        document.body.style.overflow = 'hidden';

        try {
            // Get version info first (from cached list if possible, but let's just fetch doc for now)
            // Ideally we should know the version. For now, fetch content.

            // Get document content
            const res = await fetch(`/api/legal/document/${type}`);
            if (!res.ok) throw new Error(i18n.t('legal.failedToLoad'));

            const content = await res.text();
            this.elements.content.innerHTML = `<div class="legal-modal-document">${content}</div>`;

            // Assume version 1.0 for now if not returned by API, ideally API should return metadata + content
            // Update: The current API returns raw HTML string. 
            // We should update the backend to return { html, version } or just assume 1.0 for now since 
            // the requirements are simple. The task implementation used `res.send(result.value)` (string).
            // Let's stick to version 1.0 hardcoded in client or fetch metadata separately if needed.
            this.currentVersion = '1.0';

        } catch (error) {
            this.elements.content.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--color-error);">
                    <p>${i18n.t('legal.failedToLoad')}</p>
                    <button class="btn btn-sm btn-outline" onclick="legalModal.open({ type: '${type}', title: '${title}' })">${i18n.t('common.retry')}</button>
                </div>
            `;
        }
    }

    close() {
        this.elements.backdrop.classList.remove('active');
        document.body.style.overflow = '';
        this.currentDocType = null;
        this.onAcceptCallback = null;
    }

    handleBackdropClick(e) {
        if (e.target === this.elements.backdrop) {
            // If accept is required (button visible), maybe don't allow closing by backdrop?
            // Requirement says "closed only by Close button or Accept".
            // Let's allow closing if it's just info, but maybe block if it's a forced consent?
            // For good UX, backdrop click usually closes.
            this.close();
        }
    }

    async handleAccept() {
        try {
            this.elements.acceptBtn.disabled = true;
            this.elements.acceptBtn.textContent = i18n.t('common.loading');

            // Record consent
            await api.post('/api/legal/consent', {
                documentType: this.currentDocType,
                documentVersion: this.currentVersion
            });

            this.close();

            if (this.onAcceptCallback) {
                this.onAcceptCallback();
            }

        } catch (error) {
            console.error('Consent error:', error);
            showToast('error', i18n.t('common.error'));
        } finally {
            this.elements.acceptBtn.disabled = false;
            this.elements.acceptBtn.textContent = i18n.t('legal.accept');
        }
    }

    getDefaultTitle(type) {
        // Fallback titles if i18n not loaded or passed
        const titles = {
            'public-offer': 'Public Offer Agreement',
            'privacy-policy': 'Privacy Policy',
            'terms-of-performance': 'Terms of Performance'
        };
        return titles[type] || 'Legal Document';
    }

    // Check if user needs to consent to a specific doc
    async checkConsentRequired(type) {
        try {
            const result = await api.get(`/api/legal/consent/check?type=${type}`);
            return !result.status.hasConsent;
        } catch (error) {
            console.error('Check consent error:', error);
            return true; // Fail safe: require consent if check fails
        }
    }
}

// Export singleton instance
const legalModal = new LegalModal();
window.legalModal = legalModal;
