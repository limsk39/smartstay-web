'use client'

import BackButton from './BackButton'

export default function PageHeader({ title, subtitle, backHref, showBack = true }) {
  return (
    <div className="flex flex-col gap-2 mb-8">
      {showBack && (
        <div className="mb-2">
          <BackButton href={backHref} />
        </div>
      )}
      <h1 className="text-3xl font-bold text-white">{title}</h1>
      {subtitle && <p className="text-gray-400">{subtitle}</p>}
    </div>
  )
}
