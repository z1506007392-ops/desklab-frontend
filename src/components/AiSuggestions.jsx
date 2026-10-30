import { useMemo, useState } from 'react';

import { applySuggestionsInOrder, changedObjectIds, evaluateSuggestions } from '../domain/ai-actions.js';

function deviceNames(project, ids) {
  const names = new Map(project.objects.map(object => [object.id, object.name || '未命名设备']));
  return ids.map(id => names.get(id)).filter(Boolean).join('、');
}

/**
 * The "AI 建议" section of the improvements dialog. Only suggestions that
 * pass evaluateSuggestions() against the current project are shown, so a
 * suggestion disappears once it has been applied or no longer helps.
 */
export function AiSuggestionsPanel({ ai, project, editable, onApply, onPreview }) {
  const [goal, setGoal] = useState('');
  const [feedback, setFeedback] = useState('');
  const accepted = useMemo(() => evaluateSuggestions(project, ai.suggestions).map(result => ({
    ...result,
    changedIds: changedObjectIds(project, result.nextProject),
  })), [project, ai.suggestions]);
  const loading = ai.status === 'loading';
  const empty = project.objects.length === 0;

  if (ai.unavailable) {
    return (
      <section className="ai-suggestions" aria-labelledby="ai-suggestions-title">
        <h4 id="ai-suggestions-title" className="template-section-title">AI 建议</h4>
        <p className="ai-suggestions-note">AI 功能暂未开放，下面的自动检查和改进建议照常可用。</p>
      </section>
    );
  }

  return (
    <section className="ai-suggestions" aria-labelledby="ai-suggestions-title">
      <h4 id="ai-suggestions-title" className="template-section-title">AI 建议</h4>
      <div className="ai-suggestions-form">
        <label htmlFor="ai-goal">想怎么改？（可选）</label>
        <input
          id="ai-goal"
          className="ui-input"
          maxLength={200}
          placeholder="例如：更整洁 / 适合打游戏 / 双屏办公"
          value={goal}
          onChange={event => setGoal(event.target.value)}
          disabled={loading}
        />
        <button
          type="button"
          className="ui-button ui-button-primary"
          onClick={() => ai.request(project, goal.trim())}
          disabled={!editable || loading || empty}
        >
          让 AI 看看
        </button>
      </div>
      {empty && <p className="ai-suggestions-note">先放几件设备，AI 才能给建议。</p>}

      {loading && (
        <div className="ai-suggestions-status" role="status">
          <span>AI 正在看你的桌面…（约 10–30 秒）</span>
          <button type="button" className="ui-button" onClick={ai.cancel}>取消</button>
        </div>
      )}

      {ai.status === 'error' && (
        <div className="ai-suggestions-status ai-suggestions-error" role="alert">
          <span>{ai.error}</span>
          <button type="button" className="ui-button" onClick={() => ai.request(project, goal.trim())} disabled={!editable}>
            再试一次
          </button>
        </div>
      )}

      {ai.status === 'done' && accepted.length === 0 && (
        <p className="ai-suggestions-note" role="status">AI 这次没有找到能让布局更好的改动。</p>
      )}

      {ai.status === 'done' && accepted.length > 0 && (
        <div className="ai-suggestions-list">
          {accepted.length > 1 && (
            <button
              type="button"
              className="ui-button ui-button-primary"
              onClick={() => {
                const { project: next } = applySuggestionsInOrder(project, accepted.map(result => result.suggestion));
                onApply(next, '全部 AI 建议');
              }}
              disabled={!editable}
            >
              全部应用（{accepted.length}）
            </button>
          )}
          {accepted.map(result => (
            <div key={result.suggestion.id} className="ai-suggestion-card" role="group" aria-label={result.suggestion.title}>
              <div className="ai-suggestion-title">{result.suggestion.title}</div>
              <div className="ai-suggestion-reason">{result.suggestion.reason}</div>
              <div className="ai-suggestion-devices">会调整：{deviceNames(project, result.changedIds)}</div>
              <div className="connection-item-actions">
                <button
                  type="button"
                  className="ui-button"
                  onClick={() => onPreview({ title: result.suggestion.title, nextProject: result.nextProject, changedIds: result.changedIds })}
                  disabled={!editable}
                >
                  预览
                </button>
                <button
                  type="button"
                  className="ui-button ui-button-primary"
                  onClick={() => onApply(result.nextProject, result.suggestion.title)}
                  disabled={!editable}
                >
                  应用
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {ai.status === 'done' && (
        <div className="ai-suggestions-form ai-suggestions-followup">
          <label htmlFor="ai-feedback">不满意？告诉 AI 怎么改</label>
          <input
            id="ai-feedback"
            className="ui-input"
            maxLength={200}
            placeholder="例如：不要动主机 / 再整洁一点"
            value={feedback}
            onChange={event => setFeedback(event.target.value)}
          />
          <button
            type="button"
            className="ui-button"
            onClick={() => {
              ai.request(project, goal.trim(), feedback.trim());
              setFeedback('');
            }}
            disabled={!editable || !feedback.trim()}
          >
            按我的意见再来一次
          </button>
        </div>
      )}

      <p className="ai-suggestions-privacy">使用 AI 时，桌面布局（包括你起的设备名称和填写的要求）会发送给 DeepSeek 处理，请不要填写个人信息。详见“更多 → 关于与隐私”。</p>
    </section>
  );
}
