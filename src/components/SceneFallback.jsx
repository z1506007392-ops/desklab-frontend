import { Component } from 'react';

import { isCodeDownloadError } from '../domain/load-errors.js';

const MESSAGES = {
  'no-webgl': {
    title: '你的浏览器无法显示 3D 画面',
    text: '请换用最新版的 Chrome、Edge 或 Safari，或在浏览器设置里打开"硬件加速"。',
  },
  download: {
    title: '3D 画面没有下载完整',
    text: '可能是网络不稳定。刷新页面即可重新下载，没保存的修改会作为草稿保留，刷新后可以恢复。',
    action: '刷新页面',
  },
  crashed: {
    title: '3D 画面出了点问题',
    text: '可以点下面的按钮重新加载 3D 画面。',
    action: '重新加载 3D 画面',
  },
};

export function SceneUnavailable({ reason, onRetry }) {
  const message = MESSAGES[reason];
  return (
    <div className="scene-fallback" role="alert">
      <strong>{message.title}</strong>
      <span>
        {message.text}
        检查、改进建议、保存和导出备份仍然可以正常使用。
      </span>
      {onRetry && message.action && (
        <button type="button" className="ui-button ui-button-primary" onClick={onRetry}>{message.action}</button>
      )}
    </div>
  );
}

// Keeps a crash inside the 3D view from blanking the whole page. Children is
// a function receiving reportFailure, for failures outside React rendering
// (the renderer is created asynchronously by R3F).
export class SceneErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failure: null };
    this.reportFailure = error => {
      console.warn('3D scene failed to start.', error);
      this.setState({ failure: 'crashed' });
    };
  }

  static getDerivedStateFromError(error) {
    return { failure: isCodeDownloadError(error) ? 'download' : 'crashed' };
  }

  componentDidCatch(error) {
    console.warn('3D scene failed to render.', error);
  }

  render() {
    const { failure } = this.state;
    if (failure === 'download') {
      // The browser remembers a failed module download until the page reloads.
      return <SceneUnavailable reason="download" onRetry={() => window.location.reload()} />;
    }
    if (failure === 'crashed') {
      return <SceneUnavailable reason="crashed" onRetry={() => this.setState({ failure: null })} />;
    }
    return this.props.children(this.reportFailure);
  }
}
