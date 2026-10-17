import { Component, ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

/** Một trang lỗi lúc chạy thì chỉ trang đó hiện thông báo, phần còn lại của app vẫn dùng được */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Lỗi giao diện', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    // bản mới vừa deploy xoá file cũ → tải lại trang là lấy được bản mới
    const stale = /dynamically imported module|Importing a module script failed|Loading chunk/i.test(error.message);
    return (
      <div className="page">
        <div className="panel" role="alert">
          <h2>{stale ? 'App vừa có bản mới' : 'Trang này gặp lỗi'}</h2>
          <p className="muted">
            {stale ? 'Tải lại để dùng bản mới nhất.' : 'Bài hát và cài đặt của bạn vẫn còn nguyên. Thử tải lại hoặc quay về thư viện.'}
          </p>
          {!stale && <p className="muted small">{error.message}</p>}
          <div className="row gap wrap">
            <button className="btn btn-primary" onClick={() => location.reload()}>Tải lại</button>
            <a className="btn btn-ghost" href="#/" onClick={() => this.setState({ error: null })}>Về thư viện</a>
          </div>
        </div>
      </div>
    );
  }
}
