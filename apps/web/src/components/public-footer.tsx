export function PublicFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="landing-footer">
      <div className="landing-footer-inner">
        <p>&copy; {year} OpenPort. Built by Accentrust.</p>
        <p>Open source under AGPLv3.</p>
      </div>
    </footer>
  )
}
