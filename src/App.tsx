import { useState } from 'react'
import { Info, Waves, Grid3x3, Columns2 } from 'lucide-react'
import { AppSidebar }    from '@kern/organisms/AppSidebar'
import { HipukuLogo }    from '@kern/atoms/HipukuLogo'
import { ErrorBoundary } from '@kern/organisms/ErrorBoundary'
import { SocialBar }     from '@kern/molecules/SocialBar'
import { ViewAbout }   from '@/components/ViewAbout'
import { ViewSimulate } from '@/components/ViewSimulate'
import { ViewSpace }   from '@/components/ViewSpace'
import { ViewIsolate } from '@/components/ViewIsolate'
import type { ViewId } from './types'

const NAV_ITEMS = [
  { id: 'about',    label: 'About this tool',   icon: Info       },
  { id: 'simulate', label: 'Simulate',           icon: Waves      },
  { id: 'isolate',  label: 'Channels',           icon: Columns2   },
  { id: 'space',    label: 'Parameter space',    icon: Grid3x3    },
]

const LOGO_FILLS = {
  hi: 'var(--color-nebula)',
  pu: 'var(--color-supernova)',
  ku: 'var(--color-solstice)',
}

export default function App() {
  const [activeView, setActiveView] = useState<ViewId>('about')
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <ErrorBoundary>
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <AppSidebar
        logo={<img src="/gray-scott.svg" alt="gray-scott" className="h-7 w-auto" />}
        navItems={NAV_ITEMS}
        activeId={activeView}
        onNavigate={(id) => setActiveView(id as ViewId)}
        accentActiveClass="text-nebula"
        social={<SocialBar siteName="gray-scott" githubUrl="https://github.com/hipuku/gray-scott" />}
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
        {activeView === 'simulate' && <ViewSimulate />}
        {activeView === 'isolate'  && <ViewIsolate  />}
        {activeView === 'space'    && <ViewSpace    />}
      </main>
    </div>
    </ErrorBoundary>
  )
}
