export const webConfig = {
  apiBase: import.meta.env.VITE_API_BASE_URL ?? '',
  mapStyle:
    import.meta.env.VITE_MAP_STYLE_URL ||
    'https://tiles.openfreemap.org/styles/positron',
};
