import { Component } from 'react';

export function SceneUnavailable({ reason, onRetry }) {
  const noWebGL = reason === 'no-webgl';
  return (
    <div className="scene-fallback" role="alert">
      <strong>{noWebGL ? '你的浏览器无法显示 3D 画面' : '3D 画面出了点问题'}</strong>
      <span>
        {noWebGL
          ? '请换用最新版的 Chrome、Edge 或 Safari，或在浏览器设置里打开"硬件加速"。'
          : '可以点下面的按钮重新加载 3D 画面。'}
        检查、改进建议、保存和导出备份仍然可以正常使用。
      </span>
      {onRetry && (
        <button type="button" className="ui-button ui-button-primary" onClick={onRetry}>重新加载 3D 画面</button>
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
    this.state = { failed: false };
    this.reportFailure = error => {
      console.warn('3D scene failed to start.', error);
      this.setState({ failed: true });
    };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.warn('3D scene failed to render.', error);
  }

  render() {
    if (this.state.failed) {
      return <SceneUnavailable reason="crashed" onRetry={() => this.setState({ failed: false })} />;
    }
    return this.props.children(this.reportFailure);
  }
}
