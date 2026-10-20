const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const check = path.join(root, 'front-end/components/ui/GlassFab.check.js');
const source = fs.readFileSync(check, 'utf8').split('(async () => {')[0];
const { harness, nodes } = new Function('require', '__dirname', source + '\nreturn { harness, nodes };')(createRequire(check), path.dirname(check));
const h = harness();
const tree = h.draw({ appearance: 'azureGlass' });
const names = { Svg: 'svg', G: 'g', Defs: 'defs', Circle: 'circle', ClipPath: 'clipPath', Rect: 'rect', Path: 'path',
    RadialGradient: 'radialGradient', LinearGradient: 'linearGradient', Stop: 'stop', Filter: 'filter', FeGaussianBlur: 'feGaussianBlur' };
const attributes = { stopColor: 'stop-color', stopOpacity: 'stop-opacity', clipPath: 'clip-path', strokeWidth: 'stroke-width',
    strokeOpacity: 'stroke-opacity', strokeLinecap: 'stroke-linecap' };
const escape = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const serialize = node => {
    if (!node || typeof node !== 'object') return '';
    const children = (node.props.children || []).map(serialize).join('');
    if (!names[node.type]) return children;
    const props = Object.entries(node.props).filter(([key, value]) => !['children', 'style', 'accessible'].includes(key) && value != null && value !== false)
        .map(([key, value]) => ` ${attributes[key] || key}="${escape(value)}"`).join('');
    return `<${names[node.type]}${props}>${children}</${names[node.type]}>`;
};
const artwork = nodes(tree, 'Svg').map(svg => svg.props.children.map(serialize).join('')).join('');
const svg = suffix => `<svg width="100%" height="100%" viewBox="0 0 100 100">${artwork.replaceAll('fab-', `review-${suffix}-`)}</svg>`;
const dir = path.join(__dirname, 'glass-lens-review');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Blue glass material review</title>
<style>*{box-sizing:border-box}body{margin:0;padding:28px;background:#eaf3ff;color:#102255;font:16px system-ui}main{max-width:900px;margin:auto}h1{font-size:24px}section{display:flex;flex-wrap:wrap;align-items:center;gap:32px;padding:24px;border-radius:28px;background:linear-gradient(140deg,#fff,#dceeff);margin:20px 0}.column{text-align:center}.lens{position:relative;width:224px;height:224px;border-radius:50%;background:rgba(220,237,255,.08);backdrop-filter:blur(8px) saturate(120%);box-shadow:0 24px 64px rgba(36,108,205,.20)}.small{width:56px;height:56px;box-shadow:0 6px 16px rgba(36,108,205,.20)}.reference{width:224px;height:224px;overflow:hidden}.reference img{width:332px;max-width:none;transform:translate(-66px,-46px)}.dark{background:linear-gradient(135deg,#26384e,#152438);color:#eef6ff}.label{margin-top:18px}svg{display:block}</style>
<main><h1>Azure-glass material comparison</h1><section><div class="column"><div class="reference"><img src="reference.png"></div><div class="label">Approved reference</div></div><div class="column"><div class="lens">${svg('large')}</div><div class="label">Shared artwork at 4×</div></div><div class="column"><div class="lens small">${svg('small')}</div><div class="label">Actual 56dp</div></div></section><section class="dark"><div class="lens">${svg('dark')}</div><div><div class="lens small">${svg('dark-small')}</div><div class="label">Dark background</div></div></section></main>`);
h.cleanup();
console.log('Wrote isolated review from the actual shared SVG; no API calls or records.');
