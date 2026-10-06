/** Runs before paint to avoid theme flash. */
export function ThemeScript() {
  const script = `
(function () {
  try {
    var pref = localStorage.getItem('imbrgr-theme') || 'system';
    var resolved = pref;
    if (pref === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePreference = pref;
  } catch (e) {}
})();
`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
