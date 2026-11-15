/* @ds-bundle: {"format":4,"namespace":"OmbutoCodeDesignSystem_876e30","components":[{"name":"KanbanColumn","sourcePath":"components/board/KanbanColumn.jsx"},{"name":"TaskCard","sourcePath":"components/board/TaskCard.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"ChipButton","sourcePath":"components/core/ChipButton.jsx"},{"name":"CountPill","sourcePath":"components/core/CountPill.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Modal","sourcePath":"components/feedback/Modal.jsx"},{"name":"DetailRow","sourcePath":"components/feedback/Modal.jsx"},{"name":"EvalCheck","sourcePath":"components/feedback/Modal.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Eyebrow","sourcePath":"components/marketing/Eyebrow.jsx"},{"name":"SIDEBAR_NAV","sourcePath":"components/navigation/Sidebar.jsx"},{"name":"Sidebar","sourcePath":"components/navigation/Sidebar.jsx"},{"name":"StatusBar","sourcePath":"components/navigation/StatusBar.jsx"},{"name":"TitleBar","sourcePath":"components/navigation/TitleBar.jsx"}],"sourceHashes":{"components/board/KanbanColumn.jsx":"b919b52efcd3","components/board/TaskCard.jsx":"fab5dffc80e1","components/core/Badge.jsx":"c3dcb748b5e1","components/core/Button.jsx":"6105b648e2c5","components/core/ChipButton.jsx":"9f2c2368e83a","components/core/CountPill.jsx":"7f167a6312ce","components/core/IconButton.jsx":"cf025c9a1bbc","components/feedback/Modal.jsx":"03f1d0f3f0d9","components/forms/Input.jsx":"3767a979fa65","components/forms/Select.jsx":"bbe57274da1e","components/marketing/Eyebrow.jsx":"7f518b829cff","components/navigation/Sidebar.jsx":"a7beeb7dc6d8","components/navigation/StatusBar.jsx":"42c8300478b4","components/navigation/TitleBar.jsx":"8197c038b53f"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.OmbutoCodeDesignSystem_876e30 = window.OmbutoCodeDesignSystem_876e30 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge.jsx
try { (() => {
const STATE = {
  queued: 'blue',
  running: 'yellow',
  failed: 'red',
  completed: 'green',
  evaluating: 'orange',
  resolving: 'yellow',
  merge_failed: 'yellow',
  merge_aborted: 'red',
  pass: 'green',
  fail: 'red',
  unknown: 'neutral'
};
const STATUS = {
  todo: 'neutral',
  in_progress: 'blue',
  eval: 'eval',
  merging: 'yellow',
  review: 'yellow',
  done: 'green'
};
function Badge({
  kind = 'state',
  tone,
  state,
  status,
  icon,
  children
}) {
  const t = tone || (kind === 'status' ? STATUS[status] : STATE[state]) || 'neutral';
  const label = children ?? (kind === 'status' ? status : state);
  return /*#__PURE__*/React.createElement("span", {
    className: 'om-badge om-badge--' + kind + ' om-tone-' + t
  }, icon && /*#__PURE__*/React.createElement("span", {
    className: 'mdi mdi-' + icon
  }), label);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const cx = (...a) => a.filter(Boolean).join(' ');
