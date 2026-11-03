import { Component } from 'react';

// A crash in the toolbar or a dialog used to blank the whole page. The 3D
// view already has its own boundary. This one keeps a saved desk reachable:
// the message uses the same banner as other errors, and a refresh loads the
// project still stored in this browser.
export class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.warn('DeskLab failed to render.', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="draft-recovery-banner error-notice" role="alert" aria-label="出错提示">
        <div>
          <strong>页面出了点问题</strong>
          <span>可以刷新页面再试，你保存过的桌面不受影响。</span>
        </div>
        <div className="draft-recovery-actions">
          <button type="button" className="ui-button ui-button-primary" onClick={() => window.location.reload()}>刷新页面</button>
        </div>
      </div>
    );
  }
}
