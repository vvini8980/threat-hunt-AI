export default function Spinner({ size = 'md', text }) {
  const sizeClasses = {
    sm: 'h-6 w-6 border-2',
    md: 'h-10 w-10 border-4',
    lg: 'h-16 w-16 border-4',
  }

  const spinnerSize = sizeClasses[size] || sizeClasses.md

  return (
    <div className="flex min-h-full flex-col items-center justify-center p-8 bg-bg-primary text-white">
      <div className={`${spinnerSize} animate-spin rounded-full border-[#2a2d3e] border-t-indigo-500`}></div>
      {text && <p className="mt-4 text-sm text-gray-400 font-medium">{text}</p>}
    </div>
  )
}
