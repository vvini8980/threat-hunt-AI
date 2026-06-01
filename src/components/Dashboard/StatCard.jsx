function StatCard({ title, value, icon: Icon, color = 'indigo', subtitle }) {
  const colorClasses = {
    indigo: 'bg-accent-primary/15 text-accent-primary border-t-accent-primary',
    blue: 'bg-status-active/15 text-status-active border-t-status-active',
    teal: 'bg-status-completed/15 text-status-completed border-t-status-completed',
    purple: 'bg-accent-secondary/15 text-accent-secondary border-t-accent-secondary',
    yellow: 'bg-status-pending/15 text-status-pending border-t-status-pending',
    green: 'bg-status-completed/15 text-status-completed border-t-status-completed',
    red: 'bg-status-critical/15 text-status-critical border-t-status-critical',
  }

  const selectedColor = colorClasses[color] || colorClasses.indigo

  return (
    <div className={`relative rounded-xl border border-border bg-bg-card p-5 transition-colors hover:border-accent-primary/40 border-t-4 ${selectedColor.split(' ').find(c => c.startsWith('border-t-'))}`}>
      {Icon && (
        <div
          className={`absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full ${selectedColor.split(' ').filter(c => !c.startsWith('border-t-')).join(' ')}`}
        >
          <Icon size={20} />
        </div>
      )}

      <p className="pr-12 text-sm font-medium text-gray-400">{title}</p>
      <p className="mt-4 text-3xl font-bold text-white">{value}</p>
      {subtitle && (
        <p className="mt-2 text-xs text-gray-500">{subtitle}</p>
      )}
    </div>
  )
}

export default StatCard
