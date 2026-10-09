import { useEffect } from 'react'
import { AppShell } from './app/AppShell'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { Features } from './components/Features'
import { FunctionCards } from './components/FunctionCards'
import { Footer } from './components/Footer'
import { usePath } from './router'

const LANDING_TITLE = 'AI Auto — всё о вашем автомобиле'

export default function App() {
  const path = usePath()
  const isApp = path === '/app' || path.startsWith('/app/')

  useEffect(() => {
    if (!isApp) document.title = LANDING_TITLE
  }, [isApp])

  if (isApp) return <AppShell path={path} />

  return (
    <>
      <Header />
      <main>
        <Hero />
        <Features />
        <FunctionCards />
      </main>
      <Footer />
    </>
  )
}
