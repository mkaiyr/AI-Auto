import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { Features } from './components/Features'
import { FunctionCards } from './components/FunctionCards'
import { Footer } from './components/Footer'

export default function App() {
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
