/**
 * image-optimizer.js
 * Centralizes image URL transformation to serve images via ImageKit CDN.
 * Supports Supabase Storage URLs and passes through all others.
 *
 * ImageKit Endpoint: https://ik.imagekit.io/7slg7dpqm/calcala/
 * Supabase Storage Origin: https://gtuxstslzsiuinxjvfdj.supabase.co/storage/v1/object/public/
 *
 * In your ImageKit dashboard, configure a "Remote Origin" with:
 *   URL: https://gtuxstslzsiuinxjvfdj.supabase.co/storage/v1/object/public/
 * mapped to the base path "calcala/" of your ImageKit endpoint.
 */

(function () {
    const IMAGEKIT_ENDPOINT = 'https://ik.imagekit.io/7slg7dpqm/calcala/';
    const SUPABASE_STORAGE_BASE = 'https://gtuxstslzsiuinxjvfdj.supabase.co/storage/v1/object/public/';

    /**
     * Converts a source image URL to an optimized ImageKit URL.
     *
     * @param {string} url - The original image URL (Supabase or any CDN).
     * @param {Object} [opts] - Transformation options.
     * @param {number} [opts.w] - Width in pixels (e.g. 800). Height auto-scales.
     * @param {string} [opts.f='auto'] - Format: 'auto', 'webp', 'avif', 'jpg', 'png'.
     * @param {number} [opts.q=80] - Quality 1-100.
     * @param {string} [opts.c] - Crop mode: 'maintain_ratio', 'force', 'at_least', 'at_max'.
     * @returns {string} - The optimized ImageKit URL, or the original URL if not applicable.
     */
    function getOptimizedImageUrl(url, opts) {
        if (!url || typeof url !== 'string') return url;

        // Trim whitespace
        url = url.trim();

        // Skip data URIs, SVGs, blobs
        if (url.startsWith('data:') || url.startsWith('blob:') || url.includes('.svg')) return url;

        // Merge defaults
        const options = Object.assign({ f: 'auto', q: 80 }, opts);

        // Build transformation string
        const trParts = [];
        if (options.w) trParts.push(`w-${options.w}`);
        if (options.f) trParts.push(`f-${options.f}`);
        if (options.q != null) trParts.push(`q-${options.q}`);
        if (options.c) trParts.push(`c-${options.c}`);

        const trString = trParts.length > 0 ? `tr:${trParts.join(',')}` : '';

        // === Supabase Storage URL ===
        if (url.startsWith(SUPABASE_STORAGE_BASE)) {
            // Strip the base, keep the path (bucket/filename)
            const relativePath = url.slice(SUPABASE_STORAGE_BASE.length);
            // Append transform string into the path
            const ikPath = trString ? `${trString}/${relativePath}` : relativePath;
            return IMAGEKIT_ENDPOINT + ikPath;
        }

        // === Already an ImageKit URL: just append/replace transformations ===
        if (url.startsWith(IMAGEKIT_ENDPOINT)) {
            // Strip existing query params
            const [baseIkUrl] = url.split('?');
            // If it already has a tr: in the path, we should ideally replace it, but for simplicity
            // let's try appending as a query param correctly this time using tr= (ImageKit query param syntax is tr=x,y,z)
            const queryTrString = trParts.length > 0 ? `tr=${trParts.join(',')}` : '';
            return queryTrString ? `${baseIkUrl}?${queryTrString}` : baseIkUrl;
        }

        // === Unsplash / Other external URLs: pass through as-is ===
        // (Unsplash has its own optimization query params we leave intact)
        return url;
    }

    // Expose globally
    window.getOptimizedImageUrl = getOptimizedImageUrl;

    console.log('[ImageKit] image-optimizer.js loaded. Endpoint:', IMAGEKIT_ENDPOINT);
})();
