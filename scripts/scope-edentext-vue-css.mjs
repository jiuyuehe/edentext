import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';

const HOST = 'edentext-vue-host';
const ROOT_TAGS = new Set(['html', 'body']);

function isRootNode(node) {
  return (node.type === 'tag' && ROOT_TAGS.has(node.value.toLowerCase()))
    || (node.type === 'pseudo' && node.value === ':root');
}

function hasHostPrefix(selector) {
  return selector.nodes[0]?.type === 'class' && selector.nodes[0].value === HOST;
}

function scopeSelectorList(value) {
  return selectorParser((selectors) => {
    selectors.each((selector) => {
      if (hasHostPrefix(selector)) return;

      let rootedAtDocument = false;
      while (selector.nodes.length && isRootNode(selector.nodes[0])) {
        rootedAtDocument = true;
        selector.nodes[0].remove();

        const next = selector.nodes[0];
        const afterNext = selector.nodes[1];
        if (next?.type === 'combinator' && /^\s+$/.test(next.value) && afterNext && isRootNode(afterNext)) {
          next.remove();
        }
      }

      const startsWithHostAttribute = selector.nodes[0]?.type === 'attribute'
        && ['data-theme', 'data-accent'].includes(selector.nodes[0].attribute);
      const host = selectorParser.className({ value: HOST });
      if (rootedAtDocument || startsWithHostAttribute) {
        selector.prepend(host);
      } else {
        selector.prepend(selectorParser.combinator({ value: ' ' }));
        selector.prepend(host);
      }
    });
  }).processSync(value, { lossless: false });
}

function isKeyframeRule(rule) {
  for (let parent = rule.parent; parent; parent = parent.parent) {
    if (parent.type === 'atrule' && /keyframes$/i.test(parent.name)) return true;
  }
  return false;
}

export function scopeEdentextVueCss(css) {
  const root = postcss.parse(css);
  root.walkRules((rule) => {
    if (!isKeyframeRule(rule)) rule.selector = scopeSelectorList(rule.selector);
  });
  return root.toString();
}
