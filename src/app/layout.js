import "./globals.css"

export const metadata = {
  title: "Gym Premium",
  description: "Système intelligent de programmation musculaire",
  manifest: "/manifest.json"
}

export const viewport = {
  width: "device-width",
  initialScale: 1
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className="bg-zinc-950 text-white antialiased">

        <div className="flex min-h-screen flex-col">

          {/* HEADER DESKTOP */}
          <header className="border-b border-white/10 bg-zinc-950/80 backdrop-blur">
            <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">

              <h1 className="text-lg font-semibold">
                Gym Premium
              </h1>

              <nav className="hidden md:flex gap-6 text-sm text-zinc-400">

                <a href="/dashboard" className="hover:text-white">
                  Dashboard
                </a>

                <a href="/system" className="hover:text-white">
                  Système
                </a>

                <a href="/workout" className="hover:text-white">
                  Workout
                </a>

                <a href="/progression" className="hover:text-white">
                  Progression
                </a>

                <a href="/profile" className="hover:text-white">
                  Profil
                </a>

              </nav>

            </div>
          </header>


          {/* CONTENU */}
          <main className="flex-1">

            <div
              className="
              mx-auto
              w-full
              max-w-4xl
              px-4
              sm:px-6
              md:px-8
              py-6
              pb-28
              "
            >
              {children}
            </div>

          </main>


          {/* NAVBAR MOBILE */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-white/10 bg-zinc-950 backdrop-blur">

            <div className="grid grid-cols-4 text-center text-xs py-2">

              <a
                href="/dashboard"
                className="flex flex-col items-center text-zinc-400 hover:text-white"
              >
                Dashboard
              </a>

              <a
                href="/system"
                className="flex flex-col items-center text-zinc-400 hover:text-white"
              >
                Système
              </a>

              <a
                href="/workout"
                className="flex flex-col items-center text-zinc-400 hover:text-white"
              >
                Workout
              </a>

              <a
                href="/profile"
                className="flex flex-col items-center text-zinc-400 hover:text-white"
              >
                Profil
              </a>

            </div>

          </nav>

        </div>

      </body>
    </html>
  )
}