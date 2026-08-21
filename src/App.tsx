import { useState } from 'react'
import { Info, Waves, Grid3x3, Columns2 } from 'lucide-react'
import { AppShell }      from '@kern/templates/AppShell'
import { SocialBar }     from '@kern/molecules/SocialBar'
import { Colophon }      from '@kern/molecules/Colophon'
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

  return (
    <AppShell
      logo={<img src="/gray-scott.svg" alt="gray-scott" className="h-7 w-auto" />}
      navItems={NAV_ITEMS}
      activeId={activeView}
      onNavigate={(id) => setActiveView(id as ViewId)}
      accentActiveClass="text-nebula"
      social={<SocialBar siteName="gray-scott" githubUrl="https://github.com/hipuku/gray-scott" />}
      colophon={<Colophon name="gray-scott" hoverFills={LOGO_FILLS} />}
      smallScreenNotice={
        <div className="flex flex-col gap-2 text-center max-w-xs">
          <p className="type-h4 text-ink-title">Patterns need room to grow</p>
          <p className="type-p-sm text-ink-body">
            gray-scott is desktop-only for now — the reaction needs a bigger petri dish. Open it on a wider screen.
          </p>
        </div>
      }
    >
      {activeView === 'about'    && <ViewAbout    />}
      {activeView === 'simulate' && <ViewSimulate />}
      {activeView === 'isolate'  && <ViewIsolate  />}
      {activeView === 'space'    && <ViewSpace    />}
    </AppShell>
  )
}
