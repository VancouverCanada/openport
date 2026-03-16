const items = [
  { href: '/dashboard', label: 'Overview', meta: 'Workspace pulse' },
  { href: '/dashboard/integrations', label: 'Integrations', meta: 'Keys, drafts, audit' },
  { href: '/chat', label: 'AI Workspace', meta: 'Conversations and actions' }
]

export function SideNav() {
  return (
    <aside className="side-nav">
      <div className="brand-card">
        <span className="brand-kicker">OpenPort OS</span>
        <h1>Ship AI operators without hiding your controls.</h1>
        <p>Authentication, workspace boundaries, approvals and chat all live in one deployment shape.</p>
      </div>

      <nav className="nav-stack" aria-label="Dashboard">
        {items.map((item) => (
          <a key={item.href} className="nav-item" href={item.href}>
            <strong>{item.label}</strong>
            <span>{item.meta}</span>
          </a>
        ))}
      </nav>
    </aside>
  )
}
