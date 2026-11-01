// Old saves have gaming-desk, standing-desk, l-desk; 'desktop-pc' is not a desk.
export const isDesk = object => object.modelId === 'office-desk' || /(^|[-_])desk$/.test(object.type ?? '');