function Button({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  className,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    className: cx('om-btn', 'om-btn--' + variant, size === 'dialog' && 'om-btn--dialog', className)
  }, rest), icon && /*#__PURE__*/React.createElement("span", {
    className: 'mdi mdi-' + icon
  }), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/ChipButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function ChipButton({
  kind = 'start',
  children,
  ...rest
}) {
  const label = children ?? {
    start: 'Start',
    cancel: 'Cancel',
    skip: 'Skip'
  }[kind];
  return /*#__PURE__*/React.createElement("button", _extends({
    className: 'om-chip-btn om-chip-btn--' + kind
  }, rest), label);
}
Object.assign(__ds_scope, { ChipButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/ChipButton.jsx", error: String((e && e.message) || e) }); }

// components/core/CountPill.jsx
try { (() => {
function CountPill({
  children
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "om-count"
  }, children);
}
Object.assign(__ds_scope, { CountPill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/CountPill.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const ICON = {
  approve: 'check',
  reject: 'close',
  archive: 'archive-arrow-down',
  changes: 'source-branch',
  summary: 'text-box-search-outline',
  failed: 'text-box-remove-outline'
};
function IconButton({
  variant = 'approve',
  icon,
  size,
  title,
  ...rest
}) {
  if (variant === 'info') return /*#__PURE__*/React.createElement("button", _extends({
    className: "om-outline om-outline--info",
    title: title || 'View ticket details'
  }, rest), "i");
  if (['approve', 'reject', 'archive'].includes(variant)) return /*#__PURE__*/React.createElement("button", _extends({
    className: 'om-round om-round--' + variant,
    title: title
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: 'mdi mdi-' + (icon || ICON[variant])
  }));
  if (['changes', 'summary', 'failed'].includes(variant)) return /*#__PURE__*/React.createElement("button", _extends({
    className: 'om-outline om-outline--' + variant,
    title: title
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: 'mdi mdi-' + (icon || ICON[variant])
  }));
  const extra = variant === 'doctor' ? ' om-square--doctor' : variant === 'scheduled' ? ' om-square--scheduled' : '';
  return /*#__PURE__*/React.createElement("button", _extends({
    className: 'om-square' + (size === 'sm' ? ' om-square--sm' : '') + extra,
    title: title
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: 'mdi mdi-' + (icon || 'clock-outline')
  }));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Modal.jsx
try { (() => {
function Modal({
  title,
  open = true,
  onClose,
  footer,
  children,
  width = 500,
  inline = false
}) {
  if (!open) return null;
  const box = /*#__PURE__*/React.createElement("div", {
    className: "om-modal",
    style: {
      maxWidth: width
    },
    onClick: e => e.stopPropagation()
  }, title && /*#__PURE__*/React.createElement("div", {
    className: "om-modal-header"
  }, /*#__PURE__*/React.createElement("h2", null, title)), /*#__PURE__*/React.createElement("div", {
    className: "om-modal-body"
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    className: "om-modal-footer"
  }, footer));
  if (inline) return box;
  return /*#__PURE__*/React.createElement("div", {
    className: "om-overlay",
    onClick: onClose
  }, box);
}
function DetailRow({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '.375rem',
      marginBottom: '1rem'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "om-detail-label"
  }, label), /*#__PURE__*/React.createElement("div", {
    className: "om-detail-value"
  }, children));
}
function EvalCheck({
  pass = true,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "om-eval-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: 'mdi ' + (pass ? 'mdi-check-circle' : 'mdi-close-circle'),
    style: {
      color: pass ? 'var(--om-success)' : 'var(--om-danger)',
      fontSize: '1rem',
      marginTop: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--om-text)'
    }
  }, children));
}
Object.assign(__ds_scope, { Modal, DetailRow, EvalCheck });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Modal.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Input({
  multiline,
  rows = 4,
  ...rest
}) {
  return multiline ? /*#__PURE__*/React.createElement("textarea", _extends({
    className: "om-input",
    rows: rows,
    style: {
      resize: 'vertical',
      lineHeight: 1.5
    }
  }, rest)) : /*#__PURE__*/React.createElement("input", _extends({
    className: "om-input"
  }, rest));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Select({
  options = [],
  size = 'sm',
  value,
  onChange,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("select", _extends({
    className: 'om-select' + (size === 'md' ? ' om-select--md' : ''),
    value: value,
    onChange: onChange
  }, rest), options.map(o => {
    const v = typeof o === 'string' ? o : o.value;
    const l = typeof o === 'string' ? o : o.label;
    return /*#__PURE__*/React.createElement("option", {
      key: v,
      value: v
    }, l);
  }));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/board/TaskCard.jsx
try { (() => {
function TaskCard({
  ticket = {},
  column = 'todo',
  agents = ['None', 'Human', 'Claude', 'Codex', 'Kimi'],
  onStart,
  onCancel,
  onApprove,
  onReject,
  onArchive,
  onSkip,
  onInfo,
  onChanges,
  onSummary
}) {
  const t = ticket;
  const deps = t.deps || 0;
  return /*#__PURE__*/React.createElement("div", {
    className: "om-task"
  }, /*#__PURE__*/React.createElement("div", {
    className: "om-task-actions"
  }, deps > 0 && /*#__PURE__*/React.createElement("span", {
    className: "om-badge om-badge--deps om-tone-blue",
    style: {
      marginRight: 'auto'
    }
  }, deps, " deps"), column === 'todo' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(__ds_scope.ChipButton, {
    kind: "start",
    disabled: t.blocked,
    onClick: onStart
  }), /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    variant: "square",
    size: "sm",
    icon: "close-circle-outline",
    title: "Remove ticket"
  })), column === 'in_progress' && /*#__PURE__*/React.createElement(__ds_scope.ChipButton, {
    kind: "cancel",
    onClick: onCancel
  }), column === 'eval' && /*#__PURE__*/React.createElement(__ds_scope.ChipButton, {
    kind: "skip",
    onClick: onSkip
  }), column === 'review' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '.375rem',
      marginLeft: 'auto'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    variant: "approve",
    onClick: onApprove,
    title: "Approve \u2014 move to Done"
  }), /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    variant: "reject",
    onClick: onReject,
    title: "Reject \u2014 move back to TODO with comment"
  })), column === 'done' && /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    variant: "archive",
    onClick: onArchive,
    title: "Archive ticket",
    style: {
      marginLeft: 'auto'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      paddingRight: '.55rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "om-task-title"
  }, t.title), /*#__PURE__*/React.createElement("div", {
    className: "om-task-id"
  }, t.id), t.assignee && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: '.3rem',
      display: 'flex',
      gap: '.25rem',
      alignItems: 'baseline'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '.7rem',
      fontWeight: 600,
      color: 'var(--om-text-muted)'
    }
  }, "Assignee:"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '.72rem',
      fontWeight: 500,
      color: 'var(--om-text-value)'
    }
  }, t.assignee)), column === 'todo' && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: '.4rem',
      display: 'flex',
      alignItems: 'center',
      gap: '.35rem'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: '.72rem',
      fontWeight: 600,
      color: 'var(--om-text-label)'
    }
  }, "Agent:"), /*#__PURE__*/React.createElement(__ds_scope.Select, {
    options: agents,
    defaultValue: t.agent || 'Claude',
    style: {
      flex: 1
    }
  })), (t.state || t.evalFailed || t.testFailed) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '.35rem',
      marginTop: '.35rem'
    }
  }, t.state && /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    state: t.state
  }, t.stateLabel || t.state), t.evalFailed && /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    kind: "flag",
    tone: "red",
    icon: "alert-circle"
  }, "Eval failed"), t.testFailed && /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    kind: "flag",
    tone: "red",
    icon: "alert-circle"
  }, "Test failed")), (column === 'eval' || column === 'merging') && (t.agentName ? /*#__PURE__*/React.createElement("div", {
    className: "om-evaluator"
  }, /*#__PURE__*/React.createElement("b", null, column === 'eval' ? 'Evaluator:' : 'Merge Agent:'), /*#__PURE__*/React.createElement("span", null, t.agentName)) : /*#__PURE__*/React.createElement("div", {
    className: "om-evaluator om-evaluator--pending"
  }, column === 'eval' ? 'Awaiting evaluation' : 'Awaiting merge resolve'))), /*#__PURE__*/React.createElement("div", {
    className: 'om-task-footer' + (column === 'todo' ? ' om-task-footer--todo' : '')
  }, column === 'todo' && /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    variant: "square",
    icon: "clock-outline",
    title: "Schedule"
  }), (column === 'review' || column === 'done') && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    variant: "changes",
    onClick: onChanges,
    title: "View code changes"
  }), /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    variant: "summary",
    onClick: onSummary,
    title: "Run summary"
  })), /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    variant: "info",
    onClick: onInfo
  })));
}
Object.assign(__ds_scope, { TaskCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/board/TaskCard.jsx", error: String((e && e.message) || e) }); }

// components/board/KanbanColumn.jsx
try { (() => {
function KanbanColumn({
  title,
  columnId = 'todo',
  tickets = [],
  children,
  renderCard
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: 'om-column' + (columnId === 'todo' ? ' om-column--todo' : '')
  }, /*#__PURE__*/React.createElement("div", {
    className: "om-column-header"
  }, /*#__PURE__*/React.createElement("h3", null, title), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: '.5rem'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.CountPill, null, tickets.length))), /*#__PURE__*/React.createElement("div", {
    className: "om-task-list"
  }, children || tickets.map(t => renderCard ? renderCard(t) : /*#__PURE__*/React.createElement(__ds_scope.TaskCard, {
    key: t.id,
    ticket: t,
    column: columnId
  }))));
}
Object.assign(__ds_scope, { KanbanColumn });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/board/KanbanColumn.jsx", error: String((e && e.message) || e) }); }

// components/marketing/Eyebrow.jsx
try { (() => {
function Eyebrow({
  children
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "om-eyebrow"
  }, children);
}
Object.assign(__ds_scope, { Eyebrow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketing/Eyebrow.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Sidebar.jsx
try { (() => {
const SIDEBAR_NAV = {
  plan: {
    icons: [['plan-dashboard', 'view-dashboard', 'Dashboard'], ['plan-structure', 'sitemap', 'Structure'], ['plan-prd', 'file-document-outline', 'PRD'], ['plan-mockups', 'image-multiple', 'Mockups'], ['plan-skills', 'school-outline', 'Skills'], ['plan-scratchpad', 'note-text', 'Scratch Pad']],
    groups: [['Core', [['plan-prd', 'PRD'], ['plan-architecture', 'Architecture'], ['plan-initiate-stack', 'Initiate Stack'], ['plan-bootstrap-prototype', 'Bootstrap Prototype'], ['plan-epics', 'Epic Creation'], ['plan-ticket-gen', 'Ticket Generation'], ['plan-bdd-use-cases', 'BDD User Stories']]], ['Design', [['plan-mockups', 'Mockups'], ['plan-style-guide', 'Style Guide'], ['plan-data-model', 'Data Model']]], ['Requirements', [['plan-functional-requirements', 'Functional Requirements'], ['plan-non-functional-requirements', 'Non-Functional Requirements'], ['plan-use-case-diagrams', 'Use Case Diagrams']]]]
  },
  build: {
    icons: [['workspace', 'view-dashboard-outline', 'Workspace'], ['kanban', 'view-column', 'Board'], ['minor-fix', 'wrench-outline', 'Minor Fix'], ['backlog', 'format-list-bulleted', 'Backlog'], ['automation', 'lightning-bolt-outline', 'Automation']],
    groups: [['Development', [['workspace', 'Workspace'], ['kanban', 'Board'], ['minor-fix', 'Minor Fix'], ['backlog', 'Backlog']]], ['Operations', [['automation', 'Automation']]]]
  },
  review: {
    icons: [['epics', 'shape-outline', 'Epics'], ['logs', 'text-box-outline', 'Logs'], ['archive', 'archive', 'Archive'], ['review-codemap', 'graph-outline', 'Code Map']],
    groups: [['Review', [['epics', 'Epics'], ['logs', 'Logs'], ['archive', 'Archive']]], ['Insight', [['review-codemap', 'Code Map']]]]
  }
};
const TABS = [['plan', 'map-outline', 'Plan'], ['build', 'hammer-wrench', 'Build'], ['review', 'clipboard-check-outline', 'Review']];
function Sidebar({
  mode = 'build',
  activeView = 'kanban',
  collapsed = false,
  autoOn = false,
  onModeChange,
  onViewChange,
  onToggleCollapse,
  onToggleAuto,
  children
}) {
  const nav = SIDEBAR_NAV[mode];
  const go = v => onViewChange && onViewChange(v);
  if (collapsed) return /*#__PURE__*/React.createElement("div", {
    className: "om-sidebar om-sidebar--collapsed"
  }, /*#__PURE__*/React.createElement("div", {
    className: "om-sidebar-header",
    style: {
      justifyContent: 'center',
      padding: '.75rem 0'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "om-ghost-icon",
    onClick: onToggleCollapse
  }, /*#__PURE__*/React.createElement("span", {
    className: "mdi mdi-chevron-right"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 4
    }
  }, TABS.map(([k, i, l]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    title: l,
    className: 'om-collapsed-item' + (mode === k ? ' is-active' : ''),
    onClick: () => onModeChange && onModeChange(k)
  }, /*#__PURE__*/React.createElement("span", {
    className: 'mdi mdi-' + i
  }))), /*#__PURE__*/React.createElement("div", {
    className: "om-divider",
    style: {
      margin: '.3rem .5rem'
    }
  }), nav.icons.map(([v, i, l]) => /*#__PURE__*/React.createElement("div", {
    key: v,
    title: l,
    className: 'om-collapsed-item' + (activeView === v ? ' is-active' : ''),
    onClick: () => go(v)
  }, /*#__PURE__*/React.createElement("span", {
    className: 'mdi mdi-' + i
  })))));
  return /*#__PURE__*/React.createElement("div", {
    className: "om-sidebar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "om-sidebar-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "om-tabs"
  }, TABS.map(([k, i, l]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    className: 'om-tab' + (mode === k ? ' is-active' : ''),
    onClick: () => onModeChange && onModeChange(k)
  }, /*#__PURE__*/React.createElement("span", {
    className: 'mdi mdi-' + i
  }), l))), /*#__PURE__*/React.createElement("button", {
    className: "om-ghost-icon",
    onClick: onToggleCollapse,
    title: "Collapse"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mdi mdi-chevron-left"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "om-nav-icons"
  }, nav.icons.map(([v, i, l]) => /*#__PURE__*/React.createElement("button", {
    key: v,
    title: l,
    className: 'om-nav-btn' + (activeView === v ? ' is-active' : ''),
    onClick: () => go(v)
  }, /*#__PURE__*/React.createElement("span", {
    className: 'mdi mdi-' + i
  })))), /*#__PURE__*/React.createElement("div", {
    className: "om-text-menu"
  }, nav.groups.map(([g, items]) => /*#__PURE__*/React.createElement("div", {
    key: g,
    className: "om-text-group"
  }, /*#__PURE__*/React.createElement("div", {
    className: "om-group-label"
  }, g), items.map(([v, l]) => /*#__PURE__*/React.createElement("a", {
    key: v,
    className: 'om-text-link' + (activeView === v ? ' is-active' : ''),
    onClick: () => go(v)
  }, l))))), children), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingBottom: '.4rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "om-divider"
  }), [['settings', 'cog-outline', 'Settings'], ['help', 'help-circle-outline', 'Help'], ['about', 'information-outline', 'About']].map(([v, i, l]) => /*#__PURE__*/React.createElement("div", {
    key: v,
    className: 'om-board-item' + (activeView === v ? ' is-active' : ''),
    onClick: () => go(v)
  }, /*#__PURE__*/React.createElement("span", {
    className: "om-board-icon"
  }, /*#__PURE__*/React.createElement("span", {
    className: 'mdi mdi-' + i
  })), /*#__PURE__*/React.createElement("span", null, l))), mode === 'build' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "om-divider"
  }), /*#__PURE__*/React.createElement("div", {
    className: "om-board-item",
    onClick: onToggleAuto
  }, /*#__PURE__*/React.createElement("span", {
    className: "om-board-icon"
  }, /*#__PURE__*/React.createElement("span", {
    className: 'mdi mdi-lightning-bolt' + (autoOn ? '' : '-outline')
  })), /*#__PURE__*/React.createElement("span", null, "Auto"), /*#__PURE__*/React.createElement("span", {
    className: 'om-auto-ind' + (autoOn ? ' is-on' : '')
  }, autoOn ? 'ON' : 'OFF')))));
}
Object.assign(__ds_scope, { SIDEBAR_NAV, Sidebar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Sidebar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/StatusBar.jsx
try { (() => {
function StatusBar({
  path = 'C:\\dev\\build\\my-project',
  branch = 'main',
  modified = 0,
  untracked = 0,
  ahead = 0,
  project = '',
  build = 'v1.0.2 (a1b2c3d)'
}) {
  const clean = !modified && !untracked && !ahead;
  return /*#__PURE__*/React.createElement("div", {
    className: "om-statusbar"
  }, /*#__PURE__*/React.createElement("span", {
    className: "om-sb-mono",
    style: {
      fontSize: '.7rem',
      color: 'rgba(255,255,255,.6)',
      flex: 1,
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, path), branch && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '.3rem'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mdi mdi-source-branch",
    style: {
      fontSize: '.85rem',
      color: 'rgba(255,255,255,.4)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "om-sb-mono",
    style: {
      fontSize: '.68rem',
      color: 'rgba(255,255,255,.6)'
    }
  }, branch), modified > 0 && /*#__PURE__*/React.createElement("span", {
    className: "om-git-badge",
    style: {
      background: 'rgba(229,168,48,.2)',
      color: '#e5a830'
    }
  }, modified, "M"), untracked > 0 && /*#__PURE__*/React.createElement("span", {
    className: "om-git-badge",
    style: {
      background: 'rgba(91,155,213,.2)',
      color: '#5b9bd5'
    }
  }, untracked, "?"), ahead > 0 && /*#__PURE__*/React.createElement("span", {
    className: "om-git-badge",
    style: {
      background: 'rgba(109,212,160,.2)',
      color: '#6dd4a0'
    }
  }, "\u2191", ahead), clean && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '.68rem',
      color: 'rgba(109,212,160,.6)'
    }
  }, "\u2713")), project && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: '50%',
      transform: 'translateX(-50%)',
      fontSize: '.7rem',
      fontWeight: 500,
      color: '#fff'
    }
  }, project), /*#__PURE__*/React.createElement("span", {
    className: "om-sb-mono",
    style: {
      fontSize: '.65rem',
      color: 'rgba(255,255,255,.45)'
    }
  }, build));
}
Object.assign(__ds_scope, { StatusBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/StatusBar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TitleBar.jsx
try { (() => {
function TitleBar({
  title = 'Ombuto Code',
  logoSrc,
  color
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "om-titlebar",
    style: color ? {
      background: color
    } : undefined
  }, /*#__PURE__*/React.createElement("div", {
    className: "om-app-title"
  }, logoSrc && /*#__PURE__*/React.createElement("img", {
    src: logoSrc,
    alt: "",
    style: {
      width: 18,
      height: 18,
      display: 'block'
    }
  }), /*#__PURE__*/React.createElement("span", null, title)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "om-win-btn"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mdi mdi-window-minimize"
  })), /*#__PURE__*/React.createElement("div", {
    className: "om-win-btn"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mdi mdi-window-maximize"
  })), /*#__PURE__*/React.createElement("div", {
    className: "om-win-btn om-win-btn--close"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mdi mdi-close"
  }))));
}
Object.assign(__ds_scope, { TitleBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TitleBar.jsx", error: String((e && e.message) || e) }); }

__ds_ns.KanbanColumn = __ds_scope.KanbanColumn;

__ds_ns.TaskCard = __ds_scope.TaskCard;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.ChipButton = __ds_scope.ChipButton;

__ds_ns.CountPill = __ds_scope.CountPill;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Modal = __ds_scope.Modal;

__ds_ns.DetailRow = __ds_scope.DetailRow;

__ds_ns.EvalCheck = __ds_scope.EvalCheck;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Eyebrow = __ds_scope.Eyebrow;

__ds_ns.SIDEBAR_NAV = __ds_scope.SIDEBAR_NAV;

__ds_ns.Sidebar = __ds_scope.Sidebar;

__ds_ns.StatusBar = __ds_scope.StatusBar;

__ds_ns.TitleBar = __ds_scope.TitleBar;

})();
