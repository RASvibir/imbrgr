/** Runs before paint to avoid theme flash. Default brand theme is dark ember. */
export function ThemeScript() {
  const script = `
(function () {
  try {
    var pref = localStorage.getItem('imbrgr-theme') || 'dark';
    var resolved = pref === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePreference = pref;
  } catch (e) {
    document.documentElement.dataset.theme = 'dark';
  }
})();
`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
