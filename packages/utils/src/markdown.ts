import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';

// 语言名称映射（美化显示）
const langMap: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  java: 'Java',
  cpp: 'C++',
  c: 'C',
  csharp: 'C#',
  go: 'Go',
  rust: 'Rust',
  php: 'PHP',
  ruby: 'Ruby',
  swift: 'Swift',
  kotlin: 'Kotlin',
  html: 'HTML',
  css: 'CSS',
  json: 'JSON',
  xml: 'XML',
  yaml: 'YAML',
  markdown: 'Markdown',
  bash: 'Bash',
  shell: 'Shell',
  sql: 'SQL',
  vue: 'Vue',
  react: 'React',
};

/**
 * 创建并配置 markdown-it 实例
 */
export function createMarkdownRenderer(): MarkdownIt {
  // 初始化 markdown-it，配置代码高亮
  const md: MarkdownIt = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    highlight: function (str: string, lang?: string): string {
      // highlight 函数只返回高亮后的代码内容，不包含 pre/code 标签
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(str, { language: lang, ignoreIllegals: true })
            .value;
        } catch {
          // 如果高亮失败，继续执行下面的逻辑
        }
      }
      // 如果没有指定语言或语言不支持，尝试自动检测
      try {
        return hljs.highlightAuto(str).value;
      } catch {
        // 如果自动检测失败，返回转义的代码
        return md.utils.escapeHtml(str);
      }
    },
  });

  // 重写 fence 规则，自定义代码块渲染
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  md.renderer.rules.fence = function (
    tokens: any[],
    idx: number,
    _options: any,
    _env: any,
    _self: any
  ) {
    const token = tokens[idx];
    if (!token) {
      return '';
    }
    const info = token.info ? token.info.trim() : '';
    const langName = info ? info.split(/\s+/g)[0] : '';
    const code = token.content || '';

    // 获取高亮后的代码内容
    let highlightedCode = '';
    let detectedLang = langName || '';

    if (langName && hljs.getLanguage(langName)) {
      try {
        const result = hljs.highlight(code, {
          language: langName,
          ignoreIllegals: true,
        });
        highlightedCode = result.value;
        detectedLang = langName;
      } catch {
        // 如果高亮失败，尝试自动检测
        try {
          const result = hljs.highlightAuto(code);
          highlightedCode = result.value;
          detectedLang = result.language || 'text';
        } catch {
          highlightedCode = md.utils.escapeHtml(code);
          detectedLang = 'text';
        }
      }
    } else {
      // 自动检测语言
      try {
        const result = hljs.highlightAuto(code);
        highlightedCode = result.value;
        detectedLang = result.language || 'text';
      } catch {
        highlightedCode = md.utils.escapeHtml(code);
        detectedLang = 'text';
      }
    }

    // 转义代码内容用于 data 属性
    const escapedCode = md.utils.escapeHtml(code);

    const displayLang =
      langMap[detectedLang.toLowerCase()] || detectedLang || 'Text';

    // 生成唯一的 ID 用于复制按钮
    const codeId = `code-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    // 返回完整的代码块 HTML（包含头部和代码内容）
    return `
    <div class="code-block-wrapper">
      <div class="code-block-header">
        <span class="code-block-lang">${displayLang}</span>
        <button 
          class="code-block-copy-btn" 
          data-code-id="${codeId}"
          data-code-content="${escapedCode.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}"
          title="复制代码"
          type="button"
        >
          <svg class="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span class="copy-text">复制</span>
        </button>
      </div>
      <pre class="hljs"><code>${highlightedCode}</code></pre>
    </div>
  `;
  };

  return md;
}

/**
 * 渲染 Markdown 文本为 HTML
 */
export function renderMarkdown(text: string, md?: MarkdownIt): string {
  const renderer = md || createMarkdownRenderer();
  return renderer.render(text);
}
