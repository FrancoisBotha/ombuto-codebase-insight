// v-hover directive: Vue equivalent of the prototype runtime's `style-hover="…"`
// attribute. Each distinct CSS string gets one generated `:hover` rule (marked
// !important so it wins over the element's inline style, as in the prototype).
//   <div v-hover="'background:var(--om-white-04)'">
const classes = new Map();
let sheet = null;

function classFor(css) {
  const key = String(css || '').trim();
  if (!key) return '';
  if (classes.has(key)) return classes.get(key);
  if (!sheet) {
    sheet = document.createElement('style');
    sheet.setAttribute('data-hover-styles', '');
    document.head.appendChild(sheet);
  }
  const cls = 'hv-' + classes.size;
  const body = key
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => d + ' !important')
    .join(';');
  sheet.appendChild(document.createTextNode(`.${cls}:hover{${body}}\n`));
  classes.set(key, cls);
  return cls;
}

function apply(el, value, old) {
  const prev = old !== undefined ? classFor(old) : '';
  const next = classFor(value);
  if (prev && prev !== next) el.classList.remove(prev);
  if (next) el.classList.add(next);
}

export const hoverStyle = {
  mounted(el, binding) {
    apply(el, binding.value);
  },
  updated(el, binding) {
    apply(el, binding.value, binding.oldValue);
  },
};
