/**
 * Markdown: [Hiển thị nút ngắn](btn:https://đường-dẫn-đầy-đủ)
 * Hiển thị nút giống /blog không in URL dài. Chỉ cho phép http(s), mailto, hoặc đường dẫn tương đối /...
 */
import { visit } from 'unist-util-visit';

const PREFIX = 'btn:';

/** @param {string} value */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** @param {import('mdast').PhrasingContent[]} [children] */
function linkPlainText(children) {
  if (!children?.length) return '';
  return children
    .map((node) => {
      switch (node.type) {
        case 'text':
          return node.value;
        case 'strong':
        case 'emphasis':
        case 'delete':
          return linkPlainText(node.children);
        case 'inlineCode':
          return node.value;
        default:
          return '';
      }
    })
    .join('');
}

/** @param {string} href */
function isAllowedHref(href) {
  const h = href.trim();
  if (!h) return false;
  const low = h.toLowerCase();
  if (low.startsWith('mailto:')) return true;
  if (low.startsWith('http://') || low.startsWith('https://')) return true;
  if (low.startsWith('/')) return !low.startsWith('//');
  return false;
}

/** @returns {import('remark').Transformer} */
export default function remarkBtnLink() {
  return (tree) => {
    visit(tree, 'link', (node, index, parent) => {
      if (!parent || index == null || typeof node.url !== 'string') return;
      if (!node.url.startsWith(PREFIX)) return;

      const href = node.url.slice(PREFIX.length).trim();
      const label = linkPlainText(node.children).trim() || 'Mở liên kết';

      if (!isAllowedHref(href)) {
        node.url = href.length ? href : '#';
        return;
      }

      /** @type {import('mdast').Html} */
      const btn = {
        type: 'html',
        value: `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="not-prose my-4 inline-flex items-center gap-2 rounded-full bg-teal-600 px-5 py-2.5 align-middle text-sm font-bold leading-none text-white shadow-md shadow-teal-600/25 transition-colors hover:bg-teal-700">${escapeHtml(
          label,
        )}<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h10v10" /><path d="M7 17 17 7" /></svg></a>`,
      };
      parent.children[index] = btn;
    });
  };
}
