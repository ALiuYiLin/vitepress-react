import { DataProvider } from './lib/vp-store'
import { Layout } from './theme/Layout'

export default function App() {
  return (
    <DataProvider>
      <Layout />
    </DataProvider>
  )
}
