import { useState, useCallback } from 'react'
import { Info, Waves, Grid3x3, LayoutGrid, Globe, Columns2 } from 'lucide-react'
import { AppSidebar }    from '@kern/organisms/AppSidebar'
import { HipukuLogo }    from '@kern/organisms/HipukuLogo'
import { ErrorBoundary } from '@kern/organisms/ErrorBoundary'
import { GitHubIcon }    from '@kern/atoms/GitHubIcon'
import { ViewAbout }   from '@/components/ViewAbout'
import { ViewSimulate } from '@/components/ViewSimulate'
import { ViewSpace }   from '@/components/ViewSpace'
import { ViewSweep }   from '@/components/ViewSweep'
import { ViewIsolate } from '@/components/ViewIsolate'
import type { ViewId } from './types'

const NAV_ITEMS = [
  { id: 'about',    label: 'About this tool',   icon: Info       },
  { id: 'simulate', label: 'Simulate',           icon: Waves      },
  { id: 'isolate',  label: 'Channels',           icon: Columns2   },
  { id: 'space',    label: 'Parameter space',    icon: Grid3x3    },
  { id: 'sweep',    label: 'Phase sweep',        icon: LayoutGrid },
]

const SOCIAL_LINKS = [
  { Icon: Globe,      label: 'gray-scott website', href: 'https://www.hipuku.dev'               },
  { Icon: GitHubIcon, label: 'GitHub',              href: 'https://github.com/hipuku/gray-scott' },
]

const LOGO_FILLS = {
  hi: 'var(--color-pulsar)',
  pu: 'var(--color-quasar)',
  ku: 'var(--color-corona)',
}

export default function App() {
  const [activeView, setActiveView] = useState<ViewId>('about')
  const [mobileOpen, setMobileOpen] = useState(false)

  // Jump params: ViewSweep tells App which (f,k) to send to ViewSimulate.
  // We store them here and ViewSimulate reads them on mount via a key reset.
  const [jumpParams, setJumpParams] = useState<{ f: number; k: number } | null>(null)

  const handleJumpToParams = useCallback((f: number, k: number) => {
    setJumpParams({ f, k })
    setActiveView('simulate')
  }, [])

  return (
    <ErrorBoundary>
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <AppSidebar
        logo={<img src="/gray-scott.svg" alt="gray-scott" className="h-7 w-auto" />}
        navItems={NAV_ITEMS}
        activeId={activeView}
        onNavigate={(id) => setActiveView(id as ViewId)}
        accentActiveClass="text-pulsar"
        socialLinks={SOCIAL_LINKS}
        mobileOpen={mobileOpen}
        onMobileToggle={() => setMobileOpen(o => !o)}
        colophon={
          <div className="flex items-center gap-2">
            <span>2026 © gray-scott by</span>
            <HipukuLogo hoverFills={LOGO_FILLS} />
          </div>
        }
      />

      <main className="flex-1 h-full overflow-y-auto p-10">
        {activeView === 'about'    && <ViewAbout    />}
        {activeView === 'simulate' && (
          <ViewSimulate
            key={jumpParams ? `${jumpParams.f}-${jumpParams.k}` : 'default'}
            initialF={jumpParams?.f}
            initialK={jumpParams?.k}
          />
        )}
        {activeView === 'isolate'  && <ViewIsolate  />}
        {activeView === 'space'    && <ViewSpace    onJumpToParams={handleJumpToParams} />}
        {activeView === 'sweep'    && <ViewSweep    onJumpToParams={handleJumpToParams} />}
      </main>
    </div>
    </ErrorBoundary>
  )
}
